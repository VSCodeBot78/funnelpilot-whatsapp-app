import React from "react";
import { inputStyle, secondaryButtonStyle } from "../theme/dashboardTheme";
import {
  AUTOMATION_TRIGGERS,
  getNormalizedAutomationDraft,
  parseAutomationKeywords,
} from "./campaignAutomation";

const sectionStyle = colors => ({
  border: `1px solid ${colors.border}`,
  background: colors.panelSoft,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
});
const textStyle = { fontSize: 12, fontWeight: 650, marginBottom: 4 };
const noteStyle = colors => ({ color: colors.sub, fontSize: 11, lineHeight: 1.5 });
const shortInput = colors => ({ ...inputStyle(colors), minWidth: 0, fontSize: 12 });
const textareaStyle = colors => ({ ...shortInput(colors), resize: "vertical", minHeight: 58 });

function Toggle({ active, colors, onChange, label }) {
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={active}
      onClick={() => onChange(!active)}
      style={{
        width: 43, minWidth: 43, height: 25, borderRadius: 18,
        border: `1px solid ${active ? colors.accent : colors.borderStrong}`,
        padding: 3, background: active ? colors.accent : colors.surface,
        display: "flex", justifyContent: active ? "flex-end" : "flex-start",
        cursor: "pointer",
      }}>
      <span style={{
        display: "block", width: 17, height: 17, borderRadius: "50%",
        background: active ? "#fff" : colors.sub,
      }} />
    </button>
  );
}

function Heading({ children, colors, desc }) {
  return (
    <div>
      <div style={{ color: colors.text, fontSize: 13, fontWeight: 700 }}>{children}</div>
      {desc ? <div style={noteStyle(colors)}>{desc}</div> : null}
    </div>
  );
}

