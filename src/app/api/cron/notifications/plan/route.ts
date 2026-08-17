import { NextResponse } from "next/server";
import { dispatchDueNotifications } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

// Runs every ~10-15 min (see vercel.json cron schedule). Sends any
// ScheduledNotification whose time has come, re-validating first.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await dispatchDueNotifications();
  return NextResponse.json(result);
}
