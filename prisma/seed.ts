import "dotenv/config";
import {
  PrismaClient,
  MuscleGroup,
  PlanTier,
  ImpactLevel,
  PrimaryGoal,
  EnvironmentTarget,
  SexTarget,
} from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import exercises from "../src/training/exercises";

import buildMuscleRaw from "../src/training/workouts_build_muscle.json";
import loseWeightRaw from "../src/training/workouts_lose_weight.json";
import getFitRaw from "../src/training/workouts_get_fit.json";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// All three JSON files now share the same flat shape.
// ─────────────────────────────────────────────────────────────────────────────

interface RawExercise {
  exercise?: string;
  sets?: number;
  reps?: string | number;
  rest?: string;
  block?: string;
}

interface RawWorkout {
  workoutName: string;
  goal: string;
  location: string;
  level: string;
  sex?: string;
  muscleGroup?: string;
  environmentTarget?: string;
  collection?: string;
  duration: string | number;
  mainWorkout: RawExercise[];
  imageUrl?: string;
  videoUrl?: string;
}

interface WorkoutGoalFile {
  goal: string;
  workouts: RawWorkout[];
}

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL MAP
// Build an exercise-name → cloudinary URL lookup from all workout JSON files.
// ─────────────────────────────────────────────────────────────────────────────

