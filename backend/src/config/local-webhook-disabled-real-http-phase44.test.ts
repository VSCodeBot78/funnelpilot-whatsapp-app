import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * Phase 44: inspect the REAL Express routes under the launcher's safe
 * development flags, not fake 404 responses from a mock backend.
 * No external traffic: bind an ephemeral 127.0.0.1 port and use a private
 * temporary DATA_DIR. Do not load or modify a real user's .env or leads.
 */
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "funnelpilot-phase44-"));
const requiredEnvironment: Record<string, string> = {
  NODE_ENV: "development",
  DATA_DIR: testDataDir,
  FUNNELPILOT_LOCAL_TEST_MODE: "true",
  INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_SEND_ENABLED: "false",
  INSTAGRAM_ALLOWED_SENDER_IDS: " ",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false",
  INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  WHATSAPP_SEND_ENABLED: "false",
  WHATSAPP_ALLOWED_RECIPIENT_IDS: " ",
  WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
  ENABLE_GENERIC_WEBHOOKS: "false",
  DISABLE_DESTRUCTIVE_ROUTES: "true",
  CORS_ORIGIN: "http://127.0.0.1:5173",
};
for (const [name, value] of Object.entries(requiredEnvironment)) {
  process.env[name] = value;
}
// Env must be established BEFORE loading app/router imports.
const { default: app } = await import("../app.js");

test("Local safe-mode rejects all generic payment, booking and message webhooks with real HTTP 404", async t => {
  const server = http.createServer(app);
  const base = await new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("invalid local test bind"));
        return;
      }
      resolve("http://127.0.0.1:" + address.port);
    });
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  const health = await fetch(base + "/health/readiness");
  assert.equal(health.status, 200);
  const readiness = await health.json();
  assert.equal(readiness.nodeEnv, "development");
  assert.equal(readiness.localLaptopSafeMode, true);
  assert.equal(readiness.genericWebhooksEnabled, false);
  assert.equal(readiness.whatsappAllowedRecipientCount, 0);
  assert.equal(readiness.instagramAllowedSenderCount, 0);
  assert.equal(readiness.instagramSendEnabled, false);
  assert.equal(readiness.whatsappSendEnabled, false);

  const endpoints = [
    ["/webhook/checkout", "generic_webhook_disabled"],
    ["/webhook/message", "generic_webhook_disabled"],
    ["/webhook/messages/incoming", "generic_webhook_disabled"],
    ["/webhook/calendly", "generic_webhook_disabled"],
    ["/webhook", "generic_webhook_disabled"],
    ["/booking-events/provider", "provider_webhook_disabled"],
  ] as const;
  for (const [route, expectedError] of endpoints) {
    const response = await fetch(base + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 404, route + " must be disabled BEFORE payload validation");
    const body = await response.json();
    assert.equal(body.ok, false, route);
    assert.equal(body.error, expectedError, route);
  }

  // An otherwise valid-looking checkout must not create a fake paid record.
  const forgedCheckout = await fetch(base + "/webhook/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      leadId: "synthetic_phase44_never_paid",
      campaignId: "eltern-vital-fit",
      event: "checkout.completed",
      paymentStatus: "paid",
    }),
  });
  assert.equal(forgedCheckout.status, 404);
  assert.equal((await forgedCheckout.json()).error, "generic_webhook_disabled");
  assert.equal(fs.existsSync(path.join(testDataDir, "conversations.json")), false,
    "Blocked checkout must not persist conversations");

  const booked = await fetch(base + "/booking-events");
  assert.equal(booked.status, 200);
  assert.deepEqual((await booked.json()).events, []);
});
