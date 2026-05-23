import "dotenv/config";
import {
  PrismaClient,
  MuscleGroup,
  PlanTier,
  ImpactLevel,
  PrimaryGoal,
} from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import exercises from "../src/training/exercises";

import buildMuscleRaw from "../src/training/workouts_build_muscle.json";
import loseWeightRaw from "../src/training/workouts_lose_weight.json";
import getFitRaw from "../src/training/workouts_get_fit.json";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────
// ASSET URLS (Cloudinary)
//
// URLs are opaque per-asset (version hash + public ID).
// Add them directly to the source data:
//
//   exercises.ts  →  thumbnailUrl?: string   (e.g. https://res.cloudinary.com/…/thumbnail.jpg)
//                    videoUrl?: string        (e.g. https://res.cloudinary.com/…/demo.mp4)
//
//   workout JSONs →  "imageUrl": "https://res.cloudinary.com/…"
//                    "videoUrl": "https://res.cloudinary.com/…"
//
// Leave the fields undefined/absent until the asset is uploaded.
// The seed writes null for any missing URL — safe to re-seed after uploading.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// EQUIPMENT SEED DATA
// ─────────────────────────────────────────────

const equipmentSeed = [
  { name: "Bodyweight", category: "fullbody" },
  { name: "Kettlebell", category: "fullbody" },
  { name: "Dumbbell", category: "fullbody" },
  { name: "Resistance Bands", category: "fullbody" },
  { name: "Ab Wheel", category: "core" },
  { name: "Dip Bar", category: "upper" },
  { name: "Pull-Up Bar", category: "upper" },
  { name: "Jump Rope", category: "fullbody" },
  { name: "Battle Rope", category: "fullbody" },
  { name: "Glute Bands", category: "lower" },
  { name: "Hip Thrust Pad", category: "lower" },
  { name: "Adjustable Weight Training Vest", category: "fullbody" },
  { name: "Slider Discs", category: "core" },
  { name: "Medicine Ball", category: "fullbody" },
  { name: "Stability Ball", category: "core" },
  { name: "Sandbag", category: "fullbody" },
];

// ─────────────────────────────────────────────
// HELPERS: exercises.ts field mapping
// ─────────────────────────────────────────────

/**
 * exercises.ts uses token strings like "BODYWEIGHT", "DUMBBELL", "RESISTANCE_BAND".
 * Map these to the equipment names used in equipmentSeed.
 */
const EQUIPMENT_TOKEN_TO_NAME: Record<string, string | null> = {
  BODYWEIGHT: "Bodyweight",
  DUMBBELL: "Dumbbell",
  KETTLEBELL: "Kettlebell",
  RESISTANCE_BAND: "Resistance Bands",
  AB_WHEEL: "Ab Wheel",
  DIP_BAR: "Dip Bar",
  DIP_BARS: "Dip Bar",
  PULL_UP_BAR: "Pull-Up Bar",
  JUMP_ROPE: "Jump Rope",
  BATTLE_ROPE: "Battle Rope",
  BATTLE_ROPES: "Battle Rope",
  GLUTE_BAND: "Glute Bands",
  HIP_THRUST_PAD: "Hip Thrust Pad",
  WEIGHT_VEST: "Adjustable Weight Training Vest",
  SLIDER_DISCS: "Slider Discs",
  MEDICINE_BALL: "Medicine Ball",
  STABILITY_BALL: "Stability Ball",
  SANDBAG: "Sandbag",
  // GYM-only equipment not in our catalogue — skipped gracefully
  BARBELL: null,
  RACK: null,
  MACHINE: null,
  CABLE: null,
  CABLE_MACHINE: null,
  SKI_ERG: null,
  BENCH: null,
  BOX: null,
  TRAP_BAR: null,
  TRX: null,
  RINGS: null,
  PARALLEL_BARS: null,
  GHD_MACHINE: null,
  ROWING_MACHINE: null,
  ASSAULT_BIKE: null,
  SLED: null,
  YOKE: null,
  LOG_BAR: null,
  LANDMINE_ATTACHMENT: null,
  WEIGHT_BELT: null,
  WEIGHT_PLATE: null,
  PLATE: null,
};

// ─────────────────────────────────────────────
// EXERCISE DESCRIPTIONS
// Keys must match exercise names in exercises.ts exactly.
// ─────────────────────────────────────────────

