import React, { useEffect, useRef, useState } from "react";
import { getCampaignDraftChanges } from "./campaignDraftChanges.js";
import CampaignList from "./CampaignList";
import CampaignEditor from "./CampaignEditor";
import "./campaignsView.css";

export default function CampaignsView({
  colors,
  settings,
  campaigns = [],
  activeCampaignId,
  campaignForm,
  campaignFormBaseline,
  campaignMessage,
  campaignSaving,
  campaignLoading,
  onSelectCampaign,
  onCreateNewCampaign,
  onSaveCampaign,
  onDeleteCampaign,
  onCampaignFormChange,
  v2 = false,
}) {
  // Compare the current editable form to the last confirmed/loaded values.
  // A change reverted to its original value must not trigger a false warning.
  const hasUnsavedChanges = getCampaignDraftChanges(
    campaignForm, campaignFormBaseline, settings,
  );
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const editRevisionRef = useRef(0);
  const activeIdRef = useRef(activeCampaignId);
  activeIdRef.current = activeCampaignId;

  // The user changes selected campaign only after explicit navigation.
  // Clearing dirty state on a different ID avoids stale warnings.
  useEffect(() => {
    editRevisionRef.current += 1;
    setPendingNavigation(null);
  }, [activeCampaignId]);

  function trackFormChange(change) {
    editRevisionRef.current += 1;
    onCampaignFormChange(change);
  }

  function requestCampaignSelection(id) {
    if (id === activeCampaignId || campaignSaving || campaignLoading) return;
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: "select", id });
      return;
    }
    onSelectCampaign(id);
  }

  function requestCampaignCreation(templateId) {
    if (campaignSaving || campaignLoading) return;
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: "create", templateId });
      return;
    }
    onCreateNewCampaign(templateId);
  }

  async function saveCurrentCampaign() {
    if (campaignSaving || campaignLoading) return false;
    const startedOnId = activeCampaignId;
    const startedAtRevision = editRevisionRef.current;
    const saved = await onSaveCampaign();
    // Never clear dirty after a late save if the form was edited again.
    if (saved === true && activeIdRef.current === startedOnId &&
        startedAtRevision === editRevisionRef.current) {
      return true;
    }
    return false;
  }

  async function continuePendingNavigation(navigation) {
    if (!navigation) return;
    setPendingNavigation(null);
    if (navigation.type === "select") {
      onSelectCampaign(navigation.id);
    } else if (navigation.type === "create") {
      // On a failed backend create the original dirty form must stay intact.
      await onCreateNewCampaign(navigation.templateId);
    }
  }

  async function saveAndContinue() {
    const navigation = pendingNavigation;
    if (!navigation) return;
    const saved = await saveCurrentCampaign();
    if (saved) await continuePendingNavigation(navigation);
  }

  return (
    <section className={v2 ? "v2-native-page v2-native-campaigns" : undefined}
      style={v2 ? undefined : { background: colors.panel, border: `1px solid ${colors.border}` }}>
      {v2 && <header className="v2-native-section-head">
        <div>
          <span className="v2-eyebrow">KAMPAGNEN & AUTOMATION</span>
          <h2>Kampagnen verwalten</h2>
          <p>Erstellen, bearbeiten und im verbundenen Backend speichern. Einstiege und Pete bleiben in einem Arbeitsbereich.</p>
        </div>
        <span className="v2-native-counter">{campaigns.length} Kampagnen</span>
      </header>}
      {pendingNavigation && (
        <div className="fp-campaign-unsaved-guard" role="alertdialog"
          aria-label="Ungespeicherte Kampagnenänderungen"
          style={{ background: colors.panelSoft,
            borderBottom: `2px solid ${colors.borderStrong}`, color: colors.text }}>
          <strong>Du hast ungespeicherte Änderungen.</strong>
          <p style={{ margin: "5px 0 10px", fontSize: 12, lineHeight: 1.6 }}>
            {pendingNavigation.type === "select"
              ? "Beim Wechsel zur anderen Kampagne gehen sie verloren."
              : "Beim Anlegen einer neuen Kampagne gehen sie verloren."}
            {" "}Du kannst zuerst speichern, den Wechsel abbrechen oder die Änderungen verwerfen.
          </p>
          <div className="fp-campaign-unsaved-actions">
            <button type="button" disabled={campaignSaving || campaignLoading}
              onClick={saveAndContinue}>
              {campaignSaving ? "Speichere..." : "Speichern und fortfahren"}
            </button>
            <button type="button" disabled={campaignSaving || campaignLoading}
              onClick={() => setPendingNavigation(null)}>
              Zurück zum Bearbeiten
            </button>
            <button type="button" disabled={campaignSaving || campaignLoading}
              onClick={() => continuePendingNavigation(pendingNavigation)}>
              Änderungen verwerfen und fortfahren
            </button>
          </div>
        </div>
      )}
      <div className={v2 ? "fp-campaigns-layout v2-native-campaign-grid" : "fp-campaigns-layout"}>
        <CampaignList
          colors={colors}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={requestCampaignSelection}
          hasUnsavedChanges={hasUnsavedChanges}
          busy={campaignSaving || campaignLoading}
        />
        <CampaignEditor
          colors={colors}
          settings={settings}
          campaigns={campaigns}
          campaignForm={campaignForm}
          campaignMessage={campaignMessage}
          campaignSaving={campaignSaving}
          campaignLoading={campaignLoading}
          onCreateNewCampaign={requestCampaignCreation}
          onSaveCampaign={saveCurrentCampaign}
          onDeleteCampaign={onDeleteCampaign}
          onCampaignFormChange={trackFormChange}
        />
      </div>
    </section>
  );
}