function buildThumbnailMap(): Map<string, string> {
  const map = new Map<string, string>();

  const allEntries: RawExercise[] = [
    ...(buildMuscleRaw as WorkoutGoalFile).workouts.flatMap(
      (w) => w.mainWorkout ?? [],
    ),
    ...(loseWeightRaw as WorkoutGoalFile).workouts.flatMap(
      (w) => w.mainWorkout ?? [],
    ),
    ...(getFitRaw as WorkoutGoalFile).workouts.flatMap(
      (w) => w.mainWorkout ?? [],
    ),
  ];

  for (const entry of allEntries) {
    const e = entry as RawExercise & { thumbnailUrl?: string };
    if (e.exercise && e.thumbnailUrl?.startsWith("https://")) {
      if (!map.has(e.exercise)) {
        map.set(e.exercise, e.thumbnailUrl);
      }
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SETUP
// ─────────────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT TOKEN MAP (exercises.ts → equipment catalogue name)
// ─────────────────────────────────────────────────────────────────────────────

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
  // GYM-only equipment — not in our home catalogue, skip gracefully
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

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE DESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  "Bodyweight Squat":
    "Stand with feet shoulder-width apart, push your hips back and bend your knees until thighs are parallel to the floor, then drive through your heels to stand.",
  "Jump Squat":
    "Perform a squat then drive explosively through your legs to jump off the ground. Land softly with knees slightly bent.",
  "Bulgarian Split Squat":
    "A single-leg squat with the rear foot elevated on a bench. Targets the quads, glutes, and hip flexors.",
  "Walking Lunge":
    "Step forward into a lunge, lower your back knee toward the floor, then bring your rear foot forward to repeat on the other side.",
  "Reverse Lunge":
    "Step backward into a lunge, lowering the rear knee to just above the floor.",
  "Lateral Lunge":
    "Step wide to one side, shift your weight over that leg and push your hips back into a deep lateral squat.",
  "Glute Bridge":
    "Lie on your back with knees bent and feet flat. Drive your hips up until your body forms a straight line from shoulders to knees.",
  "Single-Leg Glute Bridge":
    "A glute bridge on one leg at a time, increasing unilateral glute and hamstring demand.",
  "Hip Thrust":
    "Upper back on a bench, feet flat on the floor — drive your hips upward by squeezing your glutes.",
  "Donkey Kick":
    "On all fours, kick one leg back and up keeping the knee bent at 90°.",
  "Fire Hydrant":
    "On all fours, lift one knee out to the side to 90°. Targets the glute medius.",
  "Calf Raise":
    "Stand hip-width apart and rise onto the balls of your feet, then lower back down with control.",
  "Nordic Hamstring Curl":
    "Kneel with feet anchored and lower your torso toward the floor as slowly as possible.",
  "Wall Sit":
    "Slide down a wall until your thighs are parallel to the floor and hold the position.",
  "Step-Up":
    "Step onto a raised surface one foot at a time, driving through the heel of the leading leg.",
  "Box Jump":
    "Explosively jump onto a sturdy raised platform, landing softly with both feet.",
  "Sumo Squat":
    "Take a wide stance with toes turned out, then squat deep while keeping your chest tall.",
  "Push-Up":
    "Keep your body in a straight line from head to heels, lower your chest to the floor, then press back up.",
  "Wide Push-Up":
    "Hands wider than shoulder-width, lowering your chest toward the floor.",
  "Diamond Push-Up":
    "Hands close together forming a diamond under your chest. Shifts the load to the triceps.",
  "Decline Push-Up":
    "Feet elevated on a bench, hands on the floor. Shifts emphasis to the upper chest.",
  "Incline Push-Up":
    "Hands elevated on a surface, reducing the load. Good entry-level variation.",
  "Pike Push-Up":
    "In a downward-dog position, bend your elbows to lower your head toward the floor then press back up.",
  "Pull-Up":
    "Hang from a bar with an overhand grip and pull your chest toward the bar.",
  "Chin-Up":
    "Like a pull-up but with a supinated (underhand) grip, which brings the biceps more into play.",
  "Inverted Row":
    "Hang beneath a bar with your body straight, then pull your chest up to meet it.",
  Plank:
    "Hold a push-up position on your forearms or hands, keeping your body in a rigid straight line.",
  "Side Plank":
    "Balance on one forearm and the side of your foot, body in a straight line.",
  "Dead Bug":
    "Lying on your back, extend opposite arm and leg toward the floor while keeping your lower back pressed down.",
  Burpee:
    "From standing, drop to a push-up, perform the push-up, jump your feet forward, then explode into a jump.",
  "Kettlebell Swing":
    "Hinge at the hips to swing a kettlebell between your legs, then drive your hips forward to propel it to chest height.",
  "Mountain Climbers":
    "In a push-up position, drive your knees toward your chest alternately at speed.",
  "Jumping Jacks":
    "Jump your feet out wide while raising your arms overhead, then return. Classic cardiovascular warm-up.",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS: enum conversion
// ─────────────────────────────────────────────────────────────────────────────

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
 * All three JSON files now use uppercase enum strings, but the fallback
 * handles any legacy mixed-case values gracefully.
 */
function toPrimaryGoal(goal: string): PrimaryGoal {
  const g = goal.toUpperCase().replace(/\s+/g, "_");
  if (g.includes("MUSCLE")) return PrimaryGoal.BUILD_MUSCLE;
  if (g.includes("WEIGHT") || g.includes("LOSE"))
    return PrimaryGoal.LOSE_WEIGHT;
  return PrimaryGoal.GET_FIT;
}

/**
 * Map environmentTarget string from JSON to EnvironmentTarget enum.
 * Uses the DECLARED value first (new field). Falls back to deriving from
 * location + equipment for any legacy workouts that don't have it.
 */
function toEnvironmentTarget(
  declared: string | undefined,
  location: string,
  hasEquipment: boolean,
): EnvironmentTarget {
  if (declared) {
    const d = declared.toUpperCase();
    if (d === "HOME_BODYWEIGHT") return EnvironmentTarget.HOME_BODYWEIGHT;
    if (d === "HOME_EQUIPMENT") return EnvironmentTarget.HOME_EQUIPMENT;
    if (d === "GYM") return EnvironmentTarget.GYM;
    if (d === "ANY") return EnvironmentTarget.ANY;
  }
  // Legacy fallback
  const loc = location.toUpperCase();
  if (loc === "GYM") return EnvironmentTarget.GYM;
  if (loc === "HOME") {
    return hasEquipment
      ? EnvironmentTarget.HOME_EQUIPMENT
      : EnvironmentTarget.HOME_BODYWEIGHT;
  }
  return EnvironmentTarget.ANY;
}

/**
 * Map muscleGroup string from JSON to MuscleGroup enum.
 * Uses the DECLARED value first. Falls back to FULLBODY.
 */
function toDeclaredMuscleGroup(declared: string | undefined): MuscleGroup {
  if (declared) {
    const d = declared.toUpperCase();
    if (d === "UPPER") return MuscleGroup.UPPER;
    if (d === "LOWER") return MuscleGroup.LOWER;
    if (d === "CORE") return MuscleGroup.CORE;
    if (d === "FULLBODY") return MuscleGroup.FULLBODY;
  }
  return MuscleGroup.FULLBODY;
}

/**
 * Map sex string to a value storable in the sexTarget column.
 * Returns null for "ANY" (shown to everyone) or if not declared.
 */
function toSexTarget(sex: string | undefined): SexTarget | null {
  if (!sex) return null;
  const s = sex.toUpperCase();
  if (s === "MALE") return SexTarget.MALE;
  if (s === "FEMALE") return SexTarget.FEMALE;
  return null; // "ANY" → null = shown to everyone
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS: parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseReps(reps: string | number | undefined): number {
  if (reps === undefined || reps === null) return 10;
  const str = String(reps).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const rangeMatch = str.match(/^(\d+)\s*[-–]\s*\d+/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  if (/s$/i.test(str)) return 12; // time-based e.g. "30s" → 12 reps
  const singleMatch = str.match(/^(\d+)/);
  if (singleMatch) return parseInt(singleMatch[1], 10);
  return 10;
}

function parseSets(sets: number | string | undefined): number {
  if (sets === undefined || sets === null) return 3;
  if (typeof sets === "number" && !isNaN(sets)) return sets;
  const str = String(sets).trim();
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 3;
}

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

function parseDuration(duration: string | number | undefined): number {
  if (!duration) return 45;
  if (typeof duration === "number") return duration;
  const match = duration.toString().match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 45;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISED WORKOUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface NormalisedWorkout {
  workoutName: string;
  goal: string;
  location: string;
  level: string;
  sex?: string;
  muscleGroup?: string;
  environmentTarget?: string;
  collection?: string;
  duration: number;
  exercises: RawExercise[];
  imageUrl?: string;
  videoUrl?: string;
}

/**
 * All three files are now flat — one normaliser handles them all.
 */
function normaliseJSON(raw: WorkoutGoalFile): NormalisedWorkout[] {
  return raw.workouts.map((w) => ({
    workoutName: w.workoutName,
    goal: w.goal,
    location: w.location,
    level: w.level,
    sex: w.sex,
    muscleGroup: w.muscleGroup,
    environmentTarget: w.environmentTarget,
    collection: w.collection,
    duration: parseDuration(w.duration),
    exercises: w.mainWorkout.filter((e) => e.exercise !== undefined),
    imageUrl: w.imageUrl,
    videoUrl: w.videoUrl,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE NAME ALIASES
// Resolve workout JSON names → exercises.ts canonical names
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_NAME_ALIASES: Record<string, string> = {
  // RDL variants
  "Romanian Deadlift": "Romanian Deadlift (RDL)",
  "Romanian Deadlift (Dumbbell)": "Dumbbell RDL",
  "Romanian Deadlift (Bodyweight)": "Romanian Deadlift (RDL)",
  "Bodyweight Romanian Deadlift": "Romanian Deadlift (RDL)",
  "Single Leg Romanian Deadlift (Bodyweight)": "Single Leg Romanian Deadlift",
  "Single Leg Romanian Deadlift": "Single Leg Romanian Deadlift",

  // Row variants
  "Dumbbell Row (Single Arm)": "Dumbbell Row",
  "Inverted Row": "Inverted Row (TRX Row)",
  "Machine Row": "Seated Cable Row",

  // Dip variants
  "Tricep Dip (Chair)": "Chest Dip",
  "Tricep Dip (Chest Dip)": "Chest Dip",
  "Chest Dip": "Chest Dip",

  // Press variants
  "Dumbbell Shoulder Press": "Overhead Dumbbell Press",
  "Single Arm DB Press (Flat)": "Single Arm Dumbbell Press",

  // Good Morning variants
  "Good Morning (Bodyweight)": "Good Morning",
  "Bodyweight Good Morning": "Good Morning",

  // Squat variants
  "Tempo Squat (Bodyweight)": "Tempo Squat",
  "Pistol Squat (or progression)": "Pistol Squat",
  "Box Squat": "Bodyweight Squat",

  // Carries
  "Farmer's Carry": "Farmer's Carry",
  "Suitcase Carry": "Farmer's Carry",

  // Lateral raise
  "Lateral Raise": "Dumbbell Lateral Raise",
  "Lateral Raise (DB)": "Dumbbell Lateral Raise",
  "Upright Row (DB)": "Dumbbell Upright Row",

  // Sprint
  "Sprint Intervals (Running)": "Sprint Intervals",

  // Plyo
  "Skater Lunge": "Skater Jump",
  "Forward Lunge": "Walking Lunge",

  // Conditioning
  "Battle Ropes": "Battle Rope Waves",
  "Rowing Machine": "Rowing Erg",
  "Assault Bike": "Assault Bike Sprint",

  // KB
  "Kettlebell Goblet Squat": "Goblet Squat",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Equipment ──────────────────────────────────────────────────────────
  console.log("Seeding equipment...");
  const thumbnailMap = buildThumbnailMap();

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

  // ── 2. Exercises ──────────────────────────────────────────────────────────
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

    const catalogueEquipmentIds = ex.equipment
      .map((token: string) => {
        const name = EQUIPMENT_TOKEN_TO_NAME[token];
        if (!name) return null;
        return equipmentByName.get(name) ?? null;
      })
      .filter((id): id is string => id !== null);

    const primaryEquipmentId = catalogueEquipmentIds[0] ?? null;
    const description = EXERCISE_DESCRIPTIONS[ex.name] ?? null;
    const thumbnailUrl =
      (ex as { thumbnailUrl?: string }).thumbnailUrl ??
      thumbnailMap.get(ex.name) ??
      null;
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

  // ── 3. Workout Plans ──────────────────────────────────────────────────────
  console.log("Seeding workout plans...");

  const exerciseRecords = await prisma.exercise.findMany();
  const exerciseByName = new Map(exerciseRecords.map((e) => [e.name, e.id]));

  // All three JSON files are now flat — one normaliser handles them all
  const allWorkouts: NormalisedWorkout[] = [
    ...normaliseJSON(buildMuscleRaw as unknown as WorkoutGoalFile),
    ...normaliseJSON(loseWeightRaw as unknown as WorkoutGoalFile),
    ...normaliseJSON(getFitRaw as unknown as WorkoutGoalFile),
  ];

  let seeded = 0;
  let skipped = 0;

  for (const workout of allWorkouts) {
    // Resolve exercise aliases and filter to known exercises
    const validExercises = workout.exercises.filter((e) => {
      if (!e.exercise) return false;
      const resolvedName = EXERCISE_NAME_ALIASES[e.exercise] ?? e.exercise;
      e.exercise = resolvedName;
      if (!exerciseByName.has(resolvedName)) {
        console.warn(
          `    ⚠ Skipping unknown exercise: "${resolvedName}" in "${workout.workoutName}"`,
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

    // ── Goal ──────────────────────────────────────────────────────────────
    const goalTarget = toPrimaryGoal(workout.goal);

    // ── MuscleGroup: use DECLARED value (no inference) ────────────────────
    const muscleGroup = toDeclaredMuscleGroup(workout.muscleGroup);

    // ── EnvironmentTarget: use DECLARED value (fallback to derivation) ────
    const planNeedsEquipment = validExercises.some((e) => {
      const exRecord = exerciseRecords.find((r) => r.name === e.exercise);
      return exRecord ? !exRecord.isBodyweight : false;
    });
    const environmentTarget = toEnvironmentTarget(
      workout.environmentTarget,
      workout.location,
      planNeedsEquipment,
    );

    // ── SexTarget: null = shown to everyone ───────────────────────────────
    const sexTarget = toSexTarget(workout.sex);

    // ── Collection: optional series grouping ─────────────────────────────
    const collection = workout.collection ?? null;

    // ── Tier ─────────────────────────────────────────────────────────────
    const tier: PlanTier = PlanTier.FREE;

    // ── Asset URLs ────────────────────────────────────────────────────────
    const imageUrl = workout.imageUrl ?? null;
    const videoUrl = workout.videoUrl ?? null;

    // ── Upsert the WorkoutPlan ────────────────────────────────────────────
    const plan = await prisma.workoutPlan.upsert({
      where: { name: workout.workoutName },
      update: {
        description: `${workout.goal} — ${workout.location} — ${workout.level}`,
        muscleGroup,
        durationWeeks: 4,
        sessionsPerWeek: 3,
        tier,
        goalTarget,
        difficulty: workout.level.toUpperCase(),
        sessionDurationMin: String(workout.duration),
        imageUrl,
        videoUrl,
        environmentTarget,
        sexTarget,
        collection,
      },
      create: {
        name: workout.workoutName,
        description: `${workout.goal} — ${workout.location} — ${workout.level}`,
        muscleGroup,
        durationWeeks: 4,
        sessionsPerWeek: 3,
        tier,
        goalTarget,
        difficulty: workout.level.toUpperCase(),
        sessionDurationMin: String(workout.duration),
        imageUrl,
        videoUrl,
        environmentTarget,
        sexTarget,
        collection,
      },
    });

    await prisma.workoutLog.deleteMany({
      where: {
        plannedExercise: {
          session: { planId: plan.id },
        },
      },
    });
    await prisma.plannedSession.deleteMany({ where: { planId: plan.id } });

    // ── Pre-compute exercise payloads once — all sessions share the same list ──
    const exercisePayloads = validExercises.map((e, i) => {
      const exerciseId = exerciseByName.get(e.exercise!)!;
      const repsVal = parseReps(e.reps);
      const setsVal = parseSets(e.sets);
      const restSeconds = parseRestSeconds(e.rest);

      return {
        exerciseId,
        order: i + 1,
        beginnerSets: Math.max(1, setsVal - 1),
        beginnerReps: Math.max(6, repsVal - 2),
        intermediateSets: setsVal,
        intermediateReps: repsVal,
        advancedSets: setsVal + 1,
        advancedReps: repsVal + 2,
        restSeconds,
      };
    });

    // ── Create all 12 planned sessions (4 weeks × 3 per week) ────────────
    const TOTAL_SESSIONS = 4 * 3;

    for (
      let sessionNumber = 1;
      sessionNumber <= TOTAL_SESSIONS;
      sessionNumber++
    ) {
      const plannedSession = await prisma.plannedSession.create({
        data: {
          planId: plan.id,
          sessionNumber,
          focus: validExercises[0]?.exercise ?? workout.workoutName,
          estimatedMinutes: workout.duration,
        },
      });

      await prisma.plannedExercise.createMany({
        data: exercisePayloads.map((payload) => ({
          ...payload,
          sessionId: plannedSession.id,
        })),
      });
    }
    console.log(
      `  ✓ ${workout.workoutName} [${workout.goal} | ${environmentTarget} | ${workout.level} | ${muscleGroup}${collection ? ` | ${collection}` : ""}${sexTarget ? ` | ${sexTarget}` : ""}] — ${validExercises.length} exercises`,
    );
    seeded++;
  }

  console.log(`\n  ${seeded} plans seeded, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
