import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import {
  InstanceStatus,
  EnvironmentTarget,
  PrimaryGoal,
  SexTarget,
  Prisma,
} from "@/generated/prisma";
import { buildCloudinaryUrl } from "@/lib/cloudinary";
import { apiSuccess, unauthorized, internalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// ─── Environment resolution ────────────────────────────────────────────────
// Maps trainingLocation from User to the EnvironmentTarget values a plan can
// have. EnvironmentTarget.ANY is always included.

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

// ─── Goal resolution ───────────────────────────────────────────────────────
// LOSE_WEIGHT falls back to GET_FIT while seed data is being completed.
// As LOSE_WEIGHT plans are seeded for each environment + level, they will
// naturally rank above GET_FIT plans once the DB has them.

function resolveGoalTargets(primaryGoal: string): PrimaryGoal[] {
  switch (primaryGoal as PrimaryGoal) {
    case PrimaryGoal.LOSE_WEIGHT:
      return [PrimaryGoal.LOSE_WEIGHT, PrimaryGoal.GET_FIT];
    case PrimaryGoal.BUILD_MUSCLE:
      return [PrimaryGoal.BUILD_MUSCLE];
    case PrimaryGoal.GET_FIT:
      return [PrimaryGoal.GET_FIT];
    default:
      return [primaryGoal as PrimaryGoal];
  }
}

// ─── Sex target resolution ─────────────────────────────────────────────────
// Returns the BiologicalSex values that should be shown to a given user.
// null sexTarget on a plan = shown to everyone regardless of user's sex.
// A plan tagged MALE/FEMALE is only shown to users with that declared sex.
// NOT_SPECIFIED users see all plans (null sexTarget only), since we can't
// make a good guess. Plans with sexTarget null are always included.

function resolveSexTargets(biologicalSex: string | null): SexTarget[] | null {
  if (!biologicalSex || biologicalSex === "NOT_SPECIFIED") return null;
  if (biologicalSex === "MALE") return [SexTarget.MALE];
  if (biologicalSex === "FEMALE") return [SexTarget.FEMALE];
  return null;
}

// ─── GET /api/programs ─────────────────────────────────────────────────────

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

    // ── Build plan filter ──────────────────────────────────────────────────
    //
    // Environment: strict match against allowedEnvironments.
    //   EnvironmentTarget.ANY is already in allowedEnvironments.
    //   Plans with environmentTarget null are universal fallbacks.
    //
    // Goal: primary goal first, with a GET_FIT fallback for LOSE_WEIGHT users.
    //   Plans with goalTarget null are shown to everyone.
    //
    // Level: cumulative — INTERMEDIATE users see BEGINNER + INTERMEDIATE plans.
    //   Plans with difficulty null are shown to everyone.
    //
    // Sex: MALE users see plans tagged MALE or null.
    //      FEMALE users see plans tagged FEMALE or null.
    //      NOT_SPECIFIED users see only null (unisex) plans.
    //      No sex declared = no sex filter applied (show everything).

    const planWhere: Prisma.WorkoutPlanWhereInput = {
      OR: [
        { environmentTarget: { in: allowedEnvironments } },
        { environmentTarget: null },
      ],
    };

    // ── Goal filter ────────────────────────────────────────────────────────
    if (user?.primaryGoal) {
      const goalTargets = resolveGoalTargets(user.primaryGoal);
      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        {
          OR: [{ goalTarget: { in: goalTargets } }, { goalTarget: null }],
        },
      ];
    }

    // ── Level filter (cumulative hierarchy) ────────────────────────────────
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

    // ── Sex filter ─────────────────────────────────────────────────────────
    // Only applied when the user has declared a specific biological sex.
    // - MALE user   → plans where sexTarget is MALE or null
    // - FEMALE user → plans where sexTarget is FEMALE or null
    // - NOT_SPECIFIED / no sex declared → only plans where sexTarget is null
    //   (we can't make a good recommendation without knowing their sex)
    // Sex filter
    if (user?.biologicalSex) {
      const sexTargets = resolveSexTargets(user.biologicalSex);
      if (sexTargets !== null) {
        planWhere.AND = [
          ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
          {
            OR: [{ sexTarget: { in: sexTargets } }, { sexTarget: null }],
          },
        ];
      } else if (user.biologicalSex === "NOT_SPECIFIED") {
        planWhere.AND = [
          ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
          { sexTarget: null },
        ];
      }
    }

    const plans = await prisma.workoutPlan.findMany({
      where: planWhere,
      select: {
        id: true,
        name: true,
        tier: true,
        imageUrl: true,
        sessionDurationMin: true,
        collection: true,
        sexTarget: true,
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
