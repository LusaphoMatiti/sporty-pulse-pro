import { Router } from "express";
import axios from "axios";
import crypto from "crypto";

import {
  validate,
  validateQuery,
  checkoutSchema,
  verifySchema,
} from "../lib/validate.js";
import { asyncHandler } from "../lib/errors.js";
import {
  checkoutSlowDown,
  checkoutLimiter,
  verifyLimiter,
} from "../middleware/security.js";

const router = Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PLAN_CODE = process.env.PAYSTACK_PLAN_CODE;
const APP_URL = process.env.APP_URL;

// ── POST /payments/create-checkout-session ─────────────────────────────────
// Initialises a Paystack transaction and returns the redirect URL.
// Protected by slow-down + hard rate limit + input validation.

router.post(
  "/create-checkout-session",
  checkoutSlowDown,
  checkoutLimiter,
  express.json(),
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const { userId, userEmail } = req.body; // already sanitised by validate()

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: userEmail,
        amount: 9900, // R99.00 in kobo
        plan: PAYSTACK_PLAN_CODE,
        currency: "ZAR",
        callback_url: `${APP_URL}/success`,
        metadata: {
          userId,
          cancel_action: `${APP_URL}/cancel`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    res.json({ url: response.data.data.authorization_url });
  }),
);

// ── GET /payments/verify-payment?reference=xxx ─────────────────────────────
// Called after Paystack redirects back to /success.
// Verifies the transaction server-side — never trust client-side status.

router.get(
  "/verify-payment",
  verifyLimiter,
  validateQuery(verifySchema),
  asyncHandler(async (req, res) => {
    const { reference } = req.query; // sanitised by validateQuery()

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      },
    );

    const { status, metadata } = response.data.data;

    if (status === "success") {
      const userId = metadata?.userId;
      // TODO: update user's subscription status in your database here
      // e.g. await prisma.user.update({ where: { id: userId }, data: { isPremium: true } })
      console.log(`✅ User ${userId} upgraded to premium`);
      return res.json({ success: true });
    }

    res.json({ success: false, status });
  }),
);

// ── POST /payments/webhook ─────────────────────────────────────────────────
// Paystack calls this for every subscription event.
// MUST use express.raw() — JSON parsing breaks the HMAC signature check.

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    // 1. Verify the request genuinely came from Paystack
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("❌ Invalid webhook signature — possible spoofed request");
      return res.status(401).send("Unauthorized");
    }

    // 2. Parse only after signature is confirmed
    const event = JSON.parse(req.body.toString());
    console.log("Paystack event received:", event.event);

    switch (event.event) {
      case "subscription.create": {
        // BUG FIX: was missing this destructure in the original file
        const { customer } = event.data;
        console.log(`✅ Subscription created for ${customer.email}`);
        // TODO: mark user as premium in your DB
        break;
      }

      case "subscription.disable": {
        const { customer } = event.data;
        console.log(`⚠️  Subscription disabled for ${customer.email}`);
        // TODO: revoke premium access in your DB
        break;
      }

      case "charge.success": {
        const { customer } = event.data;
        console.log(`💳 Recurring charge for ${customer.email}`);
        // TODO: log renewal, extend subscription expiry if needed
        break;
      }

      default:
        // Log unhandled events — useful to know what Paystack sends
        console.log(`ℹ️  Unhandled Paystack event: ${event.event}`);
    }

    // Always respond 200 quickly — Paystack retries if it doesn't get one
    res.sendStatus(200);
  },
);

export default router;
