import { prisma } from "../src/lib/prisma"; // ← use your singleton
import { EquipmentSource } from "../src/generated/prisma";

async function main() {
  // ── 1. Find your user ──────────────────────────────────────────
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!user) throw new Error("No users found — log in once first");
  console.log("Seeding for user:", user.email);

  // ── 2. Find any equipment in the DB ───────────────────────────
  const equipment = await prisma.equipment.findFirst();
  if (!equipment) throw new Error("No equipment rows found in DB");
  console.log("Using equipment:", equipment.name);

  // ── 3. Upsert UserEquipment with a short trial ─────────────────
  //    Change daysLeft to test different urgency levels:
  //    8+ days → low (purple), 3–6 days → medium (amber), 0–2 days → high (red)
  const daysLeft = 2;
  const trialExpiresAt = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);

  await prisma.userEquipment.deleteMany({ where: { userId: user.id } });
  await prisma.userEquipment.create({
    data: {
      userId: user.id,
      equipmentId: equipment.id,
      source: EquipmentSource.DECLARED,
      trialExpiresAt,
    },
  });

  console.log(
    `Set trial to expire in ${daysLeft} days (${trialExpiresAt.toISOString()})`,
  );

  // ── 4. Cap programs: set all active instances to COMPLETED ─────
  //    Comment this block out to test the "under cap" state
  const capped = await prisma.planInstance.updateMany({
    where: { userId: user.id, status: "ACTIVE" },
    data: { status: "COMPLETED" },
  });
  console.log(
    `Completed ${capped.count} active plan instance(s) to simulate cap`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
