import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, InstanceStatus } from "@/generated/prisma"; // ← add Prisma here

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

  const result = await prisma.planInstance.updateMany({
    where: {
      id: instanceId,
      userId: auth.user.id,
      status: InstanceStatus.ACTIVE,
    },
    data: { sessionDraft: draft ?? Prisma.JsonNull },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
