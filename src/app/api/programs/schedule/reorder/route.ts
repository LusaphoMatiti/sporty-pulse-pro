import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { instanceId?: string; dayA?: number; dayB?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { instanceId, dayA, dayB } = body;
  if (
    !instanceId ||
    typeof dayA !== "number" ||
    typeof dayB !== "number" ||
    !Number.isInteger(dayA) ||
    !Number.isInteger(dayB) ||
    dayA < 0 ||
    dayA > 6 ||
    dayB < 0 ||
    dayB > 6 ||
    dayA === dayB
  ) {
    return NextResponse.json(
      { error: "instanceId and two distinct days (0-6) are required" },
      { status: 400 },
    );
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

  const [planSessions, overrideRows] = await Promise.all([
    prisma.plannedSession.findMany({
      where: { planId: instance.planId },
      select: { id: true, dayOfWeek: true },
    }),
    prisma.planInstanceDayOverride.findMany({
      where: { instanceId: instance.id },
      select: { plannedSessionId: true, dayOfWeek: true },
    }),
  ]);

  const overrideMap = new Map(
    overrideRows.map((o) => [o.plannedSessionId, o.dayOfWeek]),
  );

  function effectiveDay(s: { id: string; dayOfWeek: number | null }) {
    const override = overrideMap.get(s.id);
    return override !== undefined ? override : s.dayOfWeek;
  }

  const sessionAtDayA =
    planSessions.find((s) => effectiveDay(s) === dayA) ?? null;
  const sessionAtDayB =
    planSessions.find((s) => effectiveDay(s) === dayB) ?? null;

  if (!sessionAtDayA && !sessionAtDayB) {
    // Both are rest days — nothing to swap.
    return NextResponse.json({ ok: true });
  }

  const upserts = [];
  if (sessionAtDayA) {
    upserts.push(
      prisma.planInstanceDayOverride.upsert({
        where: {
          instanceId_plannedSessionId: {
            instanceId: instance.id,
            plannedSessionId: sessionAtDayA.id,
          },
        },
        update: { dayOfWeek: dayB },
        create: {
          instanceId: instance.id,
          plannedSessionId: sessionAtDayA.id,
          dayOfWeek: dayB,
        },
      }),
    );
  }
  if (sessionAtDayB) {
    upserts.push(
      prisma.planInstanceDayOverride.upsert({
        where: {
          instanceId_plannedSessionId: {
            instanceId: instance.id,
            plannedSessionId: sessionAtDayB.id,
          },
        },
        update: { dayOfWeek: dayA },
        create: {
          instanceId: instance.id,
          plannedSessionId: sessionAtDayB.id,
          dayOfWeek: dayA,
        },
      }),
    );
  }

  try {
    await prisma.$transaction(upserts);
  } catch (err) {
    console.error("[programs/schedule/reorder] error:", err);
    return NextResponse.json(
      { error: "Failed to reorder schedule" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
