import React, { useState } from "react";
import { previewCampaignEntryInApi } from "../services/campaignsApi";
import WebhookEventPreview from "./WebhookEventPreview";
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
  getNormalizedPeteCampaignConfig,
  PETE_CAMPAIGN_SOURCES,
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
  const peteCampaign = getNormalizedPeteCampaignConfig(campaignForm);
  const [previewSource, setPreviewSource] = useState("instagram_dm");
  const [previewMessage, setPreviewMessage] = useState("CHECK");
  const [previewMediaId, setPreviewMediaId] = useState("");
  const [previewResponse, setPreviewResponse] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  async function checkCampaignEntry() {
    setPreviewLoading(true);
    setPreviewResponse(null);
    setPreviewError("");
    try {
      const result = await previewCampaignEntryInApi({
        apiBaseUrl: settings.apiBaseUrl,
        source: previewSource,
        messageText: previewMessage,
        mediaId: previewMediaId,
      });
      setPreviewResponse(result);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Vorschau nicht erreichbar");
    } finally {
      setPreviewLoading(false);
    }
  }
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

  function updatePeteCampaignField(key, value) {
    onCampaignFormChange((prev) => ({
      ...prev,
      peteCampaign: {
        ...getNormalizedPeteCampaignConfig(prev),
        [key]: value,
      },
    }));
  }

  function updateKeywordsDraft(raw) {
    onCampaignFormChange((prev) => {
      const parsed = raw.split(/[,;\n]/).map((word) => word.trim().toUpperCase());
      return {
        ...prev,
        peteCampaign: {
          ...getNormalizedPeteCampaignConfig(prev),
          keywords: getNormalizedPeteCampaignConfig({ peteCampaign: { keywords: parsed } }).keywords,
          // UI-only draft preserves commas/newlines while typing. Save normalizes it.
          _keywordDraft: raw,
        },
      };
    });
  }

  function updateReelIds(raw) {
    onCampaignFormChange((prev) => {
      const reelMediaIds = raw.split(/[,;\n]/).map((id) => id.trim());
      return {
        ...prev,
        peteCampaign: {
          ...getNormalizedPeteCampaignConfig(prev),
          reelMediaIds: getNormalizedPeteCampaignConfig({
            peteCampaign: { reelMediaIds },
          }).reelMediaIds,
          _reelMediaDraft: raw,
        },
      };
    });
  }

  function toggleEntrySource(sourceId) {
    updatePeteCampaignField(
      "sources",
      peteCampaign.sources.includes(sourceId)
        ? peteCampaign.sources.filter((id) => id !== sourceId)
        : [...peteCampaign.sources, sourceId],
    );
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

      <div>
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
              title="Kampagne"
              description="Name und Grundkonfiguration. Pete übernimmt das Gespräch, nicht ein Fragenkatalog."
              defaultOpen
            >
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Kampagnenname</div>
              <input
                style={inputStyle(colors)}
                value={campaignForm.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Pete-Einstiege"
              description="Einstieg, Auslöser und Starttext ohne starre A/B/C-Fragen."
              defaultOpen
            >
              <p style={{ color: colors.sub, fontSize: 12, lineHeight: 1.5 }}>
                Konfiguration als Entwurf. Die Verbindung zu Instagram-/WhatsApp-Automationen
                wird erst in Phase 4 freigegeben. Speichern sendet keine Nachricht.
              </p>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
                Auslöser auswählen (Mehrfachauswahl)
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                gap: 8, marginBottom: 16,
              }}>
                {PETE_CAMPAIGN_SOURCES.map(([id, label]) => (
                  <label key={id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    color: colors.text, fontSize: 12,
                    border: `1px solid ${colors.border}`, padding: "8px 10px",
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={peteCampaign.sources.includes(id)}
                      onChange={() => toggleEntrySource(id)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {peteCampaign.sources.includes("instagram_reel_comment") && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                    Welche Reels sollen berücksichtigt werden?
                  </div>
                  <select
                    style={inputStyle(colors)}
                    value={peteCampaign.reelTarget}
                    onChange={(e) => updatePeteCampaignField("reelTarget", e.target.value)}
                  >
                    <option value="all">Alle Reels</option>
                    <option value="specific">Nur ausgewählte Reels</option>
                  </select>
                  {peteCampaign.reelTarget === "specific" && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                        Reel-Media-IDs
                      </div>
                      <textarea
                        style={{ ...inputStyle(colors), minHeight: 58, resize: "vertical" }}
                        value={campaignForm.peteCampaign?._reelMediaDraft ?? peteCampaign.reelMediaIds.join(", ")}
                        onChange={(e) => updateReelIds(e.target.value)}
                        placeholder="17851537767246649, ..."
                      />
                      <p style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
                        Nur bestätigte numerische Media-IDs. Ohne Treffer wird keine Kampagne ausgewählt.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Keywords (z. B. CHECK, KETO, BULLSHIT)
              </div>
              <textarea
                style={{ ...inputStyle(colors), minHeight: 65, resize: "vertical" }}
                value={campaignForm.peteCampaign?._keywordDraft ?? peteCampaign.keywords.join(", ")}
                onChange={(e) => updateKeywordsDraft(e.target.value)}
                placeholder="CHECK, KETO, BULLSHIT"
              />
              <p style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
                Durch Komma oder Zeilenumbruch trennen. Keine automatischen Antworten,
                bevor die Phase-4-Routingprüfung bestanden ist.
              </p>

              <div style={{ fontWeight: 600, fontSize: 12, margin: "14px 0 6px" }}>
                Starttext für den Kampagneneinstieg
              </div>
              <textarea
                style={{ ...inputStyle(colors), minHeight: 95, resize: "vertical" }}
                value={peteCampaign.openingText}
                onChange={(e) => updatePeteCampaignField("openingText", e.target.value)}
                placeholder="Kurze, menschliche Begrüßung, wenn der Einstieg es erlaubt."
              />
              <p style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
                Danach führt Pete frei und kontextbezogen weiter.
                Der Starttext ist kein starres Gesprächsskript.
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Kampagnen-Einstieg testen"
              description="Nur lesen und vergleichen, keine Instagram-/WhatsApp-Nachrichten senden."
              defaultOpen={false}
            >
              <p style={{ color: colors.sub, fontSize: 12, lineHeight: 1.5 }}>
                Erst die Kampagne speichern, dann den Eingang simulieren.
                Die Vorschau prüft alle gespeicherten Kampagnen und findet
                Konflikte, bevor eine Automation aktiviert wird.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Einstieg</div>
                  <select
                    style={inputStyle(colors)}
                    value={previewSource}
                    onChange={(e) => { setPreviewSource(e.target.value); setPreviewResponse(null); }}
                  >
                    {PETE_CAMPAIGN_SOURCES.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Nachricht / Keyword</div>
                  <input
                    style={inputStyle(colors)}
                    value={previewMessage}
                    onChange={(e) => { setPreviewMessage(e.target.value); setPreviewResponse(null); }}
                    maxLength={2000}
                    placeholder="CHECK"
                  />
                </div>
              </div>
              {previewSource === "instagram_reel_comment" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                    Reel-Media-ID für die Vorschau
                  </div>
                  <input
                    style={inputStyle(colors)}
                    value={previewMediaId}
                    onChange={(e) => { setPreviewMediaId(e.target.value); setPreviewResponse(null); }}
                    placeholder="17851537767246649"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={checkCampaignEntry}
                disabled={previewLoading}
                style={{ ...secondaryButtonStyle(colors), marginTop: 12 }}
              >
                {previewLoading ? "Prüfe..." : "Einstieg nur simulieren"}
              </button>
              {previewError && (
                <p style={{ color: colors.text, fontSize: 12 }}>Prüfung fehlgeschlagen: {previewError}</p>
              )}
              {previewResponse && (
                <div style={{
                  marginTop: 12, padding: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface, color: colors.text, fontSize: 12,
                }}>
                  <strong>
                    {({
                      matched: "Eindeutiger Entwurfs-Treffer",
                      no_match: "Keine passende Kampagne",
                      ambiguous: "Mehrere Kampagnen: keine eindeutige Zuordnung",
                      manual_only: "Follower-Begrüßung nur manuell",
                      manual_review: "Herkunft unklar. Bitte manuell prüfen.",
                    })[previewResponse.status] || "Kein Ergebnis"}
                  </strong>
                  {previewResponse.matchedCampaignId && (
                    <div style={{ marginTop: 6 }}>Kampagne: {previewResponse.matchedCampaignId}</div>
                  )}
                  {previewResponse.candidateIds?.length > 1 && (
                    <div style={{ marginTop: 6 }}>Konflikt: {previewResponse.candidateIds.join(", ")}</div>
                  )}
                  {previewResponse.draftContext && (
                    <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                      <strong>Pete-Kontext aus der gespeicherten Kampagne (nur Vorschau)</strong>
                      <div>Name: {previewResponse.draftContext.campaignName || previewResponse.draftContext.campaignId}</div>
                      <div>Einstieg: {previewResponse.draftContext.source}</div>
                      <div>Keyword: {previewResponse.draftContext.matchedKeyword || "kein Keyword erforderlich"}</div>
                      <div>
                        Starttext: {previewResponse.draftContext.openingText || "nicht hinterlegt"}
                      </div>
                      <div>
                        Follow-up: {previewResponse.draftContext.followUpDraftConfigured
                          ? "als Entwurf konfiguriert" : "nicht vorgesehen"}
                      </div>
                      {previewResponse.draftContext.reelTarget && (
                        <div>
                          Reel-Auswahl: {previewResponse.draftContext.reelTarget === "specific"
                            ? "ausgewählte Reels" : "alle Reels"}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ color: colors.sub, marginTop: 8 }}>
                    Prüfmodus. Versand ist immer gesperrt. Auch vorbereitete Follow-ups werden nicht ausgelöst.
                  </div>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Webhook-Herkunft prüfen (Labor)"
              description="Anonymisiertes Webhook-Beispiel auswerten, ohne eine Nachricht zu senden."
              defaultOpen={false}
            >
              <WebhookEventPreview colors={colors} apiBaseUrl={settings.apiBaseUrl} />
            </CollapsibleSection>

            <CollapsibleSection
              colors={colors}
              title="Erweiterte WhatsApp-Zuordnung (Kompatibilität)"
              description="Bestehende Meta-CTWA-Felder für den späteren Übergang. Keine Steuerung der Gesprächsfragen."
              defaultOpen={false}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Bisheriger Text-Trigger (nur Altbestand)
                </div>
                <textarea
                  style={{ ...inputStyle(colors), minHeight: 65, resize: "vertical" }}
                  value={campaignForm.trigger || ""}
                  onChange={(e) => updateField("trigger", e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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

              {[1, 2, 3, 4].map((linkIndex) => {
                const enabledKey = `infoLink${linkIndex}Enabled`;
                const labelKey = `infoLink${linkIndex}Label`;
                const urlKey = `infoLink${linkIndex}Url`;

                return (
                  <div
                    key={linkIndex}
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: colors.panelSoft,
                      padding: 10,
                      marginBottom: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        marginBottom: 10,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(offerContext[enabledKey])}
                        onChange={(e) =>
                          updateOfferContextField(enabledKey, e.target.checked)
                        }
                      />
                      Info-Link {linkIndex} aktiv
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                        gap: 12,
                      }}
                    >
                      <div>
                        <FieldLabelWithInfo
                          label={`Info-Link ${linkIndex} Label`}
                          title={`Info-Link ${linkIndex}`}
                          text="Kurzer eindeutiger Name, damit Pete den Link dem richtigen Lead-Wunsch zuordnen kann."
                          placement="right"
                        />
                        <input
                          style={inputStyle(colors)}
                          value={offerContext[labelKey] || ""}
                          onChange={(e) =>
                            updateOfferContextField(labelKey, e.target.value)
                          }
                          placeholder="z. B. Elterncheck"
                        />
                      </div>

                      <div>
                        <FieldLabelWithInfo
                          label={`Info-Link ${linkIndex} URL`}
                          title={`Info-Link ${linkIndex}`}
                          text="Öffentliche URL. Änderungen werden vom Backend zur Laufzeit für Pete verwendet."
                          placement="right"
                        />
                        <input
                          style={inputStyle(colors)}
                          value={offerContext[urlKey] || ""}
                          onChange={(e) =>
                            updateOfferContextField(urlKey, e.target.value)
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

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
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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
                  label="5-Wochen-Coaching Checkout URL"
                  title="5-Wochen-Coaching Checkout URL"
                  text="Checkout-Link für den persönlichen 5-Wochen-Coaching-Einstieg (499 €). Nicht mit dem 14,95-€-Selbststarter verwechseln."
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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
              title="Optionales Nachfassen"
              description="Nur Vorlagen konfigurieren. Die Ausführung bleibt bis Phase 4 gesperrt."
              defaultOpen={false}
            >
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={peteCampaign.followUpEnabled}
                  onChange={(e) => updatePeteCampaignField("followUpEnabled", e.target.checked)}
                />
                Nachfass-Vorlagen für diese Kampagne vorbereiten
              </label>
              <p style={{ color: colors.sub, fontSize: 11, lineHeight: 1.5 }}>
                Diese Option aktiviert noch keine automatische Nachricht.
                Zustimmung, Stopp-Wunsch, Human Takeover und zulässige
                Versandfenster werden vor Phase 4 gesondert geprüft.
              </p>
              {peteCampaign.followUpEnabled && [
                ["Vorlage nach 24 Stunden", "followUp24h"],
                ["Vorlage nach 3 Tagen", "followUp3d"],
              ].map(([label, key]) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{label}</div>
                  <textarea
                    style={{ ...inputStyle(colors), minHeight: 75, resize: "vertical" }}
                    value={campaignForm[key] || ""}
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
