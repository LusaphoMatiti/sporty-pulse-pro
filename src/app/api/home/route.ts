/**
 * GET /api/home
 *
 * Returns HomeData for the Expo mobile app.
 *
 * This is the ONLY new file needed in your Next.js project.
 * It extracts the data-fetching logic from src/app/page.tsx
 * and exposes it as a JSON API endpoint.
 *
 * Add this file to your Next.js project at:
 *   src/app/api/home/route.ts
 *
 * The Expo app calls: api.get<HomeData>('/api/home')
 */

import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  console.log("[api/home] session:", JSON.stringify(session));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // ── All workout logs ─────────────────────────────────────────────
  const allLogs = await prisma.workoutLog.findMany({
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
  });

  // ── Active instance ──────────────────────────────────────────────
  const activeInstance = await prisma.planInstance.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { startedAt: "desc" },
  });

  // ── Unique completed sessions ────────────────────────────────────
  const uniqueSessions = new Map<string, Date>();
  for (const log of allLogs) {
    const key = `${log.instanceId}-${log.sessionNumber}`;
    if (!uniqueSessions.has(key)) uniqueSessions.set(key, log.completedAt);
  }

  // ── Metrics ──────────────────────────────────────────────────────
  const totalWorkouts = uniqueSessions.size;
  const totalSets = allLogs.reduce((sum, l) => sum + (l.actualSets ?? 0), 0);
  const totalMinutes = totalWorkouts * 55;
  const trainedHours =
    totalMinutes >= 60
      ? `${Math.round(totalMinutes / 60)}h`
      : `${totalMinutes}m`;

  // ── Streak ───────────────────────────────────────────────────────
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
      const yesterdayStr = cursor.toISOString().slice(0, 10);
      if (!activeDaysSet.has(yesterdayStr)) break;
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
    const dayStr = day.toISOString().slice(0, 10);
    return {
      day: label,
      worked: activeDaysSet.has(dayStr),
      isFuture: day > now,
    };
  });

  // ── Week session counts ───────────────────────────────────────────
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const thisWeekSessionKeys = new Set<string>();
  for (const [key, date] of uniqueSessions.entries()) {
    if (date >= monday && date <= sunday) thisWeekSessionKeys.add(key);
  }
  const weekCompletedCount = thisWeekSessionKeys.size;
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
    const currentSessionNum = completedSessionsInPlan + 1;
    planWeek = Math.ceil(
      currentSessionNum / activeInstance.plan.sessionsPerWeek,
    );
    sessionsLeft = Math.max(0, totalSessions - completedSessionsInPlan);
  }

  // ── Week workout list ─────────────────────────────────────────────
  let weekWorkouts: { name: string; progress: number }[] = [];

  if (activeInstance) {
    const completedInPlan = Array.from(uniqueSessions.entries())
      .filter(([key]) => key.startsWith(activeInstance.id))
      .map(([key]) => parseInt(key.split("-")[1], 10));

    const completedCount = completedInPlan.length;
    const spw = activeInstance.plan.sessionsPerWeek;
    const weekIndex = Math.floor(completedCount / spw);
    const weekStart = weekIndex * spw + 1;
    const weekEnd = weekStart + spw - 1;

    const plannedSessions = await prisma.plannedSession.findMany({
      where: {
        planId: activeInstance.planId,
        sessionNumber: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { sessionNumber: "asc" },
    });

    weekWorkouts = plannedSessions.map((ps) => {
      const sessionKey = `${activeInstance.id}-${ps.sessionNumber}`;
      const isCompleted = uniqueSessions.has(sessionKey);
      const sessionLogs = allLogs.filter(
        (l) =>
          l.instanceId === activeInstance.id &&
          l.sessionNumber === ps.sessionNumber,
      );
      const progress = isCompleted ? 100 : sessionLogs.length > 0 ? 50 : 0;
      return { name: ps.focus, progress };
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
