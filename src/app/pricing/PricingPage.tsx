"use client";
import { useState } from "react";
import type { CheckoutSessionResponse } from "@/types/paystack";

const FREE_FEATURES = [
  { text: "Bodyweight programs", included: true },
  { text: "Max 2 active programs", included: true },
  { text: "Basic tracking", included: true },
  { text: "Equipment programs", included: false },
  { text: "AI coaching", included: false },
  { text: "Advanced analytics", included: false },
];

const PRO_FEATURES = [
  { text: "Everything in Equipment", included: true },
  { text: "AI training coach", included: true },
  { text: "Personalised programs", included: true },
  { text: "Advanced analytics", included: true },
  { text: "Priority support", included: true },
];

const PricingPage = () => {
  const [userId, setUserId] = useState("test_user_001");
  const [userEmail, setUserEmail] = useState("test@sportypulse.co.za");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  async function startCheckout() {
    if (!userId.trim() || !userEmail.trim()) {
      setAlert({ type: "error", msg: "Please fill in your User ID and Email" });
      return;
    }
    if (!userEmail.includes("@")) {
      setAlert({ type: "error", msg: "Please enter a valid email address" });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userEmail }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Server error");
      }

      const data: CheckoutSessionResponse = await res.json();

      setAlert({
        type: "success",
        msg: `Session created (ref: ${data.reference}). Redirecting... `,
      });

      setTimeout(() => {
        window.location.href = data.url;
      }, 900);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setAlert({ type: "error", msg: `Payment init failed: ${message}` });
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#0a0a0a] text-sp-text min-h-screen relative">
      {/* Test Banner */}

      <div className="relative z-10 max-w-240 mx-auto px-5 pb-20">
        {/* Nav */}
        <nav className="flex items-center justify-between py-8">
          <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center mb-6">
            <span className="font-barlow font-black text-xl text-sp-accent">
              SP
            </span>
          </div>
        </nav>

        {/* Hero */}
        <div className="text-center pb-14 animate-[fadeUp_0.45s_ease_both]">
          <div className="text-[0.72rem] font-semibold tracking-[0.2em] uppercase text-sp-accent font-barlow mb-4">
            Upgrade your experience
          </div>

          <h1 className=" text-[clamp(3.5rem,10vw,7rem)] leading-[0.9] mb-6 font-barlow">
            Go <span className="text-sp-accent">Pro.</span>
            <br />
            Play Harder.
          </h1>

          <p className="text-[#888] max-w-105 mx-auto leading-[1.7]">
            Unlock AI training coach, Personalised programs, Advanced analytics
            and Priority support — all in one pulse.
          </p>
        </div>

        {/* User Form */}
        <div className="mb-8 p-7 border border-[#2a2a2a] rounded-xl bg-[#1c1c1c]">
          <div className="text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[#555] mb-5">
            Your Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.72rem] font-semibold text-[#555]">
                User ID
              </label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-[#f5f2eb] text-sm focus:border-[#b5f542] outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[0.72rem] font-semibold text-[#555]">
                Email Address
              </label>
              <input
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-[#f5f2eb] text-sm focus:border-[#b5f542] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <div
            className={`mb-6 text-sm px-5 py-3 rounded-lg border ${
              alert.type === "success"
                ? "bg-[#0d2a0d] border-[#2a5a2a] text-[#6fcf97]"
                : "bg-[#2a0d0d] border-[#5a2a2a] text-[#eb5757]"
            }`}
          >
            {alert.msg}
          </div>
        )}

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Free Card */}
          <div className="border border-[#2a2a2a] rounded-xl p-8 bg-[#1c1c1c]">
            <div className="text-[0.68rem] font-bold tracking-[0.2em] uppercase text-[#555] mb-4">
              Free
            </div>

            <div className=" text-[3.5rem] leading-none font-barlow">
              <sup className="text-lg font-semibold ">R</sup>0
            </div>

            <div className="text-[0.76rem] text-[#555] mb-6">forever</div>

            <hr className="border-[#2a2a2a] mb-6" />

            {/* ✅ FEATURES */}
            <ul className="flex flex-col gap-3 mb-8">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f.text}
                  className="flex items-start gap-2 text-sm text-[#aaa]"
                >
                  {f.included ? (
                    <svg
                      className="w-4 h-4 mt-0.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="#444"
                      strokeWidth="2"
                    >
                      <polyline points="2,8 6,12 14,4" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 mt-0.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="#333"
                      strokeWidth="2"
                    >
                      <line x1="3" y1="3" x2="13" y2="13" />
                      <line x1="13" y1="3" x2="3" y2="13" />
                    </svg>
                  )}
                  {f.text}
                </li>
              ))}
            </ul>

            <button className="w-full py-3 border border-[#2a2a2a] rounded text-[#f5f2eb] opacity-60 cursor-not-allowed">
              Current Plan
            </button>
          </div>

          {/* Pro Card */}
          <div className="border border-[#b5f542] rounded-xl p-8 bg-[#111] relative">
            <div className="absolute top-0 right-6 bg-[#b5f542] text-black text-[0.6rem] font-bold tracking-[0.15em] px-2 py-1 rounded-b">
              MOST POPULAR
            </div>

            <div className="text-[0.68rem] font-bold tracking-[0.2em] uppercase text-[#b5f542] mb-4">
              Pro
            </div>

            <div className=" text-[3.5rem] leading-none font-barlow">
              <sup className="text-lg font-semibold ">R</sup>60
            </div>

            <div className="text-[0.76rem] text-[#555] mb-6">
              per month · cancel anytime
            </div>

            <hr className="border-[#2a2a2a] mb-6" />

            {/* ✅ FEATURES */}
            <ul className="flex flex-col gap-3 mb-8">
              {PRO_FEATURES.map((f) => (
                <li
                  key={f.text}
                  className="flex items-start gap-2 text-sm text-[#ccc]"
                >
                  <svg
                    className="w-4 h-4 mt-0.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="#b5f542"
                    strokeWidth="2"
                  >
                    <polyline points="2,8 6,12 14,4" />
                  </svg>
                  {f.text}
                </li>
              ))}
            </ul>

            <button
              onClick={startCheckout}
              disabled={loading}
              className="w-full py-3 rounded bg-[#b5f542] text-black font-bold hover:bg-[#8fcf28] transition disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : (
                "Upgrade to Pro — R60/mo"
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[#555] text-xs mt-12 leading-7">
          Payments powered by{" "}
          <a
            href="https://paystack.com"
            className="text-[#666] hover:text-[#888]"
          >
            Paystack
          </a>{" "}
          · ZAR · Recurring monthly billing
        </div>
      </div>
    </div>
  );
};
export default PricingPage;
