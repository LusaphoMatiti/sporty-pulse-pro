import { type NextRequest } from "next/server";
import crypto from "crypto";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { Plan, EquipmentSource } from "@/generated/prisma/client";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID as string;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE as string;
const PAYFAST_MODE = process.env.PAYFAST_MODE ?? "sandbox"; // "sandbox" | "live"

// Recurring-billing management (pause/unpause/cancel/fetch/adhoc) is a
// DIFFERENT PayFast API from the checkout/ITN flow used everywhere else
// in this project. Same domain for sandbox and live -- sandbox is
// signalled via a ?testing=true query param, not a separate hostname.
const PAYFAST_API_BASE = "https://api.payfast.co.za";

// Same PHP urlencode() replication used for the checkout/ITN signature.
const payfastEncode = (value: string) =>
  encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E");

/**
 * Builds the auth headers for PayFast's recurring-billing REST API.
 * Unlike the checkout/ITN signature (fixed field order), this one sorts
 * ALL params -- body data + the headers themselves + the passphrase --
 * alphabetically before hashing. merchant_key is not used here at all,
 * only merchant-id via the header.
 */
function buildApiHeaders(bodyParams: Record<string, string> = {}) {
  // PayFast requires this exact format: ISO 8601, no milliseconds, no
  // trailing "Z" -- confirmed against multiple independent examples.
  const timestamp = new Date().toISOString().split(".")[0];

  const signatureParams: Record<string, string> = {
    ...bodyParams,
    "merchant-id": PAYFAST_MERCHANT_ID,
    version: "v1",
    timestamp,
    passphrase: PAYFAST_PASSPHRASE,
  };

  const paramString = Object.keys(signatureParams)
    .sort()
    .map((key) => `${key}=${payfastEncode(signatureParams[key])}`)
    .join("&");

  const signature = crypto.createHash("md5").update(paramString).digest("hex");

  return {
    "merchant-id": PAYFAST_MERCHANT_ID,
    version: "v1",
    timestamp,
    signature,
  };
}

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  const userId = session.user.id;

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { payfastToken: true, plan: true },
    });

    if (!subscription?.payfastToken) {
      return Response.json(
        { error: "No active subscription found to cancel" },
        { status: 404 },
      );
    }

    const headers = buildApiHeaders();
    const url = `${PAYFAST_API_BASE}/subscriptions/${subscription.payfastToken}/cancel${
      PAYFAST_MODE === "sandbox" ? "?testing=true" : ""
    }`;

    const payfastResponse = await fetch(url, { method: "PUT", headers });

    if (!payfastResponse.ok) {
      const bodyText = await payfastResponse.text().catch(() => "");
      console.error("PayFast cancel request failed:", {
        userId,
        status: payfastResponse.status,
        body: bodyText,
      });
      return Response.json(
        { error: "Could not cancel subscription with PayFast" },
        { status: 502 },
      );
    }

    // Cancelling here means access stops immediately, not at the end of
    // the current paid period -- a deliberate simplification, not the
    // more typical "keep access until period end" SaaS pattern, since
    // that would need a background job to revisit this later. Falls
    // back to EQUIPMENT if they still own purchased equipment, matching
    // the same logic already used everywhere else in this project.
    const hasPurchasedEquipment = await prisma.userEquipment.findFirst({
      where: { userId, source: EquipmentSource.PURCHASED },
    });

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        plan: hasPurchasedEquipment ? Plan.EQUIPMENT : Plan.FREE,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Pro subscription cancellation error:", error);
    return Response.json(
      { error: "Something went wrong cancelling your subscription" },
      { status: 500 },
    );
  }
}
