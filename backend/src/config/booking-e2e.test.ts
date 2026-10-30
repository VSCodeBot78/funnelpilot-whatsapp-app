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

test("P0-1 real HTTP: booked legacy flag never overrides explicit cancelled/pending lead status", async t => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  for (const [suffix, status] of [["a", "cancelled"], ["b", "pending_confirmation"]] as const) {
    const id = "p0-booking-status-synthetic-" + suffix;
    const bookingData = { status, bookingProvider: "manual",
      ...(status === "cancelled" ? { cancelledAt: "2026-10-30T17:00:00Z" } : {}) };
    const leadResponse = await fetch(base + "/leads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, backendLeadId: id, name: "Synthetic QA", phone: "000000000",
        campaignId: "eltern-vital-fit", booked: true, bookingData }),
    });
    assert.equal(leadResponse.status, 200);
    const saved = await leadResponse.json() as any;
    assert.equal(saved.lead.booked, false, "stale lead booked flag must not resurrect " + status);
    assert.equal(saved.lead.bookingData.status, status);
    const persisted = await fetch(base + "/leads/" + id).then(r => r.json()) as any;
    assert.equal(persisted.lead.booked, false);
    assert.equal(persisted.lead.bookingData.status, status);
    const ensure = await fetch(base + "/conversations/ensure", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId: id, backendLeadId: id, campaignId: "eltern-vital-fit",
        leadName: "Synthetic QA", phone: "000000000", booked: true, bookingData }),
    });
    assert.equal(ensure.status, 200);
    const ensured = await ensure.json() as any;
    assert.equal(ensured.state.bookingData.status, status,
      "conversation ensure must keep the explicit status " + status);
    assert.notEqual(ensured.state.providerBooking?.status, "booked",
      "a stale flag must not forge a provider confirmation");
  }
});

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

test("Calendly: dated slots survive, closed days never fallback to fake hours", async () => {
  const { updateAvailabilityConfig, resetAvailabilityConfig } =
    await import("../data/availability-config.store.js");
  const { getAvailabilitySource } =
    await import("../services/availability-source.service.js");
  const { formatAvailabilitySlot } =
    await import("../services/availability.service.js");
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.CALENDLY_PAT;
  process.env.CALENDLY_PAT = "offline-mocked-token-no-network";
  updateAvailabilityConfig({
    sourceMode: "calendar",
    weeklySlots: { friday: ["09:00", "10:00"] },
  });
  const calls: string[] = [];
  try {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      let body: unknown;
      if (url.endsWith("/users/me")) {
        body = { resource: { uri: "https://api.calendly.com/users/fixture" } };
      } else if (url.includes("/event_types?")) {
        body = { collection: [{
          uri: "https://api.calendly.com/event_types/fixture",
          slug: "strategiegespraech",
          scheduling_url: "https://calendly.com/eltern-fitundvital/strategiegespraech",
          active: true,
        }] };
      } else if (url.includes("/event_type_available_times?")) {
        body = { collection: [
          { start_time: "2026-10-30T17:00:00Z", status: "available" },
          { start_time: "2026-11-06T17:00:00Z", status: "available" },
          { start_time: "2026-11-06T18:00:00Z", status: "unavailable" },
        ] };
      } else {
        throw Error("unexpected fake Calendly URL: " + url);
      }
      return new Response(JSON.stringify(body), {
        status: 200, headers: { "content-type": "application/json" },
      });
    };
    const found = await getAvailabilitySource({ campaignId: "eltern-vital-fit" });
    assert.equal(found.mode, "calendar");
    assert.equal(found.slots.length, 2, "different Fridays must not collapse");
    assert.deepEqual(found.slots.map(s => s.date), ["2026-10-30", "2026-11-06"]);
    assert.ok(found.slots.every(s => s.day === "friday" && s.time === "18:00"));
    assert.equal(
      formatAvailabilitySlot(found.slots[0]),
      "Freitag, 30.10.2026 um 18:00",
    );
    assert.ok(calls.some(url => url.includes("event_type_available_times")));
    globalThis.fetch = async () => { throw Error("simulated Calendly outage"); };
    const failed = await getAvailabilitySource({ campaignId: "eltern-vital-fit" });
    assert.deepEqual(failed.slots, [],
      "provider outage must NEVER offer locally configured fake Friday morning times");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.CALENDLY_PAT;
    else process.env.CALENDLY_PAT = oldToken;
    resetAvailabilityConfig();
  }
});

