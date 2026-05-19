// src/app/api/onboarding/complete/route.ts
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { assignIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

const VALID_PRIMARY_GOALS = ["LOSE_WEIGHT", "BUILD_MUSCLE", "GET_FIT"] as const;
const VALID_TRAINING_LOCATIONS = ["HOME", "GYM"] as const;
const VALID_BIOLOGICAL_SEXES = ["MALE", "FEMALE", "NOT_SPECIFIED"] as const;
const VALID_EXPERIENCE_LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;

const TRIAL_DAYS = 14;

type PrimaryGoal = (typeof VALID_PRIMARY_GOALS)[number];
type TrainingLocation = (typeof VALID_TRAINING_LOCATIONS)[number];
type BiologicalSex = (typeof VALID_BIOLOGICAL_SEXES)[number];
type ExperienceLevel = (typeof VALID_EXPERIENCE_LEVELS)[number];

export async function POST(req: NextRequest) {
  // Auth
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotent
  if (session.user.onboardingComplete) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Parse body
  let body: {
    primaryGoal?: string;
    trainingLocation?: string;
    biologicalSex?: string;
    experienceLevel?: string;
    equipmentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    primaryGoal,
    trainingLocation,
    biologicalSex,
    experienceLevel,
    equipmentId,
  } = body;

  // Validate required fields
  if (
    !primaryGoal ||
    !(VALID_PRIMARY_GOALS as readonly string[]).includes(primaryGoal)
  ) {
    return NextResponse.json(
      {
        error: `Invalid primaryGoal. Must be one of: ${VALID_PRIMARY_GOALS.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (
    !trainingLocation ||
    !(VALID_TRAINING_LOCATIONS as readonly string[]).includes(trainingLocation)
  ) {
    return NextResponse.json(
      {
        error: `Invalid trainingLocation. Must be one of: ${VALID_TRAINING_LOCATIONS.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (
    !biologicalSex ||
    !(VALID_BIOLOGICAL_SEXES as readonly string[]).includes(biologicalSex)
  ) {
    return NextResponse.json(
      {
        error: `Invalid biologicalSex. Must be one of: ${VALID_BIOLOGICAL_SEXES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (
    !experienceLevel ||
    !(VALID_EXPERIENCE_LEVELS as readonly string[]).includes(experienceLevel)
  ) {
    return NextResponse.json(
      {
        error: `Invalid experienceLevel. Must be one of: ${VALID_EXPERIENCE_LEVELS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // If equipmentId provided, validate it exists and is not Bodyweight
  if (equipmentId) {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, name: true },
    });
    if (!equipment) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 400 },
      );
    }
    if (equipment.name === "Bodyweight") {
      return NextResponse.json(
        { error: "Cannot declare Bodyweight as equipment" },
        { status: 400 },
      );
    }
  }

  const userId = session.user.id;

  // ─────────────────────────────────────────────
  // ASSIGN IDENTITY
  // Derive identity from onboarding inputs.
  // lastLoginAt is null for brand new users —
  // assignIdentity handles that gracefully.
  // ─────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLoginAt: true, onboardingCompletedAt: true },
  });

  const { identity, reason } = assignIdentity({
    experienceLevel: experienceLevel as ExperienceLevel,
    primaryGoal: primaryGoal as PrimaryGoal,
    lastLoginAt: user?.lastLoginAt ?? null,
    onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
  });

  console.log(
    `[onboarding/complete] userId=${userId} assigned identity=${identity} reason="${reason}"`,
  );

  try {
    await prisma.$transaction(async (tx) => {
      // Update user with onboarding data + assigned identity
      await tx.user.update({
        where: { id: userId },
        data: {
          primaryGoal: primaryGoal as PrimaryGoal,
          trainingLocation: trainingLocation as TrainingLocation,
          biologicalSex: biologicalSex as BiologicalSex,
          experienceLevel: experienceLevel as ExperienceLevel,
          onboardingComplete: true,
          onboardingCompletedAt: new Date(),
          isNewUser: false,
          identity,
          identityAssignedAt: new Date(),
        },
      });

      // Create UserEquipment if equipment was declared
      if (equipmentId) {
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL_DAYS);

        await tx.userEquipment.upsert({
          where: { id: `${userId}_${equipmentId}_declared` },
          update: { trialExpiresAt },
          create: {
            id: `${userId}_${equipmentId}_declared`,
            userId,
            equipmentId,
            source: "DECLARED",
            trialExpiresAt,
          },
        });
      }
    });
  } catch (err) {
    console.error("[onboarding/complete] DB error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    identity,
  });
}
