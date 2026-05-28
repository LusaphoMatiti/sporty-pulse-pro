import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { InstanceStatus } from "@/generated/prisma";
import { buildCloudinaryUrl } from "@/lib/cloudinary";
import { apiSuccess, unauthorized, internalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;

    const [plans, allUserEquipment, activeInstance, user] = await Promise.all([
      prisma.workoutPlan.findMany({
        select: {
          id: true,
          name: true,
          tier: true,
          imageUrl: true,
          sessionDurationMin: true,
          plannedSessions: {
            orderBy: { sessionNumber: "asc" },
            select: {
              plannedExercises: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  exercise: { select: { thumbnailUrl: true } },
                },
              },
            },
          },
          equipmentId: true,
          description: true,
          muscleGroup: true,
          durationWeeks: true,
          sessionsPerWeek: true,
          difficulty: true,
          identityTarget: true,
          goalTarget: true,
          equipment: { select: { id: true, name: true } },
        },
        orderBy: [{ tier: "asc" }, { name: "asc" }],
      }),
      prisma.userEquipment.findMany({
        where: { userId },
        select: {
          equipmentId: true,
          source: true,
          trialExpiresAt: true,
          equipment: { select: { name: true } },
        },
      }),
      prisma.planInstance.findFirst({
        where: { userId, status: InstanceStatus.ACTIVE },
        select: { planId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { identity: true },
      }),
    ]);

    const declaredEntry = allUserEquipment.find((e) => e.source === "DECLARED");
    const declaredEquipmentName = declaredEntry?.equipment?.name ?? null;

    const access = await getUserAccess({ userId });
    const now = new Date();

    const activeEquipmentIds = allUserEquipment
      .filter(
        (e) =>
          e.source === "PURCHASED" ||
          (e.source === "DECLARED" &&
            e.trialExpiresAt &&
            e.trialExpiresAt > now),
      )
      .map((e) => e.equipmentId);

    const expiredEquipmentIds = allUserEquipment
      .filter(
        (e) =>
          e.source === "DECLARED" &&
          e.trialExpiresAt &&
          e.trialExpiresAt <= now,
      )
      .map((e) => e.equipmentId);

    const plansWithCount = plans.map((p) => {
      const exerciseCount = p.plannedSessions.reduce(
        (sum, s) => sum + s.plannedExercises.length,
        0,
      );
      const firstExerciseThumb =
        p.plannedSessions[0]?.plannedExercises[0]?.exercise?.thumbnailUrl ??
        null;
      const resolvedImageUrl =
        buildCloudinaryUrl(p.imageUrl, "card") ??
        buildCloudinaryUrl(firstExerciseThumb, "card");

      const { plannedSessions: _, ...rest } = p;
      return {
        ...rest,
        imageUrl: resolvedImageUrl,
        exerciseCount,
        requiresEquipment: !!p.equipmentId,
      };
    });

    return apiSuccess({
      plans: plansWithCount,
      access: {
        isPro: access.isPro,
        isEquipment: access.isEquipment,
        hasActiveTrial: access.hasActiveTrial,
        trialExpiresAt: access.trialExpiresAt?.toISOString() ?? null,
        canStartNewProgram: access.canStartNewProgram,
        activeInstanceCount: access.activeInstanceCount,
        programCap: access.isPro ? null : access.programCap,
        declaredEquipmentIds: access.declaredEquipmentIds,
        activeEquipmentIds,
        expiredEquipmentIds,
        activePlanId: activeInstance?.planId ?? null,
      },
      declaredEquipmentName,
      userIdentity: user?.identity ?? null,
    });
  } catch (err) {
    console.error("[programs/GET] error:", err);
    return internalError();
  }
}

// ── src/app/api/settings/route.ts ─────────────────────────────────────────────
// (add to a separate file in your project)

import { getMobileOrWebSession as getSession2 } from "@/lib/mobile-auth";
import { prisma as db } from "@/lib/prisma";
import {
  apiSuccess as ok,
  unauthorized as unauth,
  notFound as nf,
  internalError as ie,
} from "@/lib/api-response";

export async function settingsGET(req: Request) {
  try {
    const session = await getSession2(req);
    if (!session?.user?.id) return unauth();

    const userId = session.user.id;
    const [user, activeInstance, subscription] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, role: true },
      }),
      db.planInstance.findFirst({
        where: { userId, status: "ACTIVE" },
        select: { level: true },
        orderBy: { startedAt: "desc" },
      }),
      db.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
      }),
    ]);

    if (!user) return nf("User");

    const plan: string =
      subscription?.status === "active" ? subscription.plan : "FREE";

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        plan: plan as "FREE" | "EQUIPMENT" | "PRO",
        isNewUser: false,
        experienceLevel: activeInstance?.level ?? null,
      },
      currentLevel: activeInstance?.level ?? "BEGINNER",
      plan,
    });
  } catch (err) {
    console.error("[settings/GET] error:", err);
    return ie();
  }
}

// ── src/app/api/user/profile/route.ts ────────────────────────────────────────
// (add to a separate file in your project)

import type { NextRequest } from "next/server";
import { getMobileOrWebSession as getSession3 } from "@/lib/mobile-auth";
import { prisma as db3 } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import {
  apiSuccess as ok3,
  unauthorized as unauth3,
  notFound as nf3,
  internalError as ie3,
} from "@/lib/api-response";

export async function profileGET(req: Request) {
  try {
    const session = await getSession3(req);
    if (!session?.user?.id) return unauth3();

    const user = await db3.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, image: true, role: true },
    });

    if (!user) return nf3("User");

    return ok3(user);
  } catch (err) {
    console.error("[profile/GET] error:", err);
    return ie3();
  }
}

export async function profilePATCH(req: NextRequest) {
  try {
    const session = await getSession3(req);
    if (!session?.user?.id) return unauth3();

    const userId = session.user.id;
    const form = await req.formData();
    const name = form.get("name") as string | null;
    const photo = form.get("photo") as File | null;

    let imageUrl: string | undefined;
    if (photo && photo.size > 0) {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const dataUri = `data:${photo.type};base64,${buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "avatars",
        public_id: userId,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
        ],
      });
      imageUrl = result.secure_url;
    }

    const updated = await db3.user.update({
      where: { id: userId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      select: { id: true, name: true, email: true, image: true, role: true },
    });

    return ok3({ user: updated });
  } catch (err) {
    console.error("[profile/PATCH] error:", err);
    return ie3();
  }
}
