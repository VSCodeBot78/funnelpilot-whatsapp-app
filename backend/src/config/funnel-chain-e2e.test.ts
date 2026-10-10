import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// In-process Express HTTP and signed synthetic Meta/Calendly events.
// No real provider connections, external API calls, or chargeable AI use.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-funnel-chain-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_APP_SECRET = "phase31-fake-ig-secret";
process.env.META_APP_SECRET = "phase31-fake-wa-secret";
process.env.INSTAGRAM_ENGINE_ENABLED = "true";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "phase31-test-igsid";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.CALENDLY_WEBHOOK_VERIFY_MODE = "strict";
process.env.CALENDLY_WEBHOOK_SECRET = "phase31-fake-calendly-secret";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { getLeadById, saveLead, deleteLead } = await import("../data/leads.store.js");
const { evaluateProviderBookingFollowUp } = await import("../services/provider-booking.service.js");
const { evaluateGhostingState } = await import("../services/ghosting.service.js");
const { writeSettings } = await import("../services/settings-store.js");

const CAMPAIGN = DEFAULT_CAMPAIGN_ID;
type Json = Record<string, any>;
const nowHoursAgo = (h: number) =>
  new Date(Date.now() - h * 3600_000).toISOString();

function signMeta(raw: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret)
    .update(Buffer.from(raw, "utf8")).digest("hex");
}
function signCalendly(raw: string, timestamp = Math.floor(Date.now() / 1000)) {
  return "t=" + timestamp + ",v1=" +
    crypto.createHmac("sha256", "phase31-fake-calendly-secret")
      .update(timestamp + "." + raw).digest("hex");
}
async function postJson(base: string, endpoint: string, body: object) {
  const response = await fetch(base + endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Json };
}
async function signedPost(
  base: string, endpoint: string, payload: unknown,
  signatureHeader: string, signature: string,
) {
  const raw = JSON.stringify(payload);
  const response = await fetch(base + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", [signatureHeader]: signature },
    body: raw,
  });
  return { status: response.status, body: await response.json() as Json };
}
function igPayload(id: string, text: string) {
  return {
    object: "instagram",
    entry: [{ id: "phase31-ig-business", messaging: [{
      sender: { id: "phase31-test-igsid" }, recipient: { id: "phase31-ig-business" },
      timestamp: Date.now(), message: { mid: id, text },
    }] }],
  };
}
async function instagram(base: string, id: string, text: string) {
  const payload = igPayload(id, text), raw = JSON.stringify(payload);
  return signedPost(base, "/webhooks/meta/instagram", payload,
    "X-Hub-Signature-256", signMeta(raw, "phase31-fake-ig-secret"));
}
function waPayload(id: string, from: string, text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "phase31-waba", changes: [{
      field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { phone_number_id: "phase31-phone-id" },
        contacts: [{ wa_id: from, profile: { name: "Test Papa" } }],
        messages: [{
          id, from, timestamp: String(Math.floor(Date.now() / 1000)),
          type: "text", text: { body: text },
        }],
      },
    }] }],
  };
}
async function whatsapp(base: string, id: string, from: string, text: string) {
  const payload = waPayload(id, from, text), raw = JSON.stringify(payload);
  return signedPost(base, "/webhooks/meta/whatsapp", payload,
    "X-Hub-Signature-256", signMeta(raw, "phase31-fake-wa-secret"));
}
async function calendly(base: string, payload: unknown, signatureOverride?: string) {
  const raw = JSON.stringify(payload);
  return signedPost(base, "/booking-events/calendly", payload,
    "Calendly-Webhook-Signature", signatureOverride ?? signCalendly(raw));
}
async function chat(base: string, leadId: string, text: string) {
  return postJson(base, "/test-chat/message", {
    leadId, campaignId: CAMPAIGN, messageText: text,
  });
}
const conversationUrl = (lead: string, action: "takeover" | "release" | "human-message") =>
  "/conversations/" + encodeURIComponent(CAMPAIGN) + "/" +
  encodeURIComponent(lead) + "/" + action;

