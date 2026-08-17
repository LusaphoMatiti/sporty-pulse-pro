import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import {
  apiSuccess,
  unauthorized,
  validationError,
  internalError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session) return unauthorized();

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
      select: {
        notificationsEnabled: true,
        bedtimeLocal: true,
        timezone: true,
        pushToken: true,
      },
    });

    return apiSuccess({
      notificationsEnabled: prefs?.notificationsEnabled ?? true,
      bedtimeLocal: prefs?.bedtimeLocal ?? "22:00",
      timezone: prefs?.timezone ?? "Africa/Johannesburg",
      hasToken: Boolean(prefs?.pushToken),
    });
  } catch (err) {
    return internalError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getMobileOrWebSession(req);
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body.notificationsEnabled !== "boolean") {
      return validationError("notificationsEnabled (boolean) is required");
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        notificationsEnabled: body.notificationsEnabled,
      },
      update: { notificationsEnabled: body.notificationsEnabled },
      select: { notificationsEnabled: true },
    });

    return apiSuccess(prefs);
  } catch (err) {
    return internalError(err);
  }
}
