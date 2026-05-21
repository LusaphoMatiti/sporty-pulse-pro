// src/app/api/training/programs/route.ts
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchTemplate, TEMPLATE_LABELS } from "@/lib/templateMatcher";
import { resolveExercises, getUserEquipmentIds } from "@/lib/substitution";
import { IDENTITY_LABELS, IDENTITY_DESCRIPTIONS } from "@/lib/identity";
import {
  Identity,
  TrainingLocation,
  UserLevel,
  EnvironmentTarget,
  Plan,
  EquipmentSource,
  PlanTier,
} from "@/generated/prisma";
import type { PlannedExerciseWithRelations } from "@/lib/substitution";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Free users may only have 1 active program at a time. */
const FREE_PROGRAM_CAP = 1;

// ─── Access resolver ──────────────────────────────────────────────────────────

interface AccessContext {
  isPro: boolean;
  isEquipment: boolean;
  hasActiveTrial: boolean;
  trialExpiresAt: string | null;
  canStartNewProgram: boolean;
  activeInstanceCount: number;
  programCap: number | null;
  activeEquipmentIds: string[];
  expiredEquipmentIds: string[];
  activePlanId: string | null;
  declaredEquipmentIds: string[];
}

async function resolveAccess(userId: string): Promise<AccessContext> {
  const now = new Date();

  const [subscription, userEquipmentRecords, activeInstances] =
    await Promise.all([
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
      }),
      prisma.userEquipment.findMany({
        where: { userId },
        select: { source: true, equipmentId: true, trialExpiresAt: true },
      }),
      prisma.planInstance.findMany({
        where: { userId, status: "ACTIVE" },
        select: { id: true, planId: true },
      }),
    ]);

  const activePlan =
    subscription?.status === "active" ? subscription.plan : null;

  const isPro = activePlan === Plan.PRO;
  const isEquipment = activePlan === Plan.EQUIPMENT;

  // Declared trial — find the most recently expiring active one
  const activeDeclared = userEquipmentRecords
    .filter(
      (r) =>
        r.source === EquipmentSource.DECLARED &&
        r.trialExpiresAt != null &&
        r.trialExpiresAt > now,
    )
    .sort(
      (a, b) =>
        (b.trialExpiresAt?.getTime() ?? 0) - (a.trialExpiresAt?.getTime() ?? 0),
    );

  const hasActiveTrial = activeDeclared.length > 0;
  const trialExpiresAt =
    activeDeclared[0]?.trialExpiresAt?.toISOString() ?? null;

  // Equipment IDs currently active (purchased or in-trial declared)
  const activeEquipmentIds = userEquipmentRecords
    .filter(
      (r) =>
        r.source === EquipmentSource.PURCHASED ||
        (r.source === EquipmentSource.DECLARED &&
          r.trialExpiresAt != null &&
          r.trialExpiresAt > now),
    )
    .map((r) => r.equipmentId);

  // Equipment IDs whose trial has expired
  const expiredEquipmentIds = userEquipmentRecords
    .filter(
      (r) =>
        r.source === EquipmentSource.DECLARED &&
        r.trialExpiresAt != null &&
        r.trialExpiresAt <= now,
    )
    .map((r) => r.equipmentId);

  const declaredEquipmentIds = userEquipmentRecords
    .filter((r) => r.source === EquipmentSource.DECLARED)
    .map((r) => r.equipmentId);

  const canUnlimitedPrograms = isPro || isEquipment;
  const programCap = canUnlimitedPrograms ? null : FREE_PROGRAM_CAP;
  const activeInstanceCount = activeInstances.length;
  const canStartNewProgram =
    canUnlimitedPrograms || activeInstanceCount < FREE_PROGRAM_CAP;

  const activePlanId = activeInstances[0]?.planId ?? null;

  return {
    isPro,
    isEquipment,
    hasActiveTrial,
    trialExpiresAt,
    canStartNewProgram,
    activeInstanceCount,
    programCap,
    activeEquipmentIds,
    expiredEquipmentIds,
    activePlanId,
    declaredEquipmentIds,
  };
}

// ─── Plan filter ──────────────────────────────────────────────────────────────

/**
 * Server-side plan filter — runs before the payload leaves the API.
 *
 * LOCATION (EnvironmentTarget):
 *   HOME_BODYWEIGHT → shown to HOME users only (bodyweight-only plan, always free)
 *   HOME_EQUIPMENT  → shown to HOME users only (requires equipment)
 *   GYM             → shown to GYM users only
 *   ANY / null      → shown to everyone
 *
 * LEVEL (difficulty vs experienceLevel):
 *   Plan difficulty is stored as a free-form string that mirrors UserLevel values.
 *   - BEGINNER users  → see BEGINNER plans only (+ null difficulty)
 *   - INTERMEDIATE    → see BEGINNER + INTERMEDIATE (+ null)
 *   - ADVANCED        → see everything
 *   - null user level → see everything (identity not yet assigned)
 *
 * BODYWEIGHT plans (equipmentId = null, environmentTarget = HOME_BODYWEIGHT or ANY):
 *   Always shown — never locked regardless of tier.
 */
