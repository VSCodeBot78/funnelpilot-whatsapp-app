import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-instagram-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "true";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "route-test-igsid";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false";
process.env.INSTAGRAM_VERIFY_TOKEN = "instagram-test-token";
process.env.META_APP_SECRET = "test-meta-app-secret";
process.env.INSTAGRAM_APP_SECRET = "test-instagram-app-secret";
process.env.INSTAGRAM_ACCOUNT_ID = "17841400000000000";
process.env.INSTAGRAM_GRAPH_API_VERSION = "v26.0";

const {
  parseInstagramMessageEvents,
  instagramTimestampToIso,
} = await import("../services/meta-instagram-webhook.service.js");
const {
  buildInstagramSendUrl,
  sendMetaInstagramTextMessage,
} = await import("../services/meta-instagram-api.service.js");
const {
  buildInstagramLeadId,
  syncInstagramLead,
} = await import("../services/instagram-lead-sync.service.js");
const {
  verifyMetaWebhookSignature,
} = await import("../services/meta-webhook-signature.service.js");
const {
  evaluateInstagramAutomationGate,
  isInstagramRecipientAllowed,
} = await import("../services/instagram-automation-gate.service.js");
const {
  getLeadById,
  saveLead,
  deleteLead,
} = await import("../data/leads.store.js");
const {
  appendAssistantMessage,
  getOrCreateConversationState,
  persistConversationState,
} = await import("../core/state-manager.js");
const {
  deleteConversationState,
  getConversationState,
} = await import("../data/store.js");
const {
  clearPendingAiInstagramOutboundRegistry,
  confirmPendingAiInstagramOutbound,
  consumeKnownAiInstagramEcho,
  registerPendingAiInstagramOutbound,
} = await import("../services/instagram-outbound-echo.service.js");
const { default: app } = await import("../app.js");

