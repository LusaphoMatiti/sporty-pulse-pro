/**
 * lib/notifications/dataAdapters.ts
 *
 * These four functions are the ONLY place the notification engine
 * touches your existing domain data. Wire each one up to your real
 * queries — everything downstream (priorityStack, planner, dispatcher)
 * only depends on the shapes returned here, not on your actual schema.
 *
 * Replace the TODO bodies with real Prisma queries against your
 * WorkoutLog / WorkoutPlan / RecoveryLog / User models.
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
  yesterdayMissed: boolean; // true if yesterday had a scheduled session that wasn't completed
};

export async function getCurrentStreakInfo(
  userId: string,
): Promise<StreakInfo> {
  // TODO: replace with your real streak computation.
  // If "Current Streak" is already stored/cached somewhere, just read
  // it here instead of recomputing from WorkoutLog on every call.
  //
  // Rough shape if computing from scratch:
  //   const logs = await prisma.workoutLog.findMany({
  //     where: { userId, completedAt: { not: null } },
  //     orderBy: { completedAt: "desc" },
  //     take: 30,
  //   });
  //   // walk backward from today counting consecutive completed days,
  //   // and separately check whether yesterday's scheduled day was missed

  throw new Error(
    "getCurrentStreakInfo: wire this up to your real streak data",
  );
}

export async function getTodaysSessionStatus(
  userId: string,
): Promise<TodaysSessionStatus> {
  // TODO: look up the user's active WorkoutPlan instance, find today's
  // dayOfWeek session, and check whether a WorkoutLog exists for it.
  throw new Error(
    "getTodaysSessionStatus: wire this up to your real session data",
  );
}

export async function getRecoveryStatus(
  userId: string,
): Promise<RecoveryStatus> {
  // TODO: query today's recovery entry (whatever model backs
  // "Recovery Status" today).
  throw new Error("getRecoveryStatus: wire this up to your real recovery data");
}

export async function getIdentityTier(
  userId: string,
): Promise<"REBUILD" | "OPERATOR" | "EXECUTIVE"> {
  // TODO: read from wherever you currently store the user's tier.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // @ts-expect-error — adjust field name to match your actual schema
  return user.identityTier ?? "REBUILD";
}
