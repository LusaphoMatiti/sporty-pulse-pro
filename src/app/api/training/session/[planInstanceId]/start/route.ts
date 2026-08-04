import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  //  1. Load the active instance

  const instance = await prisma.planInstance.findFirst({
    where: {
      id: planInstanceId,
      userId,
      status: InstanceStatus.ACTIVE,
    },
    include: { plan: true },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Instance not found or not active" },
      { status: 404 },
    );
  }

  // 2. Derive session number from query param (mobile passes it)

  const { searchParams } = new URL(req.url);
  const sessionNumberParam = searchParams.get("sessionNumber");
  const sessionNumber = sessionNumberParam
    ? parseInt(sessionNumberParam, 10)
    : instance.currentSession;

  if (isNaN(sessionNumber)) {
    return NextResponse.json(
      { error: "Invalid sessionNumber" },
      { status: 400 },
    );
  }

  // 3. Load the planned session

  const plannedSession = await prisma.plannedSession.findUnique({
    where: {
      planId_sessionNumber: {
        planId: instance.planId,
        sessionNumber,
      },
    },
    include: {
      plannedExercises: {
        orderBy: { order: "asc" },
        include: { exercise: true },
      },
    },
  });

  if (!plannedSession) {
    return NextResponse.json(
      { error: "Planned session not found" },
      { status: 404 },
    );
  }

  // 4. Plans are level-specific now (WorkoutPlan.difficulty), so each
  // plannedExercise's repsScheme already holds the right values for
  // whichever level's plan matched this user — no per-level branching.

  const exercises = plannedSession.plannedExercises.map((pe) => {
    return {
      id: pe.id,
      order: pe.order,
      repsScheme: pe.repsScheme,
      restSeconds: pe.restSeconds,
      exercise: {
        id: pe.exercise.id,
        name: pe.exercise.name,
      },
    };
  });

  // 5. Return everything SessionScreen needs

  return NextResponse.json(
    {
      success: true,
      data: {
        instanceId: instance.id,
        dayNumber: sessionNumber,
        planName: instance.plan.name,
        focus: plannedSession.focus,
        level: instance.level,
        muscleGroup: instance.plan.muscleGroup,
        exercises,
        draft:
          instance.currentSession === sessionNumber
            ? ((instance.sessionDraft as object) ?? null)
            : null,
        totalSessions:
          instance.plan.durationWeeks * instance.plan.sessionsPerWeek,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
