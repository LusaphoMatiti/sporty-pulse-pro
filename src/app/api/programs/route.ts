import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import {
  getEligiblePlansContext,
  computePlanLocks,
  sortPlansForCatalog,
  buildWeeklySchedule,
} from "@/lib/programaccess";
import { InstanceStatus } from "@/generated/prisma";
import { buildCloudinaryUrl } from "@/lib/cloudinary";
import { apiSuccess, unauthorized, internalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// ─── GET /api/programs ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;
    //
    const [
      { planWhere, allUserEquipment, user, accessibleEquipmentIds, now },
      activeInstance,
      access,
    ] = await Promise.all([
      getEligiblePlansContext(userId),
      // Only one instance is ever ACTIVE at a time (see lib/resolver.ts) —
      // findFirst is correct here, not findMany.
      prisma.planInstance.findFirst({
        where: { userId, status: InstanceStatus.ACTIVE },
        select: { planId: true, level: true },
      }),
      getUserAccess({ userId }),
    ]);

    const plansUnsorted = await prisma.workoutPlan.findMany({
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
    });

    // Catalog order: equipment-tied plans first, bodyweight after — see
    // sortPlansForCatalog in lib/programaccess.ts. This MUST match the
    // order resolver.ts uses, since computePlanLocks's cap-counting is
    // position-dependent.

    const declaredEntry = allUserEquipment.find((e) => e.source === "DECLARED");
    const declaredEquipmentName = declaredEntry?.equipment?.name ?? null;

    const expiredEquipmentIds = allUserEquipment
      .filter(
        (e) =>
          e.source === "DECLARED" &&
          e.trialExpiresAt &&
          e.trialExpiresAt <= now,
      )
      .map((e) => e.equipmentId);

    const plans = sortPlansForCatalog(plansUnsorted);

    // Lock status is computed purely from fixed catalog position (first 4
    // bodyweight / first 2 trial-equipment plans, in the order above) — NOT
    // from activation history. See lib/programAccess.ts.
    const lockMap = computePlanLocks(plans, {
      isPro: access.isPro,
      allUserEquipment,
      now,
      gymTrialExpiresAt: access.gymTrialExpiresAt,
    });

    const activePlanLock = activeInstance?.planId
      ? lockMap.get(activeInstance.planId)
      : null;
    const weeklyScheduleLocked = !!activePlanLock?.locked;

    let weeklySchedule = null;
    if (
      user?.trainingLocation === "GYM" &&
      activeInstance?.planId &&
      !weeklyScheduleLocked
    ) {
      const activePlanSessions = await prisma.plannedSession.findMany({
        where: { planId: activeInstance.planId },
        select: {
          sessionNumber: true,
          focus: true,
          estimatedMinutes: true,
          plannedExercises: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              exercise: { select: { name: true } },
              beginnerSets: true,
              beginnerReps: true,
              intermediateSets: true,
              intermediateReps: true,
              advancedSets: true,
              advancedReps: true,
            },
          },
        },
      });
      weeklySchedule = buildWeeklySchedule(
        activePlanSessions,
        activeInstance.level,
      );
    }

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
      const lock = lockMap.get(p.id) ?? {
        locked: true,
        lockReason: "upgrade_required" as const,
      };

      return {
        ...rest,
        imageUrl: resolvedImageUrl,
        exerciseCount,
        requiresEquipment: !!p.equipmentId,
        locked: lock.locked,
        lockReason: lock.lockReason,
      };
    });

    return apiSuccess({
      plans: plansWithCount,
      access: {
        isPro: access.isPro,
        isEquipment: access.isEquipment,
        hasActiveTrial: access.hasActiveTrial,
        trialExpiresAt: access.trialExpiresAt?.toISOString() ?? null,
        gymTrialExpiresAt: access.gymTrialExpiresAt,
        declaredEquipmentIds: access.declaredEquipmentIds,
        activeEquipmentIds: accessibleEquipmentIds,
        expiredEquipmentIds,
        activePlanId: activeInstance?.planId ?? null,
      },
      declaredEquipmentName,
      userIdentity: user?.identity ?? null,
      trainingLocation: user?.trainingLocation ?? null,
      weeklySchedule,
    });
  } catch (err) {
    console.error("[programs/GET] error:", err);
    return internalError(err);
  }
}
