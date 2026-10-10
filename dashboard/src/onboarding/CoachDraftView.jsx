import React, { useCallback, useEffect, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import {
  emptyCoachDraft, editableCoachDraft, coachDraftChecklist, coachDraftCompletion,
} from "./coachDraftPresentation";

const STEPS = ["Marke", "Pete", "Angebote & Links", "Vorschau"];
const EMPTY_OFFER = { name: "", forWhom: "", priceText: "", linkUrl: "" };

export default function CoachDraftView({
  colors,
  apiBaseUrl = "",
  onOpenSetup = () => {},
}) {
  const [draft, setDraft] = useState(emptyCoachDraft);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setBlocked(true);
    setMessage("");
    try {
      const response = await fetch(buildApiUrl("/coach-onboarding-draft", apiBaseUrl), {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error("Entwurf nicht abrufbar");
      setDraft(editableCoachDraft(body.draft));
      setLastSaved(body.draft.updatedAt || null);
      setDirty(false);
      setIssues([]);
      setBlocked(false);
    } catch {
      setMessage("Gespeicherte Coach-Vorlage nicht lesbar. Backend prüfen; nichts überschreiben.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  function edit(section, key, value) {
    setDraft(current => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
    setDirty(true);
    setMessage("");
  }

  function editOffer(index, key, value) {
    setDraft(current => ({
      ...current,
      offers: current.offers.map((offer, at) =>
        at === index ? { ...offer, [key]: value } : offer),
    }));
    setDirty(true);
    setMessage("");
  }

  async function save() {
    if (saving || loading || blocked) return;
    setSaving(true);
    setMessage("");
    setIssues([]);
    try {
      // Only allowlisted draft data is sent. NEVER send settings, secrets,
      // channel enable flags, campaign IDs or real conversation content.
      const response = await fetch(buildApiUrl("/coach-onboarding-draft", apiBaseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editableCoachDraft(draft)),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        if (Array.isArray(body.issues)) setIssues(body.issues.slice(0, 15));
        throw new Error("Bitte markierte Felder prüfen. Die Vorlage wurde nicht gespeichert.");
      }
      setDraft(editableCoachDraft(body.draft));
      setLastSaved(body.draft.updatedAt || null);
      setDirty(false);
      setMessage("Coach-Vorlage gespeichert. Pete und die Verkaufswege bleiben unverändert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message :
        "Speichern fehlgeschlagen. Bestehender Entwurf bleibt erhalten.");
    } finally {
      setSaving(false);
    }
  }

  const form = {
    background: colors.panel, border: "1px solid " + colors.border,
    borderRadius: 12, padding: 17,
  };
  const fieldStyle = {
    boxSizing: "border-box", width: "100%", minWidth: 0, padding: "10px 12px",
    color: colors.text, background: colors.surface,
    border: "1px solid " + colors.border, borderRadius: 8,
    fontSize: 14,
  };
  const buttonStyle = {
    background: colors.panelSoft, color: colors.text,
    border: "1px solid " + colors.border, borderRadius: 9,
    padding: "10px 13px", fontSize: 13, cursor: "pointer",
  };
  const primary = { ...buttonStyle, background: colors.accent, color: "#fff",
    borderColor: colors.accent, fontWeight: 750 };
  const tip = { color: colors.sub, fontSize: 12, lineHeight: 1.5 };
  const section = { display: "grid", gap: 14 };

  function field(label, group, key, { multiline = false, hint = "", rows = 3 } = {}) {
    const value = draft[group][key];
    const id = "coach-" + group + "-" + key;
    return (
      <label key={id} htmlFor={id} style={{ display: "grid", gap: 5, fontWeight: 650,
        fontSize: 13, minWidth: 0 }}>
        {label}
        {multiline
          ? <textarea id={id} rows={rows} style={fieldStyle}
              value={value} placeholder={hint}
              onChange={event => edit(group, key, event.target.value)}/>
          : <input id={id} type="text" style={fieldStyle}
              value={value} placeholder={hint}
              onChange={event => edit(group, key, event.target.value)}/>}
      </label>
    );
  }

  if (loading) {
    return <section style={form} aria-live="polite">Coach-Vorlage wird geladen …</section>;
  }
  const review = coachDraftCompletion(draft);
  const list = coachDraftChecklist(draft);
  return (
    <div className="fp-coach-draft" style={{ display: "grid", gap: 15, maxWidth: 940 }}>
      <header style={form}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Coach-Onboarding vorbereiten</h1>
        <p style={tip}>
          Einfache Vorlage für einen späteren Coach. Dieses System hat aktuell nur
          einen Arbeitsbereich. Die Vorlage wird NICHT auf Pete übertragen, aktiviert
          keine Angebote und versendet keine Nachrichten.
        </p>
        <div style={{ ...tip, fontWeight: 750, marginTop: 9 }}>
          Status: Entwurf, nicht aktiv {dirty ? " · ungespeicherte Änderungen" : ""}
        </div>
        {lastSaved && <div style={{ ...tip, marginTop: 4 }}>
          Zuletzt gespeichert: {new Date(lastSaved).toLocaleString("de-DE")}
        </div>}
      </header>

      <nav aria-label="Coach-Einrichtung" className="fp-coach-steps">
        {STEPS.map((title, at) => (
          <button type="button" key={title} onClick={() => setStep(at)}
            aria-current={at === step ? "step" : undefined}
            style={{ ...buttonStyle, fontWeight: at === step ? 750 : 500,
              borderColor: at === step ? colors.accent : colors.border }}>
            {at + 1}. {title}
          </button>
        ))}
      </nav>

      {step === 0 && <section style={form}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>1. Marke und Zielgruppe</h2>
        <p style={tip}>Trage die Angaben des Coaches ein. Die Website ist freiwillig.</p>
        <div style={section}>
          {field("Markenname", "brand", "name", { hint: "Beispiel: Coachingstudio" })}
          {field("Name des Coaches", "brand", "coachName")}
          {field("Schwerpunkt / Nische", "brand", "niche")}
          {field("Zielgruppe", "brand", "audience",
            { multiline: true, rows: 2, hint: "Für wen ist die Begleitung gedacht?" })}
          {field("Website (optional, HTTPS)", "brand", "websiteUrl", { hint: "https://…" })}
        </div>
      </section>}

      {step === 1 && <section style={form}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>2. Pete an den Coach anpassen</h2>
        <p style={tip}>
          Name, Kommunikation und Übergaberegeln. Feste Schutzregeln wie STOP,
          Human-Handover und medizinische Grenzen werden dadurch nicht überschrieben.
        </p>
        <div style={section}>
          {field("Name des KI-Assistenten", "assistant", "name", { hint: "z. B. Nora" })}
          {field("Sprache", "assistant", "language")}
          {field("Markenstimme", "assistant", "voice",
            { multiline: true, rows: 2, hint: "Natürlich, klar, kurze Antworten" })}
          {field("Wann soll ein Mensch übernehmen?", "assistant", "escalation",
            { multiline: true })}
          {field("No-Gos und fachliche Grenzen", "assistant", "boundaries",
            { multiline: true })}
          {field("Drei häufige Einwände (optional, je Zeile)", "assistant", "objections",
            { multiline: true, rows: 3 })}
        </div>
      </section>}

      {step === 2 && <section style={form}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>3. Angebote und sichere Links</h2>
        <p style={tip}>
          Maximal drei Angebote. Preise immer exakt so erfassen, wie der Coach
          sie freigegeben hat. Leere Preisfelder bleiben unbekannt, es werden
          keine Rabatte, Raten oder Konditionen ergänzt. Links nur mit HTTPS.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {draft.offers.map((offer, index) => (
            <div key={index} style={{ ...form, background: colors.panelSoft }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontSize: 15, marginTop: 0 }}>Angebot {index + 1}</h3>
                <button type="button" style={buttonStyle}
                  onClick={() => { setDraft(current => ({
                    ...current, offers: current.offers.filter((_, i) => i !== index),
                  })); setDirty(true); }}>
                  Angebot entfernen
                </button>
              </div>
              <div style={section}>
                {[
                  ["Angebotsname", "name"],
                  ["Für wen?", "forWhom"],
                  ["Exakte Preisangabe (optional)", "priceText"],
                  ["Angebots- oder Kauf-Link (HTTPS)", "linkUrl"],
                ].map(([label, key]) => (
                  <label key={key} style={{ display: "grid", gap: 5, fontSize: 13,
                    fontWeight: 650 }}>
                    {label}
                    <input style={fieldStyle} value={offer[key]}
                      placeholder={key === "priceText" ? "Nicht bekannt / leer lassen" : ""}
                      onChange={event => editOffer(index, key, event.target.value)}/>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {draft.offers.length < 3 && <button type="button" style={buttonStyle}
            onClick={() => { setDraft(current => ({
              ...current, offers: [...current.offers, { ...EMPTY_OFFER }],
            })); setDirty(true); }}>
            + Angebot hinzufügen
          </button>}
        </div>
        <h3 style={{ fontSize: 16, marginTop: 20 }}>Nützliche Links (optional)</h3>
        <div style={section}>
          {field("Guide / PDF", "links", "guideUrl", { hint: "https://…" })}
          {field("Check / Selbsttest", "links", "checkUrl", { hint: "https://…" })}
          {field("Video / Mini-Webinar", "links", "videoUrl", { hint: "https://…" })}
          {field("Buchungslink", "links", "bookingUrl", { hint: "https://…" })}
        </div>
      </section>}

      {step === 3 && <section style={form}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>4. Profil prüfen</h2>
        <p style={tip}>
          Diese Vorschau erzeugt keine KI-Antwort und greift auf keine realen DMs zu.
          Sie zeigt nur die erfassten Angaben.
        </p>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          {review.checked} von {review.total} Profil-Bausteinen ausgefüllt
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          {list.map(item => <div key={item.label} style={{ color: item.complete ?
            colors.text : colors.warning, fontSize: 13 }}>
            {item.complete ? "✓" : "○"} {item.label}
          </div>)}
        </div>
        <div style={{ ...form, background: colors.panelSoft, marginTop: 14,
          display: "grid", gap: 7 }}>
          <strong>{draft.brand.name || "Noch kein Markenname"}</strong>
          <span style={tip}>Coach: {draft.brand.coachName || "Noch offen"}</span>
          <span style={tip}>Zielgruppe: {draft.brand.audience || "Noch offen"}</span>
          <span style={tip}>KI-Assistenz: {draft.assistant.name || "Noch offen"}</span>
          <span style={tip}>Kommunikation: {draft.assistant.voice || "Noch offen"}</span>
          <span style={tip}>Menschliche Übergabe: {draft.assistant.escalation || "Noch offen"}</span>
          <strong style={{ fontSize: 13, marginTop: 8 }}>Angebote (unbestätigte Vorlage)</strong>
          {draft.offers.filter(offer => offer.name.trim()).length === 0
            ? <span style={tip}>Noch keine Angebote eingetragen</span>
            : draft.offers.filter(offer => offer.name.trim()).map((offer, i) =>
              <span key={i} style={tip}>
                {offer.name} · {offer.priceText || "Preis nicht eingetragen"}
              </span>)}
        </div>
        <p style={{ ...tip, fontWeight: 700, marginTop: 12 }}>
          Auch bei vollständig ausgefülltem Profil ist keine Freigabe für Live-Sends,
          Coach-Login, Preisnennung durch Pete oder einen zweiten Workspace erteilt.
        </p>
      </section>}

      {issues.length > 0 && <section role="alert" style={{ ...form,
        borderColor: colors.warning }}>
        <strong>Bitte folgende Eingaben prüfen:</strong>
        <ul>{issues.map((issue, index) =>
          <li key={index}>{issue.field}: {issue.message}</li>)}</ul>
      </section>}
      {message && <div role="status" style={{ ...form, color: colors.text }}>
        {message}
      </div>}
      {blocked && <div role="alert" style={form}>
        Die bestehende Vorlage kann nicht sicher geladen werden. Speichern bleibt
        gesperrt, bis der Backend-Status geprüft wurde.
      </div>}
      <div className="fp-coach-actions" style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button type="button" style={buttonStyle} disabled={step === 0}
          onClick={() => setStep(current => Math.max(0, current - 1))}>Zurück</button>
        {step < STEPS.length - 1 && <button type="button" style={buttonStyle}
          onClick={() => setStep(current => Math.min(STEPS.length - 1, current + 1))}>
          Weiter
        </button>}
        <button type="button" onClick={save} disabled={saving || blocked}
          style={primary}>{saving ? "Speichert…" : "Vorlage speichern"}</button>
        <button type="button" style={buttonStyle} onClick={load}
          disabled={saving}>Gespeicherten Stand laden</button>
        <button type="button" style={buttonStyle} onClick={onOpenSetup}>
          Bestehende Einrichtung öffnen
        </button>
      </div>
    </div>
  );
}
