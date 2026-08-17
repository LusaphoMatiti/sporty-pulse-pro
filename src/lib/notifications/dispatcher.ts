/**
 *
 * Runs every ~10-15 min (see
 * app/api/cron/notifications/dispatch/route.ts). Finds due
 * ScheduledNotification rows and RE-VALIDATES before sending — a lot
 * can change between planning (once a day) and the scheduled time,
 * most importantly: they might have already trained.
 *
 * Actual push delivery (sendExpoPush) is stubbed — wire this up with
 * expo-server-sdk when we get to the mobile side.
 */

import { prisma } from "@/lib/prisma";
import { getTodaysSessionStatus } from "./dataAdapter";

async function sendExpoPush(pushToken: string, title: string, body: string) {
  // TODO: replace with expo-server-sdk. Kept as a stub so the backend
  // pipeline (plan -> dispatch -> log) is fully testable in isolation
  // before any mobile wiring exists.
  console.log(`[stub push] -> ${pushToken}: ${title} — ${body}`);
  return { success: true };
}

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

    await sendExpoPush(prefs.pushToken, notif.title, notif.body);

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
