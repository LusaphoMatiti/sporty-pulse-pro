import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { MuscleGroup } from "@/generated/prisma";

type RecoveryStatus = "FRESH" | "MODERATE" | "HIGH_FATIGUE";
type StrengthTrend = {
  exerciseName: string;
  percentChange: number;
  currentRM: number;
  priorRM: number;
  dataPoints: number;
};
type VolumeByMuscle = {
  group: string;
  thisWeekKg: number;
  lastWeekKg: number;
  percentChange: number | null;
};

type WeeklyVolumeDay = {
  label: string;
  kg: number;
};

type WeeklyVolumeData = {
  totalKg: number;
  setsCompleted: number;
  durationMinutes: number;
  vsLastWeekPct: number | null;
  days: WeeklyVolumeDay[];
};

// bodySplit and volumeByMuscle used to bucket every session by the PLAN's
// single overall muscleGroup field. That's accurate for a genuinely
// single-focus plan, but a plan whose sessions vary day to day (e.g. a Gym
// plan alternating Legs/Push/Pull under one WorkoutPlan record) would have
// every session dumped into the same one bucket, losing the real spread.
// Classify from the SESSION's own focus string first — which already
// varies correctly per session — and only fall back to the plan's
// muscleGroup when the focus text doesn't clearly indicate a body part.
function classifyFocus(
  focus: string,
  planMuscleGroup: MuscleGroup,
): MuscleGroup {
  const f = focus.toLowerCase();
  if (
    /\b(legs?|lower|glute|glutes|quad|quads|hamstrings?|calves|calf)\b/.test(f)
  )
    return "LOWER" as MuscleGroup;
  if (
    /\b(upper|push|pull|chest|back|shoulders?|delts?|arms?|bicep|biceps|tricep|triceps)\b/.test(
      f,
    )
  )
    return "UPPER" as MuscleGroup;
  if (/\b(core|abs?|abdominals?)\b/.test(f)) return "CORE" as MuscleGroup;
  if (/\b(full[\s-]?body|total[\s-]?body)\b/.test(f))
    return "FULLBODY" as MuscleGroup;
  return planMuscleGroup;
}

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const [subscription, userProfile, allLogs] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryGoal: true },
    }),
    prisma.workoutLog.findMany({
      where: { userId },
      select: {
        instanceId: true,
        sessionNumber: true,
        completedAt: true,
        weightKg: true,
        actualReps: true,
        actualSets: true,
        plannedExerciseId: true,
        plannedExercise: {
          select: {
            session: {
              select: {
                focus: true,
                plan: { select: { muscleGroup: true } },
              },
            },
            exercise: { select: { name: true } },
          },
        },
        instance: {
          select: {
            plan: { select: { name: true, muscleGroup: true } },
          },
        },
      },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const userPlan: "FREE" | "EQUIPMENT" | "PRO" =
    subscription?.status === "active"
      ? (subscription.plan as "FREE" | "EQUIPMENT" | "PRO")
      : "FREE";

  // ── Trial ─────────────────────────────────────────────────────────

  const declaredTrial =
    userPlan === "FREE"
      ? await prisma.userEquipment.findFirst({
          where: { userId, source: "DECLARED", trialExpiresAt: { gt: now } },
          select: { trialExpiresAt: true },
        })
      : null;
  const hasActiveTrial = declaredTrial != null;

  // ── Unique sessions ───────────────────────────────────────────────
  const uniqueSessions = new Map<
    string,
    { completedAt: Date; muscleGroup: MuscleGroup }
  >();
  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (!uniqueSessions.has(key)) {
      const planMuscleGroup =
        log.plannedExercise?.session?.plan?.muscleGroup ?? "FULLBODY";
      const focus = log.plannedExercise?.session?.focus ?? "";
      uniqueSessions.set(key, {
        completedAt: log.completedAt,
        muscleGroup: classifyFocus(focus, planMuscleGroup as MuscleGroup),
      });
    }
  }

  // ── Header stats ──────────────────────────────────────────────────
  const totalWorkouts = uniqueSessions.size;
  const totalVolumeKg = allLogs.reduce((sum, l) => {
    if (l.weightKg && l.actualReps && l.actualSets)
      return sum + l.weightKg * l.actualReps * l.actualSets;
    return sum;
  }, 0);
  const totalHours = Math.round((totalWorkouts * 55) / 60);

  // ── Personal records ──────────────────────────────────────────────
  const logsByDate = [...allLogs].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const prHistoryMap = new Map<
    string,
    { date: string; weightKg: number; reps: number }[]
  >();
  for (const log of logsByDate) {
    if (!log.actualReps || !log.actualSets) continue;
    const name = log.plannedExercise?.exercise?.name;
    if (!name) continue;
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
    const name = log.plannedExercise?.exercise?.name;
    if (!name) continue;
    const score = log.weightKg
      ? log.weightKg * log.actualReps
      : log.actualReps * log.actualSets;
    const exist = prMap.get(name);
    if (!exist || score > exist.weightKg * exist.reps) {
      prMap.set(name, {
        exerciseName: name,
        weightKg: log.weightKg ?? 0,
        reps: log.actualReps,
        setAt: log.completedAt,
      });
    }
  }

  const personalRecords = Array.from(prMap.values()).map((pr) => ({
    ...pr,
    setAt: pr.setAt.toISOString(),
    isNew: pr.setAt >= sevenDaysAgo,
    history: (prHistoryMap.get(pr.exerciseName) ?? []).slice(-6),
  }));

  // ── Monthly comparison ────────────────────────────────────────────
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

  // ── Body split ────────────────────────────────────────────────────
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

  // ── Session history ───────────────────────────────────────────────
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
        focus: log.plannedExercise?.session?.focus ?? "Session",
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

  // ── Dashboard data (PRO analytics) ───────────────────────────────
  let dashboardData = null;

  if (totalWorkouts > 0) {
    // Fetch active instance — select only the 3 fields actually used below.
    const activeInstance = await prisma.planInstance.findFirst({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        planId: true,
        startedAt: true,
        plan: {
          select: {
            sessionsPerWeek: true,
            durationWeeks: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Consistency
    let consistencyScore = 0,
      consistencyPlanned = 0,
      consistencyCompleted = 0;
    if (activeInstance) {
      const spw = activeInstance.plan.sessionsPerWeek;
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsed = Math.min(
        activeInstance.plan.durationWeeks,
        Math.ceil(
          (now.getTime() - activeInstance.startedAt.getTime()) / msPerWeek,
        ),
      );
      // Actual PlannedSession row count for this plan, not
      // durationWeeks * sessionsPerWeek — that formula assumes every week
      // has exactly `sessionsPerWeek` sessions, which doesn't always hold
      // (e.g. Gym plans with dedicated recovery days). Same fix already
      // applied to the session start/complete routes, so this cap now
      // agrees with those instead of drifting from them.
      const totalPlanSessions = await prisma.plannedSession.count({
        where: { planId: activeInstance.planId },
      });
      const plannedSoFar = Math.min(totalPlanSessions, weeksElapsed * spw);
      const completedInPlan = new Set(
        Array.from(uniqueSessions.keys()).filter((k) =>
          k.startsWith(activeInstance.id),
        ),
      );
      consistencyPlanned = plannedSoFar;
      consistencyCompleted = completedInPlan.size;
      consistencyScore =
        plannedSoFar === 0
          ? 100
          : Math.max(
              0,
              Math.round((completedInPlan.size / plannedSoFar) * 100),
            );
    }

    // Strength trends
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    const exerciseWindows = new Map<
      string,
      { recent: number[]; prior: number[] }
    >();
    for (const log of allLogs) {
      if (!log.actualReps || !log.actualSets) continue;
      const name = log.plannedExercise.exercise.name;
      const rm =
        (log.weightKg ?? 0) > 0
          ? (log.weightKg ?? 0) * (1 + log.actualReps / 30)
          : log.actualReps;
      if (!exerciseWindows.has(name))
        exerciseWindows.set(name, { recent: [], prior: [] });
      const w = exerciseWindows.get(name)!;
      if (log.completedAt >= fourWeeksAgo) w.recent.push(rm);
      else if (log.completedAt >= eightWeeksAgo) w.prior.push(rm);
    }
    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
    const strengthTrends: StrengthTrend[] = [];
    for (const [name, w] of exerciseWindows.entries()) {
      if (!w.recent.length || !w.prior.length) continue;
      const pct = Math.round(
        ((avg(w.recent) - avg(w.prior)) / avg(w.prior)) * 100,
      );
      strengthTrends.push({
        exerciseName: name,
        percentChange: pct,
        currentRM: Math.round(avg(w.recent)),
        priorRM: Math.round(avg(w.prior)),
        dataPoints: w.recent.length + w.prior.length,
      });
    }
    strengthTrends.sort(
      (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
    );

    // Volume by muscle
    const dayOfWeek = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(
      now.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek),
    );
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
      const planMuscleGroup = log.instance.plan.muscleGroup;
      const focus = log.plannedExercise?.session?.focus ?? "";
      const mg = classifyFocus(focus, planMuscleGroup) as string;
      if (!(mg in volumeMap)) continue;
      if (log.completedAt >= thisWeekStart) volumeMap[mg].thisWeek += vol;
      else if (
        log.completedAt >= lastWeekStart &&
        log.completedAt <= lastWeekEnd
      )
        volumeMap[mg].lastWeek += vol;
    }
    const volumeByMuscle: VolumeByMuscle[] = Object.entries(volumeMap).map(
      ([group, v]) => {
        const tw = Math.round(v.thisWeek),
          lw = Math.round(v.lastWeek);
        return {
          group,
          thisWeekKg: tw,
          lastWeekKg: lw,
          percentChange:
            lw > 0 ? Math.round(((tw - lw) / lw) * 100) : tw > 0 ? null : null,
        };
      },
    );

    // Weekly volume (Mon–Sun, current week)
    const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
    const dayBuckets = dayLabels.map(() => 0);
    let weeklySets = 0;

    for (const log of allLogs) {
      if (log.completedAt < thisWeekStart) continue;
      if (!log.weightKg || !log.actualReps || !log.actualSets) continue;

      const vol = log.weightKg * log.actualReps * log.actualSets;
      const dow = log.completedAt.getDay(); // 0=Sun..6=Sat
      const idx = dow === 0 ? 6 : dow - 1; // map to Mon=0..Sun=6
      dayBuckets[idx] += vol;
      weeklySets += log.actualSets;
    }

    const weeklyTotalKg = Math.round(dayBuckets.reduce((a, b) => a + b, 0));

    // vs last week, for the trend pill
    let lastWeekTotalKg = 0;
    for (const log of allLogs) {
      if (log.completedAt < lastWeekStart || log.completedAt > lastWeekEnd)
        continue;
      if (!log.weightKg || !log.actualReps || !log.actualSets) continue;
      lastWeekTotalKg += log.weightKg * log.actualReps * log.actualSets;
    }
    lastWeekTotalKg = Math.round(lastWeekTotalKg);

    const vsLastWeekPct =
      lastWeekTotalKg > 0
        ? Math.round(
            ((weeklyTotalKg - lastWeekTotalKg) / lastWeekTotalKg) * 100,
          )
        : weeklyTotalKg > 0
          ? 100
          : null;

    const weeklyVolume: WeeklyVolumeData = {
      totalKg: weeklyTotalKg,
      setsCompleted: weeklySets,
      durationMinutes: 0,
      vsLastWeekPct,
      days: dayLabels.map((label, i) => ({
        label,
        kg: Math.round(dayBuckets[i]),
      })),
    };

    // Recovery
    let recentVolume = 0,
      priorVolume = 0,
      recentSessionCount = 0;
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    for (const log of allLogs) {
      const vol =
        (log.weightKg ?? 0) * (log.actualReps ?? 0) * (log.actualSets ?? 0);
      if (log.completedAt >= sevenDaysAgo) recentVolume += vol;
      else if (log.completedAt >= fourteenDaysAgo) priorVolume += vol;
    }
    for (const [, s] of uniqueSessions.entries()) {
      if (s.completedAt >= sevenDaysAgo) recentSessionCount++;
    }
    const volumeSpike =
      priorVolume > 0 ? recentVolume / priorVolume : recentVolume > 0 ? 2 : 1;
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
      recoveryInsight = `${recentSessionCount} sessions this week — you're working hard.`;
    } else {
      recoveryStatus = "FRESH";
      recoveryInsight =
        recentSessionCount === 0
          ? "No sessions in the last 7 days — fully recovered."
          : `${recentSessionCount} session${recentSessionCount !== 1 ? "s" : ""} this week — good balance.`;
    }

    // Goal progress — uses userProfile fetched in parallel at the top
    const primaryGoal = userProfile?.primaryGoal ?? "GET_FIT";
    const strengthImprovedCount = strengthTrends.filter(
      (t) => t.percentChange > 0,
    ).length;
    const avgStrengthChange =
      strengthTrends.length > 0
        ? strengthTrends.reduce((s, t) => s + t.percentChange, 0) /
          strengthTrends.length
        : 0;

    let goalProgress = 0,
      goalLabel = "",
      goalInsight = "";

    if (primaryGoal === "LOSE_WEIGHT") {
      goalLabel = "Fat Loss";
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
          : "Keep up your training frequency to accelerate results.";
    } else if (primaryGoal === "BUILD_MUSCLE") {
      goalLabel = "Muscle Gain";
      const strengthComponent =
        strengthTrends.length > 0
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
          : "Focus on progressive overload to push your goal score higher.";
    } else {
      goalLabel = "Overall Fitness";
      goalProgress = Math.round(
        consistencyScore * 0.7 + Math.min(100, recentSessionCount * 20) * 0.3,
      );
      goalInsight =
        goalProgress >= 70
          ? "Excellent training frequency — your fitness is improving."
          : "Increase session frequency to build your fitness faster.";
    }

    dashboardData = {
      consistencyScore,
      consistencyPlanned,
      consistencyCompleted,
      goalProgress: Math.min(100, Math.max(0, goalProgress)),
      goalLabel,
      goalInsight,
      recoveryStatus,
      weeklyVolume,
      recoveryInsight,
      strengthTrends: strengthTrends.slice(0, 5),
      volumeByMuscle,
    };
  }

  return NextResponse.json({
    userPlan,
    hasActiveTrial,
    headerStats: {
      totalWorkouts,
      totalHours,
      totalVolumeKg: Math.round(totalVolumeKg),
      currentStreak: (() => {
        const activeDaysSet = new Set(
          Array.from(uniqueSessions.values()).map((s) =>
            s.completedAt.toISOString().slice(0, 10),
          ),
        );
        let streak = 0;
        const cursor = new Date(now);
        if (!activeDaysSet.has(cursor.toISOString().slice(0, 10))) {
          cursor.setDate(cursor.getDate() - 1);
        }
        while (activeDaysSet.has(cursor.toISOString().slice(0, 10))) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
      })(),
    },
    personalRecords,
    thisMonth: {
      sessions: thisMonthSessions.size,
      volumeKg: Math.round(thisMonthVolume),
      hours: Math.round((thisMonthSessions.size * 55) / 60),
    },
    lastMonth: {
      sessions: lastMonthSessions.size,
      volumeKg: Math.round(lastMonthVolume),
      hours: Math.round((lastMonthSessions.size * 55) / 60),
    },
    currentMonthName: now.toLocaleString("default", { month: "short" }),
    prevMonthName: new Date(
      now.getFullYear(),
      now.getMonth() - 1,
    ).toLocaleString("default", { month: "short" }),
    bodySplit,
    sessionHistory,
    dashboardData,
  });
}
