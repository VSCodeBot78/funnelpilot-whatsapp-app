import { useCallback, useEffect, useMemo, useState } from "react";
import { getDefaultBookingData } from "../utils/dashboardHelpers";
import {
  loadInboxConversationMapForContacts,
  mapConversationMessagesToInbox,
} from "../services/inboxStateApi";

export function useInbox({
  apiBaseUrl,
  contacts = [],
  sortedContacts = [],
  activeContactId,
  openChatTabs = [],
  setActiveContactId,
  setOpenChatTabs,
  setContacts,
  setSection,
}) {
  const [inboxConversationMap, setInboxConversationMap] = useState({});
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxMessage, setInboxMessage] = useState("");
  const [newManualMessage, setNewManualMessage] = useState("");

  useEffect(() => {
    if (!activeContactId) return;

    if (!openChatTabs.includes(activeContactId)) {
      setOpenChatTabs((prev) => [...prev, activeContactId]);
    }
  }, [activeContactId, openChatTabs, setOpenChatTabs]);

  useEffect(() => {
    if (!inboxMessage) return;
    const timeout = setTimeout(() => setInboxMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [inboxMessage]);

  const inboxContacts = useMemo(() => {
    return sortedContacts.map((contact) => {
      const state = inboxConversationMap[contact.id];

      if (!state) {
        return contact;
      }

      const backendMessages = mapConversationMessagesToInbox(state.messages || []);

      return {
        ...contact,
        stage: state.currentStep || state.stage || contact.stage,
        lastActivityAt: state.updatedAt
          ? new Date(state.updatedAt).getTime()
          : contact.lastActivityAt,
        messages: backendMessages.length > 0 ? backendMessages : contact.messages,
        backendStateConnected: true,
        backendLeadId: state.leadId,
        backendCampaignId: state.campaignId,
        ghostingState: state.ghosting || null,
        providerBookingState: state.providerBooking || null,
        bookingData: state.bookingData
          ? {
              ...getDefaultBookingData(),
              ...contact.bookingData,
              ...state.bookingData,
            }
          : contact.bookingData,
      };
    });
  }, [sortedContacts, inboxConversationMap]);

  const activeInboxContact = useMemo(
    () =>
      inboxContacts.find((c) => String(c.id) === String(activeContactId)) || null,
    [inboxContacts, activeContactId],
  );

  const activeConversation = useMemo(
    () => inboxConversationMap[activeContactId] || null,
    [inboxConversationMap, activeContactId],
  );

  const openInboxTabContacts = useMemo(
    () =>
      openChatTabs
        .map((id) => inboxContacts.find((c) => String(c.id) === String(id)))
        .filter(Boolean),
    [openChatTabs, inboxContacts],
  );

  const activeContactBooking =
    activeInboxContact?.bookingData || getDefaultBookingData();

  const loadInboxData = useCallback(async () => {
    try {
      setInboxLoading(true);
      setInboxMessage("");

      const { conversationMap, matchedCount } =
        await loadInboxConversationMapForContacts({
          contacts,
          apiBaseUrl,
        });

      setInboxConversationMap(conversationMap);

      setInboxMessage(
        `Inbox geladen. ${matchedCount} von ${contacts.length} Leads mit echtem Backend-State verbunden.`,
      );
    } catch (error) {
      console.error("inbox data load error:", error);
      setInboxConversationMap({});
      setInboxMessage("Inbox-Conversations konnten nicht geladen werden.");
    } finally {
      setInboxLoading(false);
    }
  }, [apiBaseUrl, contacts]);

  const openChat = useCallback(
    (contactId) => {
      if (!openChatTabs.includes(contactId)) {
        setOpenChatTabs((prev) => [...prev, contactId]);
      }

      setActiveContactId(contactId);
      setSection("inbox");
    },
    [openChatTabs, setActiveContactId, setOpenChatTabs, setSection],
  );

  const closeChatTab = useCallback(
    (contactId, event) => {
      event?.stopPropagation?.();

      const nextTabs = openChatTabs.filter(
        (id) => String(id) !== String(contactId),
      );

      setOpenChatTabs(nextTabs);

      if (String(activeContactId) === String(contactId)) {
        if (nextTabs.length) {
          setActiveContactId(nextTabs[nextTabs.length - 1]);
        } else {
          const fallback = contacts.find(
            (contact) => String(contact.id) !== String(contactId),
          );
          setActiveContactId(fallback?.id || null);
        }
      }
    },
    [activeContactId, contacts, openChatTabs, setActiveContactId, setOpenChatTabs],
  );

  const sendManualMessage = useCallback(() => {
    if (!activeInboxContact || !newManualMessage.trim()) return;

    if (activeConversation) {
      setInboxMessage(
        "Dieser Chat ist bereits mit dem Backend-State verbunden. Manuelles Senden wird später sauber an denselben State angebunden.",
      );
      return;
    }

    const newMessage = {
      id: Date.now(),
      role: "bot",
      text: newManualMessage.trim(),
      time: getTimeLabel(),
    };

    setContacts((prev) =>
      prev.map((contact) =>
        String(contact.id) === String(activeInboxContact.id)
          ? {
              ...contact,
              messages: [...(contact.messages || []), newMessage],
              lastActivityAt: Date.now(),
            }
          : contact,
      ),
    );

    setNewManualMessage("");
  }, [activeConversation, activeInboxContact, newManualMessage, setContacts]);

  function getTimeLabel() {
    return new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return {
    inboxConversationMap,
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
  };
}