function planMatchesUser(
  plan: {
    environmentTarget: EnvironmentTarget | null;
    difficulty: string | null;
    equipmentId: string | null;
  },
  user: {
    trainingLocation: TrainingLocation | null;
    experienceLevel: UserLevel | null;
  },
): boolean {
  // ── Location filter ──────────────────────────────────────────────────────
  const env = plan.environmentTarget;
  const loc = user.trainingLocation;

  if (env !== null && env !== EnvironmentTarget.ANY) {
    if (
      (env === EnvironmentTarget.HOME_BODYWEIGHT ||
        env === EnvironmentTarget.HOME_EQUIPMENT) &&
      loc !== TrainingLocation.HOME
    ) {
      return false;
    }
    if (env === EnvironmentTarget.GYM && loc !== TrainingLocation.GYM) {
      return false;
    }
  }

  // ── Level filter ─────────────────────────────────────────────────────────
  // Only filter when both user level and plan difficulty are present
  const userLevel = user.experienceLevel;
  const planDifficulty = plan.difficulty?.toUpperCase();

  if (userLevel && planDifficulty) {
    if (userLevel === UserLevel.BEGINNER && planDifficulty !== "BEGINNER") {
      return false;
    }
    if (userLevel === UserLevel.INTERMEDIATE && planDifficulty === "ADVANCED") {
      return false;
    }
    // ADVANCED sees everything
  }

  return true;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      identity: true,
      primaryGoal: true,
      trainingLocation: true,
      experienceLevel: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const access = await resolveAccess(userId);

  // Declared equipment name for the trial banner
  let declaredEquipmentName: string | null = null;
  if (access.declaredEquipmentIds.length > 0) {
    const eq = await prisma.equipment.findFirst({
      where: { id: { in: access.declaredEquipmentIds } },
      select: { name: true },
    });
    declaredEquipmentName = eq?.name ?? null;
  }

  // ── No identity yet — return all plans with real access context ───────────
  if (!user.identity) {
    const allPrograms = await prisma.workoutPlan.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        muscleGroup: true,
        durationWeeks: true,
        sessionsPerWeek: true,
        difficulty: true,
        tier: true,
        imageUrl: true,
        sessionDurationMin: true,
        identityTarget: true,
        goalTarget: true,
        environmentTarget: true,
        equipmentId: true,
      },
    });

    const plans = allPrograms.map((p) => ({
      ...p,
      // A plan requires equipment when it has a direct equipmentId link
      requiresEquipment: p.equipmentId !== null,
    }));

    return NextResponse.json(
      { plans, access, declaredEquipmentName, userIdentity: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Identity assigned — full filtered + resolved response ─────────────────
  const userEquipmentIds = await getUserEquipmentIds(userId);
  const hasEquipment = userEquipmentIds.length > 0;

  const templateMatch = matchTemplate({
    identity: user.identity,
    goal: user.primaryGoal,
    trainingLocation: user.trainingLocation,
    hasEquipment,
  });

  const programs = await prisma.workoutPlan.findMany({
    include: {
      plannedSessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          plannedExercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: {
                include: {
                  equipment: { include: { equipment: true } },
                  substitutions: {
                    include: {
                      substituteExercise: {
                        include: {
                          equipment: { include: { equipment: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      instances: {
        where: { userId, status: "ACTIVE" },
        select: { id: true, currentSession: true, progressionWeek: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const resolvedPrograms = programs
    .filter((program) =>
      planMatchesUser(
        {
          environmentTarget: program.environmentTarget,
          difficulty: program.difficulty,
          equipmentId: program.equipmentId,
        },
        {
          trainingLocation: user.trainingLocation,
          experienceLevel: user.experienceLevel,
        },
      ),
    )
    .map((program) => {
      const resolvedSessions = program.plannedSessions.map((ps) => ({
        id: ps.id,
        sessionNumber: ps.sessionNumber,
        focus: ps.focus,
        estimatedMinutes: ps.estimatedMinutes,
        exercises: resolveExercises(
          ps.plannedExercises as PlannedExerciseWithRelations[],
          userEquipmentIds,
        ),
      }));

      const activeInstance = program.instances[0] ?? null;

      return {
        id: program.id,
        name: program.name,
        description: program.description,
        muscleGroup: program.muscleGroup,
        durationWeeks: program.durationWeeks,
        sessionsPerWeek: program.sessionsPerWeek,
        difficulty: program.difficulty,
        tier: program.tier,
        imageUrl: program.imageUrl,
        sessionDurationMin: program.sessionDurationMin,
        templateType: program.templateType,
        identityTarget: program.identityTarget,
        goalTarget: program.goalTarget,
        environmentTarget: program.environmentTarget,
        impactLevel: program.impactLevel,
        // True when plan has a direct equipment link — drives lock logic on client
        requiresEquipment: program.equipmentId !== null,
        sessions: resolvedSessions,
        activeInstance,
      };
    });

  return NextResponse.json(
    {
      plans: resolvedPrograms,
      access,
      declaredEquipmentName,
      userIdentity: user.identity,
      identity: {
        value: user.identity,
        label: IDENTITY_LABELS[user.identity as Identity],
        description: IDENTITY_DESCRIPTIONS[user.identity as Identity],
      },
      templateMatch: {
        templateType: templateMatch.templateType,
        label: TEMPLATE_LABELS[templateMatch.templateType],
        progressionType: templateMatch.progressionType,
        environmentTarget: templateMatch.environmentTarget,
        sessionDurationRange: templateMatch.sessionDurationRange,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
