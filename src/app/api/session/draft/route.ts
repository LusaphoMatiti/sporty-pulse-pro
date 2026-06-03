import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { Prisma, InstanceStatus } from "@/generated/prisma";
import type { NextRequest } from "next/server";
import {
  apiSuccess,
  unauthorized,
  notFound,
  internalError,
} from "@/lib/api-response";

export type SessionDraft = {
  sessionNumber: number;
  currentExerciseIdx: number;
  completedSets: number;
  elapsedSeconds: number;
  logs: {
    plannedExerciseId: string;
    actualSets: number;
    actualReps: number;
    weightKg?: number;
  }[];
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) return unauthorized();

    const body = (await req.json()) as {
      instanceId: string;
      draft: SessionDraft | null;
    };
    const { instanceId, draft } = body;

    const result = await prisma.planInstance.updateMany({
      where: {
        id: instanceId,
        userId: session.user.id,
        status: InstanceStatus.ACTIVE,
      },
      data: { sessionDraft: draft ?? Prisma.JsonNull },
    });

    if (result.count === 0) return notFound("Instance");

    return apiSuccess({ saved: true });
  } catch (err) {
    console.error("[session/draft] error:", err);
    return internalError(err);
  }
}
