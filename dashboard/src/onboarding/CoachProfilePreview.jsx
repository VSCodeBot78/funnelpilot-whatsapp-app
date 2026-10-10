import React from "react";
import { getCoachOnboardingPreview } from "./coachOnboardingPreview";

export default function CoachProfilePreview({ settings = {} }) {
  const profile = getCoachOnboardingPreview(settings);
  return (
    <section aria-label="Coach-Profil-Vorschau"
      style={{ border: "1px solid #dbe4ee", borderRadius: 12,
        padding: 15, background: "#f8fafc", color: "#17243b" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>Dein Coach-Profil – Vorschau</strong>
        <span style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>Nur Entwurf · nicht live</span>
      </div>
      <p style={{ fontSize: 12, color: "#64748b" }}>
        So sehen deine Eingaben aus. Dies ist weder eine KI-Antwort noch eine
        bestätigte Meta-Verbindung, ein gültiges Verkaufsangebot oder ein eigenes Coach-Konto.
      </p>
      <p style={{ fontSize: 12, fontWeight: 650, color: "#475569" }}>
        {profile.identitySource === "coach_draft"
          ? "Marke und Assistent stammen ausschließlich aus dem unveröffentlichten Coach-Entwurf."
          : "Achtung: Bei älteren Entwürfen stammen Marke und Assistent noch aus dem aktiven Workspace."}
      </p>
      <div style={{ display: "grid", gap: 5, fontSize: 13 }}>
        <div><b>Marke:</b> {profile.brand || "Noch nicht angegeben"}</div>
        <div><b>Betreiber:</b> {profile.operator || "Noch nicht angegeben"}</div>
        <div><b>Assistent:</b> {profile.assistant || "Noch nicht angegeben"} (muss als KI erkennbar sein)</div>
        <div><b>Zielgruppe:</b> {profile.audience || "Noch nicht angegeben"}</div>
        <div><b>Sprache:</b> {profile.tone || "Noch nicht angegeben"}</div>
        <div><b>Persönlicher Kontakt:</b> {profile.preferredContact || "Noch offen"}</div>
        {profile.welcomeLine && <div><b>Begrüßung als Entwurf:</b> {profile.welcomeLine}</div>}
        <div><b>Angebote:</b> {profile.offers.length
          ? profile.offers.map(item => [item.name, item.priceLabel, item.url].filter(Boolean).join(" · ")).join(" | ")
          : "Noch keine eigenen Entwürfe"}</div>
        <div><b>FAQ:</b> {profile.faqs.length} Frage-Antwort-Paare vorbereitet</div>
      </div>
      {profile.warnings.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "#fff7ed",
          border: "1px solid #fed7aa", borderRadius: 9 }}>
          <strong style={{ fontSize: 12 }}>Vor einer Coach-Freigabe beachten</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12 }}>
            {profile.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      <p style={{ marginBottom: 0, marginTop: 12, color: "#64748b", fontSize: 12 }}>
        Derzeit gibt es nur EINEN gemeinsamen lokalen Workspace. Ein eigenes Coach-Login,
        getrennte Daten und aktive eigene Angebote fehlen noch.
      </p>
    </section>
  );
}
