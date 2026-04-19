import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProgressView, {
  DashboardData,
  RecoveryStatus,
  StrengthTrend,
  VolumeByMuscle,
} from "./ProgressView";
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

  // ── Subscription ───────────────────────────────────────────────
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });

  const userPlan: "FREE" | "EQUIPMENT" | "PRO" =
    subscription?.status === "active"
      ? (subscription.plan as "FREE" | "EQUIPMENT" | "PRO")
      : "FREE";

  // ── Trial detection ────────────────────────────────────────────
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

  // ── ALL workout logs ───────────────────────────────────────────
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

  // ── Unique completed sessions ──────────────────────────────────
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

  // ── Header stats ───────────────────────────────────────────────
  const totalWorkouts = uniqueSessions.size;
  const totalVolumeKg = allLogs.reduce((sum, l) => {
    if (l.weightKg && l.actualReps && l.actualSets)
      return sum + l.weightKg * l.actualReps * l.actualSets;
    return sum;
  }, 0);
  const totalHours = Math.round((totalWorkouts * 55) / 60);

  // ── Personal records + progression history ─────────────────────
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

  // ── Monthly comparison ─────────────────────────────────────────
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

  // ── Body split ─────────────────────────────────────────────────
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

  // ── Session history ────────────────────────────────────────────
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

  // ── DASHBOARD DATA (PRO only — computed unconditionally, gated in UI) ───────

  let dashboardData: DashboardData | null = null;

  if (totalWorkouts > 0) {
    // ── Active plan instance for planned session count ─────────────
    const activeInstance = await prisma.planInstance.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });

    // ── 1. Consistency Score ───────────────────────────────────────
    // Strategy: compare completed vs planned sessions from the active
    // plan start date. Weight recent sessions more heavily (exponential
    // decay), then penalise missed sessions 1.3× harder than a missed
    // completion.

    let consistencyScore = 0;
    let consistencyPlanned = 0;
    let consistencyCompleted = 0;

    if (activeInstance) {
      const planStart = activeInstance.startedAt;
      const spw = activeInstance.plan.sessionsPerWeek;
      const durationWeeks = activeInstance.plan.durationWeeks;
      const totalPlanned = durationWeeks * spw;

      // Completed sessions within this instance
      const completedInPlan = new Set<string>();
      for (const [key] of uniqueSessions.entries()) {
        if (key.startsWith(activeInstance.id)) completedInPlan.add(key);
      }

      // How many weeks have elapsed since plan start (cap at durationWeeks)
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsed = Math.min(
        durationWeeks,
        Math.ceil((now.getTime() - planStart.getTime()) / msPerWeek),
      );
      const plannedSoFar = Math.min(totalPlanned, weeksElapsed * spw);
      const completedCount = completedInPlan.size;

      consistencyPlanned = plannedSoFar;
      consistencyCompleted = completedCount;

      if (plannedSoFar === 0) {
        consistencyScore = 100; // haven't started yet — not penalised
      } else {
        // Base completion ratio
        const baseRatio = Math.min(1, completedCount / plannedSoFar);

        // Recency weighting: look at the last 4 planned "slots" and see
        // how many were completed. If ≥ 2 of the last 4 were missed, apply
        // a recency penalty.
        const recentPlanned = Math.min(4, plannedSoFar);
        const recentSessionKeys = Array.from(uniqueSessions.entries())
          .filter(([key]) => key.startsWith(activeInstance.id))
          .sort(
            ([, a], [, b]) => b.completedAt.getTime() - a.completedAt.getTime(),
          )
          .slice(0, recentPlanned)
          .map(([key]) => key);

        const recentMissed = recentPlanned - recentSessionKeys.length;
        // For each recent miss, drop by 5 percentage points (on top of base)
        const recencyPenalty = recentMissed * 5;

        consistencyScore = Math.max(
          0,
          Math.round(baseRatio * 100 - recencyPenalty),
        );
      }
    } else {
      // No active plan — use last 30 days as a proxy
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentSessions = Array.from(uniqueSessions.values()).filter(
        (s) => s.completedAt >= thirtyDaysAgo,
      );
      // Assume 3× per week as a baseline expectation
      consistencyPlanned = Math.round(
        ((now.getTime() - thirtyDaysAgo.getTime()) /
          (7 * 24 * 60 * 60 * 1000)) *
          3,
      );
      consistencyCompleted = recentSessions.length;
      consistencyScore = Math.min(
        100,
        Math.round(
          (consistencyCompleted / Math.max(1, consistencyPlanned)) * 100,
        ),
      );
    }

    // ── 2. Strength Trends (estimated 1RM per exercise) ────────────
    // Estimated 1RM = weight × (1 + reps / 30)  (Epley formula)
    // Compare avg 1RM in last 4 weeks vs prior 4 weeks.

    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

    // Group logs by exercise with 1RM per entry
    const exerciseWindows = new Map<
      string,
      { recent: number[]; prior: number[] }
    >();

    for (const log of allLogs) {
      if (!log.actualReps || !log.actualSets) continue;
      const name = log.plannedExercise.exercise.name;
      const weight = log.weightKg ?? 0;
      const rm =
        weight > 0 ? weight * (1 + log.actualReps / 30) : log.actualReps; // bodyweight: use reps as proxy

      if (!exerciseWindows.has(name)) {
        exerciseWindows.set(name, { recent: [], prior: [] });
      }
      const w = exerciseWindows.get(name)!;
      if (log.completedAt >= fourWeeksAgo) {
        w.recent.push(rm);
      } else if (log.completedAt >= eightWeeksAgo) {
        w.prior.push(rm);
      }
    }

    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const strengthTrends: StrengthTrend[] = [];
    for (const [name, windows] of exerciseWindows.entries()) {
      if (windows.recent.length === 0 || windows.prior.length === 0) continue;
      const recentAvg = avg(windows.recent);
      const priorAvg = avg(windows.prior);
      if (priorAvg === 0) continue;
      const pct = Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
      strengthTrends.push({
        exerciseName: name,
        percentChange: pct,
        currentRM: Math.round(recentAvg),
        priorRM: Math.round(priorAvg),
        dataPoints: windows.recent.length + windows.prior.length,
      });
    }

    // Sort by absolute change descending, take top 5
    strengthTrends.sort(
      (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
    );
    const topStrengthTrends = strengthTrends.slice(0, 5);

    // ── 3. Weekly Volume by Muscle Group ──────────────────────────
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() + mondayOffset);
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    const volumeMap: Record<string, { thisWeek: number; lastWeek: number }> = {
      UPPER: { thisWeek: 0, lastWeek: 0 },
      LOWER: { thisWeek: 0, lastWeek: 0 },
      CORE: { thisWeek: 0, lastWeek: 0 },
      FULLBODY: { thisWeek: 0, lastWeek: 0 },
    };

    for (const log of allLogs) {
      if (!log.weightKg || !log.actualReps || !log.actualSets) continue;
      const vol = log.weightKg * log.actualReps * log.actualSets;
      const mg = log.instance.plan.muscleGroup as string;
      if (!(mg in volumeMap)) continue;

      if (log.completedAt >= thisWeekStart) {
        volumeMap[mg].thisWeek += vol;
      } else if (
        log.completedAt >= lastWeekStart &&
        log.completedAt <= lastWeekEnd
      ) {
        volumeMap[mg].lastWeek += vol;
      }
    }

    const volumeByMuscle: VolumeByMuscle[] = Object.entries(volumeMap).map(
      ([group, v]) => {
        const thisWeekKg = Math.round(v.thisWeek);
        const lastWeekKg = Math.round(v.lastWeek);
        let percentChange: number | null = null;
        if (lastWeekKg > 0) {
          percentChange = Math.round(
            ((thisWeekKg - lastWeekKg) / lastWeekKg) * 100,
          );
        } else if (thisWeekKg > 0) {
          percentChange = null; // new activity, no prior baseline
        }
        return { group, thisWeekKg, lastWeekKg, percentChange };
      },
    );

    // ── 4. Recovery / Fatigue ──────────────────────────────────────
    // Estimate using:
    //   a) Sessions in last 7 days (frequency stress)
    //   b) Volume in last 7 days vs 7–14 days ago (spike detection)
    //   c) Any missed sessions in last 5 planned slots (rest signal)

    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let recentVolume = 0;
    let priorVolume = 0;
    let recentSessionCount = 0;

    for (const log of allLogs) {
      const vol =
        (log.weightKg ?? 0) * (log.actualReps ?? 0) * (log.actualSets ?? 0);
      if (log.completedAt >= sevenDaysAgo) {
        recentVolume += vol;
        // Count unique sessions in last 7 days
      } else if (log.completedAt >= fourteenDaysAgo) {
        priorVolume += vol;
      }
    }

    // Count unique completed sessions in last 7 days
    for (const [, s] of uniqueSessions.entries()) {
      if (s.completedAt >= sevenDaysAgo) recentSessionCount++;
    }

    // Volume spike ratio
    const volumeSpike =
      priorVolume > 0 ? recentVolume / priorVolume : recentVolume > 0 ? 2 : 1;

    // Frequency per week: >5 = high, 3–5 = moderate, <3 = fresh
    let recoveryStatus: RecoveryStatus = "FRESH";
    let recoveryInsight = "";

    if (recentSessionCount >= 6 || volumeSpike >= 1.8) {
      recoveryStatus = "HIGH_FATIGUE";
      recoveryInsight =
        recentSessionCount >= 6
          ? `${recentSessionCount} sessions in 7 days — consider a rest day.`
          : `Volume spiked ${Math.round(volumeSpike * 100 - 100)}% this week. Ease back slightly.`;
    } else if (recentSessionCount >= 4 || volumeSpike >= 1.3) {
      recoveryStatus = "MODERATE";
      recoveryInsight =
        recentSessionCount >= 4
          ? `${recentSessionCount} sessions this week — you're working hard.`
          : `Training volume up — monitor how you feel.`;
    } else if (recentSessionCount === 0) {
      recoveryStatus = "FRESH";
      recoveryInsight = "No sessions in the last 7 days — fully recovered.";
    } else {
      recoveryStatus = "FRESH";
      recoveryInsight = `${recentSessionCount} session${recentSessionCount !== 1 ? "s" : ""} this week — good balance.`;
    }

    // ── 5. Goal Progress ───────────────────────────────────────────
    // Derived from user's primaryGoal on their profile.
    // Fat Loss → consistency + volume trend
    // Muscle Gain → strength progression + volume
    // Fitness → consistency + frequency

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { primaryGoal: true },
    });

    const primaryGoal = userProfile?.primaryGoal ?? "GET_FIT";

    let goalProgress = 0;
    let goalLabel = "";
    let goalInsight = "";

    const strengthImprovedCount = topStrengthTrends.filter(
      (t) => t.percentChange > 0,
    ).length;
    const avgStrengthChange =
      topStrengthTrends.length > 0
        ? topStrengthTrends.reduce((s, t) => s + t.percentChange, 0) /
          topStrengthTrends.length
        : 0;

    if (primaryGoal === "LOSE_WEIGHT") {
      goalLabel = "Fat Loss";
      // Weighted: 60% consistency, 40% volume trend (more volume = more calories burned)
      const volumeComponent =
        priorVolume > 0
          ? Math.min(100, Math.round((recentVolume / priorVolume) * 50))
          : recentVolume > 0
            ? 50
            : 0;
      goalProgress = Math.round(consistencyScore * 0.6 + volumeComponent * 0.4);
      goalInsight =
        goalProgress >= 70
          ? "Strong consistency is driving your fat loss progress."
          : goalProgress >= 45
            ? "Keep up your training frequency to accelerate results."
            : "Increase workout consistency to move closer to your goal.";
    } else if (primaryGoal === "BUILD_MUSCLE") {
      goalLabel = "Muscle Gain";
      // Weighted: 50% strength progression, 50% consistency
      const strengthComponent =
        topStrengthTrends.length > 0
          ? Math.min(100, Math.max(0, 50 + avgStrengthChange * 2))
          : consistencyScore > 50
            ? 50
            : 25;
      goalProgress = Math.round(
        strengthComponent * 0.5 + consistencyScore * 0.5,
      );
      goalInsight =
        strengthImprovedCount > 0
          ? `${strengthImprovedCount} exercise${strengthImprovedCount !== 1 ? "s" : ""} getting stronger — hypertrophy is happening.`
          : totalWorkouts < 5
            ? "Build a training history to see muscle gain progress."
            : "Focus on progressive overload to push your goal score higher.";
    } else {
      // GET_FIT
      goalLabel = "Overall Fitness";
      // Weighted: 70% consistency, 30% training frequency
      const freqScore = Math.min(100, recentSessionCount * 20); // 5 sessions/wk = 100
      goalProgress = Math.round(consistencyScore * 0.7 + freqScore * 0.3);
      goalInsight =
        goalProgress >= 70
          ? "Excellent training frequency — your fitness is improving."
          : goalProgress >= 45
            ? "Solid base forming. Aim for 4+ sessions per week."
            : "Increase session frequency to build your fitness faster.";
    }

    goalProgress = Math.min(100, Math.max(0, goalProgress));

    dashboardData = {
      consistencyScore,
      consistencyPlanned,
      consistencyCompleted,
      goalProgress,
      goalLabel,
      goalInsight,
      recoveryStatus,
      recoveryInsight,
      strengthTrends: topStrengthTrends,
      volumeByMuscle,
    };
  }

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
      dashboardData={dashboardData}
    />
  );
}
