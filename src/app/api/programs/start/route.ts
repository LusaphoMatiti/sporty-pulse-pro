import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { UserLevel, InstanceStatus } from "@/generated/prisma";

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: { planId: string; level: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { planId, level } = body;

  const validLevels: UserLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  if (!validLevels.includes(level as UserLevel)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: { equipment: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const access = await getUserAccess({ userId });

  if (plan.equipmentId) {
    const hasAccess =
      access.isPro || access.canAccessEquipmentProgram(plan.equipmentId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "No access to this program" },
        { status: 403 },
      );
    }
  }

  await prisma.planInstance.updateMany({
    where: { userId, status: InstanceStatus.ACTIVE },
    data: { status: InstanceStatus.ABANDONED },
  });

  const instance = await prisma.planInstance.create({
    data: {
      userId,
      planId,
      level: level as UserLevel,
      status: InstanceStatus.ACTIVE,
      currentSession: 1,
    },
  });

  return NextResponse.json({ instanceId: instance.id }, { status: 201 });
}
