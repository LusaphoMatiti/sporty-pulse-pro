import { prisma } from "@/lib/prisma";
import { UserLevel, InstanceStatus } from "@/generated/prisma";

type ResolverInput = {
  userId: string;
  planId: string;
  level: UserLevel;
};

export async function resolveProgram({ userId, planId, level }: ResolverInput) {
  //  Verify the plan exists
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) throw new Error(`No plan found: ${planId} `);

  const instance = await prisma.planInstance.create({
    data: {
      userId,
      planId,
      level,
      status: InstanceStatus.ACTIVE,
      currentSession: 1,
    },
  });

  return instance;
}
