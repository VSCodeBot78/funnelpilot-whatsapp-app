// These are configuration indicators, NOT evidence that Meta accepted a DM.
// Keep "configured" separate from "verified by a live test".
export function getOnboardingReadiness(readiness) {
  if (!readiness || readiness.ok !== true) {
    return {
      backendReachable: false,
      sendLocked: null,
      instagramConfigured: false,
      whatsappConfigured: false,
      aiKeyConfigured: false,
      liveMetaVerified: false,
    };
  }

  return {
    backendReachable: true,
    sendLocked:
      readiness.instagramSendEnabled === false &&
      readiness.whatsappSendEnabled === false,
    instagramConfigured: Boolean(
      readiness.instagramVerifyTokenConfigured &&
      readiness.instagramAppSecretConfigured &&
      readiness.instagramSendConfigured
    ),
    whatsappConfigured: Boolean(
      readiness.metaVerifyTokenConfigured &&
      readiness.metaSendConfigured
    ),
    aiKeyConfigured: Boolean(readiness.openAiApiKeyConfigured),
    // Credentials, enabled flags and signed webhook unit tests do not
    // confirm a real Instagram/WhatsApp delivery through Meta.
    liveMetaVerified: false,
  };
}

export const ONBOARDING_LABELS = [
  "Workspace",
  "Pete",
  "Kanäle & Sicherheit",
  "Gesamtablauf testen",
];
