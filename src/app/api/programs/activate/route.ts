// src/app/api/programs/activate/route.ts
import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { resolveProgram } from "@/lib/resolver";
import { UserLevel } from "@/generated/prisma";

export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

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
      userId,
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