const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  // ── Lower Body ────────────────────────────
  "Bodyweight Squat":
    "Stand with feet shoulder-width apart, push your hips back and bend your knees until thighs are parallel to the floor, then drive through your heels to stand. The foundation of lower-body training.",
  "Jump Squat":
    "Perform a squat then drive explosively through your legs to jump off the ground. Land softly with knees slightly bent. Builds lower-body power and burns serious calories.",
  "Bulgarian Split Squat":
    "A single-leg squat with the rear foot elevated on a bench. Targets the quads, glutes, and hip flexors while challenging balance and core stability.",
  "Walking Lunge":
    "Step forward into a lunge, lower your back knee toward the floor, then bring your rear foot forward to repeat on the other side. Builds leg strength and hip flexibility.",
  "Reverse Lunge":
    "Step backward into a lunge, lowering the rear knee to just above the floor. Easier on the knees than a forward lunge and excellent for glute activation.",
  "Lateral Lunge":
    "Step wide to one side, shift your weight over that leg and push your hips back into a deep lateral squat. Targets the inner thighs and glute medius.",
  "Glute Bridge":
    "Lie on your back with knees bent and feet flat. Drive your hips up until your body forms a straight line from shoulders to knees, squeezing your glutes hard at the top.",
  "Single-Leg Glute Bridge":
    "A glute bridge on one leg at a time, increasing unilateral glute and hamstring demand. Great for correcting left-right imbalances.",
  "Hip Thrust":
    "Upper back on a bench, feet flat on the floor — drive your hips upward by squeezing your glutes. One of the most effective exercises for glute size and strength.",
  "Donkey Kick":
    "On all fours, kick one leg back and up keeping the knee bent at 90°. Isolates the glute max without loading the spine.",
  "Fire Hydrant":
    "On all fours, lift one knee out to the side to 90°. Targets the glute medius for hip stability and injury prevention.",
  "Calf Raise":
    "Stand hip-width apart and rise onto the balls of your feet, then lower back down with control. Strengthens the gastrocnemius and soleus.",
  "Nordic Hamstring Curl":
    "Kneel with feet anchored and lower your torso toward the floor as slowly as possible using your hamstrings. One of the most effective exercises for hamstring strength and injury prevention.",
  "Wall Sit":
    "Slide down a wall until your thighs are parallel to the floor and hold the position. An isometric quad burner that also challenges mental toughness.",
  "Step-Up":
    "Step onto a raised surface one foot at a time, driving through the heel of the leading leg. Great for unilateral leg strength and hip stability.",
  "Box Jump":
    "Explosively jump onto a sturdy raised platform, landing softly with both feet. Develops lower-body power, coordination, and fast-twitch muscle fibre recruitment.",
  "Sumo Squat":
    "Take a wide stance with toes turned out, then squat deep while keeping your chest tall. Places extra emphasis on the inner thighs and glutes compared to a standard squat.",
  "Skater Lunge":
    "Leap laterally from one foot, landing on the opposite foot and swinging the trail leg behind you. Builds single-leg power, balance, and hip stability.",

  // ── Upper Body — Push ─────────────────────
  "Push-Up":
    "Keep your body in a straight line from head to heels, lower your chest to the floor, then press back up. A timeless chest, shoulder, and tricep builder.",
  "Wide Push-Up":
    "Hands wider than shoulder-width, lowering your chest toward the floor. The wider grip increases chest stretch and range of motion.",
  "Diamond Push-Up":
    "Hands close together forming a diamond under your chest. Shifts the load to the triceps and inner chest.",
  "Decline Push-Up":
    "Feet elevated on a bench, hands on the floor. Shifts emphasis to the upper chest and front delts.",
  "Pike Push-Up":
    "In a downward-dog position, bend your elbows to lower your head toward the floor then press back up. A shoulder-dominant push variation and stepping stone to the handstand push-up.",
  "Archer Push-Up":
    "A wide-grip push-up where you shift your weight to one side while extending the opposite arm straight. Increases unilateral demand on the chest and tricep.",
  "Tricep Dip":
    "Hands on a bench or dip bar behind you, lower your body by bending the elbows to 90°, then press back up. Directly targets the triceps and anterior deltoid.",

  // ── Upper Body — Pull ─────────────────────
  "Pull-Up":
    "Hang from a bar with an overhand grip and pull your chest toward the bar by driving your elbows down and back. The gold-standard back and bicep exercise.",
  "Chin-Up":
    "Like a pull-up but with a supinated (underhand) grip, which brings the biceps more into play alongside the lats.",
  "Inverted Row":
    "Hang beneath a bar or table with your body straight, then pull your chest up to meet it. A horizontal pulling movement that builds the mid-back and rear delts.",
  Superman:
    "Lie face down and simultaneously raise your arms, chest, and legs off the floor. Strengthens the entire posterior chain — glutes, hamstrings, and lower back.",
  "Renegade Row":
    "In a push-up position holding dumbbells or kettlebells, row one weight to your hip while stabilising with the other arm. Combines back strength with serious core anti-rotation work.",

  // ── Core ──────────────────────────────────
  Plank:
    "Hold a push-up position on your forearms or hands, keeping your body in a rigid straight line. Builds deep core stability, shoulder endurance, and total-body tension.",
  "Side Plank":
    "Balance on one forearm and the side of your foot, body in a straight line. Targets the obliques and quadratus lumborum for lateral core stability.",
  "Hollow Body Hold":
    "Lying on your back, press your lower back into the floor while raising your arms and legs. Creates full-body tension and is the foundation of gymnastic strength.",
  "Dead Bug":
    "Lying on your back, extend opposite arm and leg toward the floor while keeping your lower back pressed down. Trains deep core stability and anti-extension control.",
  "Ab Rollout":
    "Kneel holding an ab wheel, roll forward until your body is parallel to the floor, then pull back with your core. One of the most challenging core exercises for anti-extension strength.",
  "Bicycle Crunch":
    "Lying on your back, alternate bringing opposite elbow to knee while extending the other leg. Combines rectus abdominis and oblique activation.",
  "Leg Raise":
    "Lying on your back, keep your legs straight and raise them to 90° then lower slowly. Targets the lower abs and hip flexors.",
  "Hanging Knee Raise":
    "Hang from a bar and draw your knees up toward your chest. Challenges the entire anterior core with an added grip and lat endurance component.",
  "Hanging Leg Raise":
    "Hang from a bar and raise straight legs to 90° or higher. A demanding core exercise that also builds significant grip and lat endurance.",
  "Mountain Climber":
    "In a push-up position, drive your knees toward your chest alternately at speed. Combines core stability with cardiovascular conditioning.",
  "Toe Touch":
    "Lie on your back with legs raised to 90° and reach your hands up toward your toes. Crunches the upper abs through a short but intense range of motion.",
  "Russian Twist":
    "Seated with torso leaning back, rotate your hands (or a weight) from side to side. Targets the obliques and improves rotational core strength.",
  "Flutter Kick":
    "Lying on your back with legs slightly raised, alternate small rapid kicks. Builds lower ab and hip flexor endurance.",
  "V-Up":
    "Simultaneously raise your straight legs and torso to meet in the middle, forming a V shape. A demanding full-range core exercise targeting the hip flexors and abs.",

  // ── Conditioning / Full Body ──────────────
  Burpee:
    "From standing, drop to a push-up, perform the push-up, jump your feet forward, then explode into a jump. The ultimate full-body conditioning exercise.",
  "Jump Rope":
    "Skip continuously at a steady or varying pace. Low-impact cardiovascular conditioning that also improves coordination and foot speed.",
  "Battle Rope Wave":
    "Hold one end of a heavy rope in each hand and create powerful alternating waves. Conditions the shoulders, arms, and core while spiking heart rate.",
  "Kettlebell Swing":
    "Hinge at the hips to swing a kettlebell between your legs, then drive your hips forward to propel it to chest height. Builds explosive posterior chain power and cardiovascular endurance.",
  "Kettlebell Goblet Squat":
    "Hold a kettlebell by the horns at chest height and squat deep. The front load encourages an upright torso and reinforces great squat mechanics.",
  "Kettlebell Clean":
    "Pull a kettlebell from the floor or a swing and receive it in the rack position at your shoulder. A full-body power movement that links the lower and upper body.",
  "Kettlebell Press":
    "From the rack position, press a kettlebell overhead to full elbow lockout. Builds shoulder strength and stability with a core bracing demand.",
  "Turkish Get-Up":
    "From lying to standing and back down while holding a weight overhead at all times. The ultimate full-body mobility, stability, and strength exercise.",
  "Medicine Ball Slam":
    "Raise a medicine ball overhead then slam it into the floor as hard as possible. A powerful expression of full-body force that doubles as a stress release.",
  "Medicine Ball Rotational Throw":
    "Standing side-on to a wall, explosively rotate and throw a medicine ball into the wall. Develops rotational power through the hips, core, and shoulders.",
  "Sandbag Carry":
    "Bear-hug or shoulder a heavy sandbag and walk for distance or time. Builds total-body strength, grip, and cardiovascular conditioning in a highly functional way.",
};

