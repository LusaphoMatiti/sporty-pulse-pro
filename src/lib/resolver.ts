import { prisma } from "@/lib/prisma";
import { UserLevel, InstanceStatus, Plan } from "@/generated/prisma";
import {
  BODYWEIGHT_PROGRAM_CAP,
  EQUIPMENT_TRIAL_PROGRAM_CAP,
} from "@/lib/access";

type ResolverInput = {
  userId: string;
  planId: string;
  level: UserLevel;
};

export class ProgramAccessError extends Error {
  code:
    | "EQUIPMENT_REQUIRED"
    | "BODYWEIGHT_CAP_REACHED"
    | "EQUIPMENT_CAP_REACHED";

  constructor(code: ProgramAccessError["code"], message: string) {
    super(message);
    this.name = "ProgramAccessError";
    this.code = code;
  }
}

export class PlanNotFoundError extends Error {}

// src/lib/resolver.ts
//
// IMPORTANT: this intentionally does NOT abandon other active instances.
// Multiple programs can be ACTIVE at once, up to the bodyweight (4) and
// equipment (2 during trial, unlimited if purchased/Pro) caps enforced
// below. All counts + checks happen inside one transaction so two
// concurrent activate calls can't both slip past the cap.
export async function resolveProgram({ userId, planId, level }: ResolverInput) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new PlanNotFoundError(`No plan found: ${planId}`);

  const isEquipmentPlan = plan.equipmentId !== null;

  return prisma.$transaction(async (tx) => {
    // Idempotent: re-activating (or changing level on) a plan that's already
    // active doesn't consume a new slot.
    const existing = await tx.planInstance.findFirst({
      where: { userId, planId, status: InstanceStatus.ACTIVE },
    });
    if (existing) {
      return tx.planInstance.update({
        where: { id: existing.id },
        data: { level },
      });
    }

    const [subscription, userEquipment] = await Promise.all([
      tx.subscription.findUnique({
        where: { userId },
        select: { plan: true },
      }),
      tx.userEquipment.findMany({
        where: { userId },
        select: { equipmentId: true, source: true, trialExpiresAt: true },
      }),
    ]);

    const now = new Date();
    const isPro = subscription?.plan === Plan.PRO;
    const hasPurchasedEquipment = userEquipment.some(
      (e) => e.source === "PURCHASED",
    );

    if (isEquipmentPlan) {
      const ownsThisEquipment = userEquipment.some(
        (e) =>
          e.equipmentId === plan.equipmentId &&
          (e.source === "PURCHASED" ||
            (e.source === "DECLARED" &&
              e.trialExpiresAt !== null &&
              e.trialExpiresAt > now)),
      );

      if (!isPro && !ownsThisEquipment) {
        throw new ProgramAccessError(
          "EQUIPMENT_REQUIRED",
          "You don't have access to this equipment's programs.",
        );
      }

      // Purchased equipment (and Pro) get unlimited concurrently-active
      // equipment programs. Only the declared-equipment trial tier is capped.
      if (!isPro && !hasPurchasedEquipment) {
        const equipmentActiveCount = await tx.planInstance.count({
          where: {
            userId,
            status: InstanceStatus.ACTIVE,
            plan: { equipmentId: { not: null } },
          },
        });
        if (equipmentActiveCount >= EQUIPMENT_TRIAL_PROGRAM_CAP) {
          throw new ProgramAccessError(
            "EQUIPMENT_CAP_REACHED",
            `You can only have ${EQUIPMENT_TRIAL_PROGRAM_CAP} equipment programs active during your trial.`,
          );
        }
      }
    } else if (!isPro) {
      const bodyweightActiveCount = await tx.planInstance.count({
        where: {
          userId,
          status: InstanceStatus.ACTIVE,
          plan: { equipmentId: null },
        },
      });
      if (bodyweightActiveCount >= BODYWEIGHT_PROGRAM_CAP) {
        throw new ProgramAccessError(
          "BODYWEIGHT_CAP_REACHED",
          `You can only have ${BODYWEIGHT_PROGRAM_CAP} bodyweight programs active at once.`,
        );
      }
    }

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
