import assert from "node:assert/strict";
import test from "node:test";
import { getOnboardingReadiness, getSetupDiagnostics, ONBOARDING_LABELS } from "./onboardingReadiness.js";

const safeLocalFlags = {
  ok: true, service: "funnel-pilot-backend", status: "ready",
  nodeEnv: "development",
  instagramSendEnabled: false, whatsappSendEnabled: false,
  instagramEngineEnabled: false, instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false, instagramAllowedSenderCount: 0,
  destructiveRoutesDisabled: true, genericWebhooksEnabled: false,
};

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

test("setup diagnostics distinguishes safe local tests from unverified external providers", () => {
  const diagnostics = getSetupDiagnostics({
    readiness: {
      ...safeLocalFlags,
      ok: true,
      instagramSendEnabled: false,
      whatsappSendEnabled: false,
      instagramEngineEnabled: false,
      aiBotSettingsConfigured: true,
    },
    integrations: { providers: [
      { provider: "google_calendar", status: "authorized_not_synced" },
      { provider: "calendly", status: "ready_to_connect" },
      { provider: "hubspot", status: "authorized_not_synced" },
    ] },
    settings: {
      companyName: "Neue Coach-Marke",
      adminName: "Test Coach",
      assistantName: "Nora",
      defaultBookingUrl: "https://calendly.com/test-coach/meeting",
    },
  });
  assert.equal(diagnostics.localTestReady, true);
  assert.equal(diagnostics.liveIntegrationVerified, false);
  assert.equal(diagnostics.checks.find(x => x.id === "backend")?.status, "ok");
  assert.equal(diagnostics.checks.find(x => x.id === "calendar")?.status, "pending");
  assert.equal(diagnostics.checks.find(x => x.id === "crm")?.status, "pending");
  assert.equal(diagnostics.checks.find(x => x.id === "meta")?.status, "pending");
  assert.match(diagnostics.checks.find(x => x.id === "booking")?.detail, /echte Testbuchung/i);
});

test("verified read-only OAuth status does not falsely claim live synchronization", () => {
  const checks = getSetupDiagnostics({
    readiness: {
      ...safeLocalFlags,
      ok: true,
      instagramSendEnabled: false,
      whatsappSendEnabled: false,
      instagramEngineEnabled: false,
      aiBotSettingsConfigured: true,
    },
    integrations: { providers: [
      { provider: "google_calendar", status: "api_verified_no_sync" },
      { provider: "hubspot", status: "api_verified_no_sync" },
    ] },
    settings: { companyName: "Coach", adminName: "Admin", assistantName: "Pete" },
  });
  assert.equal(checks.checks.find(x => x.id === "calendar")?.status, "ok");
  assert.equal(checks.checks.find(x => x.id === "crm")?.status, "ok");
  assert.match(checks.checks.find(x => x.id === "calendar")?.detail, /keine aktive Synchronisierung/);
  assert.equal(checks.liveIntegrationVerified, false);
  assert.equal(checks.checks.find(x => x.id === "meta")?.status, "pending");
});

test("unsafe send flags and unavailable backend block local-test readiness", () => {
  const settings = { companyName: "Coach", adminName: "Admin", assistantName: "Pete" };
  const unsafe = getSetupDiagnostics({
    settings,
    readiness: {
      ...safeLocalFlags,
      ok: true,
      instagramEngineEnabled: true,
      instagramSendEnabled: false,
      whatsappSendEnabled: false,
      aiBotSettingsConfigured: true,
    },
  });
  assert.equal(unsafe.localTestReady, false);
  assert.equal(unsafe.checks.find(x => x.id === "send")?.status, "attention");

  const disconnected = getSetupDiagnostics({ settings, readiness: null });
  assert.equal(disconnected.localTestReady, false);
  assert.equal(disconnected.checks.find(x => x.id === "backend")?.status, "attention");
});

test("the setup wizard refuses a green local-test status if advanced safety flags are missing", () => {
  const settings = { companyName: "Coach", adminName: "Admin",
    assistantName: "Pete" };
  const base = { settings, readiness: { ...safeLocalFlags,
    aiBotSettingsConfigured: true } };
  assert.equal(getSetupDiagnostics(base).localTestReady, true);
  const unsafe = getSetupDiagnostics({ settings, readiness: { ...base.readiness,
    instagramAutoEnableNewLeads: true } });
  assert.equal(unsafe.localTestReady, false);
  assert.equal(unsafe.localSafetyState, "blocked");
  const send = unsafe.checks.find(item => item.id === "send");
  assert.equal(send.status, "attention");
  assert.match(send.nextStep, /Auto-Enable|Backend|Allow-all|neu starten/i);
  const unknown = { ...base.readiness };
  delete unknown.genericWebhooksEnabled;
  assert.equal(getSetupDiagnostics({ settings, readiness: unknown }).localTestReady, false);
  assert.equal(getSetupDiagnostics(base).relayVerified, false);
  assert.equal(getSetupDiagnostics(base).liveIntegrationVerified, false);
});
