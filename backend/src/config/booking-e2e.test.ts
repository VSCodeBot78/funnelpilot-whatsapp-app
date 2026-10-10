import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-booking-e2e-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
process.env.CALENDLY_WEBHOOK_SECRET = "fp-calendly-test-webhook-secret";
process.env.CALENDLY_WEBHOOK_VERIFY_MODE = "strict";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { getOrCreateConversationState } = await import("../core/state-manager.js");
const { activateProviderBookingState } = await import("../services/provider-booking.service.js");

function signedPayload(payload: unknown, timestamp = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(payload);
  const digest = crypto.createHmac("sha256", "fp-calendly-test-webhook-secret")
    .update(String(timestamp) + "." + raw)
    .digest("hex");
  return { raw, signature: `t=${timestamp},v1=${digest}` };
}

async function sendCalendly(base: string, payload: unknown, timestamp?: number, signatureOverride?: string) {
  const signed = signedPayload(payload, timestamp);
  const response = await fetch(base + "/booking-events/calendly", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "calendly-webhook-signature": signatureOverride ?? signed.signature,
    },
    body: signed.raw,
  });
  return { response, json: await response.json() as Record<string, any> };
}

test("Local testchat -> signed Calendly booking -> Google add-to-calendar link -> cancellation", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const leadId = "fp-booking-local-testchat-1";
  const campaignId = "eltern-vital-fit";
  const eventUri = "https://api.calendly.com/scheduled_events/test-event-123";
  const startAt = "2026-10-21T17:00:00Z";
  const endAt = "2026-10-21T17:30:00Z";

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  const initial = await fetch(base + "/test-chat/message", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      campaignId,
      leadId,
      messageText: "Schick mir bitte den Link für ein Strategiegespräch",
    }),
  });
  assert.equal(initial.status, 200);
  const initialJson = await initial.json() as { reply: string; state: { providerBooking: { status: string; bookingUrl?: string } } };
  assert.match(initialJson.reply, /calendly\.com/i);
  const state = getConversationState(leadId, campaignId) ?? getOrCreateConversationState(leadId, campaignId);
  // The testchat and the provider share exactly the same conversation record.
  if (state.providerBooking.status !== "awaiting_booking") {
    state.providerBooking = activateProviderBookingState({
      current: state.providerBooking,
      provider: "calendly",
      bookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
    });
  }

  const claim = await fetch(base + "/test-chat/message", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId, campaignId, messageText: "Hab gebucht" }),
  });
  assert.equal(claim.status, 200);
  assert.equal(getConversationState(leadId, campaignId)?.providerBooking.status, "awaiting_booking",
    "customer chat statement must not be confused with provider confirmation");

  const booking = {
    event: "invitee.created",
    payload: {
      tracking: { utm_campaign: campaignId, utm_content: leadId },
      event: { uri: eventUri, name: "Strategiegespräch", start_time: startAt, end_time: endAt },
      invitee: { uri: "https://api.calendly.com/invitees/test-invitee", name: "Test Coach", email: "test@example.com" },
    },
  };

  const withoutSignature = await fetch(base + "/booking-events/calendly", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(booking),
  });
  assert.equal(withoutSignature.status, 401);

  const tooOld = await sendCalendly(base, booking, Math.floor(Date.now() / 1000) - 1000);
  assert.equal(tooOld.response.status, 401, "old signed events must be rejected");

  const tampered = await sendCalendly(base, booking, undefined, `t=${Math.floor(Date.now() / 1000)},v1=${"a".repeat(64)}`);
  assert.equal(tampered.response.status, 401, "wrong HMAC must be rejected");

  const created = await sendCalendly(base, booking);
  assert.equal(created.response.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.ok, true);
  const bookedState = getConversationState(leadId, campaignId);
  assert.ok(bookedState);
  assert.equal(bookedState.providerBooking.status, "booked");
  assert.equal(bookedState.bookingData?.status, "booked");
  assert.equal(bookedState.bookingData?.bookingProvider, "calendly");
  assert.equal(bookedState.bookingData?.startAt, startAt);
  assert.equal(bookedState.bookingData?.endAt, endAt);
  assert.equal(bookedState.currentStep, "done");
  const prepared = bookedState.messages.at(-1);
  assert.equal(prepared?.outboundStatus, "prepared");
  assert.equal(prepared?.sent, false);
  assert.ok(prepared?.text.includes("calendar.google.com/calendar/render?"));
  const urlText = prepared?.text.match(/https:\/\/calendar\.google\.com\/[^\s]+/)?.[0];
  assert.ok(urlText);
  const template = new URL(urlText);
  assert.equal(template.searchParams.get("action"), "TEMPLATE");
  assert.equal(template.searchParams.get("dates"), "20261021T170000Z/20261021T173000Z");
  assert.equal(bookedState.ghosting.active, false);

  const msgCount = bookedState.messages.length;
  const duplicate = await sendCalendly(base, booking);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.json.eventLog?.status, "ignored_duplicate");
  assert.equal(getConversationState(leadId, campaignId)?.messages.length, msgCount);

  const cancel = {
    ...booking,
    event: "invitee.canceled",
  };
  const canceled = await sendCalendly(base, cancel);
  assert.equal(canceled.response.status, 200, JSON.stringify(canceled.json));
  const afterCancellation = getConversationState(leadId, campaignId);
  assert.equal(afterCancellation?.providerBooking.status, "canceled");
  assert.equal(afterCancellation?.bookingData?.status, "cancelled");
  assert.equal(afterCancellation?.messages.at(-1)?.outboundStatus, "prepared");
  assert.match(afterCancellation?.messages.at(-1)?.text ?? "", /storniert/i);
});
