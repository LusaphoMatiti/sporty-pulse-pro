"use client";

import { useEffect } from "react";

const DEEP_LINK = "sporty-pulse-pro://subscribe/success";

export default function SubscribeSuccessPage() {
  useEffect(() => {
    window.location.href = DEEP_LINK;
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        gap: 12,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Payment received</h1>
      <p style={{ opacity: 0.7, maxWidth: 320 }}>
        We&apos;re confirming your subscription now. Taking you back to the
        app...
      </p>

      <a
        href={DEEP_LINK}
        style={{
          marginTop: 16,
          textDecoration: "underline",
          fontSize: 14,
        }}
      >
        Open Sporty Pulse Pro
      </a>
    </div>
  );
}
