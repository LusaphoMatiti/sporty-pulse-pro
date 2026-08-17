/**
 *
 * Call checkAndFireMilestones() from wherever a session currently
 * gets marked complete (your WorkoutLog write route). Milestones
 * bypass the daily priority stack entirely — they're a reward fired
 * the moment the triggering event happens, not a reminder competing
 * for the one-per-day slot planner.ts guards.
 *
 * NOTE on thresholds: "10 workouts" and "first full week" are total/
 * distinct-week counts, but "30 day streak" should be keyed off
 * CURRENT STREAK, not total sessions completed — a user could hit
 * 30 total sessions with plenty of gaps. Pass the right counter in
 * for each call site rather than reusing one number for all three.
 */

import { prisma } from "@/lib/prisma";
import { milestoneCopy } from "./copy";
import { getIdentityTier } from "./dataAdapter";

async function sendExpoPush(pushToken: string, title: string, body: string) {
  console.log(`[stub push] -> ${pushToken}: ${title} — ${body}`);
}

export async function checkAndFireMilestone(
  userId: string,
  milestoneKey: "10_WORKOUTS" | "FIRST_WEEK" | "30_DAY_STREAK",
  didHitMilestone: boolean,
) {
  if (!didHitMilestone) return;

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs?.pushToken || !prefs.notificationsEnabled) return;

  const tier = await getIdentityTier(userId);
  const copy = milestoneCopy(milestoneKey);

  await sendExpoPush(prefs.pushToken, copy.title, copy.body);

  await prisma.notificationLog.create({
    data: {
      userId,
      type: "MILESTONE",
      tier,
      title: copy.title,
      body: copy.body,
      sentAt: new Date(),
    },
  });
}
