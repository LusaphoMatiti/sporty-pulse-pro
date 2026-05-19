// src/lib/progression.ts
// ─────────────────────────────────────────────
// PROGRESSION ENGINE
// Determines progression type, calculates next
// week's sets/reps/rest, and flags deload weeks.
// ─────────────────────────────────────────────

import {
  Identity,
  PrimaryGoal,
  ProgressionType,
  UserLevel,
} from "@/generated/prisma";

// ─────────────────────────────────────────────
// CONFIG
// Centralised progression constants.
// Adjust here — nowhere else.
// ─────────────────────────────────────────────

const PROGRESSION_CONFIG = {
  // Volume progression — sets increase per phase
  volume: {
    baseWeekSets: 2,
    phase2Sets: 3, // weeks 3–4
    phase3Sets: 4, // weeks 5–6
    baseReps: 10,
    phase3Reps: 12, // reps increase when sets plateau
    phaseLength: 2, // weeks per phase
  },

  // Load progression — rep target before adding weight
  load: {
    repTargetToProgress: 10, // complete 3×10 → increase load
    baseSets: 3,
    advancedSets: 4,
    baseReps: 8,
    advancedReps: 6,
  },

  // Density progression — reduce rest each phase
  density: {
    baseRestSeconds: 90,
    phase2RestReduction: 10, // -10s at week 2
    phase4RestReduction: 10, // -10s at week 4
    minimumRestSeconds: 30, // never go below this
    phaseLength: 2,
  },

  // Deload thresholds by identity
  deload: {
    REBUILD: null, // no deload needed in first 4 weeks
    OPERATOR: 8, // deload every 8 weeks
    EXECUTIVE_PERFORMANCE: 6, // deload every 6 weeks
  },
} as const;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type GetProgressionTypeInput = {
  identity: Identity;
  goal: PrimaryGoal | null;
  trainingLocation: string | null;
};

export type PlanInstanceProgressionState = {
  progressionType: ProgressionType | null;
  progressionWeek: number | null;
  currentSets: number | null;
  currentReps: number | null;
  currentRestSeconds: number | null;
  level: UserLevel;
  identity: Identity | null;
};

export type NextWeekProgression = {
  progressionWeek: number;
  currentSets: number;
  currentReps: number;
  currentRestSeconds: number;
  progressionNote: string; // human-readable, shown in mobile UI
};

// ─────────────────────────────────────────────
// CORE: getProgressionType
// Determines which of the 3 progression types
// to assign when a PlanInstance is created.
// ─────────────────────────────────────────────

export function getProgressionType(
  input: GetProgressionTypeInput,
): ProgressionType {
  const { identity, goal } = input;

  // Density — Operator on fat loss (efficiency is the metric)
  if (identity === Identity.OPERATOR && goal === PrimaryGoal.LOSE_WEIGHT) {
    return ProgressionType.DENSITY;
  }

  // Load — strength-focused at Operator or Exec Perf
  if (
    goal === PrimaryGoal.BUILD_MUSCLE &&
    (identity === Identity.OPERATOR ||
      identity === Identity.EXECUTIVE_PERFORMANCE)
  ) {
    return ProgressionType.LOAD;
  }

  // Volume — default for Rebuild and general fitness
  return ProgressionType.VOLUME;
}

// ─────────────────────────────────────────────
// CORE: getInitialProgressionState
// Called when a PlanInstance is created.
// Sets the starting values based on level + type.
// ─────────────────────────────────────────────

export function getInitialProgressionState(
  progressionType: ProgressionType,
  level: UserLevel,
): Omit<NextWeekProgression, "progressionNote"> {
  const isAdvanced = level === UserLevel.ADVANCED;

  switch (progressionType) {
    case ProgressionType.VOLUME:
      return {
        progressionWeek: 1,
        currentSets: PROGRESSION_CONFIG.volume.baseWeekSets,
        currentReps: PROGRESSION_CONFIG.volume.baseReps,
        currentRestSeconds: level === UserLevel.BEGINNER ? 90 : 60,
      };

    case ProgressionType.LOAD:
      return {
        progressionWeek: 1,
        currentSets: isAdvanced
          ? PROGRESSION_CONFIG.load.advancedSets
          : PROGRESSION_CONFIG.load.baseSets,
        currentReps: isAdvanced
          ? PROGRESSION_CONFIG.load.advancedReps
          : PROGRESSION_CONFIG.load.baseReps,
        currentRestSeconds: isAdvanced ? 90 : 60,
      };

    case ProgressionType.DENSITY:
      return {
        progressionWeek: 1,
        currentSets: 3,
        currentReps: 12,
        currentRestSeconds: PROGRESSION_CONFIG.density.baseRestSeconds,
      };
  }
}

// ─────────────────────────────────────────────
// CORE: calculateNextWeek
// Called after each completed session.
// Returns updated progression values for the
// PlanInstance — write these back to the DB.
// ─────────────────────────────────────────────

