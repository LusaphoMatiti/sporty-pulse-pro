import { prisma } from "@/lib/prisma";
import {
  EnvironmentTarget,
  PrimaryGoal,
  SexTarget,
  GymTrainingStyle,
  Prisma,
} from "@/generated/prisma";

// ── Caps ─────────────────────────────────────────────────────────────────
// These are NOT activation-history counters. They're a fixed number of
// catalog slots: exactly the first BODYWEIGHT_FREE_CAP bodyweight plans (in
// the existing tier/name order) come back unlocked for every non-Pro user,
// and exactly the first EQUIPMENT_TRIAL_CAP equipment plans tied to a
// declared-equipment trial come back unlocked while that trial is active.
// Whether a plan has ever been activated is irrelevant to this.

export const BODYWEIGHT_FREE_CAP = 4;
export const EQUIPMENT_TRIAL_CAP = 2;

export type LockReason =
  | "trial_expired"
  | "cap_reached"
  | "equipment_required"
  | "upgrade_required";

// ── Personalization filters (environment / goal / level / sex / style) ───

function resolveEnvironmentTargets(
  trainingLocation: string | null,

  hasAccessibleEquipment: boolean,
): EnvironmentTarget[] {
  if (trainingLocation === "GYM") {
    return [EnvironmentTarget.GYM, EnvironmentTarget.ANY];
  }
  if (trainingLocation === "HOME") {
    if (hasAccessibleEquipment) {
      return [
        EnvironmentTarget.HOME_BODYWEIGHT,
        EnvironmentTarget.HOME_EQUIPMENT,
        EnvironmentTarget.ANY,
      ];
    }
    return [EnvironmentTarget.HOME_BODYWEIGHT, EnvironmentTarget.ANY];
  }
  return Object.values(EnvironmentTarget);
}

function resolveGoalTargets(primaryGoal: string): PrimaryGoal[] {
  switch (primaryGoal as PrimaryGoal) {
    case PrimaryGoal.LOSE_WEIGHT:
      return [PrimaryGoal.LOSE_WEIGHT, PrimaryGoal.GET_FIT];
    case PrimaryGoal.BUILD_MUSCLE:
      return [PrimaryGoal.BUILD_MUSCLE];
    case PrimaryGoal.GET_FIT:
      return [PrimaryGoal.GET_FIT];
    default:
      return [primaryGoal as PrimaryGoal];
  }
}

function resolveSexTargets(biologicalSex: string | null): SexTarget[] | null {
  if (!biologicalSex || biologicalSex === "NOT_SPECIFIED") return null;
  if (biologicalSex === "MALE") return [SexTarget.MALE];
  if (biologicalSex === "FEMALE") return [SexTarget.FEMALE];
  return null;
}

// Only meaningful when the user trains at a GYM — HOME users have no
// gymTrainingStyle set, and this must not affect their filtering at all.
function resolveGymStyleTarget(
  trainingLocation: string | null,
  gymTrainingStyle: string | null,
): GymTrainingStyle | null {
  if (trainingLocation !== "GYM") return null;
  return (gymTrainingStyle as GymTrainingStyle) ?? null;
}

export type UserEquipmentEntry = {
  equipmentId: string;
  source: string;
  trialExpiresAt: Date | null;
};

/**
 * Builds the Prisma `where` clause for "plans this user is eligible to see
 * at all" (environment/goal/level/sex/style/equipment-ownership), plus the
 * supporting data needed to compute locks afterward. Does NOT fetch the
 * plans themselves — callers run their own `findMany` with whatever
 * `select` they need using `planWhere`, then apply `sortPlansForCatalog`
 * (below) to the results before passing them to `computePlanLocks`.
 */
