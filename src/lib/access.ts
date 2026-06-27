import { prisma } from "@/lib/prisma";
import { Plan } from "@/generated/prisma";

export type AccessContext = {
  userId: string;
};

export async function getUserAccess(ctx: AccessContext) {
  const now = new Date();

  //  Subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: ctx.userId },
    select: { plan: true },
  });

  const isPro = subscription?.plan === Plan.PRO;
  const isEquipment = subscription?.plan === Plan.EQUIPMENT;

  // Equipment ownership
  const userEquipment = await prisma.userEquipment.findMany({
    where: { userId: ctx.userId },
    select: {
      equipmentId: true,
      source: true,
      trialExpiresAt: true,
    },
  });

  const declaredEquipmentIds = userEquipment
    .filter((e) => e.source === "DECLARED")
    .map((e) => e.equipmentId);

  const activeEquipmentIds = new Set(
    userEquipment
      .filter(
        (e) =>
          e.source === "PURCHASED" ||
          (e.source === "DECLARED" &&
            e.trialExpiresAt &&
            e.trialExpiresAt > now),
      )
      .map((e) => e.equipmentId),
  );

  const hasAnyActiveEquipment = activeEquipmentIds.size > 0;
  const hasPurchasedEquipment = userEquipment.some(
    (e) => e.source === "PURCHASED",
  );

  //  Per-equipment access
  const canAccessEquipmentProgram = (equipmentId: string) => {
    if (isPro) return true;
    return activeEquipmentIds.has(equipmentId);
  };

  //  Trial state (for declared users)
  const declaredEntries = userEquipment.filter((e) => e.source === "DECLARED");
  const hasActiveTrial = declaredEntries.some(
    (e) => e.trialExpiresAt && e.trialExpiresAt > now,
  );

  // earliest expiry — explicit date sort, not lexicographic
  const trialExpiresAt =
    declaredEntries
      .map((e) => e.trialExpiresAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    isPro,
    isEquipment,
    hasAnyActiveEquipment,
    hasPurchasedEquipment,
    canAccessEquipmentProgram,
    activeEquipmentIds: Array.from(activeEquipmentIds),
    declaredEquipmentIds,
    hasActiveTrial,
    trialExpiresAt,
    canAccessAICoach: isPro,
    canAccessAdvancedAnalytics: isPro,
    canAccessPersonalizedPrograms: isPro,
    canAccessVolumeHistory: isPro,
  };
}
