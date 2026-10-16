import React from "react";
import CampaignList from "./CampaignList";
import CampaignEditor from "./CampaignEditor";
import "./campaignsView.css";

export default function CampaignsView({
  colors,
  settings,
  campaigns = [],
  activeCampaignId,
  campaignForm,
  campaignMessage,
  campaignSaving,
  campaignLoading,
  onSelectCampaign,
  onCreateNewCampaign,
  onSaveCampaign,
  onDeleteCampaign,
  onCampaignFormChange,
}) {
  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="fp-campaigns-layout">
        <CampaignList
          colors={colors}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={onSelectCampaign}
        />

        <CampaignEditor
          colors={colors}
          settings={settings}
          campaignForm={campaignForm}
          campaignMessage={campaignMessage}
          campaignSaving={campaignSaving}
          campaignLoading={campaignLoading}
          onCreateNewCampaign={onCreateNewCampaign}
          onSaveCampaign={onSaveCampaign}
          onDeleteCampaign={onDeleteCampaign}
          onCampaignFormChange={onCampaignFormChange}
        />
      </div>
    </div>
  );
}
