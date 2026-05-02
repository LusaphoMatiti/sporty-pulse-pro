// src/app/api/programs/route.ts

export const dynamic = "force-dynamic";

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

  const [plans, allUserEquipment, activeInstance] = await Promise.all([
    prisma.workoutPlan.findMany({
      select: {
        id: true,
        name: true,
        tier: true,
        equipmentId: true,
        description: true,
        muscleGroup: true,
        durationWeeks: true,
        sessionsPerWeek: true,
        difficulty: true,
        equipment: {
          select: { id: true, name: true },
        },
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
  ]);

  // ← debug log goes HERE, after Promise.all resolves
  console.log(
    "[programs] trialExpiresAt from DB:",
    allUserEquipment.map((e) => ({
      equipmentId: e.equipmentId,
      source: e.source,
      trialExpiresAt: e.trialExpiresAt,
    })),
  );

  const declaredEntry = allUserEquipment.find((e) => e.source === "DECLARED");
  const declaredEquipmentName = declaredEntry?.equipment?.name ?? null;

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
  });
}
