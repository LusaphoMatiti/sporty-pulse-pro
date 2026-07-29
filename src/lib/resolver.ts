import { prisma } from "@/lib/prisma";
import { UserLevel, InstanceStatus } from "@/generated/prisma";
import { getUserAccess } from "@/lib/access";
import {
  getEligiblePlansContext,
  computePlanLocks,
  sortPlansForCatalog,
} from "@/lib/programaccess";

type ResolverInput = {
  userId: string;
  planId: string;
  level: UserLevel;
};

export class ProgramAccessError extends Error {
  code: "LOCKED" | "NOT_VISIBLE";

  constructor(code: ProgramAccessError["code"], message: string) {
    super(message);
    this.name = "ProgramAccessError";
    this.code = code;
  }
}

export class PlanNotFoundError extends Error {}

// src/lib/resolver.ts
//
// Authorization is delegated to the exact same catalog + lock computation
// the Programs screen uses (lib/programAccess.ts) — a plan is activatable
// if and only if it shows up unlocked there. This is catalog-position
// based (first 4 bodyweight / first 2 trial-equipment), NOT based on how
// many instances are currently active, so there's no cap-counting here.
//
// Only one PlanInstance is ever ACTIVE per user at a time — switching
// programs abandons whichever one was active before.
export async function resolveProgram({ userId, planId, level }: ResolverInput) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new PlanNotFoundError(`No plan found: ${planId}`);

  const [{ planWhere, allUserEquipment, now }, access] = await Promise.all([
    getEligiblePlansContext(userId),
    getUserAccess({ userId }),
  ]);

  const eligiblePlansUnsorted = await prisma.workoutPlan.findMany({
    where: planWhere,
    select: {
      id: true,
      name: true,
      equipmentId: true,
      environmentTarget: true,
    },
  });

  // MUST use the same catalog order as the GET /api/programs route, since
  // computePlanLocks's cap-counting is position-dependent. See
  // sortPlansForCatalog in lib/programaccess.ts.
  const eligiblePlans = sortPlansForCatalog(eligiblePlansUnsorted);

  const lockMap = computePlanLocks(eligiblePlans, {
    isPro: access.isPro,
    allUserEquipment,
    now,
    gymTrialExpiresAt: access.gymTrialExpiresAt,
  });

  const lock = lockMap.get(planId);
  if (!lock) {
    throw new ProgramAccessError(
      "NOT_VISIBLE",
      "This program isn't available to you.",
    );
  }
  if (lock.locked) {
    throw new ProgramAccessError(
      "LOCKED",
      "This program is locked. Upgrade to Pro to unlock it.",
    );
  }

  return prisma.$transaction(async (tx) => {
    // Abandon any existing active instance first — only one program is
    // ever in training at a time.
    await tx.planInstance.updateMany({
      where: { userId, status: InstanceStatus.ACTIVE },
      data: { status: InstanceStatus.ABANDONED },
    });

    return tx.planInstance.create({
      data: {
        userId,
        planId,
        level,
        status: InstanceStatus.ACTIVE,
        currentSession: 1,
      },
    });
  });
}
