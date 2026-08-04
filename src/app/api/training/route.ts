import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import type { SessionDraft } from "@/lib/types";
import { buildCloudinaryUrl, resolvePlanImage } from "@/lib/cloudinary";
import {
  apiSuccess,
  unauthorized,
  notFound,
  internalError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

// ─── Coaching notes by templateType ──
// Sourced from template.json skeletons. Injected at response time — no DB column needed.
const COACHING_NOTES: Record<string, string> = {
  FAT_LOSS_HOME_BEGINNER:
    "Focus on moving with control, not speed. Consistency beats intensity at this stage — showing up every session matters more than how hard you push.",
  FAT_LOSS_HOME_INTERMEDIATE:
    "Track how long your rest feels — as you improve, you'll need less recovery between rounds. That's the clearest sign the program is working.",
  FAT_LOSS_HOME_ADVANCED:
    "Push hard during work intervals — then recover fully. Half-effort on both is the worst approach. Commit to the intensity, earn the rest.",
  FAT_LOSS_GYM_BEGINNER:
    "Don't skip the rest periods — they're programmed deliberately. Learning to pace yourself now builds the discipline that carries you to advanced levels.",
  FAT_LOSS_GYM_INTERMEDIATE:
    "Log your rest intervals. The goal over 4 weeks is to need less recovery between rounds without dropping performance. That's your progression marker.",
  FAT_LOSS_GYM_ADVANCED:
    "Fuel your sessions properly. At this intensity, under-eating kills performance. Prioritise protein and don't fear pre-workout carbohydrates.",
  FAT_LOSS_GYM_BEGINNER_2:
    "Endurance is built slowly. Resist the urge to jump intensity too fast. Steady pacing now means you can sustain effort — and results — long-term.",
  FAT_LOSS_HOME_RECOVERY:
    "Recovery sessions are training too. Moving on your off days accelerates repair. Don't skip these — they're what make your hard sessions possible.",
  MUSCLE_HOME_BEGINNER:
    "Master the basics before chasing progression. Clean reps with full range of motion build the muscle memory that makes future gains faster and safer.",
  MUSCLE_HOME_INTERMEDIATE:
    "Muscle is built in the final reps of each set. If the last two reps feel comfortable, you're not pushing hard enough. Controlled difficulty builds size.",
  MUSCLE_HOME_ADVANCED:
    "Sleep and nutrition are training variables. At this volume, 7–8 hours of sleep and adequate protein aren't optional — they're what the gains are made of.",
  MUSCLE_GYM_BEGINNER:
    "Everything feels hard at first — that's neural adaptation, not weakness. Strength comes fast in the first 8 weeks. Trust the process and log every session.",
  MUSCLE_GYM_INTERMEDIATE:
    "Progressive overload is the only rule that matters. Add weight, reps, or sets every session where you can. Small increases compound into significant results.",
  MUSCLE_GYM_ADVANCED:
    "At the advanced level, recovery management is as important as training load. Honour the deload weeks — they're not weakness, they're what allows the next phase to work.",
  POWERBUILDING_GYM_ADVANCED:
    "Powerbuilding rewards patience. Don't chase aesthetics and strength gains simultaneously at maximum effort. Let the structure do the work — your job is to show up and execute.",
  MUSCLE_HOME_RECOVERY:
    "Flexibility and mobility are strength assets, not extras. Athletes who prioritise movement quality lift heavier and stay injury-free longer. Treat this session seriously.",
  FUNCTIONAL_HOME_BEGINNER:
    "Functional fitness is about quality of movement above all. Focus on how well you move, not how much you do. That foundation makes every future program more effective.",
  FUNCTIONAL_HOME_INTERMEDIATE:
    "Athletic conditioning rewards effort and consistency equally. Push hard when it counts, move well always. Aim to feel fitter — not just more exhausted — after each week.",
  FUNCTIONAL_HOME_ADVANCED:
    "At this level, mental toughness is a training variable. The moments you want to quit mid-set are exactly when the adaptation happens. Stay in the work.",
  FUNCTIONAL_GYM_BEGINNER:
    "Every expert was once a beginner. Follow the rest periods, hit your reps, and show up consistently. Results at this stage come from attendance, not intensity.",
  FUNCTIONAL_GYM_INTERMEDIATE:
    "Conditioning improves faster than strength, so don't neglect the heavy work. Balance is the goal. A strong base makes every conditioning session more productive.",
  FUNCTIONAL_GYM_ADVANCED:
    "Track performance metrics, not just how you feel. Advanced athletes sometimes feel strong on bad days and weak on good ones. Data doesn't lie — let the numbers guide you.",
  CROSSFIT_GYM_ADVANCED:
    "WOD-style training rewards pacing intelligence over ego. Starting too hot burns you out mid-session. Know your sustainable pace — then push 5% beyond it.",
  FUNCTIONAL_HOME_RECOVERY:
    "Active recovery is a competitive advantage. Athletes who move on their off days perform better on their training days. This session is an investment, not optional filler.",
};

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
            difficulty: true,
            templateType: true,
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
          coachingNote: p.templateType
            ? (COACHING_NOTES[p.templateType] ?? null)
            : null,
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
              repsScheme: true,
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

    const exercisesForView = plannedSession.plannedExercises.map((pe) => ({
      id: pe.id,
      order: pe.order,
      repsScheme: pe.repsScheme,
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
        coachingNote: p.templateType
          ? (COACHING_NOTES[p.templateType] ?? null)
          : null,
      })),
      activeEquipmentIds,
    });
  } catch (err) {
    console.error("[training/GET] error:", err);
    return internalError(err);
  }
}
