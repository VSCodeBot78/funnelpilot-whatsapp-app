import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createLocalWebhookRelay, isAllowedLocalWebhook } from "./local-webhook-relay.mjs";

function start(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("local webhook relay blocks admin routes and preserves webhook body", async (t) => {
  const received = [];
  const backend = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk.toString("utf8");
    received.push({
      method: req.method,
      path: req.url,
      signature: req.headers["x-hub-signature-256"],
      raw,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ received: true }));
  });
  const backendPort = await start(backend);
  const relay = createLocalWebhookRelay({ backendPort });
  const relayPort = await start(relay);
  t.after(async () => {
    await close(relay);
    await close(backend);
  });
  const base = `http://127.0.0.1:${relayPort}`;

  for (const [method, route] of [
    ["GET", "/health"],
    ["GET", "/health/readiness"],
    ["GET", "/leads"],
    ["POST", "/conversations/fit/lead/takeover"],
    ["POST", "/settings-config/reset"],
    ["GET", "/test-chat"],
    ["GET", "/webhooks/meta/instagram/../admin"],
    ["POST", "/webhooks/meta/instagram%2f..%2fconversations"],
    ["DELETE", "/webhooks/meta/instagram"],
    ["GET", "//localhost/webhooks/meta/instagram"],
  ]) {
    const response = await fetch(base + route, { method });
    assert.equal(response.status, 404, `${method} ${route} must be denied`);
  }
  assert.equal(received.length, 0, "no blocked request reaches backend");

  const verification = await fetch(
    base + "/webhooks/meta/instagram?hub.mode=subscribe&hub.challenge=safe",
  );
  assert.equal(verification.status, 200);
  assert.equal(received[0].path, "/webhooks/meta/instagram?hub.mode=subscribe&hub.challenge=safe");

  const body = JSON.stringify({
    object: "instagram",
    entry: [{ changes: [{ field: "messages", value: { text: "ä😊" } }] }],
  });
  const signature = "sha256=test-signature";
  const incoming = await fetch(base + "/webhooks/meta/instagram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature,
    },
    body,
  });
  assert.equal(incoming.status, 200);
  assert.deepEqual(received[1], {
    method: "POST",
    path: "/webhooks/meta/instagram",
    signature,
    raw: body,
  });

  const whatsapp = await fetch(base + "/webhooks/meta/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body,
  });
  assert.equal(whatsapp.status, 200);
  assert.equal(received[2].raw, body);
  assert.equal(received[2].signature, signature);
});

test("relay rejects origin-changing and unsupported paths", () => {
  assert.equal(isAllowedLocalWebhook("GET", "//evil.test/webhooks/meta/instagram"), false);
  assert.equal(isAllowedLocalWebhook("POST", "/webhooks/meta/instagram"), true);
  assert.equal(isAllowedLocalWebhook("GET", "/webhooks/meta/whatsapp"), true);
  assert.equal(isAllowedLocalWebhook("PUT", "/webhooks/meta/instagram"), false);
  assert.equal(isAllowedLocalWebhook("POST", "/webhooks/meta/instagram/"), false);
});

test("Calendly callback is opt-in, POST-only, and never exposes admin routes", async (t) => {
  const requests = [];
  const backend = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk.toString("utf8");
    requests.push({ path: req.url, signature: req.headers["calendly-webhook-signature"], raw });
    res.writeHead(202, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  const backendPort = await start(backend);
  const relay = createLocalWebhookRelay({ backendPort, allowCalendly: true });
  const port = await start(relay);
  t.after(async () => { await close(relay); await close(backend); });

  assert.equal(isAllowedLocalWebhook("POST", "/booking-events/calendly"), false);
  assert.equal(isAllowedLocalWebhook("POST", "/booking-events/calendly", { allowCalendly: true }), true);
  assert.equal(isAllowedLocalWebhook("GET", "/booking-events/calendly", { allowCalendly: true }), false);
  const base = "http://127.0.0.1:" + port;

  const denyGet = await fetch(base + "/booking-events/calendly");
  assert.equal(denyGet.status, 404);
  const denyAdmin = await fetch(base + "/booking-events");
  assert.equal(denyAdmin.status, 404);
  const denyGeneric = await fetch(base + "/booking-events/provider", {
    method: "POST", body: "{}",
  });
  assert.equal(denyGeneric.status, 404);
  const raw = '{"event":"invitee.created","payload":{"event":{"start_time":"2026-10-21T17:00:00Z"}}}';
  const signature = "t=1792602000,v1=" + "a".repeat(64);
  const allowed = await fetch(base + "/booking-events/calendly", {
    method: "POST",
    headers: { "calendly-webhook-signature": signature },
    body: raw,
  });
  assert.equal(allowed.status, 202);
  assert.deepEqual(requests, [{ path: "/booking-events/calendly", signature, raw }]);
});
