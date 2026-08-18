export async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
      channelId: "default",
    }),
  });
  const json = await res.json();
  const ticket = json?.data;
  if (ticket?.status === "error") {
    console.error(
      `[sendExpoPush] rejected for ${pushToken}:`,
      ticket.message,
      ticket.details,
    );
    return { success: false, error: ticket.message };
  }
  return { success: true, ticket };
}
