import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Plan,
  EquipmentSource,
  UserLevel,
  MuscleGroup,
} from "@/generated/prisma";
import { resolveProgram } from "@/lib/resolver";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { equipmentId, source, level, muscleGroup } = await req.json();

  const plan = source === "bodyweight" ? Plan.FREE : Plan.EQUIPMENT;
  const eqSource =
    source === "purchased"
      ? EquipmentSource.PURCHASED
      : source === "declared"
        ? EquipmentSource.DECLARED
        : EquipmentSource.BODYWEIGHT;

  // ── 1. Resolve muscleGroup enum ──────────────────────────────
  const muscleGroupEnum: Record<string, MuscleGroup> = {
    fullbody: MuscleGroup.FULLBODY,
    upper: MuscleGroup.UPPER,
    lower: MuscleGroup.LOWER,
    core: MuscleGroup.CORE,
  };
  const muscleGroupValue = muscleGroupEnum[muscleGroup] ?? MuscleGroup.FULLBODY;

  // ── 2. Look up plan by equipmentId + muscleGroup ─────────────
  const workoutPlan = await prisma.workoutPlan.findFirst({
    where: {
      equipmentId: equipmentId ?? null,
      muscleGroup: muscleGroupValue,
    },
    select: { id: true },
  });

  if (!workoutPlan) {
    console.error(
      `[ONBOARD] Plan not found for equipmentId="${equipmentId}" muscleGroup="${muscleGroupValue}"`,
    );
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // ── 3. Save subscription + equipment + mark onboarding done ──
  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: session.user.id },
      update: { plan, status: "active" },
      create: { userId: session.user.id, plan, status: "active", source },
    }),
    ...(equipmentId
      ? [
          prisma.userEquipment.create({
            data: {
              userId: session.user.id,
              equipmentId,
              source: eqSource,
              trialExpiresAt:
                eqSource === EquipmentSource.DECLARED
                  ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                  : null,
            },
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingComplete: true },
    }),
  ]);

  // ── 4. Create the plan instance ───────────────────────────────
  const userLevel = (level ?? "BEGINNER") as UserLevel;

  try {
    await resolveProgram({
      userId: session.user.id,
      planId: workoutPlan.id,
      level: userLevel,
    });
  } catch (err) {
    console.error("[ONBOARD] resolveProgram failed:", err);
    return NextResponse.json(
      { error: "Failed to create program" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
