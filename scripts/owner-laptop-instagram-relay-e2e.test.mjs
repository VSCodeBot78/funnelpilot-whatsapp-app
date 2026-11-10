// Owner-laptop Instagram webhook smoke: ISOLATED, SYNTHETIC, NO REAL META.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-laptop-ig-relay-"));
const mockToken = "SYNTHETIC_OWNER_VERIFY_DO_NOT_USE";
const mockSecret = "SYNTHETIC_OWNER_HMAC_DO_NOT_USE";
Object.assign(process.env, {
  NODE_ENV: "development", DATA_DIR: dataDir,
  FUNNELPILOT_LOCAL_TEST_MODE: "true",
  DISABLE_DESTRUCTIVE_ROUTES: "true",
  ENABLE_GENERIC_WEBHOOKS: "false",
  INSTAGRAM_VERIFY_TOKEN: mockToken,
  INSTAGRAM_APP_SECRET: mockSecret,
  INSTAGRAM_ACCOUNT_ID: "SYNTHETIC_ACCOUNT_NOT_REAL",
  INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_SEND_ENABLED: "false",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false",
  INSTAGRAM_ALLOWED_SENDER_IDS: "",
  INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  WHATSAPP_SEND_ENABLED: "false",
  WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
  WHATSAPP_ALLOWED_RECIPIENT_IDS: "",
  PETE_LLM_API_CALLS_APPROVED: "false",
});
const { default: app } = await import("../backend/src/app.ts");
const { createLocalWebhookRelay } = await import("./local-webhook-relay.mjs");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}
function close(server) {
  return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}

test("owner-laptop relay: valid mock Meta GET challenge + HMAC, invalid and admin paths blocked, NoSend", async t => {
  const backend = http.createServer(app);
  const backendPort = await listen(backend);
  const relay = createLocalWebhookRelay({ backendPort, requireSafeLaptopMode: true });
  const relayPort = await listen(relay);
  const base = "http://127.0.0.1:" + relayPort;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "127.0.0.1", "NO_EXTERNAL_NETWORK");
    return originalFetch(input, init);
  });
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await close(relay);
    await close(backend);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const safe = await originalFetch("http://127.0.0.1:" + backendPort + "/health/readiness");
  assert.equal(safe.status, 200);
  const readiness = await safe.json();
  assert.equal(readiness.localLaptopSafeMode, true);
  assert.equal(readiness.instagramEngineEnabled, false);
  assert.equal(readiness.instagramSendEnabled, false);
  assert.equal(readiness.peteLlmCostGateApproved, false);
  assert.equal(readiness.instagramVerifyTokenConfigured, true);
  assert.equal(readiness.instagramAppSecretConfigured, true);

  for (const denied of ["/health/readiness", "/leads", "/test-chat", "/api/settings"]) {
    assert.equal((await fetch(base + denied)).status, 404, "admin path must be closed: " + denied);
  }
  const good = await fetch(base + "/webhooks/meta/instagram?" +
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": mockToken, "hub.challenge": "mock-challenge-42" }));
  assert.equal(good.status, 200);
  assert.equal(await good.text(), "mock-challenge-42");
  const bad = await fetch(base + "/webhooks/meta/instagram?" +
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "wrong-token", "hub.challenge": "fake" }));
  assert.equal(bad.status, 403);

  const payload = JSON.stringify({
    object: "instagram", entry: [{
      id: "SYNTHETIC_ACCOUNT_NOT_REAL",
      messaging: [{
        sender: { id: "SYNTHETIC_IG_TEST_CONTACT" },
        recipient: { id: "SYNTHETIC_ACCOUNT_NOT_REAL" },
        timestamp: Date.now(),
        message: { mid: "SYNTHETIC_MESSAGE_ID_001", text: "CHECK" },
      }],
    }],
  });
  const forged = await fetch(base + "/webhooks/meta/instagram", {
    method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=forged" },
    body: payload,
  });
  assert.equal(forged.status, 401, "bad HMAC must be denied");
  const signature = "sha256=" + crypto.createHmac("sha256", mockSecret)
    .update(Buffer.from(payload, "utf8")).digest("hex");
  const accepted = await fetch(base + "/webhooks/meta/instagram", {
    method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body: payload,
  });
  const result = await accepted.json();
  assert.equal(accepted.status, 200, JSON.stringify(result));
  assert.equal(result.sent, false, "NO SEND even with a verified synthetic inbound");
  assert.equal(readiness.instagramEngineEnabled, false);
  assert.equal(readiness.instagramSendEnabled, false);
  const directPaths = fs.readdirSync(dataDir);
  assert.ok(directPaths.every(name => !name.includes("real-contact")), "mock data only");
});
