import { PrismaClient } from "./src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔧 Fixing 'Dumbbell' -> 'Dumbbells' in database...");

  await prisma.equipment.updateMany({
    where: { name: "Dumbbell" },
    data: { name: "Dumbbells" },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE "public"."workout_plans"
    SET "name" = REPLACE("name", 'Dumbbell ', 'Dumbbells ')
    WHERE "name" LIKE 'Dumbbell %';
  `);

  console.log("✅ Done! All 'Dumbbell' references are now 'Dumbbells'.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
