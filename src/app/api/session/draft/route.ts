import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";

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
  const auth = await getServerSession(authOptions);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Body = await req.json();
  const { instanceId, draft } = body;

  const instance = await prisma.planInstance.findFirst({
    where: {
      id: instanceId,
      userId: auth.user.id,
      status: InstanceStatus.ACTIVE,
    },
  });

  if (!instance)
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });

  await prisma.planInstance.update({
    where: { id: instanceId },
    data: { sessionDraft: draft ?? undefined },
  });

  return NextResponse.json({ ok: true });
}
