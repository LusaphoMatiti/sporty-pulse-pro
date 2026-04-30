import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import type { SessionDraft } from "@/app/api/session/draft/route";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // ── Parallel fetch 1: instance + subscription + equipment + programs ──
  // All independent of each other — no reason to wait sequentially
  const [instance, subscription, userEquipmentRecords, allPrograms] =
    await Promise.all([
      prisma.planInstance.findFirst({
        where: { userId, status: InstanceStatus.ACTIVE },
        select: {
          id: true,
          level: true,
          planId: true,
          currentSession: true,
          sessionDraft: true,
          plan: {
            select: {
              id: true,
              name: true,
              muscleGroup: true,
            },
          },
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
      }),
      // Single query replacing 3 separate userEquipment queries
      prisma.userEquipment.findMany({
        where: { userId },
        select: {
          source: true,
          equipmentId: true,
          trialExpiresAt: true,
        },
      }),
      prisma.workoutPlan.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          tier: true,
          muscleGroup: true,
          durationWeeks: true,
          sessionsPerWeek: true,
          equipmentId: true,
          // Select only id+name instead of full equipment row
          equipment: { select: { id: true, name: true } },
        },
      }),
    ]);

  if (!instance)
    return NextResponse.json({ instanceId: null }, { status: 200 });

  // ── Planned session (depends on instance.planId) ──────────────────
  const plannedSession = await prisma.plannedSession.findUnique({
    where: {
      planId_sessionNumber: {
        planId: instance.planId,
        sessionNumber: instance.currentSession,
      },
    },
    select: {
      focus: true,
      plannedExercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          beginnerSets: true,
          beginnerReps: true,
          intermediateSets: true,
          intermediateReps: true,
          advancedSets: true,
          advancedReps: true,
          restSeconds: true,
          exercise: {
            select: {
              id: true,
              name: true,
              musclesWorked: true,
              equipment: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!plannedSession)
    return NextResponse.json({ error: "No planned session" }, { status: 404 });

  // ── Derive everything from the single userEquipment fetch ─────────
  const now = new Date();
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
    const declared = userEquipmentRecords.find(
      (r) =>
        r.source === "DECLARED" &&
        r.trialExpiresAt != null &&
        r.trialExpiresAt > now,
    );
    if (declared?.trialExpiresAt) {
      tier = "DECLARED_TRIAL";
      trialExpiresAt = declared.trialExpiresAt.toISOString();
    }
  }

  const boughtFromStore = userEquipmentRecords.some(
    (r) => r.source === "PURCHASED",
  );

  const activeEquipmentIds = userEquipmentRecords
    .filter(
      (r) =>
        r.source === "PURCHASED" ||
        (r.source === "DECLARED" &&
          r.trialExpiresAt != null &&
          r.trialExpiresAt > now),
    )
    .map((r) => r.equipmentId);

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

  const muscles = [
    ...new Set(exercisesForView.flatMap((e) => e.exercise.musclesWorked)),
  ];

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
    boughtFromStore,
    draft: (instance.sessionDraft as SessionDraft) ?? null,
    allPrograms,
    activeEquipmentIds,
  });
}
