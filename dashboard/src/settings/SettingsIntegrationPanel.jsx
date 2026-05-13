import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";
import InfoHint from "../components/layout/common/InfoHint";
import { getApiBaseUrl } from "../services/apiBase";

export default function SettingsIntegrationPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
}) {
  const safeSettings = {
    apiBaseUrl: "",
    whatsappProvider: "",
    phoneNumberId: "",
    webhookVerifyToken: "",
    calendarId: "",
    tokenHint: "",
    calendlyActive: false,
    calendlyBookingUrl: "",
    meetergoActive: false,
    meetergoBookingUrl: "",
    meetergoWebhookUrl: "",
    customProviderName: "",
    customBookingUrl: "",
    customWebhookUrl: "",
    webhookVerifyMode: "dev",
    lastCalendlyEvent: "",
    defaultMeetingType: "phone",
    videoProvider: "none",
    meetingHint: "",
    calendarProvider: "none",
    ...settings,
  };

  const apiBase = getApiBaseUrl(safeSettings.apiBaseUrl);
  const providerWebhookRoute = `${apiBase}/booking-events/provider`;
  const calendlyWebhookUrl = `${apiBase}/booking-events/calendly`;
  const webhookSecretStatus = safeSettings.webhookVerifyToken ? "gesetzt" : "nicht gesetzt";
  const calendarSyncStatus =
    safeSettings.calendarProvider === "none"
      ? "nicht verbunden"
      : "vorbereitet";
  const meetergoStatus =
    safeSettings.meetergoActive || safeSettings.meetergoBookingUrl
      ? "vorbereitet"
      : "noch nicht verbunden";
  const customStatus =
    safeSettings.customProviderName || safeSettings.customBookingUrl
      ? "vorbereitet"
      : "noch nicht verbunden";
  const currentBookingMode =
    safeSettings.bookingMode === "calendly"
      ? "provider"
      : safeSettings.bookingMode;

  function updateField(key, value) {
    onSettingsChange((prev) => ({ ...(prev || {}), [key]: value }));
  }

  const cardStyle = {
    background: colors.panelSoft,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 14,
  };

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
        Booking Provider / Integrationen
      </div>

      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Buchungs-Grundlogik
            </div>
            <InfoHint
              title="Buchungs-Grundlogik"
              text="Diese Einstellungen legen fest, wie Termine grundsätzlich gebucht werden und welcher Anbieter standardmäßig genutzt wird."
              placement="right"
            />
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
                label="Default Booking Provider"
                title="Default Booking Provider"
                text="Legt fest, welcher Buchungsanbieter standardmäßig genutzt wird. Beispiel: manuell, Calendly, meetergo oder custom."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.defaultBookingProvider}
                onChange={(e) => updateField("defaultBookingProvider", e.target.value)}
              >
                <option value="manual">manual</option>
                <option value="calendly">calendly</option>
                <option value="meetergo">meetergo</option>
                <option value="custom">custom</option>
              </select>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Booking Modus"
                title="Booking Modus"
                text="Legt fest, ob Termine manuell, über einen externen Link oder über einen verbundenen Anbieter gebucht werden."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={currentBookingMode}
                onChange={(e) => updateField("bookingMode", e.target.value)}
              >
                <option value="manual">manual</option>
                <option value="external_link">external_link</option>
                <option value="provider">provider</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Standard Booking URL"
                title="Standard Booking URL"
                text="Allgemeiner Buchungslink, falls in der Kampagne kein spezieller Link hinterlegt ist."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.defaultBookingUrl}
                onChange={(e) => updateField("defaultBookingUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Fallback Text"
                title="Fallback Text"
                text="Text, wenn kein passender Termin gefunden wird oder manuell eingegriffen werden soll."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.bookingFallbackText}
                onChange={(e) => updateField("bookingFallbackText", e.target.value)}
                placeholder="z. B. Wenn kein Slot passt, manuell melden."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Bestätigungstext"
                title="Bestätigungstext"
                text="Text, nachdem ein Termin erfolgreich eingetragen wurde."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.bookingConfirmationText}
                onChange={(e) => updateField("bookingConfirmationText", e.target.value)}
                placeholder="z. B. Termin ist eingetragen."
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Allgemeine Provider-Einstellungen
            </div>
            <InfoHint
              title="Provider Einstellungen"
              text="Diese Konfiguration bleibt provider-neutral und bereitet mehrere Buchungsanbieter vor. Calendly ist hier nur ein möglicher Anbieter von mehreren."
              placement="right"
            />
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
                label="API Base URL"
                title="API Base URL"
                text="Technische Backend-Adresse. Lokal meist localhost, später die Server-URL."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.apiBaseUrl}
                onChange={(e) => updateField("apiBaseUrl", e.target.value)}
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Provider Webhook Route"
                title="Provider Webhook Route"
                text="Technische Adresse, an die ein Anbieter später Buchungsereignisse senden kann."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={providerWebhookRoute}
                readOnly
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Calendar Provider"
                title="Calendar Provider"
                text="Legt fest, ob Termine später mit einem Kalender synchronisiert werden sollen."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.calendarProvider}
                onChange={(e) => updateField("calendarProvider", e.target.value)}
              >
                <option value="none">none</option>
                <option value="google">google</option>
                <option value="manual">manual</option>
              </select>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Kalender-ID"
                title="Kalender-ID"
                text="Technische Kalender-Referenz für spätere Kalender-Synchronisation."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.calendarId}
                onChange={(e) => updateField("calendarId", e.target.value)}
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Default Meeting Type"
                title="Default Meeting Type"
                text="Legt fest, ob Termine standardmäßig per Telefon, Video oder externem Link stattfinden."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.defaultMeetingType}
                onChange={(e) => updateField("defaultMeetingType", e.target.value)}
              >
                <option value="phone">phone</option>
                <option value="video">video</option>
                <option value="external_link">external_link</option>
                <option value="unknown">unknown</option>
              </select>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Video Provider"
                title="Video Provider"
                text="Nur relevant bei Videoterminen. Beispiel: Zoom oder Google Meet."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.videoProvider}
                onChange={(e) => updateField("videoProvider", e.target.value)}
              >
                <option value="none">none</option>
                <option value="zoom">zoom</option>
                <option value="google_meet">google_meet</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Standard Meeting Hinweis"
                title="Standard Meeting Hinweis"
                text="Interner oder später sichtbarer Hinweis zum Terminablauf."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.meetingHint}
                onChange={(e) => updateField("meetingHint", e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Sync Status"
                title="Sync Status"
                text="Zeigt, ob eine Kalender-Synchronisation vorbereitet oder verbunden ist."
                placement="right"
              />
              <div style={{ color: colors.text, fontSize: 12 }}>
                {calendarSyncStatus}
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Manual Provider
          </div>
          <div style={{ color: colors.sub, fontSize: 12 }}>
            Manual ist die einfache Option ohne externen Buchungsanbieter. Termine können hier manuell hinterlegt oder über Standardlinks gebucht werden.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Calendly Provider
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
                label="Calendly aktiv"
                title="Calendly aktiv"
                text="Schaltet Calendly als vorbereiteten Buchungsanbieter ein oder aus. Aktuell noch ohne echte API-Verbindung."
                placement="right"
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(safeSettings.calendlyActive)}
                  onChange={(e) => updateField("calendlyActive", e.target.checked)}
                />
                aktiviert
              </label>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Calendly Booking URL"
                title="Calendly Booking URL"
                text="Dein öffentlicher Calendly-Link, über den Leads später Termine buchen können."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.calendlyBookingUrl}
                onChange={(e) => updateField("calendlyBookingUrl", e.target.value)}
                placeholder="https://calendly.com/..."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Calendly Webhook URL"
                title="Calendly Webhook URL"
                text="Calendly Webhook Route, die später in Calendly hinterlegt werden kann."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={calendlyWebhookUrl}
                readOnly
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Webhook Verify Mode"
                title="Webhook Verify Mode"
                text="dev erlaubt lokale Tests ohne echte Signatur. strict ist später für den Livebetrieb mit Secret gedacht."
                placement="right"
              />
              <select
                style={inputStyle(colors)}
                value={safeSettings.webhookVerifyMode}
                onChange={(e) => updateField("webhookVerifyMode", e.target.value)}
              >
                <option value="dev">dev</option>
                <option value="strict">strict</option>
              </select>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Webhook Secret Status"
                title="Webhook Secret Status"
                text="Zeigt nur, ob ein Secret vorhanden ist. Das Secret selbst wird aus Sicherheitsgründen nicht angezeigt."
                placement="right"
              />
              <div style={{ color: colors.text, fontSize: 12 }}>
                {webhookSecretStatus}
              </div>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Letztes Calendly Event"
                title="Letztes Calendly Event"
                text="Zeigt das zuletzt empfangene Calendly-Event zur Kontrolle."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.lastCalendlyEvent || "-"}
                readOnly
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Meetergo Provider
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
                label="Meetergo aktiv"
                title="Meetergo aktiv"
                text="Schaltet meetergo als vorbereiteten Buchungsanbieter ein oder aus. Aktuell noch ohne echte API-Verbindung."
                placement="right"
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(safeSettings.meetergoActive)}
                  onChange={(e) => updateField("meetergoActive", e.target.checked)}
                />
                aktiviert
              </label>
            </div>

            <div>
              <FieldLabelWithInfo
                label="Meetergo Booking URL"
                title="Meetergo Booking URL"
                text="Öffentlicher Link für meetergo, falls später genutzt."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.meetergoBookingUrl}
                onChange={(e) => updateField("meetergoBookingUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Meetergo Webhook URL"
                title="Meetergo Webhook URL"
                text="Technische URL, an die meetergo später Buchungsereignisse senden kann."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={providerWebhookRoute}
                readOnly
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Webhook Secret Status"
                title="Webhook Secret Status"
                text="Zeigt nur, ob ein Secret vorhanden ist. Das Secret selbst wird aus Sicherheitsgründen nicht angezeigt."
                placement="right"
              />
              <div style={{ color: colors.text, fontSize: 12 }}>
                {webhookSecretStatus}
              </div>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Status"
                title="Meetergo Status"
                text="Zeigt an, ob Meetergo als vorbereiteter Buchungsanbieter aktiviert oder noch nicht verbunden ist."
                placement="right"
              />
              <div style={{ color: colors.text, fontSize: 12 }}>
                {meetergoStatus}
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Custom Provider
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
                label="Custom Provider Name"
                title="Custom Provider Name"
                text="Für andere Buchungsanbieter, die später über Link oder Webhook angebunden werden können."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.customProviderName}
                onChange={(e) => updateField("customProviderName", e.target.value)}
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Custom Booking URL"
                title="Custom Booking URL"
                text="Link, unter dem der benutzerdefinierte Anbieter später Termine anbieten kann."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.customBookingUrl}
                onChange={(e) => updateField("customBookingUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Custom Webhook URL"
                title="Custom Webhook URL"
                text="Technische Adresse für einen später angeschlossenen Custom-Anbieter."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.customWebhookUrl}
                onChange={(e) => updateField("customWebhookUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Provider Webhook Route"
                title="Provider Webhook Route"
                text="Technische Adresse, an die ein Anbieter später Buchungsereignisse senden kann."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={providerWebhookRoute}
                readOnly
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <FieldLabelWithInfo
                label="Status"
                title="Custom Provider Status"
                text="Zeigt an, ob ein custom provider vorbereitet oder noch nicht verbunden ist."
                placement="right"
              />
              <div style={{ color: colors.text, fontSize: 12 }}>
                {customStatus}
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Webhook & Token
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
                label="Webhook Verify Token"
                title="Webhook Verify Token"
                text="Sicherheitstoken, mit dem eingehende Webhooks später verifiziert werden."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.webhookVerifyToken}
                onChange={(e) => updateField("webhookVerifyToken", e.target.value)}
              />
            </div>

            <div>
              <FieldLabelWithInfo
                label="Token / API-Key Hinweis"
                title="Token / API-Key Hinweis"
                text="Hinweisfeld für technische Zugangsdaten. Echte Tokens später sicher speichern, nicht frei sichtbar."
                placement="right"
              />
              <input
                style={inputStyle(colors)}
                value={safeSettings.tokenHint}
                onChange={(e) => updateField("tokenHint", e.target.value)}
                placeholder="später sicher speichern"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
