import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getIdentityTier } from "@/lib/notifications/dataAdapter";
import { sendExpoPush } from "@/lib/notifications/sendPush";
import {
  COPY,
  recoveryReadyCopy,
  milestoneCopy,
} from "@/lib/notifications/copy";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const onlyType = searchParams.get("type");

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { pushToken: true },
  });
  if (!prefs?.pushToken) {
    return NextResponse.json(
      {
        error: "No push token on file. Enable notifications in the app first.",
      },
      { status: 400 },
    );
  }
  const pushToken = prefs.pushToken;
  const tier = await getIdentityTier(userId);

  const candidates: { type: string; title: string; body: string }[] = [
    { type: "STREAK_SAVER", ...COPY.STREAK_SAVER[tier] },
    { type: "RECOVERY_NUDGE", ...COPY.RECOVERY_NUDGE[tier] },
    { type: "RECOVERY_READY", ...recoveryReadyCopy(tier, true) },
    { type: "RESCHEDULE_SUGGESTION", ...COPY.RESCHEDULE_SUGGESTION[tier] },
    { type: "DAILY_HABIT", ...COPY.DAILY_HABIT[tier] },
    { type: "MILESTONE_10_WORKOUTS", ...milestoneCopy("10_WORKOUTS") },
    { type: "MILESTONE_FIRST_WEEK", ...milestoneCopy("FIRST_WEEK") },
    { type: "MILESTONE_30_DAY_STREAK", ...milestoneCopy("30_DAY_STREAK") },
  ];

  const toSend = onlyType
    ? candidates.filter((c) => c.type === onlyType)
    : candidates;

  if (onlyType && toSend.length === 0) {
    return NextResponse.json(
      {
        error: `Unknown type "${onlyType}"`,
        validTypes: candidates.map((c) => c.type),
      },
      { status: 400 },
    );
  }

  const results: { type: string; success: boolean; error?: string }[] = [];

  for (const c of toSend) {
    const result = await sendExpoPush(pushToken, `[TEST] ${c.title}`, c.body, {
      type: c.type,
    });
    results.push({
      type: c.type,
      success: result.success,
      error: result.success ? undefined : String(result.error),
    });
    if (toSend.length > 1) await sleep(2000);
  }

  return NextResponse.json({ tier, sent: results.length, results });
}
