export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { InstanceStatus } from "@/generated/prisma";

function getFullImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;

  // If it's already a full URL (http:// or https://)
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  // If it's a Cloudinary path (starts with /v...)
  if (imageUrl.startsWith("/v") || imageUrl.includes("cloudinary")) {
    // Ensure we have the full Cloudinary base URL
    const CLOUDINARY_BASE = "https://res.cloudinary.com/dsoxsrjn2/image/upload";
    if (imageUrl.startsWith("/v")) {
      return `${CLOUDINARY_BASE}${imageUrl}`;
    }
    return imageUrl;
  }

  // For local paths, construct full URL from API base
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
  return `${API_BASE}${imageUrl}`;
}

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          select: {
            plannedExercises: {
              select: { id: true },
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

    prisma.user.findUnique({
      where: { id: userId },
      select: { identity: true },
    }),
  ]);

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

  const plansWithCount = plans.map((p) => {
    const exerciseCount = p.plannedSessions.reduce(
      (sum, s) => sum + s.plannedExercises.length,
      0,
    );
    const { plannedSessions: _, ...rest } = p;
    return {
      ...rest,
      imageUrl: getFullImageUrl(rest.imageUrl),
      exerciseCount,
      requiresEquipment: !!p.equipmentId,
    };
  });

  return NextResponse.json({
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
}
