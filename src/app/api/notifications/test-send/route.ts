/**
 * src/app/api/notifications/test-send/route.ts
 *
 * DEV/QA ONLY. Sends real Expo pushes to the CALLER'S OWN registered
 * device using the actual copy from lib/notifications/copy.ts AND the
 * real per-type styling from lib/notifications/style.ts, so what you
 * see here matches what dispatcher.ts actually sends in production.
 *
 * GET /api/notifications/test-send            -> sends all 8, ~2s apart
 * GET /api/notifications/test-send?type=X      -> sends just one
 *   X one of: STREAK_SAVER | RECOVERY_NUDGE | RECOVERY_READY |
 *             RESCHEDULE_SUGGESTION | DAILY_HABIT |
 *             MILESTONE_10_WORKOUTS | MILESTONE_FIRST_WEEK |
 *             MILESTONE_30_DAY_STREAK
 *
 * Does NOT write to notificationLog -- these are throwaway test sends.
 */

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
import { NOTIFICATION_STYLE } from "../../../../lib/notifications/style";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TYPE_TO_NOTIFICATION_TYPE = {
  STREAK_SAVER: "STREAK_SAVER",
  RECOVERY_NUDGE: "RECOVERY_NUDGE",
  RECOVERY_READY: "RECOVERY_READY",
  RESCHEDULE_SUGGESTION: "RESCHEDULE_SUGGESTION",
  DAILY_HABIT: "DAILY_HABIT",
  MILESTONE_10_WORKOUTS: "MILESTONE",
  MILESTONE_FIRST_WEEK: "MILESTONE",
  MILESTONE_30_DAY_STREAK: "MILESTONE",
} as const;

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
    const notifType =
      TYPE_TO_NOTIFICATION_TYPE[
        c.type as keyof typeof TYPE_TO_NOTIFICATION_TYPE
      ];
    const style = NOTIFICATION_STYLE[notifType];
    const result = await sendExpoPush(
      pushToken,
      `[TEST] ${c.title}`,
      c.body,
      { type: c.type },
      {
        channelId: style.channelId,
        subtitle: style.iosSubtitle,
        threadId: style.iosThreadId,
      },
    );
    results.push({
      type: c.type,
      success: result.success,
      error: result.success ? undefined : String(result.error),
    });
    if (toSend.length > 1) await sleep(2000);
  }

  return NextResponse.json({ tier, sent: results.length, results });
}
