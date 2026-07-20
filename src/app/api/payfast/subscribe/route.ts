import { type NextRequest } from "next/server";
import crypto from "crypto";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID as string;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY as string;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE as string;
const PAYFAST_MODE = process.env.PAYFAST_MODE ?? "sandbox"; // "sandbox" | "live"

const PAYFAST_PROCESS_URL =
  PAYFAST_MODE === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";

// Single tier, no trial -- confirmed decision.
const PRO_MONTHLY_PRICE = "50.00";

// Same base order as Store's checkout, extended with the recurring
// billing fields at the end -- confirmed position against PayFast's
// documented field order (same source used for Store's).
const SIGNATURE_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
] as const;

// PHP urlencode() replication -- same as Store's, proven correct there.
const payfastEncode = (value: string) =>
  encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E");

const buildSignature = (fields: Record<string, string>) => {
  const paramString = SIGNATURE_FIELD_ORDER.filter(
    (key) => fields[key] !== undefined && fields[key] !== "",
  )
    .map((key) => `${key}=${payfastEncode(fields[key])}`)
    .join("&");

  const withPassphrase = PAYFAST_PASSPHRASE
    ? `${paramString}&passphrase=${payfastEncode(PAYFAST_PASSPHRASE)}`
    : paramString;

  return crypto.createHash("md5").update(withPassphrase).digest("hex");
};

export async function POST(req: NextRequest) {
  if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY) {
    console.error("PayFast credentials are not set on Pro");
    return Response.json(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id || !session.user.email) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  const requestHeaders = new Headers(req.headers);
  const origin = requestHeaders.get("origin");

  try {
    // Charge immediately -- confirmed decision, no trial period.
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const fields: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      // These need to be real web pages that deep-link back into the
      // app -- see note below, not built yet.
      return_url: `${origin}/subscribe/success`,
      cancel_url: `${origin}/subscribe/cancelled`,
      notify_url: `${origin}/api/payfast/notify`,
      email_address: session.user.email,
      m_payment_id: crypto.randomUUID(),
      amount: PRO_MONTHLY_PRICE,
      item_name: "Sporty Pulse Pro Subscription",
      // Carried through so the ITN handler knows which user this is for.
      custom_str1: session.user.id,
      subscription_type: "1", // 1 = full subscription (fixed schedule)
      billing_date: today,
      recurring_amount: PRO_MONTHLY_PRICE,
      frequency: "3", // monthly
      cycles: "0", // indefinite -- runs until cancelled
    };

    const signature = buildSignature(fields);
    const allFields = { ...fields, signature };

    // React Native can't submit an HTML form the way a browser can, so
    // the prepared fields get handed off via a short-lived, single-use
    // code instead -- the mobile app opens a web page (in the system
    // browser) that does the actual auto-submit on its behalf.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        fields: allFields,
        actionUrl: PAYFAST_PROCESS_URL,
        expiresAt,
      },
    });

    return Response.json({
      checkoutUrl: `${origin}/subscribe/checkout?code=${checkoutSession.id}`,
    });
  } catch (error) {
    console.error("PayFast Pro subscription initiation failed:", error);
    return Response.json(
      { error: "Could not initiate Pro subscription checkout" },
      { status: 500 },
    );
  }
}
