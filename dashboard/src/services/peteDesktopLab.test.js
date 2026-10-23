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
  assert.equal(calls.filter(c => c.url.endsWith("session")).length, 1);
  assert.ok(calls.every(c => c.url.startsWith("/test-chat/desktop/")));
  assert.ok(calls.every(c => c.init.credentials === "same-origin"));
  assert.ok(calls.filter(c => !c.url.endsWith("session"))
    .every(c => c.init.headers["X-Pete-CSRF"] === "a".repeat(64)));
  // Read-only status/state use POST because browsers do not attach Origin to
  // same-origin GET. They still require the normal guarded session and CSRF.
  assert.equal(calls.find(c => c.url.endsWith("/status")).init.method, "POST");
  await client.state("lab_desktop_test");
  assert.equal(calls.at(-1).init.method, "POST");
  assert.equal(calls.at(-1).init.body, "{}");
  assert.equal(calls.at(-1).url, "/test-chat/desktop/state/lab_desktop_test");
  assert.ok(!calls.some(c => /budget|message/.test(c.url)));
  await client.setBudget(true, "0.25");
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true });
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

test("uncertain historical costs stay blocked and are never formatted as free credit", () => {
  assert.match(desktopBlockReason({ budget: { ok: true, historyVerified: false }, providerConfigured: true }), /Ausgaben/);
  assert.match(desktopBlockReason({ budget: { ok: false } }), /gesperrt/);
  assert.match(desktopBlockReason({ budget: { ok: true, historyVerified: true }, providerConfigured: false }), /fehlt OPENAI_API_KEY/);
  assert.equal(desktopBlockReason({ budget: { ok: true, historyVerified: true }, providerConfigured: true }), null);
  assert.equal(formatDesktopUsd(null), "Nicht belegt");
  assert.equal(formatDesktopUsd(undefined), "Nicht belegt");
  assert.equal(formatDesktopUsd(0.2496), "0.249600 USD");
});

test("explicit owner-managed local authorization does not claim verified history or bypass other blockers", () => {
  const status = { budget: { ok: true, historyVerified: false, ownerManagedApprovalAvailable: true,
    blockReason: "historical_spend_unverified" }, providerConfigured: true };
  assert.equal(desktopBlockReason(status), null);
  assert.equal(desktopBlockReason({ ...status, budget: { ...status.budget,
    ownerManagedApprovalAvailable: false, ownerManagedCosts: true, blockReason: null } }), null);
  assert.match(desktopBlockReason({ ...status, providerConfigured: false }), /fehlt OPENAI_API_KEY/);
  assert.match(desktopBlockReason({ ...status, budget: { ...status.budget,
    blockReason: "accounting_review_required" } }), /gesperrt/);
  assert.match(desktopBlockReason({ ...status, budget: { ...status.budget,
    blockReason: "project_budget_exhausted" } }), /Projektbudgetgrenze/);
});
