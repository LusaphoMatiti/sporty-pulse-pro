import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import {
  apiSuccess,
  unauthorized,
  validationError,
  internalError,
} from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body?.pushToken || typeof body.pushToken !== "string") {
      return validationError("pushToken is required");
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        pushToken: body.pushToken,
        timezone: body.timezone ?? "Africa/Johannesburg",
        notificationsEnabled: true, // first-ever registration = OS permission just granted, safe default
      },
      update: {
        pushToken: body.pushToken,
        ...(body.timezone ? { timezone: body.timezone } : {}),
        // deliberately NOT touching notificationsEnabled on update —
        // a token refresh isn't the user asking to be re-opted-in
      },
      select: { notificationsEnabled: true },
    });

    return apiSuccess(prefs);
  } catch (err) {
    return internalError(err);
  }
}
