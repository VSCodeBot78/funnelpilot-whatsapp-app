import React from "react";
import {
  primaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";
import CollapsibleSection from "../components/layout/common/CollapsibleSection";
import SettingsGeneralPanel from "./SettingsGeneralPanel";
import SettingsBotPanel from "./SettingsBotPanel";
import SettingsBookingPanel from "./SettingsBookingPanel";
import SettingsIntegrationPanel from "./SettingsIntegrationPanel";
import SettingsGhostingPanel from "./SettingsGhostingPanel";
import SettingsLegalPanel from "./SettingsLegalPanel";

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
    assistantName: "Pete",
    assistantRole: "",
    defaultBotTone: "ruhig",
    defaultLanguage: "Deutsch",
    brandVoice: "Jochen-Sprache",
    answerLength: "kurz",
    fallbackReply:
      "Da m\u00f6chte ich nichts Falsches sagen. Ich gebe das lieber an Jochen weiter, damit du eine saubere Antwort bekommst.",
    qualificationPrompt: "",
    escalationHint:
      "Wenn der Lead medizinische Beschwerden schildert, rechtliche Fragen stellt, aggressiv wird, konkrete Preise verhandeln will oder deutlich zeigt, dass ein Mensch \u00fcbernehmen sollte.",
    noGos:
      "- kein Druckverkauf\n- keine Diagnose\n- keine medizinischen Versprechen\n- keine Heilversprechen\n- keine unrealistischen Ergebnisse versprechen\n- keine aggressiven Closing-Techniken",
    aiProvider: "OpenAI",
    aiModel: "gpt-4.1-mini",
    openAiApiKeyConfigured: false,
    openAiModelConfigured: true,
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

      <CollapsibleSection
        colors={colors}
        title="Allgemein"
        description="Workspace, Branding und sichtbare Admin-Basisdaten."
        defaultOpen
      >
        <SettingsGeneralPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="Rechtliches"
        description="Rechtliche Betreiberlinks und produktive Pflichtangaben."
        defaultOpen
      >
        <SettingsLegalPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="KI / Pete Einstellungen"
        description="Bot-Leitplanken, Tonalität, Eskalation und No-Gos."
        defaultOpen
      >
        <SettingsBotPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
          showOpenAiSettings={false}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="OpenAI / KI-Anbindung"
        description="Modell und Secret-Status. Secrets werden nicht angezeigt."
        defaultOpen={false}
      >
        <SettingsBotPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
          showBotSettings={false}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="Provider / Buchung"
        description="Buchungsanbieter, Standardlinks und Terminierungs-Defaults."
        defaultOpen={false}
      >
        <SettingsBookingPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="Webhook & Token / Integrationen"
        description="Provider-Routen, Token-Status, Calendly, Meetergo und Custom-Anbieter."
        defaultOpen={false}
      >
        <SettingsIntegrationPanel
          colors={colors}
          settings={safeSettings}
          onSettingsChange={safeOnSettingsChange}
        />
      </CollapsibleSection>

      <CollapsibleSection
        colors={colors}
        title="Ghosting / Timing & Texte"
        description="Follow-up-Zyklen, Slots und Nachrichtentexte."
        defaultOpen={false}
      >
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
      </CollapsibleSection>
    </div>
  );
}
