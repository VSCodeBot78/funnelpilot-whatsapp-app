import assert from "node:assert/strict";
import test from "node:test";
import { runOwnerInstagramReceivePreflight } from "./owner-instagram-receive-preflight.mjs";

const ready = {
  ok: true, service: "funnel-pilot-backend", status: "ready",
  nodeEnv: "development", localLaptopSafeMode: true,
  instagramSendEnabled: false, instagramEngineEnabled: false,
  instagramAllowedSenderCount: 0, instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false, whatsappSendEnabled: false,
  whatsappAllowedRecipientCount: 0, whatsappAllowAllRecipients: false,
  genericWebhooksEnabled: false, destructiveRoutesDisabled: true,
  instagramVerifyTokenConfigured: true, instagramAppSecretConfigured: true,
};

function fakeNetwork({ readiness = ready, invalidWebhookStatus = 403, adminStatus = 404 } = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      assert.match(url, /^http:\/\/127\.0\.0\.1:300[12]\//);
      assert.equal(options.method, "GET", "must never send a POST or change an API");
      assert.equal(options.redirect, "error");
      calls.push(url);
      if (url === "http://127.0.0.1:3001/health/readiness") {
        return new Response(JSON.stringify(readiness), { status: 200 });
      }
      if (url === "http://127.0.0.1:3002/webhooks/meta/instagram") {
        return new Response("ignored", { status: invalidWebhookStatus });
      }
      return new Response("not found", { status: adminStatus });
    },
  };
}

test("owner Beta preflight permits only locally safe NoSend + configured HMAC, never declares Meta live", async () => {
  const network = fakeNetwork();
  const result = await runOwnerInstagramReceivePreflight(network);
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 9);
  assert.equal(network.calls.length, 6);
  assert.equal(result.unverifiedExternal.length, 5);
  assert.match(result.unverifiedExternal.join(" "), /Datenschutz/);
  assert.match(result.unverifiedExternal.join(" "), /Owner-GO/);
});

test("preflight fail closed when the running laptop has no real Meta secrets", async () => {
  const network = fakeNetwork({ readiness: {
    ...ready, instagramVerifyTokenConfigured: false, instagramAppSecretConfigured: false,
  }, invalidWebhookStatus: 500 });
  const result = await runOwnerInstagramReceivePreflight(network);
  assert.equal(result.passed, false);
  assert.equal(result.checks.filter(c => !c.passed).length, 3);
  assert.ok(result.checks.some(c => c.label.includes("Verify-Token") && !c.passed));
  assert.ok(result.checks.some(c => c.label.includes("App-Secret") && !c.passed));
});

test("preflight blocks unsafe sender allow-all, engine, send, and exposed admin routes", async () => {
  for (const patch of [
    { instagramSendEnabled: true },
    { instagramEngineEnabled: true },
    { instagramAllowedSenderCount: 1 },
    { instagramAllowAllSenders: true },
    { destructiveRoutesDisabled: false },
  ]) {
    const status = await runOwnerInstagramReceivePreflight(
      fakeNetwork({ readiness: { ...ready, ...patch } }),
    );
    assert.equal(status.passed, false, JSON.stringify(patch));
    assert.ok(status.checks.some(c => c.label === "NoSend-Sicherheitsprofil" && !c.passed));
  }
  const openAdmin = await runOwnerInstagramReceivePreflight(fakeNetwork({ adminStatus: 200 }));
  assert.equal(openAdmin.passed, false);
  assert.equal(openAdmin.checks.filter(c => !c.passed).length, 4);
});

test("preflight fails if relay cannot be reached or backend crashes", async () => {
  const orig = fakeNetwork().fetchImpl;
  const noRelay = await runOwnerInstagramReceivePreflight({
    fetchImpl: async (url, opts) => {
      if (url.includes(":3002/")) throw new Error("offline");
      return orig(url, opts);
    },
  });
  assert.equal(noRelay.passed, false);
  assert.equal(noRelay.checks.filter(x => !x.passed).length, 5);
  const noBackend = await runOwnerInstagramReceivePreflight({
    fetchImpl: async () => { throw new Error("backend down"); },
  });
  assert.equal(noBackend.passed, false);
  assert.ok(noBackend.checks.every(x => !x.passed));
});