test("P0-1: explicit booking status outranks a stale legacy booked boolean", async () => {
  const { normalizeBookingData } = await import("../domain/booking-sync.js");
  for (const status of ["cancelled", "pending_confirmation", "requested", "inactive", "completed"] as const) {
    const data = normalizeBookingData({ status, bookingProvider: "calendly",
      cancelledAt: status === "cancelled" ? "2026-10-30T17:00:00Z" : null }, true);
    assert.equal(data.status, status, "stale booked=true must not resurrect status=" + status);
    assert.ok(!data.confirmedAt, "explicit non-booked status must not generate fresh confirmation");
  }
  assert.equal(normalizeBookingData({}, true).status, "booked",
    "missing structured status retains legacy booked compatibility");
  assert.equal(normalizeBookingData({ status: "booked" }, false).status, "booked");
  assert.equal(normalizeBookingData({ status: "cancelled" }, false).status, "cancelled");
});

test("Default booking copy never promises old unverified weekday times", async () => {
  const { getSchedulingTextsConfig } = await import("./scheduling-providers.js");
  const real = getSchedulingTextsConfig("eltern-vital-fit").bookingPrompt ?? "";
  const fallback = getSchedulingTextsConfig("unknown-campaign").bookingPrompt ?? "";
  for (const value of [real, fallback]) {
    assert.doesNotMatch(value, /unter der Woche um 19:00|19:45|vormittags oder nachmittags/i);
    assert.match(value, /Buchungskalender/i);
    assert.match(value, /bestätigt/i);
  }
});

test("Desktop Calendly diagnostic: credentials absent, dated provider slots, provider error", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = "http://127.0.0.1:" + addr.port;
  const realFetch = globalThis.fetch;
  const previousToken = process.env.CALENDLY_PAT;
  t.after(async () => {
    globalThis.fetch = realFetch;
    if (previousToken === undefined) delete process.env.CALENDLY_PAT;
    else process.env.CALENDLY_PAT = previousToken;
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  delete process.env.CALENDLY_PAT;
  const missing = await realFetch(base + "/test-chat/calendly-readiness");
  assert.equal(missing.status, 200);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  const absent = await missing.json() as Record<string, any>;
  assert.equal(absent.status, "credentials_missing");
  assert.deepEqual(absent.slots, []);
  assert.match(absent.bookingUrl, /^https:\/\/calendly\.com\//);

  process.env.CALENDLY_PAT = "synthetic-token-never-sent-over-network";
  const upstreamCalls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith(base)) return realFetch(input, init);
    assert.ok(url.startsWith("https://api.calendly.com/"), "only Calendly provider host");
    assert.equal(init?.method, "GET", "no booking/send calls");
    upstreamCalls.push(url);
    const body: unknown = url.endsWith("/users/me")
      ? { resource: { uri: "https://api.calendly.com/users/synthetic" } }
      : url.includes("/event_types?")
        ? { collection: [{ uri: "https://api.calendly.com/event_types/synthetic",
            scheduling_url: "https://calendly.com/eltern-fitundvital/strategiegespraech",
            slug: "strategiegespraech" }] }
        : url.includes("/event_type_available_times?")
          ? { collection: [
              { start_time: "2026-10-30T17:00:00Z", status: "available" },
              { start_time: "2026-11-06T18:00:00Z", status: "available" },
            ] }
          : null;
    if (!body) throw Error("unknown Calendly fixture route " + url);
    return new Response(JSON.stringify(body), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  const response = await realFetch(base + "/test-chat/calendly-readiness");
  const data = await response.json() as Record<string, any>;
  assert.equal(response.status, 200);
  assert.equal(data.status, "verified_slots");
  assert.equal(data.source, "calendly_api");
  assert.equal(data.slots.length, 2);
  assert.equal(data.slots[0].label, "Freitag, 30.10.2026 um 18:00");
  assert.equal(data.slots[1].label, "Freitag, 06.11.2026 um 19:00");
  assert.ok(upstreamCalls.some(call => call.includes("event_type_available_times")));

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(base)) return realFetch(input, init);
    throw Error("Calendly mocked outage");
  };
  const failed = await realFetch(base + "/test-chat/calendly-readiness");
  assert.equal(failed.status, 200);
  const blocked = await failed.json() as Record<string, any>;
  assert.equal(blocked.status, "provider_unavailable");
  assert.deepEqual(blocked.slots, []);
});
