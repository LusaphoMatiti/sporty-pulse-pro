// Run with: npx tsx scripts/diagnose-user.ts <userId>
//
// Reproduces the EXACT same calls /api/programs makes — getEligiblePlansContext
// + computePlanLocks — for one specific user, and prints out:
//   - the user's goal/level/location/equipment inputs
//   - how many bodyweight plans are eligible for them specifically
//   - how many equipment plans are eligible
//   - the lock map result (which plan ids are locked/unlocked and why)
//
// This exists so we look at real numbers instead of guessing.

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getUserAccess } from "../src/lib/access";
import {
  getEligiblePlansContext,
  computePlanLocks,
} from "../src/lib/programaccess";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx scripts/diagnose-user.ts <userId>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      identity: true,
      trainingLocation: true,
      primaryGoal: true,
      experienceLevel: true,
      biologicalSex: true,
    },
  });

  if (!user) {
    console.error(`No user found with id ${userId}`);
    process.exit(1);
  }

  console.log("── User profile ──────────────────────────────");
  console.log(user);

  const { planWhere, orderBy, allUserEquipment, accessibleEquipmentIds, now } =
    await getEligiblePlansContext(userId);

  console.log("\n── Declared/owned equipment ───────────────────");
  console.log(allUserEquipment);
  console.log(
    "\naccessibleEquipmentIds (currently active):",
    accessibleEquipmentIds,
  );

  const access = await getUserAccess({ userId });
  console.log("\n── Access flags ───────────────────────────────");
  console.log({
    isPro: access.isPro,
    isEquipment: access.isEquipment,
    hasActiveTrial: access.hasActiveTrial,
    trialExpiresAt: access.trialExpiresAt,
  });

  const plans = await prisma.workoutPlan.findMany({
    where: planWhere,
    select: { id: true, name: true, equipmentId: true, tier: true },
    orderBy,
  });

  console.log(`\n── Eligible plans BEFORE locking: ${plans.length} total ──`);
  const bodyweight = plans.filter((p) => p.equipmentId === null);
  const equipmentPlans = plans.filter((p) => p.equipmentId !== null);
  console.log(`  bodyweight: ${bodyweight.length}`);
  console.log(`  equipment-tied: ${equipmentPlans.length}`);
  console.log("\n  Full ordered list (catalog order used for capping):");
  plans.forEach((p, i) => {
    console.log(
      `   ${i + 1}. [tier=${p.tier}] ${p.name}  (equipmentId=${p.equipmentId ?? "null"})`,
    );
  });

  const lockMap = computePlanLocks(plans, {
    isPro: access.isPro,
    allUserEquipment,
    now,
  });

  console.log("\n── Lock results ───────────────────────────────");
  let unlockedCount = 0;
  let lockedCount = 0;
  for (const p of plans) {
    const lock = lockMap.get(p.id);
    const status = lock?.locked ? `LOCKED (${lock.lockReason})` : "UNLOCKED";
    if (lock?.locked) lockedCount++;
    else unlockedCount++;
    console.log(`   ${p.name}: ${status}`);
  }

  console.log(`\nTotal unlocked: ${unlockedCount}`);
  console.log(`Total locked:   ${lockedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
