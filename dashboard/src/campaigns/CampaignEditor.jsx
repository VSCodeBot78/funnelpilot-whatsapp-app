import React from "react";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";
import CollapsibleSection from "../components/layout/common/CollapsibleSection";
import {
  getEffectiveCampaignBookingConfig,
  getNormalizedBookingConfig,
  getNormalizedOfferContext,
  getNormalizedEntryConfig,
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
  const offerContext = getNormalizedOfferContext(campaignForm);
  const entryConfig = getNormalizedEntryConfig(campaignForm);
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

  function updateOfferContextField(key, value) {
    onCampaignFormChange((prev) => ({
      ...prev,
      offerContext: {
        ...getNormalizedOfferContext(prev),
        [key]: value,
      },
    }));
  }

  function updateEntryConfigField(key, value) {
    onCampaignFormChange((prev) => ({
      ...prev,
      entryConfig: {
        ...getNormalizedEntryConfig(prev),
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

          <div
            style={{
              maxHeight: 900,
              overflow: "auto",
              paddingRight: 4,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <CollapsibleSection
              colors={colors}
              title="Grunddaten"
              description="Name, Trigger, Fallback-Slots und Einstiegsverhalten."
              defaultOpen
            >
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

            <div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={campaignForm.askNameFirst}
                  onChange={(e) => updateField("askNameFirst", e.target.checked)}
                />
                Vorname zuerst abfragen
              </label>
            </div>
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Conversation Entry / WhatsApp Start"
              description="Meta-Kontext, Einstiegstext und Fallback-Matching für neue WhatsApp-Leads."
              defaultOpen
            >
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
                    Einstiegskanal
                  </div>
                  <select
                    style={inputStyle(colors)}
                    value={entryConfig.entryChannel}
                    onChange={(e) => updateEntryConfigField("entryChannel", e.target.value)}
                  >
                    <option value="meta_ctwa">Meta Click-to-WhatsApp</option>
                    <option value="website_whatsapp_link">Website WhatsApp-Link</option>
                    <option value="qr_shortlink">QR / Shortlink</option>
                    <option value="organic_dm">Organisch / DM</option>
                    <option value="manual">Manuell</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                    Starter-Modus
                  </div>
                  <select
                    style={inputStyle(colors)}
                    value={entryConfig.starterMode}
                    onChange={(e) => updateEntryConfigField("starterMode", e.target.value)}
                  >
                    <option value="prefilled_message">Vorbefüllte Nachricht</option>
                    <option value="start_conversation_prompt">Start Conversation Prompt</option>
                    <option value="whatsapp_flow">WhatsApp Flow</option>
                    <option value="free_text">Freier Text</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Vorgeschlagene Einstiegsnachricht"
                  title="Vorgeschlagene Einstiegsnachricht"
                  text="Diese Nachricht ist bei Meta nur ein vorgeschlagener Einstieg. Leads können sie senden, ändern oder frei schreiben. FunnelPilot sollte deshalb nicht nur auf exakte Textübereinstimmung setzen."
                  placement="right"
                />
                <textarea
                  style={{ ...inputStyle(colors), minHeight: 86, resize: "vertical" }}
                  value={entryConfig.suggestedEntryMessage}
                  onChange={(e) =>
                    updateEntryConfigField("suggestedEntryMessage", e.target.value)
                  }
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Matching-Modus"
                  title="Matching-Modus"
                  text="Hybrid bedeutet: FunnelPilot versucht zuerst Meta-/CTWA-Kontext zu verwenden, dann die Einstiegsnachricht und fällt sonst auf den allgemeinen Startflow zurück."
                  placement="right"
                />
                <select
                  style={inputStyle(colors)}
                  value={entryConfig.matchingMode}
                  onChange={(e) => updateEntryConfigField("matchingMode", e.target.value)}
                >
                  <option value="hybrid">Hybrid</option>
                  <option value="referral_only">Nur Meta Referral</option>
                  <option value="text_only">Nur Text-Trigger</option>
                  <option value="fallback_only">Nur Fallback</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <FieldLabelWithInfo
                    label="Exakten Trigger erzwingen"
                    title="Exakten Trigger erzwingen"
                    text="Nur aktivieren, wenn diese Kampagne ausschließlich auf exakt gleiche Triggernachrichten reagieren soll. Für Meta Ads normalerweise ausgeschaltet lassen."
                    placement="right"
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={entryConfig.exactTriggerRequired}
                      onChange={(e) =>
                        updateEntryConfigField("exactTriggerRequired", e.target.checked)
                      }
                    />
                    aktiv
                  </label>
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="Trigger als Fallback verwenden"
                    title="Trigger als Fallback verwenden"
                    text="Wenn keine Meta-Referral-Daten vorhanden sind, darf FunnelPilot die vorgeschlagene Einstiegsnachricht zur Zuordnung verwenden."
                    placement="right"
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={entryConfig.triggerFallbackEnabled}
                      onChange={(e) =>
                        updateEntryConfigField("triggerFallbackEnabled", e.target.checked)
                      }
                    />
                    aktiv
                  </label>
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="CTWA Attribution aktivieren"
                    title="CTWA Attribution aktivieren"
                    text="Wenn Meta Click-to-WhatsApp Referral-Daten im Webhook mitsendet, sollen diese zur Kampagnenzuordnung und Lead-Herkunft gespeichert werden."
                    placement="right"
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={entryConfig.ctwaAttributionEnabled}
                      onChange={(e) =>
                        updateEntryConfigField("ctwaAttributionEnabled", e.target.checked)
                      }
                    />
                    aktiv
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                {[
                  ["Meta Ad ID", "metaAdId"],
                  ["Meta Ad Name", "metaAdName"],
                  ["Meta Campaign ID", "metaCampaignId"],
                  ["Meta Campaign Name", "metaCampaignName"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <FieldLabelWithInfo
                      label={label}
                      title={label}
                      text="Optional. Kann später genutzt werden, um eingehende WhatsApp-Leads genauer einer Meta-Anzeige oder Kampagne zuzuordnen."
                      placement="right"
                    />
                    <input
                      style={inputStyle(colors)}
                      value={entryConfig[key]}
                      onChange={(e) => updateEntryConfigField(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Fallback-Text bei unklarem Einstieg
                </div>
                <textarea
                  style={{ ...inputStyle(colors), minHeight: 76, resize: "vertical" }}
                  value={entryConfig.unknownEntryFallbackText}
                  onChange={(e) =>
                    updateEntryConfigField("unknownEntryFallbackText", e.target.value)
                  }
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Angebots- & Info-Kontext"
              description="Preisorientierung, Info-Links und interne Kampagnen-Notiz."
              defaultOpen
            >

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Preisantwort / Preisanfrage-Text"
                  title="Preisantwort"
                  text="Text, den Pete später als Orientierung nutzt, wenn ein Lead nach Preis, Kosten oder Investition fragt. Kein harter Verkaufstext, sondern eine ruhige Einordnung."
                  placement="right"
                />
                <textarea
                  style={{ ...inputStyle(colors), minHeight: 90, resize: "vertical" }}
                  value={offerContext.priceInquiryText}
                  onChange={(e) =>
                    updateOfferContextField("priceInquiryText", e.target.value)
                  }
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Info-Link 1 aktiv"
                  title="Info-Link 1 aktiv"
                  text="Wenn aktiv, darf dieser Link später im Bot-Kontext oder in Antworten verwendet werden. Wenn deaktiviert, bleibt der Link gespeichert, wird aber nicht genutzt."
                  placement="right"
                />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={offerContext.infoLink1Enabled}
                    onChange={(e) =>
                      updateOfferContextField("infoLink1Enabled", e.target.checked)
                    }
                  />
                  Info-Link 1 aktiv
                </label>
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
                  <FieldLabelWithInfo
                    label="Info-Link 1 Label"
                    title="Info-Link 1"
                    text="Primärer Link für diese Kampagne, z. B. Angebotsseite, Mainpage oder Strategiegespräch-Seite."
                    placement="right"
                  />
                  <input
                    style={inputStyle(colors)}
                    value={offerContext.infoLink1Label}
                    onChange={(e) =>
                      updateOfferContextField("infoLink1Label", e.target.value)
                    }
                  />
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="Info-Link 1 URL"
                    title="Info-Link 1"
                    text="Primärer Link für diese Kampagne, z. B. Angebotsseite, Mainpage oder Strategiegespräch-Seite."
                    placement="right"
                  />
                  <input
                    style={inputStyle(colors)}
                    value={offerContext.infoLink1Url}
                    onChange={(e) =>
                      updateOfferContextField("infoLink1Url", e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <FieldLabelWithInfo
                  label="Info-Link 2 aktiv"
                  title="Info-Link 2 aktiv"
                  text="Wenn aktiv, darf dieser zweite Link später verwendet werden. Wenn deaktiviert, bleibt der Link gespeichert, wird aber nicht genutzt."
                  placement="right"
                />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={offerContext.infoLink2Enabled}
                    onChange={(e) =>
                      updateOfferContextField("infoLink2Enabled", e.target.checked)
                    }
                  />
                  Info-Link 2 aktiv
                </label>
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
                  <FieldLabelWithInfo
                    label="Info-Link 2 Label"
                    title="Info-Link 2"
                    text="Optionaler zweiter Link, z. B. VSL, Webinar, kostenlose Anleitung oder weitere Info-Seite."
                    placement="right"
                  />
                  <input
                    style={inputStyle(colors)}
                    value={offerContext.infoLink2Label}
                    onChange={(e) =>
                      updateOfferContextField("infoLink2Label", e.target.value)
                    }
                  />
                </div>

                <div>
                  <FieldLabelWithInfo
                    label="Info-Link 2 URL"
                    title="Info-Link 2"
                    text="Optionaler zweiter Link, z. B. VSL, Webinar, kostenlose Anleitung oder weitere Info-Seite."
                    placement="right"
                  />
                  <input
                    style={inputStyle(colors)}
                    value={offerContext.infoLink2Url}
                    onChange={(e) =>
                      updateOfferContextField("infoLink2Url", e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <FieldLabelWithInfo
                  label="Interner Hinweis"
                  title="Interner Hinweis"
                  text="Nur interne Notiz für dich. Dieser Text ist nicht für Leads gedacht."
                  placement="right"
                />
                <textarea
                  style={{ ...inputStyle(colors), minHeight: 70, resize: "vertical" }}
                  value={offerContext.internalNote}
                  onChange={(e) =>
                    updateOfferContextField("internalNote", e.target.value)
                  }
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Booking / Buchungslogik"
              description="Kampagnenspezifische Buchungswerte, Provider und Links."
              defaultOpen={false}
            >

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
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Nachrichten / Fragen"
              description="Willkommenstext, Qualifizierungsfragen, Zielfrage und Hot-Lead-Text."
              defaultOpen
            >
            {[
              ["Willkommen", "welcome"],
              ["Frage 1", "q1"],
              ["Frage 2", "q2"],
              ["Frage 3", "q3"],
              ["Zielfrage", "goal"],
              ["Skala", "scale"],
              ["Heißer Lead", "hot"],
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
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Ghosting / Follow-ups"
              description="Kampagnennahe Follow-up-Texte."
              defaultOpen={false}
            >
            {[
              ["24h Follow-up", "followUp24h"],
              ["3 Tage Follow-up", "followUp3d"],
            ].map(([label, key]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</div>
                <textarea
                  style={{
                    ...inputStyle(colors),
                    minHeight: 80,
                    resize: "vertical",
                  }}
                  value={campaignForm[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                />
              </div>
            ))}
            </CollapsibleSection>
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
