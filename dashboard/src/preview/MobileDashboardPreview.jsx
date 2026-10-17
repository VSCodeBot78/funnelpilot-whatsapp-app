import React, { useState } from "react";
import CampaignsView from "../campaigns/campaignsView";
import { getDashboardColors } from "../theme/dashboardTheme";
import { DEMO_CAMPAIGNS, simulateEntry, simulateWebhook } from "./simulatedCampaigns.js";

// Separate, fake-data-only shell around the ACTUAL campaign editor components.
// No full AppDashboard, live Pete runtime, old mobile lab, or backend hooks.
const colors = getDashboardColors(true);
const blankOfferContext = {
  infoLink1Enabled: false, infoLink2Enabled: false,
  infoLink3Enabled: false, infoLink4Enabled: false,
  infoLink1Url: "", infoLink2Url: "", infoLink3Url: "", infoLink4Url: "",
};
const settings = Object.freeze({
  apiBaseUrl: "", calendarId: "", defaultBookingUrl: "",
  starterCheckoutUrl: "", onboardingBookingUrl: "",
  bookingPrompt: "", maxSuggestions: 2,
});
const start = () => structuredClone(DEMO_CAMPAIGNS);

export default function MobileDashboardPreview() {
  const [campaigns, setCampaigns] = useState(start);
  const [activeId, setActiveId] = useState("demo-check");
  const [draft, setDraft] = useState(() => structuredClone(DEMO_CAMPAIGNS[0]));
  const [view, setView] = useState("campaigns");
  const [message, setMessage] = useState("");

  function selectCampaign(id) {
    const next = campaigns.find((entry) => entry.id === id);
    if (!next) return;
    setActiveId(id);
    setDraft(structuredClone(next));
    setMessage("");
  }
  function createCampaign() {
    const id = "demo-" + Date.now();
    const next = {
      id, name: "Neue Demo-Kampagne", trigger: "",
      peteCampaign: { sources: [], keywords: [], openingText: "",
        followUpEnabled: false, reelTarget: "all", reelMediaIds: [] },
      offerContext: { ...blankOfferContext },
      useGlobalBookingDefaults: false,
      booking: { provider: "manual", externalBookingUrl: "",
        starterCheckoutUrl: "", onboardingBookingUrl: "" },
      followUp24h: "", followUp3d: "",
    };
    setCampaigns((current) => [...current, next]);
    setActiveId(id);
    setDraft(next);
    setMessage("Nur Demo: Neue Kampagne im Browser angelegt.");
  }
  function saveCampaign() {
    const safe = structuredClone(draft);
    setCampaigns((current) => current.map((c) => c.id === safe.id ? safe : c));
    setMessage("Nur Demo: Änderungen vorübergehend im Browser übernommen. Nach Neuladen zurückgesetzt.");
  }
  function deleteCampaign() {
    if (campaigns.length < 2) {
      setMessage("Mindestens eine Demo-Kampagne muss bleiben.");
      return;
    }
    const remaining = campaigns.filter((c) => c.id !== activeId);
    setCampaigns(remaining);
    setActiveId(remaining[0].id);
    setDraft(structuredClone(remaining[0]));
    setMessage("Demo-Kampagne entfernt. Kein Backend geändert.");
  }
  const previewEntry = async ({ source, messageText, mediaId }) =>
    simulateEntry(campaigns, { source, messageText, mediaId });
  const previewWebhook = async ({ channel, payload }) =>
    simulateWebhook(campaigns, { channel, payload });

  return (
    <div style={{ background: colors.bg, minHeight: "100vh", color: colors.text,
      fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <header style={{ background: colors.sidebar, borderBottom: `1px solid ${colors.border}`,
        padding: "15px clamp(14px, 3vw, 28px)", position: "sticky", top: 0, zIndex: 3 }}>
        <div style={{ maxWidth: 1200, margin: "auto", display: "flex",
          flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Funnel Pilot <span style={{ color: "#ff914d" }}>· Dashboard</span></div>
            <div style={{ fontSize: 11, color: colors.sub }}>Geschützte Mobilvorschau · synthetische Testdaten</div>
          </div>
          <span style={{ padding: "5px 9px", border: "1px solid #ff914d",
            color: "#ffb785", fontSize: 11, fontWeight: 700 }}>DEMO · KEIN LIVE-VERSAND</span>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "auto", padding: "14px clamp(12px, 3vw, 26px) 40px" }}>
        <div style={{ padding: 12, fontSize: 12, lineHeight: 1.6,
          border: `1px solid ${colors.border}`, background: colors.panel,
          marginBottom: 14 }}>
          <strong>Was du hier prüfen kannst:</strong> Das echte Kampagnen-Dashboard mit seinen Eingabefeldern,
          Keywords, Reel-Auswahl und Testvorschauen. Speichern gilt nur für diese Browser-Sitzung.
          Es gibt keine Kundendaten, keine Verbindung zum Backend, kein Pete-Livegespräch
          und keinen Instagram-/WhatsApp-Versand.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            ["overview", "Übersicht"],
            ["campaigns", "Kampagnen & Texte"],
          ].map(([id, label]) => (
            <button type="button" key={id} onClick={() => setView(id)}
              style={{ padding: "10px 12px", fontSize: 13, cursor: "pointer",
                color: colors.text, border: `1px solid ${colors.borderStrong}`,
                background: view === id ? colors.hover : colors.panel }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => {
            const restored = start();
            setCampaigns(restored); setActiveId(restored[0].id);
            setDraft(structuredClone(restored[0]));
            setMessage("Demo zurückgesetzt.");
          }} style={{ marginLeft: "auto", padding: "10px 12px", cursor: "pointer",
            color: colors.text, background: "transparent", border: `1px solid ${colors.border}` }}>
            Demo zurücksetzen
          </button>
        </div>
        {view === "overview" ? (
          <section style={{ background: colors.panel, padding: 18,
            border: `1px solid ${colors.border}`, lineHeight: 1.8 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Dashboard-Übersicht</h2>
            <p>Mobilvorschau für die Kampagnen-Einstellungen: {campaigns.length} künstliche Kampagnen.</p>
            <p>Postfach, echte Leads, KI-Testchat, Buchung und Live-Provider sind hier bewusst deaktiviert.</p>
            <button type="button" onClick={() => setView("campaigns")}
              style={{ padding: "10px 14px", cursor: "pointer",
                border: "none", color: "#fff", background: "#0e639c" }}>
              Kampagneneditor öffnen
            </button>
          </section>
        ) : (
          <CampaignsView
            colors={colors} settings={settings}
            campaigns={campaigns} activeCampaignId={activeId}
            campaignForm={draft} campaignMessage={message}
            campaignSaving={false} campaignLoading={false}
            onSelectCampaign={selectCampaign}
            onCreateNewCampaign={createCampaign}
            onSaveCampaign={saveCampaign}
            onDeleteCampaign={deleteCampaign}
            onCampaignFormChange={setDraft}
            previewEntry={previewEntry} previewWebhook={previewWebhook}
          />
        )}
        <p style={{ color: colors.sub, fontSize: 11, marginTop: 24 }}>
          Isolierte UI-Vorschau. Kein Einsatz echter Kundendaten oder Webhook-Inhalte.
          Nur synthetische Beispiele verwenden.
        </p>
      </main>
    </div>
  );
}
