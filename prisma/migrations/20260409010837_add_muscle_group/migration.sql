/*
  Warnings:

  - You are about to drop the column `movementPatternId` on the `exercises` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `exercises` table. All the data in the column will be lost.
  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserEquipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkoutProgram` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkoutSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExerciseToWorkoutProgram` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `instance_exercises` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `movement_patterns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_instances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `template_slots` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `muscleGroup` to the `exercises` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('UPPER', 'LOWER', 'CORE', 'FULLBODY');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'EQUIPMENT', 'PRO');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserEquipment" DROP CONSTRAINT "UserEquipment_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "UserEquipment" DROP CONSTRAINT "UserEquipment_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutProgram" DROP CONSTRAINT "WorkoutProgram_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutSession" DROP CONSTRAINT "WorkoutSession_programId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutSession" DROP CONSTRAINT "WorkoutSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToWorkoutProgram" DROP CONSTRAINT "_ExerciseToWorkoutProgram_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToWorkoutProgram" DROP CONSTRAINT "_ExerciseToWorkoutProgram_B_fkey";

-- DropForeignKey
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_movementPatternId_fkey";

-- DropForeignKey
ALTER TABLE "instance_exercises" DROP CONSTRAINT "instance_exercises_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "instance_exercises" DROP CONSTRAINT "instance_exercises_instanceId_fkey";

-- DropForeignKey
ALTER TABLE "program_instances" DROP CONSTRAINT "program_instances_templateId_fkey";

-- DropForeignKey
ALTER TABLE "program_instances" DROP CONSTRAINT "program_instances_userId_fkey";

-- DropForeignKey
ALTER TABLE "program_templates" DROP CONSTRAINT "program_templates_primaryEquipmentId_fkey";

-- DropForeignKey
ALTER TABLE "template_slots" DROP CONSTRAINT "template_slots_movementPatternId_fkey";

-- DropForeignKey
ALTER TABLE "template_slots" DROP CONSTRAINT "template_slots_templateId_fkey";

-- AlterTable
ALTER TABLE "exercises" DROP COLUMN "movementPatternId",
DROP COLUMN "priority",
ADD COLUMN     "muscleGroup" "MuscleGroup" NOT NULL;

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "UserEquipment";

-- DropTable
DROP TABLE "VerificationToken";

-- DropTable
DROP TABLE "WorkoutProgram";

-- DropTable
DROP TABLE "WorkoutSession";

-- DropTable
DROP TABLE "_ExerciseToWorkoutProgram";

-- DropTable
DROP TABLE "instance_exercises";

-- DropTable
DROP TABLE "movement_patterns";

-- DropTable
DROP TABLE "program_instances";

-- DropTable
DROP TABLE "program_templates";

-- DropTable
DROP TABLE "template_slots";

-- DropEnum
DROP TYPE "MovementCategory";

-- DropEnum
DROP TYPE "ProgramGoal";

-- DropEnum
DROP TYPE "ProgramStatus";

-- DropEnum
DROP TYPE "ProgramTier";

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "workout_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "muscleGroup" "MuscleGroup" NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "equipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_sessions" (
    "id" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "focus" TEXT NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "planned_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_exercises" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "beginnerSets" INTEGER NOT NULL,
    "beginnerReps" INTEGER NOT NULL,
    "intermediateSets" INTEGER NOT NULL,
    "intermediateReps" INTEGER NOT NULL,
    "advancedSets" INTEGER NOT NULL,
    "advancedReps" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,

    CONSTRAINT "planned_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_instances" (
    "id" TEXT NOT NULL,
    "level" "UserLevel" NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentSession" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "actualReps" INTEGER,
    "actualSets" INTEGER,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "plannedExerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL,
    "source" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_equipment" (
    "id" TEXT NOT NULL,
    "source" "EquipmentSource" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "user_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "workout_plans_name_key" ON "workout_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "planned_sessions_planId_sessionNumber_key" ON "planned_sessions"("planId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "planned_exercises_sessionId_order_key" ON "planned_exercises"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercises" ADD CONSTRAINT "planned_exercises_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "planned_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercises" ADD CONSTRAINT "planned_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "plan_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plannedExerciseId_fkey" FOREIGN KEY ("plannedExerciseId") REFERENCES "planned_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
