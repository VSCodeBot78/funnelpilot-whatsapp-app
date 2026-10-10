import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { evaluateSafeReadiness, runLocalSafetyPreflight } from "./local-safety-preflight.mjs";
import { createLocalWebhookRelay } from "./local-webhook-relay.mjs";

const safe = {
  ok: true, service: "funnel-pilot-backend", status: "ready",
  nodeEnv: "development",
  instagramSendEnabled: false, whatsappSendEnabled: false,
  instagramEngineEnabled: false, instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false, instagramAllowedSenderCount: 0,
  destructiveRoutesDisabled: true,
};

test("Local readiness fails closed for every individual safety switch", () => {
  assert.deepEqual(evaluateSafeReadiness(safe), []);
  for (const [key, unsafe] of [
    ["nodeEnv", "production"],
    ["instagramSendEnabled", true], ["whatsappSendEnabled", true],
    ["instagramEngineEnabled", true], ["instagramAllowAllSenders", true],
    ["instagramAutoEnableNewLeads", true], ["instagramAllowedSenderCount", 1],
    ["destructiveRoutesDisabled", false],
  ]) {
    const violations = evaluateSafeReadiness({ ...safe, [key]: unsafe });
    assert.ok(violations.some(error => error.includes(key)), key);
  }
  assert.ok(evaluateSafeReadiness({ ...safe, instagramEngineEnabled: undefined }).length > 0);
  assert.ok(evaluateSafeReadiness({}).length > 0);
  assert.ok(evaluateSafeReadiness(null).length > 0);
});

async function start(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve("http://127.0.0.1:" + server.address().port);
    });
  });
}
async function close(server) {
  return new Promise((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()));
}

test("Safety preflight checks REAL loopback HTTP relay and denies unsafe endpoints", async t => {
  const visited = [];
  const backend = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk.toString("utf8");
    visited.push({ method: req.method, path: req.url, body: raw });
    if (req.url === "/health/readiness" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(safe));
    } else if (req.url === "/webhook/checkout" ||
               req.url === "/booking-events/provider") {
      res.writeHead(404); res.end("Not found");
    } else if (req.url === "/webhooks/meta/instagram") {
      res.writeHead(403); res.end("Invalid verification");
    } else {
      // Deliberately unsafe admin server: if relay forwards even one admin path,
      // it gets HTTP 200 and the preflight MUST fail.
      res.writeHead(200); res.end("Sensitive data here");
    }
  });
  const backendBase = await start(backend);
  const port = Number(new URL(backendBase).port);
  const relay = createLocalWebhookRelay({ backendPort: port });
  const relayBase = await start(relay);
  t.after(async () => { await close(relay); await close(backend); });

  const result = await runLocalSafetyPreflight({ backendBase, relayBase });
  assert.equal(result.passed, true, JSON.stringify(result.checks));
  assert.equal(result.checks.length, 10);
  assert.ok(result.checks.every(item => item.passed));
  assert.deepEqual(
    visited.map(item => [item.method, item.path]).sort(),
    [
      ["GET", "/health/readiness"],
      ["GET", "/webhooks/meta/instagram"],
      ["POST", "/booking-events/provider"],
      ["POST", "/webhook/checkout"],
    ].sort(),
    "none of the six denied relay routes reached backend",
  );
  assert.ok(visited.every(x =>
    x.method !== "POST" || x.body === "{}"));
});

test("Preflight blocks an accidental relay that forwards a control-plane route", async t => {
  const backend = http.createServer((req, res) => {
    if (req.url === "/health/readiness") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(safe));
    } else if (req.url === "/webhook/checkout" ||
               req.url === "/booking-events/provider") {
      res.writeHead(404); res.end();
    } else if (req.url === "/webhooks/meta/instagram") {
      res.writeHead(403); res.end();
    } else {
      res.writeHead(200); res.end();
    }
  });
  const backendBase = await start(backend);
  // Misconfigured relay responds 200 on one sensitive path.
  const relay = http.createServer((req, res) => {
    res.writeHead(req.url === "/leads" ? 200 :
      req.url === "/webhooks/meta/instagram" ? 403 : 404);
    res.end();
  });
  const relayBase = await start(relay);
  t.after(async () => { await close(relay); await close(backend); });

  const result = await runLocalSafetyPreflight({ backendBase, relayBase });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some(x => !x.passed && x.label.includes("Lead-Daten")));
});

test("Preflight blocks a missing relay or insecure backend readiness", async t => {
  const backend = http.createServer((req, res) => {
    if (req.url === "/health/readiness") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...safe, instagramSendEnabled: true }));
    } else {
      res.writeHead(404); res.end();
    }
  });
  const backendBase = await start(backend);
  t.after(async () => { await close(backend); });
  const result = await runLocalSafetyPreflight({
    backendBase, relayBase: "http://127.0.0.1:1",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some(x => !x.passed &&
    x.detail?.includes("instagramSendEnabled")));
  assert.ok(result.checks.some(x => !x.passed &&
    x.label.includes("Relay")));
});
