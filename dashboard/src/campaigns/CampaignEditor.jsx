import React from "react";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";
import {
  getEffectiveCampaignBookingConfig,
  getNormalizedBookingConfig,
} from "../utils/dashboardHelpers";

export default function CampaignEditor({
  colors,
  settings,
  campaignForm,
  campaignMessage,
  campaignSaving,
  campaignLoading,
  onCreateNewCampaign,
  onSaveCampaign,
  onDeleteCampaign,
  onCampaignFormChange,
}) {
  const activeCampaignBooking = getNormalizedBookingConfig(campaignForm, settings);
  const effectiveBooking = getEffectiveCampaignBookingConfig(campaignForm, settings);
  const useGlobalBookingDefaults = campaignForm.useGlobalBookingDefaults === true;
  const campaignBookingInputStyle = {
    ...inputStyle(colors),
    opacity: useGlobalBookingDefaults ? 0.58 : 1,
  };

  function updateField(key, value) {
    onCampaignFormChange((prev) => ({ ...prev, [key]: value }));
  }

  function updateBookingField(key, value) {
    onCampaignFormChange((prev) => ({
      ...prev,
      booking: {
        ...getNormalizedBookingConfig(prev, settings),
        [key]: value,
      },
    }));
  }

  function renderEffectiveValue(label, value, hint) {
    return (
      <div>
        {hint ? (
          <FieldLabelWithInfo
            label={label}
            title={label}
            text={hint}
            placement="right"
          />
        ) : (
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            {label}
          </div>
        )}
        <div
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            minHeight: 34,
            padding: "8px 10px",
            fontSize: 12,
            wordBreak: "break-word",
          }}
        >
          {value || "-"}
        </div>
      </div>
    );
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
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>Kampagnen & Texte</div>
        <button
          type="button"
          onClick={onCreateNewCampaign}
          style={{
            border: `1px solid ${colors.borderStrong}`,
            background: colors.surface,
            color: colors.text,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Kampagne anlegen
        </button>
      </div>

      {campaignMessage ? (
        <div
          style={{
            margin: 12,
            padding: 10,
            border: `1px solid ${colors.border}`,
            background: colors.panelSoft,
            color: colors.text,
            fontSize: 12,
          }}
        >
          {campaignMessage}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          gap: 0,
        }}
      >
        <div />

        <div style={{ padding: 14 }}>
          <div style={{ color: colors.sub, fontSize: 12, marginBottom: 10 }}>
            Aktive Bearbeitung: {campaignForm.name}
          </div>

          <div style={{ maxHeight: 900, overflow: "auto", paddingRight: 4 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Name</div>
              <input
                style={inputStyle(colors)}
                value={campaignForm.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Auslöser / Trigger
              </div>
              <textarea
                style={{ ...inputStyle(colors), minHeight: 80, resize: "vertical" }}
                value={campaignForm.trigger}
                onChange={(e) => updateField("trigger", e.target.value)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Fallback Slot 1
                </div>
                <input
                  style={inputStyle(colors)}
                  value={campaignForm.slot1}
                  onChange={(e) => updateField("slot1", e.target.value)}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Fallback Slot 2
                </div>
                <input
                  style={inputStyle(colors)}
                  value={campaignForm.slot2}
                  onChange={(e) => updateField("slot2", e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={campaignForm.askNameFirst}
                  onChange={(e) => updateField("askNameFirst", e.target.checked)}
                />
                Vorname zuerst abfragen
              </label>
            </div>

            <div
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.panelSoft,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
                Buchungslogik
              </div>

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Globale Buchungs-Einstellungen verwenden"
                  title="Globale Buchungs-Einstellungen verwenden"
                  text="Wenn aktiv, nutzt diese Kampagne die zentralen Buchungs-Einstellungen aus den Provider-Einstellungen. Wenn deaktiviert, kannst du eigene Werte für diese Kampagne setzen."
                  placement="right"
                />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={useGlobalBookingDefaults}
                    onChange={(e) =>
                      updateField("useGlobalBookingDefaults", e.target.checked)
                    }
                  />
                  Globale Buchungs-Einstellungen verwenden
                </label>
              </div>

              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <FieldLabelWithInfo
                  label="Eigene Kampagnenwerte"
                  title="Eigene Kampagnenwerte"
                  text="Nutze eigene Kampagnenwerte nur, wenn diese Kampagne bewusst von den globalen Standards abweichen soll."
                  placement="right"
                  labelStyle={{ marginBottom: 8, fontWeight: 700 }}
                />

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Provider"
                  title="Buchungsquelle"
                  text="Wählt aus, wie die Terminbuchung abgewickelt wird: manuell, Calendly, meetergo oder custom."
                  placement="right"
                />
                <select
                  style={campaignBookingInputStyle}
                  value={activeCampaignBooking.provider}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("provider", e.target.value)}
                >
                  <option value="manual">manual</option>
                  <option value="calendly">calendly</option>
                  <option value="meetergo">meetergo</option>
                  <option value="custom">custom</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div>
                  <FieldLabelWithInfo
                    label="Meetingtyp"
                    title="Meetingtyp"
                    text="Wähle aus, ob es ein Telefontermin oder Videoanruf sein soll."
                    placement="right"
                  />
                  <select
                    style={campaignBookingInputStyle}
                    value={activeCampaignBooking.meetingType}
                    disabled={useGlobalBookingDefaults}
                    onChange={(e) => updateBookingField("meetingType", e.target.value)}
                  >
                    <option value="phone">phone</option>
                    <option value="video">video</option>
                  </select>
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="Video Provider"
                    title="Video Provider"
                    text="Wähle die Video-Plattform für virtuelle Termine. Für 'none' wird kein Videolink eingebunden."
                    placement="right"
                  />
                  <select
                    style={campaignBookingInputStyle}
                    value={activeCampaignBooking.videoProvider}
                    disabled={useGlobalBookingDefaults}
                    onChange={(e) => updateBookingField("videoProvider", e.target.value)}
                  >
                    <option value="none">none</option>
                    <option value="zoom">zoom</option>
                    <option value="meet">meet</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div>
                  <FieldLabelWithInfo
                    label="Dauer in Minuten"
                    title="Dauer"
                    text="Gib an, wie lange der Termin dauern soll. Wird für Slot-Generierung und Kalenderbuchungen verwendet."
                    placement="right"
                  />
                  <input
                    type="number"
                    style={campaignBookingInputStyle}
                    value={activeCampaignBooking.durationMinutes}
                    disabled={useGlobalBookingDefaults}
                    onChange={(e) =>
                      updateBookingField("durationMinutes", Number(e.target.value) || 15)
                    }
                  />
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="Max. Slot-Vorschläge"
                    title="Slot-Vorschläge"
                    text="Wie viele Termine sollen den Nutzer:innen als Auswahl angeboten werden?"
                    placement="right"
                  />
                  <input
                    type="number"
                    style={campaignBookingInputStyle}
                    value={activeCampaignBooking.maxSuggestions}
                    disabled={useGlobalBookingDefaults}
                    onChange={(e) =>
                      updateBookingField("maxSuggestions", Number(e.target.value) || 2)
                    }
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Kalender-ID / Referenz"
                  title="Kalender-ID"
                  text="Die Kalender-ID sagt dem System, in welchem Kalender der Termin angelegt werden soll."
                  placement="right"
                />
                <input
                  style={campaignBookingInputStyle}
                  value={activeCampaignBooking.calendarId}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("calendarId", e.target.value)}
                  placeholder="z. B. primary / team-calendar"
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Externe Buchungs-URL"
                  title="Externe URL"
                  text="Hier kann eine externe Buchungsseite oder Calendly-URL hinterlegt werden."
                  placement="right"
                />
                <input
                  style={campaignBookingInputStyle}
                  value={activeCampaignBooking.externalBookingUrl}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("externalBookingUrl", e.target.value)}
                  placeholder="z. B. Calendly / externe Buchungsseite"
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Booking Prompt"
                  title="Booking Prompt"
                  text="Der Text wird genutzt, um Nutzer:innen vor der Terminbuchung zu leiten oder zu informieren."
                  placement="right"
                />
                <textarea
                  style={{ ...campaignBookingInputStyle, minHeight: 90, resize: "vertical" }}
                  value={activeCampaignBooking.bookingPrompt}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("bookingPrompt", e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Starter Checkout URL"
                  title="Starter Checkout URL"
                  text="Link zur Bezahl- oder Checkout-Seite für das Startangebot. Wird später genutzt, wenn ein Lead direkt zum Einstieg geführt werden soll."
                  placement="right"
                />
                <input
                  style={campaignBookingInputStyle}
                  value={activeCampaignBooking.starterCheckoutUrl}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("starterCheckoutUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <FieldLabelWithInfo
                  label="Onboarding Booking URL"
                  title="Onboarding Booking URL"
                  text="Link zur Terminbuchung für das Onboarding nach Kauf oder Zusage."
                  placement="right"
                />
                <input
                  style={campaignBookingInputStyle}
                  value={activeCampaignBooking.onboardingBookingUrl}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("onboardingBookingUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div>
                <FieldLabelWithInfo
                  label="Notizen zur Buchung"
                  title="Notizen zur Buchung"
                  text="Interne Hinweise zur Buchungslogik dieser Kampagne. Wird nicht an Leads gesendet."
                  placement="right"
                  labelStyle={{ marginBottom: 6 }}
                />
                <textarea
                  style={{ ...campaignBookingInputStyle, minHeight: 70, resize: "vertical" }}
                  value={activeCampaignBooking.notes}
                  disabled={useGlobalBookingDefaults}
                  onChange={(e) => updateBookingField("notes", e.target.value)}
                />
              </div>
              </div>

              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  padding: 12,
                }}
              >
                <FieldLabelWithInfo
                  label="Effektive Buchungslogik"
                  title="Effektive Buchungslogik"
                  text="Zeigt, welche Buchungswerte diese Kampagne tatsächlich verwendet – entweder aus den globalen Einstellungen oder aus der Kampagne selbst."
                  placement="right"
                  labelStyle={{ marginBottom: 10, fontWeight: 700 }}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  {renderEffectiveValue(
                    "Effektiver Provider",
                    effectiveBooking.effectiveProvider,
                    "Der Anbieter, der für diese Kampagne tatsächlich verwendet wird.",
                  )}
                  {renderEffectiveValue(
                    "Effektiver Booking Modus",
                    effectiveBooking.effectiveBookingMode,
                  )}
                  {renderEffectiveValue(
                    "Effektive Booking URL",
                    effectiveBooking.effectiveBookingUrl,
                    "Der Link, der für diese Kampagne tatsächlich zur Buchung genutzt wird.",
                  )}
                  {renderEffectiveValue(
                    "Effektiver Meetingtyp",
                    effectiveBooking.effectiveMeetingType,
                  )}
                  {renderEffectiveValue(
                    "Effektiver Video Provider",
                    effectiveBooking.effectiveVideoProvider,
                  )}
                  {renderEffectiveValue(
                    "Effektive Dauer",
                    `${effectiveBooking.effectiveDurationMinutes} Minuten`,
                  )}
                  {renderEffectiveValue(
                    "Effektive max. Slot-Vorschläge",
                    effectiveBooking.effectiveMaxSuggestions,
                  )}
                  {renderEffectiveValue(
                    "Quelle",
                    effectiveBooking.source === "global"
                      ? "Globale Einstellungen"
                      : "Kampagnenwerte",
                  )}
                </div>
              </div>
            </div>

            {[
              ["Willkommen", "welcome"],
              ["Frage 1", "q1"],
              ["Frage 2", "q2"],
              ["Frage 3", "q3"],
              ["Zielfrage", "goal"],
              ["Skala", "scale"],
              ["Heißer Lead", "hot"],
              ["24h Follow-up", "followUp24h"],
              ["3 Tage Follow-up", "followUp3d"],
            ].map(([label, key]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</div>
                <textarea
                  style={{
                    ...inputStyle(colors),
                    minHeight: key === "welcome" || key === "hot" ? 110 : 80,
                    resize: "vertical",
                  }}
                  value={campaignForm[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 12,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={onSaveCampaign}
              disabled={campaignSaving || campaignLoading}
              style={primaryButtonStyle(colors)}
            >
              {campaignSaving ? "Speichert..." : "Kampagne speichern"}
            </button>

            <button
              type="button"
              onClick={onDeleteCampaign}
              style={secondaryButtonStyle(colors)}
            >
              Kampagne löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
