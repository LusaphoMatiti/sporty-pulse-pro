// src/app/api/training/programs/route.ts
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchTemplate, TEMPLATE_LABELS } from "@/lib/templateMatcher";
import { resolveExercises, getUserEquipmentIds } from "@/lib/substitution";
import { IDENTITY_LABELS, IDENTITY_DESCRIPTIONS } from "@/lib/identity";
import { Identity, EnvironmentTarget } from "@/generated/prisma";
import type { PlannedExerciseWithRelations } from "@/lib/substitution";

export const dynamic = "force-dynamic";

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

  if (!user.identity) {
    return NextResponse.json(
      { error: "Identity not assigned. Complete onboarding first." },
      { status: 400 },
    );
  }

  const userEquipmentIds = await getUserEquipmentIds(userId);
  const hasEquipment = userEquipmentIds.length > 0;

  const templateMatch = matchTemplate({
    identity: user.identity,
    goal: user.primaryGoal,
    trainingLocation: user.trainingLocation,
    hasEquipment,
  });

  const programs = await prisma.workoutPlan.findMany({
    where: {
      identityTarget: user.identity,
      OR: [
        { environmentTarget: templateMatch.environmentTarget },
        { environmentTarget: EnvironmentTarget.ANY },
      ],
    },
    include: {
      plannedSessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          plannedExercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: {
                include: {
                  equipment: {
                    include: { equipment: true },
                  },
                  substitutions: {
                    include: {
                      substituteExercise: {
                        include: {
                          equipment: {
                            include: { equipment: true },
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
      },
      instances: {
        where: { userId, status: "ACTIVE" },
        select: { id: true, currentSession: true, progressionWeek: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const resolvedPrograms = programs.map((program) => {
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
      sessions: resolvedSessions,
      activeInstance,
    };
  });

  const access = {
    isPro: false,
    isEquipment: false,
    hasActiveTrial: false,
    trialExpiresAt: null,
    canStartNewProgram: true,
    activeInstanceCount: 0,
    programCap: null,
    activeEquipmentIds: [],
    expiredEquipmentIds: [],
    activePlanId: null,
    declaredEquipmentIds: [],
  };

  return NextResponse.json(
    {
      plans: resolvedPrograms,
      access,
      declaredEquipmentName: null,
      userIdentity: user.identity,

      // optional extras
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
