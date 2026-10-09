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

export type InstagramWebhookChange = {
  field?: string;
  value?: InstagramWebhookMessagingEvent;
};

export type InstagramWebhookEntry = {
  id?: string;
  time?: number | string;
  messaging?: InstagramWebhookMessagingEvent[];
  changes?: InstagramWebhookChange[];
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

  if (
    typedPayload.object &&
    String(typedPayload.object).trim().toLowerCase() !== "instagram"
  ) {
    return [];
  }

  const entries = Array.isArray(typedPayload.entry)
    ? typedPayload.entry
    : [];

  const result: ParsedInstagramMessageEvent[] = [];

  const seenMessageIds = new Set<string>();

  for (const entry of entries) {
    const messagingEvents: InstagramWebhookMessagingEvent[] = Array.isArray(
      entry.messaging,
    )
      ? [...entry.messaging]
      : [];

    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (
        normalizeString(change.field).toLowerCase() === "messages" &&
        change.value &&
        typeof change.value === "object"
      ) {
        messagingEvents.push(change.value);
      }
    }

    for (const event of messagingEvents) {
      const message = event.message;
      if (!message) {
        continue;
      }

      const messageId = normalizeString(message.mid);
      const senderId = normalizeString(event.sender?.id);
      const recipientId = normalizeString(event.recipient?.id);
      const text = normalizeString(message.text);

      if (!messageId || seenMessageIds.has(messageId)) {
        continue;
      }

      seenMessageIds.add(messageId);

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
