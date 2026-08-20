/**
 * lib/notifications/style.ts (BACKEND)
 *
 * Per-type identifiers used when SENDING a push: which Android channel
 * to route to (by id only -- channels are created on-device, not here),
 * plus iOS subtitle/thread grouping (real per-message fields).
 *
 * The channel's actual BEHAVIOR (importance, vibration pattern, display
 * name) is defined client-side in pro-frontend's
 * hooks/usePushRegistration.ts, which is what actually creates the
 * channel on the device. This file intentionally has no expo-notifications
 * import -- that's a React Native native-module package with no place in
 * a Next.js server. The two files are independent, but the channelId
 * strings below MUST match the channelId strings in the frontend's
 * style.ts exactly, or pushes will silently fall back to a channel
 * that doesn't exist on-device.
 */

import { NotificationType } from "@/generated/prisma";

export type NotificationStyle = {
  channelId: string;
  iosSubtitle: string;
  iosThreadId: string;
};

export const NOTIFICATION_STYLE: Record<NotificationType, NotificationStyle> = {
  DAILY_HABIT: {
    channelId: "daily-habit",
    iosSubtitle: "Daily Session",
    iosThreadId: "daily-habit",
  },
  STREAK_SAVER: {
    channelId: "streak-saver",
    iosSubtitle: "Streak Alert",
    iosThreadId: "streak-saver",
  },
  RECOVERY_NUDGE: {
    channelId: "recovery",
    iosSubtitle: "Recovery",
    iosThreadId: "recovery",
  },
  RECOVERY_READY: {
    // Intentionally shares the "recovery" channel with RECOVERY_NUDGE.
    channelId: "recovery",
    iosSubtitle: "Recovery",
    iosThreadId: "recovery",
  },
  RESCHEDULE_SUGGESTION: {
    channelId: "reschedule",
    iosSubtitle: "Reschedule",
    iosThreadId: "reschedule",
  },
  MILESTONE: {
    channelId: "milestone",
    iosSubtitle: "Milestone 🏆",
    iosThreadId: "milestone",
  },
};
