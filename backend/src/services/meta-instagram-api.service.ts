import { env } from "../config/env.js";
import { isInstagramRecipientAllowed } from "./instagram-automation-gate.service.js";
import {
  clearPendingAiInstagramOutbound,
  confirmPendingAiInstagramOutbound,
  registerPendingAiInstagramOutbound,
} from "./instagram-outbound-echo.service.js";

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
      reason:
        | "INSTAGRAM_SEND_ENABLED=false"
        | "recipient_not_allowlisted";
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
  // Dashboard/human messages are not AI echoes, even on the same transport.
  origin?: "ai" | "human";
  // Instagram text-only quick replies; optional, never inferred from a draft.
  quickReplies?: Array<{ title: string; payload: string }>;
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

  if (!isInstagramRecipientAllowed(to)) {
    return {
      ok: true,
      sent: false,
      dryRun: true,
      sendSkipped: true,
      reason: "recipient_not_allowlisted",
    };
  }

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

  const quickReplies = input.quickReplies ?? [];
  if (quickReplies.length > 13 || quickReplies.some(item =>
    !item.title || item.title.length > 20 ||
    !item.payload || item.payload.length > 1000)) {
    return { ok: false, sent: false, dryRun: false, sendSkipped: false,
      error: "Instagram Quick-Reply-Payload ungültig." };
  }

  const pendingToken = input.origin === "human"
    ? null
    : registerPendingAiInstagramOutbound({
        recipientId: to,
        text: body,
      });

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
          ...(quickReplies.length ? { quick_replies: quickReplies.map(item => ({
            content_type: "text", title: item.title, payload: item.payload,
          })) } : {}),
        },
      }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      if (pendingToken) clearPendingAiInstagramOutbound(pendingToken);
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

    const metaMessageId = getMetaMessageId(responseBody);
    if (pendingToken) {
      confirmPendingAiInstagramOutbound({
        token: pendingToken,
        metaMessageId,
      });
    }

    return {
      ok: true,
      sent: true,
      dryRun: false,
      sendSkipped: false,
      metaMessageId,
    };
  } catch (error) {
    if (pendingToken) clearPendingAiInstagramOutbound(pendingToken);
    return {
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error: sanitizeError(error),
    };
  }
}
