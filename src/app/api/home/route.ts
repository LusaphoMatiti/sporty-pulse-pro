import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Recovery helpers ──────────────────────────────────────────────────────────

function getRecoveryLabel(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct >= 75) return "Good to train";
  if (pct >= 45) return "Train with caution";
  return "Rest recommended";
}

function getRecoveryTip(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct >= 75) return "You're recovered. Push hard today.";
  if (pct >= 45) return "Moderate intensity only. Prioritise sleep.";
  return "Your body needs rest. Consider a deload or rest day.";
}

// ── Streak dot grid builder ───────────────────────────────────────────────────
// Returns 3 weeks: index 0 = oldest, index 2 = current week (Mon-anchored)

function buildStreakWeeks(activeDaysSet: Set<string>, now: Date) {
  const todayStr = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return Array.from({ length: 3 }, (_, w) => {
    const weekOffset = (2 - w) * 7; // 0 = current week, 14 = 2 weeks ago
    return Array.from({ length: 7 }, (_, d) => {
      const day = new Date(now);
      day.setDate(now.getDate() + mondayOffset - weekOffset + d);
      const str = day.toISOString().slice(0, 10);
      return { completed: activeDaysSet.has(str), isToday: str === todayStr };
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // ── Parallel queries ──────────────────────────────────────────────
  const [
    allLogs,
    activeInstance,
    latestRecovery,
    subscription,
    declaredEquipment,
  ] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId },
      select: {
        instanceId: true,
        sessionNumber: true,
        completedAt: true,
        actualSets: true,
        weightKg: true,
        actualReps: true,
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.planInstance.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        planId: true,
        currentSession: true,
        level: true,
        plan: {
          select: {
            name: true,
            sessionsPerWeek: true,
            durationWeeks: true,
          },
        },
      },
    }),
    prisma.recoveryLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      select: { recoveryPct: true, loggedAt: true },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    }),
    prisma.userEquipment.findFirst({
      where: { userId, source: "DECLARED" },
      orderBy: { addedAt: "desc" },
      select: { trialExpiresAt: true },
    }),
  ]);

  // ── Unique completed sessions ─────────────────────────────────────
  const uniqueSessions = new Map<string, Date>();
  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (!uniqueSessions.has(key)) uniqueSessions.set(key, log.completedAt);
  }

  // ── Metrics ───────────────────────────────────────────────────────
  const totalWorkouts = uniqueSessions.size;
  const totalSets = allLogs.reduce((sum, l) => sum + (l.actualSets ?? 0), 0);
  const totalMinutes = totalWorkouts * 55;
  const trainedHours =
    totalMinutes >= 60
      ? `${Math.round(totalMinutes / 60)}h`
      : `${totalMinutes}m`;

  // ── Streak ────────────────────────────────────────────────────────
  const activeDaysSet = new Set<string>();
  for (const date of uniqueSessions.values()) {
    activeDaysSet.add(date.toISOString().slice(0, 10));
  }
  const activeDays = Array.from(activeDaysSet).sort();

  let currentStreak = 0;
  const todayStr = now.toISOString().slice(0, 10);
  const cursor = new Date(now);
  while (true) {
    const dayStr = cursor.toISOString().slice(0, 10);
    if (activeDaysSet.has(dayStr)) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (dayStr === todayStr) {
      cursor.setDate(cursor.getDate() - 1);
      if (!activeDaysSet.has(cursor.toISOString().slice(0, 10))) break;
    } else {
      break;
    }
  }

  let bestStreak = 0;
  let runningStreak = 0;
  for (let i = 0; i < activeDays.length; i++) {
    if (i === 0) {
      runningStreak = 1;
    } else {
      const prev = new Date(activeDays[i - 1]);
      const curr = new Date(activeDays[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
      );
      runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
    }
    if (runningStreak > bestStreak) bestStreak = runningStreak;
  }

  // ── Week bars ─────────────────────────────────────────────────────
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  const weekDays = DAY_LABELS.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return {
      day: label,
      worked: activeDaysSet.has(day.toISOString().slice(0, 10)),
      isFuture: day > now,
    };
  });

  // ── Week session counts ───────────────────────────────────────────
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekCompletedCount = Array.from(uniqueSessions.entries()).filter(
    ([, date]) => date >= monday && date <= sunday,
  ).length;
  const weekTotalCount = activeInstance?.plan.sessionsPerWeek ?? 0;
  const weekMinutes = weekCompletedCount * 55;

  // ── Plan progress ─────────────────────────────────────────────────
  let planWeek: number | null = null;
  let sessionsLeft: number | null = null;
  let planName: string | null = null;
  let planTotalSessions: number | null = null;

  if (activeInstance) {
    planName = activeInstance.plan.name;
    planTotalSessions =
      activeInstance.plan.durationWeeks * activeInstance.plan.sessionsPerWeek;
    const completedSessionsInPlan = Array.from(uniqueSessions.keys()).filter(
      (key) => key.startsWith(activeInstance.id),
    ).length;
    planWeek = Math.ceil(
      (completedSessionsInPlan + 1) / activeInstance.plan.sessionsPerWeek,
    );
    sessionsLeft = Math.max(0, planTotalSessions - completedSessionsInPlan);
  }

  // ── Week workout list ─────────────────────────────────────────────
  let weekWorkouts: { name: string; progress: number }[] = [];

  if (activeInstance) {
    const completedCount = Array.from(uniqueSessions.keys()).filter((key) =>
      key.startsWith(activeInstance.id),
    ).length;
    const spw = activeInstance.plan.sessionsPerWeek;
    const weekStart = Math.floor(completedCount / spw) * spw + 1;
    const weekEnd = weekStart + spw - 1;

    const plannedSessions = await prisma.plannedSession.findMany({
      where: {
        planId: activeInstance.planId,
        sessionNumber: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { sessionNumber: "asc" },
      select: { sessionNumber: true, focus: true },
    });

    weekWorkouts = plannedSessions.map((ps) => {
      const sessionKey = `${activeInstance.id}-${ps.sessionNumber}`;
      const isCompleted = uniqueSessions.has(sessionKey);
      const hasPartial = allLogs.some(
        (l) =>
          l.instanceId === activeInstance.id &&
          l.sessionNumber === ps.sessionNumber,
      );
      return {
        name: ps.focus,
        progress: isCompleted ? 100 : hasPartial ? 50 : 0,
      };
    });
  }

  // ── Today's session details ───────────────────────────────────────
  let todaySession: { focus: string; estimatedMinutes: number } | null = null;

  if (activeInstance) {
    todaySession = await prisma.plannedSession.findUnique({
      where: {
        planId_sessionNumber: {
          planId: activeInstance.planId,
          sessionNumber: activeInstance.currentSession,
        },
      },
      select: { focus: true, estimatedMinutes: true },
    });
  }

  // ── Recent activity ───────────────────────────────────────────────
  let recentActivity: {
    planName: string;
    sessionLabel: string;
    durationMin: number;
  } | null = null;

  if (allLogs.length > 0 && activeInstance) {
    const lastLog = allLogs[0]; // already sorted desc
    const lastSession = await prisma.plannedSession.findFirst({
      where: {
        planId: activeInstance.planId,
        sessionNumber: lastLog.sessionNumber,
      },
      select: { focus: true, estimatedMinutes: true },
    });
    if (lastSession) {
      recentActivity = {
        planName: activeInstance.plan.name,
        sessionLabel: lastSession.focus,
        durationMin: lastSession.estimatedMinutes,
      };
    }
  }

  // ── Next session URL ──────────────────────────────────────────────
  const nextSessionUrl =
    activeInstance && sessionsLeft && sessionsLeft > 0
      ? `/workout/${activeInstance.id}/${activeInstance.currentSession}`
      : null;

  // ── Streak dot grid ───────────────────────────────────────────────
  const streakWeeks = buildStreakWeeks(activeDaysSet, now);

  // ── Access tier ───────────────────────────────────────────────────
  const subPlan = subscription?.plan ?? "FREE";
  const accessTier =
    subPlan === "PRO" ? "pro" : subPlan === "EQUIPMENT" ? "equipment" : "free";

  // ── Equipment trial ───────────────────────────────────────────────
  const trialExpiresAt = declaredEquipment?.trialExpiresAt ?? null;
  const equipmentTrial = trialExpiresAt
    ? {
        daysRemaining: Math.max(
          0,
          Math.ceil((trialExpiresAt.getTime() - now.getTime()) / 86400000),
        ),
        isExpired: trialExpiresAt < now,
      }
    : null;

  // ── Recovery ──────────────────────────────────────────────────────
  const recoveryPct = latestRecovery?.recoveryPct ?? null;

  return NextResponse.json({
    // Existing fields
    totalWorkouts,
    trainedHours,
    totalSets,
    currentStreak,
    bestStreak,
    weekDays,
    planWeek,
    sessionsLeft,
    planName,
    weekCompletedCount,
    weekTotalCount,
    weekWorkouts,
    nextSessionUrl,
    // New fields
    todaySessionNumber: activeInstance?.currentSession ?? null,
    planTotalSessions,
    sessionPhase: todaySession?.focus ?? null,
    sessionDurationMin: todaySession?.estimatedMinutes ?? null,
    trainingLevel: activeInstance?.level ?? null,
    weekMinutes,
    recentActivity,
    recentActivityUrl: "/progress",
    streakWeeks,
    accessTier,
    equipmentTrial,
    recoveryPct,
    recoveryLabel: getRecoveryLabel(recoveryPct),
    recoveryTip: getRecoveryTip(recoveryPct),
  });
}
