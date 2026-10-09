import { env } from "../config/env.js";

export type MetaInstagramSendResult =
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
      reason: "INSTAGRAM_SEND_ENABLED=false";
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

  return (text || "Meta Instagram Send fehlgeschlagen.").slice(0, 240);
}

function getMetaMessageId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const id = normalizeString(
    (responseBody as { message_id?: unknown }).message_id,
  );
  return id || null;
}

export function buildInstagramSendUrl(): string {
  const version =
    normalizeString(env.INSTAGRAM_GRAPH_API_VERSION) || "v26.0";
  const accountId = normalizeString(env.INSTAGRAM_ACCOUNT_ID);
  return `https://graph.instagram.com/${version}/${accountId}/messages`;
}

export async function sendMetaInstagramTextMessage(
  input: SendTextMessageInput,
): Promise<MetaInstagramSendResult> {
  if (!env.INSTAGRAM_SEND_ENABLED) {
    return {
      ok: true,
      sent: false,
      dryRun: true,
      sendSkipped: true,
      reason: "INSTAGRAM_SEND_ENABLED=false",
    };
  }

  const to = normalizeString(input.to);
  const body = normalizeString(input.body);

  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error:
        "INSTAGRAM_SEND_ENABLED=true, aber INSTAGRAM_ACCESS_TOKEN oder INSTAGRAM_ACCOUNT_ID fehlt.",
    };
  }

  if (!to || !body) {
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error: "Instagram Empfänger-ID oder Nachrichtentext fehlt.",
    };
  }

  try {
    const response = await fetch(buildInstagramSendUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: to,
        },
        message: {
          text: body,
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
