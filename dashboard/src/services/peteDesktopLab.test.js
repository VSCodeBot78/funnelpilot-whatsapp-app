import assert from "node:assert/strict";
import test from "node:test";
import { createPeteDesktopClient, desktopBlockReason, formatDesktopUsd } from "./peteDesktopLab.js";

test("opening a desktop client only bootstraps a session, reads status and creates free synthetic leads", async () => {
  const calls = [];
  const client = createPeteDesktopClient(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => url.endsWith("session")
      ? { ok: true, csrfToken: "a".repeat(64) } : { ok: true } };
  });
  await Promise.all([client.status(), client.newLead()]);
  await client.state("lab_desktop_synthetic_unit_test");
  assert.equal(calls.filter(c => c.url.endsWith("session")).length, 1);
  // The real browser omits Origin on GET; readonly POST retains it and the
  // backend enforces the same strict cookie, CSRF and Origin checks.
  for (const route of ["status", "state/lab_desktop_synthetic_unit_test"]) {
    const req = calls.find(c => c.url.endsWith("/" + route));
    assert.ok(req);
    assert.equal(req.init.method, "POST");
    assert.equal(req.init.body, "{}");
  }
  assert.ok(calls.every(c => c.url.startsWith("/test-chat/desktop/")));
  assert.ok(calls.every(c => c.init.credentials === "same-origin"));
  assert.ok(calls.filter(c => !c.url.endsWith("session"))
    .every(c => c.init.headers["X-Pete-CSRF"] === "a".repeat(64)));
  assert.ok(!calls.some(c => /budget|message/.test(c.url)));
  await client.setBudget(true, "0.50");
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { enabled: true, budgetUsd: "0.50" });
  await client.setBudget(false);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { enabled: false });

});

test("a rejected session never attempts a paid request", async () => {
  const calls = [];
  const client = createPeteDesktopClient(async (url) => {
    calls.push(url); return { ok: false, json: async () => ({ ok: false }) };
  });
  await assert.rejects(client.setBudget(true, "2.00"));
  assert.deepEqual(calls, ["/test-chat/desktop/session"]);
});

test("owner may enable a small local allowance without historical consent, but broken ledgers block", () => {
  assert.equal(desktopBlockReason({ budget: { ok: true, historyVerified: false,
    blockReason: null }, providerConfigured: true }), null);
  assert.equal(desktopBlockReason({ budget: { ok: false } }), "Budget-Ledger oder lokaler Sicherheitsmodus nicht verfügbar. KI gesperrt.");
  assert.match(desktopBlockReason({ budget: { ok: true,
    blockReason: "accounting_review_required" }, providerConfigured: true }), /gesperrt/);
  assert.match(desktopBlockReason({ budget: { ok: true }, providerConfigured: false }), /fehlen/);
  assert.equal(desktopBlockReason({ budget: { ok: true,
    blockReason: "desktop_budget_exhausted" }, providerConfigured: true }), null,
    "owner may deliberately raise the total authorized limit");
  assert.equal(formatDesktopUsd(null), "Nicht belegt");
  assert.equal(formatDesktopUsd(undefined), "Nicht belegt");
  assert.equal(formatDesktopUsd(0.2496), "0.249600 USD");
});
