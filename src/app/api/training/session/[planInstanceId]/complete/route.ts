import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import {
  calculateNextWeek,
  checkDeloadRequired,
  getProgressionType,
  getInitialProgressionState,
} from "@/lib/progression";
import { shouldPromoteIdentity } from "@/lib/identity";
import { Identity, Prisma } from "@/generated/prisma";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

type CompleteBody = {
  sessionNumber: number;
  durationSeconds: number;
  completed: boolean;
  logs: {
    plannedExerciseId: string;
    actualSets: number;
    actualReps: number;
    weightKg?: number;
  }[];
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planInstanceId: string }> },
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;
    const { planInstanceId } = await params;

    // ── Parse body once ──────────────────────────────────────────────────────
    const body = (await req.json()) as CompleteBody;

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

    if (!instance) return notFound("Plan instance");
    if (instance.userId !== userId) return forbidden();
    if (instance.status !== "ACTIVE") {
      return validationError(
        `Plan instance is ${instance.status.toLowerCase()}`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { identity: true, primaryGoal: true, trainingLocation: true },
    });

    if (!user) return notFound("User");

    const totalSessions =
      instance.plan.sessionsPerWeek * instance.plan.durationWeeks;
    const isLastSession = instance.currentSession >= totalSessions;

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

      const initial = getInitialProgressionState(
        progressionType,
        instance.level,
      );
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
          sessionDraft: Prisma.JsonNull,
          progressionType,
          progressionWeek: next.progressionWeek,
          currentSets: next.currentSets,
          currentReps: next.currentReps,
          currentRestSeconds: next.currentRestSeconds,
          deloadFlagged,
        },
      });

      // ── Write workout logs ─────────────────────────────────────────────────
      if (body.logs && body.logs.length > 0) {
        await tx.workoutLog.createMany({
          data: body.logs.map((log) => ({
            userId,
            instanceId: planInstanceId,
            sessionNumber: body.sessionNumber,
            plannedExerciseId: log.plannedExerciseId,
            actualSets: log.actualSets,
            actualReps: log.actualReps,
            weightKg: log.weightKg ?? null,
          })),
        });
      }

      if (shouldPromote) {
        await tx.user.update({
          where: { id: userId },
          data: {
            identity: Identity.EXECUTIVE_PERFORMANCE,
            identityAssignedAt: new Date(),
          },
        });
      }
    });

    return apiSuccess({
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
    });
  } catch (err) {
    console.error("[session/complete] error:", err);
    return internalError(err);
  }
}
