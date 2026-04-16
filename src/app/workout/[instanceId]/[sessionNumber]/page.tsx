import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import SessionView from "./SessionView";
import type { SessionDraft } from "@/app/api/session/draft/route";

type Props = {
  params: Promise<{ instanceId: string; sessionNumber: string }>;
};

export default async function SessionPage({ params }: Props) {
  const auth = await getServerSession(authOptions);
  if (!auth) redirect("/login");

  const { instanceId, sessionNumber: sessionNumberStr } = await params;
  const sessionNumber = parseInt(sessionNumberStr, 10);
  if (isNaN(sessionNumber)) redirect("/training");

  // Load the active plan instance by its ID

  const instance = await prisma.planInstance.findFirst({
    where: {
      id: instanceId,
      userId: auth.user.id,
      status: InstanceStatus.ACTIVE,
    },
    include: { plan: true },
  });

  if (!instance) {
    console.error(
      `[SessionPage] No active instance — instanceId: ${instanceId}, userId: ${auth.user.id}`,
    );
    redirect("/training");
  }

  //  Load the planned session

  const plannedSession = await prisma.plannedSession.findUnique({
    where: {
      planId_sessionNumber: {
        planId: instance.planId,
        sessionNumber,
      },
    },
    include: {
      plannedExercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: true,
        },
      },
    },
  });

  if (!plannedSession) {
    console.error(
      `[SessionPage] No planned session — planId: ${instance.planId}, sessionNumber: ${sessionNumber}`,
    );
    redirect("/training");
  }

  //  Pick sets / reps for this user's level

  const levelKey = instance.level;

  const exercises = plannedSession.plannedExercises.map((pe) => {
    const sets =
      levelKey === "BEGINNER"
        ? pe.beginnerSets
        : levelKey === "INTERMEDIATE"
          ? pe.intermediateSets
          : pe.advancedSets;

    const reps =
      levelKey === "BEGINNER"
        ? pe.beginnerReps
        : levelKey === "INTERMEDIATE"
          ? pe.intermediateReps
          : pe.advancedReps;

    return {
      id: pe.id,
      order: pe.order,
      sets,
      reps,
      restSeconds: pe.restSeconds,
      exercise: {
        id: pe.exercise.id,
        name: pe.exercise.name,
      },
    };
  });

  //  Build title parts

  return (
    <SessionView
      instanceId={instance.id}
      dayNumber={sessionNumber}
      planName={instance.plan.name}
      focus={plannedSession.focus}
      level={instance.level}
      muscleGroup={instance.plan.muscleGroup}
      exercises={exercises}
      draft={(instance.sessionDraft as SessionDraft) ?? null}
    />
  );
}
