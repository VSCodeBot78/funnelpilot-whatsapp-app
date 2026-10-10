import { Router } from "express";
import { env } from "../config/env.js";
import type { RawBodyRequest } from "../app.js";
import {
  getMessageEventByMessageId,
  saveMessageEventLogEntry,
  type MessageEventStatus,
} from "../data/message-events.store.js";
import {
  appendHumanMessage,
  getOrCreateConversationState,
  persistConversationState,
  takeOverByHuman,
} from "../core/state-manager.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { getConversationState } from "../data/store.js";
import { readSettings } from "../services/settings-store.js";
import { syncInstagramLead } from "../services/instagram-lead-sync.service.js";
import { sendMetaInstagramTextMessage } from "../services/meta-instagram-api.service.js";
import { evaluateInstagramAutomationGate } from "../services/instagram-automation-gate.service.js";
import { evaluateLatestAiOutboundPermission } from "../services/ai-outbound-guard.service.js";
import {
  instagramTimestampToIso,
  parseInstagramMessageEvents,
  type ParsedInstagramMessageEvent,
} from "../services/meta-instagram-webhook.service.js";
import {
  isKnownAiOutboundEcho,
  markLatestAssistantMessagePrepared,
  reconcileAiOutboundReceipt,
} from "../services/conversation-outbound.service.js";
import { verifyMetaWebhookSignature } from "../services/meta-webhook-signature.service.js";
import { consumeKnownAiInstagramEcho } from "../services/instagram-outbound-echo.service.js";

const router = Router();
const PROVIDER = "meta_instagram" as const;

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

function buildRawPreview(
  event: ParsedInstagramMessageEvent,
): Record<string, unknown> {
  return {
    recipientId: event.recipientId || undefined,
    textPreview: event.text ? event.text.slice(0, 160) : undefined,
    isEcho: event.isEcho,
    hasAttachments: event.hasAttachments,
    timestampMs: event.timestampMs,
  };
}

function buildBotReplyPreview(value: unknown): string | undefined {
  const text = normalizeString(value);
  return text ? text.slice(0, 500) : undefined;
}

function logInstagramMessage(params: {
  messageId: string;
  from?: string;
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
      "[meta-instagram]",
      `messageId=${params.messageId}`,
      `from=${params.from || "-"}`,
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
  const mode = normalizeString(
    req.query["hub.mode"] ?? req.query["hub_mode"],
  );
  const verifyToken = normalizeString(
    req.query["hub.verify_token"] ?? req.query["hub_verify_token"],
  );
  const challenge = normalizeString(
    req.query["hub.challenge"] ?? req.query["hub_challenge"],
  );

  const tokenConfigured = Boolean(env.INSTAGRAM_VERIFY_TOKEN);
  const tokenMatches =
    tokenConfigured && verifyToken === env.INSTAGRAM_VERIFY_TOKEN;

  console.log(
    [
      "[meta-instagram-verify]",
      `mode=${mode || "-"}`,
      `verifyTokenPresent=${Boolean(verifyToken)}`,
      `tokenConfigured=${tokenConfigured}`,
      `tokenMatches=${tokenMatches}`,
      `challengePresent=${Boolean(challenge)}`,
      `userAgent=${normalizeString(req.get("user-agent")) || "-"}`,
    ].join(" "),
  );

  if (!env.INSTAGRAM_VERIFY_TOKEN) {
    return res.status(500).json({
      ok: false,
      error:
        "INSTAGRAM_VERIFY_TOKEN ist nicht gesetzt. Instagram Webhook Verification ist noch nicht konfiguriert.",
    });
  }

  if (mode === "subscribe" && tokenMatches) {
    return res.status(200).type("text/plain").send(challenge);
  }

  return res.status(403).json({
    ok: false,
    error: "Meta Instagram Webhook Verification fehlgeschlagen.",
  });
});

