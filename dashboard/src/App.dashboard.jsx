import React, { useCallback, useEffect, useState } from "react";
import { getDashboardColors } from "./theme/dashboardTheme";
import {
  getNormalizedBookingConfig,
  getDefaultBookingData,
} from "./utils/dashboardHelpers";
import { useLeads } from "./hooks/useLeads";
import { useInbox } from "./hooks/useInbox";
import { useCampaigns, createInitialCampaigns } from "./hooks/useCampaigns";
import { useGhostingConfig } from "./hooks/useGhostingConfig";
import { useAvailabilityConfig } from "./hooks/useAvailabilityConfig";
import { useSettingsConfig, defaultSettings } from "./hooks/useSettingsConfig";
import { useGhostingRuntime } from "./hooks/useGhostingRuntime";
import { useBackendHealth } from "./hooks/useBackendHealth";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import InboxView from "./inbox/InboxView";
import CampaignsView from "./campaigns/CampaignsView";
import LeadsView from "./leads/LeadsView";
import AppointmentsShell from "./appointments/AppointmentsShell";
import SettingsView from "./settings/SettingsView";
import GhostingView from "./ghosting/GhostingView";
import DashboardHome from "./dashboard/DashboardHome";
import BookingEventsDebugView from "./booking-events/BookingEventsDebugView";

const navItems = [
  { key: "dashboard", label: "Dashboard" },
  { key: "campaigns", label: "Kampagnen" },
  { key: "leads", label: "Leads" },
  { key: "inbox", label: "Inbox" },
  { key: "ghosting", label: "Ghosting" },
  { key: "appointments", label: "Termine" },
  { key: "booking-events", label: "Booking Events" },
  { key: "settings", label: "Einstellungen" },
];

