// import { type NextRequest } from "next/server";
// import crypto from "crypto";
// import { prisma } from "@/lib/prisma";
// import { Plan } from "@/generated/prisma/client";

// const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID as string;
// const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE as string;
// const PAYFAST_MODE = process.env.PAYFAST_MODE ?? "sandbox"; // "sandbox" | "live"

// const PAYFAST_VALIDATE_URL =
//   PAYFAST_MODE === "live"
//     ? "https://www.payfast.co.za/eng/query/validate"
//     : "https://sandbox.payfast.co.za/eng/query/validate";

// // Same single tier, no trial -- must match the checkout route exactly,
// // since this is what protects against a tampered/incorrect amount.
// const PRO_MONTHLY_PRICE = "50.00";

// const payfastEncode = (value: string) =>
//   encodeURIComponent(value.trim())
//     .replace(/%20/g, "+")
//     .replace(/!/g, "%21")
//     .replace(/'/g, "%27")
//     .replace(/\(/g, "%28")
//     .replace(/\)/g, "%29")
//     .replace(/\*/g, "%2A")
//     .replace(/~/g, "%7E");

// /**
//  * Rebuilds the signature from the ITN payload using the order fields
//  * ARRIVED in (not a fixed order -- that's only for the outgoing checkout
//  * request). Does NOT skip blank fields -- PayFast includes them in their
//  * own signature computation, a lesson learned the hard way on Store's ITN.
//  */
// const computeExpectedSignature = (params: URLSearchParams) => {
//   const pairs: string[] = [];
//   for (const [key, value] of params.entries()) {
//     if (key === "signature") continue;
//     pairs.push(`${key}=${payfastEncode(value)}`);
//   }

//   const paramString = pairs.join("&");
//   const withPassphrase = PAYFAST_PASSPHRASE
//     ? `${paramString}&passphrase=${payfastEncode(PAYFAST_PASSPHRASE)}`
//     : paramString;

//   return crypto.createHash("md5").update(withPassphrase).digest("hex");
// };

// /**
//  * Confirms with PayFast's own servers that this ITN genuinely came from
//  * them -- PayFast's recommended alternative to manually checking source IPs.
//  */
// const verifyWithPayFast = async (rawBody: string) => {
//   try {
//     const response = await fetch(PAYFAST_VALIDATE_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: rawBody,
//     });
//     const text = await response.text();
//     return text.trim() === "VALID";
//   } catch (error) {
//     console.error("PayFast validate-endpoint check failed:", error);
//     return false;
//   }
// };

// export async function POST(req: NextRequest) {
//   const rawBody = await req.text();
//   const params = new URLSearchParams(rawBody);

//   const receivedSignature = params.get("signature") ?? "";
//   const merchantId = params.get("merchant_id") ?? "";
//   const paymentStatus = params.get("payment_status") ?? "";
//   const token = params.get("token") ?? ""; // PayFast's subscription token
//   const userId = params.get("custom_str1") ?? ""; // ours, from checkout
//   const amountGross = params.get("amount_gross") ?? "";

//   const expectedSignature = computeExpectedSignature(params);

//   // ── 1. Signature check ─────────────────────────────────────────
//   if (expectedSignature !== receivedSignature) {
//     console.error("Pro PayFast ITN: signature mismatch", {
//       userId,
//       token,
//       expectedSignature,
//       receivedSignature,
//     });
//     return new Response(null, { status: 400 });
//   }

//   // ── 2. Merchant ID check (Pro's own merchant, not Store's) ─────
//   if (merchantId !== PAYFAST_MERCHANT_ID) {
//     console.error("Pro PayFast ITN: merchant ID mismatch", {
//       userId,
//       merchantIdReceived: merchantId,
//       merchantIdExpected: PAYFAST_MERCHANT_ID,
//     });
//     return new Response(null, { status: 400 });
//   }

//   // ── 3. Source check -- confirm this really came from PayFast ──
//   const isFromPayFast = await verifyWithPayFast(rawBody);
//   if (!isFromPayFast) {
//     console.error("Pro PayFast ITN: failed source validation", {
//       userId,
//       token,
//     });
//     return new Response(null, { status: 400 });
//   }

//   try {
//     // ── 4. Find the subscription: by token first (renewals), falling
//     //      back to userId (the very first charge, before a token exists) ──
//     let subscription = token
//       ? await prisma.subscription.findUnique({
//           where: { payfastToken: token },
//         })
//       : null;

//     if (!subscription && userId) {
//       subscription = await prisma.subscription.findUnique({
//         where: { userId },
//       });
//     }

//     if (!subscription) {
//       console.error("Pro PayFast ITN: no matching subscription found", {
//         userId,
//         token,
//       });
//       return new Response(null, { status: 404 });
//     }

//     // ── 5. Only ever grant/extend access on an explicit COMPLETE
//     //      status. Anything else -- failed, cancelled, or an
//     //      unrecognised value -- is treated the same conservative way:
//     //      never grant, and mark the subscription as needing attention
//     //      so downstream access checks (which gate on status === "active")
//     //      correctly stop granting Pro access.
//     if (paymentStatus === "COMPLETE") {
//       if (amountGross !== PRO_MONTHLY_PRICE) {
//         console.error("Pro PayFast ITN: amount mismatch", {
//           userId,
//           token,
//           expected: PRO_MONTHLY_PRICE,
//           received: amountGross,
//         });
//         return new Response(null, { status: 400 });
//       }

//       const nextBillingDate = new Date();
//       nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

//       await prisma.subscription.update({
//         where: { id: subscription.id },
//         data: {
//           plan: Plan.PRO,
//           status: "active",
//           payfastToken: token || subscription.payfastToken,
//           nextBillingDate,
//         },
//       });
//     } else {
//       console.warn("Pro PayFast ITN: non-complete payment status", {
//         userId,
//         token,
//         paymentStatus,
//       });

//       await prisma.subscription.update({
//         where: { id: subscription.id },
//         data: { status: "past_due" },
//       });
//     }

//     return new Response(null, { status: 200 });
//   } catch (error) {
//     console.error("Pro PayFast ITN processing error:", error);
//     return new Response(null, { status: 500 });
//   }
// }
