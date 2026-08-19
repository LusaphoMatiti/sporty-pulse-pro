import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  let body: { pushToken?: string; timezone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pushToken, timezone } = body;
  if (!pushToken || typeof pushToken !== "string") {
    return NextResponse.json(
      { error: "pushToken is required" },
      { status: 400 },
    );
  }

  // Registering a device only ever happens from the "turn notifications on"
  // path (SettingsScreen.handleNotifToggle -> usePushRegistration), so
  // notificationsEnabled is set true here unconditionally. This is the fix:
  // previously this route only persisted pushToken + timezone, so the
  // enabled flag never flipped true in the DB even though the client
  // switch showed "on" -- planner.ts's guard
  // (`!prefs.notificationsEnabled || !prefs.pushToken`) then silently
  // skipped every user who'd "enabled" notifications this way.
  //
  // Disabling remains a separate concern, handled by
  // PATCH /api/notifications/preferences.
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      pushToken,
      timezone: timezone ?? "Africa/Johannesburg",
      notificationsEnabled: true,
    },
    update: {
      pushToken,
      ...(timezone ? { timezone } : {}),
      notificationsEnabled: true,
    },
    select: { pushToken: true, notificationsEnabled: true, timezone: true },
  });

  return NextResponse.json({ success: true, preferences: prefs });
}
