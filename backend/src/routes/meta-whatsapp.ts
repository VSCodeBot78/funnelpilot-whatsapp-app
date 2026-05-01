import { Router } from "express";
import { env } from "../config/env.js";
import {
  getMessageEventByMessageId,
  saveMessageEventLogEntry,
  type MessageEventStatus,
} from "../data/message-events.store.js";
import {
  getOrCreateConversationState,
  persistConversationState,
} from "../core/state-manager.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { sendMetaWhatsappTextMessage } from "../services/meta-whatsapp-api.service.js";
import { syncWhatsappLead } from "../services/whatsapp-lead-sync.service.js";
import type { ConversationMessage } from "../types/types.js";

const router = Router();
const PROVIDER = "meta_whatsapp" as const;

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
};

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
};

type MetaContact = {
  wa_id?: string;
  profile?: {
    name?: string;
  };
};

type MetaWebhookValue = {
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
  contacts?: MetaContact[];
};

type MetaWebhookChange = {
  value?: MetaWebhookValue;
};

type MetaWebhookEntry = {
  changes?: MetaWebhookChange[];
};

type MetaWebhookPayload = {
  entry?: MetaWebhookEntry[];
};

type WebhookOutboundStatus =
  | "not_prepared"
  | "prepared"
  | "dry_run"
  | "sent"
  | "send_failed";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function metaTimestampToIso(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return nowIso();
  }

  return new Date(timestamp * 1000).toISOString();
}

function buildLogEntry(params: {
  messageId: string;
  from?: string;
  receivedAt?: string;
  type?: string;
  status: MessageEventStatus;
  raw?: Record<string, unknown>;
}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    provider: PROVIDER,
    messageId: params.messageId,
    from: params.from,
    receivedAt: params.receivedAt || nowIso(),
    type: params.type,
    status: params.status,
    raw: params.raw,
  };
}

function getContactNameByWaId(
  contacts: MetaContact[] | undefined,
  waId: string,
): string {
  if (!contacts?.length || !waId) {
    return "";
  }

  const contact = contacts.find(
    (item) => normalizeString(item.wa_id) === waId,
  );

  return normalizeString(contact?.profile?.name);
}

function buildMessageRawPreview(
  message: MetaMessage,
  contactName: string,
): Record<string, unknown> {
  const textBody = normalizeString(message.text?.body);

  return {
    timestamp: normalizeString(message.timestamp),
    contactName: contactName || undefined,
    textPreview: textBody ? textBody.slice(0, 160) : undefined,
  };
}

function buildBotReplyPreview(value: unknown): string | undefined {
  const text = normalizeString(value);
  return text ? text.slice(0, 500) : undefined;
}

function markLatestAssistantMessagePrepared(params: {
  messages: ConversationMessage[];
  replyText: string;
}): boolean {
  const replyText = normalizeString(params.replyText);
  if (!replyText) {
    return false;
  }

  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (
      message.role === "assistant" &&
      normalizeString(message.text) === replyText
    ) {
      message.outboundStatus = "prepared";
      message.transport = PROVIDER;
      message.dryRun = true;
      message.sentAt = null;
      message.metaMessageId = null;
      message.sent = false;
      message.sendError = null;
      return true;
    }
  }

  return false;
}

function updateLatestAssistantMessageSendResult(params: {
  messages: ConversationMessage[];
  replyText: string;
  outboundStatus: "sent" | "send_failed";
  sentAt?: string | null;
  metaMessageId?: string | null;
  sendError?: string | null;
}): boolean {
  const replyText = normalizeString(params.replyText);
  if (!replyText) {
    return false;
  }

  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (
      message.role === "assistant" &&
      normalizeString(message.text) === replyText
    ) {
      message.outboundStatus = params.outboundStatus;
      message.transport = PROVIDER;
      message.dryRun = params.outboundStatus !== "sent";
      message.sentAt = params.sentAt ?? null;
      message.metaMessageId = params.metaMessageId ?? null;
      message.sent = params.outboundStatus === "sent";
      message.sendError = params.sendError ?? null;
      return true;
    }
  }

  return false;
}

