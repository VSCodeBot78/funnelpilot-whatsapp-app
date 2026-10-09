export type InstagramWebhookMessage = {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  attachments?: unknown[];
};

export type InstagramWebhookMessagingEvent = {
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  timestamp?: number | string;
  message?: InstagramWebhookMessage;
};

export type InstagramWebhookEntry = {
  id?: string;
  time?: number | string;
  messaging?: InstagramWebhookMessagingEvent[];
};

export type InstagramWebhookPayload = {
  object?: string;
  entry?: InstagramWebhookEntry[];
};

export type ParsedInstagramMessageEvent = {
  messageId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestampMs?: number;
  isEcho: boolean;
  hasAttachments: boolean;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTimestampMs(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function parseInstagramMessageEvents(
  payload: unknown,
): ParsedInstagramMessageEvent[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const typedPayload = payload as InstagramWebhookPayload;
  const entries = Array.isArray(typedPayload.entry)
    ? typedPayload.entry
    : [];

  const result: ParsedInstagramMessageEvent[] = [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging)
      ? entry.messaging
      : [];

    for (const event of messaging) {
      const message = event.message;
      if (!message) {
        continue;
      }

      const messageId = normalizeString(message.mid);
      const senderId = normalizeString(event.sender?.id);
      const recipientId = normalizeString(event.recipient?.id);
      const text = normalizeString(message.text);

      if (!messageId) {
        continue;
      }

      result.push({
        messageId,
        senderId,
        recipientId,
        text,
        timestampMs: normalizeTimestampMs(event.timestamp),
        isEcho: message.is_echo === true,
        hasAttachments:
          Array.isArray(message.attachments) &&
          message.attachments.length > 0,
      });
    }
  }

  return result;
}

export function instagramTimestampToIso(
  timestampMs?: number,
): string {
  if (!timestampMs || !Number.isFinite(timestampMs)) {
    return new Date().toISOString();
  }

  return new Date(timestampMs).toISOString();
}
