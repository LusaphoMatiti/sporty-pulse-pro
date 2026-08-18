/**
 * lib/notifications/priorityStack.ts
 *
 * Pure decision logic — no I/O. Given a snapshot of a user's state,
 * returns AT MOST ONE notification candidate. This is what stops
 * Streak Saver + Recovery + Daily Habit from stacking on the same
 * evening.
 *
 * Priority order (high -> low):
 *   1. Streak Saver
 *   2. Recovery-driven (ready or nudge)
 *   3. Reschedule suggestion (yesterday missed)
 *   4. Daily habit (baseline)
 *
 * Milestones are NOT part of this stack — they fire immediately on
 * the triggering event (see milestones.ts), so they never compete
 * for the one-per-day slot this function guards.
 */

import { NotificationType, IdentityTier } from "@/generated/prisma";
import { COPY, recoveryReadyCopy } from "./copy";

export type UserSnapshot = {
  userId: string;
  tier: IdentityTier;
  timezone: string;
  bedtimeLocal: string; // "HH:mm"
  avgSessionStartMinutes: number | null;
  lastAppOpenAt: Date | null;

  currentStreak: number;
  yesterdayMissed: boolean;

  hasScheduledSession: boolean;
  sessionCompleted: boolean;

  recoveryStatus: "GOOD" | "MODERATE" | "LOW" | "UNKNOWN";
  recoveryUpdatedToday: boolean;

  now: Date; // injected for testability
};

export type NotificationCandidate = {
  type: NotificationType;
  title: string;
  body: string;
  scheduledFor: Date;
};

// Your spec's adaptive example used a 14-day streak. Set low here (3)
// so the saver engages on any real streak, not just month-long ones —
// bump to 14 if you want it reserved for well-established streaks.
const MIN_STREAK_FOR_SAVER = 3;

function minutesSinceMidnight(d: Date, timezone: string): number {
  // Simple local-time read via Intl. Swap for a timezone lib
  // (date-fns-tz / luxon) if you need DST-safe handling later.
  const local = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
  return local.getHours() * 60 + local.getMinutes();
}

function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function atMinutesToday(base: Date, timezone: string, minutes: number): Date {
  const local = new Date(base.toLocaleString("en-US", { timeZone: timezone }));
  local.setHours(0, minutes, 0, 0);
  return local;
}

export function evaluatePriorityStack(
  s: UserSnapshot,
): NotificationCandidate | null {
  // Already trained today — nothing to say.
  if (s.sessionCompleted) return null;

  // Already in the app near their usual training time — don't
  // interrupt someone who's already here.
  if (s.avgSessionStartMinutes != null && s.lastAppOpenAt) {
    const openMinutes = minutesSinceMidnight(s.lastAppOpenAt, s.timezone);
    const withinWindow = Math.abs(openMinutes - s.avgSessionStartMinutes) <= 20;
    const openedRecently =
      s.now.getTime() - s.lastAppOpenAt.getTime() < 30 * 60 * 1000;
    if (withinWindow && openedRecently) return null;
  }

  // 1. STREAK SAVER — protect an active streak, single evening nudge
  if (s.currentStreak >= MIN_STREAK_FOR_SAVER && s.hasScheduledSession) {
    const bedtimeMinutes = parseHHmm(s.bedtimeLocal);
    const sendAtMinutes = bedtimeMinutes - 75; // 60-90 min before bedtime
    const nowMinutes = minutesSinceMidnight(s.now, s.timezone);
    if (nowMinutes >= sendAtMinutes - 15) {
      const scheduledFor = atMinutesToday(s.now, s.timezone, sendAtMinutes);
      const copy = COPY.STREAK_SAVER[s.tier];
      return { type: "STREAK_SAVER", ...copy, scheduledFor };
    }
    // Streak exists but it's not evening yet — fall through, a
    // Daily Habit / Recovery slot earlier in the day can still fire.
  }

  // 2. RECOVERY-DRIVEN — only if recovery data changed today
  if (s.recoveryUpdatedToday && s.hasScheduledSession) {
    if (s.recoveryStatus === "LOW") {
      const copy = COPY.RECOVERY_NUDGE[s.tier];
      return { type: "RECOVERY_NUDGE", ...copy, scheduledFor: s.now };
    }
    if (s.recoveryStatus === "GOOD") {
      const copy = recoveryReadyCopy(s.tier, true);
      return { type: "RECOVERY_READY", ...copy, scheduledFor: s.now };
    }
  }

  // 3. RESCHEDULE — yesterday missed, suggest today instead of shaming
  if (s.yesterdayMissed && s.hasScheduledSession) {
    const copy = COPY.RESCHEDULE_SUGGESTION[s.tier];
    const scheduledFor = atMinutesToday(
      s.now,
      s.timezone,
      s.avgSessionStartMinutes ?? 8 * 60, // default 08:00 if no learned time yet
    );
    return { type: "RESCHEDULE_SUGGESTION", ...copy, scheduledFor };
  }

  // 4. DAILY HABIT — baseline, adaptive time
  if (s.hasScheduledSession) {
    const targetMinutes = s.avgSessionStartMinutes ?? 8 * 60;
    const scheduledFor = atMinutesToday(s.now, s.timezone, targetMinutes);
    const copy = COPY.DAILY_HABIT[s.tier];
    return { type: "DAILY_HABIT", ...copy, scheduledFor };
  }

  return null;
}
