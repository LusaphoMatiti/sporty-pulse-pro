import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HistoryView from "./HistoryView";

type Params = { instanceId: string; sessionNumber: string };

export default async function History({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const sessionNumber = parseInt(params.sessionNumber, 10);

  const logs = await prisma.workoutLog.findMany({
    where: {
      userId: session.user.id,
      instanceId: params.instanceId,
      sessionNumber,
    },
    include: {
      plannedExercise: {
        include: {
          exercise: true,
          session: true,
        },
      },
      instance: { include: { plan: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (logs.length === 0) redirect("/progress");

  const first = logs[0];
  const meta = {
    planName: first.instance.plan.name,
    focus: first.plannedExercise.session.focus,
    completedAt: first.completedAt.toISOString(),
    level: first.instance.level,
  };

  const exercises = logs.map((l) => ({
    id: l.id,
    name: l.plannedExercise.exercise.name,
    musclesWorked: l.plannedExercise.exercise.musclesWorked,
    weightKg: l.weightKg,
    actualReps: l.actualReps,
    actualSets: l.actualSets,
    plannedSets:
      first.instance.level === "BEGINNER"
        ? l.plannedExercise.beginnerSets
        : first.instance.level === "INTERMEDIATE"
          ? l.plannedExercise.intermediateSets
          : l.plannedExercise.advancedSets,
    plannedReps:
      first.instance.level === "BEGINNER"
        ? l.plannedExercise.beginnerReps
        : first.instance.level === "INTERMEDIATE"
          ? l.plannedExercise.intermediateReps
          : l.plannedExercise.advancedReps,
  }));

  const totalVolume = exercises.reduce((sum, e) => {
    if (e.weightKg && e.actualReps && e.actualSets) {
      return sum + e.weightKg * e.actualReps * e.actualSets;
    }
    return sum;
  }, 0);

  return (
    <HistoryView
      meta={meta}
      exercises={exercises}
      totalVolume={Math.round(totalVolume)}
    />
  );
}
