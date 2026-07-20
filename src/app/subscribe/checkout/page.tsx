import { prisma } from "@/lib/prisma";
import CheckoutAutoSubmit from "./CheckoutAutoSubmit";

function ErrorState({ message }: { message: string }) {
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
      <p>{message}</p>
    </div>
  );
}

export default async function SubscribeCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (!code) {
    return <ErrorState message="Missing checkout code." />;
  }

  const session = await prisma.checkoutSession.findUnique({
    where: { id: code },
  });

  if (!session || session.usedAt || session.expiresAt < new Date()) {
    return (
      <ErrorState message="This checkout link has expired or already been used. Please go back to the app and try again." />
    );
  }

  // Consume it immediately -- single-use, prevents replay.
  await prisma.checkoutSession.update({
    where: { id: code },
    data: { usedAt: new Date() },
  });

  return (
    <CheckoutAutoSubmit
      actionUrl={session.actionUrl}
      fields={session.fields as Record<string, string>}
    />
  );
}
