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

    // Guard against completing a session that no longer matches the plan's
    // actual current session (e.g. a stale draft/deep link from before the
    // plan advanced, or the plan being completed elsewhere in the meantime).
    // Without this, the block below always advances instance.currentSession
    // from the SERVER's state regardless of what the client just completed,
    // while logging the WorkoutLog rows under the CLIENT's reported session
    // number — letting the two silently drift apart. Applies the same way
    // to every plan; nothing here depends on Home vs Gym.
    if (body.sessionNumber !== instance.currentSession) {
      return validationError(
        "This session is no longer the plan's current session — it may have already been completed, or the plan has since moved on.",
      );
    }

    const [user, totalSessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { identity: true, primaryGoal: true, trainingLocation: true },
      }),
      // Actual PlannedSession row count, not sessionsPerWeek * durationWeeks.
      // That formula assumes every week has exactly sessionsPerWeek sessions,
      // which doesn't always hold (e.g. Gym plans with dedicated recovery
      // days). Matches how /api/training and the session start route both
      // already compute totalSessions, so "current session N of totalSessions"
      // and isLastSession agree everywhere instead of drifting apart.
      prisma.plannedSession.count({ where: { planId: instance.planId } }),
    ]);

    if (!user) return notFound("User");

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
