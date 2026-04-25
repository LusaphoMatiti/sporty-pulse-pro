import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";

type LogEntry = {
  plannedExerciseId: string;
  actualSets: number;
  actualReps: number;
  weightKg?: number;
};

type Body = {
  instanceId: string;
  sessionNumber: number;
  durationSeconds: number;
  completed: boolean;
  logs: LogEntry[];
};

export async function POST(req: Request) {
  const auth = await getMobileOrWebSession(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Body = await req.json();
  const { instanceId, sessionNumber, completed, logs } = body;

  // ── Verify the instance belongs to this user ─────────────────────────────
  const instance = await prisma.planInstance.findFirst({
    where: {
      id: instanceId,
      userId: auth.user.id,
      status: InstanceStatus.ACTIVE,
    },
    include: { plan: true },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // ── How many sessions does this plan have in total? ───────────────────────
  const totalSessions = await prisma.plannedSession.count({
    where: { planId: instance.planId },
  });

  const isLastSession = sessionNumber >= totalSessions;

  // ── Write all WorkoutLog rows in a transaction ────────────────────────────
  await prisma.$transaction(async (tx) => {
    // 1. Save a WorkoutLog for each exercise
    if (logs.length > 0) {
      await tx.workoutLog.createMany({
        data: logs.map((log) => ({
          sessionNumber,
          actualSets: log.actualSets,
          actualReps: log.actualReps,
          weightKg: log.weightKg ?? null,
          userId: auth.user.id,
          instanceId,
          plannedExerciseId: log.plannedExerciseId,
        })),
      });
    }

    // 2. Advance the plan instance
    if (completed) {
      if (isLastSession) {
        await tx.planInstance.update({
          where: { id: instanceId },
          data: {
            status: InstanceStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      } else {
        await tx.planInstance.update({
          where: { id: instanceId },
          data: { currentSession: { increment: 1 } },
        });
      }
    }
  });

  return NextResponse.json({ ok: true, advanced: completed });
}
