import React, { useState } from "react";
import { getNormalizedPeteCampaignConfig, PETE_CAMPAIGN_SOURCES } from "../utils/dashboardHelpers";
import { CAMPAIGN_FILTER_OPTIONS, filterCampaignDirectory } from "./campaignDirectory.js";

export default function CampaignList({
  colors,
  campaigns = [],
  activeCampaignId,
  onSelectCampaign,
  hasUnsavedChanges = false,
  busy = false,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleCampaigns = filterCampaignDirectory(campaigns, search, filter);

  return (
    <aside className="fp-campaign-directory"
      style={{ borderRight: `1px solid ${colors.border}` }}
      aria-label="Kampagnenverzeichnis">
      <div className="fp-campaign-directory-tools" style={{
        padding: 12, borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 9 }}>
          Deine Kampagnen ({campaigns.length})
        </div>
        <label style={{ display: "grid", gap: 5, fontSize: 11, color: colors.sub }}>
          Kampagne oder Keyword suchen
          <input
            type="search"
            aria-label="Kampagne oder Keyword suchen"
            placeholder="z. B. CHECK, KETO, Reel"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px",
              color: colors.text, background: colors.surface,
              border: `1px solid ${colors.borderStrong}` }}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 11,
          color: colors.sub, marginTop: 10 }}>
          Status
          <select aria-label="Kampagnen nach Status filtern"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", color: colors.text,
              background: colors.surface, border: `1px solid ${colors.borderStrong}` }}>
            {CAMPAIGN_FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <div aria-live="polite" style={{ fontSize: 11, color: colors.sub, marginTop: 8 }}>
          {visibleCampaigns.length} von {campaigns.length} Kampagnen angezeigt
        </div>
      </div>

      {visibleCampaigns.length === 0 &&
        <div role="status" style={{ padding: 14, color: colors.sub,
          fontSize: 12, lineHeight: 1.5 }}>
          Keine passende Kampagne. Suche oder Filter ändern.
        </div>}
      {visibleCampaigns.map((camp) => (
        <button
          key={camp.id}
          type="button"
          onClick={() => onSelectCampaign(camp.id)}
          disabled={busy}
          aria-current={activeCampaignId === camp.id ? "true" : undefined}
          className="fp-campaign-directory-item"
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            border: "none",
            borderBottom: `1px solid ${colors.border}`,
            borderLeft: activeCampaignId === camp.id ? "3px solid #ff914d" : "3px solid transparent",
            background: activeCampaignId === camp.id ? colors.hover : "transparent",
            color: colors.text,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {camp.name}
            {activeCampaignId === camp.id && hasUnsavedChanges &&
              <span style={{ fontWeight: 500, fontSize: 11, color: "#ffb684" }}>
                {" · "}Ungespeichert
              </span>}
          </div>
          <div style={{ color: colors.sub, fontSize: 11,
            marginTop: 4, lineHeight: 1.4 }}>
            {(() => {
              const config = getNormalizedPeteCampaignConfig(camp);
              const sourceNames = PETE_CAMPAIGN_SOURCES.filter(([id]) =>
                config.sources.includes(id)).map(([, label]) => label);
              const count = config.keywords.length;
              const flowStatus = config.flowDraftEnabled
                ? "Flow-Entwurf eingeschaltet (nicht live)"
                : "Flow-Entwurf pausiert";
              return sourceNames.length || count
                ? "Entwurf · " + [
                    flowStatus,
                    sourceNames.slice(0, 2).join(", "),
                    count ? `${count} Keyword${count === 1 ? "" : "s"}` : "",
                  ].filter(Boolean).join(" · ")
                : flowStatus + " · Einstiege noch nicht konfiguriert";
            })()}
          </div>
        </button>
      ))}
    </aside>
  );
}
