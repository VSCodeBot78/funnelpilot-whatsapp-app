import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "fp-ig-erasure-"));
Object.assign(process.env, {
  NODE_ENV: "test", DATA_DIR: folder,
  INSTAGRAM_SEND_ENABLED: "false", WHATSAPP_SEND_ENABLED: "false",
  INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_APP_SECRET: "SYNTHETIC_WEBHOOK_SECRET_NOT_REAL",
  PETE_LLM_API_CALLS_APPROVED: "false",
});

const { default: app } = await import("../app.js");
const { syncInstagramLead } = await import("../services/instagram-lead-sync.service.js");
const { getLeadById, saveLead } = await import("../data/leads.store.js");
const { getOrCreateConversationState, persistConversationState } = await import("../core/state-manager.js");
const { getConversationState } = await import("../data/store.js");
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { getAllMessageEvents, getMessageEventByMessageId, saveMessageEventLogEntry,
  isErasedInstagramEvent } = await import("../data/message-events.store.js");
const { saveBookingEventLogEntry } = await import("../data/booking-events.store.js");

test("synthetic Instagram lead erasure redacts event identities and prevents signed webhook replay", async t => {
  const fakeSender = "SYNTHETIC_IG_PERSON_001";
  const otherSender = "SYNTHETIC_IG_UNRELATED_002";
  const leadId = "instagram:" + fakeSender;
  syncInstagramLead({ instagramScopedId: fakeSender, botEnabledForNewLead: false });
  const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
  state.messages.push({
    id: "synthetic-msg", role: "user", actor: "lead", text: "SYNTHETIC_DELETE_ME",
    createdAt: new Date().toISOString(),
  } as any);
  persistConversationState(state);
  assert.equal(getConversationState(leadId, DEFAULT_CAMPAIGN_ID)?.messages.length, 1);

  const mid = "SYNTHETIC_IG_MSG_001";
  saveMessageEventLogEntry({
    id: "SYNTHETIC_AUDIT_TO_ERASE", provider: "meta_instagram",
    messageId: mid, from: fakeSender, receivedAt: new Date().toISOString(),
    status: "processed", raw: { recipientId: "FAKE_BUSINESS_ID", metadataOnly: true },
  });
  saveMessageEventLogEntry({
    id: "SYNTHETIC_ECHO_TO_ERASE", provider: "meta_instagram",
    messageId: "SYNTHETIC_IG_ECHO_001", from: "FAKE_BUSINESS_ID",
    receivedAt: new Date().toISOString(), status: "processed",
    raw: { recipientId: fakeSender, isEcho: true },
  });
  saveMessageEventLogEntry({
    id: "SYNTHETIC_AUDIT_TO_KEEP", provider: "meta_instagram",
    messageId: "SYNTHETIC_OTHER_MSG", from: otherSender, receivedAt: new Date().toISOString(),
    status: "processed",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new URL(String(input)).hostname, "127.0.0.1", "NO_EXTERNAL_NETWORK");
    return realFetch(input, init);
  }) as typeof fetch;
  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const deleted = await fetch(base + "/leads/" + encodeURIComponent(leadId), { method: "DELETE" });
  assert.equal(deleted.status, 200, JSON.stringify(await deleted.json()));
  assert.equal(getLeadById(leadId), undefined);
  assert.equal(getConversationState(leadId, DEFAULT_CAMPAIGN_ID), undefined);
  const events = getAllMessageEvents();
  assert.equal(events.filter(isErasedInstagramEvent).length, 2);
  assert.equal(events.find(e => e.from === otherSender)?.messageId, "SYNTHETIC_OTHER_MSG");
  assert.equal(events.filter(isErasedInstagramEvent).every(e =>
    !e.from && !e.raw && e.status === "processed"), true);
  assert.equal(isErasedInstagramEvent(getMessageEventByMessageId("meta_instagram", mid)!), true);
  assert.equal(isErasedInstagramEvent(getMessageEventByMessageId("meta_instagram", "SYNTHETIC_IG_ECHO_001")!), true);
  const allFiles = ["leads.json", "conversations.json", "message-events.json"];
  for (const file of allFiles) {
    const contents = fs.readFileSync(path.join(folder, file), "utf8");
    assert.doesNotMatch(contents, /SYNTHETIC_IG_PERSON_001|SYNTHETIC_DELETE_ME|SYNTHETIC_IG_MSG_001|SYNTHETIC_IG_ECHO_001|SYNTHETIC_AUDIT_TO_ERASE/);
  }
  // A late correctly signed retry must neither re-add sender IDs nor recreate a lead.
  const body = JSON.stringify({ object: "instagram", entry: [{
    id: "FAKE_BUSINESS_ID", messaging: [{
      sender: { id: fakeSender }, recipient: { id: "FAKE_BUSINESS_ID" },
      timestamp: Date.now(), message: { mid, text: "KETO" },
    }],
  }] });
  const signature = "sha256=" + crypto.createHmac("sha256", "SYNTHETIC_WEBHOOK_SECRET_NOT_REAL")
    .update(Buffer.from(body, "utf8")).digest("hex");
  const replay = await fetch(base + "/webhooks/meta/instagram", {
    method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body,
  });
  const replayBody = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(replayBody.duplicates, 1);
  assert.equal(getLeadById(leadId), undefined);
  assert.equal(getAllMessageEvents().filter(isErasedInstagramEvent).length, 2);
  assert.doesNotMatch(fs.readFileSync(path.join(folder, "message-events.json"), "utf8"), /SYNTHETIC_IG_PERSON_001|SYNTHETIC_IG_MSG_001/);
});

test("a linked booking creates a fail-closed legal-hold decision, not a misleading erasure success", async t => {
  const fake = "SYNTHETIC_IG_BOOKING_HOLD";
  const leadId = "instagram:" + fake;
  syncInstagramLead({ instagramScopedId: fake, botEnabledForNewLead: false });
  saveBookingEventLogEntry({
    id: "SYNTHETIC_BOOKING_RECORD", provider: "calendly", eventType: "invitee.created",
    campaignId: DEFAULT_CAMPAIGN_ID, leadId, status: "processed",
    receivedAt: new Date().toISOString(), idempotencyKey: "SYNTHETIC_BOOKING_KEY",
    rawPayload: { name: "SYNTHETIC_BOOKING_HOLDER" },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const response = await fetch("http://127.0.0.1:" + address.port + "/leads/" + encodeURIComponent(leadId),
    { method: "DELETE" });
  assert.equal(response.status, 409);
  assert.match(JSON.stringify(await response.json()), /Aufbewahrungspruefung/);
  assert.ok(getLeadById(leadId));

  // Also block a structured booked flag when a provider event was never logged.
  const second = syncInstagramLead({
    instagramScopedId: "SYNTHETIC_IG_BOOKED_WITHOUT_EVENT", botEnabledForNewLead: false,
  }).lead;
  saveLead({
    ...second, booked: true,
    bookingData: { ...second.bookingData, status: "booked", bookingProvider: "calendly" },
  });
  const noLogResponse = await fetch("http://127.0.0.1:" + address.port +
    "/leads/" + encodeURIComponent(second.id), { method: "DELETE" });
  assert.equal(noLogResponse.status, 409);
  assert.ok(getLeadById(second.id));
});
