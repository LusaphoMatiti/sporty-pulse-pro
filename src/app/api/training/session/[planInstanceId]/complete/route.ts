// src/app/api/training/session/[planInstanceId]/complete/route.ts
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  calculateNextWeek,
  checkDeloadRequired,
  getProgressionType,
  getInitialProgressionState,
} from "@/lib/progression";
import { shouldPromoteIdentity } from "@/lib/identity";
import { Identity } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { planInstanceId: string } },
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { planInstanceId } = params;

  const instance = await prisma.planInstance.findUnique({
    where: { id: planInstanceId },
    include: {
      plan: {
        select: {
          sessionsPerWeek: true,
          durationWeeks: true,
          templateType: true,
        },
      },
    },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Plan instance not found" },
      { status: 404 },
    );
  }
  if (instance.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (instance.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Plan instance is ${instance.status.toLowerCase()}` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { identity: true, primaryGoal: true, trainingLocation: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const totalSessions =
    instance.plan.sessionsPerWeek * instance.plan.durationWeeks;
  const isLastSession = instance.currentSession >= totalSessions;

  // Initialise progression if not yet set
  let progressionType = instance.progressionType;
  let progressionWeek = instance.progressionWeek ?? 1;
  let currentSets = instance.currentSets;
  let currentReps = instance.currentReps;
  let currentRestSeconds = instance.currentRestSeconds;

  if (!progressionType) {
    progressionType = getProgressionType({
      identity: user.identity ?? Identity.REBUILD,
      goal: user.primaryGoal,
      trainingLocation: user.trainingLocation,
    });

    const initial = getInitialProgressionState(progressionType, instance.level);
    progressionWeek = initial.progressionWeek;
    currentSets = initial.currentSets;
    currentReps = initial.currentReps;
    currentRestSeconds = initial.currentRestSeconds;
  }

  const next = calculateNextWeek({
    progressionType,
    progressionWeek,
    currentSets,
    currentReps,
    currentRestSeconds,
    level: instance.level,
    identity: user.identity,
  });

  const deloadFlagged = checkDeloadRequired(
    user.identity,
    next.progressionWeek,
  );

  const shouldPromote = shouldPromoteIdentity({
    currentIdentity: user.identity ?? Identity.REBUILD,
    primaryGoal: user.primaryGoal,
    progressionWeek: next.progressionWeek,
  });

  await prisma.$transaction(async (tx) => {
    await tx.planInstance.update({
      where: { id: planInstanceId },
      data: {
        currentSession: isLastSession
          ? instance.currentSession
          : instance.currentSession + 1,
        status: isLastSession ? "COMPLETED" : "ACTIVE",
        completedAt: isLastSession ? new Date() : null,
        // Use Prisma.JsonNull to clear a nullable JSON field
        sessionDraft: Prisma.JsonNull,
        progressionType,
        progressionWeek: next.progressionWeek,
        currentSets: next.currentSets,
        currentReps: next.currentReps,
        currentRestSeconds: next.currentRestSeconds,
        deloadFlagged,
      },
    });

    if (shouldPromote) {
      await tx.user.update({
        where: { id: userId },
        data: {
          identity: Identity.EXECUTIVE_PERFORMANCE,
          identityAssignedAt: new Date(),
        },
      });

      console.log(
        `[session/complete] userId=${userId} promoted OPERATOR → EXECUTIVE_PERFORMANCE at week ${next.progressionWeek}`,
      );
    }
  });

  return NextResponse.json(
    {
      ok: true,
      sessionCompleted: instance.currentSession,
      planCompleted: isLastSession,
      progression: {
        week: next.progressionWeek,
        type: progressionType,
        sets: next.currentSets,
        reps: next.currentReps,
        restSeconds: next.currentRestSeconds,
        note: next.progressionNote,
      },
      deloadFlagged,
      identityPromoted: shouldPromote
        ? { from: Identity.OPERATOR, to: Identity.EXECUTIVE_PERFORMANCE }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
