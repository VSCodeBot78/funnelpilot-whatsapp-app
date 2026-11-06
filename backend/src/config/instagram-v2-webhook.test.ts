import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fp-ig-v2-signed-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = directory;
process.env.INSTAGRAM_ENGINE_ENABLED = "true";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_V2_FLOW_ENABLED = "true";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "v2-check-one,v2-check-two,v2-ambiguous,v2-keto-one,v2-keto-disabled,v2-button-typed,v2-concurrent,v2-feature-off";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false";
process.env.INSTAGRAM_APP_SECRET = "signed-v2-only-fake-secret";
process.env.INSTAGRAM_ACCOUNT_ID = "17841400000000000";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";

const { default: app } = await import("../app.js");
const { env } = await import("../config/env.js");
const { saveCampaign, getCampaignById, normalizePeteCampaignConfig } = await import("../data/campaigns.store.js");
const { sendMetaInstagramTextMessage } = await import("../services/meta-instagram-api.service.js");
const { syncInstagramLead } = await import("../services/instagram-lead-sync.service.js");
const { getConversationState } = await import("../data/store.js");
const { takeOverByHuman, persistConversationState } = await import("../core/state-manager.js");
const { getAllMessageEvents } = await import("../data/message-events.store.js");
const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");

function writeDraft(id: string, keyword: string) {
  saveCampaign({
    id, name: "Only stored " + keyword,
    peteCampaign: {
      sources: ["instagram_dm"], keywords: [keyword],
      openingText: "Hallo, das ist dein gespeicherter " + keyword + "-Einstieg.",
      flowDraftEnabled: true, autoReplyEnabled: true,
      openingDmButtonEnabled: true, openingDmButtonLabel: "Jetzt starten",
      linkEnabled: true, linkLabel: "Elterncheck",
      linkUrl: keyword === "KETO" ? "https://example.org/keto-guide" : "https://check.example.org/start",
      linkMessageText: "Hier ist dein persönlicher Link:",
      peteHandoffEnabled: true, followUpEnabled: false,
    },
  });
}

function signedBody(sender: string, mid: string, text: string, quickReplyPayload?: string, timestamp = Date.now()) {
  const message: Record<string, unknown> = { mid, text };
  if (quickReplyPayload) message.quick_reply = { payload: quickReplyPayload };
  const raw = JSON.stringify({
    object: "instagram", entry: [{
      id: "17841400000000000",
      messaging: [{
        sender: { id: sender }, recipient: { id: "17841400000000000" },
        timestamp, message,
      }],
    }],
  });
  const signature = "sha256=" + crypto.createHmac("sha256", "signed-v2-only-fake-secret")
    .update(Buffer.from(raw, "utf8")).digest("hex");
  return { raw, signature };
}

