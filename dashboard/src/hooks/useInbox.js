import { useCallback, useEffect, useMemo, useState } from "react";
import { getDefaultBookingData } from "../utils/dashboardHelpers";
import {
  loadInboxConversationMapForContacts,
  mapConversationMessagesToInbox,
  releaseConversationToAi,
  sendHumanConversationMessage,
  takeOverConversation,
} from "../services/inboxStateApi";

export function useInbox({
  apiBaseUrl,
  contacts = [],
  sortedContacts = [],
  activeContactId,
  openChatTabs = [],
  setActiveContactId,
  setOpenChatTabs,
  setSection,
}) {
  const [inboxConversationMap, setInboxConversationMap] = useState({});
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxMessage, setInboxMessage] = useState("");
  const [newManualMessage, setNewManualMessage] = useState("");

  // Never carry a draft into another person's conversation accidentally.
  useEffect(() => { setNewManualMessage(""); }, [activeContactId]);

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
        inboxOwner: state.owner,
        inboxAiPaused: state.aiPaused === true,
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

  const replaceActiveConversation = useCallback(
    (state) => {
      if (!activeContactId || !state) return;
      setInboxConversationMap((prev) => ({
        ...prev,
        [activeContactId]: state,
      }));
    },
    [activeContactId],
  );

  const takeOverActiveConversation = useCallback(async () => {
    if (!activeConversation) return;

    try {
      setInboxMessage("");
      const data = await takeOverConversation({
        apiBaseUrl,
        state: activeConversation,
      });
      replaceActiveConversation(data.state);
      setInboxMessage("Jochen hat übernommen. Die KI ist pausiert.");
    } catch (error) {
      console.error("takeover error:", error);
      setInboxMessage("Übernahme konnte nicht gespeichert werden.");
    }
  }, [activeConversation, apiBaseUrl, replaceActiveConversation]);

  const releaseActiveConversationToAi = useCallback(async () => {
    if (!activeConversation) return;

    try {
      setInboxMessage("");
      const data = await releaseConversationToAi({
        apiBaseUrl,
        state: activeConversation,
      });
      replaceActiveConversation(data.state);
      setInboxMessage("Conversation wurde an die KI zurückgegeben.");
    } catch (error) {
      console.error("release to ai error:", error);
      setInboxMessage("Rückgabe an die KI ist fehlgeschlagen.");
    }
  }, [activeConversation, apiBaseUrl, replaceActiveConversation]);

  const sendManualMessage = useCallback(async () => {
    if (!activeInboxContact || !newManualMessage.trim()) return;

    if (!activeConversation) {
      setInboxMessage("Kein Backend-State vorhanden. Nachricht NICHT gesendet.");
      return;
    }

    if (activeConversation) {
      try {
        setInboxMessage("");
        const data = await sendHumanConversationMessage({
          apiBaseUrl,
          state: activeConversation,
          messageText: newManualMessage.trim(),
        });
        replaceActiveConversation(data.state);

        if (data.sent) {
          setNewManualMessage("");
          setInboxMessage(
            "Nachricht gesendet. Jochen hat übernommen; die KI bleibt pausiert.",
          );
        } else {
          const reason =
            data.sendSkipReason ||
            data.sendError ||
            "Transport ist noch nicht für echten Versand freigeschaltet.";
          setInboxMessage(
            `KI pausiert. Nachricht wurde NICHT gesendet: ${reason}`,
          );
        }
      } catch (error) {
        console.error("manual conversation message error:", error);
        setInboxMessage("Manuelle Nachricht konnte nicht gespeichert werden.");
      }
      return;
    }

  }, [
    activeConversation,
    activeInboxContact,
    apiBaseUrl,
    newManualMessage,
    replaceActiveConversation,
  ]);

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
    takeOverActiveConversation,
    releaseActiveConversationToAi,
    inboxContacts,
    activeInboxContact,
    activeConversation,
    openInboxTabContacts,
    activeContactBooking,
  };
}
