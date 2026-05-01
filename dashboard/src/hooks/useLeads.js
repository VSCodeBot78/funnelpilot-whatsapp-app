import { useCallback, useEffect, useMemo, useState } from "react";
import { getPriorityScore, getDefaultBookingData } from "../utils/dashboardHelpers";
import {
  loadLeadsFromApi,
  createLeadInApi,
  updateLeadInApi,
  deleteLeadInApi,
} from "../services/leadsApi";
import { ensureConversationStateInApi } from "../services/inboxStateApi";

const fallbackContacts = [
  {
    id: "101",
    name: "Sarah",
    phone: "+49 171 12345678",
    source: "WhatsApp",
    campaignId: "fit",
    tags: ["Heißer Lead", "Gespräch läuft"],
    stage: "booking",
    resumeStage: null,
    score: 9,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "Interessiert, möchte zügig starten.",
    isBotTyping: false,
    intent: "scheduling",
    readiness: "hot",
    bookingData: getDefaultBookingData(),
    lastActivityAt: Date.now() - 20 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "bot",
        text: "Hallo Sarah, schön dass du da bist.",
        time: "15:05",
      },
      {
        id: 2,
        role: "contact",
        text: "Ich möchte gern mehr erfahren, wie das abläuft.",
        time: "15:07",
      },
      {
        id: 3,
        role: "bot",
        text: "Sehr gern. Lass uns kurz schauen, was für dich sinnvoll ist.",
        time: "15:09",
      },
      {
        id: 4,
        role: "contact",
        text: "Klingt gut.",
        time: "15:10",
      },
    ],
  },
  {
    id: "102",
    name: "Bianca",
    phone: "+49 151 22222222",
    source: "Facebook",
    campaignId: "fit",
    tags: ["Gespräch läuft"],
    stage: "consequence_freetext",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "",
    isBotTyping: false,
    intent: "",
    readiness: "warm",
    bookingData: getDefaultBookingData(),
    lastActivityAt: Date.now() - 2 * 60 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "contact",
        text: "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
        time: "09:11",
      },
      {
        id: 2,
        role: "bot",
        text: "Hey 😊 Mit wem schreibe ich gerade? Schreib mir einfach kurz deinen Vornamen.",
        time: "09:11",
      },
    ],
  },
  {
    id: "103",
    name: "Timo",
    phone: "+49 176 55544321",
    source: "Instagram",
    campaignId: "fit",
    tags: ["Neuer Lead"],
    stage: "ask_name",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "",
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: getDefaultBookingData(),
    lastActivityAt: Date.now() - 8 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "contact",
        text: "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
        time: "18:42",
      },
      {
        id: 2,
        role: "bot",
        text: "Hey 😊 Mit wem schreibe ich gerade? Schreib mir einfach kurz deinen Vornamen.",
        time: "18:42",
      },
    ],
  },
  {
    id: "104",
    name: "Dummy Lea",
    phone: "+49 170 1112233",
    source: "Testsystem",
    campaignId: "reset",
    tags: ["Dummy"],
    stage: "goal_choice",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "Sandbox-Lead für Bot-Tests.",
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: getDefaultBookingData(),
    lastActivityAt: Date.now() - 30 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "contact",
        text: "DUMMY TEST",
        time: "16:00",
      },
      {
        id: 2,
        role: "bot",
        text: "Hey [Name] 😊\ndas ist die Dummy Kampagne.\nHier kannst du frei testen, wie der Bot auf andere Hooks oder Antworten reagiert.",
        time: "16:01",
      },
    ],
  },
];

const emptyLeadForm = {
  id: "",
  name: "",
  phone: "",
  source: "Instagram",
  campaignId: "fit",
  botEnabled: true,
  excluded: false,
  booked: false,
  bookingData: getDefaultBookingData(),
  note: "",
  tags: ["Neuer Lead"],
};

function createLeadForm(contact, campaigns) {
  if (!contact) {
    return {
      ...emptyLeadForm,
      campaignId: campaigns[0]?.id || "",
    };
  }

  return {
    id: contact.id,
    backendLeadId: contact.backendLeadId || contact.id,
    name: contact.name || "",
    phone: contact.phone || "",
    source: contact.source || "Instagram",
    campaignId: contact.campaignId || campaigns[0]?.id || "",
    botEnabled: !!contact.botEnabled,
    excluded: !!contact.excluded,
    booked: !!contact.booked,
    bookingData: contact.bookingData
      ? { ...getDefaultBookingData(), ...contact.bookingData }
      : getDefaultBookingData(),
    note: contact.note || "",
    tags: contact.tags || ["Neuer Lead"],
  };
}

