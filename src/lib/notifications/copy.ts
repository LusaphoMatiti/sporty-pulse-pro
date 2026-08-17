/**
 * lib/notifications/copy.ts
 *
 * Single source of truth for notification copy. Identity tier changes
 * the SENTENCE, not the TRIGGER — this is what stops "Identity
 * notification" from becoming a 6th competing category, and makes
 * future copy edits a one-file change instead of a code hunt.
 */

import { NotificationType, IdentityTier } from "@/generated/prisma";
// Prisma v7 generates the client into src/generated/prisma (per your
// schema.prisma's `output` path) rather than node_modules/@prisma/client.
// If the "@/*" alias in your tsconfig doesn't map to "./src/*", use a
// relative import instead: "../../generated/prisma"

type CopyEntry = { title: string; body: string };
type TierCopy = Record<IdentityTier, CopyEntry>;

export const COPY: Record<
  Exclude<NotificationType, "MILESTONE" | "RECOVERY_READY">,
  TierCopy
> = {
  DAILY_HABIT: {
    REBUILD: {
      title: "Today's session is ready",
      body: "Show up. That's the win.",
    },
    OPERATOR: {
      title: "Session ready",
      body: "Maintain control. Today's session is waiting.",
    },
    EXECUTIVE: {
      title: "Today's session",
      body: "High performers don't negotiate with the schedule.",
    },
  },
  STREAK_SAVER: {
    REBUILD: {
      title: "Don't lose the streak",
      body: "10 minutes. That's all it takes to keep it going.",
    },
    OPERATOR: {
      title: "Protect the streak",
      body: "You built this. Close today out.",
    },
    EXECUTIVE: {
      title: "Streak at risk",
      body: "Discipline is the streak. Finish today.",
    },
  },
  RECOVERY_NUDGE: {
    REBUILD: {
      title: "Recovery day",
      body: "Take today's recovery session instead. Still counts.",
    },
    OPERATOR: {
      title: "Recovery recommended",
      body: "Load's high. Recovery session keeps you on track.",
    },
    EXECUTIVE: {
      title: "Recovery",
      body: "Managing load is part of the job. Recovery session today.",
    },
  },
  RESCHEDULE_SUGGESTION: {
    REBUILD: {
      title: "Move today's session",
      body: "Missed Monday? Pick it up here instead.",
    },
    OPERATOR: {
      title: "Schedule shift",
      body: "Monday's session moves to today. No penalty, just the next step.",
    },
    EXECUTIVE: {
      title: "Reschedule",
      body: "Adjust and execute. Today covers Monday.",
    },
  },
};

// Recovery-ready is state-dependent (good vs low) rather than purely
// tier-dependent, so it's a small function instead of a static table.
export function recoveryReadyCopy(
  tier: IdentityTier,
  recoveryGood: boolean,
): CopyEntry {
  if (recoveryGood) {
    return {
      title: "Recovery looks good",
      body:
        tier === "EXECUTIVE"
          ? "Numbers are clear. Push today."
          : tier === "OPERATOR"
            ? "You're clear. Push today."
            : "Recovery looks good. Push today.",
    };
  }
  return {
    title: "Recovery is low",
    body: "Take today's recovery session instead.",
  };
}

export function milestoneCopy(milestoneKey: string): CopyEntry {
  // Milestones stay tier-neutral — the achievement is the message.
  const map: Record<string, CopyEntry> = {
    "10_WORKOUTS": {
      title: "10 workouts down",
      body: "You're building consistency.",
    },
    FIRST_WEEK: {
      title: "First full week complete",
      body: "That's the hardest week done.",
    },
    "30_DAY_STREAK": {
      title: "30 day streak",
      body: "This is who you are now.",
    },
  };
  return (
    map[milestoneKey] ?? { title: "Milestone reached", body: "Keep going." }
  );
}
