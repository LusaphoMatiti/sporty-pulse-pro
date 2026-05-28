import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import type { SessionDraft } from "@/app/api/session/draft/route";
import { buildCloudinaryUrl, resolvePlanImage } from "@/lib/cloudinary";
import {
  apiSuccess,
  unauthorized,
  notFound,
  internalError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session) return unauthorized();

    const userId = session.user.id;

    const [instance, subscription, userEquipmentRecords, allPrograms] =
      await Promise.all([
        prisma.planInstance.findFirst({
          where: { userId, status: InstanceStatus.ACTIVE },
          select: {
            id: true,
            level: true,
            planId: true,
            currentSession: true,
            sessionDraft: true,
            plan: {
              select: {
                id: true,
                name: true,
                muscleGroup: true,
                imageUrl: true,
                sessionDurationMin: true,
              },
            },
          },
        }),
        prisma.subscription.findUnique({
          where: { userId },
          select: { plan: true, status: true },
        }),
        prisma.userEquipment.findMany({
          where: { userId },
          select: { source: true, equipmentId: true, trialExpiresAt: true },
        }),
        prisma.workoutPlan.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            tier: true,
            muscleGroup: true,
            imageUrl: true,
            sessionDurationMin: true,
            durationWeeks: true,
            sessionsPerWeek: true,
            plannedSessions: {
              orderBy: { sessionNumber: "asc" },
              take: 1,
              select: {
                plannedExercises: {
                  orderBy: { order: "asc" },
                  take: 1,
                  select: { exercise: { select: { thumbnailUrl: true } } },
                },
              },
            },
          },
        }),
      ]);

    if (!instance) {
      return apiSuccess({
        instanceId: null,
        allPrograms: allPrograms.map(({ plannedSessions: _, ...p }) => ({
          ...p,
          imageUrl: resolvePlanImage({ ...p, plannedSessions: _ }, "miniCard"),
        })),
      });
    }

    const [plannedSession, totalSessions] = await Promise.all([
      prisma.plannedSession.findUnique({
        where: {
          planId_sessionNumber: {
            planId: instance.planId,
            sessionNumber: instance.currentSession,
          },
        },
        select: {
          focus: true,
          estimatedMinutes: true,
          plannedExercises: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              beginnerSets: true,
              beginnerReps: true,
              intermediateSets: true,
              intermediateReps: true,
              advancedSets: true,
              advancedReps: true,
              restSeconds: true,
              exercise: {
                select: {
                  id: true,
                  name: true,
                  musclesWorked: true,
                  thumbnailUrl: true,
                  equipment: {
                    select: { equipment: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.plannedSession.count({ where: { planId: instance.planId } }),
    ]);

    if (!plannedSession) return notFound("Planned session");

    const now = new Date();
    const activePlan =
      subscription?.status === "active" ? subscription.plan : null;

    type TrainingTier = "FREE" | "DECLARED_TRIAL" | "PURCHASED" | "PRO";
    let tier: TrainingTier = "FREE";
    let trialExpiresAt: string | null = null;

    if (activePlan === "PRO") {
      tier = "PRO";
    } else if (activePlan === "EQUIPMENT") {
      tier = "PURCHASED";
    } else {
      const declared = userEquipmentRecords.find(
        (r) =>
          r.source === "DECLARED" &&
          r.trialExpiresAt != null &&
          r.trialExpiresAt > now,
      );
      if (declared?.trialExpiresAt) {
        tier = "DECLARED_TRIAL";
        trialExpiresAt = declared.trialExpiresAt.toISOString();
      }
    }

    const boughtFromStore = userEquipmentRecords.some(
      (r) => r.source === "PURCHASED",
    );

    const activeEquipmentIds = userEquipmentRecords
      .filter(
        (r) =>
          r.source === "PURCHASED" ||
          (r.source === "DECLARED" &&
            r.trialExpiresAt != null &&
            r.trialExpiresAt > now),
      )
      .map((r) => r.equipmentId);

    const levelKey = instance.level;

    const exercisesForView = plannedSession.plannedExercises.map((pe) => ({
      id: pe.id,
      order: pe.order,
      sets:
        levelKey === "BEGINNER"
          ? pe.beginnerSets
          : levelKey === "INTERMEDIATE"
            ? pe.intermediateSets
            : pe.advancedSets,
      reps:
        levelKey === "BEGINNER"
          ? pe.beginnerReps
          : levelKey === "INTERMEDIATE"
            ? pe.intermediateReps
            : pe.advancedReps,
      restSeconds: pe.restSeconds,
      exercise: {
        id: pe.exercise.id,
        name: pe.exercise.name,
        musclesWorked: pe.exercise.musclesWorked,
        thumbnailUrl: buildCloudinaryUrl(pe.exercise.thumbnailUrl, "thumb"),
        equipment: pe.exercise.equipment.map((ee) => ({
          id: ee.equipment.id,
          name: ee.equipment.name,
        })),
      },
    }));

    const muscles = [
      ...new Set(exercisesForView.flatMap((e) => e.exercise.musclesWorked)),
    ];

    const planImageUrl =
      buildCloudinaryUrl(instance.plan.imageUrl, "hero") ??
      buildCloudinaryUrl(
        exercisesForView[0]?.exercise.thumbnailUrl ?? null,
        "hero",
      );

    return apiSuccess({
      instanceId: instance.id,
      planId: instance.planId,
      planName: instance.plan.name,
      muscleGroup: instance.plan.muscleGroup,
      sessionDurationMin: instance.plan.sessionDurationMin ?? null,
      level: instance.level,
      currentSession: instance.currentSession,
      imageUrl: planImageUrl ?? null,
      totalSessions,
      focus: plannedSession.focus,
      estimatedMinutes: plannedSession.estimatedMinutes,
      exercisesForView,
      muscles,
      tier,
      trialExpiresAt,
      boughtFromStore,
      draft: (instance.sessionDraft as SessionDraft) ?? null,
      allPrograms: allPrograms.map(({ plannedSessions: _, ...p }) => ({
        ...p,
        imageUrl: resolvePlanImage({ ...p, plannedSessions: _ }, "miniCard"),
      })),
      activeEquipmentIds,
    });
  } catch (err) {
    console.error("[training/GET] error:", err);
    return internalError();
  }
}
