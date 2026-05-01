import React from "react";

export default function CampaignList({
  colors,
  campaigns = [],
  activeCampaignId,
  onSelectCampaign,
}) {
  return (
    <div style={{ borderRight: `1px solid ${colors.border}` }}>
      {campaigns.map((camp) => (
        <button
          key={camp.id}
          type="button"
          onClick={() => onSelectCampaign(camp.id)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            border: "none",
            borderBottom: `1px solid ${colors.border}`,
            background: activeCampaignId === camp.id ? colors.hover : "transparent",
            color: colors.text,
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{camp.name}</div>
          <div
            style={{
              color: colors.sub,
              fontSize: 11,
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {camp.trigger}
          </div>
        </button>
      ))}
    </div>
  );
}
