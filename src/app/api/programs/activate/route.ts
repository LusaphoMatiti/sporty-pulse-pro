import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import {
  resolveProgram,
  ProgramAccessError,
  PlanNotFoundError,
} from "@/lib/resolver";
import { UserLevel } from "@/generated/prisma";

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: { planId?: string; level?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { planId, level } = body;

  const validLevels: UserLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  if (!planId || !level || !validLevels.includes(level as UserLevel)) {
    return NextResponse.json(
      { error: "planId and a valid level are required" },
      { status: 400 },
    );
  }

  try {
    const instance = await resolveProgram({
      userId,
      planId,
      level: level as UserLevel,
    });

    return NextResponse.json({ instanceId: instance.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ProgramAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    console.error("[ACTIVATE ERROR]", error);
    return NextResponse.json(
      { error: "Failed to activate program" },
      { status: 500 },
    );
  }
}
