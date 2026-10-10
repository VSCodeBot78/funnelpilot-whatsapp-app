import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { createProductionAdminGuard, isProductionPublicCallback, isValidAdminIngressSecret } from "../services/production-admin-guard.js";

const key = "funnelpilot-internal-gateway-" + "x".repeat(40);
function start(server: http.Server): Promise<{ base: string; close(): Promise<void> }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const a = server.address();
      if (!a || typeof a === "string") throw new Error("invalid address");
      resolve({ base: "http://127.0.0.1:" + a.port, close: () =>
        new Promise<void>((ok, fail) => server.close(e => e ? fail(e) : ok())) });
    });
  });
}

test("Only expected signature-checked production callbacks remain public", () => {
  for (const [verb, route] of [
    ["GET", "/health"], ["GET", "/webhooks/meta/instagram"],
    ["POST", "/webhooks/meta/instagram"], ["GET", "/webhooks/meta/whatsapp/"],
    ["POST", "/webhooks/meta/whatsapp"], ["POST", "/booking-events/calendly"],
    ["GET", "/integrations/oauth/google_calendar/callback"],
    ["GET", "/integrations/oauth/calendly/callback"],
    ["GET", "/integrations/oauth/hubspot/callback"],
  ]) assert.equal(isProductionPublicCallback(verb, route), true, verb + " " + route);
  for (const [verb, route] of [
    ["GET", "/leads"], ["GET", "/conversations"], ["GET", "/health/readiness"],
    ["GET", "/settings-config"], ["POST", "/settings-config"],
    ["POST", "/conversations/a/b/takeover"],
    ["POST", "/conversations/a/b/human-message"],
    ["POST", "/conversations/a/b/release"], ["POST", "/ghosting/send-due"],
    ["GET", "/integrations/oauth/status"],
    ["GET", "/integrations/oauth/hubspot/start"],
    ["POST", "/integrations/oauth/hubspot/disconnect"],
    ["GET", "/booking-events"], ["POST", "/booking-events/provider"],
    ["GET", "/webhooks/meta/instagram/../leads"],
    ["POST", "/webhook/checkout"],
    ["GET", "/integrations/oauth/calendly/callback/forged"],
  ]) assert.equal(isProductionPublicCallback(verb, route), false, verb + " " + route);
});

test("Admin gateway shared secret uses exact-length constant-time check", () => {
  assert.equal(isValidAdminIngressSecret(key, key), true);
  assert.equal(isValidAdminIngressSecret(key.slice(0, -1), key), false);
  assert.equal(isValidAdminIngressSecret("a".repeat(70), key), false);
  assert.equal(isValidAdminIngressSecret(undefined, key), false);
  assert.equal(isValidAdminIngressSecret(key, "short"), false);
});

test("Production gate blocks all admin HTTP traffic without reverse proxy authentication", async t => {
  const app = express();
  app.use(createProductionAdminGuard({ nodeEnv: "production", adminSecret: key }));
  app.use((req, res) => res.json({ ok: true, accessed: req.path }));
  const server = await start(http.createServer(app));
  t.after(server.close);

  for (const route of ["/leads", "/health/readiness", "/integrations/oauth/status",
    "/conversations", "/settings-config"]) {
    const blocked = await fetch(server.base + route);
    assert.equal(blocked.status, 403, route);
    assert.equal((await blocked.json()).error, "admin_gateway_required");
    const passed = await fetch(server.base + route, {
      headers: { "x-funnelpilot-admin-ingress": key },
    });
    assert.equal(passed.status, 200, route);
  }
  const wrong = await fetch(server.base + "/leads", {
    headers: { "x-funnelpilot-admin-ingress": "not-the-secret" },
  });
  assert.equal(wrong.status, 403);
  for (const route of ["/health", "/webhooks/meta/instagram",
    "/integrations/oauth/hubspot/callback"]) {
    assert.equal((await fetch(server.base + route)).status, 200, route);
  }
  assert.equal((await fetch(server.base + "/booking-events/calendly",
    { method: "POST" })).status, 200);

  const otherApp = express();
  otherApp.use(createProductionAdminGuard({ nodeEnv: "production", adminSecret: "" }));
  otherApp.use((_req, res) => res.json({ ok: true }));
  const missing = await start(http.createServer(otherApp));
  t.after(missing.close);
  const noSecret = await fetch(missing.base + "/leads",
    { headers: { "x-funnelpilot-admin-ingress": key } });
  assert.equal(noSecret.status, 503);
  assert.equal((await noSecret.json()).error, "production_admin_ingress_not_configured");
});

test("Non-production local testing remains unchanged", async t => {
  const app = express();
  app.use(createProductionAdminGuard({ nodeEnv: "test", adminSecret: "" }));
  app.get("/leads", (_req, res) => res.json({ ok: true }));
  const server = await start(http.createServer(app));
  t.after(server.close);
  assert.equal((await fetch(server.base + "/leads")).status, 200);
});
