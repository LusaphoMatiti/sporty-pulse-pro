// src/lib/substitution.ts
// ─────────────────────────────────────────────
// SUBSTITUTION ENGINE
// Resolves a session's exercise list against
// the user's declared equipment. Swaps in
// substitutes where the user can't perform
// the planned exercise.
// ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

// Minimal shape of a PlannedExercise with its
// Exercise and equipment relations included.
export type PlannedExerciseWithRelations = {
  id: string;
  order: number;
  exerciseId: string;
  beginnerSets: number;
  beginnerReps: number;
  intermediateSets: number;
  intermediateReps: number;
  advancedSets: number;
  advancedReps: number;
  restSeconds: number;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    youtubeUrl: string | null;
    musclesWorked: string[];
    muscleGroup: string;
    impactLevel: string;
    isBodyweight: boolean;
    equipment: {
      equipment: {
        id: string;
        name: string;
      };
    }[];
    substitutions: {
      id: string;
      reason: string;
      substituteExercise: {
        id: string;
        name: string;
        description: string | null;
        youtubeUrl: string | null;
        musclesWorked: string[];
        muscleGroup: string;
        impactLevel: string;
        isBodyweight: boolean;
        equipment: {
          equipment: {
            id: string;
            name: string;
          };
        }[];
      };
    }[];
  };
};

export type ResolvedExercise = {
  plannedExerciseId: string;
  order: number;
  exerciseId: string;
  exerciseName: string;
  description: string | null;
  youtubeUrl: string | null;
  musclesWorked: string[];
  muscleGroup: string;
  impactLevel: string;
  isBodyweight: boolean;
  beginnerSets: number;
  beginnerReps: number;
  intermediateSets: number;
  intermediateReps: number;
  advancedSets: number;
  advancedReps: number;
  restSeconds: number;
  wasSubstituted: boolean;
  substitutionReason: string | null;
  originalExerciseName: string | null;
};

// ─────────────────────────────────────────────
// CORE: resolveExercises
// Takes a list of PlannedExercises and a list
// of equipment IDs the user owns.
// Returns exercises with substitutes swapped in
// where the user lacks required equipment.
// ─────────────────────────────────────────────

export function resolveExercises(
  plannedExercises: PlannedExerciseWithRelations[],
  userEquipmentIds: string[],
): ResolvedExercise[] {
  return plannedExercises
    .sort((a, b) => a.order - b.order)
    .map((pe) => {
      const exercise = pe.exercise;

      // Bodyweight exercises — always available, no substitution needed
      if (exercise.isBodyweight || exercise.equipment.length === 0) {
        return buildResolvedExercise(pe, exercise, false, null, null);
      }

      // Check if user has ALL required equipment for this exercise
      const requiredEquipmentIds = exercise.equipment.map(
        (ee) => ee.equipment.id,
      );
      const userHasAllEquipment = requiredEquipmentIds.every((id) =>
        userEquipmentIds.includes(id),
      );

      if (userHasAllEquipment) {
        return buildResolvedExercise(pe, exercise, false, null, null);
      }

      // User is missing equipment — find best substitute
      const substitute = findBestSubstitute(
        exercise.substitutions,
        userEquipmentIds,
      );

      if (substitute) {
        return buildResolvedExercise(
          pe,
          substitute.substituteExercise,
          true,
          substitute.reason,
          exercise.name,
        );
      }

      // No valid substitute found — fall back to the original exercise.
      // This should be rare if the exercise library is seeded correctly.
      // Log a warning so you can patch the substitution table.
      console.warn(
        `[substitution] No valid substitute for "${exercise.name}" ` +
          `(user missing: ${getMissingEquipmentNames(exercise, userEquipmentIds).join(", ")})`,
      );

      return buildResolvedExercise(pe, exercise, false, null, null);
    });
}

// ─────────────────────────────────────────────
// UTILITY: findBestSubstitute
// Picks the first substitution whose equipment
// requirements the user can fully satisfy.
// Prefers bodyweight substitutes when available.
// ─────────────────────────────────────────────

function findBestSubstitute(
  substitutions: PlannedExerciseWithRelations["exercise"]["substitutions"],
  userEquipmentIds: string[],
) {
  if (!substitutions.length) return null;

  // Sort: bodyweight substitutes first
  const sorted = [...substitutions].sort((a, b) => {
    const aIsBodyweight = a.substituteExercise.isBodyweight ? 0 : 1;
    const bIsBodyweight = b.substituteExercise.isBodyweight ? 0 : 1;
    return aIsBodyweight - bIsBodyweight;
  });

  for (const sub of sorted) {
    const subEquipmentIds = sub.substituteExercise.equipment.map(
      (ee) => ee.equipment.id,
    );

    // Bodyweight — always valid
    if (sub.substituteExercise.isBodyweight || subEquipmentIds.length === 0) {
      return sub;
    }

    // Equipment substitute — check user has it
    const userCanDo = subEquipmentIds.every((id) =>
      userEquipmentIds.includes(id),
    );
    if (userCanDo) return sub;
  }

  return null;
}

// ─────────────────────────────────────────────
// UTILITY: getMissingEquipmentNames
// For warning logs — returns names of equipment
// the user is missing for a given exercise.
// ─────────────────────────────────────────────

function getMissingEquipmentNames(
  exercise: PlannedExerciseWithRelations["exercise"],
  userEquipmentIds: string[],
): string[] {
  return exercise.equipment
    .filter((ee) => !userEquipmentIds.includes(ee.equipment.id))
    .map((ee) => ee.equipment.name);
}

// ─────────────────────────────────────────────
// UTILITY: buildResolvedExercise
// Assembles a clean ResolvedExercise object.
// ─────────────────────────────────────────────

function buildResolvedExercise(
  pe: PlannedExerciseWithRelations,
  exercise:
    | PlannedExerciseWithRelations["exercise"]
    | PlannedExerciseWithRelations["exercise"]["substitutions"][0]["substituteExercise"],
  wasSubstituted: boolean,
  substitutionReason: string | null,
  originalExerciseName: string | null,
): ResolvedExercise {
  return {
    plannedExerciseId: pe.id,
    order: pe.order,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    description: exercise.description,
    youtubeUrl: exercise.youtubeUrl,
    musclesWorked: exercise.musclesWorked,
    muscleGroup: exercise.muscleGroup,
    impactLevel: exercise.impactLevel,
    isBodyweight: exercise.isBodyweight,
    beginnerSets: pe.beginnerSets,
    beginnerReps: pe.beginnerReps,
    intermediateSets: pe.intermediateSets,
    intermediateReps: pe.intermediateReps,
    advancedSets: pe.advancedSets,
    advancedReps: pe.advancedReps,
    restSeconds: pe.restSeconds,
    wasSubstituted,
    substitutionReason,
    originalExerciseName,
  };
}

// ─────────────────────────────────────────────
// DB HELPER: getUserEquipmentIds
// Fetches the user's equipment IDs from DB.
// Call this in your API route before resolveExercises.
// ─────────────────────────────────────────────

export async function getUserEquipmentIds(userId: string): Promise<string[]> {
  const userEquipment = await prisma.userEquipment.findMany({
    where: { userId },
    select: { equipmentId: true },
  });

  return userEquipment.map((ue) => ue.equipmentId);
}
