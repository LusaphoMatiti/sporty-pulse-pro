import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { programs } from "./data/program";

import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

const prisma = new PrismaClient({ adapter });
// ─────────────────────────────────────────────
// EQUIPMENT
// ─────────────────────────────────────────────
const equipment = [
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
// EXERCISES
// ─────────────────────────────────────────────
const exercises = [
  // ══════════════════════════════════════════
  // BODYWEIGHT — UPPER
  // ══════════════════════════════════════════
  {
    name: "Push-Up",
    description:
      "Standard push-up. Hands shoulder-width, lower chest to floor, press back up.",
    youtubeUrl: "https://www.youtube.com/watch?v=IODxDxX7oi4",
    musclesWorked: ["chest", "triceps", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Wide Push-Up",
    description: "Hands wider than shoulder-width. Increases chest emphasis.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Diamond Push-Up",
    description: "Hands together forming a diamond. Maximum tricep activation.",
    youtubeUrl: null,
    musclesWorked: ["triceps", "chest"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Pike Push-Up",
    description:
      "Hips high, lower head toward floor. Builds shoulder strength.",
    youtubeUrl: null,
    musclesWorked: ["front_deltoid", "triceps", "upper_trapezius"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Tricep Dip",
    description: "Hands on a chair or ledge behind you, lower and press up.",
    youtubeUrl: null,
    musclesWorked: ["triceps", "chest", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Inverted Row",
    description: "Lie under a table, grip the edge, pull chest up to it.",
    youtubeUrl: null,
    musclesWorked: ["lats", "rhomboids", "biceps", "rear_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Superman Hold",
    description:
      "Lie face down, lift arms and legs off the floor simultaneously.",
    youtubeUrl: null,
    musclesWorked: ["erector_spinae", "glutes", "rear_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Bodyweight",
  },

  // ══════════════════════════════════════════
  // BODYWEIGHT — LOWER
  // ══════════════════════════════════════════
  {
    name: "Bodyweight Squat",
    description:
      "Feet shoulder-width, squat until thighs parallel, stand tall.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "adductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Reverse Lunge",
    description: "Step back into a lunge. Easier on knees than forward lunge.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Bulgarian Split Squat",
    description: "Rear foot elevated on a chair. Deep unilateral squat.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "hip_flexors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Glute Bridge",
    description: "Lie on back, drive hips to ceiling, squeeze glutes at top.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Single-Leg Glute Bridge",
    description:
      "Same as glute bridge but one leg extended. High glute demand.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Wall Sit",
    description:
      "Back flat on wall, thighs parallel to floor. Isometric quad hold.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Calf Raise",
    description: "Rise onto toes, hold, lower slowly. Targets gastrocnemius.",
    youtubeUrl: null,
    musclesWorked: ["calves"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Bodyweight",
  },

  // ══════════════════════════════════════════
  // BODYWEIGHT — CORE
  // ══════════════════════════════════════════
  {
    name: "Plank",
    description:
      "Forearms on floor, rigid body. Hold without letting hips drop.",
    youtubeUrl: null,
    musclesWorked: ["transverse_abdominis", "obliques", "glutes"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Side Plank",
    description: "Forearm on floor, body in a straight line sideways.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "quadratus_lumborum", "glutes"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Dead Bug",
    description:
      "Lie on back, extend opposite arm and leg while keeping low back pressed to floor.",
    youtubeUrl: null,
    musclesWorked: ["transverse_abdominis", "hip_flexors"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Hollow Body Hold",
    description:
      "Lie on back, arms overhead, legs raised. Press lower back to floor.",
    youtubeUrl: null,
    musclesWorked: ["rectus_abdominis", "transverse_abdominis"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Mountain Climber",
    description: "From push-up position, drive knees alternately toward chest.",
    youtubeUrl: null,
    musclesWorked: ["transverse_abdominis", "hip_flexors", "obliques"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Bicycle Crunch",
    description:
      "Elbow to opposite knee in a cycling motion. Targets obliques.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "rectus_abdominis"],
    muscleGroup: "CORE" as const,
    equipmentName: "Bodyweight",
  },

  // ══════════════════════════════════════════
  // BODYWEIGHT — FULL BODY
  // ══════════════════════════════════════════
  {
    name: "Burpee",
    description:
      "Squat, jump feet back, push-up, jump feet forward, jump up. Full body conditioning.",
    youtubeUrl: null,
    musclesWorked: ["full_body"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Jump Squat",
    description: "Squat down, explode up into a jump, land softly.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "calves"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Bear Crawl",
    description:
      "On hands and feet (knees hovering), crawl forward keeping hips low.",
    youtubeUrl: null,
    musclesWorked: ["shoulders", "core", "quads"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Bodyweight",
  },
  {
    name: "Inchworm",
    description:
      "Bend to floor, walk hands out to push-up, walk feet to hands, repeat.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "core", "shoulders"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Bodyweight",
  },

  // ══════════════════════════════════════════
  // KETTLEBELL — UPPER
  // ══════════════════════════════════════════
  {
    name: "Kettlebell Press",
    description: "Clean to rack, press overhead from shoulder. Single arm.",
    youtubeUrl: "https://www.youtube.com/watch?v=d_EOG8k39mM",
    musclesWorked: ["front_deltoid", "triceps", "upper_trapezius"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Push Press",
    description:
      "Slight leg dip to drive kettlebell overhead. More load than strict press.",
    youtubeUrl: null,
    musclesWorked: ["front_deltoid", "triceps", "quads"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Row",
    description: "Hinge forward, row kettlebell to hip. Single arm.",
    youtubeUrl: "https://www.youtube.com/watch?v=pYcpY20QaE8",
    musclesWorked: ["lats", "rhomboids", "biceps", "rear_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Floor Press",
    description:
      "Lie on floor, press kettlebell from chest. Limits shoulder range safely.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Halo",
    description:
      "Circle kettlebell around head. Builds shoulder stability and mobility.",
    youtubeUrl: null,
    musclesWorked: ["deltoids", "upper_trapezius", "triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Renegade Row",
    description:
      "Plank on two kettlebells, row one at a time. Core and back together.",
    youtubeUrl: null,
    musclesWorked: ["lats", "rhomboids", "core", "triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Kettlebell",
  },

  // ══════════════════════════════════════════
  // KETTLEBELL — LOWER
  // ══════════════════════════════════════════
  {
    name: "Kettlebell Goblet Squat",
    description: "Hold KB at chest, squat deep. Keeps torso upright.",
    youtubeUrl: "https://www.youtube.com/watch?v=MxsFDhcyFyE",
    musclesWorked: ["quads", "glutes", "adductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Romanian Deadlift",
    description:
      "Hinge at hips, KB down shins, feel hamstring stretch, drive hips forward.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "glutes", "erector_spinae"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Swing",
    description:
      "Explosive hip hinge. KB swings to chest height. Power from glutes.",
    youtubeUrl: "https://www.youtube.com/watch?v=sSESeQAir2M",
    musclesWorked: ["glutes", "hamstrings", "core"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Sumo Deadlift",
    description:
      "Wide stance, both hands on KB, hinge and pull. Inner thigh emphasis.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "adductors", "hamstrings", "quads"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Lunge",
    description: "Hold KB in rack or at side, step into reverse lunge.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Single-Leg Deadlift",
    description: "Stand on one leg, hinge forward with KB in opposite hand.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "glutes", "hip_stabilisers"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Kettlebell",
  },

  // ══════════════════════════════════════════
  // KETTLEBELL — CORE
  // ══════════════════════════════════════════
  {
    name: "Kettlebell Windmill",
    description:
      "KB pressed overhead, hinge sideways to touch floor. Obliques and shoulder stability.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "glutes", "shoulder_stabilisers"],
    muscleGroup: "CORE" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Suitcase Carry",
    description: "Walk with KB in one hand. Resist side-bend the entire walk.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "quadratus_lumborum", "forearms"],
    muscleGroup: "CORE" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Russian Twist",
    description: "Seated, lean back, rotate KB side to side.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "rectus_abdominis"],
    muscleGroup: "CORE" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Dead Bug",
    description:
      "Lie on back, hold KB above chest, extend opposite arm and leg.",
    youtubeUrl: null,
    musclesWorked: ["transverse_abdominis", "hip_flexors"],
    muscleGroup: "CORE" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Farmer's Carry",
    description:
      "Walk with heavy KB in each hand. Total body stability and grip.",
    youtubeUrl: null,
    musclesWorked: ["forearms", "trapezius", "core", "glutes"],
    muscleGroup: "CORE" as const,
    equipmentName: "Kettlebell",
  },

  // ══════════════════════════════════════════
  // KETTLEBELL — FULL BODY
  // ══════════════════════════════════════════
  {
    name: "Kettlebell Clean",
    description:
      "Swing KB from floor to rack position in one explosive movement.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Snatch",
    description:
      "One motion from floor to locked-out overhead. Full body power.",
    youtubeUrl: "https://www.youtube.com/watch?v=0MHaJDOnHXM",
    musclesWorked: ["glutes", "hamstrings", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Kettlebell Thruster",
    description: "Front squat into overhead press in one fluid movement.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Kettlebell",
  },
  {
    name: "Turkish Get-Up",
    description:
      "From lying with KB overhead, stand up in controlled steps. Masterclass in stability.",
    youtubeUrl: null,
    musclesWorked: ["shoulders", "core", "glutes", "hip_stabilisers"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Kettlebell",
  },

  // ══════════════════════════════════════════
  // DUMBBELLS — UPPER
  // ══════════════════════════════════════════
  {
    name: "Dumbbell Shoulder Press",
    description:
      "Seated or standing, press dumbbells from shoulders to overhead.",
    youtubeUrl: null,
    musclesWorked: ["front_deltoid", "triceps", "upper_trapezius"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Lateral Raise",
    description:
      "Arms at sides, raise dumbbells to shoulder height. Targets side delts.",
    youtubeUrl: null,
    musclesWorked: ["lateral_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Bent-Over Row",
    description: "Hinge at hips, row both dumbbells to hips simultaneously.",
    youtubeUrl: null,
    musclesWorked: ["lats", "rhomboids", "biceps", "rear_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Bicep Curl",
    description: "Curl dumbbells from hips to shoulders. Keep elbows pinned.",
    youtubeUrl: null,
    musclesWorked: ["biceps", "brachialis"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Tricep Overhead Extension",
    description:
      "Hold one dumbbell overhead with both hands, lower behind head, press up.",
    youtubeUrl: null,
    musclesWorked: ["triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Chest Fly",
    description:
      "Lying on floor or bench, wide arc from overhead to chest height.",
    youtubeUrl: null,
    musclesWorked: ["chest", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Floor Press",
    description:
      "Lie on floor, press dumbbells from chest. Chest and tricep builder.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dumbbell",
  },

  // ══════════════════════════════════════════
  // DUMBBELLS — LOWER
  // ══════════════════════════════════════════
  {
    name: "Dumbbell Goblet Squat",
    description: "Hold one dumbbell vertically at chest. Squat deep.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "adductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Romanian Deadlift",
    description:
      "Hinge at hips with dumbbells in hands, feel hamstring load, return.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "glutes", "erector_spinae"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Walking Lunge",
    description: "Step forward into lunge, alternate legs moving forward.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Step-Up",
    description:
      "Step up onto a box or chair holding dumbbells. Single leg strength.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Hip Thrust",
    description: "Shoulders on bench, dumbbell on hips, drive hips to ceiling.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Calf Raise",
    description: "Hold dumbbells at sides, rise onto toes, lower slowly.",
    youtubeUrl: null,
    musclesWorked: ["calves"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Dumbbell",
  },

  // ══════════════════════════════════════════
  // DUMBBELLS — CORE
  // ══════════════════════════════════════════
  {
    name: "Dumbbell Russian Twist",
    description: "Seated, lean back, hold dumbbell, rotate side to side.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "rectus_abdominis"],
    muscleGroup: "CORE" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Woodchop",
    description: "Diagonal pull from one hip across body to opposite shoulder.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "shoulders", "core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Suitcase Carry",
    description: "Walk holding one dumbbell. Resist leaning toward the weight.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "quadratus_lumborum", "forearms"],
    muscleGroup: "CORE" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Pullover",
    description: "Lie on floor, hold dumbbell overhead, arc to chest and back.",
    youtubeUrl: null,
    musclesWorked: ["lats", "chest", "triceps", "core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Dumbbell",
  },

  // ══════════════════════════════════════════
  // DUMBBELLS — FULL BODY
  // ══════════════════════════════════════════
  {
    name: "Dumbbell Thruster",
    description: "Front squat into overhead press. One fluid movement.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Man Maker",
    description:
      "Push-up, row each arm, clean, thruster. The hardest full body movement.",
    youtubeUrl: null,
    musclesWorked: ["full_body"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Renegade Row",
    description: "Plank on dumbbells, row each arm alternately.",
    youtubeUrl: null,
    musclesWorked: ["lats", "core", "triceps"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Dumbbell",
  },
  {
    name: "Dumbbell Clean and Press",
    description: "Deadlift dumbbells, clean to shoulders, press overhead.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Dumbbell",
  },

  // ══════════════════════════════════════════
  // RESISTANCE BANDS — UPPER
  // ══════════════════════════════════════════
  {
    name: "Band Pull-Apart",
    description: "Hold band at shoulder height, pull apart to full extension.",
    youtubeUrl: null,
    musclesWorked: ["rear_deltoid", "rhomboids", "upper_trapezius"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Overhead Press",
    description: "Stand on band, press handles from shoulders to overhead.",
    youtubeUrl: null,
    musclesWorked: ["front_deltoid", "triceps", "upper_trapezius"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Bicep Curl",
    description: "Stand on band, curl handles to shoulders.",
    youtubeUrl: null,
    musclesWorked: ["biceps", "brachialis"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Tricep Pushdown",
    description: "Anchor band overhead, push handles down to hips.",
    youtubeUrl: null,
    musclesWorked: ["triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Row",
    description: "Anchor band at waist height, row handles to hips.",
    youtubeUrl: null,
    musclesWorked: ["lats", "rhomboids", "biceps", "rear_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Chest Press",
    description:
      "Anchor band behind you, press handles forward at chest height.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps", "front_deltoid"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Face Pull",
    description:
      "Anchor band at face height, pull toward face with elbows high.",
    youtubeUrl: null,
    musclesWorked: ["rear_deltoid", "rhomboids", "external_rotators"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
  },

  // ══════════════════════════════════════════
  // RESISTANCE BANDS — LOWER
  // ══════════════════════════════════════════
  {
    name: "Band Squat",
    description: "Stand on band, handles at shoulders, squat deep.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "adductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Hip Thrust",
    description: "Band across hips, drive hips to ceiling against resistance.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Romanian Deadlift",
    description: "Stand on band, hinge at hips feeling hamstring stretch.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "glutes", "erector_spinae"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Lateral Walk",
    description: "Band around ankles, walk sideways in a squat position.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hip_abductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Kickback",
    description: "On all fours, band around ankle, kick leg back and up.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hamstrings"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Clamshell",
    description:
      "Lie on side, band above knees, open and close like a clamshell.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "hip_abductors"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Resistance Bands",
  },

  // ══════════════════════════════════════════
  // RESISTANCE BANDS — CORE
  // ══════════════════════════════════════════
  {
    name: "Band Pallof Press",
    description:
      "Anchor band at chest height, press and hold away from anchor.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "transverse_abdominis", "core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Woodchop",
    description:
      "Anchor band high, pull diagonally across body to opposite hip.",
    youtubeUrl: null,
    musclesWorked: ["obliques", "core", "shoulders"],
    muscleGroup: "CORE" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Dead Bug",
    description:
      "Lie on back holding band anchored overhead, extend legs alternately.",
    youtubeUrl: null,
    musclesWorked: ["transverse_abdominis", "hip_flexors"],
    muscleGroup: "CORE" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Crunch",
    description: "Anchor band behind head, crunch forward against resistance.",
    youtubeUrl: null,
    musclesWorked: ["rectus_abdominis"],
    muscleGroup: "CORE" as const,
    equipmentName: "Resistance Bands",
  },

  // ══════════════════════════════════════════
  // RESISTANCE BANDS — FULL BODY
  // ══════════════════════════════════════════
  {
    name: "Band Squat to Press",
    description: "Squat on band, stand and press overhead in one movement.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Deadlift to Row",
    description: "Hinge into a deadlift, at the top row the band to hips.",
    youtubeUrl: null,
    musclesWorked: ["hamstrings", "glutes", "lats", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Resistance Bands",
  },
  {
    name: "Band Lunge to Curl",
    description: "Step into a reverse lunge, at the bottom curl the band.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes", "biceps"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Resistance Bands",
  },
  // ══════════════════════════════════════════
  // SPORTY PULSE PRO CUSTOM EQUIPMENT
  // ══════════════════════════════════════════

  {
    name: "Ab Wheel Rollout (Knees)",
    description:
      "Roll forward on knees maintaining a tight core, then pull back.",
    youtubeUrl: null,
    musclesWorked: ["core", "shoulders"],
    muscleGroup: "CORE" as const,
    equipmentName: "Ab Wheel",
    level: "BEGINNER" as const,
  },
  {
    name: "Ab Wheel Rollout (Full)",
    description: "Full rollout from feet, maintaining straight body alignment.",
    youtubeUrl: null,
    musclesWorked: ["core", "shoulders"],
    muscleGroup: "CORE" as const,
    equipmentName: "Ab Wheel",
    level: "ADVANCED" as const,
  },
  {
    name: "Dip Bar Support Hold",
    description: "Hold bodyweight at the top of dip position.",
    youtubeUrl: null,
    musclesWorked: ["triceps", "shoulders", "core"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dip Bars",
    level: "BEGINNER" as const,
  },
  {
    name: "Dip Bar Dips",
    description: "Lower body and press up using dip bars.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dip Bars",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Explosive Dip Bar Dips",
    description: "Perform dips with explosive upward movement.",
    youtubeUrl: null,
    musclesWorked: ["chest", "triceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Dip Bars",
    level: "ADVANCED" as const,
  },
  {
    name: "Pull-Up (Assisted Band)",
    description: "Pull-up using resistance band assistance.",
    youtubeUrl: null,
    musclesWorked: ["lats", "biceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Resistance Bands",
    level: "BEGINNER" as const,
  },
  {
    name: "Pull-Up",
    description: "Standard bodyweight pull-up.",
    youtubeUrl: null,
    musclesWorked: ["lats", "biceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Pull-Up Bar",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Weighted Pull-Up",
    description: "Pull-up with added resistance.",
    youtubeUrl: null,
    musclesWorked: ["lats", "biceps"],
    muscleGroup: "UPPER" as const,
    equipmentName: "Pull-Up Bar",
    level: "ADVANCED" as const,
  },
  {
    name: "Jump Rope Basic",
    description: "Steady pace skipping for cardio.",
    youtubeUrl: null,
    musclesWorked: ["calves", "cardio"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Jumping Rope",
    level: "BEGINNER" as const,
  },
  {
    name: "Jump Rope Speed",
    description: "Faster skipping intervals.",
    youtubeUrl: null,
    musclesWorked: ["calves", "cardio"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Jumping Rope",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Double Unders",
    description: "Rope passes twice per jump.",
    youtubeUrl: null,
    musclesWorked: ["calves", "cardio"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Jumping Rope",
    level: "ADVANCED" as const,
  },
  {
    name: "Battle Rope Waves",
    description: "Alternating arm waves with rope.",
    youtubeUrl: null,
    musclesWorked: ["shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Battle Rope",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Battle Rope Slams",
    description: "Explosive rope slams to the ground.",
    youtubeUrl: null,
    musclesWorked: ["shoulders", "core"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Battle Rope",
    level: "ADVANCED" as const,
  },
  {
    name: "Glute Band Squat",
    description: "Squat with band around knees for tension.",
    youtubeUrl: null,
    musclesWorked: ["glutes", "quads"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Glute Bands",
    level: "BEGINNER" as const,
  },
  {
    name: "Glute Band Lateral Walk",
    description: "Side steps maintaining band tension.",
    youtubeUrl: null,
    musclesWorked: ["glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Glute Bands",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Hip Thrust (Pad)",
    description: "Hip thrust using padding for comfort under load.",
    youtubeUrl: null,
    musclesWorked: ["glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Hip Thrust Pad",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Weighted Vest Squat",
    description: "Squat with added vest resistance.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Adjustable Weight Training Vest",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Weighted Vest Jump Squat",
    description: "Explosive squat with added load.",
    youtubeUrl: null,
    musclesWorked: ["quads", "glutes"],
    muscleGroup: "LOWER" as const,
    equipmentName: "Adjustable Weight Training Vest",
    level: "ADVANCED" as const,
  },
  {
    name: "Slider Mountain Climbers",
    description: "Feet on sliders, drive knees forward.",
    youtubeUrl: null,
    musclesWorked: ["core", "shoulders"],
    muscleGroup: "CORE" as const,
    equipmentName: "Slider Discs",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Slider Pike",
    description: "Feet on sliders, raise hips upward.",
    youtubeUrl: null,
    musclesWorked: ["core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Slider Discs",
    level: "ADVANCED" as const,
  },
  {
    name: "Medicine Ball Slam",
    description: "Lift ball overhead and slam down.",
    youtubeUrl: null,
    musclesWorked: ["full_body"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Medicine Ball",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Medicine Ball Rotational Throw",
    description: "Explosive rotational throw against wall.",
    youtubeUrl: null,
    musclesWorked: ["core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Medicine Ball",
    level: "ADVANCED" as const,
  },
  {
    name: "Stability Ball Crunch",
    description: "Crunch performed on stability ball.",
    youtubeUrl: null,
    musclesWorked: ["core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Stability Ball",
    level: "BEGINNER" as const,
  },
  {
    name: "Stability Ball Pike",
    description: "Feet on ball, lift hips upward.",
    youtubeUrl: null,
    musclesWorked: ["core"],
    muscleGroup: "CORE" as const,
    equipmentName: "Stability Ball",
    level: "ADVANCED" as const,
  },
  {
    name: "Sandbag Carry",
    description: "Carry sandbag for distance.",
    youtubeUrl: null,
    musclesWorked: ["full_body"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Sandbag",
    level: "INTERMEDIATE" as const,
  },
  {
    name: "Sandbag Clean",
    description: "Lift sandbag explosively to chest.",
    youtubeUrl: null,
    musclesWorked: ["full_body"],
    muscleGroup: "FULLBODY" as const,
    equipmentName: "Sandbag",
    level: "ADVANCED" as const,
  },
];

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  // ── 1. Equipment ──────────────────────────
  console.log(" Seeding equipment...");
  for (const item of equipment) {
    await prisma.equipment.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }
  console.log(` ${equipment.length} equipment items seeded.`);

  // ── 2. Exercises ──────────────────────────
  console.log(" Seeding exercises...");
  const equipmentMap = new Map(
    (await prisma.equipment.findMany()).map((e) => [e.name, e.id]),
  );

  for (const ex of exercises) {
    const equipmentId = equipmentMap.get(ex.equipmentName) ?? null;
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {
        description: ex.description,
        youtubeUrl: ex.youtubeUrl,
        musclesWorked: { set: ex.musclesWorked },
        muscleGroup: ex.muscleGroup,
        equipmentId,
      },
      create: {
        name: ex.name,
        description: ex.description,
        youtubeUrl: ex.youtubeUrl,
        musclesWorked: ex.musclesWorked,
        muscleGroup: ex.muscleGroup,
        equipmentId,
      },
    });
    console.log(`  ✓ ${ex.name}`);
  }
  console.log(` ${exercises.length} exercises seeded.`);

  // ── 3. Programs ───────────────────────────
  console.log(" Seeding programs...");

  const exerciseMap = new Map(
    (await prisma.exercise.findMany()).map((e) => [e.name, e.id]),
  );

  for (const program of programs) {
    const equipmentId = program.equipmentName
      ? (equipmentMap.get(program.equipmentName) ?? null)
      : null;

    // Upsert the plan
    const plan = await prisma.workoutPlan.upsert({
      where: { name: program.name },
      update: {
        description: program.description,
        muscleGroup: program.muscleGroup,
        durationWeeks: program.durationWeeks,
        sessionsPerWeek: program.sessionsPerWeek,
        tier: program.tier,
        equipmentId,
      },
      create: {
        name: program.name,
        description: program.description,
        muscleGroup: program.muscleGroup,
        durationWeeks: program.durationWeeks,
        sessionsPerWeek: program.sessionsPerWeek,
        tier: program.tier,
        equipmentId,
      },
    });

    // Delete existing sessions (clean re-seed)
    await prisma.plannedSession.deleteMany({ where: { planId: plan.id } });

    // Create sessions and exercises
    for (const session of program.sessions) {
      const plannedSession = await prisma.plannedSession.create({
        data: {
          planId: plan.id,
          sessionNumber: session.sessionNumber,
          focus: session.focus,
        },
      });

      for (const ex of session.exercises) {
        const exerciseId = exerciseMap.get(ex.exerciseName);
        if (!exerciseId) {
          throw new Error(
            `Exercise not found: "${ex.exerciseName}" in program "${program.name}" session ${session.sessionNumber}`,
          );
        }

        await prisma.plannedExercise.create({
          data: {
            sessionId: plannedSession.id,
            exerciseId,
            order: ex.order,
            beginnerSets: ex.beginnerSets,
            beginnerReps: ex.beginnerReps,
            intermediateSets: ex.intermediateSets,
            intermediateReps: ex.intermediateReps,
            advancedSets: ex.advancedSets,
            advancedReps: ex.advancedReps,
            restSeconds: ex.restSeconds,
          },
        });
      }
    }

    console.log(`  ✓ ${program.name} — ${program.sessions.length} sessions`);
  }

  console.log(` ${programs.length} programs seeded.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
