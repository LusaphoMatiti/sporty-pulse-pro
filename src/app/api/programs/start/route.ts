// src/app/api/programs/start/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { UserLevel, InstanceStatus } from "@/generated/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
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

  // ── Validate level ────────────────────────────────────────────
  const validLevels: UserLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  if (!validLevels.includes(level as UserLevel)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  // ── Validate plan exists ──────────────────────────────────────
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: { equipment: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // ── Access check ──────────────────────────────────────────────
  const access = await getUserAccess({ userId });

  // Equipment plan access
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

  // ── Abandon existing ACTIVE instances ─────────────────────────

  await prisma.planInstance.updateMany({
    where: { userId, status: InstanceStatus.ACTIVE },
    data: { status: InstanceStatus.ABANDONED },
  });

  // ── Create the new instance ───────────────────────────────────
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
