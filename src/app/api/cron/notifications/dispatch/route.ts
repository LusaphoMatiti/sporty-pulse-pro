import { NextResponse } from "next/server";
import { dispatchDueNotifications } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

// Runs once daily (see vercel.json cron schedule). Computes, for each
// active user, at most one ScheduledNotification for the day.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await dispatchDueNotifications();
  return NextResponse.json(result);
}
