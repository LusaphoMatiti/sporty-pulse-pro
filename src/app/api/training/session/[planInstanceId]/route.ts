// src/app/api/training/progression/[planInstanceId]/route.ts
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IDENTITY_LABELS } from "@/lib/identity";
import { TEMPLATE_LABELS } from "@/lib/templateMatcher";
import { Identity, TemplateType } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planInstanceId: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { planInstanceId } = await params;

  const instance = await prisma.planInstance.findUnique({
    where: { id: planInstanceId },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          durationWeeks: true,
          sessionsPerWeek: true,
          templateType: true,
          identityTarget: true,
          goalTarget: true,
          environmentTarget: true,
        },
      },
      workoutLogs: {
        select: { id: true, completedAt: true, sessionNumber: true },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Plan instance not found" },
      { status: 404 },
    );
  }
  if (instance.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totalSessions =
    instance.plan.durationWeeks * instance.plan.sessionsPerWeek;
  const completedSessions = Math.max(0, instance.currentSession - 1);
  const progressPct = Math.round((completedSessions / totalSessions) * 100);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const sessionsThisWeek = instance.workoutLogs.filter(
    (log) => new Date(log.completedAt) >= oneWeekAgo,
  ).length;

  const lastSessionAt = instance.workoutLogs[0]?.completedAt ?? null;

  const deloadInfo = buildDeloadInfo(
    instance.deloadFlagged,
    instance.progressionWeek,
  );

  const nextMilestone = buildNextMilestone(
    instance.progressionType,
    instance.progressionWeek ?? 1,
    instance.currentSets,
    instance.currentReps,
    instance.currentRestSeconds,
  );

  return NextResponse.json(
    {
      instance: {
        id: instance.id,
        status: instance.status,
        startedAt: instance.startedAt,
        completedAt: instance.completedAt,
        identityAtStart: instance.identityAtStart,
        identityLabel: instance.identityAtStart
          ? IDENTITY_LABELS[instance.identityAtStart as Identity]
          : null,
      },
      plan: {
        id: instance.plan.id,
        name: instance.plan.name,
        templateType: instance.plan.templateType,
        templateLabel: instance.plan.templateType
          ? TEMPLATE_LABELS[instance.plan.templateType as TemplateType]
          : null,
        durationWeeks: instance.plan.durationWeeks,
        sessionsPerWeek: instance.plan.sessionsPerWeek,
        totalSessions,
      },
      progress: {
        currentSession: instance.currentSession,
        completedSessions,
        totalSessions,
        progressPct,
        sessionsThisWeek,
        lastSessionAt,
      },
      progression: {
        type: instance.progressionType,
        week: instance.progressionWeek ?? 1,
        currentSets: instance.currentSets,
        currentReps: instance.currentReps,
        currentRestSeconds: instance.currentRestSeconds,
        deloadFlagged: instance.deloadFlagged,
        deloadInfo,
        nextMilestone,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function buildDeloadInfo(
  deloadFlagged: boolean,
  progressionWeek: number | null,
): { active: boolean; message: string | null } {
  if (!deloadFlagged) return { active: false, message: null };
  return {
    active: true,
    message: `Week ${progressionWeek} — Scheduled deload. Reduce load by 40%. Prioritise form and recovery.`,
  };
}

function buildNextMilestone(
  progressionType: string | null,
  week: number,
  currentSets: number | null,
  currentReps: number | null,
  currentRestSeconds: number | null,
): string {
  // currentSets is read for future use — referenced to avoid lint warnings
  void currentSets;

  switch (progressionType) {
    case "VOLUME":
      if (week < 2) return `Complete week 2 to unlock +1 set`;
      if (week < 4) return `Complete week 4 to unlock +1 set and more reps`;
      return `Volume peak reached — next phase: add load`;

    case "LOAD": {
      const repsToTarget = Math.max(0, 10 - (currentReps ?? 8));
      if (repsToTarget > 0)
        return `${repsToTarget} more rep${repsToTarget === 1 ? "" : "s"} to trigger load increase`;
      return `Rep target hit — increase weight this session`;
    }

    case "DENSITY": {
      const rest = currentRestSeconds ?? 90;
      if (rest <= 30) return `Minimum rest reached — maintain intensity`;
      return `Rest target: ${rest - 10}s — reduce by 10s next phase`;
    }

    default:
      return `Complete sessions to unlock progression`;
  }
}