// ─────────────────────────────────────────────
// HELPERS: MuscleGroup / ImpactLevel / Goal
// ─────────────────────────────────────────────

/**
 * Derive MuscleGroup enum from movementPattern.
 */
function toMuscleGroup(movementPattern: string): MuscleGroup {
  switch (movementPattern.toUpperCase()) {
    case "SQUAT":
    case "LUNGE":
    case "HINGE":
      return MuscleGroup.LOWER;
    case "PUSH":
    case "PULL":
    case "UPPER":
      return MuscleGroup.UPPER;
    case "CORE":
      return MuscleGroup.CORE;
    default:
      return MuscleGroup.FULLBODY;
  }
}

/**
 * Map impactLevel string to ImpactLevel enum.
 */
function toImpactLevel(level: string): ImpactLevel {
  switch (level?.toUpperCase()) {
    case "LOW":
      return ImpactLevel.LOW;
    case "HIGH":
      return ImpactLevel.HIGH;
    default:
      return ImpactLevel.MEDIUM;
  }
}

/**
 * Map goal string to PrimaryGoal enum.
 */
function toPrimaryGoal(goal: string): PrimaryGoal {
  const g = goal.toUpperCase().replace(/\s+/g, "_");
  if (g.includes("MUSCLE")) return PrimaryGoal.BUILD_MUSCLE;
  if (g.includes("WEIGHT") || g.includes("LOSE"))
    return PrimaryGoal.LOSE_WEIGHT;
  return PrimaryGoal.GET_FIT;
}

