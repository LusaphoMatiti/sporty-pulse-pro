import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus, Prisma } from "@/generated/prisma";

// ─── POST /api/programs/schedule/reorder ───────────────────────────────────
//
// Replaces the caller's own weekly arrangement for their active
// PlanInstance in one shot — e.g. dragging Wednesday's session up to
// Monday shifts everything in between by one, same as any normal
// drag-reorder list. The client sends the resulting full week; this
// endpoint validates it's a genuine permutation of the plan's own
// sessions, then persists only what actually differs from the shared
// plan template, via PlanInstanceDayOverride. The underlying
// WorkoutPlan/PlannedSession template rows — shared by every user with
// an active instance of the same plan — are never written to.

interface ArrangementEntry {
  dayOfWeek: number;
  plannedSessionId: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { instanceId?: string; arrangement?: ArrangementEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { instanceId, arrangement } = body;

  if (!instanceId || !Array.isArray(arrangement) || arrangement.length !== 7) {
    return NextResponse.json(
      { error: "instanceId and a 7-day arrangement are required" },
      { status: 400 },
    );
  }

  // Structural validation — every day 0-6 exactly once, every
  // plannedSessionId (where not a rest day) exactly once. Catches a
  // stale or tampered client payload before it ever reaches the DB.
  const seenDays = new Set<number>();
  const seenSessionIds = new Set<string>();
  for (const entry of arrangement) {
    if (
      typeof entry?.dayOfWeek !== "number" ||
      !Number.isInteger(entry.dayOfWeek) ||
      entry.dayOfWeek < 0 ||
      entry.dayOfWeek > 6 ||
      seenDays.has(entry.dayOfWeek)
    ) {
      return NextResponse.json(
        { error: "Invalid or duplicate dayOfWeek in arrangement" },
        { status: 400 },
      );
    }
    seenDays.add(entry.dayOfWeek);

    if (entry.plannedSessionId !== null) {
      if (
        typeof entry.plannedSessionId !== "string" ||
        seenSessionIds.has(entry.plannedSessionId)
      ) {
        return NextResponse.json(
          { error: "Invalid or duplicate plannedSessionId in arrangement" },
          { status: 400 },
        );
      }
      seenSessionIds.add(entry.plannedSessionId);
    }
  }

  // Ownership check — never let a user reorder an instance that isn't
  // theirs, or one that isn't currently active.
  const instance = await prisma.planInstance.findFirst({
    where: {
      id: instanceId,
      userId: session.user.id,
      status: InstanceStatus.ACTIVE,
    },
    select: { id: true, planId: true },
  });
  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const planSessions = await prisma.plannedSession.findMany({
    where: { planId: instance.planId },
    select: { id: true, dayOfWeek: true },
  });
  const planSessionIds = new Set(planSessions.map((s) => s.id));

  // Every session that actually belongs to this plan must appear exactly
  // once in the submitted arrangement — guards against a stale payload
  // silently dropping a session or smuggling in one from a different plan.
  const submittedSessionIds = arrangement
    .map((e) => e.plannedSessionId)
    .filter((id): id is string => id !== null);
  const allSessionsAccountedFor =
    submittedSessionIds.length === planSessions.length &&
    submittedSessionIds.every((id) => planSessionIds.has(id));
  if (!allSessionsAccountedFor) {
    return NextResponse.json(
      { error: "Arrangement does not match this plan's sessions" },
      { status: 400 },
    );
  }

  const templateDayById = new Map(planSessions.map((s) => [s.id, s.dayOfWeek]));

  // For each session: if its new day matches the plan template's own
  // default again, drop any override (keeps the table from accumulating
  // no-op rows as a user shuffles things back and forth). Otherwise
  // upsert the override to the new day.
  const ops: Prisma.PrismaPromise<unknown>[] = arrangement
    .filter(
      (e): e is { dayOfWeek: number; plannedSessionId: string } =>
        e.plannedSessionId !== null,
    )
    .map((e) => {
      const templateDay = templateDayById.get(e.plannedSessionId);
      if (templateDay === e.dayOfWeek) {
        return prisma.planInstanceDayOverride.deleteMany({
          where: {
            instanceId: instance.id,
            plannedSessionId: e.plannedSessionId,
          },
        });
      }
      return prisma.planInstanceDayOverride.upsert({
        where: {
          instanceId_plannedSessionId: {
            instanceId: instance.id,
            plannedSessionId: e.plannedSessionId,
          },
        },
        update: { dayOfWeek: e.dayOfWeek },
        create: {
          instanceId: instance.id,
          plannedSessionId: e.plannedSessionId,
          dayOfWeek: e.dayOfWeek,
        },
      });
    });

  try {
    await prisma.$transaction(ops);
  } catch (err) {
    console.error("[programs/schedule/reorder] error:", err);
    return NextResponse.json(
      { error: "Failed to reorder schedule" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
