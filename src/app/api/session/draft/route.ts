import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, InstanceStatus } from "@/generated/prisma";
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

type Body =
  | { instanceId: string; draft: SessionDraft }
  | { instanceId: string; draft: null };

export async function POST(req: Request) {
  try {
    const auth = await getServerSession(authOptions);
    if (!auth) return unauthorized();

    const body: Body = await req.json();
    const { instanceId, draft } = body;

    const result = await prisma.planInstance.updateMany({
      where: {
        id: instanceId,
        userId: auth.user.id,
        status: InstanceStatus.ACTIVE,
      },
      data: { sessionDraft: draft ?? Prisma.JsonNull },
    });

    if (result.count === 0) return notFound("Instance");

    return apiSuccess({ saved: true });
  } catch (err) {
    console.error("[session/draft] error:", err);
    return internalError();
  }
}
