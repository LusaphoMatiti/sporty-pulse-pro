import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sleepHours, sleepQuality, muscleSoreness, stressLevel } = body as {
    sleepHours?: number;
    sleepQuality?: number; // 1–5
    muscleSoreness?: number; // 1–5
    stressLevel?: number; // 1–5
  };

  // All three scoring inputs are required
  if (
    sleepQuality === undefined ||
    muscleSoreness === undefined ||
    stressLevel === undefined
  ) {
    return NextResponse.json(
      { error: "sleepQuality, muscleSoreness, and stressLevel are required" },
      { status: 400 },
    );
  }

  // Clamp inputs to 1–5
  const sq = Math.min(5, Math.max(1, sleepQuality));
  const ms = Math.min(5, Math.max(1, muscleSoreness));
  const sl = Math.min(5, Math.max(1, stressLevel));

  // Recovery formula:
  //   Sleep quality  → 40% weight (higher = better)
  //   Muscle soreness → 35% weight (lower soreness = better)
  //   Stress level   → 25% weight (lower stress = better)
  const recoveryPct = Math.round(
    (sq / 5) * 40 + ((6 - ms) / 5) * 35 + ((6 - sl) / 5) * 25,
  );

  const log = await prisma.recoveryLog.create({
    data: {
      userId: session.user.id,
      sleepHours: sleepHours ?? null,
      sleepQuality: sq,
      muscleSoreness: ms,
      stressLevel: sl,
      recoveryPct,
    },
  });

  return NextResponse.json({ recoveryPct: log.recoveryPct });
}
