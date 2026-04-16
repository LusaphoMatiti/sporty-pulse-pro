import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { PaystackWebhookEvent } from "@/types/paystack";

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

function testLog(label: string, data?: unknown) {
  const time = new Date().toISOString();
  console.log(`\n[WEBHOOK ${time}]  ${label}`);
  if (data !== undefined) console.dir(data, { depth: 4 });
}

// Disable body parsing — we need the raw buffer for HMAC verification
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Read raw body for signature check
  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  // 2. Verify Paystack signature
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const hash = crypto
    .createHmac("sha512", SECRET_KEY)
    .update(bodyBuffer)
    .digest("hex");

  if (hash !== signature) {
    testLog("Invalid webhook signature — rejected");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 3. Parse event
  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(bodyBuffer.toString("utf-8"));
  } catch {
    testLog("Could not parse webhook body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  testLog(`Webhook received: ${event.event}`, event.data);

  // 4. Handle events
  switch (event.event) {
    // ── Subscription created ────────────────────────────────────────────────
    case "subscription.create": {
      const { customer, plan, next_payment_date, subscription_code } =
        event.data;
      testLog("Subscription CREATED", {
        email: customer.email,
        plan: plan?.plan_code,
        subscriptionCode: subscription_code,
        nextPayment: next_payment_date,
      });
      // TODO: await db.users.update({ email: customer.email }, { tier: "premium", subscriptionCode: subscription_code });
      break;
    }

    // ── Subscription disabled / cancelled ───────────────────────────────────
    case "subscription.disable": {
      const { customer, subscription_code } = event.data;
      testLog("Subscription DISABLED", {
        email: customer.email,
        subscriptionCode: subscription_code,
      });
      // TODO: await db.users.update({ email: customer.email }, { tier: "free" });
      break;
    }

    // ── Subscription re-enabled ─────────────────────────────────────────────
    case "subscription.enable": {
      const { customer, subscription_code } = event.data;
      testLog("Subscription RE-ENABLED", {
        email: customer.email,
        subscriptionCode: subscription_code,
      });
      // TODO: await db.users.update({ email: customer.email }, { tier: "premium" });
      break;
    }

    // ── Recurring charge succeeded ──────────────────────────────────────────
    case "charge.success": {
      const { customer, amount, currency, metadata } = event.data;
      testLog("Recurring charge SUCCEEDED", {
        email: customer.email,
        amount: `${currency} ${((amount ?? 0) / 100).toFixed(2)}`,
        userId: metadata?.userId,
      });
      // TODO: log payment record, extend subscription
      break;
    }

    // ── Invoice created ─────────────────────────────────────────────────────
    case "invoice.create": {
      const { customer, amount, currency } = event.data;
      testLog("Invoice CREATED (upcoming charge)", {
        email: customer.email,
        amount: `${currency} ${((amount ?? 0) / 100).toFixed(2)}`,
      });
      break;
    }

    // ── Invoice payment failed ──────────────────────────────────────────────
    case "invoice.payment_failed": {
      const { customer, subscription_code } = event.data;
      testLog("Invoice payment FAILED", {
        email: customer.email,
        subscriptionCode: subscription_code,
      });
      // TODO: send dunning email, flag account
      break;
    }

    default:
      testLog(`Unhandled event: ${event.event}`);
  }

  // Always return 200 quickly so Paystack doesn't retry
  return new NextResponse("OK", { status: 200 });
}
