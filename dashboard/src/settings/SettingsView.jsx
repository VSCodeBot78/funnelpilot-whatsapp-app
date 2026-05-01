import React from "react";
import {
  primaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";
import SettingsGeneralPanel from "./SettingsGeneralPanel";
import SettingsBotPanel from "./SettingsBotPanel";
import SettingsBookingPanel from "./SettingsBookingPanel";
import SettingsIntegrationPanel from "./SettingsIntegrationPanel";
import SettingsGhostingPanel from "./SettingsGhostingPanel";
import SettingsLegalPanel from "./SettingsLegalPanel";

function SectionHeader({ colors, title, text }) {
  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div
        style={{
          color: colors.sub,
          fontSize: 12,
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export default function SettingsView({
  colors,
  settings,
  settingsMessage,
  onSettingsChange,
  onSaveSettings,
  onResetSettings,
  ghostingConfig,
  ghostingMessage,
  onGhostingSlotChange,
  onGhostingMessageChange,
  onAddGhostingSlot,
  onRemoveGhostingSlot,
  onSaveGhostingConfig,
  onReloadGhostingConfig,
  onResetGhostingConfig,
}) {
  const safeSettings = {
    productName: "",
    adminName: "",
    adminRole: "",
    defaultTheme: "dark",
    brandHint: "",
    topbarSubtitle: "",
    footerText: "",
    assistantName: "",
    assistantRole: "",
    defaultBotTone: "",
    defaultLanguage: "de",
    fallbackReply:
      "Danke dir. Ich prüfe das kurz und melde mich sauber zurück.",
    qualificationPrompt: "",
    escalationHint: "",
    apiBaseUrl: "",
    defaultBookingProvider: "manual",
    bookingMode: "manual",
    defaultBookingUrl: "",
    bookingFallbackText: "",
    bookingConfirmationText: "",
    calendlyActive: false,
    calendlyBookingUrl: "",
    meetergoActive: false,
    meetergoBookingUrl: "",
    customProviderName: "",
    customBookingUrl: "",
    customWebhookUrl: "",
    webhookVerifyMode: "dev",
    lastCalendlyEvent: "",
    defaultMeetingType: "phone",
    videoProvider: "none",
    meetingHint: "",
    calendarProvider: "none",
    calendarId: "",
    whatsappProvider: "",
    phoneNumberId: "",
    webhookVerifyToken: "",
    tokenHint: "",
    privacyPolicyUrl: "",
    imprintUrl: "",
    ...((settings && typeof settings === "object") ? settings : {}),
  };

  const safeOnSettingsChange =
    typeof onSettingsChange === "function" ? onSettingsChange : () => {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Einstellungen</div>
          <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
            Die aktuelle Settings-Seite ist die interne Admin- und
            Owner-Konsole. Nicht für Drittzugriff gedacht.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSaveSettings}
            style={primaryButtonStyle(colors)}
          >
            Einstellungen speichern
          </button>
          <button
            type="button"
            onClick={onResetSettings}
            style={ghostButtonStyle(colors)}
          >
            Reset
          </button>
        </div>
      </div>

      {settingsMessage ? (
        <div
          style={{
            background: colors.panelSoft,
            border: `1px solid ${colors.border}`,
            padding: 12,
            fontSize: 12,
            color: colors.text,
          }}
        >
          {settingsMessage}
        </div>
      ) : null}

      <SectionHeader
        colors={colors}
        title="Workspace / Operative Einstellungen"
        text="Diese Werte betreffen sichtbares Branding, Texte und operative Defaults. Ein Teil davon kann später kontrolliert für Kunden oder Mandanten freigegeben werden."
      />

      <SettingsGeneralPanel
        colors={colors}
        settings={safeSettings}
        onSettingsChange={safeOnSettingsChange}
      />

      <SettingsLegalPanel
        colors={colors}
        settings={safeSettings}
        onSettingsChange={safeOnSettingsChange}
      />

      <SettingsBookingPanel
        colors={colors}
        settings={safeSettings}
        onSettingsChange={safeOnSettingsChange}
      />

      <SectionHeader
        colors={colors}
        title="System / Owner Einstellungen"
        text="Diese Werte bleiben später ausschließlich auf Owner- oder Superadmin-Ebene. Dazu gehören Integrationen, technische Zugänge und KI-/Provider-Konfigurationen."
      />

      <SettingsBotPanel
        colors={colors}
        settings={safeSettings}
        onSettingsChange={safeOnSettingsChange}
      />

      <SettingsIntegrationPanel
        colors={colors}
        settings={safeSettings}
        onSettingsChange={safeOnSettingsChange}
      />

      <SectionHeader
        colors={colors}
        title="Ghosting / Timing & Texte"
        text="Hier pflegst du Slots und Nachrichtentexte für die Ghosting-Logik zentral aus einer Quelle."
      />

      <SettingsGhostingPanel
        colors={colors}
        ghostingConfig={ghostingConfig}
        ghostingMessage={ghostingMessage}
        onGhostingSlotChange={onGhostingSlotChange}
        onGhostingMessageChange={onGhostingMessageChange}
        onAddGhostingSlot={onAddGhostingSlot}
        onRemoveGhostingSlot={onRemoveGhostingSlot}
        onSaveGhostingConfig={onSaveGhostingConfig}
        onReloadGhostingConfig={onReloadGhostingConfig}
        onResetGhostingConfig={onResetGhostingConfig}
      />
    </div>
  );
}
