// src/lib/templateMatcher.ts
// ─────────────────────────────────────────────
// TEMPLATE MATCHER
// Core routing function — maps identity + goal +
// environment + level to a WorkoutPlan templateType.
// Everything flows through this.
// ─────────────────────────────────────────────

import {
  Identity,
  PrimaryGoal,
  TrainingLocation,
  TemplateType,
  EnvironmentTarget,
  ProgressionType,
  UserLevel,
} from "@/generated/prisma";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type MatchTemplateInput = {
  identity: Identity;
  goal: PrimaryGoal | null;
  trainingLocation: TrainingLocation | null;
  hasEquipment: boolean; // true if user has any UserEquipment rows
  level: UserLevel; // required — needed to pick BEGINNER/INTERMEDIATE/ADVANCED
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
  const { identity, goal, trainingLocation, hasEquipment, level } = input;

  const env = resolveEnvironment(trainingLocation, hasEquipment);
  const isGym = env === EnvironmentTarget.GYM;

  // ── REBUILD ──────────────────────────────────
  // Rebuild users always land on the recovery/functional path regardless of goal.
  if (identity === Identity.REBUILD) {
    // Only FUNCTIONAL_HOME_RECOVERY exists as a special case; use FUNCTIONAL_HOME_BEGINNER
    // for gym context since recovery template is home-only.
    const templateType =
      env === EnvironmentTarget.GYM
        ? TemplateType.FUNCTIONAL_HOME_BEGINNER
        : TemplateType.FUNCTIONAL_HOME_RECOVERY;

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
      const templateType = isGym
        ? resolveFatLossGym(level)
        : resolveFatLossHome(level);
      return {
        templateType,
        environmentTarget: env,
        progressionType: ProgressionType.DENSITY,
        sessionDurationRange: { min: 35, max: 45 },
        reason: "Operator — fat loss goal → fat loss circuit",
      };
    }

    if (goal === PrimaryGoal.BUILD_MUSCLE) {
      const templateType = isGym
        ? resolveMuscleGym(level)
        : resolveMuscleHome(level);
      return {
        templateType,
        environmentTarget: env,
        progressionType: ProgressionType.LOAD,
        sessionDurationRange: { min: 45, max: 60 },
        reason: "Operator — build muscle goal → muscle program",
      };
    }

    // GET_FIT (or no goal set)
    const templateType = isGym
      ? resolveFunctionalGym(level)
      : resolveFunctionalHome(level);
    return {
      templateType,
      environmentTarget: env,
      progressionType: ProgressionType.VOLUME,
      sessionDurationRange: { min: 40, max: 55 },
      reason: "Operator — get fit / home strength → functional program",
    };
  }

  // ── EXECUTIVE PERFORMANCE ────────────────────
  if (identity === Identity.EXECUTIVE_PERFORMANCE) {
    if (goal === PrimaryGoal.BUILD_MUSCLE) {
      const templateType = isGym
        ? resolveMuscleGym(level)
        : resolveMuscleHome(level);
      return {
        templateType,
        environmentTarget: env,
        progressionType: ProgressionType.LOAD,
        sessionDurationRange: { min: 55, max: 75 },
        reason: "Exec Perf — build muscle → muscle program",
      };
    }

    if (goal === PrimaryGoal.LOSE_WEIGHT) {
      const templateType = isGym
        ? resolveFatLossGym(level)
        : resolveFatLossHome(level);
      return {
        templateType,
        environmentTarget: env,
        progressionType: ProgressionType.DENSITY,
        sessionDurationRange: { min: 50, max: 65 },
        reason: "Exec Perf — fat loss → fat loss program",
      };
    }

    // GET_FIT or any remaining
    const templateType = isGym
      ? resolveFunctionalGym(level)
      : resolveFunctionalHome(level);

    // Exec Perf + GET_FIT at advanced level → CrossFit variant
    if (isGym && level === UserLevel.ADVANCED) {
      return {
        templateType: TemplateType.CROSSFIT_GYM_ADVANCED,
        environmentTarget: EnvironmentTarget.GYM,
        progressionType: ProgressionType.DENSITY,
        sessionDurationRange: { min: 55, max: 70 },
        reason: "Exec Perf — advanced get fit + gym → CrossFit",
      };
    }

    return {
      templateType,
      environmentTarget: env,
      progressionType: ProgressionType.VOLUME,
      sessionDurationRange: { min: 50, max: 65 },
      reason: "Exec Perf — get fit → functional conditioning",
    };
  }

  // Fallback — should never hit but keeps TS happy
  return {
    templateType: TemplateType.FUNCTIONAL_HOME_BEGINNER,
    environmentTarget: EnvironmentTarget.ANY,
    progressionType: ProgressionType.VOLUME,
    sessionDurationRange: { min: 25, max: 35 },
    reason: "Fallback — no identity match",
  };
}

