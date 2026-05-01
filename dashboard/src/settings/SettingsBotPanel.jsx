import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";

export default function SettingsBotPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
}) {
  const safeSettings = {
    assistantName: "",
    assistantRole: "",
    defaultBotTone: "",
    defaultLanguage: "de",
    fallbackReply:
      "Danke dir. Ich prüfe das kurz und melde mich sauber zurück.",
    qualificationPrompt: "",
    escalationHint: "",
    ...settings,
  };

  function updateField(key, value) {
    onSettingsChange((prev) => ({ ...(prev || {}), [key]: value }));
  }

  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Bot / KI
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <FieldLabelWithInfo
              label="Assistant Name"
              title="Assistant Name"
              text="Name des Assistenten. Kann intern oder später gegenüber Leads verwendet werden."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.assistantName}
              onChange={(e) => updateField("assistantName", e.target.value)}
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Assistant Rolle"
              title="Assistant Role"
              text="Beschreibt die Aufgabe des Assistenten, zum Beispiel Qualifikation, Terminvorbereitung oder Support."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.assistantRole}
              onChange={(e) => updateField("assistantRole", e.target.value)}
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Standard Tonalität"
              title="Standard Tonalität"
              text="Grundton der Antworten. Beispiel: klar, ruhig, direkt."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.defaultBotTone}
              onChange={(e) => updateField("defaultBotTone", e.target.value)}
              placeholder="z. B. klar, ruhig, direkt"
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Standardsprache"
              title="Standardsprache"
              text="Sprache, in der das System standardmäßig antwortet."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.defaultLanguage}
              onChange={(e) => updateField("defaultLanguage", e.target.value)}
              placeholder="de"
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabelWithInfo
            label="Fallback Antwort"
            title="Fallback Antwort"
            text="Antwort, wenn das System eine Nachricht nicht sicher einordnen kann."
            placement="right"
          />
          <input
            style={inputStyle(colors)}
            value={safeSettings.fallbackReply}
            onChange={(e) => updateField("fallbackReply", e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabelWithInfo
            label="Qualifizierungs Prompt"
            title="Qualifizierungs Prompt"
            text="Anweisung, wie der Assistent Leads einordnen und qualifizieren soll. Bestimmt später, welche Fragen gestellt und wie Antworten bewertet werden."
            placement="right"
          />
          <input
            style={inputStyle(colors)}
            value={safeSettings.qualificationPrompt}
            onChange={(e) => updateField("qualificationPrompt", e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabelWithInfo
            label="Eskalations Hinweis"
            title="Eskalations Hinweis"
            text="Interner Hinweis, wann der Assistent nicht weiter automatisch reagieren soll und ein Mensch übernehmen sollte."
            placement="right"
          />
          <input
            style={inputStyle(colors)}
            value={safeSettings.escalationHint}
            onChange={(e) => updateField("escalationHint", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
