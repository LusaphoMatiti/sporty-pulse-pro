// src/app/api/onboarding/complete/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Plain string literals matching the Prisma enum values exactly.
// Avoids import issues with the generated client's enum exports.
const VALID_PRIMARY_GOALS = ["LOSE_WEIGHT", "BUILD_MUSCLE", "GET_FIT"] as const;
const VALID_TRAINING_LOCATIONS = ["HOME", "GYM"] as const;
const VALID_BIOLOGICAL_SEXES = ["MALE", "FEMALE", "NOT_SPECIFIED"] as const;
const VALID_EXPERIENCE_LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;

type PrimaryGoal = (typeof VALID_PRIMARY_GOALS)[number];
type TrainingLocation = (typeof VALID_TRAINING_LOCATIONS)[number];
type BiologicalSex = (typeof VALID_BIOLOGICAL_SEXES)[number];
type ExperienceLevel = (typeof VALID_EXPERIENCE_LEVELS)[number];

export async function POST(req: Request) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Already onboarded — idempotent
  if (session.user.onboardingComplete) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Parse body
  let body: {
    primaryGoal?: string;
    trainingLocation?: string;
    biologicalSex?: string;
    experienceLevel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { primaryGoal, trainingLocation, biologicalSex, experienceLevel } =
    body;

  // Validate
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

  // Single DB write
  try {
    await prisma.user.update({
      where: { id: session.user.id },
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/complete] DB error:", err);
    return NextResponse.json(
      { error: "Database error", detail: message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
