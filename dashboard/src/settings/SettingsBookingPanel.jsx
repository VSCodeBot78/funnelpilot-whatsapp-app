import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";

export default function SettingsBookingPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
}) {
  const safeSettings = {
    defaultBookingProvider: "manual",
    bookingMode: "manual",
    defaultBookingUrl: "",
    bookingFallbackText: "",
    bookingConfirmationText: "",
    bookingButtonLabel: "",
    bookingInternalHint: "",
    ...settings,
  };

  const currentBookingMode =
    safeSettings.bookingMode === "calendly"
      ? "provider"
      : safeSettings.bookingMode;

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
        Terminierung
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

          <div>
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

          <div>
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

          <div>
            <FieldLabelWithInfo
              label="Bestätigungstext"
              title="Bestätigungstext"
              text="Text, nachdem ein Termin erfolgreich eingetragen wurde."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.bookingConfirmationText}
              onChange={(e) =>
                updateField("bookingConfirmationText", e.target.value)
              }
              placeholder="z. B. Termin ist eingetragen."
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Button Label"
              title="Button Label"
              text="Text für den Buchungsbutton, den Nutzer später sehen."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.bookingButtonLabel}
              onChange={(e) => updateField("bookingButtonLabel", e.target.value)}
              placeholder="z. B. Termin buchen"
            />
          </div>

          <div>
            <FieldLabelWithInfo
              label="Interner Hinweis"
              title="Interner Hinweis"
              text="Nur für dich oder Admins sichtbar. Wird nicht an Leads gesendet."
              placement="right"
            />
            <input
              style={inputStyle(colors)}
              value={safeSettings.bookingInternalHint}
              onChange={(e) => updateField("bookingInternalHint", e.target.value)}
              placeholder="z. B. Owner only"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
