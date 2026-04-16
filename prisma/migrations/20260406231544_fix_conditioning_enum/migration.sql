/*
  Warnings:

  - The values [CONDITIONS] on the enum `MovementCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MovementCategory_new" AS ENUM ('PUSH', 'PULL', 'HINGE', 'SQUAT', 'CORE', 'CARRY', 'CONDITIONING');
ALTER TABLE "movement_patterns" ALTER COLUMN "category" TYPE "MovementCategory_new" USING ("category"::text::"MovementCategory_new");
ALTER TYPE "MovementCategory" RENAME TO "MovementCategory_old";
ALTER TYPE "MovementCategory_new" RENAME TO "MovementCategory";
DROP TYPE "public"."MovementCategory_old";
COMMIT;
