import { type NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { EquipmentSource } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  // ASSUMPTION: these four are direct scalar fields on User, matching
  // OnboardingScreen's local Answers state. Not independently confirmed
  // against the actual schema -- flag if this doesn't match reality.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      primaryGoal: true,
      trainingLocation: true,
      biologicalSex: true,
      experienceLevel: true,
    },
  });

  if (!user) {
    return Response.json(null, { status: 404, statusText: "Not Found" });
  }

  // Equipment is different -- tracked via UserEquipment, not a scalar
  // field, matching how the rest of this project already handles it.
  const declaredEquipment = await prisma.userEquipment.findFirst({
    where: { userId: session.user.id, source: EquipmentSource.DECLARED },
    select: { equipmentId: true },
  });

  return Response.json({
    ...user,
    equipmentId: declaredEquipment?.equipmentId ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  const body = await req.json();
  const {
    primaryGoal,
    trainingLocation,
    biologicalSex,
    experienceLevel,
    equipmentId,
  } = body;

  try {
    // Same assumption as the GET route -- direct scalar fields on User.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { primaryGoal, trainingLocation, biologicalSex, experienceLevel },
    });

    if (equipmentId) {
      const existing = await prisma.userEquipment.findFirst({
        where: { userId: session.user.id, source: EquipmentSource.DECLARED },
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
            userId: session.user.id,
            equipmentId,
            source: EquipmentSource.DECLARED,
            trialExpiresAt,
          },
        });
      }
      // else: resaved the same equipment -- leave trialExpiresAt alone,
      // don't reset their trial just because nothing actually changed.
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to save training system:", error);
    return Response.json(
      { error: "Could not save your changes" },
      { status: 500 },
    );
  }
}
