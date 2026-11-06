import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fp-ig-v2-ack-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = directory;
process.env.INSTAGRAM_ENGINE_ENABLED = "true";
process.env.INSTAGRAM_SEND_ENABLED = "true";
process.env.INSTAGRAM_V2_FLOW_ENABLED = "true";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "ack-fail,ack-good,ack-linkfail,ack-stopped,ack-human,ack-preview";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false";
process.env.INSTAGRAM_APP_SECRET = "FAKE_LOCAL_HMAC_NOT_A_REAL_SECRET";
process.env.INSTAGRAM_ACCOUNT_ID = "17841400000000000";
process.env.INSTAGRAM_ACCESS_TOKEN = "FAKE_LOCAL_GRAPH_NO_NETWORK";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";

const { default: app } = await import("../app.js");
const { env } = await import("../config/env.js");
const { saveCampaign } = await import("../data/campaigns.store.js");
const { syncInstagramLead } = await import("../services/instagram-lead-sync.service.js");
const { getConversationState } = await import("../data/store.js");
const { persistConversationState, takeOverByHuman } = await import("../core/state-manager.js");
const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");

test("V2 Meta ACK gates: 503, signed replay, successful delivery and mid-flight STOP/Human", async t => {
  saveCampaign({
    id: "synthetic-v2-ack-check",
    name: "Synthetic V2 ACK only",
    peteCampaign: {
      sources: ["instagram_dm"], keywords: ["CHECK"],
      openingText: "Gespeicherte CHECK Begruessung.",
      flowDraftEnabled: true, autoReplyEnabled: true,
      openingDmButtonEnabled: true, openingDmButtonLabel: "Weiter",
      linkEnabled: true, linkUrl: "https://example.org/ack-test",
      linkMessageText: "Dein Testlink:",
      peteHandoffEnabled: true, followUpEnabled: false,
    },
  });

  for (const sender of ["ack-fail", "ack-good", "ack-linkfail", "ack-stopped", "ack-human", "ack-preview"]) {
    syncInstagramLead({ instagramScopedId: sender, botEnabledForNewLead: true });
  }

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  const realFetch = globalThis.fetch;
  let providerStatus = 200;
  let graphCalls = 0;
  let unblockProvider: ((response: Response) => void) | null = null;
  let providerEntered: (() => void) | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    if (target.startsWith("https://graph.instagram.com/")) {
      graphCalls++;
      if (providerStatus === 0) {
        if (providerEntered) providerEntered();
        return new Promise<Response>(resolve => { unblockProvider = resolve; });
      }
      return new Response(providerStatus === 200
        ? JSON.stringify({ message_id: "mock-receipt-" + graphCalls })
        : JSON.stringify({ error: { message: "SIMULATED_META_503" } }), {
        status: providerStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    assert.match(target, /^http:\/\/127\.0\.0\.1:/, "NO_EXTERNAL_NETWORK");
    return realFetch(input, init);
  }) as typeof fetch;

  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function post(sender: string, mid: string, message: string, payload?: string) {
    const msg: Record<string, unknown> = { mid, text: message };
    if (payload) msg.quick_reply = { payload };
    const raw = JSON.stringify({ object: "instagram", entry: [{
      id: "17841400000000000",
      messaging: [{
        sender: { id: sender }, recipient: { id: "17841400000000000" },
        timestamp: Date.now(), message: msg,
      }],
    }] });
    const signature = "sha256=" + crypto.createHmac("sha256", "FAKE_LOCAL_HMAC_NOT_A_REAL_SECRET")
      .update(Buffer.from(raw, "utf8")).digest("hex");
    const res = await globalThis.fetch(base + "/webhooks/meta/instagram", {
      method: "POST", headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Hub-Signature-256": signature,
      }, body: raw,
    });
    return { status: res.status, body: await res.json() as Record<string, any> };
  }

  function stateFor(sender: string) {
    const state = getConversationState("instagram:" + sender, DEFAULT_CAMPAIGN_ID);
    assert.ok(state);
    return state;
  }
  function flowFor(sender: string) {
    return JSON.parse(String(stateFor(sender).answers.instagramV2Flow)) as {
      stage: string; buttonPayload: string; deliveryAttemptId?: string;
    };
  }

  await t.test("old local preview cannot become live when send permission is switched on", async () => {
    env.INSTAGRAM_SEND_ENABLED = false;
    const priorCalls = graphCalls;
    const preview = await post("ack-preview", "ack-preview-1", "CHECK");
    assert.equal(preview.status, 200);
    assert.equal(preview.body.sent, false);
    assert.equal(flowFor("ack-preview").stage, "await_button");
    assert.equal(graphCalls, priorCalls);
    env.INSTAGRAM_SEND_ENABLED = true;
    const attemptedClick = await post("ack-preview", "ack-preview-2",
      "Weiter", flowFor("ack-preview").buttonPayload);
    assert.equal(attemptedClick.body.botReplyPrepared, false);
    assert.equal(attemptedClick.body.sent, false);
    assert.equal(flowFor("ack-preview").stage, "delivery_failed");
    assert.equal(graphCalls, priorCalls);
  });

  await t.test("rejected first opener remains blocked and same signed event cannot resend", async () => {
    providerStatus = 503;
    const failed = await post("ack-fail", "ack-fail-1", "CHECK");
    assert.equal(failed.status, 500);
    assert.equal(failed.body.sent, false);
    assert.equal(failed.body.outboundStatus, "send_failed");
    assert.equal(flowFor("ack-fail").stage, "delivery_failed");
    assert.equal(stateFor("ack-fail").messages.at(-1)?.outboundStatus, "send_failed");
    const calls = graphCalls;
    const replay = await post("ack-fail", "ack-fail-1", "CHECK");
    assert.equal(replay.body.duplicates, 1);
    assert.equal(graphCalls, calls);
    const userAfter = await post("ack-fail", "ack-fail-2", "Weiter");
    assert.equal(userAfter.body.botReplyPrepared, false);
    assert.equal(userAfter.body.sent, false);
    assert.equal(flowFor("ack-fail").stage, "delivery_failed");
  });

  await t.test("successful provider ACK unlocks button and then Pete stage", async () => {
    providerStatus = 200;
    const sent = await post("ack-good", "ack-good-1", "CHECK");
    assert.equal(sent.status, 200);
    assert.equal(sent.body.sent, true);
    assert.equal(flowFor("ack-good").stage, "await_button");
    assert.equal(stateFor("ack-good").messages.at(-1)?.outboundStatus, "sent");
    const payload = flowFor("ack-good").buttonPayload;
    assert.ok(payload);
    const link = await post("ack-good", "ack-good-2", "Weiter", payload);
    assert.equal(link.status, 200);
    assert.equal(link.body.sent, true);
    assert.equal(flowFor("ack-good").stage, "pete_ready");
  });

  await t.test("link rejection never unlocks Pete stage", async () => {
    providerStatus = 200;
    const start = await post("ack-linkfail", "ack-linkfail-1", "CHECK");
    assert.equal(start.body.sent, true);
    const payload = flowFor("ack-linkfail").buttonPayload;
    providerStatus = 503;
    const link = await post("ack-linkfail", "ack-linkfail-2", "Weiter", payload);
    assert.equal(link.status, 500);
    assert.equal(link.body.sent, false);
    assert.equal(flowFor("ack-linkfail").stage, "delivery_failed");
    const ignored = await post("ack-linkfail", "ack-linkfail-3", "Ich will mit Pete sprechen.");
    assert.equal(ignored.body.botReplyPrepared, false);
  });

  await t.test("new STOP during delayed ACK never restores automatic V2 flow", async () => {
    providerStatus = 0;
    const entered = new Promise<void>(resolve => { providerEntered = resolve; });
    const pending = post("ack-stopped", "ack-stopped-1", "CHECK");
    await entered;
    const before = flowFor("ack-stopped");
    assert.equal(before.stage, "await_delivery");
    const stop = await post("ack-stopped", "ack-stopped-2", "STOP");
    assert.equal(stop.body.sent, false);
    assert.equal(stateFor("ack-stopped").flags.stopped, true);
    assert.ok(unblockProvider);
    const unblock = unblockProvider as (value: Response) => void;
    unblock(new Response(JSON.stringify({ message_id: "mock-delayed-ack-stop" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    const outcome = await pending;
    assert.equal(outcome.status, 200);
    assert.equal(stateFor("ack-stopped").flags.stopped, true);
    assert.equal(flowFor("ack-stopped").stage, "delivery_failed");
    providerEntered = null;
    unblockProvider = null;
  });

  await t.test("human takeover during delayed ACK never restores AI ownership", async () => {
    providerStatus = 0;
    const entered = new Promise<void>(resolve => { providerEntered = resolve; });
    const pending = post("ack-human", "ack-human-1", "CHECK");
    await entered;
    const state = stateFor("ack-human");
    takeOverByHuman(state);
    persistConversationState(state);
    assert.ok(unblockProvider);
    const unblock = unblockProvider as (value: Response) => void;
    unblock(new Response(JSON.stringify({ message_id: "mock-delayed-ack-human" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    await pending;
    assert.equal(stateFor("ack-human").owner, "human");
    assert.equal(stateFor("ack-human").aiPaused, true);
    assert.equal(flowFor("ack-human").stage, "delivery_failed");
  });
});