export async function getEligiblePlansContext(userId: string) {
  const now = new Date();

  const [allUserEquipment, user] = await Promise.all([
    prisma.userEquipment.findMany({
      where: { userId },
      select: {
        equipmentId: true,
        source: true,
        trialExpiresAt: true,
        equipment: { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        identity: true,
        trainingLocation: true,
        primaryGoal: true,
        experienceLevel: true,
        biologicalSex: true,
        gymTrainingStyle: true,
      },
    }),
  ]);

  // Same predicate used everywhere else equipment "counts" (matches
  // computePlanLocks's PURCHASED/active-trial logic below): purchased
  // equipment is always accessible; declared/trial equipment only counts
  // while the trial hasn't expired. This used to only check
  // source === "DECLARED", so purchased-only users never got
  // HOME_EQUIPMENT plans in their eligible set at all, and users whose
  // trial had already EXPIRED incorrectly kept seeing them.
  const accessibleEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "PURCHASED" ||
        (e.source === "DECLARED" && e.trialExpiresAt && e.trialExpiresAt > now),
    )
    .map((e) => e.equipmentId);

  const hasAccessibleEquipment = accessibleEquipmentIds.length > 0;

  const allowedEnvironments = resolveEnvironmentTargets(
    user?.trainingLocation ?? null,
    hasAccessibleEquipment,
  );

  const planWhere: Prisma.WorkoutPlanWhereInput = {
    OR: [
      { environmentTarget: { in: allowedEnvironments } },
      { environmentTarget: null },
    ],
  };

  if (user?.primaryGoal) {
    const goalTargets = resolveGoalTargets(user.primaryGoal);
    planWhere.AND = [
      ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
      { OR: [{ goalTarget: { in: goalTargets } }, { goalTarget: null }] },
    ];
  }

  if (user?.experienceLevel) {
    const levelHierarchy: Record<string, string[]> = {
      BEGINNER: ["BEGINNER"],
      INTERMEDIATE: ["BEGINNER", "INTERMEDIATE"],
      ADVANCED: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    };
    const allowedDifficulties = levelHierarchy[user.experienceLevel] ?? [];
    planWhere.AND = [
      ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
      {
        OR: [{ difficulty: { in: allowedDifficulties } }, { difficulty: null }],
      },
    ];
  }

  const gymStyleTarget = resolveGymStyleTarget(
    user?.trainingLocation ?? null,
    user?.gymTrainingStyle ?? null,
  );
  if (gymStyleTarget) {
    planWhere.AND = [
      ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
      {
        OR: [{ gymStyleTarget: gymStyleTarget }, { gymStyleTarget: null }],
      },
    ];
  }

  if (user?.biologicalSex) {
    const sexTargets = resolveSexTargets(user.biologicalSex);
    if (sexTargets !== null) {
      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        { OR: [{ sexTarget: { in: sexTargets } }, { sexTarget: null }] },
      ];
    } else if (user.biologicalSex === "NOT_SPECIFIED") {
      planWhere.AND = [
        ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
        { sexTarget: null },
      ];
    }
  }

  // Visibility for the DB query is intentionally broader than "currently
  // accessible": it includes equipment from an EXPIRED trial too. Those
  // plans must still be fetched so computePlanLocks can mark them
  // locked + trial_expired (and the UI can show an upgrade CTA), instead
  // of the plans silently disappearing from the list once the trial ends.
  const visibleEquipmentIds = Array.from(
    new Set(allUserEquipment.map((e) => e.equipmentId)),
  );

  planWhere.AND = [
    ...(Array.isArray(planWhere.AND) ? planWhere.AND : []),
    {
      OR: [{ equipmentId: { in: visibleEquipmentIds } }, { equipmentId: null }],
    },
  ];

  return {
    planWhere,
    // NOTE: Prisma `orderBy` can't express "equipment-tied plans first,
    // bodyweight after" directly (it has no boolean-on-nullness sort), so
    // catalog ordering is done in application code via `sortPlansForCatalog`
    // below, applied AFTER findMany. Both call sites (route.ts and
    // resolver.ts) must call it on their fetched results so the order used
    // for cap-counting in computePlanLocks is identical in both places.
    allUserEquipment,
    user,
    accessibleEquipmentIds,
    now,
  };
}

// ── Catalog ordering ───────────────────────────────────────────────────────

type PlanForSorting = { id: string; name: string; equipmentId: string | null };

/**
 * Equipment-tied plans first, bodyweight plans after — within each group,
 * alphabetical by name for a stable, predictable order. This is the
 * canonical catalog order used for BOTH display and for the fixed-position
 * cap counting in computePlanLocks, so it must be applied identically by
 * every caller (route.ts and resolver.ts) on their findMany results.
 */
export function sortPlansForCatalog<T extends PlanForSorting>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    const aIsEquipment = a.equipmentId !== null;
    const bIsEquipment = b.equipmentId !== null;
    if (aIsEquipment !== bIsEquipment) {
      return aIsEquipment ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// ── Lock computation ───────────────────────────────────────────────────────

type PlanForLocking = { id: string; equipmentId: string | null };

/**
 * Given the eligible plans in their existing catalog order, decides which
 * ones are unlocked. Pure/synchronous — no DB access — so it can't drift
 * between the GET route and the activate route as long as both pass it the
 * same eligible-plans list.
 */
export function computePlanLocks<T extends PlanForLocking>(
  plans: T[],
  opts: { isPro: boolean; allUserEquipment: UserEquipmentEntry[]; now: Date },
): Map<string, { locked: boolean; lockReason: LockReason | null }> {
  const { isPro, allUserEquipment, now } = opts;
  const result = new Map<
    string,
    { locked: boolean; lockReason: LockReason | null }
  >();

  if (isPro) {
    for (const p of plans) {
      result.set(p.id, { locked: false, lockReason: null });
    }
    return result;
  }

  const equipmentById = new Map(
    allUserEquipment.map((e) => [e.equipmentId, e]),
  );

  let bodyweightUnlockedCount = 0;
  let equipmentTrialUnlockedCount = 0;

  for (const p of plans) {
    if (p.equipmentId === null) {
      // Bodyweight — first BODYWEIGHT_FREE_CAP in catalog order are
      // unlocked, free forever, for every non-Pro tier.
      if (bodyweightUnlockedCount < BODYWEIGHT_FREE_CAP) {
        bodyweightUnlockedCount++;
        result.set(p.id, { locked: false, lockReason: null });
      } else {
        result.set(p.id, { locked: true, lockReason: "cap_reached" });
      }
      continue;
    }

    const entry = equipmentById.get(p.equipmentId);
    if (!entry) {
      // Defense-in-depth: getEligiblePlansContext's planWhere already
      // excludes equipment the user has no access to, so this shouldn't
      // normally be reachable. Fail closed if it ever is.
      result.set(p.id, { locked: true, lockReason: "equipment_required" });
      continue;
    }

    if (entry.source === "PURCHASED") {
      // Bought from the store — unlimited for the equipment they own.
      result.set(p.id, { locked: false, lockReason: null });
      continue;
    }

    // DECLARED (trial) equipment.
    const trialActive = !!entry.trialExpiresAt && entry.trialExpiresAt > now;
    if (!trialActive) {
      // Trial ended — locks even a plan the user was previously training.
      result.set(p.id, { locked: true, lockReason: "trial_expired" });
      continue;
    }

    if (equipmentTrialUnlockedCount < EQUIPMENT_TRIAL_CAP) {
      equipmentTrialUnlockedCount++;
      result.set(p.id, { locked: false, lockReason: null });
    } else {
      result.set(p.id, { locked: true, lockReason: "cap_reached" });
    }
  }

  return result;
}
