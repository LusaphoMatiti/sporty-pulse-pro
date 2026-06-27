import { prisma } from "@/lib/prisma";
import { Plan } from "@/generated/prisma";

export type AccessContext = {
  userId: string;
};

// ── Caps ─────────────────────────────────────────────────────────────────
// BODYWEIGHT_PROGRAM_CAP: free-forever allowance, identical across every
//   non-Pro tier (free starter, equipment-trial, purchased-equipment).
// EQUIPMENT_TRIAL_PROGRAM_CAP: only meaningful for the declared-equipment
//   trial tier. Purchased-equipment users get unlimited concurrently-active
//   equipment programs (for the equipment they own); users with no equipment
//   access at all never see equipment plans in the first place (filtered out
//   server-side in /api/programs), so the cap is moot for them.

export const BODYWEIGHT_PROGRAM_CAP = 4;
export const EQUIPMENT_TRIAL_PROGRAM_CAP = 2;

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

  //  Active bodyweight program cap
  // Free, equipment-trial, and purchased-equipment users: only bodyweight
  // (equipmentId = null) instances count toward the cap of 4. Equipment
  // programs are capped separately below.
  const activeInstanceCount = await prisma.planInstance.count({
    where: {
      userId: ctx.userId,
      status: "ACTIVE",
      ...(isPro ? {} : { plan: { equipmentId: null } }),
    },
  });

  const programCap = isPro ? Infinity : BODYWEIGHT_PROGRAM_CAP;
  const canStartNewProgram = isPro || activeInstanceCount < programCap;

  //  Active equipment program cap
  // - Pro: unlimited.
  // - Purchased equipment: unlimited, for the equipment they own.
  // - Declared-equipment trial: capped at 2 concurrently active.
  // - No equipment access: cap is 0, but irrelevant — these plans never
  //   reach the client since /api/programs filters them out server-side.
  const equipmentActiveCount = await prisma.planInstance.count({
    where: {
      userId: ctx.userId,
      status: "ACTIVE",
      plan: { equipmentId: { not: null } },
    },
  });

  const equipmentCap = isPro
    ? Infinity
    : hasPurchasedEquipment
      ? Infinity
      : EQUIPMENT_TRIAL_PROGRAM_CAP;

  const canStartNewEquipmentProgram =
    isPro || equipmentActiveCount < equipmentCap;

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
    canStartNewProgram,
    activeInstanceCount,
    programCap,
    equipmentActiveCount,
    equipmentCap,
    canStartNewEquipmentProgram,
    declaredEquipmentIds,
    hasActiveTrial,
    trialExpiresAt,
    canAccessAICoach: isPro,
    canAccessAdvancedAnalytics: isPro,
    canAccessPersonalizedPrograms: isPro,
    canAccessVolumeHistory: isPro,
  };
}
