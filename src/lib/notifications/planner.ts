/**
 * lib/notifications/planner.ts
 *
 * Runs once per day per user (see
 * app/api/cron/notifications/plan/route.ts). Builds a snapshot from
 * real data, runs it through the priority stack, and writes AT MOST
 * ONE ScheduledNotification row for today.
 *
 * Frequency-capping lives here: if a row already exists for this
 * user for today, the planner skips them — no exceptions, no
 * second pass later in the day.
 */

import { prisma } from "@/lib/prisma";
import { evaluatePriorityStack, UserSnapshot } from "./priorityStack";
import {
  getCurrentStreakInfo,
  getTodaysSessionStatus,
  getRecoveryStatus,
  getIdentityTier,
} from "./dataAdapter";

function startOfDayUTCRange(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function planForUser(userId: string, now: Date = new Date()) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs || !prefs.notificationsEnabled || !prefs.pushToken) return null;

  const { start, end } = startOfDayUTCRange(now);
  const alreadyPlanned = await prisma.scheduledNotification.findFirst({
    where: { userId, createdAt: { gte: start, lt: end } },
  });
  if (alreadyPlanned) return null; // one decision per user per day

  const [streakInfo, sessionStatus, recovery, tier] = await Promise.all([
    getCurrentStreakInfo(userId),
    getTodaysSessionStatus(userId),
    getRecoveryStatus(userId),
    getIdentityTier(userId),
  ]);

  const snapshot: UserSnapshot = {
    userId,
    tier,
    timezone: prefs.timezone,
    bedtimeLocal: prefs.bedtimeLocal,
    avgSessionStartMinutes: prefs.avgSessionStartMinutes,
    lastAppOpenAt: prefs.lastAppOpenAt,
    currentStreak: streakInfo.currentStreak,
    yesterdayMissed: streakInfo.yesterdayMissed,
    hasScheduledSession: sessionStatus.hasScheduledSession,
    sessionCompleted: sessionStatus.completed,
    recoveryStatus: recovery.status,
    recoveryUpdatedToday: recovery.updatedToday,
    now,
  };

  const candidate = evaluatePriorityStack(snapshot);
  if (!candidate) return null;

  return prisma.scheduledNotification.create({
    data: {
      userId,
      type: candidate.type,
      tier,
      title: candidate.title,
      body: candidate.body,
      scheduledFor: candidate.scheduledFor,
      status: "PENDING",
    },
  });
}

export async function planForAllActiveUsers(now: Date = new Date()) {
  const users = await prisma.notificationPreference.findMany({
    where: { notificationsEnabled: true, pushToken: { not: null } },
    select: { userId: true },
  });

  const results = await Promise.allSettled(
    users.map((u) => planForUser(u.userId, now)),
  );

  return {
    total: users.length,
    planned: results.filter((r) => r.status === "fulfilled" && r.value).length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
