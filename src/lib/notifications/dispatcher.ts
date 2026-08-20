import { prisma } from "@/lib/prisma";
import { getTodaysSessionStatus } from "./dataAdapter";
import { sendExpoPush } from "./sendPush";
import { NOTIFICATION_STYLE } from "./style";

export async function dispatchDueNotifications(now: Date = new Date()) {
  const due = await prisma.scheduledNotification.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    include: {
      user: { include: { notificationPreference: true } },
    },
  });

  let sent = 0;
  let suppressed = 0;

  for (const notif of due) {
    const prefs = notif.user.notificationPreference;

    if (!prefs?.pushToken || !prefs.notificationsEnabled) {
      await prisma.scheduledNotification.update({
        where: { id: notif.id },
        data: { status: "SUPPRESSED" },
      });
      suppressed++;
      continue;
    }

    // Re-check: did they complete today's session since planning ran?
    const sessionStatus = await getTodaysSessionStatus(notif.userId);
    if (sessionStatus.completed) {
      await prisma.scheduledNotification.update({
        where: { id: notif.id },
        data: { status: "SUPPRESSED" },
      });
      suppressed++;
      continue;
    }

    const style = NOTIFICATION_STYLE[notif.type];
    await sendExpoPush(
      prefs.pushToken,
      notif.title,
      notif.body,
      { type: notif.type },
      {
        channelId: style.channelId,
        subtitle: style.iosSubtitle,
        threadId: style.iosThreadId,
      },
    );

    await prisma.$transaction([
      prisma.scheduledNotification.update({
        where: { id: notif.id },
        data: { status: "SENT", sentAt: now },
      }),
      prisma.notificationLog.create({
        data: {
          userId: notif.userId,
          type: notif.type,
          tier: notif.tier,
          title: notif.title,
          body: notif.body,
          sentAt: now,
        },
      }),
    ]);
    sent++;
  }

  return { checked: due.length, sent, suppressed };
}
