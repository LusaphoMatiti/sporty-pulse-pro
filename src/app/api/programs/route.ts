import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import {
  InstanceStatus,
  EnvironmentTarget,
  PrimaryGoal,
  Prisma,
} from "@/generated/prisma";
import { buildCloudinaryUrl } from "@/lib/cloudinary";
import { apiSuccess, unauthorized, internalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// ─── Environment resolution ───────────────────────────────────────────────────
// Maps trainingLocation from User to the EnvironmentTarget values a plan can have.
// EnvironmentTarget.ANY is always included — plans tagged ANY are shown to everyone.

function resolveEnvironmentTargets(
  trainingLocation: string | null,
  hasDeclaredEquipment: boolean,
): EnvironmentTarget[] {
  if (trainingLocation === "GYM") {
    return [EnvironmentTarget.GYM, EnvironmentTarget.ANY];
  }
  if (trainingLocation === "HOME") {
    if (hasDeclaredEquipment) {
      return [
        EnvironmentTarget.HOME_BODYWEIGHT,
        EnvironmentTarget.HOME_EQUIPMENT,
        EnvironmentTarget.ANY,
      ];
    }
    return [EnvironmentTarget.HOME_BODYWEIGHT, EnvironmentTarget.ANY];
  }
  // No location set yet — return everything so the screen isn't blank
  return Object.values(EnvironmentTarget);
}

// ─── Goal resolution ──────────────────────────────────────────────────────────
// Returns the ordered list of goalTarget values to match against.
// LOSE_WEIGHT falls back to GET_FIT because the lose_weight seed data is
// being completed incrementally (currently only Home/Beginner exists).
// When the remaining 4 skeletons are added and re-seeded, LOSE_WEIGHT plans
// for those environments will start appearing automatically — no code change needed.
// GET_FIT stays in the list as a secondary fallback so users always see something.

function resolveGoalTargets(primaryGoal: string): PrimaryGoal[] {
  switch (primaryGoal as PrimaryGoal) {
    case PrimaryGoal.LOSE_WEIGHT:
      // Primary: LOSE_WEIGHT. Secondary fallback: GET_FIT (closest match).
      // As LOSE_WEIGHT plans are seeded for each environment + level, they will
      // naturally rank above GET_FIT plans once the DB has them.
      return [PrimaryGoal.LOSE_WEIGHT, PrimaryGoal.GET_FIT];
    case PrimaryGoal.BUILD_MUSCLE:
      return [PrimaryGoal.BUILD_MUSCLE];
    case PrimaryGoal.GET_FIT:
      return [PrimaryGoal.GET_FIT];
    default:
      return [primaryGoal as PrimaryGoal];
  }
}

// ─── GET /api/programs ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;

    const [allUserEquipment, activeInstance, user] = await Promise.all([
      prisma.userEquipment.findMany({
        where: { userId },
        select: {
          equipmentId: true,
          source: true,
          trialExpiresAt: true,
          equipment: { select: { name: true } },
        },
      }),
      prisma.planInstance.findFirst({
        where: { userId, status: InstanceStatus.ACTIVE },
        select: { planId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          identity: true,
          trainingLocation: true,
          primaryGoal: true,
          experienceLevel: true,
          biologicalSex: true,
        },
      }),
    ]);

    const hasDeclaredEquipment = allUserEquipment.some(
      (e) => e.source === "DECLARED",
    );

    const allowedEnvironments = resolveEnvironmentTargets(
      user?.trainingLocation ?? null,
      hasDeclaredEquipment,
    );

    // ── Build plan filter ─────────────────────────────────────────────────────
    //
    // Environment: strict match against allowedEnvironments.
    // EnvironmentTarget.ANY is already included in allowedEnvironments by
    // resolveEnvironmentTargets, so no separate null escape is needed.
    // Plans with environmentTarget: null are treated as universal fallbacks.
    //
    // Goal: primary goal first, with a GET_FIT fallback for LOSE_WEIGHT users
    // until the full lose_weight dataset is seeded. Plans with goalTarget: null
    // are shown to everyone regardless of goal.
    //
    // Level: cumulative — INTERMEDIATE users see BEGINNER + INTERMEDIATE plans.
    // Plans with difficulty: null are shown to everyone.

    const planWhere: Prisma.WorkoutPlanWhereInput = {
      // Strict environment match — no null escape so plans without a tag
      // only appear if explicitly set to null (universal) in the DB.
      OR: [
        { environmentTarget: { in: allowedEnvironments } },
        { environmentTarget: null },
      ],
    };

    // Goal filter
    if (user?.primaryGoal) {
      const goalTargets = resolveGoalTargets(user.primaryGoal);

      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        {
          OR: [{ goalTarget: { in: goalTargets } }, { goalTarget: null }],
        },
      ];
    }

    // Level filter (cumulative hierarchy)
    if (user?.experienceLevel) {
      const levelHierarchy: Record<string, string[]> = {
        BEGINNER: ["BEGINNER"],
        INTERMEDIATE: ["BEGINNER", "INTERMEDIATE"],
        ADVANCED: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      };
      const allowedDifficulties = levelHierarchy[user.experienceLevel] ?? [];

      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        {
          OR: [
            { difficulty: { in: allowedDifficulties } },
            { difficulty: null },
          ],
        },
      ];
    }

    const plans = await prisma.workoutPlan.findMany({
      where: planWhere,
      select: {
        id: true,
        name: true,
        tier: true,
        imageUrl: true,
        sessionDurationMin: true,
        plannedSessions: {
          orderBy: { sessionNumber: "asc" },
          select: {
            plannedExercises: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                exercise: { select: { thumbnailUrl: true } },
              },
            },
          },
        },
        equipmentId: true,
        description: true,
        muscleGroup: true,
        durationWeeks: true,
        sessionsPerWeek: true,
        difficulty: true,
        identityTarget: true,
        goalTarget: true,
        environmentTarget: true,
        equipment: { select: { id: true, name: true } },
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    const declaredEntry = allUserEquipment.find((e) => e.source === "DECLARED");
    const declaredEquipmentName = declaredEntry?.equipment?.name ?? null;

    const access = await getUserAccess({ userId });
    const now = new Date();

    const activeEquipmentIds = allUserEquipment
      .filter(
        (e) =>
          e.source === "PURCHASED" ||
          (e.source === "DECLARED" &&
            e.trialExpiresAt &&
            e.trialExpiresAt > now),
      )
      .map((e) => e.equipmentId);

    const expiredEquipmentIds = allUserEquipment
      .filter(
        (e) =>
          e.source === "DECLARED" &&
          e.trialExpiresAt &&
          e.trialExpiresAt <= now,
      )
      .map((e) => e.equipmentId);

    const plansWithCount = plans.map((p) => {
      const exerciseCount = p.plannedSessions.reduce(
        (sum, s) => sum + s.plannedExercises.length,
        0,
      );
      const firstExerciseThumb =
        p.plannedSessions[0]?.plannedExercises[0]?.exercise?.thumbnailUrl ??
        null;
      const resolvedImageUrl =
        buildCloudinaryUrl(p.imageUrl, "card") ??
        buildCloudinaryUrl(firstExerciseThumb, "card");

      const { plannedSessions: _, ...rest } = p;
      return {
        ...rest,
        imageUrl: resolvedImageUrl,
        exerciseCount,
        requiresEquipment: !!p.equipmentId,
      };
    });

    return apiSuccess({
      plans: plansWithCount,
      access: {
        isPro: access.isPro,
        isEquipment: access.isEquipment,
        hasActiveTrial: access.hasActiveTrial,
        trialExpiresAt: access.trialExpiresAt?.toISOString() ?? null,
        canStartNewProgram: access.canStartNewProgram,
        activeInstanceCount: access.activeInstanceCount,
        programCap: access.isPro ? null : access.programCap,
        declaredEquipmentIds: access.declaredEquipmentIds,
        activeEquipmentIds,
        expiredEquipmentIds,
        activePlanId: activeInstance?.planId ?? null,
      },
      declaredEquipmentName,
      userIdentity: user?.identity ?? null,
    });
  } catch (err) {
    console.error("[programs/GET] error:", err);
    return internalError(err);
  }
}
