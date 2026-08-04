import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TrainingView from "./TrainingView";
import { InstanceStatus } from "@/generated/prisma";
import type { SessionDraft } from "@/app/api/session/draft/route";

export default async function Training() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;

  //  Active plan instance

  const instance = await prisma.planInstance.findFirst({
    where: { userId, status: InstanceStatus.ACTIVE },
    include: { plan: true },
  });

  if (!instance) redirect("/programs");

  //  Planned session for the current session number

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
          exercise: {
            select: {
              id: true,
              name: true,
              musclesWorked: true,
              equipment: {
                include: {
                  equipment: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plannedSession) redirect("/programs");

  //  Plans are level-specific now (WorkoutPlan.difficulty), so each
  //  plannedExercise's repsScheme already holds the right values for
  //  whichever level's plan matched this user — no per-level branching.
  //
  //  NOTE: sets/reps below are a legacy shim for ExerciseForView, which
  //  still expects single numbers. For a flat scheme (e.g. [12,12]) this
  //  is exact. For a real pyramid (e.g. [15,12,10]) it's an approximation
  //  (sets = scheme length, reps = first set only) — TrainingView should
  //  be migrated to read repsScheme directly, at which point this shim
  //  and the sets/reps fields can be removed.

  const exercisesForView = plannedSession.plannedExercises.map((pe) => ({
    id: pe.id,
    order: pe.order,
    repsScheme: pe.repsScheme,
    sets: pe.repsScheme.length,
    reps: pe.repsScheme[0] ?? 0,
    restSeconds: pe.restSeconds,
    exercise: {
      id: pe.exercise.id,
      name: pe.exercise.name,
      musclesWorked: pe.exercise.musclesWorked,
      equipment: pe.exercise.equipment[0]?.equipment ?? null, // ← this line
    },
  }));

  //  Derive unique muscles
  const muscles = [
    ...new Set(exercisesForView.flatMap((e) => e.exercise.musclesWorked)),
  ];

  //  Derive access tier
  //
  //  FREE (Starter)    — no subscription, no equipment
  //  DECLARED_TRIAL    — has DECLARED equipment with active trialExpiresAt
  //  PURCHASED         — subscription.plan === "EQUIPMENT" (purchased from store)
  //  PRO               — subscription.plan === "PRO"

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
    // Check for active declared-equipment trial
    const declaredEquipment = await prisma.userEquipment.findFirst({
      where: {
        userId,
        source: "DECLARED",
        trialExpiresAt: { gt: new Date() },
      },
      select: { trialExpiresAt: true },
    });

    if (declaredEquipment?.trialExpiresAt) {
      tier = "DECLARED_TRIAL";
      trialExpiresAt = declaredEquipment.trialExpiresAt.toISOString();
    }
    // else: tier remains "FREE"
  }

  //  6. boughtFromStore flag
  // True = user's equipment record has source === "PURCHASED"
  const purchasedEquipment = await prisma.userEquipment.findFirst({
    where: { userId, source: "PURCHASED" },
    select: { id: true },
  });
  const boughtFromStore = purchasedEquipment != null;

  return (
    <TrainingView
      draft={(instance.sessionDraft as SessionDraft) ?? null}
      instance={instance}
      plannedSession={plannedSession}
      exercisesForView={exercisesForView}
      muscles={muscles}
      boughtFromStore={boughtFromStore}
      tier={tier}
      trialExpiresAt={trialExpiresAt}
    />
  );
}