router.post("/", async (req: RawBodyRequest, res) => {
  const signatureHeader = req.get("x-hub-signature-256");
  const signatureCheck = verifyMetaWebhookSignature({
    rawBody: req.rawBody,
    signatureHeader,
    appSecret: env.INSTAGRAM_APP_SECRET,
  });

  const body = req.body as Record<string, unknown> | undefined;
  const bodyKeys =
    body && typeof body === "object" ? Object.keys(body).sort() : [];
  const hasEntryArray = Array.isArray(body?.entry);
  const looksLikeFieldSample =
    typeof body?.field === "string" && body?.value !== undefined;

  console.log(
    [
      "[meta-instagram-post]",
      "received=true",
      `signaturePresent=${Boolean(signatureHeader)}`,
      `signatureValid=${signatureCheck.ok}`,
      `rawBodyPresent=${Boolean(req.rawBody?.length)}`,
      `hasEntryArray=${hasEntryArray}`,
      `looksLikeFieldSample=${looksLikeFieldSample}`,
      `bodyKeys=${bodyKeys.join(",") || "-"}`,
    ].join(" "),
  );

  if (!signatureCheck.ok) {
    return res
      .status(signatureCheck.statusCode)
      .json({ ok: false, error: signatureCheck.error });
  }

  const events = parseInstagramMessageEvents(req.body);

  console.log(
    [
      "[meta-instagram-post]",
      `parsedEvents=${events.length}`,
      `engineEnabled=${env.INSTAGRAM_ENGINE_ENABLED}`,
      `sendEnabled=${env.INSTAGRAM_SEND_ENABLED}`,
    ].join(" "),
  );

  let processed = 0;
  let duplicates = 0;
  let ignoredEchoes = 0;
  let ignoredUnsupported = 0;
  let ignoredAutomationPaused = 0;
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
    for (const event of events) {
      const receivedAt = instagramTimestampToIso(event.timestampMs);
      const raw = buildRawPreview(event);

      const existing = getMessageEventByMessageId(
        PROVIDER,
        event.messageId,
      );
      if (existing) {
        duplicates += 1;
        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt: nowIso(),
            type: "message",
            status: "ignored_duplicate",
            raw: {
              ...raw,
              incomingStatus: "duplicate",
              previousStatus: existing.status,
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        continue;
      }

      saveMessageEventLogEntry(
        buildLogEntry({
          messageId: event.messageId,
          from: event.senderId,
          receivedAt,
          type: "message",
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

      if (event.isEcho) {
        ignoredEchoes += 1;

        let echoReason = "instagram_echo";
        let echoLeadId: string | undefined;
        let echoCampaignId: string | undefined;
        let echoConversationUpdated = false;
        let echoMessageAppended = false;

        if (event.recipientId) {
          const echoLeadSync = syncInstagramLead({
            instagramScopedId: event.recipientId,
            botEnabledForNewLead: false,
          });
          const echoState = getOrCreateConversationState(
            echoLeadSync.lead.id,
            echoLeadSync.campaignId,
          );

          echoLeadId = echoLeadSync.lead.id;
          echoCampaignId = echoLeadSync.campaignId;

          const knownAiEcho =
            isKnownAiOutboundEcho({
              messages: echoState.messages,
              messageId: event.messageId,
              transport: PROVIDER,
            }) ||
            consumeKnownAiInstagramEcho({
              recipientId: event.recipientId,
              messageId: event.messageId,
              text: event.text,
              state: echoState,
            });

          const alreadyRecordedHumanEcho = echoState.messages.some((message) =>
            message.actor === "human" &&
            message.metaMessageId === event.messageId
          );

          if (knownAiEcho) {
            echoReason = "instagram_ai_echo";
          } else if (alreadyRecordedHumanEcho) {
            // A dashboard message can be recorded before its matching Meta echo.
            // Never duplicate the same human message in the conversation.
            echoReason = "instagram_human_echo_already_recorded";
          } else {
            echoState.backendLeadId =
              echoLeadSync.lead.backendLeadId || echoLeadSync.lead.id;
            echoState.leadName = echoLeadSync.lead.name;
            echoState.phone = echoLeadSync.lead.phone;
            echoState.source = "Instagram";
            echoState.notes = echoLeadSync.lead.note;
            echoState.bookingData = echoLeadSync.lead.bookingData;

            // Attachment-only/manual non-text echoes must also pause Pete.
            // Do not invent a human text message when Meta supplied no text.
            if (event.text) {
              appendHumanMessage(echoState, event.text);
              const humanMessage = echoState.messages.at(-1);
              if (humanMessage?.actor === "human") {
                humanMessage.metaMessageId = event.messageId;
                humanMessage.transport = PROVIDER;
                humanMessage.outboundStatus = "sent";
                humanMessage.sent = true;
                humanMessage.dryRun = false;
                humanMessage.sentAt = receivedAt;
              }
              messageAppended = true;
              echoMessageAppended = true;
            } else {
              takeOverByHuman(echoState, receivedAt);
            }
            persistConversationState(echoState);

            leadAction = echoLeadSync.action;
            leadId = echoLeadSync.lead.id;
            conversationUpdated = true;
            echoConversationUpdated = true;
            echoReason = "instagram_human_echo_takeover";
          }
        }

        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt,
            type: "echo",
            status: "ignored_status",
            raw: {
              ...raw,
              incomingStatus: "processed",
              reason: echoReason,
              leadId: echoLeadId,
              campaignId: echoCampaignId,
              conversationUpdated: echoConversationUpdated,
              messageAppended: echoMessageAppended,
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        logInstagramMessage({
          messageId: event.messageId,
          from: event.senderId,
          status: "ignored_status",
          leadId: echoLeadId,
          campaignId: echoCampaignId,
        });
        continue;
      }

      if (!event.senderId) {
        failed += 1;
        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            receivedAt,
            type: "message",
            status: "failed",
            raw: {
              ...raw,
              incomingStatus: "failed",
              error: "Instagram sender.id fehlt.",
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        continue;
      }

      if (!event.text) {
        ignoredUnsupported += 1;
        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt,
            type: event.hasAttachments ? "attachment" : "unsupported",
            status: "ignored_unsupported",
            raw: {
              ...raw,
              incomingStatus: "processed",
              reason: event.hasAttachments
                ? "attachment_without_text"
                : "message_without_text",
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        continue;
      }

      const automationGate = evaluateInstagramAutomationGate({
        senderId: event.senderId,
      });

      if (!automationGate.allowed) {
        ignoredAutomationPaused += 1;
        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt,
            type: "message",
            status: "ignored_status",
            raw: {
              ...raw,
              incomingStatus: "processed",
              reason: automationGate.reason,
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        logInstagramMessage({
          messageId: event.messageId,
          from: event.senderId,
          status: "ignored_status",
          engineProcessed: false,
          sent: false,
        });
        continue;
      }

      const leadSync = syncInstagramLead({
        instagramScopedId: event.senderId,
      });

      if (!leadSync.lead.botEnabled || leadSync.lead.excluded) {
        ignoredAutomationPaused += 1;
        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt,
            type: "message",
            status: "ignored_status",
            raw: {
              ...raw,
              incomingStatus: "processed",
              reason: leadSync.lead.excluded
                ? "lead_excluded"
                : "lead_bot_disabled",
              leadId: leadSync.lead.id,
              campaignId: leadSync.campaignId,
              engineProcessed: false,
              sent: false,
            },
          }),
        );
        logInstagramMessage({
          messageId: event.messageId,
          from: event.senderId,
          status: "ignored_status",
          leadId: leadSync.lead.id,
          campaignId: leadSync.campaignId,
          engineProcessed: false,
          sent: false,
        });
        continue;
      }

      const state = getOrCreateConversationState(
        leadSync.lead.id,
        leadSync.campaignId,
      );

      state.backendLeadId =
        leadSync.lead.backendLeadId || leadSync.lead.id;
      state.leadName = leadSync.lead.name;
      state.phone = leadSync.lead.phone;
      state.source = "Instagram";
      state.notes = leadSync.lead.note;
      state.bookingData = leadSync.lead.bookingData;
      persistConversationState(state);

      leadAction = leadSync.action;
      leadId = leadSync.lead.id;
      conversationUpdated = true;

      let engineReplyPreview: string | undefined;
      let skipEngineStatePersist = false;

      try {
        const engineReply = await processIncomingMessage({
          leadId: leadSync.lead.id,
          campaignId: leadSync.campaignId,
          messageText: event.text,
          conversationMode: readSettings().dmConversationMode === "natural" ? "natural" : "legacy",
        });

        engineProcessed = true;
        messageAppended = true;
        engineReplyPreview = buildBotReplyPreview(engineReply.text);
        botReplyPrepared = Boolean(
          engineReplyPreview && engineReply.text,
        );
        botReplyPreview = engineReplyPreview;
        outboundStatus = botReplyPrepared
          ? "prepared"
          : "not_prepared";

        if (botReplyPrepared && engineReply.text) {
          markLatestAssistantMessagePrepared({
            messages: engineReply.state.messages,
            replyText: engineReply.text,
            transport: PROVIDER,
          });
          const preparedAssistantId = engineReply.state.messages.filter((message) =>
            message.actor !== "human" &&
            message.role === "assistant" &&
            message.text.trim() === engineReply.text?.trim()
          ).at(-1)?.id;

          const outboundPermission = evaluateLatestAiOutboundPermission({
            leadId: leadSync.lead.id,
            campaignId: leadSync.campaignId,
          });

          if (!outboundPermission.allowed) {
            dryRun = true;
            sent = false;
            sendSkipped = true;
            sendSkipReason = `outbound_guard_${outboundPermission.reason}`;
            outboundStatus = "dry_run";
            ignoredAutomationPaused += 1;

            // The guard reads the latest persisted state. If a human takeover
            // happened after Pete prepared this reply, persisting the older
            // engineReply.state here would overwrite that newer ownership.
            skipEngineStatePersist = true;
          } else {
            const sendResult = await sendMetaInstagramTextMessage({
              to: event.senderId,
              body: engineReply.text,
            });

          if (sendResult.sendSkipped) {
            dryRun = true;
            sent = false;
            sendSkipped = true;
            sendSkipReason = sendResult.reason;
            outboundStatus = "dry_run";
          } else if (sendResult.ok && sendResult.sent) {
            dryRun = false;
            sent = true;
            outboundStatus = "sent";
            metaMessageId = sendResult.metaMessageId;
            if (preparedAssistantId) {
              reconcileAiOutboundReceipt({
                leadId: leadSync.lead.id,
                campaignId: leadSync.campaignId,
                assistantMessageId: preparedAssistantId,
                transport: PROVIDER,
                outboundStatus: "sent",
                sentAt: nowIso(),
                metaMessageId,
              });
            }
          } else if (!sendResult.ok) {
            failed += 1;
            dryRun = false;
            sent = false;
            outboundStatus = "send_failed";
            if (preparedAssistantId) {
              reconcileAiOutboundReceipt({
                leadId: leadSync.lead.id,
                campaignId: leadSync.campaignId,
                assistantMessageId: preparedAssistantId,
                transport: PROVIDER,
                outboundStatus: "send_failed",
                sendError: sendResult.error,
              });
            }

            saveMessageEventLogEntry(
              buildLogEntry({
                messageId: event.messageId,
                from: event.senderId,
                receivedAt,
                type: "message",
                status: "failed",
                raw: {
                  ...raw,
                  incomingStatus: "processed",
                  leadAction: leadSync.action,
                  leadId: leadSync.lead.id,
                  campaignId: leadSync.campaignId,
                  engineProcessed: true,
                  botReplyPrepared: true,
                  botReplyPreview: engineReplyPreview,
                  outboundStatus,
                  sent: false,
                  error: sendResult.error,
                },
              }),
            );

            return res.status(500).json({
              ok: false,
              processed,
              duplicates,
              ignoredEchoes,
              ignoredUnsupported,
              ignoredAutomationPaused,
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
        }

        if (!skipEngineStatePersist) {
          const latest = getConversationState(leadSync.lead.id, leadSync.campaignId);
          if (latest) persistConversationState(latest);
        }
        processed += 1;
      } catch (engineError) {
        failed += 1;
        const errorMessage =
          engineError instanceof Error
            ? engineError.message
            : "Conversation Engine Fehler im Meta Instagram Webhook.";

        saveMessageEventLogEntry(
          buildLogEntry({
            messageId: event.messageId,
            from: event.senderId,
            receivedAt,
            type: "message",
            status: "failed",
            raw: {
              ...raw,
              incomingStatus: "failed",
              leadAction: leadSync.action,
              leadId: leadSync.lead.id,
              campaignId: leadSync.campaignId,
              engineProcessed: false,
              sent: false,
              error: errorMessage,
            },
          }),
        );

        return res.status(500).json({
          ok: false,
          processed,
          duplicates,
          ignoredEchoes,
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
          messageId: event.messageId,
          from: event.senderId,
          receivedAt,
          type: "message",
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
            sendSkipped,
            sendSkipReason,
            metaMessageId,
            sent,
          },
        }),
      );

      logInstagramMessage({
        messageId: event.messageId,
        from: event.senderId,
        status: "processed",
        leadId: leadSync.lead.id,
        campaignId: leadSync.campaignId,
        engineProcessed: true,
        botReplyPrepared: Boolean(engineReplyPreview),
        outboundStatus,
        sent,
      });
    }

    return res.json({
      ok: true,
      processed,
      duplicates,
      ignoredEchoes,
      ignoredUnsupported,
      ignoredAutomationPaused,
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
        : "Unbekannter Fehler im Meta Instagram Webhook.";

    return res.status(500).json({
      ok: false,
      processed,
      duplicates,
      ignoredEchoes,
      ignoredUnsupported,
      ignoredAutomationPaused,
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
