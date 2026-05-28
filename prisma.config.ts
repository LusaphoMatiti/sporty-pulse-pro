import "dotenv/config";
import { defineConfig } from "prisma/config";

const isMigration =
  process.argv.includes("migrate") ||
  process.argv.includes("db") ||
  process.argv.includes("seed");

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: isMigration ? process.env.DIRECT_URL! : process.env.DATABASE_URL!,
  },
});
