import { prisma } from "@/lib/prisma";
import { UserLevel, InstanceStatus } from "@/generated/prisma";

type ResolverInput = {
  userId: string;
  planId: string;
  level: UserLevel;
};

// src/lib/resolver.ts
export async function resolveProgram({ userId, planId, level }: ResolverInput) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error(`No plan found: ${planId}`);

  const instance = await prisma.$transaction(async (tx) => {
    // Abandon any existing active instance first
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

  return instance;
}