test("Phase 31 – real in-process endpoints connected into complete, provider-mocked funnels", async (t) => {
  writeSettings({ dmConversationMode: "natural", aiEnabled: false, testMode: true });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
    clearConversationStore();
    deleteLead("instagram:phase31-test-igsid");
    deleteLead("whatsapp:491709923100");
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  await t.test("Instagram: new lead disabled → manual allow → offer → human takeover → silent → explicit release → STOP", async () => {
    clearConversationStore();
    const leadId = "instagram:phase31-test-igsid";

    const unsigned = await fetch(base + "/webhooks/meta/instagram", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(igPayload("phase31-unsigned", "Was kostet der Selbststarter?")),
    });
    assert.equal(unsigned.status, 401);
    assert.equal(getLeadById(leadId), undefined, "unsigned traffic cannot create a lead");

    const waiting = await instagram(base, "phase31-ig-1", "Was kostet der Selbststarter?");
    assert.equal(waiting.status, 200);
    assert.equal(waiting.body.sent, false);
    assert.equal(waiting.body.engineProcessed, false);
    const lead = getLeadById(leadId);
    assert.ok(lead);
    assert.equal(lead.botEnabled, false, "ManyChat coexistence defaults to waiting");
    assert.equal(getConversationState(leadId, CAMPAIGN), undefined);

    saveLead({ ...lead, botEnabled: true });
    const inbound = await instagram(base, "phase31-ig-2", "Was kostet der Selbststarter?");
    assert.equal(inbound.status, 200);
    assert.equal(inbound.body.engineProcessed, true);
    assert.equal(inbound.body.botReplyPrepared, true);
    assert.equal(inbound.body.sent, false);
    assert.equal(inbound.body.dryRun, true);
    assert.match(inbound.body.botReplyPreview ?? "", /14,95/);

    const saved = getConversationState(leadId, CAMPAIGN);
    assert.ok(saved);
    assert.equal(saved.owner, "ai");
    assert.ok(saved.messages.some(m => m.text.includes("14,95")));

    const duplicate = await instagram(base, "phase31-ig-2", "Was kostet der Selbststarter?");
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicates, 1);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.messages.length, saved.messages.length);

    const request = await instagram(base, "phase31-ig-3", "Ich möchte mit Jochen sprechen.");
    assert.equal(request.status, 200);
    assert.equal(request.body.sent, false);
    const chatChoice = await instagram(base, "phase31-ig-4", "Hier im Chat bitte.");
    assert.equal(chatChoice.status, 200);
    const human = getConversationState(leadId, CAMPAIGN);
    assert.ok(human);
    assert.equal(human.owner, "human");
    assert.equal(human.aiPaused, true);
    const messagesBeforeManual = human.messages.length;

    const manual = await postJson(base, conversationUrl(leadId, "human-message"), {
      messageText: "Hier ist Jochen, ich übernehme.",
    });
    assert.equal(manual.status, 200);
    assert.equal(manual.body.sent, false);
    assert.equal(manual.body.dryRun, true);
    assert.equal(manual.body.messageAppended, false);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.messages.length, messagesBeforeManual,
      "a disabled external send must not manufacture a human outbound message");

    const whileHuman = await instagram(base, "phase31-ig-5", "Danke, was kostet die Begleitung?");
    assert.equal(whileHuman.status, 200);
    assert.equal(whileHuman.body.botReplyPrepared, false);
    assert.equal(whileHuman.body.sent, false);
    const humanState = getConversationState(leadId, CAMPAIGN);
    assert.ok(humanState);
    assert.equal(humanState.owner, "human");
    assert.equal(humanState.aiPaused, true);

    const released = await postJson(base, conversationUrl(leadId, "release"), {});
    assert.equal(released.status, 200);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.owner, "ai");
    const resumed = await instagram(base, "phase31-ig-6", "Schick mir bitte den Keto Guide.");
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.engineProcessed, true);
    assert.match(resumed.body.botReplyPreview ?? "", /keto-guide/i);
    assert.equal(resumed.body.sent, false);

    const stop = await instagram(base, "phase31-ig-7", "Schreib mich nicht mehr an.");
    assert.equal(stop.status, 200);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.flags.stopped, true);
    const afterStop = await instagram(base, "phase31-ig-8", "Bist du noch da?");
    assert.equal(afterStop.status, 200);
    assert.equal(afterStop.body.botReplyPrepared, false);
    assert.equal(afterStop.body.sent, false);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.flags.stopped, true);
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "instagram", signed: true, duplicated: true, manualHandoff: true,
      explicitRelease: true, stop: true, realSends: 0,
    }));
  });

  await t.test("WhatsApp: signed DM → dry-run → Business App echo → AI silence → release → next DM", async () => {
    clearConversationStore();
    const from = "491709923100", leadId = "whatsapp:" + from;
    const first = await whatsapp(base, "phase31-wa-1", from, "Hallo, ich bin Papa von zwei Kindern");
    assert.equal(first.status, 200);
    assert.equal(first.body.engineProcessed, true);
    assert.equal(first.body.sent, false);
    assert.equal(first.body.dryRun, true);
    const saved = getConversationState(leadId, CAMPAIGN);
    assert.ok(saved);
    assert.equal(saved.owner, "ai");

    const duplicate = await whatsapp(base, "phase31-wa-1", from, "Hallo, ich bin Papa von zwei Kindern");
    assert.equal(duplicate.body.duplicates, 1);
    assert.equal(saved.messages.length, getConversationState(leadId, CAMPAIGN)?.messages.length);

    const echo = {
      object: "whatsapp_business_account",
      entry: [{ id: "phase31-waba", changes: [{
        field: "smb_message_echoes", value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: "phase31-phone-id" },
          message_echoes: [{
            id: "phase31-wa-human-echo", from: "491711111111", to: from,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: "text", text: { body: "Hier übernimmt jetzt Jochen." },
          }],
        },
      }] }],
    };
    const echoResult = await signedPost(
      base, "/webhooks/meta/whatsapp", echo, "X-Hub-Signature-256",
      signMeta(JSON.stringify(echo), "phase31-fake-wa-secret"),
    );
    assert.equal(echoResult.status, 200);
    assert.equal(echoResult.body.humanEchoTakeovers, 1);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.owner, "human");

    const paused = await whatsapp(base, "phase31-wa-2", from, "Kannst du mir die Preise senden?");
    assert.equal(paused.status, 200);
    assert.equal(paused.body.botReplyPrepared, false);
    assert.equal(paused.body.sent, false);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.aiPaused, true);

    const release = await postJson(base, conversationUrl(leadId, "release"), {});
    assert.equal(release.status, 200);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.owner, "ai");
    const resumed = await whatsapp(base, "phase31-wa-3", from, "Danke, wie geht's weiter?");
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.engineProcessed, true);
    assert.equal(resumed.body.sent, false);
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "whatsapp", signed: true, duplicate: true, businessEchoHuman: true,
      resumed: true, realSends: 0,
    }));
  });

  await t.test("booking: dialogue → unverified self-claim → provider HMAC → dedupe → follow-up suppressed → cancellation", async () => {
    clearConversationStore();
    const leadId = "phase31-calendly-booking-test";
    const first = await chat(base, leadId, "Ich möchte ein Strategiegespräch buchen");
    assert.equal(first.status, 200);
    assert.match(first.body.reply ?? "", /calendly\.com/i);
    let state = getConversationState(leadId, CAMPAIGN);
    assert.ok(state);
    assert.equal(state.providerBooking.status, "awaiting_booking",
      "real booking link must activate awaiting_booking without manual test patch");

    const falseClaim = await chat(base, leadId, "Hab gebucht");
    assert.equal(falseClaim.status, 200);
    assert.notEqual(getConversationState(leadId, CAMPAIGN)?.providerBooking.status, "booked");
    assert.match(falseClaim.body.reply ?? "", /nicht als bestätigt/i);

    // Only the signed provider callback changes a booking from pending to booked.
    const event = {
      event: "invitee.created",
      payload: {
        tracking: { utm_campaign: CAMPAIGN, utm_content: leadId },
        event: {
          uri: "https://api.calendly.com/scheduled_events/phase31-example",
          name: "Strategiegespräch",
          start_time: "2026-10-23T15:00:00Z",
          end_time: "2026-10-23T15:30:00Z",
        },
        invitee: {
          uri: "https://api.calendly.com/invitees/phase31-example",
          name: "Testmama", email: "phase31@example.invalid",
        },
      },
    };
    const invalid = await calendly(base, event, "t=0,v1=" + "0".repeat(64));
    assert.equal(invalid.status, 401);
    assert.notEqual(getConversationState(leadId, CAMPAIGN)?.providerBooking.status, "booked");

    const confirmed = await calendly(base, event);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.ok, true);
    state = getConversationState(leadId, CAMPAIGN);
    assert.ok(state);
    assert.equal(state.providerBooking.status, "booked");
    assert.equal(state.bookingData?.status, "booked");
    assert.equal(state.currentStep, "done");
    assert.equal(evaluateProviderBookingFollowUp(state).dueNow, false);
    assert.equal(evaluateGhostingState(state, state.ghosting).dueNow, false);
    const prepared = state.messages.at(-1);
    assert.equal(prepared?.outboundStatus, "prepared");
    assert.equal(prepared?.sent, false);
    assert.match(prepared.text, /calendar\.google\.com\/calendar\/render/);

    const count = state.messages.length;
    const duplicate = await calendly(base, event);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.eventLog?.status, "ignored_duplicate");
    assert.equal(getConversationState(leadId, CAMPAIGN)?.messages.length, count);

    const canceled = await calendly(base, { ...event, event: "invitee.canceled" });
    assert.equal(canceled.status, 200);
    state = getConversationState(leadId, CAMPAIGN);
    assert.ok(state);
    assert.equal(state.providerBooking.status, "canceled");
    assert.equal(state.bookingData?.status, "cancelled");
    assert.equal(state.messages.at(-1)?.outboundStatus, "prepared");
    assert.equal(state.messages.at(-1)?.sent, false);
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "booking", userClaimUnverified: true, signedVerified: true,
      duplicateIgnored: true, cancellation: true, preparedOnly: true, realSends: 0,
    }));
  });

  await t.test("checkout simulation: ready buyer → synthetic paid event → prepared onboarding → idempotency (not payment-provider proof)", async () => {
    clearConversationStore();
    const leadId = "phase31-synthetic-buyer";
    const interest = await chat(base, leadId, "Ich möchte die 5-Wochen-Begleitung buchen.");
    assert.equal(interest.status, 200);
    assert.match(interest.body.reply ?? "", /499\s*€/);
    const direct = await chat(base, leadId, "Lieber direkt starten, kein Gespräch.");
    assert.equal(direct.status, 200);
    assert.match(direct.body.reply ?? "", /portal\.nutrilize\.app/);

    const checkout = {
      leadId, campaignId: CAMPAIGN, event: "checkout.completed",
      paymentStatus: "paid", productId: "phase31-fake-five-week",
      checkoutId: "phase31-not-real-payment",
    };
    const simulated = await postJson(base, "/webhook/checkout", checkout);
    assert.equal(simulated.status, 200);
    assert.equal(simulated.body.status, "paid");
    const purchased = getConversationState(leadId, CAMPAIGN);
    assert.ok(purchased);
    assert.equal(purchased.answers.coachingEntryPurchaseStatus, "paid");
    assert.ok(purchased.answers.onboardingPromptPreparedAt);
    assert.equal(purchased.answers.onboardingPromptSentAt, undefined);
    assert.equal(purchased.messages.at(-1)?.sent, undefined);
    assert.equal(purchased.currentStep, "done");
    assert.match(purchased.messages.at(-1)?.text ?? "", /Onboarding-Gespräch/);
    const size = purchased.messages.length;
    const again = await postJson(base, "/webhook/checkout", checkout);
    assert.equal(again.status, 200);
    assert.equal(again.body.duplicated, true);
    assert.equal(getConversationState(leadId, CAMPAIGN)?.messages.length, size);
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "synthetic-checkout", paymentProviderVerified: false,
      onboardingPrepared: true, onboardingSent: false,
      duplicateIgnored: true, realCharges: 0, realSends: 0,
    }));
  });

  await t.test("simulated checkout records business state but never creates onboarding draft after STOP or human takeover", async () => {
    for (const blockedBy of ["stop", "human"] as const) {
      clearConversationStore();
      const leadId = "phase31-checkout-" + blockedBy;
      const initial = await chat(base, leadId, "Hallo, ich will die 5-Wochen-Begleitung buchen.");
      assert.equal(initial.status, 200);
      if (blockedBy === "stop") {
        const stop = await chat(base, leadId, "Bitte nicht mehr schreiben.");
        assert.equal(stop.status, 200);
        assert.equal(getConversationState(leadId, CAMPAIGN)?.flags.stopped, true);
      } else {
        const takeover = await postJson(base, conversationUrl(leadId, "takeover"), {});
        assert.equal(takeover.status, 200);
        assert.equal(getConversationState(leadId, CAMPAIGN)?.owner, "human");
      }

      const before = getConversationState(leadId, CAMPAIGN);
      assert.ok(before);
      const originalCount = before.messages.length;
      const simulated = await postJson(base, "/webhook/checkout", {
        leadId, campaignId: CAMPAIGN,
        event: "checkout.completed", paymentStatus: "paid",
        checkoutId: "phase31-fake-payment-" + blockedBy,
      });
      assert.equal(simulated.status, 200);
      const after = getConversationState(leadId, CAMPAIGN);
      assert.ok(after);
      assert.equal(after.answers.coachingEntryPurchaseStatus, "paid");
      assert.equal(after.messages.length, originalCount,
        "A blocked assistant must not append a new prepared onboarding DM");
      assert.equal(after.answers.onboardingPromptPreparedAt, undefined,
        "No onboarding prepared timestamp is valid without an actual draft");
      assert.equal(simulated.body.reply, undefined,
        "API response must not imply a customer-facing message was prepared");
      if (blockedBy === "stop") {
        assert.equal(after.flags.stopped, true);
      } else {
        assert.equal(after.owner, "human");
        assert.equal(after.aiPaused, true);
      }
    }
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "checkout-while-blocked", stopPreserved: true,
      humanPreserved: true, purchaseMetadataRecorded: true,
      autoDrafts: 0, realSends: 0,
    }));
  });

  await t.test("signed provider confirmation after personal takeover updates status, but never injects an AI reply", async () => {
    clearConversationStore();
    const leadId = "phase31-handover-booking-test";
    const link = await chat(base, leadId, "Ich möchte ein Strategiegespräch buchen.");
    assert.equal(link.status, 200);
    const takeover = await postJson(base, conversationUrl(leadId, "takeover"), {});
    assert.equal(takeover.status, 200);
    const state = getConversationState(leadId, CAMPAIGN);
    assert.ok(state);
    assert.equal(state.owner, "human");
    const oldCount = state.messages.length;

    const event = {
      event: "invitee.created",
      payload: {
        tracking: { utm_campaign: CAMPAIGN, utm_content: leadId },
        event: {
          uri: "https://api.calendly.com/scheduled_events/phase31-human",
          start_time: "2026-10-27T15:00:00Z", end_time: "2026-10-27T15:30:00Z",
        },
        invitee: { uri: "https://api.calendly.com/invitees/phase31-human", name: "Testlead" },
      },
    };
    const verified = await calendly(base, event);
    assert.equal(verified.status, 200);
    const updated = getConversationState(leadId, CAMPAIGN);
    assert.ok(updated);
    assert.equal(updated.providerBooking.status, "booked");
    assert.equal(updated.owner, "human");
    assert.equal(updated.aiPaused, true);
    assert.equal(updated.messages.length, oldCount,
      "Verified status must not create an automatic outbound draft during human takeover");
    assert.equal(evaluateProviderBookingFollowUp(updated).dueNow, false);

    const next = await chat(base, leadId, "Klappt der Termin?");
    assert.equal(next.status, 200);
    assert.equal(next.body.reply, null);
    console.log("PHASE31_CHAIN " + JSON.stringify({
      path: "booking-during-handover", providerStatusUpdated: true,
      humanOwnershipPreserved: true, newAutoDrafts: 0, realSends: 0,
    }));
  });
});
