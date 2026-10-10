import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getLocalRuntimeDiagnostics, getExternalDiagnosticLimits } from "./systemDiagnostics.js";

const safe = {
  ok: true, service: "funnel-pilot-backend", status: "ready",
  nodeEnv: "development",
  instagramSendEnabled: false, whatsappSendEnabled: false,
  instagramEngineEnabled: false, instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false, instagramAllowedSenderCount: 0,
  destructiveRoutesDisabled: true, genericWebhooksEnabled: false,
};

test("all strict local flags can be green without claiming relay or Meta was tested", () => {
  const diagnosis = getLocalRuntimeDiagnostics(safe);
  assert.equal(diagnosis.state, "safe");
  assert.equal(diagnosis.localFlagsSafe, true);
  assert.ok(diagnosis.checks.every(check => check.status === "ok"));
  assert.equal(diagnosis.relayVerified, false);
  assert.equal(diagnosis.realMetaDeliveryVerified, false);
  assert.match(diagnosis.explanation, /Relay.*NICHT geprüft/i);
  assert.ok(getExternalDiagnosticLimits().some(check => check.id === "relay"));
  assert.ok(getExternalDiagnosticLimits().some(check => check.id === "providers"));
});

test("every unsafe local flag blocks readiness with actionable next step", () => {
  for (const [key, unsafe] of [
    ["nodeEnv", "production"],
    ["instagramSendEnabled", true],
    ["whatsappSendEnabled", true],
    ["instagramEngineEnabled", true],
    ["instagramAllowAllSenders", true],
    ["instagramAutoEnableNewLeads", true],
    ["instagramAllowedSenderCount", 2],
    ["destructiveRoutesDisabled", false],
    ["genericWebhooksEnabled", true],
  ]) {
    const state = getLocalRuntimeDiagnostics({ ...safe, [key]: unsafe });
    assert.equal(state.localFlagsSafe, false, key);
    assert.equal(state.state, "blocked", key);
    assert.ok(state.checks.some(check => check.status === "blocked" &&
      check.nextStep.length > 25 && check.detail.includes(key)), key);
  }
});

test("missing fields are NEVER silently assumed safe", () => {
  for (const key of [
    "nodeEnv", "instagramSendEnabled", "whatsappSendEnabled",
    "instagramEngineEnabled", "instagramAllowAllSenders",
    "instagramAutoEnableNewLeads", "instagramAllowedSenderCount",
    "destructiveRoutesDisabled", "genericWebhooksEnabled",
  ]) {
    const copy = { ...safe };
    delete copy[key];
    const state = getLocalRuntimeDiagnostics(copy);
    assert.equal(state.localFlagsSafe, false, key);
    assert.equal(state.state, "unknown", key);
    assert.ok(state.checks.some(check => check.status === "unknown" &&
      check.detail.includes(key)), key);
  }
});

test("unknown or spoofed service and missing backend remain unverified", () => {
  for (const value of [
    null, undefined, {}, { ...safe, ok: false },
    { ...safe, service: "unrelated-service" },
    { ...safe, status: "starting" },
  ]) {
    const state = getLocalRuntimeDiagnostics(value);
    assert.equal(state.state, "unknown");
    assert.equal(state.localFlagsSafe, false);
    assert.equal(state.relayVerified, false);
    assert.equal(state.realMetaDeliveryVerified, false);
    assert.match(state.checks[0].nextStep, /Backend|Server|prüfen/i);
  }
});

test("dashboard diagnostic UI uses GET-only checks, supports manual retry and warns of unverified relay", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const panel = fs.readFileSync(path.join(here, "SystemStatusPanel.jsx"), "utf8");
  const home = fs.readFileSync(path.join(here, "../dashboard/DashboardHome.jsx"), "utf8");
  const parent = fs.readFileSync(path.join(here, "../App.dashboard.jsx"), "utf8");
  const backend = fs.readFileSync(path.join(here, "../../../backend/src/app.ts"), "utf8");
  assert.match(panel, /fetch\(buildApiUrl\("\/health\/readiness"/);
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /Erneut prüfen/);
  assert.match(panel, /getExternalDiagnosticLimits/);
  assert.doesNotMatch(panel, /method: "POST"|method: "PUT"|method: "DELETE"/);
  assert.doesNotMatch(panel, /cloudflared|localStorage|sendManualMessage/);
  assert.match(home, /<SystemStatusPanel/);
  assert.match(parent, /apiBaseUrl=\{settings.apiBaseUrl\}/);
  assert.match(backend, /genericWebhooksEnabled: env.ENABLE_GENERIC_WEBHOOKS/);
});
