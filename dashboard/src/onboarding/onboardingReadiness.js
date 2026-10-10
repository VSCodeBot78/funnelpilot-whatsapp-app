import { getLocalRuntimeDiagnostics } from "../diagnostics/systemDiagnostics.js";

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
  const safety = getLocalRuntimeDiagnostics(readiness);
  const backend = safety.checks.some(item => item.id === "backend" && item.status === "ok");
  const sendsOff = safety.localFlagsSafe;
  const unresolvedSafety = safety.checks.find(item => item.status !== "ok");
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
        ? "Lokale Sicherheits-Flags geprüft. Relay und echte Zustellung separat prüfen."
        : safety.headline + ": " + (unresolvedSafety?.detail || "Sicherheitsstatus offen."),
      nextStep: sendsOff ? "Windows: nach dem Start den Relay-Check separat ausführen."
        : (unresolvedSafety?.nextStep || "Backend-Status erneut abrufen."),
    },
    {
      id: "relay",
      label: "Webhook-Relay-Sperren",
      status: "pending",
      detail: "Aus dem Browser nicht nachgewiesen. Kein Start eines öffentlichen Tunnels.",
      nextStep: "Windows: node .\\scripts\\local-safety-preflight.mjs im Repository ausführen.",
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
    localSafetyState: safety.state,
    relayVerified: false,
    checks,
  };
}
