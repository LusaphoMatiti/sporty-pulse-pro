import { type NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { EquipmentSource } from "@/generated/prisma/client";
import {
  apiSuccess,
  unauthorized,
  notFound,
  internalError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return unauthorized();
  }

  // ASSUMPTION: these four are direct scalar fields on User, matching
  // OnboardingScreen's local Answers state. Not independently confirmed
  // against the actual schema -- flag if this doesn't match reality.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      primaryGoal: true,
      trainingLocation: true,
      gymTrainingStyle: true,
      biologicalSex: true,
      experienceLevel: true,
    },
  });

  if (!user) {
    return notFound("User");
  }

  // Equipment is different -- tracked via UserEquipment, not a scalar
  // field, matching how the rest of this project already handles it.
  const declaredEquipment = await prisma.userEquipment.findFirst({
    where: { userId: session.user.id, source: EquipmentSource.DECLARED },
    select: { equipmentId: true },
  });

  return apiSuccess({
    ...user,
    equipmentId: declaredEquipment?.equipmentId ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return unauthorized();
  }

  const userId = session.user.id;
  const body = await req.json();
  const {
    primaryGoal,
    trainingLocation,
    gymTrainingStyle,
    biologicalSex,
    experienceLevel,
    equipmentId,
  } = body;

  try {
    // Same assumption as the GET route -- direct scalar fields on User.
    await prisma.user.update({
      where: { id: userId },
      data: {
        primaryGoal,
        trainingLocation,
        // Same pattern as /api/onboarding/complete: only meaningful for
        // GYM, cleared otherwise so a stale style doesn't linger if the
        // user switches back to GYM later with a different style in mind.
        gymTrainingStyle: trainingLocation === "GYM" ? gymTrainingStyle : null,
        biologicalSex,
        experienceLevel,
      },
    });

    // ── Re-match and (re)activate a GYM plan if needed ────────────────────
    // Mirrors /api/onboarding/complete's tiered matching exactly, so
    // changing trainingLocation/gymTrainingStyle here gets the same
    // plan-matching behavior as picking it during onboarding, instead of
    // just relabeling the choice and leaving the user on their old plan
    // (or with no plan at all after a HOME -> GYM switch).
    if (trainingLocation === "GYM") {
      const baseWhere = {
        environmentTarget: "GYM" as const,
        // Same restriction as onboarding -- only match plans with a real
        // day-by-day structure, not the legacy single-session-loop plans.
        plannedSessions: { some: { dayOfWeek: { not: null } } },
      };
      const tiers = [
        {
          ...baseWhere,
          OR: [{ gymStyleTarget: gymTrainingStyle }, { gymStyleTarget: null }],
          AND: [
            { OR: [{ goalTarget: primaryGoal }, { goalTarget: null }] },
            { OR: [{ difficulty: experienceLevel }, { difficulty: null }] },
          ],
        },
        {
          ...baseWhere,
          OR: [{ gymStyleTarget: gymTrainingStyle }, { gymStyleTarget: null }],
        },
        baseWhere,
      ];

      let matchedPlan: { id: string } | null = null;
      for (const where of tiers) {
        matchedPlan = await prisma.workoutPlan.findFirst({
          where,
          orderBy: { name: "asc" },
          select: { id: true },
        });
        if (matchedPlan) break;
      }

      if (matchedPlan) {
        const currentActive = await prisma.planInstance.findFirst({
          where: { userId, status: "ACTIVE" },
          select: { id: true, planId: true },
        });

        if (!currentActive || currentActive.planId !== matchedPlan.id) {
          // ASSUMPTION: reusing "COMPLETED" to retire the old instance,
          // since it's the only non-ACTIVE InstanceStatus value confirmed
          // elsewhere in this codebase (the session/complete route). It
          // isn't a perfect semantic fit -- the user switched away in
          // Settings, they didn't finish the plan. If InstanceStatus has a
          // more accurate value (e.g. CANCELLED/ABANDONED), this is the
          // one line to change. Flagging for confirmation before this ships.
          await prisma.$transaction(async (tx) => {
            if (currentActive) {
              await tx.planInstance.update({
                where: { id: currentActive.id },
                data: { status: "COMPLETED" },
              });
            }
            await tx.planInstance.create({
              data: {
                userId,
                planId: matchedPlan.id,
                level: experienceLevel,
                status: "ACTIVE",
              },
            });
          });
        }
        // else: already on the matching plan -- leave progress untouched.
      } else {
        console.warn(
          `[settings/training-system] no GYM plan found to (re)activate for userId=${userId}`,
        );
      }
    }

    // ── Equipment ───────────────────────────────────────────────────────
    // Gym is already fully equipped -- users don't declare home equipment
    // for it. If they're on GYM, clear any previously-declared equipment
    // (and its trial) instead of leaving a stale HOME selection sitting in
    // the DB unused. Otherwise, same upsert-with-trial logic as before.
    if (trainingLocation === "GYM") {
      await prisma.userEquipment.deleteMany({
        where: { userId, source: EquipmentSource.DECLARED },
      });
    } else if (equipmentId) {
      const existing = await prisma.userEquipment.findFirst({
        where: { userId, source: EquipmentSource.DECLARED },
      });

      if (existing && existing.equipmentId !== equipmentId) {
        // Changed which equipment is declared -- starts a fresh 15-day
        // trial for the new item, same as picking it during onboarding.
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

        await prisma.userEquipment.update({
          where: { id: existing.id },
          data: { equipmentId, trialExpiresAt },
        });
      } else if (!existing) {
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

        await prisma.userEquipment.create({
          data: {
            userId,
            equipmentId,
            source: EquipmentSource.DECLARED,
            trialExpiresAt,
          },
        });
      }
      // else: resaved the same equipment -- leave trialExpiresAt alone,
      // don't reset their trial just because nothing actually changed.
    }

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Failed to save training system:", error);
    return internalError(error, "Could not save your changes");
  }
}
