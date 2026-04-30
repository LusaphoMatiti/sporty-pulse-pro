import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // ── Parallel: logs + active instance ─────────────────────────────
  const [allLogs, activeInstance] = await Promise.all([
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
        plan: {
          select: {
            name: true,
            sessionsPerWeek: true,
            durationWeeks: true,
          },
        },
      },
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

  // ── Plan progress ─────────────────────────────────────────────────
  let planWeek: number | null = null;
  let sessionsLeft: number | null = null;
  let planName: string | null = null;

  if (activeInstance) {
    planName = activeInstance.plan.name;
    const totalSessions =
      activeInstance.plan.durationWeeks * activeInstance.plan.sessionsPerWeek;
    const completedSessionsInPlan = Array.from(uniqueSessions.keys()).filter(
      (key) => key.startsWith(activeInstance.id),
    ).length;
    planWeek = Math.ceil(
      (completedSessionsInPlan + 1) / activeInstance.plan.sessionsPerWeek,
    );
    sessionsLeft = Math.max(0, totalSessions - completedSessionsInPlan);
  }

  // ── Week workout list (conditional — depends on activeInstance) ───
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
      // Only need focus — no need to pull full row
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

  // ── Next session URL ──────────────────────────────────────────────
  const nextSessionUrl =
    activeInstance && sessionsLeft && sessionsLeft > 0
      ? `/workout/${activeInstance.id}/${activeInstance.currentSession}`
      : null;

  return NextResponse.json({
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
  });
}
