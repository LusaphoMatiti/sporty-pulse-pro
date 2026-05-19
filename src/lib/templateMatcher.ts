// src/lib/templateMatcher.ts
// ─────────────────────────────────────────────
// TEMPLATE MATCHER
// Core routing function — maps identity + goal +
// environment to a WorkoutPlan templateType.
// Everything flows through this.
// ─────────────────────────────────────────────

import {
  Identity,
  PrimaryGoal,
  TrainingLocation,
  TemplateType,
  EnvironmentTarget,
  ProgressionType,
} from "@/generated/prisma";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type MatchTemplateInput = {
  identity: Identity;
  goal: PrimaryGoal | null;
  trainingLocation: TrainingLocation | null;
  hasEquipment: boolean; // true if user has any UserEquipment rows
};

export type TemplateMatch = {
  templateType: TemplateType;
  environmentTarget: EnvironmentTarget;
  progressionType: ProgressionType;
  sessionDurationRange: { min: number; max: number };
  reason: string;
};

// ─────────────────────────────────────────────
// CORE: matchTemplate
// Single source of truth for which program
// template a user should receive.
// ─────────────────────────────────────────────

export function matchTemplate(input: MatchTemplateInput): TemplateMatch {
  const { identity, goal, trainingLocation, hasEquipment } = input;

  const env = resolveEnvironment(trainingLocation, hasEquipment);

  // ── REBUILD ──────────────────────────────────
  if (identity === Identity.REBUILD) {
    const templateType =
      env === EnvironmentTarget.HOME_BODYWEIGHT
        ? TemplateType.FULL_BODY_RESTORE
        : TemplateType.FULL_BODY_RESTORE; // same template, exercises filtered by env

    return {
      templateType,
      environmentTarget: env,
      progressionType: ProgressionType.VOLUME,
      sessionDurationRange: { min: 25, max: 35 },
      reason: "Rebuild identity — restore movement and consistency",
    };
  }

  // ── OPERATOR ─────────────────────────────────
  if (identity === Identity.OPERATOR) {
    if (goal === PrimaryGoal.LOSE_WEIGHT) {
      return {
        templateType: TemplateType.CONDITIONING_CIRCUIT,
        environmentTarget: env,
        progressionType: ProgressionType.DENSITY,
        sessionDurationRange: { min: 35, max: 45 },
        reason: "Operator — fat loss goal → conditioning circuit",
      };
    }

    if (
      goal === PrimaryGoal.BUILD_MUSCLE &&
      trainingLocation === TrainingLocation.GYM
    ) {
      return {
        templateType: TemplateType.PUSH_PULL_LEGS,
        environmentTarget: EnvironmentTarget.GYM,
        progressionType: ProgressionType.LOAD,
        sessionDurationRange: { min: 55, max: 75 },
        reason: "Operator — strength goal + gym → Push/Pull/Legs",
      };
    }

    // BUILD_MUSCLE at home OR GET_FIT any env
    return {
      templateType: TemplateType.FULL_BODY_STRENGTH,
      environmentTarget: env,
      progressionType: ProgressionType.VOLUME,
      sessionDurationRange: { min: 40, max: 55 },
      reason: "Operator — get fit / home strength → full body strength",
    };
  }

  // ── EXECUTIVE PERFORMANCE ────────────────────
  if (identity === Identity.EXECUTIVE_PERFORMANCE) {
    if (
      goal === PrimaryGoal.BUILD_MUSCLE &&
      trainingLocation === TrainingLocation.GYM
    ) {
      return {
        templateType: TemplateType.ADVANCED_PPL,
        environmentTarget: EnvironmentTarget.GYM,
        progressionType: ProgressionType.LOAD,
        sessionDurationRange: { min: 60, max: 80 },
        reason: "Exec Perf — strength + gym → Advanced PPL",
      };
    }

    if (goal === PrimaryGoal.LOSE_WEIGHT) {
      return {
        templateType: TemplateType.STRENGTH_HIIT,
        environmentTarget: env,
        progressionType: ProgressionType.DENSITY,
        sessionDurationRange: { min: 50, max: 65 },
        reason: "Exec Perf — fat loss → Strength + HIIT Hybrid",
      };
    }

    // GET_FIT or any remaining
    return {
      templateType: TemplateType.PERFORMANCE_CONDITIONING,
      environmentTarget: env,
      progressionType: ProgressionType.VOLUME,
      sessionDurationRange: { min: 55, max: 70 },
      reason: "Exec Perf — get fit → Performance Conditioning",
    };
  }

  // Fallback — should never hit but keeps TS happy
  return {
    templateType: TemplateType.FULL_BODY_RESTORE,
    environmentTarget: EnvironmentTarget.ANY,
    progressionType: ProgressionType.VOLUME,
    sessionDurationRange: { min: 25, max: 35 },
    reason: "Fallback — no identity match",
  };
}

// ─────────────────────────────────────────────
// UTILITY: resolveEnvironment
// Converts trainingLocation + hasEquipment
// into an EnvironmentTarget enum value.
// ─────────────────────────────────────────────

export function resolveEnvironment(
  trainingLocation: TrainingLocation | null,
  hasEquipment: boolean,
): EnvironmentTarget {
  if (trainingLocation === TrainingLocation.GYM) {
    return EnvironmentTarget.GYM;
  }

  if (trainingLocation === TrainingLocation.HOME) {
    return hasEquipment
      ? EnvironmentTarget.HOME_EQUIPMENT
      : EnvironmentTarget.HOME_BODYWEIGHT;
  }

  // No location set — safest default
  return EnvironmentTarget.HOME_BODYWEIGHT;
}

// ─────────────────────────────────────────────
// LABEL HELPERS
// Used in API responses and mobile UI.
// ─────────────────────────────────────────────

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  [TemplateType.FULL_BODY_RESTORE]: "Full Body Restore",
  [TemplateType.FULL_BODY_STRENGTH]: "Full Body Strength",
  [TemplateType.CONDITIONING_CIRCUIT]: "Conditioning Circuit",
  [TemplateType.PUSH_PULL_LEGS]: "Push / Pull / Legs",
  [TemplateType.ADVANCED_PPL]: "Advanced PPL",
  [TemplateType.STRENGTH_HIIT]: "Strength + HIIT",
  [TemplateType.PERFORMANCE_CONDITIONING]: "Performance Conditioning",
};
