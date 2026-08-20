import { prisma } from "@/lib/prisma";
import { milestoneCopy } from "./copy";
import { getIdentityTier } from "./dataAdapter";
import { sendExpoPush } from "./sendPush";
import { NOTIFICATION_STYLE } from "./style";

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
  const style = NOTIFICATION_STYLE.MILESTONE;

  await sendExpoPush(
    prefs.pushToken,
    copy.title,
    copy.body,
    { type: "MILESTONE" },
    {
      channelId: style.channelId,
      subtitle: style.iosSubtitle,
      threadId: style.iosThreadId,
    },
  );

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
