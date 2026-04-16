import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveProgram } from "@/lib/resolver";
import { UserLevel } from "@/generated/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId, level } = await req.json();

  if (!planId || !level) {
    return NextResponse.json(
      { error: "templateId and level are required" },
      { status: 400 },
    );
  }

  if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  try {
    const instance = await resolveProgram({
      userId: session.user.id,
      planId,
      level: level as UserLevel,
    });

    return NextResponse.json({ instanceId: instance.id }, { status: 201 });
  } catch (error) {
    console.error("[ACTIVATE ERROR]", error);
    return NextResponse.json(
      { error: "Failed to activate program" },
      { status: 500 },
    );
  }
}