test("signed Instagram DM CHECK -> persisted V2 opener -> verified button -> HTTPS link -> Pete, NoSend", async t => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "127.0.0.1", "NO_EXTERNAL_NETWORK");
    return realFetch(input, init);
  }) as typeof fetch;
  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function post(sender: string, mid: string, text: string, payload?: string, timestamp?: number, forged = false) {
    const signed = signedBody(sender, mid, text, payload, timestamp);
    const res = await fetch(base + "/webhooks/meta/instagram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Hub-Signature-256": forged ? "sha256=bad" : signed.signature,
      },
      body: signed.raw,
    });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  }

  writeDraft("stored-v2-CHECK", "CHECK");
  syncInstagramLead({ instagramScopedId: "v2-check-one", botEnabledForNewLead: true });

  const forged = await post("v2-check-one", "v2-signed-forged", "CHECK", undefined, undefined, true);
  assert.equal(forged.status, 401);
  assert.equal(getAllMessageEvents().some(e => e.messageId === "v2-signed-forged"), false);

  const initial = await post("v2-check-one", "v2-signed-check-1", "CHECK");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.processed, 1);
  assert.equal(initial.body.sent, false);
  assert.match(String(initial.body.botReplyPreview), /gespeicherter CHECK-Einstieg/);
  const state = getConversationState("instagram:v2-check-one", DEFAULT_CAMPAIGN_ID);
  assert.ok(state);
  const first = JSON.parse(String(state.answers.instagramV2Flow));
  assert.equal(first.stage, "await_button");
  assert.equal(first.campaignId, "stored-v2-CHECK");
  assert.equal(typeof first.buttonPayload, "string");
  assert.equal(Boolean(state.lastUserMessageAt), true);

  const duplicate = await post("v2-check-one", "v2-signed-check-1", "CHECK");
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicates, 1);
  assert.equal(getConversationState("instagram:v2-check-one", DEFAULT_CAMPAIGN_ID)?.messages.length, state.messages.length);

  const button = await post("v2-check-one", "v2-signed-check-button", "Jetzt starten", first.buttonPayload);
  assert.equal(button.status, 200);
  assert.match(String(button.body.botReplyPreview), /https:\/\/check\.example\.org\/start/);
  const second = JSON.parse(String(getConversationState("instagram:v2-check-one", DEFAULT_CAMPAIGN_ID)?.answers.instagramV2Flow));
  assert.equal(second.stage, "pete_ready");

  const free = await post("v2-check-one", "v2-signed-check-freetext", "Ich brauche mehr Energie im Familienalltag.");
  assert.equal(free.status, 200);
  assert.equal(free.body.engineProcessed, true);
  assert.equal(free.body.sent, false);
  assert.equal(getConversationState("instagram:v2-check-one", DEFAULT_CAMPAIGN_ID)?.messages.at(-1)?.role, "assistant");

  // "STOP" overrides a pending CHECK CTA; nothing can be sent afterwards.
  syncInstagramLead({ instagramScopedId: "v2-check-two", botEnabledForNewLead: true });
  const startStop = await post("v2-check-two", "v2-check-stop-open", "CHECK");
  assert.equal(startStop.body.processed, 1);
  const stop = await post("v2-check-two", "v2-check-stop", "Bitte schreib mir keine weiteren Nachrichten.");
  assert.equal(stop.body.sent, false);
  assert.equal(getConversationState("instagram:v2-check-two", DEFAULT_CAMPAIGN_ID)?.flags.stopped, true);
  const after = await post("v2-check-two", "v2-check-after-stop", "Jetzt starten");
  assert.equal(after.body.sent, false);

  // Human takeover wins over a subsequent keyword, even when the draft exists.
  takeOverByHuman(state);
  persistConversationState(state);
  const human = await post("v2-check-one", "v2-check-owned-human", "CHECK");
  assert.equal(human.body.botReplyPrepared, false);
  assert.equal(human.body.sent, false);
  assert.equal(getConversationState("instagram:v2-check-one", DEFAULT_CAMPAIGN_ID)?.owner, "human");

  // A typed label without signed Meta quick_reply payload is NOT a button tap.
  syncInstagramLead({ instagramScopedId: "v2-button-typed", botEnabledForNewLead: true });
  const typedStart = await post("v2-button-typed", "v2-button-typed-start", "CHECK");
  assert.equal(typedStart.body.processed, 1);
  const typed = await post("v2-button-typed", "v2-button-typed-text", "Jetzt starten");
  assert.doesNotMatch(String(typed.body.botReplyPreview), /https:\/\/check\.example\.org\/start/);
  assert.equal(getConversationState("instagram:v2-button-typed", DEFAULT_CAMPAIGN_ID)?.answers.instagramV2Flow, undefined);

  // Concurrent duplicate signed deliveries within the same process are claimed
  // synchronously before any asynchronous Pete or Meta operation.
  syncInstagramLead({ instagramScopedId: "v2-concurrent", botEnabledForNewLead: true });
  const concurrent = await Promise.all([
    post("v2-concurrent", "v2-concurrent-mid", "CHECK"),
    post("v2-concurrent", "v2-concurrent-mid", "CHECK"),
  ]);
  assert.equal(concurrent.filter(x => x.body.processed === 1).length, 1);
  assert.equal(concurrent.filter(x => x.body.duplicates === 1).length, 1);
  assert.equal(getConversationState("instagram:v2-concurrent", DEFAULT_CAMPAIGN_ID)?.messages.length, 2);

  // KETO uses its own persisted V2 draft; never reuse CHECK's resources.
  writeDraft("stored-v2-KETO", "KETO");
  syncInstagramLead({ instagramScopedId: "v2-keto-one", botEnabledForNewLead: true });
  const keto = await post("v2-keto-one", "v2-keto-start", "KETO");
  assert.equal(keto.status, 200);
  assert.match(String(keto.body.botReplyPreview), /gespeicherter KETO-Einstieg/);
  const ketoState = getConversationState("instagram:v2-keto-one", DEFAULT_CAMPAIGN_ID);
  assert.ok(ketoState);
  assert.equal(JSON.parse(String(ketoState.answers.instagramV2Flow)).campaignId, "stored-v2-KETO");
  const ketoPayload = JSON.parse(String(ketoState.answers.instagramV2Flow)).buttonPayload;
  const ketoButton = await post("v2-keto-one", "v2-keto-button", "Jetzt starten", ketoPayload);
  assert.match(String(ketoButton.body.botReplyPreview), /https:\/\/example\.org\/keto-guide/);
  assert.equal(ketoButton.body.sent, false);

  // Persisted draft disabled in-place: no demo fallback from the V2 executor.
  const storedKeto = getCampaignById("stored-v2-KETO");
  assert.ok(storedKeto);
  saveCampaign({
    ...storedKeto,
    peteCampaign: { ...normalizePeteCampaignConfig(storedKeto.peteCampaign), flowDraftEnabled: false },
  });
  syncInstagramLead({ instagramScopedId: "v2-keto-disabled", botEnabledForNewLead: true });
  const paused = await post("v2-keto-disabled", "v2-keto-paused", "KETO");
  assert.equal(paused.body.botReplyPrepared, false);
  assert.equal(paused.body.sent, false);
  assert.equal(paused.body.sendSkipReason, "v2_saved_draft_disabled_or_invalid");
  assert.equal(getConversationState("instagram:v2-keto-disabled", DEFAULT_CAMPAIGN_ID)?.answers.instagramV2Flow, undefined);

  // No fake "ManyChat is mine" permission: an unowned new follower is silent.
  const unowned = await post("v2-unowned-not-in-allowlist", "v2-unowned-new", "CHECK");
  assert.equal(unowned.body.botReplyPrepared, false);
  assert.equal(unowned.body.sent, false);

  // Ensure a real quick-reply wire body can be generated without external I/O.
  const priorFetch = globalThis.fetch;
  const priorSend = env.INSTAGRAM_SEND_ENABLED;
  const priorAccess = env.INSTAGRAM_ACCESS_TOKEN;
  try {
    env.INSTAGRAM_SEND_ENABLED = true;
    env.INSTAGRAM_ACCESS_TOKEN = "OFFLINE_MOCK_NO_REAL_CREDENTIALS";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.match(String(input), /^https:\/\/graph\.instagram\.com\//);
      const body = JSON.parse(String(init?.body)) as Record<string, any>;
      assert.equal(body.recipient.id, "v2-check-one");
      assert.equal(body.message.quick_replies[0].content_type, "text");
      assert.equal(body.message.quick_replies[0].title, "Jetzt starten");
      assert.equal(body.message.quick_replies[0].payload, "offline-quick-payload");
      return new Response(JSON.stringify({ message_id: "offline-mocked-quick-reply" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const send = await sendMetaInstagramTextMessage({
      to: "v2-check-one", body: "Offline Mock", quickReplies: [{
        title: "Jetzt starten", payload: "offline-quick-payload",
      }],
    });
    assert.equal(send.sent, true); // Mocked provider acknowledgement ONLY, no internet.
  } finally {
    globalThis.fetch = priorFetch;
    env.INSTAGRAM_SEND_ENABLED = priorSend;
    env.INSTAGRAM_ACCESS_TOKEN = priorAccess;
  }

  // A second stored exact CHECK draft makes the trigger ambiguous: fail closed.
  writeDraft("stored-v2-CHECK-conflict", "CHECK");
  syncInstagramLead({ instagramScopedId: "v2-ambiguous", botEnabledForNewLead: true });
  const ambiguous = await post("v2-ambiguous", "v2-check-ambig", "CHECK");
  assert.equal(ambiguous.body.botReplyPrepared, false);
  assert.equal(ambiguous.body.sent, false);
  assert.equal(ambiguous.body.sendSkipReason, "v2_saved_draft_unavailable_or_ambiguous");
  assert.equal(getConversationState("instagram:v2-ambiguous", DEFAULT_CAMPAIGN_ID)?.answers.instagramV2Flow, undefined);

  const priorInbound = getConversationState("instagram:v2-ambiguous", DEFAULT_CAMPAIGN_ID)?.lastUserMessageAt;
  const priorMessageCount = getConversationState("instagram:v2-ambiguous", DEFAULT_CAMPAIGN_ID)?.messages.length;
  const stale = await post("v2-ambiguous", "v2-check-old-timestamp", "CHECK", undefined, Date.now() - 25 * 3600_000);
  assert.equal(stale.body.botReplyPrepared, false);
  assert.equal(stale.body.sent, false);
  assert.equal(stale.body.sendSkipReason, "v2_message_window_unverified_or_expired");
  assert.equal(getConversationState("instagram:v2-ambiguous", DEFAULT_CAMPAIGN_ID)?.lastUserMessageAt, priorInbound);
  assert.equal(getConversationState("instagram:v2-ambiguous", DEFAULT_CAMPAIGN_ID)?.messages.length, priorMessageCount);
  assert.equal(stale.body.messageAppended, false);

  const earlier = env.INSTAGRAM_V2_FLOW_ENABLED;
  env.INSTAGRAM_V2_FLOW_ENABLED = false;
  syncInstagramLead({ instagramScopedId: "v2-feature-off", botEnabledForNewLead: true });
  const disabled = await post("v2-feature-off", "v2-check-disabled", "CHECK");
  assert.equal(disabled.body.sent, false);
  assert.equal(getConversationState("instagram:v2-feature-off", DEFAULT_CAMPAIGN_ID)?.answers.instagramV2Flow, undefined);
  env.INSTAGRAM_V2_FLOW_ENABLED = earlier;
});
