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


// Local preflight is separate from proof that external providers really work.
// Never derive "live" solely from configured credentials or OAuth authorization.
export function getSetupDiagnostics({ readiness, integrations, settings = {} } = {}) {
  const backend = readiness?.ok === true;
  const sendsOff = backend &&
    readiness.instagramSendEnabled === false &&
    readiness.whatsappSendEnabled === false &&
    readiness.instagramEngineEnabled === false;
  const companyReady = Boolean(
    String(settings.companyName ?? "").trim() &&
    String(settings.adminName ?? "").trim() &&
    String(settings.assistantName ?? "").trim()
  );
  const aiReady = backend && readiness.aiBotSettingsConfigured === true;
  const bookingUrl = String(settings.defaultBookingUrl ?? "").trim();
  let bookingLinkValid = false;
  try {
    const url = new URL(bookingUrl);
    bookingLinkValid = url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    bookingLinkValid = false;
  }

  const connections = integrations?.providers ?? [];
  function statusFor(provider) {
    return connections.find(row => row.provider === provider)?.status ?? "unknown";
  }
  const verified = provider =>
    statusFor(provider) === "api_verified_no_sync";

  const checks = [
    {
      id: "backend",
      label: "Lokales Backend",
      status: backend ? "ok" : "attention",
      detail: backend ? "Erreichbar" : "Noch nicht erreichbar",
    },
    {
      id: "send",
      label: "Testmodus ohne Live-Nachrichten",
      status: sendsOff ? "ok" : "attention",
      detail: sendsOff
        ? "Instagram-Engine und beide Sendekanal-Schalter sind aus"
        : "Sicherheitsschalter nicht vollständig geprüft oder aktiv",
    },
    {
      id: "company",
      label: "Marke und Betreiber",
      status: companyReady ? "ok" : "pending",
      detail: companyReady ? "Grundangaben vorhanden" : "Firmennamen, Betreiber und Pete prüfen",
    },
    {
      id: "assistant",
      label: "Pete-Konfiguration",
      status: aiReady ? "ok" : "pending",
      detail: aiReady
        ? "Basis-Einstellungen vorhanden; echtes KI-Modell separat testen"
        : "Assistenteneinstellungen oder Backend fehlen",
    },
    {
      id: "booking",
      label: "Buchungslink",
      status: bookingLinkValid ? "ok" : "pending",
      detail: bookingLinkValid
        ? "HTTPS-Link hinterlegt; echte Testbuchung noch erforderlich"
        : "HTTPS-Buchungslink eintragen",
    },
    {
      id: "calendar",
      label: "Kalender-Anbieter",
      status: verified("google_calendar") || verified("calendly") ? "ok" : "pending",
      detail: verified("google_calendar") || verified("calendly")
        ? "Lesender API-Zugriff geprüft; keine aktive Synchronisierung"
        : "Noch kein echter API-Zugriff nachgewiesen",
    },
    {
      id: "crm",
      label: "HubSpot",
      status: verified("hubspot") ? "ok" : "pending",
      detail: verified("hubspot")
        ? "Lesender API-Zugriff geprüft; keine aktive CRM-Synchronisierung"
        : "Optional: CRM-Zugriff noch nicht geprüft",
    },
    {
      id: "meta",
      label: "Instagram und WhatsApp Live-Betrieb",
      status: "pending",
      detail: "Noch kein bestätigter echter Test-DM-Versand oder Meta-App-Review",
    },
  ];
  return {
    localTestReady: Boolean(backend && sendsOff && companyReady && aiReady),
    liveIntegrationVerified: false,
    checks,
  };
}
