export type SendPushOptions = {
  channelId?: string;
  subtitle?: string;
  threadId?: string;
  imageUrl?: string;
};

export async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  options: SendPushOptions = {},
) {
  const message: Record<string, unknown> = {
    to: pushToken,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
    channelId: options.channelId ?? "default",
  };
  if (options.subtitle) message.subtitle = options.subtitle;
  if (options.threadId) message.threadId = options.threadId;
  if (options.imageUrl) message.richContent = { image: options.imageUrl };

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify([message]),
  });
  const json = await res.json();
  const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
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