test("Phase 4 Instagram transport foundation", async (t) => {
  t.after(() => {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("parses an Instagram text messaging webhook", () => {
    const events = parseInstagramMessageEvents({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1791550000000,
          messaging: [
            {
              sender: { id: "123456789012345" },
              recipient: { id: "17841400000000000" },
              timestamp: 1791550000123,
              message: {
                mid: "aWdfZAG1fMDEyMzQ1",
                text: "Hallo, ich komme von Instagram.",
              },
            },
          ],
        },
      ],
    });

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      messageId: "aWdfZAG1fMDEyMzQ1",
      senderId: "123456789012345",
      recipientId: "17841400000000000",
      text: "Hallo, ich komme von Instagram.",
      timestampMs: 1791550000123,
      isEcho: false,
      hasAttachments: false,
    });
  });

  await t.test("parses Instagram messages delivered via changes envelope", () => {
    const events = parseInstagramMessageEvents({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1791550000000,
          changes: [
            {
              field: "messages",
              value: {
                sender: { id: "123456789012345" },
                recipient: { id: "17841400000000000" },
                timestamp: "1791550000123",
                message: {
                  mid: "changes-mid-1",
                  text: "Hallo aus dem changes Envelope.",
                },
              },
            },
          ],
        },
      ],
    });

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      messageId: "changes-mid-1",
      senderId: "123456789012345",
      recipientId: "17841400000000000",
      text: "Hallo aus dem changes Envelope.",
      timestampMs: 1791550000123,
      isEcho: false,
      hasAttachments: false,
    });
  });

  await t.test("ignores non-Instagram webhook envelopes", () => {
    const events = parseInstagramMessageEvents({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "wrong-channel" },
              message: { mid: "wrong-mid", text: "Ignore me" },
            },
          ],
        },
      ],
    });

    assert.deepEqual(events, []);
  });

  await t.test("recognizes echo messages so they cannot loop back into Pete", () => {
    const [event] = parseInstagramMessageEvents({
      object: "instagram",
      entry: [
        {
          messaging: [
            {
              sender: { id: "17841400000000000" },
              recipient: { id: "123456789012345" },
              timestamp: 1791550000123,
              message: {
                mid: "echo-1",
                text: "Automatische Antwort",
                is_echo: true,
              },
            },
          ],
        },
      ],
    });

    assert.equal(event.isEcho, true);
    assert.equal(event.text, "Automatische Antwort");
  });

  await t.test("attachment-only events are explicit unsupported candidates", () => {
    const [event] = parseInstagramMessageEvents({
      object: "instagram",
      entry: [
        {
          messaging: [
            {
              sender: { id: "123456789012345" },
              recipient: { id: "17841400000000000" },
              message: {
                mid: "attachment-1",
                attachments: [{ type: "image" }],
              },
            },
          ],
        },
      ],
    });

    assert.equal(event.text, "");
    assert.equal(event.hasAttachments, true);
  });

  await t.test("timestamp conversion uses Instagram millisecond timestamps", () => {
    assert.equal(
      instagramTimestampToIso(1791550000123),
      new Date(1791550000123).toISOString(),
    );
  });

  await t.test("Instagram lead identity is stable and channel-specific", () => {
    const igsid = "123456789012345";
    const leadId = buildInstagramLeadId(igsid);
    assert.equal(leadId, "instagram:123456789012345");

    const first = syncInstagramLead({
      instagramScopedId: igsid,
    });

    assert.equal(first.action, "created");
    assert.equal(first.lead.id, leadId);
    assert.equal(first.lead.source, "Instagram");
    assert.equal(first.lead.phone, "");
    assert.equal(first.lead.botEnabled, false);
    assert.match(first.lead.note, /wartet auf Handoff/);

    const second = syncInstagramLead({
      instagramScopedId: igsid,
    });

    assert.equal(second.action, "found");
    assert.equal(second.lead.id, leadId);
    assert.equal(getLeadById(leadId)?.source, "Instagram");

    deleteLead(leadId);
  });

  await t.test("Instagram engine is explicitly gated", () => {
    const disabled = evaluateInstagramAutomationGate({
      senderId: "test-sender",
      engineEnabled: false,
      allowedSenderIds: [],
    });
    assert.equal(disabled.allowed, false);
    if (!disabled.allowed) {
      assert.equal(disabled.reason, "engine_disabled");
    }

    const blocked = evaluateInstagramAutomationGate({
      senderId: "other-sender",
      engineEnabled: true,
      allowedSenderIds: ["allowed-sender"],
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.reason, "sender_not_allowlisted");
    }

    const allowed = evaluateInstagramAutomationGate({
      senderId: "allowed-sender",
      engineEnabled: true,
      allowedSenderIds: ["allowed-sender"],
    });
    assert.equal(allowed.allowed, true);

    const noAllowlist = evaluateInstagramAutomationGate({
      senderId: "real-lead",
      engineEnabled: true,
      allowedSenderIds: [],
      allowAllSenders: false,
    });
    assert.equal(noAllowlist.allowed, false);
    if (!noAllowlist.allowed) {
      assert.equal(noAllowlist.reason, "allowlist_required");
    }

    const deliberateAll = evaluateInstagramAutomationGate({
      senderId: "real-lead",
      engineEnabled: true,
      allowedSenderIds: [],
      allowAllSenders: true,
    });
    assert.equal(deliberateAll.allowed, true);
  });

  await t.test("Instagram send allowlist protects the live-test recipient", () => {
    assert.equal(
      isInstagramRecipientAllowed(
        "route-test-igsid",
        ["route-test-igsid"],
        false,
      ),
      true,
    );
    assert.equal(
      isInstagramRecipientAllowed("real-lead", ["route-test-igsid"], false),
      false,
    );
    assert.equal(isInstagramRecipientAllowed("anyone", [], false), false);
    assert.equal(isInstagramRecipientAllowed("anyone", [], true), true);
  });

  await t.test("outbound Instagram is dry-run by default", async () => {
    const result = await sendMetaInstagramTextMessage({
      to: "123456789012345",
      body: "Test",
    });

    assert.equal(result.ok, true);
    assert.equal(result.sent, false);
    assert.equal(result.dryRun, true);
    assert.equal(result.sendSkipped, true);
    if (result.sendSkipped) {
      assert.equal(result.reason, "INSTAGRAM_SEND_ENABLED=false");
    }
  });

  await t.test("Instagram send URL uses the Instagram Login graph host", () => {
    assert.equal(
      buildInstagramSendUrl(),
      "https://graph.instagram.com/v26.0/17841400000000000/messages",
    );
  });

  await t.test("Meta HMAC signature verification accepts only the correct raw body", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ object: "instagram", entry: [] }),
      "utf8",
    );
    const appSecret = "test-app-secret";
    const signature =
      "sha256=" +
      crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

    const valid = verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: signature,
      appSecret,
    });
    assert.equal(valid.ok, true);

    const invalid = verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: "sha256=deadbeef",
      appSecret,
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.statusCode, 401);
  });

  await t.test("pending AI outbound echo matching is safe across the Meta response race", () => {
    clearPendingAiInstagramOutboundRegistry();

    const earlyToken = registerPendingAiInstagramOutbound({
      recipientId: "race-lead",
      text: "Pete Antwort",
    });

    assert.equal(
      consumeKnownAiInstagramEcho({
        recipientId: "race-lead",
        messageId: "race-echo-before-meta-id",
        text: "Pete Antwort",
      }),
      true,
    );

    clearPendingAiInstagramOutboundRegistry();

    const confirmedToken = registerPendingAiInstagramOutbound({
      recipientId: "race-lead",
      text: "Gleicher Text",
    });
    confirmPendingAiInstagramOutbound({
      token: confirmedToken,
      metaMessageId: "meta-ai-id",
    });

    assert.equal(
      consumeKnownAiInstagramEcho({
        recipientId: "race-lead",
        messageId: "manual-different-id",
        text: "Gleicher Text",
      }),
      false,
    );

    assert.equal(
      consumeKnownAiInstagramEcho({
        recipientId: "race-lead",
        messageId: "meta-ai-id",
        text: "Gleicher Text",
      }),
      true,
    );

    clearPendingAiInstagramOutboundRegistry();
    void earlyToken;
  });

  await t.test("Instagram echo keeps Pete echo as AI but external outbound takes over", async () => {
    const igsid = "route-test-igsid";
    const leadId = buildInstagramLeadId(igsid);
    deleteLead(leadId);
    deleteConversationState(leadId, "eltern-vital-fit");
    clearPendingAiInstagramOutboundRegistry();

    const leadSync = syncInstagramLead({
      instagramScopedId: igsid,
      botEnabledForNewLead: true,
    });
    const state = getOrCreateConversationState(
      leadSync.lead.id,
      leadSync.campaignId,
    );
    appendAssistantMessage(state, "Pete Echo Test");
    const aiMessage = state.messages.at(-1);
    assert.ok(aiMessage);
    aiMessage.transport = "meta_instagram";
    aiMessage.outboundStatus = "sent";
    aiMessage.sent = true;
    aiMessage.metaMessageId = "known-ai-echo-mid";
    persistConversationState(state);

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      function signedEcho(messageId: string, text: string) {
        const payload = {
          object: "instagram",
          entry: [
            {
              id: "17841400000000000",
              messaging: [
                {
                  sender: { id: "17841400000000000" },
                  recipient: { id: igsid },
                  timestamp: Date.now(),
                  message: {
                    mid: messageId,
                    text,
                    is_echo: true,
                  },
                },
              ],
            },
          ],
        };

        const raw = JSON.stringify(payload);
        const signature =
          "sha256=" +
          crypto
            .createHmac("sha256", "test-instagram-app-secret")
            .update(Buffer.from(raw, "utf8"))
            .digest("hex");

        return { raw, signature };
      }

      const aiEcho = signedEcho("known-ai-echo-mid", "Pete Echo Test");
      const aiResponse = await fetch(
        baseUrl + "/webhooks/meta/instagram",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": aiEcho.signature,
          },
          body: aiEcho.raw,
        },
      );

      assert.equal(aiResponse.status, 200);
      const aiResult = (await aiResponse.json()) as {
        externalTakeovers?: number;
        ignoredEchoes?: number;
      };
      assert.equal(aiResult.ignoredEchoes, 1);
      assert.equal(aiResult.externalTakeovers, 0);

      const afterAiEcho = getConversationState(
        leadSync.lead.id,
        leadSync.campaignId,
      );
      assert.ok(afterAiEcho);
      assert.equal(afterAiEcho.owner, "ai");
      assert.equal(afterAiEcho.aiPaused, false);

      const manualEcho = signedEcho(
        "manual-external-echo-mid",
        "Hier ist Jochen persönlich.",
      );
      const manualResponse = await fetch(
        baseUrl + "/webhooks/meta/instagram",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": manualEcho.signature,
          },
          body: manualEcho.raw,
        },
      );

      assert.equal(manualResponse.status, 200);
      const manualResult = (await manualResponse.json()) as {
        externalTakeovers?: number;
        ignoredEchoes?: number;
        conversationUpdated?: boolean;
        messageAppended?: boolean;
      };
      assert.equal(manualResult.ignoredEchoes, 1);
      assert.equal(manualResult.externalTakeovers, 1);
      assert.equal(manualResult.conversationUpdated, true);
      assert.equal(manualResult.messageAppended, true);

      const afterManualEcho = getConversationState(
        leadSync.lead.id,
        leadSync.campaignId,
      );
      assert.ok(afterManualEcho);
      assert.equal(afterManualEcho.owner, "human");
      assert.equal(afterManualEcho.aiPaused, true);
      assert.equal(afterManualEcho.lastActor, "human");
      assert.equal(afterManualEcho.messages.at(-1)?.actor, "human");
      assert.equal(
        afterManualEcho.messages.at(-1)?.text,
        "Hier ist Jochen persönlich.",
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      deleteLead(leadId);
      deleteConversationState(leadId, leadSync.campaignId);
      clearPendingAiInstagramOutboundRegistry();
    }
  });

  await t.test("new Instagram lead stays silent until explicit handoff, then processes in dry-run mode", async () => {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const verifyResponse = await fetch(
        baseUrl +
          "/webhooks/meta/instagram?hub.mode=subscribe" +
          "&hub.verify_token=instagram-test-token" +
          "&hub.challenge=challenge-123",
      );
      assert.equal(verifyResponse.status, 200);
      assert.equal(await verifyResponse.text(), "challenge-123");

      function buildSignedPayload(messageId: string, text: string) {
        const payload = {
          object: "instagram",
          entry: [
            {
              id: "17841400000000000",
              changes: [
                {
                  field: "messages",
                  value: {
                    sender: { id: "route-test-igsid" },
                    recipient: { id: "17841400000000000" },
                    timestamp: Date.now(),
                    message: {
                      mid: messageId,
                      text,
                    },
                  },
                },
              ],
            },
          ],
        };

        const raw = JSON.stringify(payload);
        const signature =
          "sha256=" +
          crypto
            .createHmac("sha256", "test-instagram-app-secret")
            .update(Buffer.from(raw, "utf8"))
            .digest("hex");

        return { raw, signature };
      }

      const firstSigned = buildSignedPayload(
        "route-test-mid-before-handoff",
        "Max",
      );
      const firstResponse = await fetch(
        baseUrl + "/webhooks/meta/instagram",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": firstSigned.signature,
          },
          body: firstSigned.raw,
        },
      );

      assert.equal(firstResponse.status, 200);
      const firstResult = (await firstResponse.json()) as {
        ok: boolean;
        processed: number;
        ignoredAutomationPaused: number;
        engineProcessed?: boolean;
        sent?: boolean;
      };

      assert.equal(firstResult.ok, true);
      assert.equal(firstResult.processed, 0);
      assert.equal(firstResult.ignoredAutomationPaused, 1);
      assert.equal(firstResult.engineProcessed, false);
      assert.equal(firstResult.sent, false);

      const leadId = "instagram:route-test-igsid";
      const waitingLead = getLeadById(leadId);
      assert.ok(waitingLead);
      assert.equal(waitingLead.botEnabled, false);

      saveLead({
        ...waitingLead,
        botEnabled: true,
        note: waitingLead.note.replace(" | Funnel Pilot wartet auf Handoff", ""),
      });

      const secondSigned = buildSignedPayload(
        "route-test-mid-after-handoff",
        "Max",
      );
      const response = await fetch(
        baseUrl + "/webhooks/meta/instagram",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": secondSigned.signature,
          },
          body: secondSigned.raw,
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        ok: boolean;
        processed: number;
        leadId?: string;
        engineProcessed?: boolean;
        botReplyPrepared?: boolean;
        dryRun?: boolean;
        sent?: boolean;
        sendSkipped?: boolean;
        outboundStatus?: string;
      };

      assert.equal(result.ok, true);
      assert.equal(result.processed, 1);
      assert.equal(result.leadId, leadId);
      assert.equal(result.engineProcessed, true);
      assert.equal(result.botReplyPrepared, true);
      assert.equal(result.dryRun, true);
      assert.equal(result.sent, false);
      assert.equal(result.sendSkipped, true);
      assert.equal(result.outboundStatus, "dry_run");

      const duplicateResponse = await fetch(
        baseUrl + "/webhooks/meta/instagram",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": secondSigned.signature,
          },
          body: secondSigned.raw,
        },
      );

      assert.equal(duplicateResponse.status, 200);
      const duplicateResult = (await duplicateResponse.json()) as {
        processed: number;
        duplicates: number;
      };
      assert.equal(duplicateResult.processed, 0);
      assert.equal(duplicateResult.duplicates, 1);

      deleteLead(leadId);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
