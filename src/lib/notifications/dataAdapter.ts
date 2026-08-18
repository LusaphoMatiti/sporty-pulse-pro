/**
 * lib/notifications/dataAdapters.ts
 *
 * These four functions are the ONLY place the notification engine
 * touches your existing domain data. Everything downstream
 * (priorityStack, planner, dispatcher, milestones) only depends on
 * the shapes returned here.
 */

import { prisma } from "@/lib/prisma";

export type TodaysSessionStatus = {
  hasScheduledSession: boolean;
  completed: boolean;
  scheduledSessionId?: string;
};

export type RecoveryStatus = {
  status: "GOOD" | "MODERATE" | "LOW" | "UNKNOWN";
  updatedToday: boolean;
};

export type StreakInfo = {
  currentStreak: number;
  yesterdayMissed: boolean;
};

// ─── Shared helpers ─────────────────────────────────────────────────────────
// Same local-time trick priorityStack.ts already uses in
// minutesSinceMidnight/atMinutesToday — same DST caveat applies here too.

async function getUserTimezone(userId: string): Promise<string> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return prefs?.timezone ?? "Africa/Johannesburg";
}

function toLocal(d: Date, timezone: string): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: timezone }));
}

function localDayOfWeekMonday0(d: Date, timezone: string): number {
  const local = toLocal(d, timezone);
  return (local.getDay() + 6) % 7; // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun, matches PlannedSession.dayOfWeek
}

function localDateRange(d: Date, timezone: string) {
  const local = toLocal(d, timezone);
  const start = new Date(local);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function localDateKey(d: Date, timezone: string): string {
  const local = toLocal(d, timezone);
  return `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}`;
}

// ─── Today's session ────────────────────────────────────────────────────────

export async function getTodaysSessionStatus(
  userId: string,
): Promise<TodaysSessionStatus> {
  const instance = await prisma.planInstance.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
  if (!instance) return { hasScheduledSession: false, completed: false };

  const timezone = await getUserTimezone(userId);
  const now = new Date();
  const { start, end } = localDateRange(now, timezone);

  const sessions = await prisma.plannedSession.findMany({
    where: { planId: instance.planId },
    select: { id: true, sessionNumber: true, dayOfWeek: true },
  });
  const usesDayOfWeek = sessions.some((s) => s.dayOfWeek !== null);

  if (usesDayOfWeek) {
    const todayDow = localDayOfWeekMonday0(now, timezone);
    const target = sessions.find((s) => s.dayOfWeek === todayDow);
    if (!target) return { hasScheduledSession: false, completed: false }; // rest day

    const log = await prisma.workoutLog.findFirst({
      where: {
        instanceId: instance.id,
        sessionNumber: target.sessionNumber,
        completedAt: { gte: start, lt: end },
      },
      select: { id: true },
    });
    return {
      hasScheduledSession: true,
      completed: !!log,
      scheduledSessionId: target.id,
    };
  }

  // Legacy sequential-fill plans have no fixed weekly schedule — every
  // active day counts as "scheduled." Checked against ANY log on this
  // instance today, not instance.currentSession specifically —
  // currentSession advances the instant a session completes, so
  // matching against it would always look "not completed" for
  // whatever's next, defeating the dispatcher's re-check.
  const log = await prisma.workoutLog.findFirst({
    where: { instanceId: instance.id, completedAt: { gte: start, lt: end } },
    select: { id: true },
  });
  return { hasScheduledSession: true, completed: !!log };
}

// ─── Streak ─────────────────────────────────────────────────────────────────

export async function getCurrentStreakInfo(
  userId: string,
): Promise<StreakInfo> {
  const instance = await prisma.planInstance.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
  if (!instance) return { currentStreak: 0, yesterdayMissed: false };

  const timezone = await getUserTimezone(userId);
  const sessions = await prisma.plannedSession.findMany({
    where: { planId: instance.planId },
    select: { dayOfWeek: true },
  });
  const usesDayOfWeek = sessions.some((s) => s.dayOfWeek !== null);
  const scheduledDows = new Set(
    sessions.map((s) => s.dayOfWeek).filter((d): d is number => d !== null),
  );

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 60);

  // One query for a 60-day window instead of a query-per-day loop.
  const logs = await prisma.workoutLog.findMany({
    where: { userId, completedAt: { gte: windowStart } },
    select: { completedAt: true },
  });
  const completedKeys = new Set(
    logs.map((l) => localDateKey(l.completedAt, timezone)),
  );

  // Walks backward from YESTERDAY — today's completion is handled
  // separately by evaluatePriorityStack's own early return, so it's
  // deliberately excluded here.
  let currentStreak = 0;
  let yesterdayMissed = false;

  for (let daysAgo = 1; daysAgo <= 60; daysAgo++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - daysAgo);
    const dow = localDayOfWeekMonday0(dayDate, timezone);
    const key = localDateKey(dayDate, timezone);

    const wasScheduled = usesDayOfWeek ? scheduledDows.has(dow) : true;
    if (!wasScheduled) continue; // rest day — doesn't break or extend the streak

    if (completedKeys.has(key)) {
      currentStreak++;
    } else {
      if (daysAgo === 1) yesterdayMissed = true;
      break;
    }
  }

  return { currentStreak, yesterdayMissed };
}

// ─── Recovery ───────────────────────────────────────────────────────────────

export async function getRecoveryStatus(
  userId: string,
): Promise<RecoveryStatus> {
  const timezone = await getUserTimezone(userId);
  const { start, end } = localDateRange(new Date(), timezone);

  const log = await prisma.recoveryLog.findFirst({
    where: { userId, loggedAt: { gte: start, lt: end } },
    orderBy: { loggedAt: "desc" },
    select: { recoveryPct: true },
  });
  if (!log) return { status: "UNKNOWN", updatedToday: false };

  // Thresholds are a placeholder — I don't know the real distribution
  // /api/recovery/log's recoveryPct produces. Tune these once you've
  // seen real values; wrong thresholds here mean RECOVERY_READY /
  // RECOVERY_NUDGE fire at the wrong recoveryPct cutoffs.
  const status: RecoveryStatus["status"] =
    log.recoveryPct >= 70 ? "GOOD" : log.recoveryPct >= 40 ? "MODERATE" : "LOW";

  return { status, updatedToday: true };
}

// ─── Identity tier ──────────────────────────────────────────────────────────

export async function getIdentityTier(
  userId: string,
): Promise<"REBUILD" | "OPERATOR" | "EXECUTIVE"> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { identity: true },
  });

  switch (user.identity) {
    case "OPERATOR":
      return "OPERATOR";
    case "EXECUTIVE_PERFORMANCE":
      return "EXECUTIVE";
    case "REBUILD":
    default:
      return "REBUILD";
  }
}
