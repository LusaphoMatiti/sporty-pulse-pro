import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { assignIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();

    const { primaryGoal, experienceLevel } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        lastLoginAt: true,
        onboardingCompletedAt: true,
      },
    });

    const result = assignIdentity({
      primaryGoal,
      experienceLevel,
      lastLoginAt: user?.lastLoginAt ?? null,
      onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
    });

    return NextResponse.json({
      ok: true,
      identity: result.identity,
    });
  } catch (err) {
    console.error("[assign-identity]", err);

    return NextResponse.json(
      { ok: false, error: "Failed to assign identity" },
      { status: 500 },
    );
  }
}
