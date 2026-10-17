import React, { useEffect, useState } from "react";
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
  // Explicit user edits are tracked separately from asynchronously loaded
  // scheduling defaults. Backend reads must not create false "unsaved" alerts.
  const [editedCampaignId, setEditedCampaignId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const hasUnsavedChanges = Boolean(campaignForm?.id) &&
    editedCampaignId === campaignForm.id;

  useEffect(() => {
    // Selection changes may also originate from a global dashboard reset.
    setEditedCampaignId(null);
    setPendingAction(null);
  }, [activeCampaignId]);

  function updateCampaignForm(next) {
    if (campaignForm?.id) setEditedCampaignId(campaignForm.id);
    onCampaignFormChange(next);
  }

  function selectCampaign(id) {
    if (!id || id === activeCampaignId || campaignSaving || campaignLoading) return;
    if (hasUnsavedChanges) {
      setPendingAction({ kind: "select", id });
      return;
    }
    onSelectCampaign(id);
  }

  function createCampaign(templateId) {
    if (campaignSaving || campaignLoading) return;
    if (hasUnsavedChanges) {
      setPendingAction({ kind: "create", templateId });
      return;
    }
    onCreateNewCampaign(templateId);
  }

  function confirmDiscard() {
    if (!pendingAction || campaignSaving || campaignLoading) return;
    const action = pendingAction;
    setPendingAction(null);
    setEditedCampaignId(null);
    if (action.kind === "select") onSelectCampaign(action.id);
    else if (action.kind === "create") onCreateNewCampaign(action.templateId);
  }

  async function saveCampaign() {
    if (campaignSaving || campaignLoading) return;
    const campaignId = campaignForm?.id;
    const confirmed = await onSaveCampaign();
    if (confirmed === true) {
      setEditedCampaignId((current) => current === campaignId ? null : current);
      setPendingAction(null);
    }
  }

  async function deleteCampaign() {
    const result = await onDeleteCampaign();
    if (result?.deletedCampaignId) {
      setEditedCampaignId(null);
      setPendingAction(null);
    }
    return result;
  }

  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      {hasUnsavedChanges && !pendingAction && (
        <p role="status" className="fp-campaign-dirty-banner">
          Ungespeicherte Änderungen in „{campaignForm.name}“.
          Bitte speichern, bevor du die Kampagne wechselst.
        </p>
      )}
      {pendingAction && (
        <div role="group" aria-label="Ungespeicherte Änderungen bestätigen"
          className="fp-campaign-discard-confirm"
          style={{ borderBottom: `1px solid ${colors.border}` }}>
          <strong>Änderungen noch nicht gespeichert.</strong>
          <p>Wenn du fortfährst, werden deine Änderungen an „{campaignForm.name}“ verworfen.</p>
          <div className="fp-campaign-discard-actions">
            <button type="button" onClick={confirmDiscard}
              disabled={campaignSaving || campaignLoading}>
              Änderungen verwerfen und fortfahren
            </button>
            <button type="button" onClick={() => setPendingAction(null)}>
              Abbrechen und weiterbearbeiten
            </button>
          </div>
        </div>
      )}
      <div className="fp-campaigns-layout">
        <CampaignList
          colors={colors}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={selectCampaign}
        />

        <CampaignEditor
          colors={colors}
          settings={settings}
          campaigns={campaigns}
          campaignForm={campaignForm}
          campaignMessage={campaignMessage}
          campaignSaving={campaignSaving}
          campaignLoading={campaignLoading}
          onCreateNewCampaign={createCampaign}
          onSaveCampaign={saveCampaign}
          onDeleteCampaign={deleteCampaign}
          onCampaignFormChange={updateCampaignForm}
        />
      </div>
    </div>
  );
}
