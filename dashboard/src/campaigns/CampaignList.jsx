import React, { useState } from "react";
import { getNormalizedPeteCampaignConfig, PETE_CAMPAIGN_SOURCES } from "../utils/dashboardHelpers";

export function filterCampaigns(campaigns, query) {
  const needle = String(query || "").trim().toLocaleLowerCase("de-DE");
  if (!needle) return campaigns;
  return campaigns.filter((camp) => {
    const config = getNormalizedPeteCampaignConfig(camp);
    const sourceNames = PETE_CAMPAIGN_SOURCES
      .filter(([id]) => config.sources.includes(id))
      .map(([, label]) => label);
    const searchable = [camp.name, ...config.keywords, ...sourceNames]
      .filter((value) => typeof value === "string")
      .join(" ").toLocaleLowerCase("de-DE");
    return searchable.includes(needle);
  });
}

export default function CampaignList({
  colors,
  campaigns = [],
  activeCampaignId,
  onSelectCampaign,
}) {
  const [query, setQuery] = useState("");
  const visible = filterCampaigns(campaigns, query);
  return (
    <aside className="fp-campaign-list"
      style={{ borderRight: `1px solid ${colors.border}` }}
      aria-label="Kampagnenliste">
      <div className="fp-campaign-search" style={{
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <label htmlFor="fp-campaign-search-input">
          Kampagne finden <span aria-hidden="true">({campaigns.length})</span>
        </label>
        <input type="search" id="fp-campaign-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, Keyword oder Einstieg"
          aria-label="Kampagnen nach Name, Keyword oder Einstieg durchsuchen"
          style={{ border: `1px solid ${colors.borderStrong}`,
            color: colors.text, background: colors.surface }} />
      </div>
      {visible.length === 0 && (
        <p role="status" className="fp-campaign-empty"
          style={{ color: colors.sub }}>Keine Kampagne gefunden.</p>
      )}
      {visible.map((camp) => {
        const config = getNormalizedPeteCampaignConfig(camp);
        const sourceNames = PETE_CAMPAIGN_SOURCES
          .filter(([id]) => config.sources.includes(id))
          .map(([, label]) => label);
        const count = config.keywords.length;
        const flowStatus = config.flowDraftEnabled
          ? "Flow-Entwurf eingeschaltet (nicht live)"
          : "Flow-Entwurf pausiert";
        const summary = sourceNames.length || count
          ? "Entwurf · " + [
              flowStatus,
              sourceNames.slice(0, 2).join(", "),
              count ? `${count} Keyword${count === 1 ? "" : "s"}` : "",
            ].filter(Boolean).join(" · ")
          : flowStatus + " · Einstiege noch nicht konfiguriert";
        return (
          <button key={camp.id}
            type="button"
            onClick={() => onSelectCampaign(camp.id)}
            aria-current={activeCampaignId === camp.id ? "true" : undefined}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              border: "none",
              borderBottom: `1px solid ${colors.border}`,
              background: activeCampaignId === camp.id ? colors.hover : "transparent",
              color: colors.text,
              cursor: "pointer",
            }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{camp.name}</div>
            <div style={{ color: colors.sub, fontSize: 11,
              marginTop: 4, lineHeight: 1.4 }}>
              {summary}
            </div>
          </button>
        );
      })}
    </aside>
  );
}
