/**
 * src/app/api/notifications/test-scenario/route.ts
 *
 * DEV/QA ONLY. Exercises the REAL decision + delivery pipeline:
 * evaluatePriorityStack (pure logic) -> writes a real
 * ScheduledNotification row -> dispatchDueNotifications (real,
 * re-validates against your actual DB state, sends via sendExpoPush).
 *
 * UserSnapshots are hand-crafted per scenario rather than faked via
 * WorkoutLog/RecoveryLog history, so this never touches your real
 * streak/recovery data. The dispatcher's "already completed today?"
 * re-check IS real -- if you've trained today, expect SUPPRESSED
 * results, which is correct behavior, not () a bug.
 *
 * GET /api/notifications/test-scenario?scenario=X
 *   X one of: STREAK_SAVER | RECOVERY_NUDGE | RECOVERY_READY |
 *             RESCHEDULE_SUGGESTION | DAILY_HABIT |
 *             MILESTONE_10_WORKOUTS | MILESTONE_FIRST_WEEK |
 *             MILESTONE_30_DAY_STREAK
 */

import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getIdentityTier } from "@/lib/notifications/dataAdapter";
import {
  evaluatePriorityStack,
  UserSnapshot,
} from "@/lib/notifications/priorityStack";
import { dispatchDueNotifications } from "@/lib/notifications/dispatcher";
import { checkAndFireMilestone } from "@/lib/notifications/milestones";

const MILESTONE_SCENARIOS = {
  MILESTONE_10_WORKOUTS: "10_WORKOUTS",
  MILESTONE_FIRST_WEEK: "FIRST_WEEK",
  MILESTONE_30_DAY_STREAK: "30_DAY_STREAK",
} as const;

// Robust local-time construction for arbitrary IANA zones (no hardcoded offsets).
function utcOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = raw.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + (hours < 0 ? -mins : mins);
}

function atLocalMinutes(timeZone: string, minutesSinceMidnight: number): Date {
  const now = new Date();
  const offsetMin = utcOffsetMinutes(timeZone, now);
  const [y, m, d] = now
    .toLocaleDateString("en-CA", { timeZone })
    .split("-")
    .map(Number);
  const utcMinutes = minutesSinceMidnight - offsetMin;
  return new Date(Date.UTC(y, m - 1, d, 0, utcMinutes, 0));
}

function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const scenario = searchParams.get("scenario");

  if (!scenario) {
    return NextResponse.json(
      {
        error: "Missing ?scenario=",
        validScenarios: [
          "STREAK_SAVER",
          "RECOVERY_NUDGE",
          "RECOVERY_READY",
          "RESCHEDULE_SUGGESTION",
          "DAILY_HABIT",
          ...Object.keys(MILESTONE_SCENARIOS),
        ],
      },
      { status: 400 },
    );
  }

  // ── Milestones: fully real path, no faking needed ──────────────────────
  if (scenario in MILESTONE_SCENARIOS) {
    const key =
      MILESTONE_SCENARIOS[scenario as keyof typeof MILESTONE_SCENARIOS];
    await checkAndFireMilestone(userId, key, true);
    return NextResponse.json({
      scenario,
      note: "Milestone fired via the real checkAndFireMilestone path. Check your phone.",
    });
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs?.pushToken) {
    return NextResponse.json(
      {
        error: "No push token on file. Enable notifications in the app first.",
      },
      { status: 400 },
    );
  }

  const tier = await getIdentityTier(userId);
  const timezone = prefs.timezone;

  const base: Omit<
    UserSnapshot,
    | "currentStreak"
    | "yesterdayMissed"
    | "recoveryStatus"
    | "recoveryUpdatedToday"
    | "now"
  > = {
    userId,
    tier,
    timezone,
    bedtimeLocal: prefs.bedtimeLocal,
    avgSessionStartMinutes: null, // null avoids the "already in app near usual time" early-return
    lastAppOpenAt: null,
    hasScheduledSession: true,
    sessionCompleted: false,
  };

  let snapshot: UserSnapshot;

  switch (scenario) {
    case "STREAK_SAVER": {
      const bedtimeMinutes = parseHHmm(prefs.bedtimeLocal);
      const sendAtMinutes = bedtimeMinutes - 75;
      snapshot = {
        ...base,
        currentStreak: 5,
        yesterdayMissed: false,
        recoveryStatus: "UNKNOWN",
        recoveryUpdatedToday: false,
        now: atLocalMinutes(timezone, sendAtMinutes), // exactly at the trigger threshold
      };
      break;
    }
    case "RECOVERY_NUDGE": {
      snapshot = {
        ...base,
        currentStreak: 0,
        yesterdayMissed: false,
        recoveryStatus: "LOW",
        recoveryUpdatedToday: true,
        now: new Date(),
      };
      break;
    }
    case "RECOVERY_READY": {
      snapshot = {
        ...base,
        currentStreak: 0,
        yesterdayMissed: false,
        recoveryStatus: "GOOD",
        recoveryUpdatedToday: true,
        now: new Date(),
      };
      break;
    }
    case "RESCHEDULE_SUGGESTION": {
      snapshot = {
        ...base,
        currentStreak: 0,
        yesterdayMissed: true,
        recoveryStatus: "UNKNOWN",
        recoveryUpdatedToday: false,
        now: new Date(),
      };
      break;
    }
    case "DAILY_HABIT": {
      snapshot = {
        ...base,
        currentStreak: 0,
        yesterdayMissed: false,
        recoveryStatus: "UNKNOWN",
        recoveryUpdatedToday: false,
        now: new Date(),
      };
      break;
    }
    default:
      return NextResponse.json(
        { error: `Unknown scenario "${scenario}"` },
        { status: 400 },
      );
  }

  const candidate = evaluatePriorityStack(snapshot);
  if (!candidate) {
    return NextResponse.json(
      {
        error:
          "evaluatePriorityStack returned null for this snapshot — check priorityStack.ts logic",
        snapshot,
      },
      { status: 500 },
    );
  }

  const row = await prisma.scheduledNotification.create({
    data: {
      userId,
      type: candidate.type,
      tier,
      title: candidate.title,
      body: `[TEST] ${candidate.body}`,
      scheduledFor: candidate.scheduledFor,
      status: "PENDING",
    },
  });

  // Run the real dispatcher, "now" set just past scheduledFor so it's due.
  const dispatchResult = await dispatchDueNotifications(
    new Date(candidate.scheduledFor.getTime() + 1000),
  );

  const updated = await prisma.scheduledNotification.findUnique({
    where: { id: row.id },
  });

  return NextResponse.json({
    scenario,
    candidate,
    scheduledNotificationId: row.id,
    finalStatus: updated?.status,
    dispatchResult,
  });
}
