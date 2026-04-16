import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY; // sk_test_...
const PAYSTACK_PLAN_CODE = process.env.PAYSTACK_PLAN_CODE; // PLN_...
const APP_URL = process.env.APP_URL; // http://localhost:5173

//  Initialize Transaction
app.post("/create-checkout-session", express.json(), async (req, res) => {
  const { userId, userEmail } = req.body;

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: userEmail,
        amount: 9900, // in kobo/cents — R99.00 = 9900
        plan: PAYSTACK_PLAN_CODE, // this makes it a recurring subscription
        currency: "ZAR",
        callback_url: `${APP_URL}/success`,
        metadata: {
          userId, // stored so you can retrieve it after payment
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

    // Return the redirect URL to your frontend
    res.json({ url: response.data.data.authorization_url });
  } catch (error) {
    console.error("Paystack error:", error.response?.data || error.message);
    res.status(500).json({ error: "Could not initialize payment" });
  }
});

// Verify payment on success redirect
// Paystack redirects to /success?reference=xxx — verify it server-side
app.get("/verify-payment", async (req, res) => {
  const { reference } = req.query;

  if (!reference)
    return res.status(400).json({ error: "No reference provided" });

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      },
    );

    const { status, metadata } = response.data.data;

    if (status === "success") {
      const userId = metadata?.userId;

      console.log(` User ${userId} upgraded to premium`);
      return res.json({ success: true });
    }

    res.json({ success: false, status });
  } catch (error) {
    console.error("Verify error:", error.response?.data || error.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    console.error(" Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  const event = JSON.parse(req.body.toString());
  console.log("Paystack event:", event.event);

  switch (event.event) {
    case "subscription.create": {
      console.log(` Subscription created for ${customer.email}`);

      break;
    }

    case "subscription.disable": {
      const { customer } = event.data;
      console.log(` Subscription disabled for ${customer.email}`);

      break;
    }

    case "charge.success": {
      const { customer } = event.data;
      console.log(` Recurring charge for ${customer.email}`);
      break;
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server on :3000"));
