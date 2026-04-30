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

  // ── Parallel fetch — 3 queries instead of 4, run concurrently ───
  const [plans, allUserEquipment, activeInstance] = await Promise.all([
    prisma.workoutPlan.findMany({
      select: {
        id: true,
        name: true,
        tier: true,
        equipmentId: true,

        equipment: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    }),

    // Collapsed: was findFirst + findMany — now one query
    prisma.userEquipment.findMany({
      where: { userId },
      select: {
        equipmentId: true,
        source: true,
        trialExpiresAt: true,
        equipment: { select: { name: true } }, // for declaredEquipmentName
      },
    }),

    prisma.planInstance.findFirst({
      where: { userId, status: InstanceStatus.ACTIVE },
      select: { planId: true },
    }),
  ]);

  // ── Derive declared equipment name in JS (no extra DB round-trip) ─
  const declaredEntry = allUserEquipment.find((e) => e.source === "DECLARED");
  const declaredEquipmentName = declaredEntry?.equipment?.name ?? null;

  // ── Access context ────────────────────────────────────────────────
  const access = await getUserAccess({ userId });

  const now = new Date();

  const activeEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "PURCHASED" ||
        (e.source === "DECLARED" && e.trialExpiresAt && e.trialExpiresAt > now),
    )
    .map((e) => e.equipmentId);

  const expiredEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "DECLARED" && e.trialExpiresAt && e.trialExpiresAt <= now,
    )
    .map((e) => e.equipmentId);

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
    declaredEquipmentName,
  });
}