// ─────────────────────────────────────────────
// HELPERS: workout JSON normalisation
// ─────────────────────────────────────────────

interface RawExercise {
  exercise?: string;
  sets?: number;
  reps?: string | number;
  rest?: string;
  block?: string; // header rows — skip
}

interface NormalisedWorkout {
  workoutName: string;
  goal: string;
  location: string;
  level: string;
  duration: number; // minutes as integer
  exercises: RawExercise[];
  imageUrl?: string; // Cloudinary thumbnail URL — add to workout JSON after upload
  videoUrl?: string; // Cloudinary loop video URL — add to workout JSON after upload
}

/**
 * Parse a reps string to a single integer (takes lower bound of ranges).
 * "8-10" → 8, "30s" → 12 (time-based default), "10-12 each" → 10
 */
function parseReps(reps: string | number | undefined): number {
  if (reps === undefined || reps === null) return 10;
  const str = String(reps).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const rangeMatch = str.match(/^(\d+)\s*[-–]\s*\d+/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  if (/s$/i.test(str)) return 12; // time-based (e.g. "30s") — treat as 12 reps
  const singleMatch = str.match(/^(\d+)/);
  if (singleMatch) return parseInt(singleMatch[1], 10);
  return 10;
}

/**
 * Parse rest string to seconds integer.
 * "90s" → 90, "2 min" → 120, "75s between legs" → 75, "60" → 60
 */
function parseRestSeconds(rest: string | undefined): number {
  if (!rest) return 60;
  const minMatch = rest.match(/(\d+(?:\.\d+)?)\s*min/i);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
  const secMatch = rest.match(/(\d+)\s*s/i);
  if (secMatch) return parseInt(secMatch[1], 10);
  const numMatch = rest.match(/^(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return 60;
}

/**
 * Parse duration to integer minutes.
 * "60 min" → 60, "50 min" → 50, 30 → 30
 */
function parseDuration(duration: string | number | undefined): number {
  if (!duration) return 45;
  if (typeof duration === "number") return duration;
  const match = duration.toString().match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 45;
}

/**
 * Flatten workouts_build_muscle.json / workouts_get_fit.json
 */
function normaliseFlatJSON(raw: {
  goal: string;
  workouts: Array<{
    workoutName: string;
    goal: string;
    location: string;
    level: string;
    duration: string | number;
    mainWorkout: RawExercise[];
    imageUrl?: string;
    videoUrl?: string;
  }>;
}): NormalisedWorkout[] {
  return raw.workouts.map((w) => ({
    workoutName: w.workoutName,
    goal: w.goal,
    location: w.location,
    level: w.level,
    duration: parseDuration(w.duration),
    exercises: w.mainWorkout.filter((e) => e.exercise !== undefined),
    imageUrl: w.imageUrl,
    videoUrl: w.videoUrl,
  }));
}

/**
 * Flatten workouts_lose_weight.json
 */
function normaliseNestedJSON(raw: {
  skeletons: Array<{
    variations: Array<{
      workoutName: string;
      goal: string;
      location: string;
      level: string;
      duration: string | number;
      mainWorkout: RawExercise[];
      imageUrl?: string;
      videoUrl?: string;
    }>;
  }>;
}): NormalisedWorkout[] {
  return raw.skeletons.flatMap((s) =>
    s.variations.map((v) => ({
      workoutName: v.workoutName,
      goal: v.goal,
      location: v.location,
      level: v.level,
      duration: parseDuration(v.duration),
      exercises: v.mainWorkout.filter((e) => e.exercise !== undefined),
      imageUrl: v.imageUrl,
      videoUrl: v.videoUrl,
    })),
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  // ── 1. Equipment ──────────────────────────
  console.log("Seeding equipment...");
  for (const item of equipmentSeed) {
    await prisma.equipment.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }
  const equipmentRecords = await prisma.equipment.findMany();
  const equipmentByName = new Map(equipmentRecords.map((e) => [e.name, e.id]));
  console.log(`  ✓ ${equipmentSeed.length} equipment items`);

  // ── 2. Exercises ──────────────────────────
  console.log("Seeding exercises...");

  for (const ex of exercises) {
    const muscleGroup = toMuscleGroup(ex.movementPattern);
    const impactLevel = toImpactLevel(ex.impactLevel);
    const musclesWorked = [
      ...(ex.primaryMuscles ?? []),
      ...(ex.secondaryMuscles ?? []),
    ];
    const isBodyweight =
      ex.equipment.length === 1 && ex.equipment[0] === "BODYWEIGHT";

    // Resolve catalogue equipment ids (skip gym-only tokens not in our catalogue)
    const catalogueEquipmentIds = ex.equipment
      .map((token: string) => {
        const name = EQUIPMENT_TOKEN_TO_NAME[token];
        if (!name) return null;
        return equipmentByName.get(name) ?? null;
      })
      .filter((id): id is string => id !== null);

    // Primary equipmentId — first catalogue match (or null for gym-only exercises)
    const primaryEquipmentId = catalogueEquipmentIds[0] ?? null;

    // Asset URLs read directly from exercises.ts — add them there after Cloudinary upload
    const description = EXERCISE_DESCRIPTIONS[ex.name] ?? null;
    const thumbnailUrl = (ex as { thumbnailUrl?: string }).thumbnailUrl ?? null;
    const videoUrl = (ex as { videoUrl?: string }).videoUrl ?? null;

    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {
        muscleGroup,
        musclesWorked: { set: musclesWorked },
        impactLevel,
        isBodyweight,
        equipmentId: primaryEquipmentId,
        description,
        thumbnailUrl,
        videoUrl,
      },
      create: {
        name: ex.name,
        muscleGroup,
        musclesWorked,
        impactLevel,
        isBodyweight,
        equipmentId: primaryEquipmentId,
        description,
        thumbnailUrl,
        videoUrl,
      },
    });

    // Sync ExerciseEquipment join table
    if (catalogueEquipmentIds.length > 0) {
      const exerciseRecord = await prisma.exercise.findUnique({
        where: { name: ex.name },
      });
      if (exerciseRecord) {
        await prisma.exerciseEquipment.deleteMany({
          where: { exerciseId: exerciseRecord.id },
        });
        await prisma.exerciseEquipment.createMany({
          data: catalogueEquipmentIds.map((equipmentId) => ({
            exerciseId: exerciseRecord.id,
            equipmentId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const badge = [thumbnailUrl && "🖼", videoUrl && "🎬"]
      .filter(Boolean)
      .join(" ");
    console.log(`  ✓ ${ex.name}${badge ? "  " + badge : ""}`);
  }
  console.log(`  ${exercises.length} exercises seeded.`);

  // ── 3. Workout Plans ──────────────────────
  console.log("Seeding workout plans...");

  const exerciseRecords = await prisma.exercise.findMany();
  const exerciseByName = new Map(exerciseRecords.map((e) => [e.name, e.id]));

  // Normalise all three JSON files into a common shape
  const allWorkouts: NormalisedWorkout[] = [
    ...normaliseFlatJSON(
      buildMuscleRaw as Parameters<typeof normaliseFlatJSON>[0],
    ),
    ...normaliseNestedJSON(
      loseWeightRaw as Parameters<typeof normaliseNestedJSON>[0],
    ),
    ...normaliseFlatJSON(getFitRaw as Parameters<typeof normaliseFlatJSON>[0]),
  ];

  let seeded = 0;
  let skipped = 0;

  for (const workout of allWorkouts) {
    // Filter to exercises that exist in our exercise library
    const validExercises = workout.exercises.filter((e) => {
      if (!e.exercise) return false;
      if (!exerciseByName.has(e.exercise)) {
        console.warn(
          `    ⚠ Skipping unknown exercise: "${e.exercise}" in "${workout.workoutName}"`,
        );
        return false;
      }
      return true;
    });

    if (validExercises.length === 0) {
      console.warn(
        `  ⚠ No valid exercises for "${workout.workoutName}" — skipping plan`,
      );
      skipped++;
      continue;
    }

    const goalTarget = toPrimaryGoal(workout.goal);
    const tier: PlanTier = PlanTier.FREE;

    // Derive a sensible muscleGroup from the exercise mix
    const muscleGroupCounts: Record<string, number> = {};
    for (const e of validExercises) {
      const exRecord = exerciseRecords.find((r) => r.name === e.exercise);
      if (exRecord) {
        muscleGroupCounts[exRecord.muscleGroup] =
          (muscleGroupCounts[exRecord.muscleGroup] ?? 0) + 1;
      }
    }
    const dominantMuscleGroup = (Object.entries(muscleGroupCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] ?? "FULLBODY") as MuscleGroup;

    // Asset URLs read directly from workout JSON — add them there after Cloudinary upload
    const imageUrl = workout.imageUrl ?? null;
    const videoUrl = workout.videoUrl ?? null;

    const plan = await prisma.workoutPlan.upsert({
      where: { name: workout.workoutName },
      update: {
        description: `${workout.goal} — ${workout.location} — ${workout.level}`,
        muscleGroup: dominantMuscleGroup,
        durationWeeks: 4,
        sessionsPerWeek: 3,
        tier,
        goalTarget,
        difficulty: workout.level,
        sessionDurationMin: String(workout.duration),
        imageUrl,
        videoUrl,
      },
      create: {
        name: workout.workoutName,
        description: `${workout.goal} — ${workout.location} — ${workout.level}`,
        muscleGroup: dominantMuscleGroup,
        durationWeeks: 4,
        sessionsPerWeek: 3,
        tier,
        goalTarget,
        difficulty: workout.level,
        sessionDurationMin: String(workout.duration),
        imageUrl,
        videoUrl,
      },
    });

    // Delete existing session (clean re-seed)
    await prisma.plannedSession.deleteMany({ where: { planId: plan.id } });

    // Each workout is a single session
    const plannedSession = await prisma.plannedSession.create({
      data: {
        planId: plan.id,
        sessionNumber: 1,
        focus: workout.exercises[0]?.exercise ?? workout.workoutName,
        estimatedMinutes: workout.duration,
      },
    });

    for (let i = 0; i < validExercises.length; i++) {
      const e = validExercises[i];
      const exerciseId = exerciseByName.get(e.exercise!)!;
      const repsVal = parseReps(e.reps);
      const setsVal = e.sets ?? 3;
      const restSeconds = parseRestSeconds(e.rest);

      // Sets/reps scaled by level — beginner down, advanced up
      const beginnerSets = Math.max(1, setsVal - 1);
      const beginnerReps = Math.max(6, repsVal - 2);
      const intermediateSets = setsVal;
      const intermediateReps = repsVal;
      const advancedSets = setsVal + 1;
      const advancedReps = repsVal + 2;

      await prisma.plannedExercise.create({
        data: {
          sessionId: plannedSession.id,
          exerciseId,
          order: i + 1,
          beginnerSets,
          beginnerReps,
          intermediateSets,
          intermediateReps,
          advancedSets,
          advancedReps,
          restSeconds,
        },
      });
    }

    console.log(
      `  ✓ ${workout.workoutName} — ${validExercises.length} exercises`,
    );
    seeded++;
  }

  console.log(`  ${seeded} plans seeded, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
