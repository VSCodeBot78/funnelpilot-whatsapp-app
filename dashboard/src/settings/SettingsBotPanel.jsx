import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";

const baseTextareaStyle = (colors, minHeight) => ({
  ...inputStyle(colors),
  minHeight,
  resize: "vertical",
  lineHeight: 1.5,
});

const DEFAULT_FALLBACK_TEXT =
  "Da m\u00f6chte ich nichts Falsches sagen. Ich gebe das lieber an Jochen weiter, damit du eine saubere Antwort bekommst.";

const DEFAULT_ESCALATION_RULE =
  "Wenn der Lead medizinische Beschwerden schildert, rechtliche Fragen stellt, aggressiv wird, konkrete Preise verhandeln will oder deutlich zeigt, dass ein Mensch \u00fcbernehmen sollte.";

const DEFAULT_NO_GOS = [
  "- kein Druckverkauf",
  "- keine Diagnose",
  "- keine medizinischen Versprechen",
  "- keine Heilversprechen",
  "- keine unrealistischen Ergebnisse versprechen",
  "- keine aggressiven Closing-Techniken",
].join("\n");

export default function SettingsBotPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
  showBotSettings = true,
  showOpenAiSettings = true,
}) {
  const safeSettings = {
    assistantName: "Pete",
    assistantRole: "",
    defaultBotTone: "ruhig",
    defaultLanguage: "Deutsch",
    brandVoice: "Jochen-Sprache",
    answerLength: "kurz",
    fallbackReply: DEFAULT_FALLBACK_TEXT,
    qualificationPrompt: "",
    escalationHint: DEFAULT_ESCALATION_RULE,
    noGos: DEFAULT_NO_GOS,
    aiProvider: "OpenAI",
    aiModel: "gpt-4.1-mini",
    openAiApiKeyConfigured: false,
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
      {showBotSettings && showOpenAiSettings ? (
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          KI / Pete Einstellungen
        </div>
      ) : null}

      <div style={{ padding: 14 }}>
        {showBotSettings ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
          <div>
            <FieldLabelWithInfo
              label="Rollenname"
              title="Rollenname"
              text="Der interne Name des Bots. Dieser Name hilft bei der sp\u00e4teren Bot-Konfiguration, muss aber nicht zwingend gegen\u00fcber Leads genannt werden."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.assistantName}
              onChange={(event) => updateField("assistantName", event.target.value)}
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Sprache"
              title="Sprache"
              text="Legt fest, in welcher Sprache Pete standardm\u00e4\u00dfig antworten soll."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.defaultLanguage}
              onChange={(event) => updateField("defaultLanguage", event.target.value)}
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Tonalit\u00e4t"
              title="Tonalit\u00e4t"
              text="Legt fest, wie Pete grunds\u00e4tzlich antworten soll. Die Einstellung ersetzt nicht den Hauptprompt, sondern steuert nur die Grundrichtung."
              placement="right"
            />
            <select
              style={inputStyle(colors)}
              value={safeSettings.defaultBotTone}
              onChange={(event) => updateField("defaultBotTone", event.target.value)}
            >
              <option value="ruhig">ruhig</option>
              <option value="direkt">direkt</option>
              <option value="freundlich">freundlich</option>
              <option value="knapp">knapp</option>
            </select>
          </div>

          <div>
            <FieldLabelWithInfo
              label="Brand Voice"
              title="Brand Voice"
              text="Beschreibt die gew\u00fcnschte Markenstimme. F\u00fcr Eltern fit & vital ist das aktuell Jochen-Sprache: ruhig, klar, direkt und bodenst\u00e4ndig."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.brandVoice}
              onChange={(event) => updateField("brandVoice", event.target.value)}
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Antwortl\u00e4nge"
              title="Antwortl\u00e4nge"
              text="Legt fest, ob Pete eher kurze oder mittlere Antworten vorbereiten soll. F\u00fcr WhatsApp ist kurz meistens besser."
              placement="right"
            />
            <select
              style={inputStyle(colors)}
              value={safeSettings.answerLength}
              onChange={(event) => updateField("answerLength", event.target.value)}
            >
              <option value="kurz">kurz</option>
              <option value="mittel">mittel</option>
            </select>
          </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <FieldLabelWithInfo
                label="Eskalationsregel"
                title="Eskalationsregel"
                text="Legt fest, wann Pete nicht weiter automatisiert antworten soll und Jochen \u00fcbernehmen muss."
                placement="right"
              />
              <textarea
                style={baseTextareaStyle(colors, 78)}
                value={safeSettings.escalationHint}
                onChange={(event) => updateField("escalationHint", event.target.value)}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <FieldLabelWithInfo
                label="No-Gos"
                title="No-Gos"
                text="Grenzen, die Pete nicht \u00fcberschreiten darf. Wichtig f\u00fcr rechtliche, medizinische und vertriebliche Sicherheit."
                placement="right"
              />
              <textarea
                style={baseTextareaStyle(colors, 112)}
                value={safeSettings.noGos}
                onChange={(event) => updateField("noGos", event.target.value)}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <FieldLabelWithInfo
                label="Fallback-Text"
                title="Fallback-Text"
                text="Antwort, wenn Pete unsicher ist oder eine Situation nicht sauber automatisiert beantworten sollte."
                placement="right"
              />
              <textarea
                style={baseTextareaStyle(colors, 64)}
                value={safeSettings.fallbackReply}
                onChange={(event) => updateField("fallbackReply", event.target.value)}
              />
            </div>
          </>
        ) : null}

        {showOpenAiSettings ? (
          <div
          style={{
            marginTop: showBotSettings ? 16 : 0,
            paddingTop: showBotSettings ? 14 : 0,
            borderTop: showBotSettings ? `1px solid ${colors.border}` : "none",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            OpenAI / KI-Anbindung
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <FieldLabelWithInfo
                label="KI-Anbieter"
                title="KI-Anbieter"
                text="Aktuell ist nur OpenAI vorbereitet. Weitere Provider werden in diesem Schritt nicht aufgebaut."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.aiProvider}
                onChange={(event) => updateField("aiProvider", event.target.value)}
              >
                <option value="OpenAI">OpenAI</option>
              </select>
            </div>

            <div>
              <FieldLabelWithInfo
                label="OpenAI Modell"
                title="OpenAI Modell"
                text="Das verwendete OpenAI-Modell f\u00fcr sp\u00e4tere Bot-Antworten. Dieses Feld ist nicht geheim. F\u00fcr den ersten Eigenbetrieb wird das Modell bevorzugt serverseitig \u00fcber OPENAI_MODEL gesetzt."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.aiModel}
                onChange={(event) => updateField("aiModel", event.target.value)}
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="OpenAI API Key Status"
                title="OpenAI API Key Status"
                text="Der OpenAI API Key ist ein Secret und wird nicht im Dashboard angezeigt. F\u00fcr den ersten Serverbetrieb wird er sicher in der Backend-.env gesetzt."
                placement="right"
              />
              <input
                style={{
                  ...inputStyle(colors),
                  color: safeSettings.openAiApiKeyConfigured
                    ? colors.success
                    : colors.warning,
                }}
                value={safeSettings.openAiApiKeyConfigured ? "gesetzt" : "nicht gesetzt"}
                readOnly
              />
            </div>
          </div>

          <div style={{ color: colors.sub, fontSize: 12, marginTop: 10 }}>
            Wird serverseitig als ENV gesetzt. Bestehender Wert wird niemals angezeigt.
          </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
