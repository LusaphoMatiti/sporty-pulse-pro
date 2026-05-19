// src/lib/identity.ts
// ─────────────────────────────────────────────
// IDENTITY ENGINE
// Assigns and manages user identity based on
// onboarding data, login history, and progression.
// ─────────────────────────────────────────────

import { Identity, UserLevel, PrimaryGoal } from "@/generated/prisma";

// How many weeks before an Operator gets
// promoted to Executive Performance (strength goal only)
const OPERATOR_PROMOTION_WEEKS = 8;

// Gap in days that flags a user as a returnee
// and forces them back to Rebuild
const RETURNEE_GAP_DAYS = 28;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type AssignIdentityInput = {
  experienceLevel: UserLevel | null;
  primaryGoal: PrimaryGoal | null;
  lastLoginAt: Date | null;
  onboardingCompletedAt: Date | null;
};

export type IdentityAssignment = {
  identity: Identity;
  reason: string;
};

// ─────────────────────────────────────────────
// CORE: assignIdentity
// Called at onboarding complete.
// Returns the identity and a human-readable reason
// for logging / debugging.
// ─────────────────────────────────────────────

export function assignIdentity(input: AssignIdentityInput): IdentityAssignment {
  const { experienceLevel, primaryGoal, lastLoginAt, onboardingCompletedAt } =
    input;

  // 1. Returnee check — takes priority over experience level.
  //    If they've been gone 28+ days, restart at Rebuild.
  if (lastLoginAt && onboardingCompletedAt) {
    const isReturnee = getReturneeGap(lastLoginAt) >= RETURNEE_GAP_DAYS;
    if (isReturnee) {
      return {
        identity: Identity.REBUILD,
        reason: `Returnee — last login was ${getReturneeGap(lastLoginAt)} days ago`,
      };
    }
  }

  // 2. Beginner — always Rebuild regardless of goal
  if (!experienceLevel || experienceLevel === UserLevel.BEGINNER) {
    return {
      identity: Identity.REBUILD,
      reason: "Beginner experience level",
    };
  }

  // 3. Advanced — always Executive Performance
  if (experienceLevel === UserLevel.ADVANCED) {
    return {
      identity: Identity.EXECUTIVE_PERFORMANCE,
      reason: "Advanced experience level",
    };
  }

  // 4. Intermediate — Operator baseline
  //    (may promote to Exec Perf after 8 weeks on strength goal)
  return {
    identity: Identity.OPERATOR,
    reason: `Intermediate level — goal: ${primaryGoal ?? "not set"}`,
  };
}

// ─────────────────────────────────────────────
// UTILITY: getReturneeGap
// Returns how many days since the user last logged in.
// Used to detect returnees who need a Rebuild ramp.
// ─────────────────────────────────────────────

export function getReturneeGap(lastLoginAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastLoginAt).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────
// PROMOTION CHECK: shouldPromoteIdentity
// Called after each completed plan week.
// Checks if an Operator on BUILD_MUSCLE goal
// has hit 8 weeks and should become Exec Perf.
// ─────────────────────────────────────────────

export type PromotionCheckInput = {
  currentIdentity: Identity;
  primaryGoal: PrimaryGoal | null;
  progressionWeek: number;
};

export function shouldPromoteIdentity(input: PromotionCheckInput): boolean {
  const { currentIdentity, primaryGoal, progressionWeek } = input;

  return (
    currentIdentity === Identity.OPERATOR &&
    primaryGoal === PrimaryGoal.BUILD_MUSCLE &&
    progressionWeek >= OPERATOR_PROMOTION_WEEKS
  );
}

// ─────────────────────────────────────────────
// LABEL HELPERS
// Used in mobile UI to display identity copy.
// ─────────────────────────────────────────────

export const IDENTITY_LABELS: Record<Identity, string> = {
  [Identity.REBUILD]: "Rebuild",
  [Identity.OPERATOR]: "Operator",
  [Identity.EXECUTIVE_PERFORMANCE]: "Executive Performance",
};

export const IDENTITY_DESCRIPTIONS: Record<Identity, string> = {
  [Identity.REBUILD]:
    "Restore movement, energy, and consistency. Low friction, full body, confidence-building sessions.",
  [Identity.OPERATOR]:
    "Maintain performance and capability. Efficient, structured, measurable sessions built for busy schedules.",
  [Identity.EXECUTIVE_PERFORMANCE]:
    "Elite physical maintenance and progression. Precise, data-driven, demanding but controlled.",
};

export const IDENTITY_KEYWORDS: Record<Identity, string[]> = {
  [Identity.REBUILD]: [
    "Rebuild",
    "Restore",
    "Consistency",
    "Energy",
    "Movement",
  ],
  [Identity.OPERATOR]: [
    "Performance",
    "Control",
    "Efficiency",
    "Capability",
    "Consistency",
  ],
  [Identity.EXECUTIVE_PERFORMANCE]: [
    "Precision",
    "Resilience",
    "Longevity",
    "Progression",
    "Performance",
  ],
};
