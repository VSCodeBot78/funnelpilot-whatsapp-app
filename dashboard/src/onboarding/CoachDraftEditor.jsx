import React from "react";
import { EMPTY_COACH_DRAFT } from "./coachOnboardingPreview";

const fieldStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 10px",
  border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13,
  background: "#fff", color: "#0f172a", marginTop: 5,
};
const btnStyle = {
  border: "1px solid #cbd5e1", borderRadius: 8,
  background: "#fff", color: "#0f172a", padding: "7px 11px",
  cursor: "pointer", fontWeight: 650, fontSize: 12,
};

export default function CoachDraftEditor({ value = EMPTY_COACH_DRAFT, onChange }) {
  const draft = { ...EMPTY_COACH_DRAFT, ...value };
  const offers = Array.isArray(draft.offers) ? draft.offers : [];
  const faqs = Array.isArray(draft.faqs) ? draft.faqs : [];
  function change(key, next) {
    onChange({ ...draft, version: 1, [key]: next });
  }
  function changeIdentity(key, next) {
    change("identity", {
      brandName: "", operatorName: "", assistantName: "", audience: "", tone: "",
      ...(draft.identity || {}),
      [key]: next,
    });
  }
  function editRow(key, idx, field, next) {
    const rows = key === "offers" ? offers : faqs;
    change(key, rows.map((row, i) => i === idx ? { ...row, [field]: next } : row));
  }
  function removeRow(key, idx) {
    const rows = key === "offers" ? offers : faqs;
    change(key, rows.filter((_, i) => i !== idx));
  }
  return (
    <section aria-label="Coach-Identität, Angebote und häufige Fragen" style={{ display: "grid", gap: 18 }}>
      <div style={{ padding: 14, border: "1px solid #dbe4ee", borderRadius: 12 }}>
        <h4 style={{ margin: "0 0 7px" }}>Coach-Identität als Entwurf</h4>
        <p style={{ fontSize: 12, color: "#64748b" }}>
          Nur für die Vorschau. Diese Felder ändern weder Jochens aktive Marke
          noch Pete, bestehende Leads oder versendete Nachrichten.
        </p>
        {[
          ["brandName", "Markenname", 120],
          ["operatorName", "Name des Coaches / Betreibers", 120],
          ["assistantName", "Name des KI-Assistenten", 80],
          ["audience", "Zielgruppe", 240],
          ["tone", "Markenstimme und Antwortstil", 420],
        ].map(([key, label, max]) => (
          <label key={key} style={{ display: "block", marginTop: 9, fontSize: 12, fontWeight: 700 }}>
            {label}
            <input style={fieldStyle} maxLength={max}
              value={draft.identity?.[key] || ""}
              onChange={e => changeIdentity(key, e.target.value)} />
          </label>
        ))}
      </div>
      <div style={{ padding: 14, border: "1px solid #dbe4ee", borderRadius: 12 }}>
        <h4 style={{ margin: "0 0 7px" }}>Kontakt und persönliche Begrüßung</h4>
        <p style={{ fontSize: 12, color: "#64748b" }}>Optionaler Entwurf für die spätere Coach-Einrichtung, noch keine automatische Nachricht.</p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
          Kontaktweg für persönliche Rückfragen (optional)
          <input style={fieldStyle} maxLength={180}
            value={draft.preferredContact || ""}
            placeholder="z. B. persönliche DM-Übernahme oder Team-E-Mail"
            onChange={e => change("preferredContact", e.target.value)}/>
        </label>
        <label style={{ display: "block", marginTop: 11, fontSize: 12, fontWeight: 700 }}>
          Eigener kurzer Willkommenssatz (optional)
          <textarea style={fieldStyle} rows={2} maxLength={420}
            value={draft.welcomeLine || ""}
            placeholder="Ich bin ... und unterstütze ... – noch nicht live."
            onChange={e => change("welcomeLine", e.target.value)}/>
        </label>
      </div>

      <section>
        <h4 style={{ margin: "0 0 5px" }}>Angebotsentwürfe <span style={{ fontWeight: 400 }}>({offers.length}/4)</span></h4>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          Preise und Links werden nur gespeichert und in der Vorschau angezeigt. Pete darf sie
          erst nach separater Angebotsprüfung und Freigabe verwenden.
        </p>
        {offers.map((offer, idx) => (
          <div key={idx} style={{ padding: 12, border: "1px solid #dbe4ee", borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 9, alignItems: "center" }}>
              <strong style={{ fontSize: 12 }}>Angebot {idx + 1}</strong>
              <button type="button" style={btnStyle} onClick={() => removeRow("offers", idx)}
                aria-label={`Angebot ${idx + 1} entfernen`}>Entfernen</button>
            </div>
            <div className="fp-coach-draft-grid">
              <label style={{ fontSize: 12 }}>Name
                <input style={fieldStyle} maxLength={100} value={offer.name || ""}
                  onChange={e => editRow("offers", idx, "name", e.target.value)}/>
              </label>
              <label style={{ fontSize: 12 }}>Preisangabe (optional)
                <input style={fieldStyle} maxLength={80} value={offer.priceLabel || ""}
                  placeholder="z. B. 499 € einmalig"
                  onChange={e => editRow("offers", idx, "priceLabel", e.target.value)}/>
              </label>
            </div>
            <label style={{ fontSize: 12, display: "block", marginTop: 9 }}>HTTPS-Link (optional)
              <input style={fieldStyle} maxLength={700} value={offer.url || ""}
                placeholder="https://..." onChange={e => editRow("offers", idx, "url", e.target.value)}/>
            </label>
          </div>
        ))}
        {offers.length < 4 && <button type="button" style={btnStyle}
          onClick={() => change("offers", [...offers, { name: "", priceLabel: "", url: "" }])}>
          + Angebot hinzufügen
        </button>}
      </section>

      <section>
        <h4 style={{ margin: "0 0 5px" }}>Häufige Fragen <span style={{ fontWeight: 400 }}>({faqs.length}/5)</span></h4>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          Schreibe einfache Antworten auf echte Kundenfragen. Medizinische Versprechen
          oder nicht freigegebene Konditionen gehören nicht hinein.
        </p>
        {faqs.map((faq, idx) => (
          <div key={idx} style={{ padding: 12, border: "1px solid #dbe4ee", borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9 }}>
              <strong style={{ fontSize: 12 }}>FAQ {idx + 1}</strong>
              <button type="button" style={btnStyle} onClick={() => removeRow("faqs", idx)}
                aria-label={`FAQ ${idx + 1} entfernen`}>Entfernen</button>
            </div>
            <label style={{ fontSize: 12, display: "block", marginTop: 7 }}>Frage
              <input style={fieldStyle} maxLength={240} value={faq.question || ""}
                onChange={e => editRow("faqs", idx, "question", e.target.value)}/>
            </label>
            <label style={{ fontSize: 12, display: "block", marginTop: 7 }}>Antwort
              <textarea style={fieldStyle} maxLength={700} rows={2}
                value={faq.answer || ""}
                onChange={e => editRow("faqs", idx, "answer", e.target.value)}/>
            </label>
          </div>
        ))}
        {faqs.length < 5 && <button type="button" style={btnStyle}
          onClick={() => change("faqs", [...faqs, { question: "", answer: "" }])}>
          + FAQ hinzufügen
        </button>}
      </section>
    </section>
  );
}
