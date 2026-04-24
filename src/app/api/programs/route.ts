import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { InstanceStatus } from "@/generated/prisma";

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // ── All plans ────────────────────────────────────────────────────
  const plans = await prisma.workoutPlan.findMany({
    include: { equipment: true },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });

  // ── Access context ───────────────────────────────────────────────
  const access = await getUserAccess({ userId });

  // ── Declared equipment name ──────────────────────────────────────
  const declaredEquipment = await prisma.userEquipment.findFirst({
    where: { userId, source: "DECLARED" },
    include: { equipment: true },
  });

  // ── Active + expired equipment IDs ───────────────────────────────
  const allUserEquipment = await prisma.userEquipment.findMany({
    where: { userId },
    select: { equipmentId: true, source: true, trialExpiresAt: true },
  });

  const activeEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "PURCHASED" ||
        (e.source === "DECLARED" &&
          e.trialExpiresAt &&
          e.trialExpiresAt > new Date()),
    )
    .map((e) => e.equipmentId);

  const expiredEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "DECLARED" &&
        e.trialExpiresAt &&
        e.trialExpiresAt <= new Date(),
    )
    .map((e) => e.equipmentId);

  // ── Active plan instance ─────────────────────────────────────────
  const activeInstance = await prisma.planInstance.findFirst({
    where: { userId, status: InstanceStatus.ACTIVE },
    select: { planId: true },
  });

  return NextResponse.json({
    plans,
    access: {
      isPro: access.isPro,
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
    declaredEquipmentName: declaredEquipment?.equipment.name ?? null,
  });
}
