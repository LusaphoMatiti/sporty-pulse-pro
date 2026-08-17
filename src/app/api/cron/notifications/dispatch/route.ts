import { NextResponse } from "next/server";
import { planForAllActiveUsers } from "@/lib/notifications/planner";

export const dynamic = "force-dynamic";

// Runs once daily (see vercel.json cron schedule). Computes, for each
// active user, at most one ScheduledNotification for the day.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await planForAllActiveUsers();
  return NextResponse.json(result);
}
