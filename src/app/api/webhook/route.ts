import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { PaystackWebhookEvent } from "@/types/paystack";

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

function testLog(label: string, data?: unknown) {
  const time = new Date().toISOString();
  console.log(`\n[WEBHOOK ${time}]  ${label}`);
  if (data !== undefined) console.dir(data, { depth: 4 });
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  const signature = req.headers.get("x-paystack-signature") ?? "";
  const hash = crypto
    .createHmac("sha512", SECRET_KEY)
    .update(bodyBuffer)
    .digest("hex");

  if (hash !== signature) {
    testLog("Invalid webhook signature — rejected");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(bodyBuffer.toString("utf-8"));
  } catch {
    testLog("Could not parse webhook body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  testLog(`Webhook received: ${event.event}`, event.data);

  switch (event.event) {
    case "subscription.create": {
      const { customer, subscription_code } = event.data;
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true },
      });
      if (user) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            plan: "PRO",
            status: "active",
            source: subscription_code ?? "paystack",
            startedAt: new Date(),
            expiresAt: null,
          },
          create: {
            userId: user.id,
            plan: "PRO",
            status: "active",
            source: subscription_code ?? "paystack",
          },
        });
        testLog(`Subscription CREATED — user ${user.id} → PRO`);
      } else {
        testLog(`subscription.create — no user found for ${customer.email}`);
      }
      break;
    }

    case "subscription.disable": {
      const { customer } = event.data;
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true },
      });
      if (user) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: { plan: "FREE", status: "inactive", expiresAt: new Date() },
          create: { userId: user.id, plan: "FREE", status: "inactive" },
        });
        testLog(`Subscription DISABLED — user ${user.id} → FREE`);
      }
      break;
    }

    case "subscription.enable": {
      const { customer, subscription_code } = event.data;
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true },
      });
      if (user) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            plan: "PRO",
            status: "active",
            source: subscription_code ?? "paystack",
            expiresAt: null,
          },
          create: {
            userId: user.id,
            plan: "PRO",
            status: "active",
            source: subscription_code ?? "paystack",
          },
        });
        testLog(`Subscription RE-ENABLED — user ${user.id} → PRO`);
      }
      break;
    }

    case "charge.success": {
      const { customer } = event.data;
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true },
      });
      if (user) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: { plan: "PRO", status: "active", expiresAt: null },
          create: { userId: user.id, plan: "PRO", status: "active" },
        });
        testLog(`Charge SUCCESS — user ${user.id} kept on PRO`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const { customer } = event.data;
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true },
      });
      if (user) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: { status: "past_due" },
          create: { userId: user.id, plan: "FREE", status: "past_due" },
        });
        testLog(`Invoice FAILED — user ${user.id} marked past_due`);
      }
      break;
    }

    default:
      testLog(`Unhandled event: ${event.event}`);
  }

  return new NextResponse("OK", { status: 200 });
}
