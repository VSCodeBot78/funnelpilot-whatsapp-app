import React, { useEffect, useRef, useState } from "react";
import { inputStyle, secondaryButtonStyle } from "../theme/dashboardTheme";
import { previewCampaignWebhookInApi } from "../services/campaignsApi";

const REEL_EXAMPLE = JSON.stringify({
  object: "instagram",
  entry: [{
    changes: [{
      field: "comments",
      value: {
        id: "comment-demo-1",
        text: "CHECK",
        from: { id: "demo-user" },
        media: {
          id: "17851537767246649",
          media_product_type: "REELS",
        },
      },
    }],
  }],
}, null, 2);

const WHATSAPP_EXAMPLE = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      field: "messages",
      value: {
        messages: [{
          id: "wamid.synthetic-example",
          from: "synthetic-parent",
          type: "text",
          text: { body: "CHECK" },
          referral: { ctwa_clid: "synthetic-click" },
        }],
      },
    }],
  }],
}, null, 2);

export default function WebhookEventPreview({
  colors, apiBaseUrl, campaignDraftRevision,
  previewWebhook = previewCampaignWebhookInApi,
}) {
  const [channel, setChannel] = useState("instagram");
  const [payloadText, setPayloadText] = useState(REEL_EXAMPLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestSerial = useRef(0);

  function invalidatePreview() {
    requestSerial.current += 1;
    setResult(null);
    setError("");
    setLoading(false);
  }

  // Keep typed examples, but discard the preview when the edited draft changes.
  useEffect(() => {
    invalidatePreview();
  }, [apiBaseUrl, campaignDraftRevision]);
  useEffect(() => () => { requestSerial.current += 1; }, []);

  async function previewEvent() {
    const requestId = ++requestSerial.current;
    setResult(null);
    setError("");
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError("Ungültiges JSON. Bitte zuerst das Beispiel prüfen.");
      return;
    }
    setLoading(true);
    try {
      const nextResult = await previewWebhook({ apiBaseUrl, channel, payload });
      if (requestId === requestSerial.current) setResult(nextResult);
    } catch (cause) {
      if (requestId === requestSerial.current) {
        setError(cause instanceof Error ? cause.message : "Labor-Vorschau fehlgeschlagen");
      }
    } finally {
      if (requestId === requestSerial.current) setLoading(false);
    }
  }

  return (
    <div style={{ fontSize: 12, color: colors.text }}>
      <p style={{ color: colors.sub, lineHeight: 1.5 }}>
        Ausschließlich künstliche oder anonymisierte Meta-Beispiele einfügen.
        Die Vorschau erkennt die Herkunft und prüft die Kampagnenzuordnung.
        Sie schreibt keinem Kontakt und sendet keine Nachricht.
      </p>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Kanal</div>
      <select
        style={inputStyle(colors)}
        value={channel}
        onChange={(e) => {
          const nextChannel = e.target.value;
          invalidatePreview();
          setChannel(nextChannel);
          setPayloadText(nextChannel === "whatsapp" ? WHATSAPP_EXAMPLE : REEL_EXAMPLE);
        }}
      >
        <option value="instagram">Instagram</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
      <div style={{ fontWeight: 600, margin: "12px 0 6px" }}>Beispiel-Webhook (JSON)</div>
      <textarea
        style={{ ...inputStyle(colors), minHeight: 160, resize: "vertical", fontFamily: "monospace" }}
        value={payloadText}
        onChange={(e) => { invalidatePreview(); setPayloadText(e.target.value); }}
        maxLength={20000}
        spellCheck={false}
      />
      <button
        type="button"
        onClick={previewEvent}
        disabled={loading}
        style={{ ...secondaryButtonStyle(colors), marginTop: 10 }}
      >
        {loading ? "Prüfe..." : "Webhook nur simulieren"}
      </button>
      {error && <p style={{ marginTop: 10 }}>Prüfung fehlgeschlagen: {error}</p>}
      {result && (
        <div style={{
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          padding: 12,
          marginTop: 12,
          lineHeight: 1.7,
          wordBreak: "break-word",
        }}>
          <div><strong>Ereignis:</strong> {result.event.status} ({result.event.reason})</div>
          <div><strong>Herkunft:</strong> {result.event.source || "nicht verifizierbar"}</div>
          <div><strong>Media-ID:</strong> {result.event.mediaId || "-"}</div>
          <div><strong>Kampagnenprüfung:</strong> {result.preview?.status || "manuell prüfen"}</div>
          <div><strong>Kampagne:</strong> {result.preview?.matchedCampaignId || "-"}</div>
          {result.preview?.draftContext && (
            <div style={{ marginTop: 10 }}>
              <strong>Pete-Kontext aus der gespeicherten Kampagne (nur Vorschau)</strong>
              <div>Name: {result.preview.draftContext.campaignName || result.preview.draftContext.campaignId}</div>
              <div>Keyword: {result.preview.draftContext.matchedKeyword || "kein Keyword erforderlich"}</div>
              <div>Starttext: {result.preview.draftContext.openingText || "nicht hinterlegt"}</div>
              <div>Follow-up: {result.preview.draftContext.followUpDraftConfigured
                ? "nur als Entwurf" : "nicht vorgesehen"}</div>
            </div>
          )}
          <div><strong>Versand:</strong> gesperrt (Prüfmodus)</div>
        </div>
      )}
    </div>
  );
}
