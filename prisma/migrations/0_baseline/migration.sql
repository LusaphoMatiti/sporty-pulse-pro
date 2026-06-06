-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATHLETE', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "SexTarget" AS ENUM ('MALE', 'FEMALE', 'ANY');

-- CreateEnum
CREATE TYPE "PrimaryGoal" AS ENUM ('LOSE_WEIGHT', 'BUILD_MUSCLE', 'GET_FIT');

-- CreateEnum
CREATE TYPE "TrainingLocation" AS ENUM ('HOME', 'GYM');

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'EQUIPMENT', 'PRO');

-- CreateEnum
CREATE TYPE "EquipmentSource" AS ENUM ('PURCHASED', 'DECLARED', 'BODYWEIGHT');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('UPPER', 'LOWER', 'CORE', 'FULLBODY');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'EQUIPMENT', 'PRO');

-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Identity" AS ENUM ('REBUILD', 'OPERATOR', 'EXECUTIVE_PERFORMANCE');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('FULL_BODY_RESTORE', 'FULL_BODY_STRENGTH', 'CONDITIONING_CIRCUIT', 'PUSH_PULL_LEGS', 'ADVANCED_PPL', 'STRENGTH_HIIT', 'PERFORMANCE_CONDITIONING');

-- CreateEnum
CREATE TYPE "EnvironmentTarget" AS ENUM ('HOME_BODYWEIGHT', 'HOME_EQUIPMENT', 'GYM', 'ANY');

-- CreateEnum
CREATE TYPE "ProgressionType" AS ENUM ('VOLUME', 'LOAD', 'DENSITY');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',
    "lastLoginAt" TIMESTAMP(3),
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isNewUser" BOOLEAN NOT NULL DEFAULT true,
    "identity" "Identity",
    "identityAssignedAt" TIMESTAMP(3),
    "primaryGoal" "PrimaryGoal",
    "trainingLocation" "TrainingLocation",
    "biologicalSex" "BiologicalSex",
    "experienceLevel" "UserLevel",
    "onboardingCompletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT,
    "musclesWorked" TEXT[],
    "muscleGroup" "MuscleGroup" NOT NULL,
    "equipmentId" TEXT,
    "impactLevel" "ImpactLevel" NOT NULL DEFAULT 'MEDIUM',
    "isBodyweight" BOOLEAN NOT NULL DEFAULT false,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_equipment" (
    "exerciseId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "exercise_equipment_pkey" PRIMARY KEY ("exerciseId","equipmentId")
);

-- CreateTable
CREATE TABLE "exercise_substitutions" (
    "id" TEXT NOT NULL,
    "originalExerciseId" TEXT NOT NULL,
    "substituteExerciseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "exercise_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "muscleGroup" "MuscleGroup" NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "difficulty" TEXT,
    "tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "sessionDurationMin" TEXT,
    "templateType" "TemplateType",
    "identityTarget" "Identity",
    "goalTarget" "PrimaryGoal",
    "environmentTarget" "EnvironmentTarget",
    "impactLevel" "ImpactLevel",
    "sexTarget" "SexTarget",
    "collection" TEXT,
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
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 45,
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
CREATE TABLE "recovery_logs" (
    "id" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sleepHours" DOUBLE PRECISION,
    "sleepQuality" INTEGER,
    "muscleSoreness" INTEGER,
    "stressLevel" INTEGER,
    "recoveryPct" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "recovery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_instances" (
    "id" TEXT NOT NULL,
    "level" "UserLevel" NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentSession" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sessionDraft" JSONB,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "progressionType" "ProgressionType",
    "progressionWeek" INTEGER,
    "currentSets" INTEGER,
    "currentReps" INTEGER,
    "currentRestSeconds" INTEGER,
    "deloadFlagged" BOOLEAN NOT NULL DEFAULT false,
    "identityAtStart" "Identity",
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
    "trialExpiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "user_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "exercises_equipmentId_idx" ON "exercises"("equipmentId");

-- CreateIndex
CREATE INDEX "exercise_substitutions_originalExerciseId_idx" ON "exercise_substitutions"("originalExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_substitutions_originalExerciseId_substituteExercis_key" ON "exercise_substitutions"("originalExerciseId", "substituteExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_plans_name_key" ON "workout_plans"("name");

-- CreateIndex
CREATE INDEX "workout_plans_equipmentId_idx" ON "workout_plans"("equipmentId");

-- CreateIndex
CREATE INDEX "workout_plans_goalTarget_idx" ON "workout_plans"("goalTarget");

-- CreateIndex
CREATE INDEX "workout_plans_environmentTarget_idx" ON "workout_plans"("environmentTarget");

-- CreateIndex
CREATE INDEX "workout_plans_sexTarget_idx" ON "workout_plans"("sexTarget");

-- CreateIndex
CREATE INDEX "planned_sessions_planId_idx" ON "planned_sessions"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "planned_sessions_planId_sessionNumber_key" ON "planned_sessions"("planId", "sessionNumber");

-- CreateIndex
CREATE INDEX "planned_exercises_sessionId_idx" ON "planned_exercises"("sessionId");

-- CreateIndex
CREATE INDEX "planned_exercises_exerciseId_idx" ON "planned_exercises"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "planned_exercises_sessionId_order_key" ON "planned_exercises"("sessionId", "order");

-- CreateIndex
CREATE INDEX "recovery_logs_userId_idx" ON "recovery_logs"("userId");

-- CreateIndex
CREATE INDEX "recovery_logs_userId_loggedAt_idx" ON "recovery_logs"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "plan_instances_userId_status_idx" ON "plan_instances"("userId", "status");

-- CreateIndex
CREATE INDEX "plan_instances_userId_idx" ON "plan_instances"("userId");

-- CreateIndex
CREATE INDEX "workout_logs_userId_idx" ON "workout_logs"("userId");

-- CreateIndex
CREATE INDEX "workout_logs_instanceId_idx" ON "workout_logs"("instanceId");

-- CreateIndex
CREATE INDEX "workout_logs_userId_plannedExerciseId_idx" ON "workout_logs"("userId", "plannedExerciseId");

-- CreateIndex
CREATE INDEX "workout_logs_instanceId_sessionNumber_idx" ON "workout_logs"("instanceId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "user_equipment_userId_idx" ON "user_equipment"("userId");

-- CreateIndex
CREATE INDEX "user_equipment_equipmentId_idx" ON "user_equipment"("equipmentId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_originalExerciseId_fkey" FOREIGN KEY ("originalExerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_substituteExerciseId_fkey" FOREIGN KEY ("substituteExerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercises" ADD CONSTRAINT "planned_exercises_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "planned_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_exercises" ADD CONSTRAINT "planned_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_logs" ADD CONSTRAINT "recovery_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "plan_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plannedExerciseId_fkey" FOREIGN KEY ("plannedExerciseId") REFERENCES "planned_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
