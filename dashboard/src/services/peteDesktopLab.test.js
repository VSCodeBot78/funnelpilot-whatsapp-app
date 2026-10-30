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
  assert.ok(!calls.some(c => /budget|message/.test(c.url)));
  await client.setBudget(true, "0.25");
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { enabled: true, budgetUsd: "0.25" });
  await client.setBudget(false);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { enabled: false });
  await client.setBudget(true, "0.25", true);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body),
    { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true });
  await client.setBudget(false, undefined, true);
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
  assert.match(desktopBlockReason({ budget: { ok: true, historyVerified: true }, providerConfigured: false }), /fehlen/);
  assert.equal(desktopBlockReason({ budget: { ok: true, historyVerified: true }, providerConfigured: true }), null);
  const eligible = { budget: { ok: true, historyVerified: false,
    ownerManagedCosts: false, ownerManagedApprovalAvailable: true }, providerConfigured: true };
  assert.match(desktopBlockReason(eligible), /Eigenverantwortung/);
  assert.equal(desktopBlockReason(eligible, true), null);
  assert.match(desktopBlockReason({ ...eligible, budget: { ...eligible.budget,
    ownerManagedApprovalAvailable: false } }, true), /Eigenverantwortung/);
  assert.equal(desktopBlockReason({ ...eligible, budget: { ...eligible.budget,
    ownerManagedCosts: true } }), null);
  assert.equal(formatDesktopUsd(null), "Nicht belegt");
  assert.equal(formatDesktopUsd(undefined), "Nicht belegt");
  assert.equal(formatDesktopUsd(0.2496), "0.249600 USD");
});
