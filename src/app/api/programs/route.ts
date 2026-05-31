import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { InstanceStatus } from "@/generated/prisma";
import { buildCloudinaryUrl } from "@/lib/cloudinary";
import { apiSuccess, unauthorized, internalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;

    const [plans, allUserEquipment, activeInstance, user] = await Promise.all([
      prisma.workoutPlan.findMany({
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
          equipment: { select: { id: true, name: true } },
        },
        orderBy: [{ tier: "asc" }, { name: "asc" }],
      }),
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
        select: { identity: true },
      }),
    ]);

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
