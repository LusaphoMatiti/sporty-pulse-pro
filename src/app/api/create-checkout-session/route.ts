// app/api/create-checkout-session/route.ts

import { NextRequest, NextResponse } from "next/server";
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
} from "@/types/paystack";

function testLog(label: string, data?: unknown) {
  const time = new Date().toISOString();
  console.log(`\n[TEST ${time}]  ${label}`);
  if (data !== undefined) console.dir(data, { depth: 4 });
}

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PLAN_CODE = process.env.PAYSTACK_PLAN_CODE!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(req: NextRequest) {
  let body: CheckoutSessionRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, userEmail } = body;

  if (!userId || !userEmail) {
    return NextResponse.json(
      { error: "userId and userEmail are required" },
      { status: 400 },
    );
  }

  testLog("Initializing Paystack transaction", { userId, userEmail });

  try {
    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          amount: 6000, // R60.00 = 6000 kobo
          plan: PLAN_CODE,
          currency: "ZAR",
          callback_url: `${APP_URL}/success`,
          metadata: {
            userId,
            cancel_action: `${APP_URL}/pricing`,
          },
        }),
      },
    );

    const json = await paystackRes.json();
    testLog("Raw Paystack response", json);

    if (!paystackRes.ok || !json.status) {
      throw new Error(json.message ?? "Paystack init failed");
    }

    const { authorization_url, reference, access_code } = json.data;

    if (!authorization_url) {
      testLog(
        "authorization_url missing — check PAYSTACK_PLAN_CODE",
        json.data,
      );
      return NextResponse.json(
        {
          error:
            "Paystack did not return a checkout URL. Verify your PAYSTACK_PLAN_CODE.",
        },
        { status: 502 },
      );
    }

    testLog("Transaction initialized", { reference, url: authorization_url });

    const response: CheckoutSessionResponse = {
      url: authorization_url,
      reference: reference,
      access_code: access_code,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    testLog("Transaction init failed", message);
    return NextResponse.json(
      { error: "Could not initialize payment" },
      { status: 500 },
    );
  }
}
