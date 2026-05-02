import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    equipmentId?: string; // optional — only set when HOME + has equipment
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

  try {
    // Run user update + optional equipment creation in a transaction
    await prisma.$transaction(async (tx) => {
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
        },
      });

      if (equipmentId) {
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL_DAYS);

        // Upsert so re-running onboarding doesn't create duplicate rows
        await tx.userEquipment.upsert({
          where: {
            // UserEquipment has no unique constraint on userId+equipmentId in
            // the schema, so we use a findFirst pattern via create/update by id.
            // We create with a known pattern — use create if no existing record.
            id: `${userId}_${equipmentId}_declared`,
          },
          update: {
            trialExpiresAt,
          },
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

  return NextResponse.json({ ok: true });
}
