import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-provider-extraction-"));
Object.assign(process.env, {
  NODE_ENV: "test", DATA_DIR: dir,
  INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false", PETE_LLM_CONVERSATION_ENABLED: "false",
  PETE_LLM_API_CALLS_APPROVED: "false",
});
delete process.env.OPENAI_API_KEY;

const {
  createInitialProviderBookingState, activateProviderBookingState,
  markProviderBookingBooked, markProviderBookingCanceled,
  hasActiveProviderBooking, inferBookingProviderFromUrl,
  buildProviderBookingResendReply,
} = await import("./provider-booking.service.js");
const { getOrCreateConversationState } = await import("../core/state-manager.js");
const { clearConversationStore } = await import("../data/store.js");
const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");

test("provider booking helper extraction preserves status and link-only boundaries", async t => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(dir, { force: true, recursive: true });
  });
  const state = getOrCreateConversationState("provider-extract-test", DEFAULT_CAMPAIGN_ID);
  await t.test("status must be awaiting with nonempty URL to count as active", () => {
    state.providerBooking = createInitialProviderBookingState();
    assert.equal(hasActiveProviderBooking(state), false);
    state.providerBooking = activateProviderBookingState({
      current: state.providerBooking, provider: "calendly",
      bookingUrl: "https://calendly.com/tester/gespraech",
    });
    assert.equal(hasActiveProviderBooking(state), true);
    state.providerBooking = activateProviderBookingState({
      current: state.providerBooking, provider: "calendly", bookingUrl: "",
    });
    assert.equal(hasActiveProviderBooking(state), false);
    state.providerBooking = markProviderBookingBooked(state.providerBooking);
    assert.equal(hasActiveProviderBooking(state), false);
    state.providerBooking = markProviderBookingCanceled(state.providerBooking);
    assert.equal(hasActiveProviderBooking(state), false);
  });
  await t.test("provider classification stays exact to legacy substring matching", () => {
    assert.equal(inferBookingProviderFromUrl("https://calendly.com/jochen/test"), "calendly");
    assert.equal(inferBookingProviderFromUrl("https://MEETERGO.de/test"), "meetergo");
    assert.equal(inferBookingProviderFromUrl("https://example.com/test"), "booking_link");
    assert.equal(inferBookingProviderFromUrl(undefined), "booking_link");
  });
  await t.test("resend only offers an external finalization link; never claims booking", () => {
    state.providerBooking = activateProviderBookingState({
      current: createInitialProviderBookingState(),
      provider: "calendly",
      bookingUrl: "https://calendly.com/tester/gespraech",
    });
    const msg = buildProviderBookingResendReply(state);
    assert.match(msg, /https:\/\//);
    assert.doesNotMatch(msg, /(?:Termin|Buchung) ist (?:bereits )?bestätigt/i);
    assert.notEqual(state.providerBooking.status, "booked");
  });
});
