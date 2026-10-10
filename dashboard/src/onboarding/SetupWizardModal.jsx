import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import { getSetupDiagnostics } from "./onboardingReadiness";
import CoachDraftEditor from "./CoachDraftEditor";
import CoachProfilePreview from "./CoachProfilePreview";

const STAGES = ["Willkommen", "Marke & Pete", "Angebote", "Verbindungen", "Test", "Fertig"];
const PROVIDERS = [
  { id: "instagram", name: "Instagram", group: "Social Media", symbol: "◎" },
  { id: "facebook", name: "Facebook", group: "Social Media", symbol: "f" },
  { id: "whatsapp", name: "WhatsApp Business", group: "Social Media", symbol: "✆" },
  { id: "google_calendar", name: "Google Kalender", group: "Kalender", symbol: "▦" },
  { id: "calendly", name: "Calendly", group: "Kalender", symbol: "◷" },
  { id: "hubspot", name: "HubSpot", group: "CRM", symbol: "◈" },
];

export function initialSetupStep(search = "") {
  return new URLSearchParams(search).get("setup") === "connections" ? 3 : 0;
}

export default function SetupWizardModal({
  colors, settings, onSettingsChange, onSaveSettings, onSaveCoachDraft, onOpenTestChat,
  onOpenSection, onClose, startStep = 0,
}) {
  const [stage, setStage] = useState(() =>
    new URLSearchParams(window.location.search).get("setup") === "connections"
      ? initialSetupStep(window.location.search)
      : Math.max(0, Math.min(STAGES.length - 1, startStep))
  );
  const [readiness, setReadiness] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [checkout, setCheckout] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (window.location.search.includes("setup=connections")) {
      const params = new URLSearchParams(window.location.search);
      const result = params.get("result");
      setMessage(result === "authorized"
        ? "Anbieter-Anmeldung erfolgreich. Ob Termine oder Kontakte synchronisiert werden, prüfen wir separat."
        : result === "denied"
          ? "Die Berechtigung wurde nicht erteilt."
          : result ? "Anbieter-Anmeldung konnte nicht abgeschlossen werden." : "");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    // Keep the local safety reading even when optional OAuth diagnostics fail.
    // Both requests are read-only. No secrets or provider access is exposed.
    try {
      const [health, provider] = await Promise.allSettled([
        fetch(buildApiUrl("/health/readiness", settings.apiBaseUrl), { cache: "no-store" })
          .then(async response => {
            if (!response.ok) throw new Error("Backend-Status HTTP " + response.status);
            return response.json();
          }),
        fetch(buildApiUrl("/integrations/oauth/status", settings.apiBaseUrl), { cache: "no-store" })
          .then(async response => {
            if (!response.ok) throw new Error("Integrationsstatus HTTP " + response.status);
            return response.json();
          }),
      ]);
      setReadiness(health.status === "fulfilled" ? health.value : null);
      setIntegrations(provider.status === "fulfilled" ? provider.value : null);
      if (health.status === "rejected") {
        setMessage("Lokaler Backend-Status fehlt. Backend-Fenster prüfen; kein Live-Test.");
      } else if (provider.status === "rejected") {
        setMessage("Backend erreichbar, aber Anbieterstatus nicht abrufbar. Kalender/CRM bleiben ungeprüft.");
      }
    } finally { setLoading(false); }
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    if (stage >= 3) reload();
  }, [stage, reload]);

  function update(key, value) {
    onSettingsChange(previous => ({ ...previous, [key]: value }));
  }

  async function saveCoachDraft() {
    setMessage("");
    setSaving(true);
    try {
      const saved = await onSaveCoachDraft(settings.coachOnboardingDraft);
      setMessage(saved
        ? "Coach-Entwurf im bestehenden Workspace gespeichert. Kein neuer Coach-Zugang und keine Live-Freigabe."
        : "Coach-Entwurf konnte nicht gespeichert werden. Felder und HTTPS-Links kontrollieren.");
    } catch {
      setMessage("Coach-Entwurf konnte nicht gespeichert werden. Kein Live-Betrieb aktiviert.");
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    setMessage("");
    if (stage === 1 || stage === 2) {
      if (stage === 1 && (!String(settings.adminName || "").trim() ||
          !String(settings.assistantName || "").trim())) {
        setMessage("Bitte Betreiber- und Assistentennamen angeben."); return;
      }
      setSaving(true);
      try {
        const saved = await onSaveSettings();
        if (!saved) { setMessage("Speichern fehlgeschlagen. Einstellungen prüfen."); return; }
      } finally { setSaving(false); }
    }
    setStage(value => Math.min(value + 1, STAGES.length - 1));
  }

  function input(label, key, options = {}) {
    const { multiline = false, placeholder = "", rows = 3 } = options;
    const style = { padding: "11px 12px", width: "100%", boxSizing: "border-box",
      border: "1px solid #cbd5e1", borderRadius: 9, color: "#0f172a",
      background: "#ffffff", fontSize: 14, marginTop: 6 };
    return <label style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
      {label}
      {multiline
        ? <textarea rows={rows} style={{ ...style, resize: "vertical" }}
            value={settings[key] || ""} placeholder={placeholder}
            onChange={e => update(key, e.target.value)} />
        : <input style={style} value={settings[key] || ""} placeholder={placeholder}
            onChange={e => update(key, e.target.value)} />}
    </label>;
  }

  function providerStatus(provider) {
    if (["instagram", "facebook", "whatsapp"].includes(provider)) {
      return { label: "Meta-Freigabe / Embedded Signup ausstehend", status: "external" };
    }
    const item = integrations?.providers?.find(i => i.provider === provider);
    if (!item) return { label: "Serverstatus nicht abrufbar", status: "unknown" };
    const labels = {
      setup_required: "Anbieter-App noch einzurichten",
      ready_to_connect: "Bereit zur Anmeldung",
      authorized_not_synced: "Autorisierung vorhanden, Sync noch nicht aktiv",
      api_verified_no_sync: "API-Zugriff geprüft, Synchronisierung noch nicht aktiv",
      reauthorization_required: "Erneute Anmeldung erforderlich",
    };
    return { label: labels[item.status] || "Unbekannter Status", status: item.status };
  }

  function authStart(provider) {
    const base = String(settings.apiBaseUrl || "").trim().replace(/\/+$/, "");
    const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const service = base || (local ? "http://localhost:3001" : window.location.origin);
    window.location.assign(service + "/integrations/oauth/" + provider + "/start");
  }

  async function verifyConnection(provider) {
    setMessage("");
    try {
      const response = await fetch(
        buildApiUrl("/integrations/oauth/" + provider + "/verify", settings.apiBaseUrl),
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Verbindungsprüfung fehlgeschlagen");
      const result = await response.json();
      const labels = {
        api_verified_no_sync: "API-Verbindung geprüft. Kalender-/CRM-Synchronisierung ist noch nicht aktiv.",
        not_authorized: "Zuerst das Konto autorisieren.",
        reauthorization_required: "Anmeldung abgelaufen oder Berechtigung fehlt. Bitte neu verbinden.",
        provider_unreachable: "Anbieter nicht erreichbar. Bitte später erneut prüfen.",
      };
      setMessage(labels[result.status] || "Verbindungsstatus unklar.");
      await reload();
    } catch {
      setMessage("Verbindungsprüfung fehlgeschlagen. Serverstatus kontrollieren.");
    }
  }

  async function disconnect(provider) {
    if (!window.confirm("Berechtigung für " + provider + " lokal trennen?")) return;
    try {
      const response = await fetch(buildApiUrl("/integrations/oauth/" + provider + "/disconnect", settings.apiBaseUrl), {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setMessage("Lokale Berechtigung getrennt. Eine Sperrung im Anbieter-Konto erfolgt separat.");
      await reload();
    } catch { setMessage("Trennen fehlgeschlagen."); }
  }

  async function testPurchase() {
    setCheckout(null); setCheckoutBusy(true);
    try {
      const leadId = "fp-setup-" + Date.now();
      const response = await fetch(buildApiUrl("/webhook/checkout", settings.apiBaseUrl), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId, campaignId: "eltern-vital-fit",
          event: "checkout.completed", paymentStatus: "paid",
          checkoutId: "local-setup-" + Date.now(), productId: "fp-499-test",
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Test fehlgeschlagen");
      setCheckout({ leadId, reply: body.reply });
    } catch (error) {
      setMessage("Lokale Checkout-Simulation fehlgeschlagen: " +
        (error instanceof Error ? error.message : "Unbekannt"));
    } finally { setCheckoutBusy(false); }
  }

  const btn = { border: "1px solid #cbd5e1", background: "white", color: "#102044",
    borderRadius: 10, padding: "11px 16px", fontSize: 13, cursor: "pointer", fontWeight: 750 };
  const primary = { ...btn, background: "#1261ed", color: "white", borderColor: "#1261ed" };
  const box = { padding: 18, borderRadius: 12, background: "#f5f8fc",
    border: "1px solid #e3eaf3" };
  const small = { color: "#64748b", fontSize: 13, lineHeight: 1.55 };

  function connectTile(p) {
    const current = providerStatus(p.id);
    const active = ["ready_to_connect", "reauthorization_required", "authorized_not_synced", "api_verified_no_sync"].includes(current.status);
    return <div key={p.id} style={{ ...box, background: "#ffffff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span aria-hidden style={{ fontSize: 23, width: 30, color: "#1261ed" }}>{p.symbol}</span>
        <strong style={{ fontSize: 14 }}>{p.name}</strong>
      </div>
      <div style={{ ...small, margin: "9px 0", minHeight: 37 }}>{current.label}</div>
      {active ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={btn} onClick={() => authStart(p.id)}>
          {["authorized_not_synced", "api_verified_no_sync"].includes(current.status) ? "Neu autorisieren" : "Konto verbinden"}
        </button>
        {["authorized_not_synced", "api_verified_no_sync"].includes(current.status) && (
          <>
            <button type="button" style={btn} onClick={() => verifyConnection(p.id)}>
              API-Zugriff prüfen
            </button>
            <button type="button" style={btn} onClick={() => disconnect(p.id)}>
              Trennen
            </button>
          </>
        )}
      </div>
      : <div style={{ ...small, fontWeight: 600 }}>
        {current.status === "external"
          ? "Meta-Verknüpfung folgt nach App-Einrichtung."
          : "Noch kein Login möglich, bis die Entwickler-App eingerichtet ist."}
      </div>}
    </div>;
  }

  const diagnostics = getSetupDiagnostics({ readiness, integrations, settings });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10, 21, 40, 0.68)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      boxSizing: "border-box",
    }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby="setup-title" style={{
          width: "min(1100px, 100%)", maxHeight: "min(92vh, 900px)",
          background: "#ffffff", color: "#0f1b3d",
          boxShadow: "0 28px 80px rgba(0,0,0,.35)",
          borderRadius: 18, display: "flex", flexDirection: "column",
          overflow: "hidden", outline: "none",
        }}>
        <div style={{ padding: "22px 28px 15px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h2 id="setup-title" style={{ margin: 0, fontSize: 25 }}>🚀 Funnel Pilot einrichten</h2>
              <div style={{ ...small, marginTop: 5 }}>
                Dein persönlicher Startassistent. Alle Einstellungen später jederzeit ändern.
              </div>
            </div>
            <button type="button" style={{ ...btn, padding: "5px 11px" }}
              aria-label="Einrichtung schließen" onClick={onClose}>✕</button>
          </div>
          <div style={{ display: "flex", overflowX: "auto", gap: 9, marginTop: 18 }}>
            {STAGES.map((label, index) =>
              <button type="button" key={label} onClick={() => { setMessage(""); setStage(index); }}
                style={{
                  ...btn, padding: "8px 12px", flex: "1 0 auto",
                  background: index === stage ? "#e8f1ff" : "#f8fafc",
                  color: index === stage ? "#0054d6" : "#52637e",
                  borderColor: index === stage ? "#9dbdf9" : "#e2e8f0",
                }}>{index + 1}. {label}</button>)}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "22px 28px", flex: 1, minHeight: 0 }}>
          {stage === 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
            <div style={{ ...box, background: "#eaf3ff" }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>Willkommen bei Funnel Pilot!</h2>
              <p style={{ ...small, fontSize: 15 }}>
                Richte deine Marke, Angebote, Antworten und Verbindungen Schritt für Schritt ein.
                Du brauchst dafür keine technischen Kenntnisse. Andere Coach-Konten
                und eine Live-Freigabe entstehen dadurch noch nicht.
              </p>
              <div style={{ marginTop: 14, ...small }}>✓ Ein geführter Ablauf</div>
              <div style={{ ...small }}>✓ Jederzeit wieder öffnen</div>
              <div style={{ ...small }}>✓ Testmodus vor dem Livegang</div>
              <div style={{ ...small }}>✓ Keine ungewollten Nachrichten</div>
            </div>
            <div style={box}>
              <h3 style={{ marginTop: 0 }}>So möchtest du starten</h3>
              <p style={small}>Kurze Einführung ansehen oder direkt selbst einrichten.</p>
              {/^https:\/\//i.test(settings.setupVideoUrl || "")
                ? <a href={settings.setupVideoUrl} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn, display: "inline-block", textDecoration: "none", marginBottom: 10 }}>
                    ▶ Setup-Video ansehen
                  </a>
                : <p style={small}>🎬 Setup-Video ist noch nicht hinterlegt. Du kannst direkt starten.</p>}
              <div><button type="button" style={primary} onClick={() => setStage(1)}>
                Direkt einrichten →
              </button></div>
              <div style={{ ...small, marginTop: 24 }}>
                Einrichtung in idealerweise 20–30 Minuten. Anbieterfreigaben können zusätzlich Zeit beanspruchen.
              </div>
            </div>
          </div>}

          {stage === 1 && <div>
            <p style={{ ...small, padding: 12, border: "1px solid #fed7aa",
              borderRadius: 9, background: "#fff7ed", marginTop: 0 }}>
              <strong>Wichtig:</strong> Diese Einrichtung bearbeitet derzeit deinen einzigen
              bestehenden Workspace. Ein fremder Coach hat hier NOCH KEIN eigenes Konto
              oder getrennte Daten. Andere Marken nur in einer separaten Testumgebung
              ausprobieren, nicht über deinen laufenden Eltern-fit-&amp;-vital-Workspace.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Deine Marke</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {input("Firmenname / Marke", "companyName")}
                {input("Website", "companyWebsite", { placeholder: "https://..." })}
                {input("Nische / Schwerpunkt", "companyNiche")}
                {input("Zielgruppe", "companyAudience")}
                {input("Betreibername", "adminName")}
              </div>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Dein KI-Assistent und deine Kommunikation</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {input("Assistentenname", "assistantName")}
                {input("Markensprache / Tonalität", "brandVoice")}
                <div>
                  {input("Deine 3 häufigsten Kundeneinwände (optional)", "customerTopObjections",
                    { multiline: true, rows: 4,
                      placeholder: "Ein Einwand pro Zeile, maximal drei. Beispiel: Zu wenig Zeit" })}
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    Welche Hürden begegnen dir in echten Kundengesprächen am häufigsten?
                    Diese Angaben helfen Pete beim gezielten Nachfragen. Du kannst sie
                    jederzeit ändern oder leer lassen. Sicherheitsregeln bleiben unverändert.
                  </p>
                </div>
                <div>
                  {input("Master-Prompt: So soll dein KI-Assistent mit Leads sprechen",
                    "masterPrompt", { multiline: true, rows: 9,
                    placeholder: "Beschreibe Zielgruppe, Sprache, Einwände, Fachgrenzen und Sales-Haltung." })}
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    Standard ist der natürliche Instagram-DM-Dialog: zuhören, spiegeln,
                    eine Frage, dann passender nächster Schritt. A-B-C-D gibt es nur noch als Altmodus.
                    Für Eltern fit &amp; vital ist eine Startvorlage hinterlegt.
                    Andere Unternehmen tragen später ihren eigenen Master-Prompt ein.
                    Der Prompt steuert die freie KI-Antwortschicht; feste Sicherheits-
                    und Funnel-Antworten werden zusätzlich getrennt geprüft.
                  </p>
                </div>
                {input("Eskalation an einen Menschen", "escalationHint", { multiline: true })}
                {input("Was Pete niemals tun darf", "noGos", { multiline: true })}
              </div>
              <p style={small}>Dein KI-Assistent darf nicht behaupten, persönlich der Betreiber zu sein.</p>
            </div>
            </div>
          </div>}

          {stage === 2 && <div style={{ display: "grid", gap: 16 }}>
            <p style={{ ...small, padding: 12, border: "1px solid #fed7aa",
              borderRadius: 9, background: "#fff7ed" }}>
              <strong>Wichtig:</strong> Die bestehenden Marken-, Buchungs- und Checkout-Felder
              oberhalb des neuen Editors gehören weiterhin zum aktuellen Workspace und
              können von aktiven Funktionen genutzt werden. Nur die zusätzlichen
              Coach-Identitätsdaten, Angebote und FAQs darunter sind reine Entwürfe. Keine fremden
              Test-Coaches im laufenden Workspace einrichten.
            </p>
            <h3 style={{ marginTop: 0 }}>Angebote und nächste Schritte</h3>
            {input("Deine Angebote und Zielsetzung", "companyOfferSummary", { multiline: true,
              placeholder: "Was bietest du an, zu welchem Preis und für wen?" })}
            {input("Buchungslink (falls vorhanden)", "defaultBookingUrl",
              { placeholder: "https://calendly.com/..." })}
            {input("Kauf-Link für dein Haupteinstiegsangebot", "starterCheckoutUrl",
              { placeholder: "https://..." })}
            <p style={{ ...small, background: "#eff6ff", border: "1px solid #bfdbfe",
              padding: 10, borderRadius: 8 }}>
              „Coach-Entwurf speichern“ sichert ausschließlich die unten erfassten
              Identitätsdaten, Angebotsentwürfe und FAQs. Andere Änderungen im Einrichtungsformular
              werden dadurch nicht gespeichert. „Weiter“ speichert weiterhin
              die gesamten aktuellen Einstellungen dieses einen Arbeitsbereichs.
            </p>
            <CoachDraftEditor
              value={settings.coachOnboardingDraft}
              onChange={value => update("coachOnboardingDraft", value)}
            />
            <CoachProfilePreview settings={settings} />
            <button type="button" style={{ ...primary, justifySelf: "start" }}
              onClick={saveCoachDraft} disabled={saving}>
              {saving ? "Speichere…" : "Coach-Entwurf speichern"}
            </button>
            <div style={box}>
              <strong>Weiterführende Angebote & Links</strong>
              <p style={small}>Zusätzliche Produktlinks und Kampagnenregeln kannst du bereits
                im bestehenden Kampagneneditor pflegen. Diese Wizard-Felder werden im Backend gespeichert.</p>
              <button type="button" style={btn} onClick={() => onOpenSection("campaigns")}>
                Kampagneneditor öffnen
              </button>
            </div>
          </div>}

          {stage === 3 && <div>
            <h3 style={{ margin: "0 0 4px" }}>Verbinde deine Tools</h3>
            <p style={small}>Bei unterstützten Anbietern öffnet „Konto verbinden“ die offizielle
              Anmeldung. Funnel Pilot speichert keine Anbieter-Passwörter. „Autorisierung vorhanden“
              bedeutet noch nicht, dass Leads oder Kalendertermine synchronisiert werden.</p>
            <button type="button" style={{ ...btn, margin: "0 0 12px" }} onClick={reload}
              disabled={loading}>{loading ? "Prüfe…" : "Status aktualisieren"}</button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 12 }}>
              {PROVIDERS.map(connectTile)}
            </div>
            <div style={{ ...box, marginTop: 14, fontSize: 13 }}>
              <strong>Meta/WhatsApp:</strong> App-Freigabe, Webhooks und Embedded Signup werden
              separat sicher eingerichtet. Einfache Login-Buttons erscheinen erst,
              wenn diese Verbindung wirklich funktionsfähig ist. ManyChat bleibt bis zum
              kontrollierten Handoff unverändert.
            </div>
          </div>}

          {stage === 4 && <div>
            <h3 style={{ marginTop: 0 }}>Teste Funnel Pilot vor dem Start</h3>
            <p style={small}>Dashboard, Leads, Inbox, Termine und Follow-ups
              lassen sich lokal prüfen. Der Pete-Testchat verwendet weiterhin
              den bestehenden Single-Workspace, NICHT automatisch den neuen
              Coach-Entwurf. Echte Meta-Sends bleiben deaktiviert.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={primary} onClick={onOpenTestChat}>Pete-Testgespräch öffnen</button>
              <button type="button" style={btn} onClick={() => onOpenSection("inbox")}>Inbox / Human Takeover</button>
              <button type="button" style={btn} onClick={() => onOpenSection("ghosting")}>Follow-ups</button>
              <button type="button" style={btn} onClick={() => onOpenSection("appointments")}>Termine</button>
            </div>
            <div style={{ ...box, marginTop: 20 }}>
              <h4 style={{ marginTop: 0 }}>Kunden-Onboarding nach einem Kauf simulieren</h4>
              <p style={small}>Nur ein interner 499-€-Testkauf. Keine Zahlung und kein Versand.</p>
              <button type="button" style={btn} onClick={testPurchase} disabled={checkoutBusy}>
                {checkoutBusy ? "Simuliere…" : "Testkauf + Onboarding-Einladung prüfen"}
              </button>
              {checkout && <div style={{ marginTop: 12, whiteSpace: "pre-wrap", fontSize: 13,
                overflowWrap: "anywhere" }}>Testlead: {checkout.leadId}
                {"\n\n"}Nur vorbereitet, nicht versendet:
                {"\n"}{checkout.reply}
              </div>}
            </div>
          </div>}

          {stage === 5 && <div style={{ display: "grid", gap: 15 }}>
            <h2 style={{ margin: 0 }}>Dein Dashboard ist vorbereitet.</h2>
            <CoachProfilePreview settings={settings} />
            <p style={small}>Die Einstellungen lassen sich jederzeit ergänzen. Der
              Einrichtungsassistent aktiviert ausdrücklich noch keine externen Nachrichten.</p>
            <div style={box}>
              <strong>Einrichtungs- und Sicherheitsdiagnose</strong>
              <p style={{ ...small, fontWeight: 700, marginTop: 8 }}>
                {diagnostics.localTestReady
                  ? "Lokale Backend-Flags geprüft. Relay-Test und echte Zustellung bleiben separat offen."
                  : "Für den lokalen Test sind noch Prüfungen offen. Keine Live-Freigabe."}
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {diagnostics.checks.map(item => (
                  <div key={item.id} style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "9px 10px", borderRadius: 7, background: "#f8fafc",
                  }}>
                    <span aria-label={item.status === "ok" ? "geprüft" : "offen"} style={{
                      fontWeight: 800, color: item.status === "ok" ? "#15803d" : "#92400e",
                    }}>{item.status === "ok" ? "✓" : "○"}</span>
                    <div style={{ display: "grid", gap: 3, fontSize: 13 }}>
                      <strong>{item.label}</strong>
                      <span style={{ color: "#475569" }}>{item.detail}</span>
                      {item.nextStep && <span style={{ color: "#334155" }}>
                        <strong>Nächster Schritt:</strong> {item.nextStep}
                      </span>}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ ...small, marginTop: 12 }}>
                Diese Diagnose prüft Einstellungen und bekannte API-Statuswerte.
                Eine echte Terminbuchung oder Instagram-/WhatsApp-Zustellung
                kann sie nicht ersetzen.
              </p>
              <button type="button" style={btn} onClick={reload} disabled={loading}>
                {loading ? "Prüfe…" : "Diagnose aktualisieren"}
              </button>
            </div>
            <button type="button" style={{ ...primary, alignSelf: "start" }} onClick={onClose}>
              Zum Dashboard →
            </button>
          </div>}
          {message && <div role="status" style={{ marginTop: 13, padding: 10, borderRadius: 9,
            background: "#fff5d9", color: "#78350f", fontSize: 13 }}>{message}</div>}
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button type="button" style={btn} disabled={stage === 0}
            onClick={() => { setMessage(""); setStage(s => Math.max(0, s - 1)); }}>Zurück</button>
          <div style={small}>Schritt {stage + 1} von {STAGES.length}</div>
          {stage < STAGES.length - 1
            ? <button type="button" style={primary} onClick={next} disabled={saving}>
                {saving ? "Speichere…" : "Weiter →"}
              </button>
            : <button type="button" style={primary} onClick={onClose}>Dashboard öffnen</button>}
        </div>
      </div>
    </div>
  );
}
