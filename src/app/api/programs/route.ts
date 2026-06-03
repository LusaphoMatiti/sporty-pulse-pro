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

// Maps trainingLocation from User to the EnvironmentTarget values a plan can have
function resolveEnvironmentTargets(
  trainingLocation: string | null,
  hasDeclaredEquipment: boolean,
): EnvironmentTarget[] {
  if (trainingLocation === "GYM") {
    return [EnvironmentTarget.GYM, EnvironmentTarget.ANY];
  }
  if (trainingLocation === "HOME") {
    if (hasDeclaredEquipment) {
      // User has equipment at home — show bodyweight, equipment, and generic plans
      return [
        EnvironmentTarget.HOME_BODYWEIGHT,
        EnvironmentTarget.HOME_EQUIPMENT,
        EnvironmentTarget.ANY,
      ];
    }
    // Bodyweight-only home user
    return [EnvironmentTarget.HOME_BODYWEIGHT, EnvironmentTarget.ANY];
  }
  // No location set yet — return everything so the screen isn't blank
  return Object.values(EnvironmentTarget);
}

export async function GET(req: Request) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;

    // Fetch user profile alongside the other parallel queries
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

    // Build the plan where clause based on onboarding answers
    const planWhere: Prisma.WorkoutPlanWhereInput = {
      // Always filter by environment
      OR: [
        { environmentTarget: { in: allowedEnvironments } },
        { environmentTarget: null }, // plans with no target set are shown to everyone
      ],
    };

    // Filter by goal if set — include plans with no goalTarget too
    if (user?.primaryGoal) {
      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        {
          OR: [
            { goalTarget: user.primaryGoal as PrimaryGoal },
            { goalTarget: null },
          ],
        },
      ];
    }

    // Filter by experience level (stored as difficulty string on WorkoutPlan)
    // Lower levels also see plans designed for levels below them
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
            { difficulty: null }, // plans with no difficulty set shown to everyone
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
