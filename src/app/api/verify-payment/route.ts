import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import type { VerifyPaymentResponse } from "@/types/paystack";

function testLog(label: string, data?: unknown) {
  const time = new Date().toISOString();
  console.log(`\n[TEST ${time} ${label}]`);
  if (data !== undefined) console.log(data, { depth: 4 });
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");

  if (!reference) {
    return NextResponse.json(
      { error: "No reference provided" },
      { status: 400 },
    );
  }

  testLog("Verifying payment", { reference });

  try {
    const data = await verifyTransaction(reference);

    testLog("Paystack verify response", {
      status: data.status,
      email: data.customer?.email,
      plan: data.plan?.plan_code,
      amount: data.amount,
      currency: data.currency,
    });

    if (data.status === "success") {
      const userId = data.metadata?.userId;

      testLog(`User ${userId} upgraded to Sporty Pulse Pro`);

      const response: VerifyPaymentResponse = {
        success: true,
        userId,
        email: data.customer?.email,
        planCode: data.plan?.plan_code,
        subscriptionCode: data.plan?.subscription_code,
        amount: data.amount,
        currency: data.currency,
      };

      return NextResponse.json(response);
    }

    testLog("Payment not successful", { status: data.status });
    return NextResponse.json({ success: false, status: data.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    testLog("Verification failed", message);
    return NextResponse.json({ error: "Verfication failed" }, { status: 500 });
  }
}
