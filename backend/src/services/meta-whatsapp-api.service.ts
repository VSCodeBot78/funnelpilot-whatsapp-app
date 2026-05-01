import { env } from "../config/env.js";

export type MetaWhatsappSendResult =
  | {
      ok: true;
      sent: true;
      dryRun: false;
      sendSkipped: false;
      metaMessageId: string | null;
    }
  | {
      ok: true;
      sent: false;
      dryRun: true;
      sendSkipped: true;
      reason: "WHATSAPP_SEND_ENABLED=false";
    }
  | {
      ok: false;
      sent: false;
      dryRun: false;
      sendSkipped: false;
      error: string;
    };

type SendTextMessageInput = {
  to: string;
  body: string;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeError(value: unknown): string {
  const text =
    value instanceof Error ? value.message : normalizeString(value);

  return (text || "Meta WhatsApp Send fehlgeschlagen.").slice(0, 240);
}

function getMetaMessageId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const messages = (responseBody as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const firstMessage = messages[0] as { id?: unknown };
  const id = normalizeString(firstMessage?.id);
  return id || null;
}

function buildMetaSendUrl(): string {
  const version = normalizeString(env.META_GRAPH_API_VERSION) || "v20.0";
  return `https://graph.facebook.com/${version}/${env.META_PHONE_NUMBER_ID}/messages`;
}

export async function sendMetaWhatsappTextMessage(
  input: SendTextMessageInput,
): Promise<MetaWhatsappSendResult> {
  if (!env.WHATSAPP_SEND_ENABLED) {
    return {
      ok: true,
      sent: false,
      dryRun: true,
      sendSkipped: true,
      reason: "WHATSAPP_SEND_ENABLED=false",
    };
  }

  const to = normalizeString(input.to);
  const body = normalizeString(input.body);

  if (!env.META_ACCESS_TOKEN || !env.META_PHONE_NUMBER_ID) {
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error:
        "WHATSAPP_SEND_ENABLED=true, aber META_ACCESS_TOKEN oder META_PHONE_NUMBER_ID fehlt.",
    };
  }

  if (!to || !body) {
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error: "Empfaengernummer oder Nachrichtentext fehlt.",
    };
  }

  try {
    const response = await fetch(buildMetaSendUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body,
        },
      }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      const metaError =
        responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody
          ? (responseBody as { error?: { message?: unknown } }).error?.message
          : undefined;

      return {
        ok: false,
        sent: false,
        dryRun: false,
        sendSkipped: false,
        error: sanitizeError(metaError || response.statusText),
      };
    }

    return {
      ok: true,
      sent: true,
      dryRun: false,
      sendSkipped: false,
      metaMessageId: getMetaMessageId(responseBody),
    };
  } catch (error) {
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error: sanitizeError(error),
    };
  }
}
