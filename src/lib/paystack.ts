import type {
  PaystackInitResponse,
  PaystackVerifyResponse,
} from "@/types/paystack";

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PLAN_CODE = process.env.PAYSTACK_PLAN_CODE!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

if (!SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error(
    "PAYSTACK_SECRET_KEY must be a test key (sk_test_...). Check your .env.local",
  );
}

const PAYSTACK_BASE = "https://api.paystack.co";

const headers = {
  Authorization: `Bearer ${SECRET_KEY}`,
  "Content-Type": "application/json",
};

export async function initializeTransaction(
  email: string,
  userId: string,
): Promise<PaystackInitResponse["data"]> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      amount: 6000,
      plan: PLAN_CODE,
      currency: "ZAR",
      callback_url: `${APP_URL}/success`,
      metadata: {
        userId,
        cancel_action: `${APP_URL}/pricing`,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Paystack init failed");
  }

  const json: PaystackInitResponse = await res.json();
  return json.data;
}

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse["data"]> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Paystack verify failed");
  }

  const json: PaystackVerifyResponse = await res.json();
  return json.data;
}
