import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProgressView from "./ProgressView";
import { MuscleGroup } from "@/generated/prisma";

export default async function ProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );

  // 0. Subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });

  // Normalise: treat missing / inactive subscription as FREE
  const userPlan: "FREE" | "EQUIPMENT" | "PRO" =
    subscription?.status === "active"
      ? (subscription.plan as "FREE" | "EQUIPMENT" | "PRO")
      : "FREE";

  //  Trial detection
  // A "Declared Trial" user has DECLARED equipment with a future trialExpiresAt
  // but is NOT on an EQUIPMENT or PRO subscription.
  // Per spec: trial users have the SAME locked Progress view as FREE users.
  const declaredTrialEquipment =
    userPlan === "FREE"
      ? await prisma.userEquipment.findFirst({
          where: {
            userId,
            source: "DECLARED",
            trialExpiresAt: { gt: now },
          },
          select: { trialExpiresAt: true },
        })
      : null;

  const hasActiveTrial = declaredTrialEquipment != null;

  //  ALL workout logs
  const allLogs = await prisma.workoutLog.findMany({
    where: { userId },
    include: {
      plannedExercise: {
        include: {
          exercise: true,
          session: { include: { plan: true } },
        },
      },
      instance: { include: { plan: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  //  Header stats
  const uniqueSessions = new Map<
    string,
    { completedAt: Date; muscleGroup: MuscleGroup }
  >();
  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (!uniqueSessions.has(key)) {
      uniqueSessions.set(key, {
        completedAt: log.completedAt,
        muscleGroup: log.plannedExercise.session.plan.muscleGroup,
      });
    }
  }

  const totalWorkouts = uniqueSessions.size;
  const totalVolumeKg = allLogs.reduce((sum, l) => {
    if (l.weightKg && l.actualReps && l.actualSets)
      return sum + l.weightKg * l.actualReps * l.actualSets;
    return sum;
  }, 0);
  const totalHours = Math.round((totalWorkouts * 55) / 60);

  //  Personal records + progression history
  const logsByDate = [...allLogs].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );

  const prHistoryMap = new Map<
    string,
    { date: string; weightKg: number; reps: number }[]
  >();
  for (const log of logsByDate) {
    if (!log.actualReps || !log.actualSets) continue;
    const name = log.plannedExercise.exercise.name;
    if (!prHistoryMap.has(name)) prHistoryMap.set(name, []);
    prHistoryMap.get(name)!.push({
      date: log.completedAt.toISOString().slice(0, 10),
      weightKg: log.weightKg ?? 0,
      reps: log.actualReps,
    });
  }

  const prMap = new Map<
    string,
    { exerciseName: string; weightKg: number; reps: number; setAt: Date }
  >();
  for (const log of logsByDate) {
    if (!log.actualReps || !log.actualSets) continue;
    const name = log.plannedExercise.exercise.name;
    const score = log.weightKg
      ? log.weightKg * log.actualReps
      : log.actualReps * log.actualSets;
    const existing = prMap.get(name);
    const existingScore = existing ? existing.weightKg * existing.reps : 0;
    if (score > existingScore) {
      prMap.set(name, {
        exerciseName: name,
        weightKg: log.weightKg ?? 0,
        reps: log.actualReps,
        setAt: log.completedAt,
      });
    }
  }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const personalRecords = Array.from(prMap.values()).map((pr) => ({
    ...pr,
    setAt: pr.setAt.toISOString(),
    isNew: pr.setAt >= sevenDaysAgo,
    history: (prHistoryMap.get(pr.exerciseName) ?? []).slice(-6),
  }));

  //  Monthly comparison
  const thisMonthSessions = new Set<string>();
  const lastMonthSessions = new Set<string>();
  let thisMonthVolume = 0;
  let lastMonthVolume = 0;

  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (log.completedAt >= thisMonthStart) {
      thisMonthSessions.add(key);
      if (log.weightKg && log.actualReps && log.actualSets)
        thisMonthVolume += log.weightKg * log.actualReps * log.actualSets;
    } else if (
      log.completedAt >= lastMonthStart &&
      log.completedAt <= lastMonthEnd
    ) {
      lastMonthSessions.add(key);
      if (log.weightKg && log.actualReps && log.actualSets)
        lastMonthVolume += log.weightKg * log.actualReps * log.actualSets;
    }
  }

  const thisMonth = {
    sessions: thisMonthSessions.size,
    volumeKg: Math.round(thisMonthVolume),
    hours: Math.round((thisMonthSessions.size * 55) / 60),
  };
  const lastMonth = {
    sessions: lastMonthSessions.size,
    volumeKg: Math.round(lastMonthVolume),
    hours: Math.round((lastMonthSessions.size * 55) / 60),
  };

  const currentMonthName = now.toLocaleString("default", { month: "short" });
  const prevMonthName = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
  ).toLocaleString("default", { month: "short" });

  //  Body split
  const splitCounts: Record<string, number> = {
    UPPER: 0,
    LOWER: 0,
    CORE: 0,
    FULLBODY: 0,
  };
  for (const [, { completedAt, muscleGroup }] of uniqueSessions.entries()) {
    if (completedAt >= thisMonthStart)
      splitCounts[muscleGroup] = (splitCounts[muscleGroup] ?? 0) + 1;
  }
  const totalSplitSessions =
    Object.values(splitCounts).reduce((a, b) => a + b, 0) || 1;
  const bodySplit = Object.entries(splitCounts).map(([group, count]) => ({
    group,
    count,
    percent: Math.round((count / totalSplitSessions) * 100),
  }));

  // Session history
  const sessionMeta = new Map<
    string,
    {
      completedAt: Date;
      planName: string;
      muscleGroup: string;
      focus: string;
      exerciseCount: Set<string>;
      totalVolume: number;
      sessionNumber: number;
      instanceId: string;
    }
  >();

  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (!sessionMeta.has(key)) {
      sessionMeta.set(key, {
        completedAt: log.completedAt,
        planName: log.instance.plan.name,
        muscleGroup: log.instance.plan.muscleGroup,
        focus: log.plannedExercise.session.focus,
        exerciseCount: new Set(),
        totalVolume: 0,
        sessionNumber: log.sessionNumber,
        instanceId: log.instanceId,
      });
    }
    const meta = sessionMeta.get(key)!;
    meta.exerciseCount.add(log.plannedExerciseId);
    if (log.weightKg && log.actualReps && log.actualSets)
      meta.totalVolume += log.weightKg * log.actualReps * log.actualSets;
  }

  const sessionHistory = Array.from(sessionMeta.entries())
    .map(([key, meta]) => ({
      key,
      completedAt: meta.completedAt.toISOString(),
      planName: meta.planName,
      muscleGroup: meta.muscleGroup,
      focus: meta.focus,
      exerciseCount: meta.exerciseCount.size,
      totalVolume: Math.round(meta.totalVolume),
      sessionNumber: meta.sessionNumber,
      instanceId: meta.instanceId,
    }))
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );

  return (
    <ProgressView
      userPlan={userPlan}
      hasActiveTrial={hasActiveTrial}
      headerStats={{
        totalWorkouts,
        totalHours,
        totalVolumeKg: Math.round(totalVolumeKg),
      }}
      personalRecords={personalRecords}
      thisMonth={thisMonth}
      lastMonth={lastMonth}
      currentMonthName={currentMonthName}
      prevMonthName={prevMonthName}
      bodySplit={bodySplit}
      sessionHistory={sessionHistory}
    />
  );
}