export default function CampaignAutomationEditor({ colors, campaignForm, onCampaignFormChange }) {
  const draft = getNormalizedAutomationDraft(campaignForm);
  const change = (fields) => onCampaignFormChange(previous => ({
    ...previous,
    automationDraft: { ...getNormalizedAutomationDraft(previous), ...fields },
  }));
  const setTrigger = (key, enabled) => change({
    triggers: { ...draft.triggers, [key]: enabled },
  });
  const showComments = draft.triggers.comments;
  const input = shortInput(colors);
  const panel = sectionStyle(colors);
  const warning = {
    ...noteStyle(colors), padding: 11, border: `1px solid ${colors.border}`,
    background: colors.surface, lineHeight: 1.6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={warning}>
        <strong>Entwurf ohne Versand.</strong> Die hier gespeicherten Regeln lösen noch keine
        Instagram-Kommentare, DMs oder Nachfassnachrichten aus. Die geprüfte Meta-Anbindung
        und Freigabe folgen in Priorität 4.
      </div>

      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
          <div>
            <Heading colors={colors}>Kampagne aktiviert</Heading>
            <div style={noteStyle(colors)}>Konfiguration aktiv markieren. Noch keine Live-Automation.</div>
          </div>
          <Toggle active={draft.enabled} colors={colors} label="Kampagnenentwurf aktiv"
            onChange={enabled => change({ enabled })} />
        </div>
      </div>

      <div style={panel}>
        <Heading colors={colors} desc="Du kannst mehrere Auslöser einschalten. Kein verzweigter Funnel nötig.">
          1. Wann soll die Kampagne starten?
        </Heading>
        {AUTOMATION_TRIGGERS.map(source => (
          <div key={source.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, borderBottom: `1px solid ${colors.border}`, padding: "8px 0",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{source.label}</div>
              <div style={noteStyle(colors)}>{source.hint}</div>
            </div>
            <Toggle colors={colors} active={draft.triggers[source.key]}
              label={source.label} onChange={active => setTrigger(source.key, active)} />
          </div>
        ))}

        <label>
          <div style={textStyle}>Keyword(s), mit Komma getrennt</div>
          <input style={input} value={draft.keywords}
            onChange={e => change({ keywords: e.target.value })}
            placeholder="CHECK, KETO, BULLSHIT" />
          <div style={noteStyle(colors)}>
            Erkannte Begriffe: {parseAutomationKeywords(draft.keywords).join(", ") || "keine"}
          </div>
        </label>
        {showComments ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={textStyle}>Bei welchem Beitrag?</div>
            {[
              ["all", "Jeder Post oder Reel"],
              ["specific", "Bestimmter Post oder Reel"],
              ["next", "Nur nächster Post oder Reel"],
            ].map(([value, label]) => (
              <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="radio" checked={draft.commentScope === value}
                  onChange={() => change({ commentScope: value })} />
                {label}
              </label>
            ))}
            {draft.commentScope === "specific" ? (
              <input style={input} placeholder="Beitrags-ID(s), mit Komma getrennt"
                value={draft.specificPostIds}
                onChange={e => change({ specificPostIds: e.target.value })} />
            ) : null}
          </div>
        ) : null}
      </div>

      {showComments ? (
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Heading colors={colors} desc="Bis zu sechs kurze Varianten.">
              2. Öffentlich antworten
            </Heading>
            <Toggle colors={colors} active={draft.publicReplyEnabled}
              label="Öffentliche Kommentarantworten aktiv"
              onChange={publicReplyEnabled => change({ publicReplyEnabled })} />
          </div>
          {draft.publicReplyEnabled ? (
            <>
              {draft.publicReplies.map((reply, i) => (
                <div key={i} style={{ display: "flex", alignItems: "start", gap: 7 }}>
                  <input style={input} aria-label={`Antwortvariante ${i + 1}`}
                    value={reply}
                    onChange={e => {
                      const next = [...draft.publicReplies]; next[i] = e.target.value;
                      change({ publicReplies: next });
                    }} />
                  {draft.publicReplies.length > 1 ? (
                    <button type="button" style={secondaryButtonStyle(colors)}
                      aria-label={`Variante ${i + 1} entfernen`}
                      onClick={() => change({
                        publicReplies: draft.publicReplies.filter((_, index) => index !== i),
                      })}>×</button>
                  ) : null}
                </div>
              ))}
              {draft.publicReplies.length < 6 ? (
                <button type="button" style={secondaryButtonStyle(colors)}
                  onClick={() => change({ publicReplies: [...draft.publicReplies, ""] })}>
                  + Antwortvariante
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Heading colors={colors} desc="Eine kurze erste Nachricht, dann übernimmt Pete das freie Gespräch.">
            3. Eröffnungs-DM
          </Heading>
          <Toggle colors={colors} active={draft.openingMessageEnabled}
            label="Eröffnungs-DM aktiv"
            onChange={openingMessageEnabled => change({ openingMessageEnabled })} />
        </div>
        {draft.openingMessageEnabled ? (
          <>
            <textarea style={textareaStyle(colors)} aria-label="Eröffnungsnachricht"
              value={draft.openingMessage}
              onChange={e => change({ openingMessage: e.target.value })} />
            <label>
              <div style={textStyle}>Bestätigung / Button-Text</div>
              <input style={input} value={draft.confirmationLabel}
                onChange={e => change({ confirmationLabel: e.target.value })} />
            </label>
            <label>
              <div style={textStyle}>Ressource nach Bestätigung</div>
              <select style={input} value={draft.resourceKey}
                onChange={e => change({ resourceKey: e.target.value })}>
                <option value="check">Elternfitness Check</option>
                <option value="keto">Keto Guide</option>
                <option value="selfstarter">No Bullshit Selbststarter</option>
                <option value="none">Keine Ressource</option>
              </select>
            </label>
            <label>
              <div style={textStyle}>Nachricht zum verifizierten Link</div>
              <textarea style={textareaStyle(colors)} value={draft.linkMessage}
                onChange={e => change({ linkMessage: e.target.value })} />
            </label>
          </>
        ) : null}
      </div>

      <div style={panel}>
        <Heading colors={colors} desc="Nur, wenn der Lead keinen Kontaktstopp gesetzt hat und Meta das Senden gestattet.">
          4. Nachfassen
        </Heading>
        <label style={{ display: "flex", gap: 8, fontSize: 12 }}>
          <input type="radio" checked={draft.followupMode === "off"}
            onChange={() => change({ followupMode: "off" })} />
          Kein automatisches Nachfassen
        </label>
        <label style={{ display: "flex", gap: 8, fontSize: 12 }}>
          <input type="radio" checked={draft.followupMode === "when_allowed"}
            onChange={() => change({ followupMode: "when_allowed" })} />
          Einmal nachfassen, falls erlaubt und sinnvoll
        </label>
        {draft.followupMode === "when_allowed" ? (
          <>
            <label>
              <div style={textStyle}>Frühestens nach (Stunden)</div>
              <input type="number" min="1" max="24" style={input}
                value={draft.followupDelayHours}
                onChange={e => change({ followupDelayHours: Number(e.target.value) })} />
            </label>
            <textarea style={textareaStyle(colors)} aria-label="Nachfassnachricht"
              value={draft.followupText}
              onChange={e => change({ followupText: e.target.value })} />
            <div style={noteStyle(colors)}>
              Die Stundenangabe allein erlaubt keine DM. Spätere Ausführung prüft
              das jeweils geltende Meta-Fenster und den letzten echten Nutzerkontakt.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