export default function AppDashboard() {
  const [section, setSection] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [activeContactId, setActiveContactId] = useState(null);
  const [openChatTabs, setOpenChatTabs] = useState([]);

  const {
    settings,
    setSettings,
    settingsMessage,
    darkMode,
    setDarkMode,
    loadSettingsConfig,
    saveSettings,
    resetSettings,
    userInitial,
  } = useSettingsConfig();

  const {
    campaigns,
    activeCampaignId,
    campaignForm,
    campaignMessage,
    campaignSaving,
    campaignLoading,
    setCampaigns,
    setActiveCampaignId,
    setCampaignForm,
    createNewCampaign,
    saveCampaign,
    deleteCampaign,
  } = useCampaigns({
    settings,
    initialCampaigns: createInitialCampaigns(defaultSettings),
    initialCampaignId: "fit",
  });

  const {
    contacts,
    setContacts,
    contactsLoading,
    leadForm,
    setLeadForm,
    leadMessage,
    loadLeads,
    createNewLead,
    saveLead,
    deleteLead,
    filteredContacts,
    sortedContacts,
  } = useLeads({
    apiBaseUrl: settings.apiBaseUrl,
    campaigns,
    activeContactId,
    openChatTabs,
    onActiveContactIdChange: setActiveContactId,
    onOpenChatTabsChange: setOpenChatTabs,
    onSectionChange: setSection,
    search,
  });

  const {
    ghostingSchedules,
    ghostingRows,
    ghostingLoading,
    ghostingMessage,
    loadGhostingData,
    sendGhostingDue,
    markGhostingSent,
  } = useGhostingRuntime({
    apiBaseUrl: settings.apiBaseUrl,
    contacts,
    campaigns,
    onContactsChange: setContacts,
    onReloadInbox: async () => {
      if (section === "inbox") {
        await loadInboxData();
      }
    },
  });

  const {
    availabilityForm,
    availabilityLoading,
    availabilitySaving,
    availabilityMessage,
    setAvailabilityForm,
    loadAvailabilityConfig,
    saveAvailabilityConfig,
    resetAvailabilityConfigForm,
  } = useAvailabilityConfig({
    apiBaseUrl: settings.apiBaseUrl,
    autoLoad: true,
  });

  const {
    backendHealthy,
    backendHealthMessage,
  } = useBackendHealth({
    apiBaseUrl: settings.apiBaseUrl,
  });

  const {
    ghostingConfig,
    ghostingConfigMessage,
    onGhostingSlotChange,
    onGhostingMessageChange,
    onAddGhostingSlot,
    onRemoveGhostingSlot,
    onSaveGhostingConfig,
    onReloadGhostingConfig,
    onResetGhostingConfig,
  } = useGhostingConfig({
    apiBaseUrl: settings.apiBaseUrl,
    autoLoad: section === "settings",
    onConfigChanged: async () => {
      if (section === "ghosting") {
        await loadGhostingData();
      }
    },
  });

  const {
    inboxLoading,
    inboxMessage,
    newManualMessage,
    setNewManualMessage,
    loadInboxData,
    openChat,
    closeChatTab,
    sendManualMessage,
    inboxContacts,
    activeInboxContact,
    activeConversation,
    openInboxTabContacts,
    activeContactBooking,
  } = useInbox({
    apiBaseUrl: settings.apiBaseUrl,
    contacts,
    sortedContacts,
    activeContactId,
    openChatTabs,
    setActiveContactId,
    setOpenChatTabs,
    setContacts,
    setSection,
  });

  const colors = getDashboardColors(darkMode);


  useEffect(() => {
    loadSettingsConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCampaigns((prev) =>
      prev.map((campaign) => ({
        ...campaign,
        booking: getNormalizedBookingConfig(campaign, settings),
      })),
    );
  }, [settings, setCampaigns]);

  const handleSaveSettings = useCallback(async () => {
    const savedSettings = await saveSettings();

    if (!savedSettings) return;

    setCampaigns((prev) =>
      prev.map((campaign) => ({
        ...campaign,
        booking: {
          ...campaign.booking,
          calendarId:
            campaign.booking?.calendarId || savedSettings.calendarId || "",
          maxSuggestions:
            campaign.booking?.maxSuggestions ||
            Number(savedSettings.maxSuggestions || 2),
          starterCheckoutUrl:
            campaign.booking?.starterCheckoutUrl ||
            savedSettings.starterCheckoutUrl,
          onboardingBookingUrl:
            campaign.booking?.onboardingBookingUrl ||
            savedSettings.onboardingBookingUrl,
          bookingPrompt:
            campaign.booking?.bookingPrompt ||
            savedSettings.bookingPrompt,
          externalBookingUrl:
            campaign.booking?.externalBookingUrl ||
            savedSettings.defaultBookingUrl,
        },
      })),
    );
  }, [saveSettings, setCampaigns]);

  const handleResetSettings = useCallback(async () => {
    const resetData = await resetSettings();

    if (!resetData) return;

    const nextCampaigns = createInitialCampaigns(resetData);
    setCampaigns(nextCampaigns);
    setActiveCampaignId("fit");
    setCampaignForm(nextCampaigns[0]);
  }, [resetSettings, setCampaigns, setActiveCampaignId, setCampaignForm]);

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (section === "ghosting") {
      loadGhostingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, settings.apiBaseUrl, contacts]);

  useEffect(() => {
    if (section === "inbox") {
      loadInboxData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, settings.apiBaseUrl, contacts]);

  useEffect(() => {
    if (!ghostingMessage) return;
    const timeout = setTimeout(() => setGhostingMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [ghostingMessage]);

  function handleCreateNewCampaign() {
    createNewCampaign();
    setSection("campaigns");
  }

  function handleDeleteCampaign() {
    const result = deleteCampaign();
    if (!result?.deletedCampaignId) return;

    const deleteId = result.deletedCampaignId;
    const fallbackCampaignId = result.fallbackCampaignId;

    setContacts((prev) =>
      prev.map((contact) =>
        contact.campaignId === deleteId
          ? { ...contact, campaignId: fallbackCampaignId }
          : contact,
      ),
    );
    setLeadForm((prev) =>
      prev.campaignId === deleteId
        ? { ...prev, campaignId: fallbackCampaignId }
        : prev,
    );
  }

  function renderPlaceholder(title, text) {
    return (
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ color: colors.sub, lineHeight: 1.6, fontSize: 13 }}>
          {text}
        </div>
      </div>
    );
  }

  function renderContent() {
    const statAll = contacts.length;
    const statHot = contacts.filter((contact) =>
      contact.tags.includes("Heißer Lead"),
    ).length;
    const statRunning = contacts.filter((contact) =>
      contact.tags.includes("Gespräch läuft"),
    ).length;
    const statAppointments = contacts.filter((contact) => contact.booked).length;

    if (section === "dashboard") {
      return (
        <DashboardHome
          colors={colors}
          campaigns={campaigns}
          contacts={contacts}
          sortedContacts={sortedContacts}
          activeContactId={activeContactId}
          onSelectLead={(id) => {
            setActiveContactId(id);
            setSection("inbox");
          }}
        />
      );
    }

    if (section === "campaigns") {
      return (
        <CampaignsView
          colors={colors}
          settings={settings}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          campaignForm={campaignForm}
          campaignMessage={campaignMessage}
          campaignSaving={campaignSaving}
          campaignLoading={campaignLoading}
          onSelectCampaign={setActiveCampaignId}
          onCreateNewCampaign={handleCreateNewCampaign}
          onSaveCampaign={saveCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          onCampaignFormChange={setCampaignForm}
        />
      );
    }

    if (section === "leads") {
      return (
        <LeadsView
          colors={colors}
          contacts={sortedContacts}
          activeContactId={activeContactId}
          leadForm={leadForm}
          leadMessage={leadMessage || (contactsLoading ? "Leads laden..." : "")}
          campaigns={campaigns}
          onSelectLead={setActiveContactId}
          onLeadFormChange={setLeadForm}
          onCreateNewLead={createNewLead}
          onSaveLead={saveLead}
          onDeleteLead={deleteLead}
        />
      );
    }

    if (section === "inbox") {
      return (
        <div
          style={{
            width: "100%",
            marginLeft: -16,
            marginRight: -16,
            marginBottom: -16,
          }}
        >
          <InboxView
            colors={colors}
            contacts={inboxContacts}
            campaigns={campaigns}
            activeContact={activeInboxContact}
            activeContactId={activeContactId}
            openTabContacts={openInboxTabContacts}
            activeContactBooking={activeContactBooking}
            activeConversation={activeConversation}
            loading={inboxLoading}
            message={inboxMessage}
            newManualMessage={newManualMessage}
            onNewManualMessageChange={setNewManualMessage}
            onOpenChat={openChat}
            onSendManualMessage={sendManualMessage}
            onSetActiveContactId={setActiveContactId}
            onCloseChatTab={closeChatTab}
            onReloadInbox={loadInboxData}
          />
        </div>
      );
    }

    if (section === "ghosting") {
      return (
        <GhostingView
          colors={colors}
          schedules={ghostingSchedules}
          rows={ghostingRows}
          loading={ghostingLoading}
          message={ghostingMessage}
          onReload={loadGhostingData}
          onSendDue={sendGhostingDue}
          onMarkSent={markGhostingSent}
          onOpenLead={openChat}
        />
      );
    }

    if (section === "appointments") {
      return (
        <AppointmentsShell
          colors={colors}
          contacts={sortedContacts}
          inboxContacts={inboxContacts}
          availabilityForm={availabilityForm}
          availabilityLoading={availabilityLoading}
          availabilitySaving={availabilitySaving}
          availabilityMessage={availabilityMessage}
          onAvailabilityFormChange={setAvailabilityForm}
          onReloadAvailability={loadAvailabilityConfig}
          onSaveAvailability={saveAvailabilityConfig}
          onResetAvailability={resetAvailabilityConfigForm}
          onOpenLead={openChat}
          renderPlaceholder={renderPlaceholder}
        />
      );
    }

    if (section === "booking-events") {
      return <BookingEventsDebugView colors={colors} apiBaseUrl={settings.apiBaseUrl} />;
    }

    if (section === "settings") {
      return (
        <SettingsView
          colors={colors}
          settings={settings}
          settingsMessage={settingsMessage}
          onSettingsChange={setSettings}
          onSaveSettings={handleSaveSettings}
          onResetSettings={handleResetSettings}
          ghostingConfig={ghostingConfig}
          ghostingMessage={ghostingConfigMessage}
          onGhostingSlotChange={onGhostingSlotChange}
          onGhostingMessageChange={onGhostingMessageChange}
          onAddGhostingSlot={onAddGhostingSlot}
          onRemoveGhostingSlot={onRemoveGhostingSlot}
          onSaveGhostingConfig={onSaveGhostingConfig}
          onReloadGhostingConfig={onReloadGhostingConfig}
          onResetGhostingConfig={onResetGhostingConfig}
        />
      );
    }

    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: colors.bg,
        color: colors.text,
        fontFamily:
          '"Segoe UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0, 1fr)",
          minHeight: "100vh",
          width: "100%",
        }}
      >
        <Sidebar
          colors={colors}
          section={section}
          navItems={navItems}
          onSectionChange={setSection}
          darkMode={darkMode}
          onSetDarkMode={setDarkMode}
          productName={settings.productName}
          adminName={settings.adminName}
          adminRole={settings.adminRole}
        />

        <main
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            width: "100%",
            background: colors.surface,
          }}
        >
          <Topbar
            colors={colors}
            section={section}
            navItems={navItems}
            search={search}
            onSearchChange={setSearch}
            subtitle={settings.topbarSubtitle}
            userInitial={userInitial}
          />

          {backendHealthy === false && (
            <div
              style={{
                margin: "0 16px 16px",
                padding: "12px 14px",
                borderRadius: 10,
                background: colors.warning,
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {backendHealthMessage}
            </div>
          )}

          <div
            style={{
              padding: 16,
              width: "100%",
              boxSizing: "border-box",
              flex: 1,
            }}
          >
            {renderContent()}
          </div>
        </main>
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "8px 16px 12px",
          color: colors.sub,
          fontSize: 11,
          background: colors.surface,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {settings.footerText}
      </div>
    </div>
  );
}