// ─────────────────────────────────────────────
// LEVEL RESOLVERS
// Pick the right template based on UserLevel.
// ─────────────────────────────────────────────

function resolveFatLossHome(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED) return TemplateType.FAT_LOSS_HOME_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.FAT_LOSS_HOME_INTERMEDIATE;
  return TemplateType.FAT_LOSS_HOME_BEGINNER;
}

function resolveFatLossGym(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED) return TemplateType.FAT_LOSS_GYM_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.FAT_LOSS_GYM_INTERMEDIATE;
  return TemplateType.FAT_LOSS_GYM_BEGINNER;
}

function resolveMuscleHome(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED) return TemplateType.MUSCLE_HOME_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.MUSCLE_HOME_INTERMEDIATE;
  return TemplateType.MUSCLE_HOME_BEGINNER;
}

function resolveMuscleGym(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED) return TemplateType.MUSCLE_GYM_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.MUSCLE_GYM_INTERMEDIATE;
  return TemplateType.MUSCLE_GYM_BEGINNER;
}

function resolveFunctionalHome(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED)
    return TemplateType.FUNCTIONAL_HOME_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.FUNCTIONAL_HOME_INTERMEDIATE;
  return TemplateType.FUNCTIONAL_HOME_BEGINNER;
}

function resolveFunctionalGym(level: UserLevel): TemplateType {
  if (level === UserLevel.ADVANCED) return TemplateType.FUNCTIONAL_GYM_ADVANCED;
  if (level === UserLevel.INTERMEDIATE)
    return TemplateType.FUNCTIONAL_GYM_INTERMEDIATE;
  return TemplateType.FUNCTIONAL_GYM_BEGINNER;
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
  [TemplateType.FAT_LOSS_HOME_BEGINNER]: "Fat Burner – Home Beginner",
  [TemplateType.FAT_LOSS_HOME_INTERMEDIATE]: "Fat Burner – Home Intermediate",
  [TemplateType.FAT_LOSS_HOME_ADVANCED]: "Fat Burner – Home Advanced",
  [TemplateType.FAT_LOSS_GYM_BEGINNER]: "Fat Burner – Gym Beginner",
  [TemplateType.FAT_LOSS_GYM_INTERMEDIATE]: "Fat Burner – Gym Intermediate",
  [TemplateType.FAT_LOSS_GYM_ADVANCED]: "Fat Burner – Gym Advanced",
  [TemplateType.MUSCLE_HOME_BEGINNER]: "Muscle Builder – Home Beginner",
  [TemplateType.MUSCLE_HOME_INTERMEDIATE]: "Muscle Builder – Home Intermediate",
  [TemplateType.MUSCLE_HOME_ADVANCED]: "Muscle Builder – Home Advanced",
  [TemplateType.MUSCLE_GYM_BEGINNER]: "Muscle Builder – Gym Beginner",
  [TemplateType.MUSCLE_GYM_INTERMEDIATE]: "Muscle Builder – Gym Intermediate",
  [TemplateType.MUSCLE_GYM_ADVANCED]: "Muscle Builder – Gym Advanced",
  [TemplateType.FUNCTIONAL_HOME_BEGINNER]: "Get Fit – Home Beginner",
  [TemplateType.FUNCTIONAL_HOME_INTERMEDIATE]: "Get Fit – Home Intermediate",
  [TemplateType.FUNCTIONAL_HOME_ADVANCED]: "Get Fit – Home Advanced",
  [TemplateType.FUNCTIONAL_GYM_BEGINNER]: "Get Fit – Gym Beginner",
  [TemplateType.FUNCTIONAL_GYM_INTERMEDIATE]: "Get Fit – Gym Intermediate",
  [TemplateType.FUNCTIONAL_GYM_ADVANCED]: "Get Fit – Gym Advanced",
  [TemplateType.CROSSFIT_GYM_ADVANCED]: "CrossFit – Gym Advanced",
  [TemplateType.FUNCTIONAL_HOME_RECOVERY]: "Recovery – Home",
};