export function calculateNextWeek(
  instance: PlanInstanceProgressionState,
): NextWeekProgression {
  const {
    progressionType,
    progressionWeek,
    currentSets,
    currentReps,
    currentRestSeconds,
    level,
  } = instance;

  const week = progressionWeek ?? 1;
  const sets = currentSets ?? 2;
  const reps = currentReps ?? 10;
  const rest = currentRestSeconds ?? 90;

  switch (progressionType) {
    case ProgressionType.VOLUME:
      return calculateVolumeProgression(week, sets, reps, rest);

    case ProgressionType.LOAD:
      return calculateLoadProgression(week, sets, reps, rest, level);

    case ProgressionType.DENSITY:
      return calculateDensityProgression(week, sets, reps, rest);

    default:
      // No progression type set — return unchanged
      return {
        progressionWeek: week + 1,
        currentSets: sets,
        currentReps: reps,
        currentRestSeconds: rest,
        progressionNote: "Maintaining current level",
      };
  }
}

// ─────────────────────────────────────────────
// VOLUME PROGRESSION
// Week 1–2: 2 sets
// Week 3–4: 3 sets
// Week 5–6: 4 sets + increase reps
// ─────────────────────────────────────────────

function calculateVolumeProgression(
  week: number,
  sets: number,
  reps: number,
  rest: number,
): NextWeekProgression {
  const nextWeek = week + 1;
  const { phaseLength } = PROGRESSION_CONFIG.volume;

  // Phase 2: week 3–4 → 3 sets
  if (week === phaseLength) {
    return {
      progressionWeek: nextWeek,
      currentSets: PROGRESSION_CONFIG.volume.phase2Sets,
      currentReps: reps,
      currentRestSeconds: rest,
      progressionNote: `Week ${nextWeek} — Volume phase 2: adding 1 set`,
    };
  }

  // Phase 3: week 5–6 → 4 sets + reps increase
  if (week === phaseLength * 2) {
    return {
      progressionWeek: nextWeek,
      currentSets: PROGRESSION_CONFIG.volume.phase3Sets,
      currentReps: PROGRESSION_CONFIG.volume.phase3Reps,
      currentRestSeconds: rest,
      progressionNote: `Week ${nextWeek} — Volume phase 3: adding set + reps`,
    };
  }

  // Week 7+ — hold and prepare for load increase
  if (week >= phaseLength * 3) {
    return {
      progressionWeek: nextWeek,
      currentSets: sets,
      currentReps: reps,
      currentRestSeconds: Math.max(rest - 10, 45),
      progressionNote: `Week ${nextWeek} — Consolidation: reducing rest by 10s`,
    };
  }

  return {
    progressionWeek: nextWeek,
    currentSets: sets,
    currentReps: reps,
    currentRestSeconds: rest,
    progressionNote: `Week ${nextWeek} — Maintaining volume`,
  };
}

// ─────────────────────────────────────────────
// LOAD PROGRESSION
// Complete 3×10 → flag to increase weight
// Sets stay constant, reps are the signal
// ─────────────────────────────────────────────

function calculateLoadProgression(
  week: number,
  sets: number,
  reps: number,
  rest: number,
  level: UserLevel,
): NextWeekProgression {
  const nextWeek = week + 1;
  const targetReps = PROGRESSION_CONFIG.load.repTargetToProgress;

  // At rep target → signal to increase load, reset reps slightly
  if (reps >= targetReps) {
    const newReps = level === UserLevel.ADVANCED ? 6 : 8;
    return {
      progressionWeek: nextWeek,
      currentSets: sets,
      currentReps: newReps,
      currentRestSeconds: rest,
      progressionNote: `Week ${nextWeek} — Increase load this session. Reps reset to ${newReps}.`,
    };
  }

  // Still building toward rep target — add 1 rep
  return {
    progressionWeek: nextWeek,
    currentSets: sets,
    currentReps: reps + 1,
    currentRestSeconds: rest,
    progressionNote: `Week ${nextWeek} — Building to ${targetReps} reps (${reps + 1}/${targetReps})`,
  };
}

// ─────────────────────────────────────────────
// DENSITY PROGRESSION
// Week 1–2: 90s rest
// Week 3–4: 80s rest
// Week 5–6: 70s rest
// Never below 30s
// ─────────────────────────────────────────────

function calculateDensityProgression(
  week: number,
  sets: number,
  reps: number,
  rest: number,
): NextWeekProgression {
  const nextWeek = week + 1;
  const { phaseLength, phase2RestReduction, minimumRestSeconds } =
    PROGRESSION_CONFIG.density;

  // Every phase boundary — reduce rest
  if (week % phaseLength === 0) {
    const newRest = Math.max(rest - phase2RestReduction, minimumRestSeconds);
    const reduced = rest - newRest;

    return {
      progressionWeek: nextWeek,
      currentSets: sets,
      currentReps: reps,
      currentRestSeconds: newRest,
      progressionNote:
        newRest === minimumRestSeconds
          ? `Week ${nextWeek} — Minimum rest reached. Same work, maximum efficiency.`
          : `Week ${nextWeek} — Density phase: rest reduced by ${reduced}s`,
    };
  }

  return {
    progressionWeek: nextWeek,
    currentSets: sets,
    currentReps: reps,
    currentRestSeconds: rest,
    progressionNote: `Week ${nextWeek} — Maintaining density`,
  };
}

// ─────────────────────────────────────────────
// DELOAD CHECK
// Called after session complete.
// Returns true if this week should be a deload.
// ─────────────────────────────────────────────

export function checkDeloadRequired(
  identity: Identity | null,
  progressionWeek: number | null,
): boolean {
  if (!identity || !progressionWeek) return false;

  const threshold = PROGRESSION_CONFIG.deload[identity];

  // Rebuild has no deload
  if (threshold === null) return false;

  return progressionWeek % threshold === 0;
}
