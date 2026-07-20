"use client";

import { useEffect, useRef } from "react";

export default function CheckoutAutoSubmit({
  actionUrl,
  fields,
}: {
  actionUrl: string;
  fields: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <p>Redirecting you to secure payment...</p>
      <form
        ref={formRef}
        action={actionUrl}
        method="POST"
        style={{ display: "none" }}
      >
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>
    </div>
  );
}
