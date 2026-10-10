// Phase 35: read-only, fail-closed diagnosis of the local Windows test profile.
// A green CONFIGURATION is NEVER proof of actual Meta/WhatsApp delivery, of
// safe exposure to the internet, or of the webhook relay being isolated.
const SAFE_FLAGS = [
  {
    id: "environment",
    label: "Lokaler Entwicklungsmodus",
    fields: [["nodeEnv", "development"]],
    ok: "Entwicklungsmodus bestätigt.",
    fix: "Nur mit dem sicheren Windows-Starter im Entwicklungsmodus testen. Keinen Produktivserver als lokalen Test behandeln.",
  },
  {
    id: "sending",
    label: "Instagram- und WhatsApp-Versand",
    fields: [["instagramSendEnabled", false], ["whatsappSendEnabled", false]],
    ok: "Beide echten Sendekanäle ausgeschaltet.",
    fix: "STOP: Echten Versand nicht im Test einschalten. Die Backend-Fenster schließen und scripts/start-local.ps1 neu starten.",
  },
  {
    id: "engine",
    label: "Instagram-Automatik",
    fields: [["instagramEngineEnabled", false]],
    ok: "Instagram-Engine ausgeschaltet.",
    fix: "STOP: INSTAGRAM_ENGINE_ENABLED muss false sein. Mit dem sicheren Windows-Starter neu starten.",
  },
  {
    id: "coexistence",
    label: "ManyChat-Übergangsmodus",
    fields: [
      ["instagramAllowAllSenders", false],
      ["instagramAutoEnableNewLeads", false],
      ["instagramAllowedSenderCount", 0],
    ],
    ok: "Kein automatisches Freigeben aller oder neuer Instagram-Leads; Test-Allowlist leer.",
    fix: "STOP: Keine pauschale Lead-Freigabe. Allow-all und Auto-Enable ausschalten, Test-Allowlist leeren und sicher neu starten. ManyChat bleibt bis zur getrennten Migration aktiv.",
  },
  {
    id: "destructive",
    label: "Gefährliche Verwaltungsaktionen",
    fields: [["destructiveRoutesDisabled", true]],
    ok: "Destruktive Routen sind blockiert.",
    fix: "STOP: DISABLE_DESTRUCTIVE_ROUTES=true erzwingen und den sicheren Windows-Starter verwenden.",
  },
  {
    id: "generic_webhooks",
    label: "Generische Kauf- und Termin-Webhooks",
    fields: [["genericWebhooksEnabled", false]],
    ok: "Unsichere generische Webhooks sind ausgeschaltet.",
    fix: "STOP: ENABLE_GENERIC_WEBHOOKS=false setzen und das Backend neu starten. Eine Test-Zahlung darf keine echte Zahlung bestätigen.",
  },
];

function observed(check, readiness) {
  const missing = check.fields.filter(([key]) => !Object.hasOwn(readiness, key));
  if (missing.length > 0) {
    return {
      id: check.id, label: check.label, status: "unknown",
      detail: "Sicherheitswert fehlt: " + missing.map(([key]) => key).join(", ") + ".",
      nextStep: "Die aktuelle Backend-Version laden und Status erneut prüfen. Niemals aus fehlenden Daten auf Sicherheit schließen.",
    };
  }
  const unsafe = check.fields.filter(([key, expected]) => readiness[key] !== expected);
  return unsafe.length === 0
    ? { id: check.id, label: check.label, status: "ok", detail: check.ok, nextStep: "" }
    : {
        id: check.id, label: check.label, status: "blocked",
        detail: "Abweichender Status: " + unsafe.map(([key]) => key).join(", ") + ".",
        nextStep: check.fix,
      };
}

export function getLocalRuntimeDiagnostics(readiness) {
  if (!readiness || typeof readiness !== "object" ||
      readiness.ok !== true || readiness.service !== "funnel-pilot-backend" ||
      readiness.status !== "ready") {
    return {
      state: "unknown",
      localFlagsSafe: false,
      headline: "Backend-Status nicht bestätigt",
      explanation: "Der Server ist nicht erreichbar oder liefert keinen gültigen Funnel-Pilot-Status. Kein Start- oder Versandnachweis.",
      checks: [{
        id: "backend", label: "Funnel Pilot Backend", status: "unknown",
        detail: "Keine bestätigte lokale Statusantwort.",
        nextStep: "Im Fenster „Funnel Pilot Backend“ den Start prüfen. Dann mit „Erneut prüfen“ den Status neu laden.",
      }],
      relayVerified: false,
      realMetaDeliveryVerified: false,
    };
  }

  const checks = SAFE_FLAGS.map(check => observed(check, readiness));
  const blocked = checks.some(check => check.status === "blocked");
  const missing = checks.some(check => check.status === "unknown");
  const localFlagsSafe = !blocked && !missing;

  return {
    state: blocked ? "blocked" : missing ? "unknown" : "safe",
    localFlagsSafe,
    headline: blocked
      ? "Sicherheits-STOP: Testprofil abweichend"
      : missing
        ? "Sicherheitsstatus unvollständig"
        : "Lokale Sicherheits-Flags geprüft",
    explanation: localFlagsSafe
      ? "Der Backend-Testmodus ist korrekt eingestellt. Relay-Schutz und echte Anbieterzustellung sind damit NICHT geprüft."
      : "Nicht live schalten und keinen Tunnel öffnen. Erst die aufgeführten Prüfungen korrigieren.",
    checks: [
      { id: "backend", label: "Funnel Pilot Backend", status: "ok",
        detail: "Readiness vom richtigen Backend erhalten.", nextStep: "" },
      ...checks,
    ],
    relayVerified: false,
    realMetaDeliveryVerified: false,
  };
}

export function getExternalDiagnosticLimits() {
  return [
    {
      id: "relay",
      label: "Webhook-Relay",
      detail: "Nicht im Browser geprüft. Der öffentliche Relay darf niemals Admin-, Lead- oder Checkout-Daten durchreichen.",
      nextStep: "Nach dem sicheren lokalen Start im Repository: node .\\scripts\\local-safety-preflight.mjs. Nur dessen GRÜN bestätigt den lokalen Relay-Test.",
    },
    {
      id: "providers",
      label: "Meta, Calendly und Zahlungen",
      detail: "Keine echte Zustellung, bestätigte Buchung oder verifizierte Zahlung nachgewiesen.",
      nextStep: "Später ausschließlich getrennte, ausdrücklich freigegebene Tests mit eigenem Testkontakt und echten Providersignaturen durchführen.",
    },
  ];
}
