/**
 * GET /api/training
 *
 * Returns TrainingData for the Expo mobile app.
 * Add this file to your Next.js project at:
 *   src/app/api/training/route.ts
 *
 * Extracts the exact same data logic from src/app/training/page.tsx
 * and exposes it as a JSON endpoint.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import type { SessionDraft } from "@/app/api/session/draft/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // ── Active plan instance ──────────────────────────────────────────
  const instance = await prisma.planInstance.findFirst({
    where: { userId, status: InstanceStatus.ACTIVE },
    include: { plan: true },
  });
  if (!instance)
    return NextResponse.json({ error: "No active plan" }, { status: 404 });

  // ── Planned session ───────────────────────────────────────────────
  const plannedSession = await prisma.plannedSession.findUnique({
    where: {
      planId_sessionNumber: {
        planId: instance.planId,
        sessionNumber: instance.currentSession,
      },
    },
    include: {
      plannedExercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: { include: { equipment: true } },
        },
      },
    },
  });
  if (!plannedSession)
    return NextResponse.json({ error: "No planned session" }, { status: 404 });

  // ── Level-appropriate sets/reps ───────────────────────────────────
  const levelKey = instance.level;
  const exercisesForView = plannedSession.plannedExercises.map((pe) => ({
    id: pe.id,
    order: pe.order,
    sets:
      levelKey === "BEGINNER"
        ? pe.beginnerSets
        : levelKey === "INTERMEDIATE"
          ? pe.intermediateSets
          : pe.advancedSets,
    reps:
      levelKey === "BEGINNER"
        ? pe.beginnerReps
        : levelKey === "INTERMEDIATE"
          ? pe.intermediateReps
          : pe.advancedReps,
    restSeconds: pe.restSeconds,
    exercise: pe.exercise,
  }));

  // ── Muscles ───────────────────────────────────────────────────────
  const muscles = [
    ...new Set(exercisesForView.flatMap((e) => e.exercise.musclesWorked)),
  ];

  // ── Tier ──────────────────────────────────────────────────────────
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  const activePlan =
    subscription?.status === "active" ? subscription.plan : null;

  type TrainingTier = "FREE" | "DECLARED_TRIAL" | "PURCHASED" | "PRO";
  let tier: TrainingTier = "FREE";
  let trialExpiresAt: string | null = null;

  if (activePlan === "PRO") {
    tier = "PRO";
  } else if (activePlan === "EQUIPMENT") {
    tier = "PURCHASED";
  } else {
    const declared = await prisma.userEquipment.findFirst({
      where: { userId, source: "DECLARED", trialExpiresAt: { gt: new Date() } },
      select: { trialExpiresAt: true },
    });
    if (declared?.trialExpiresAt) {
      tier = "DECLARED_TRIAL";
      trialExpiresAt = declared.trialExpiresAt.toISOString();
    }
  }

  // ── boughtFromStore ───────────────────────────────────────────────
  const purchasedEquipment = await prisma.userEquipment.findFirst({
    where: { userId, source: "PURCHASED" },
    select: { id: true },
  });

  // ── Active equipment IDs ──────────────────────────────────────────
  const activeEquipmentRecords = await prisma.userEquipment.findMany({
    where: {
      userId,
      OR: [
        { source: "PURCHASED" },
        { source: "DECLARED", trialExpiresAt: { gt: new Date() } },
      ],
    },
    select: { equipmentId: true },
  });
  const activeEquipmentIds = activeEquipmentRecords.map((r) => r.equipmentId);

  // ── All programs ──────────────────────────────────────────────────
  const allPrograms = await prisma.workoutPlan.findMany({
    include: { equipment: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    instanceId: instance.id,
    planId: instance.planId,
    planName: instance.plan.name,
    muscleGroup: instance.plan.muscleGroup,
    level: instance.level,
    currentSession: instance.currentSession,
    focus: plannedSession.focus,
    exercisesForView,
    muscles,
    tier,
    trialExpiresAt,
    boughtFromStore: purchasedEquipment != null,
    draft: (instance.sessionDraft as SessionDraft) ?? null,
    allPrograms: allPrograms.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      tier: p.tier,
      muscleGroup: p.muscleGroup,
      durationWeeks: p.durationWeeks,
      sessionsPerWeek: p.sessionsPerWeek,
      equipmentId: p.equipmentId,
      equipment: p.equipment
        ? { id: p.equipment.id, name: p.equipment.name }
        : null,
    })),
    activeEquipmentIds,
  });
}
