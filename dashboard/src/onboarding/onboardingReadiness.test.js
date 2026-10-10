import assert from "node:assert/strict";
import test from "node:test";
import { getOnboardingReadiness, ONBOARDING_LABELS } from "./onboardingReadiness.js";

test("unreachable backend is never treated as configured or safely locked", () => {
  const state = getOnboardingReadiness(null);
  assert.equal(state.backendReachable, false);
  assert.equal(state.sendLocked, null);
  assert.equal(state.instagramConfigured, false);
  assert.equal(state.whatsappConfigured, false);
  assert.equal(state.aiKeyConfigured, false);
  assert.equal(state.liveMetaVerified, false);
});

test("configured credentials are never a live Meta verification", () => {
  const state = getOnboardingReadiness({
    ok: true,
    instagramVerifyTokenConfigured: true,
    instagramAppSecretConfigured: true,
    instagramSendConfigured: true,
    metaVerifyTokenConfigured: true,
    metaSendConfigured: true,
    openAiApiKeyConfigured: true,
    instagramSendEnabled: false,
    whatsappSendEnabled: false,
  });
  assert.equal(state.backendReachable, true);
  assert.equal(state.sendLocked, true);
  assert.equal(state.instagramConfigured, true);
  assert.equal(state.whatsappConfigured, true);
  assert.equal(state.aiKeyConfigured, true);
  assert.equal(state.liveMetaVerified, false);
});

test("missing app secret prevents configured Instagram status", () => {
  const state = getOnboardingReadiness({
    ok: true,
    instagramVerifyTokenConfigured: true,
    instagramAppSecretConfigured: false,
    instagramSendConfigured: true,
    instagramSendEnabled: false,
    whatsappSendEnabled: false,
  });
  assert.equal(state.instagramConfigured, false);
});

test("enabled channel send is flagged as unsafe during initial laptop test", () => {
  const state = getOnboardingReadiness({
    ok: true,
    instagramSendEnabled: true,
    whatsappSendEnabled: false,
  });
  assert.equal(state.sendLocked, false);
});

test("onboarding has four distinct functional stages", () => {
  assert.deepEqual(ONBOARDING_LABELS, [
    "Workspace",
    "Pete",
    "Kanäle & Sicherheit",
    "Gesamtablauf testen",
  ]);
});
