import React, { useCallback, useEffect, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import {
  getOnboardingReadiness,
  ONBOARDING_LABELS,
} from "./onboardingReadiness";

const TEST_CAMPAIGN = "eltern-vital-fit";

export default function OnboardingView({
  colors,
  settings,
  settingsMessage,
  onSettingsChange,
  onSaveSettings,
  onOpenSection,
  onOpenTestChat,
  onLeave,
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [error, setError] = useState("");
  const state = getOnboardingReadiness(readiness);
  const panel = {
    background: colors.panel,
    border: "1px solid " + colors.border,
    padding: 18,
    borderRadius: 10,
  };
  const action = {
    padding: "10px 14px",
    border: "1px solid " + colors.border,
    borderRadius: 8,
    background: colors.panelSoft,
    color: colors.text,
    cursor: "pointer",
    fontWeight: 700,
  };
  const field = {
    display: "block",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid " + colors.border,
    background: colors.surface,
    color: colors.text,
    boxSizing: "border-box",
    width: "100%",
    marginTop: 5,
  };

  const refreshReadiness = useCallback(async () => {
    setChecking(true);
    setReadinessError("");
    try {
      const response = await fetch(buildApiUrl("/health/readiness", settings.apiBaseUrl), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data.ok) throw new Error("Backend meldet nicht bereit");
      setReadiness(data);
    } catch (cause) {
      setReadiness(null);
      setReadinessError(
        "Backend-Status nicht abrufbar: " + (cause instanceof Error ? cause.message : "Verbindung fehlt")
      );
    } finally {
      setChecking(false);
    }
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    if (step === 2 || step === 3) refreshReadiness();
  }, [step, refreshReadiness]);

  function change(key, value) {
    onSettingsChange((previous) => ({ ...previous, [key]: value }));
  }

  function fieldInput(label, key, hint) {
    return (
      <label style={{ fontSize: 13, fontWeight: 650 }}>
        {label}
        <input
          style={field}
          value={settings[key] || ""}
          placeholder={hint || ""}
          onChange={(event) => change(key, event.target.value)}
        />
      </label>
    );
  }

  async function next() {
    setError("");
    if (step === 0 || step === 1) {
      if (!String(settings.productName || "").trim() || !String(settings.adminName || "").trim()) {
        setError("Produktname und Admin-Name dürfen nicht leer sein.");
        return;
      }
      setSaving(true);
      try {
        const saved = await onSaveSettings();
        if (!saved) {
          setError("Bitte Einstellungen prüfen und erneut speichern.");
          return;
        }
      } catch (cause) {
        setError("Speichern fehlgeschlagen: " + String(cause));
        return;
      } finally {
        setSaving(false);
      }
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function simulateCheckout() {
    setCheckoutResult(null);
    setCheckoutPending(true);
    try {
      // A deliberately unique synthetic lead. This endpoint prepares a
      // booking invitation in the local conversation state; it never sends it.
      const leadId = "fp-local-onboarding-" + Date.now();
      const response = await fetch(buildApiUrl("/webhook/checkout", settings.apiBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          campaignId: TEST_CAMPAIGN,
          event: "checkout.completed",
          paymentStatus: "paid",
          productId: "fp-local-499-test",
          checkoutId: "local-simulation-" + Date.now(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Testkauf konnte nicht simuliert werden");
      }
      setCheckoutResult({ ok: true, leadId, reply: data.reply });
    } catch (cause) {
      setCheckoutResult({
        ok: false,
        error: cause instanceof Error ? cause.message : "Unbekannter Fehler",
      });
    } finally {
      setCheckoutPending(false);
    }
  }

  function status(text, ok, detail) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid " + colors.border,
        fontSize: 13,
        flexWrap: "wrap",
      }}>
        <span>{text}</span>
        <span style={{ color: colors.sub, textAlign: "right" }}>
          {ok ? "Konfiguriert, nicht live verifiziert" : detail || "Nicht konfiguriert / unbekannt"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 960 }}>
      <div style={panel}>
        <div style={{ fontSize: 21, fontWeight: 800 }}>Funnel Pilot einrichten</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: colors.sub }}>
          Wir gehen die Ersteinrichtung wie ein neuer Nutzer durch. Dies ist ein lokaler
          Abnahmetest. Kein Schritt aktiviert den echten Instagram- oder WhatsApp-Versand.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ONBOARDING_LABELS.map((label, i) => (
            <button
              type="button"
              key={label}
              onClick={() => { setError(""); setStep(i); }}
              style={{
                ...action,
                background: step === i ? colors.accent : colors.panelSoft,
                color: step === i ? "#111827" : colors.text,
              }}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div style={panel}>
          <h3 style={{ marginTop: 0 }}>1. Workspace & Betreiber</h3>
          <p style={{ color: colors.sub, fontSize: 13 }}>
            Diese Felder werden im bestehenden Backend gespeichert. Sie müssen nicht
            im Code geändert werden.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {fieldInput("Name des Produkts", "productName", "Funnel Pilot")}
            {fieldInput("Name des Betreibers", "adminName")}
            {fieldInput("Branding-Hinweis", "brandHint")}
          </div>
          <p style={{ color: colors.sub, fontSize: 12 }}>
            Impressum und Datenschutzerklärung werden unter Einstellungen → Rechtliches gepflegt.
          </p>
          <button type="button" style={action} onClick={() => onOpenSection("settings")}>
            Alle Einstellungen öffnen
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={panel}>
          <h3 style={{ marginTop: 0 }}>2. Pete konfigurieren</h3>
          <div style={{ display: "grid", gap: 14 }}>
            {fieldInput("Assistentenname", "assistantName", "Pete")}
            {fieldInput("Markenstimme", "brandVoice", "kurz, direkt, natürlich")}
            {fieldInput("Sprache", "defaultLanguage", "Deutsch")}
            {fieldInput("Eskalation / Human Takeover", "escalationHint")}
          </div>
          <p style={{ color: colors.sub, fontSize: 12 }}>
            No-Gos und ausführliche KI-Konfiguration sind in Einstellungen → KI / Pete.
            Zugangsschlüssel werden ausschließlich lokal als Secret gesetzt.
          </p>
          <button type="button" style={action} onClick={() => onOpenSection("settings")}>
            Pete-Einstellungen öffnen
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={panel}>
          <h3 style={{ marginTop: 0 }}>3. Instagram, WhatsApp & OpenAI</h3>
          <p style={{ color: colors.sub, fontSize: 13, lineHeight: 1.6 }}>
            Hier werden nur serverseitige Konfigurationsmerkmale überprüft.
            Ein Zugangsschlüssel ist noch keine bestätigte Verbindung. Das spätere
            Verbinden über einen einfachen Meta-Login ist noch nicht umgesetzt.
          </p>
          <button type="button" style={action} onClick={refreshReadiness} disabled={checking}>
            {checking ? "Prüfe ..." : "Verbindungsstatus aktualisieren"}
          </button>
          {readinessError && <p role="alert" style={{ color: colors.danger || colors.text }}>{readinessError}</p>}
          {status("Backend erreichbar", state.backendReachable, "Backend nicht erreichbar")}
          {status("OpenAI-Schlüssel vorhanden", state.aiKeyConfigured)}
          {status("Instagram-Zugangsdaten vorhanden", state.instagramConfigured)}
          {status("WhatsApp-Zugangsdaten vorhanden", state.whatsappConfigured)}
          <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700 }}>
            Versand-Sicherheitscheck: {state.sendLocked === null
              ? "Nicht geprüft"
              : state.sendLocked
                ? "Instagram und WhatsApp sind abgeschaltet"
                : "Achtung: Mindestens ein echter Versand ist aktiviert"}
          </div>
          <p style={{ color: colors.sub, fontSize: 12 }}>
            ManyChat bleibt unverändert. Neue Instagram-Leads werden nicht automatisch
            an Pete übergeben. Echte End-to-End-Zustellung über Meta ist weiterhin offen.
            Zugangsdaten niemals in Chat, Testnachrichten oder GitHub eintragen.
          </p>
        </div>
      )}

      {step === 3 && (
        <div style={panel}>
          <h3 style={{ marginTop: 0 }}>4. Den gesamten Funnel durchspielen</h3>
          <p style={{ color: colors.sub, fontSize: 13 }}>
            Dies sind echte Dashboard-Funktionen, nicht nur ein KI-Demochat.
            Produktiver Versand bleibt aus. Eingetragene Testdaten können lokal erscheinen.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" style={action} onClick={onOpenTestChat}>Pete im Testchat prüfen</button>
            <button type="button" style={action} onClick={() => onOpenSection("campaigns")}>Kampagnen & Links</button>
            <button type="button" style={action} onClick={() => onOpenSection("leads")}>Testleads verwalten</button>
            <button type="button" style={action} onClick={() => onOpenSection("inbox")}>Human Takeover / Inbox</button>
            <button type="button" style={action} onClick={() => onOpenSection("ghosting")}>Follow-ups / Ghosting</button>
            <button type="button" style={action} onClick={() => onOpenSection("appointments")}>Termine</button>
          </div>
          <div style={{
            marginTop: 18,
            padding: 14,
            border: "1px solid " + colors.border,
            borderRadius: 8,
          }}>
            <strong>Nach Kauf: Kunden-Onboarding (simuliert)</strong>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: colors.sub }}>
              Ein simuliertes Kaufereignis für das 499-€-Coaching erstellt einen
              separaten Test-Conversation-State mit Onboarding-Terminlink.
              Es findet weder eine Zahlung noch ein Instagram-/WhatsApp-Versand statt.
              Das ist noch kein produktiver Checkout-Anschluss.
            </p>
            <button
              type="button"
              style={action}
              disabled={checkoutPending || state.sendLocked === false}
              onClick={simulateCheckout}
            >
              {checkoutPending ? "Simuliere ..." : "499-€-Testkauf und Onboarding simulieren"}
            </button>
            {checkoutResult && (
              <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {checkoutResult.ok ? (
                  <>
                    <strong>Test-Nachricht vorbereitet, nicht versandt.</strong>
                    <p>Testlead: {checkoutResult.leadId}</p>
                    <div>{checkoutResult.reply}</div>
                  </>
                ) : (
                  <p role="alert">{checkoutResult.error}</p>
                )}
              </div>
            )}
          </div>
          <p style={{ color: colors.sub, fontSize: 12 }}>
            Abschluss bedeutet hier nur: Einführungsseite verlassen. Kein grünes
            Meta-Live-Siegel und keine Aktivierung der Automation.
          </p>
          <button type="button" style={action} onClick={onLeave}>
            Zum Dashboard, Einrichtung später wieder öffnen
          </button>
        </div>
      )}

      {settingsMessage && <div style={{ color: colors.sub, fontSize: 12 }}>{settingsMessage}</div>}
      {error && <div role="alert" style={{ color: colors.danger || colors.text, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button type="button" style={action} disabled={step === 0} onClick={() => { setError(""); setStep((i) => Math.max(0, i - 1)); }}>
          Zurück
        </button>
        {step < 3 && (
          <button type="button" style={action} disabled={saving} onClick={next}>
            {saving ? "Speichere ..." : step < 2 ? "Speichern & weiter" : "Weiter zum Gesamttest"}
          </button>
        )}
      </div>
    </div>
  );
}