function logMetaMessage(params: {
  messageId: string;
  from?: string;
  type?: string;
  status: MessageEventStatus;
  leadId?: string;
  campaignId?: string;
  engineProcessed?: boolean;
  botReplyPrepared?: boolean;
  outboundStatus?: WebhookOutboundStatus;
  sent?: boolean;
}): void {
  console.log(
    [
      "[meta-whatsapp]",
      `messageId=${params.messageId}`,
      `from=${params.from || "-"}`,
      `type=${params.type || "-"}`,
      `status=${params.status}`,
      params.leadId ? `leadId=${params.leadId}` : undefined,
      params.campaignId ? `campaignId=${params.campaignId}` : undefined,
      typeof params.engineProcessed === "boolean"
        ? `engineProcessed=${params.engineProcessed}`
        : undefined,
      typeof params.botReplyPrepared === "boolean"
        ? `botReplyPrepared=${params.botReplyPrepared}`
        : undefined,
      params.outboundStatus
        ? `outboundStatus=${params.outboundStatus}`
        : undefined,
      typeof params.sent === "boolean" ? `sent=${params.sent}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

router.get("/", (req, res) => {
  const mode = normalizeString(req.query["hub.mode"]);
  const verifyToken = normalizeString(req.query["hub.verify_token"]);
  const challenge = normalizeString(req.query["hub.challenge"]);

  if (!env.META_VERIFY_TOKEN) {
    return res.status(500).json({
      ok: false,
      error:
        "META_VERIFY_TOKEN ist nicht gesetzt. Webhook-Verification ist im DryRun vorbereitet, aber noch nicht konfiguriert.",
    });
  }

  if (mode === "subscribe" && verifyToken === env.META_VERIFY_TOKEN) {
    return res.status(200).type("text/plain").send(challenge);
  }

  return res.status(403).json({
    ok: false,
    error: "Meta WhatsApp Webhook Verification fehlgeschlagen.",
  });
});

router.post("/", async (req, res) => {
  const payload = (req.body ?? {}) as MetaWebhookPayload;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  let processed = 0;
  let duplicates = 0;
  let ignoredStatuses = 0;
  let ignoredUnsupported = 0;
  let failed = 0;
  let leadAction: "found" | "created" | undefined;
  let leadId: string | undefined;
  let conversationUpdated = false;
  let messageAppended = false;
  let engineProcessed = false;
  let botReplyPrepared = false;
  let botReplyPreview: string | undefined;
  let outboundStatus: WebhookOutboundStatus = "not_prepared";
  let sent = false;
  let dryRun = true;
  let sendSkipped = false;
  let sendSkipReason: string | undefined;
  let metaMessageId: string | null = null;

  try {
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change.value ?? {};
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const messages = Array.isArray(value.messages) ? value.messages : [];

        for (const status of statuses) {
          ignoredStatuses += 1;

          const messageId = normalizeString(status.id);
          if (messageId) {
            saveMessageEventLogEntry(
              buildLogEntry({
                messageId,
                from: normalizeString(status.recipient_id) || undefined,
                receivedAt: nowIso(),
                type: "status",
                status: "ignored_status",
                raw: {
                  timestamp: normalizeString(status.timestamp),
                  deliveryStatus: normalizeString(status.status),
                },
              }),
            );
            logMetaMessage({
              messageId,
              from: normalizeString(status.recipient_id),
              type: "status",
              status: "ignored_status",
            });
          }
        }

        for (const message of messages) {
          const messageId = normalizeString(message.id);
          const from = normalizeString(message.from);
          const type = normalizeString(message.type) || "unknown";
          const receivedAt = metaTimestampToIso(message.timestamp);

          if (!messageId) {
            failed += 1;
            continue;
          }

          const existing = getMessageEventByMessageId(PROVIDER, messageId);
          if (existing) {
            duplicates += 1;
            saveMessageEventLogEntry(
              buildLogEntry({
                messageId,
                from,
                receivedAt: nowIso(),
                type,
                status: "ignored_duplicate",
                raw: {
                  incomingStatus: "duplicate",
                  previousStatus: existing.status,
                  engineProcessed: false,
                  botReplyPrepared: false,
                  outboundStatus: "not_prepared",
                  sent: false,
                },
              }),
            );
            logMetaMessage({
              messageId,
              from,
              type,
              status: "ignored_duplicate",
              engineProcessed: false,
              botReplyPrepared: false,
              outboundStatus: "not_prepared",
              sent: false,
            });
            continue;
          }

          const contactName = getContactNameByWaId(contacts, from);
          const raw = buildMessageRawPreview(message, contactName);

          saveMessageEventLogEntry(
            buildLogEntry({
              messageId,
              from,
              receivedAt,
              type,
              status: "received",
              raw: {
                ...raw,
                incomingStatus: "received",
                engineProcessed: false,
                botReplyPrepared: false,
                outboundStatus: "not_prepared",
                sent: false,
              },
            }),
          );

          if (type !== "text" || !normalizeString(message.text?.body)) {
            ignoredUnsupported += 1;
            saveMessageEventLogEntry(
              buildLogEntry({
                messageId,
                from,
                receivedAt,
                type,
                status: "ignored_unsupported",
                raw: {
                  ...raw,
                  incomingStatus: "processed",
                  engineProcessed: false,
                  botReplyPrepared: false,
                  outboundStatus: "not_prepared",
                  sent: false,
                },
              }),
            );
            logMetaMessage({
              messageId,
              from,
              type,
              status: "ignored_unsupported",
            });
            continue;
          }

          if (!from) {
            failed += 1;
            saveMessageEventLogEntry(
              buildLogEntry({
                messageId,
                from,
                receivedAt,
                type,
                status: "failed",
                raw: {
                  ...raw,
                  incomingStatus: "failed",
                  error: "Meta message.from fehlt.",
                  engineProcessed: false,
                  botReplyPrepared: false,
                  outboundStatus: "not_prepared",
                  sent: false,
                },
              }),
            );
            logMetaMessage({
              messageId,
              from,
              type,
              status: "failed",
            });
            continue;
          }

          const textBody = normalizeString(message.text?.body);
          const leadSync = syncWhatsappLead({
            from,
            contactName,
          });
          const state = getOrCreateConversationState(
            leadSync.lead.id,
            leadSync.campaignId,
          );

          state.backendLeadId = leadSync.lead.backendLeadId || leadSync.lead.id;
          state.leadName = leadSync.lead.name;
          state.phone = leadSync.lead.phone || leadSync.normalizedPhone;
          state.source = leadSync.lead.source || "WhatsApp";
          state.notes = leadSync.lead.note;
          state.bookingData = leadSync.lead.bookingData;
          persistConversationState(state);

          leadAction = leadSync.action;
          leadId = leadSync.lead.id;
          conversationUpdated = true;

          let engineReplyPreview: string | undefined;
          try {
            const engineReply = await processIncomingMessage({
              leadId: leadSync.lead.id,
              campaignId: leadSync.campaignId,
              messageText: textBody,
            });

            engineProcessed = true;
            messageAppended = true;
            engineReplyPreview = buildBotReplyPreview(engineReply.text);
            botReplyPrepared = Boolean(engineReplyPreview);
            botReplyPreview = engineReplyPreview;
            outboundStatus = botReplyPrepared ? "prepared" : "not_prepared";
            markLatestAssistantMessagePrepared({
              messages: engineReply.state.messages,
              replyText: engineReply.text,
            });

            if (botReplyPrepared) {
              const sendResult = await sendMetaWhatsappTextMessage({
                to: from,
                body: engineReply.text,
              });

              if (sendResult.sendSkipped) {
                dryRun = true;
                sent = false;
                sendSkipped = true;
                sendSkipReason = sendResult.reason;
              } else if (sendResult.ok && sendResult.sent) {
                dryRun = false;
                sent = true;
                outboundStatus = "sent";
                metaMessageId = sendResult.metaMessageId;
                updateLatestAssistantMessageSendResult({
                  messages: engineReply.state.messages,
                  replyText: engineReply.text,
                  outboundStatus: "sent",
                  sentAt: nowIso(),
                  metaMessageId,
                });
              } else if (!sendResult.ok) {
                failed += 1;
                sent = false;
                dryRun = false;
                outboundStatus = "send_failed";
                updateLatestAssistantMessageSendResult({
                  messages: engineReply.state.messages,
                  replyText: engineReply.text,
                  outboundStatus: "send_failed",
                  sendError: sendResult.error,
                });
                persistConversationState(engineReply.state);

                saveMessageEventLogEntry(
                  buildLogEntry({
                    messageId,
                    from,
                    receivedAt,
                    type,
                    status: "failed",
                    raw: {
                      ...raw,
                      incomingStatus: "processed",
                      leadAction: leadSync.action,
                      leadId: leadSync.lead.id,
                      campaignId: leadSync.campaignId,
                      conversationUpdated: true,
                      messageAppended: true,
                      engineProcessed: true,
                      botReplyPrepared: true,
                      botReplyPreview: engineReplyPreview,
                      outboundStatus,
                      sent: false,
                      error: sendResult.error,
                    },
                  }),
                );
                logMetaMessage({
                  messageId,
                  from,
                  type,
                  status: "failed",
                  leadId: leadSync.lead.id,
                  campaignId: leadSync.campaignId,
                  engineProcessed: true,
                  botReplyPrepared: true,
                  outboundStatus,
                  sent: false,
                });

                return res.status(500).json({
                  ok: false,
                  processed: processed + 1,
                  duplicates,
                  ignoredStatuses,
                  ignoredUnsupported,
                  failed,
                  dryRun: false,
                  leadAction,
                  leadId,
                  conversationUpdated,
                  messageAppended,
                  engineProcessed: true,
                  botReplyPrepared: true,
                  outboundStatus,
                  sent: false,
                  error: sendResult.error,
                });
              }
            }

            persistConversationState(engineReply.state);
            processed += 1;
          } catch (engineError) {
            failed += 1;
            const errorMessage =
              engineError instanceof Error
                ? engineError.message
                : "Conversation Engine Fehler im Meta WhatsApp DryRun.";

            saveMessageEventLogEntry(
              buildLogEntry({
                messageId,
                from,
                receivedAt,
                type,
                status: "failed",
                raw: {
                  ...raw,
                  incomingStatus: "failed",
                  leadAction: leadSync.action,
                  leadId: leadSync.lead.id,
                  campaignId: leadSync.campaignId,
                  conversationUpdated: true,
                  messageAppended: false,
                  engineProcessed: false,
                  botReplyPrepared: false,
                  outboundStatus: "not_prepared",
                  sent: false,
                  error: errorMessage,
                },
              }),
            );
            logMetaMessage({
              messageId,
              from,
              type,
              status: "failed",
              leadId: leadSync.lead.id,
              campaignId: leadSync.campaignId,
              engineProcessed: false,
              botReplyPrepared: false,
              outboundStatus: "not_prepared",
              sent: false,
            });

            return res.status(500).json({
              ok: false,
              processed,
              duplicates,
              ignoredStatuses,
              ignoredUnsupported,
              failed,
              dryRun: true,
              leadAction,
              leadId,
              conversationUpdated,
              messageAppended: false,
              engineProcessed: false,
              botReplyPrepared: false,
              outboundStatus: "not_prepared",
              sent: false,
              error: errorMessage,
            });
          }

          saveMessageEventLogEntry(
            buildLogEntry({
              messageId,
              from,
              receivedAt,
              type,
              status: "processed",
              raw: {
                ...raw,
                incomingStatus: "processed",
                leadAction: leadSync.action,
                leadId: leadSync.lead.id,
                campaignId: leadSync.campaignId,
                conversationUpdated: true,
                messageAppended: true,
                engineProcessed: true,
                botReplyPrepared: Boolean(engineReplyPreview),
                botReplyPreview: engineReplyPreview,
                outboundStatus,
                botReplyStatus: botReplyPrepared ? "dry_run" : "not_prepared",
                sendSkipped,
                sendSkipReason,
                metaMessageId,
                sent,
              },
            }),
          );
          logMetaMessage({
            messageId,
            from,
            type,
            status: "processed",
            leadId: leadSync.lead.id,
            campaignId: leadSync.campaignId,
            engineProcessed: true,
            botReplyPrepared: Boolean(engineReplyPreview),
            outboundStatus,
            sent,
          });
        }
      }
    }

    return res.json({
      ok: true,
      processed,
      duplicates,
      ignoredStatuses,
      ignoredUnsupported,
      failed,
      dryRun,
      leadAction,
      leadId,
      conversationUpdated,
      messageAppended,
      engineProcessed,
      botReplyPrepared,
      botReplyPreview,
      outboundStatus,
      sent,
      sendSkipped: sendSkipped || undefined,
      sendSkipReason,
      metaMessageId: metaMessageId || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler im Meta WhatsApp Webhook DryRun.";

    return res.status(500).json({
      ok: false,
      processed,
      duplicates,
      ignoredStatuses,
      ignoredUnsupported,
      failed: failed + 1,
      dryRun: true,
      engineProcessed: false,
      botReplyPrepared: false,
      outboundStatus: "not_prepared",
      sent: false,
      error: message,
    });
  }
});

export default router;
