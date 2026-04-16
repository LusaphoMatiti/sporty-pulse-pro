// app/api/user/level/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { InstanceStatus, UserLevel } from "@/generated/prisma";

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { level } = body as { level: string };

  const validLevels: Level[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  if (!validLevels.includes(level as Level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const updated = await prisma.planInstance.updateMany({
    where: {
      userId: session.user.id,
      status: InstanceStatus.ACTIVE,
    },
    data: { level: level as UserLevel },
  });

  if (updated.count === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  return NextResponse.json({ ok: true, updated: updated.count });
}
