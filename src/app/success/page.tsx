"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "confirmed" | "failed">(
    "verifying",
  );

  useEffect(() => {
    const reference = searchParams.get("reference");

    if (!reference) {
      Promise.resolve().then(() => setStatus("failed"));
      return;
    }

    fetch(`/verify-payment?reference=${reference}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("confirmed");
          setTimeout(() => navigate("/dashboard"), 3000);
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, [searchParams, navigate]);

  //  Verifying
  if (status === "verifying")
    return (
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-sp-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sp-muted">Confirming your payment...</p>
      </div>
    );

  //  Failed
  if (status === "failed")
    return (
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col items-center justify-center px-5 text-center gap-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="font-barlow font-extrabold text-4xl">
          Payment not confirmed
        </h1>
        <p className="text-sp-muted">
          Please contact support if you were charged.
        </p>
        <button
          onClick={() => navigate("/settings")}
          className="bg-sp-accent text-sp-bg font-barlow font-bold text-base tracking-wide uppercase rounded-xl py-3 px-8"
        >
          Back to Settings
        </button>
      </div>
    );

  //  Confirmed
  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col items-center justify-center px-5 text-center gap-4">
      <div className="text-5xl">🎉</div>
      <h1 className="font-barlow font-extrabold text-4xl">
        You&apos;re Premium!
      </h1>
      <p className="text-sp-muted">
        All premium features are now unlocked. Redirecting you now...
      </p>
    </div>
  );
}