export function useLeads({
  apiBaseUrl,
  campaigns,
  activeContactId,
  openChatTabs,
  onActiveContactIdChange,
  onOpenChatTabsChange,
  onSectionChange,
  search = "",
} = {}) {
  const [contacts, setContacts] = useState(fallbackContacts);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [leadForm, setLeadForm] = useState({
    ...emptyLeadForm,
    ...(fallbackContacts[0] || {}),
  });
  const [leadMessage, setLeadMessage] = useState("");

  const activeContact = useMemo(
    () => contacts.find((c) => String(c.id) === String(activeContactId)) || null,
    [contacts, activeContactId],
  );

  useEffect(() => {
    if (activeContact) {
      setLeadForm(createLeadForm(activeContact, campaigns));
    }
  }, [activeContact, campaigns]);

  useEffect(() => {
    if (!leadMessage) return;
    const timeout = setTimeout(() => setLeadMessage(""), 2500);
    return () => clearTimeout(timeout);
  }, [leadMessage]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.phone} ${contact.source} ${(contact.tags || []).join(" ")} ${contact.intent || ""} ${contact.readiness || ""} ${contact.bookingData?.selectedSlot || ""} ${contact.bookingData?.bookingProvider || ""} ${contact.campaignId}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [contacts, search]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort(
      (a, b) => getPriorityScore(b) - getPriorityScore(a),
    );
  }, [filteredContacts]);

  const ensureConversationStatesForLeads = useCallback(
    async (leads) => {
      if (!Array.isArray(leads) || leads.length === 0) return;

      await Promise.all(
        leads.map(async (lead) => {
          try {
            await ensureConversationStateInApi(lead, apiBaseUrl);
          } catch (error) {
            console.error(
              "conversation ensure failed for lead:",
              lead.id,
              error,
            );
          }
        }),
      );
    },
    [apiBaseUrl],
  );

  const loadLeads = useCallback(async () => {
    try {
      setContactsLoading(true);

      const backendLeads = await loadLeadsFromApi(apiBaseUrl);

      await ensureConversationStatesForLeads(backendLeads);

      setContacts(backendLeads);

      if (backendLeads.length > 0) {
        if (typeof onActiveContactIdChange === "function") {
          onActiveContactIdChange((prev) => {
            const stillExists = backendLeads.some(
              (lead) => String(lead.id) === String(prev),
            );
            return stillExists ? prev : backendLeads[0].id;
          });
        }

        if (typeof onOpenChatTabsChange === "function") {
          onOpenChatTabsChange((prev) => {
            const validIds = prev.filter((tabId) =>
              backendLeads.some((lead) => String(lead.id) === String(tabId)),
            );

            if (validIds.length > 0) {
              return validIds;
            }

            return backendLeads.slice(0, 2).map((lead) => lead.id);
          });
        }
      } else {
        if (typeof onActiveContactIdChange === "function") {
          onActiveContactIdChange(null);
        }

        if (typeof onOpenChatTabsChange === "function") {
          onOpenChatTabsChange([]);
        }
      }
    } catch (error) {
      console.error("leads load error:", error);
      setContacts(fallbackContacts);
      if (typeof onActiveContactIdChange === "function") {
        onActiveContactIdChange(fallbackContacts[0]?.id || null);
      }
      if (typeof onOpenChatTabsChange === "function") {
        onOpenChatTabsChange(
          fallbackContacts.slice(0, 2).map((lead) => lead.id),
        );
      }
      setLeadMessage("Leads konnten nicht aus dem Backend geladen werden.");
    } finally {
      setContactsLoading(false);
    }
  }, [apiBaseUrl, onActiveContactIdChange, onOpenChatTabsChange]);

  const createNewLead = useCallback(() => {
    const id = String(Date.now());
    const campaign = campaigns[0];

    if (!campaign) return;

    const newLead = {
      id,
      name: "",
      phone: "",
      source: "Instagram",
      campaignId: campaign.id,
      botEnabled: true,
      excluded: false,
      booked: false,
      tags: ["Neuer Lead"],
      note: "",
      stage: campaign.askNameFirst ? "awaiting_name" : "intro_waiting_for_yes",
      resumeStage: null,
      score: null,
      isBotTyping: false,
      intent: "",
      readiness: "cold",
      bookingData: getDefaultBookingData(),
      messages: [],
      lastActivityAt: Date.now(),
      isDraft: true,
    };

    setContacts((prev) => [newLead, ...prev]);

    if (typeof onActiveContactIdChange === "function") {
      onActiveContactIdChange(id);
    }

    if (typeof onSectionChange === "function") {
      onSectionChange("leads");
    }

    setLeadForm({ ...newLead });
    setLeadMessage("Neuer Lead angelegt. Jetzt speichern.");
  }, [campaigns, onActiveContactIdChange, onSectionChange]);

  const saveLead = useCallback(async () => {
    if (!leadForm.id) return;

    const existingContact = contacts.find(
      (contact) => String(contact.id) === String(leadForm.id),
    );

    const preparedContact = {
      ...(existingContact || {
        id: String(leadForm.id),
        backendLeadId: String(leadForm.backendLeadId || leadForm.id),
        stage: "",
        resumeStage: null,
        score: null,
        isBotTyping: false,
        intent: "",
        readiness: "cold",
        bookingData: getDefaultBookingData(),
        messages: [],
        lastActivityAt: Date.now(),
      }),
      id: String(leadForm.id),
      backendLeadId: String(existingContact?.backendLeadId || leadForm.backendLeadId || leadForm.id),
      name: leadForm.name.trim(),
      phone: leadForm.phone.trim(),
      source: leadForm.source.trim(),
      campaignId: leadForm.campaignId,
      botEnabled: !!leadForm.botEnabled,
      excluded: !!leadForm.excluded,
      booked: !!leadForm.booked,
      bookingData: leadForm.bookingData || getDefaultBookingData(),
      note: leadForm.note,
      tags: leadForm.tags?.length ? leadForm.tags : ["Neuer Lead"],
      lastActivityAt: Date.now(),
    };

    try {
      const savedLead =
        existingContact && !existingContact.isDraft
          ? await updateLeadInApi(preparedContact, apiBaseUrl)
          : await createLeadInApi(preparedContact, apiBaseUrl);

      setContacts((prev) => {
        const exists = prev.some(
          (contact) => String(contact.id) === String(savedLead.id),
        );

        if (exists) {
          return prev.map((contact) =>
            String(contact.id) === String(savedLead.id) ? savedLead : contact,
          );
        }

        return [savedLead, ...prev];
      });

      try {
        await ensureConversationStateInApi(savedLead, apiBaseUrl);
      } catch (conversationError) {
        console.error("conversation ensure error:", conversationError);
      }

      if (typeof onActiveContactIdChange === "function") {
        onActiveContactIdChange(savedLead.id);
      }

      setLeadForm(createLeadForm(savedLead, campaigns));
      setLeadMessage("Lead im Backend gespeichert.");
    } catch (error) {
      console.error("lead save error:", error);
      setLeadMessage(
        error instanceof Error
          ? error.message
          : "Lead konnte nicht gespeichert werden.",
      );
    }
  }, [apiBaseUrl, campaigns, contacts, leadForm, onActiveContactIdChange]);

  const deleteLead = useCallback(async () => {
    if (!leadForm.id) return;

    const targetId = String(leadForm.id);
    const targetContact = contacts.find(
      (contact) => String(contact.id) === targetId,
    );

    try {
      if (targetContact && !targetContact.isDraft) {
        await deleteLeadInApi(targetId, apiBaseUrl);
      }

      const remaining = contacts.filter(
        (contact) => String(contact.id) !== targetId,
      );

      if (remaining.length === 0) {
        setContacts([]);

        if (typeof onActiveContactIdChange === "function") {
          onActiveContactIdChange(null);
        }

        if (typeof onOpenChatTabsChange === "function") {
          onOpenChatTabsChange([]);
        }

        setLeadForm({ ...emptyLeadForm });
        setLeadMessage("Lead gelöscht.");
        return;
      }

      const nextLead = remaining[0];

      setContacts(remaining);

      if (typeof onActiveContactIdChange === "function") {
        onActiveContactIdChange(nextLead.id);
      }

      if (typeof onOpenChatTabsChange === "function") {
        onOpenChatTabsChange((prev) =>
          prev.filter((id) => String(id) !== targetId),
        );
      }

      setLeadForm(createLeadForm(nextLead, campaigns));
      setLeadMessage("Lead gelöscht.");
    } catch (error) {
      console.error("lead delete error:", error);
      setLeadMessage(
        error instanceof Error
          ? error.message
          : "Lead konnte nicht gelöscht werden.",
      );
    }
  }, [apiBaseUrl, campaigns, contacts, leadForm.id, onActiveContactIdChange, onOpenChatTabsChange]);

  return {
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
  };
}
