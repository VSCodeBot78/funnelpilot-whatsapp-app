import { useState, useCallback } from "react";
import {
  loadGhostingDataFromApi,
  sendGhostingDueInApi,
  markGhostingSentInApi,
} from "../services/ghostingApi";

function getTimeLabel() {
  return new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useGhostingRuntime({
  apiBaseUrl,
  contacts,
  campaigns,
  onContactsChange,
  onReloadInbox,
} = {}) {
  const [ghostingSchedules, setGhostingSchedules] = useState([]);
  const [ghostingRows, setGhostingRows] = useState([]);
  const [ghostingLoading, setGhostingLoading] = useState(false);
  const [ghostingMessage, setGhostingMessage] = useState("");

  const loadGhostingData = useCallback(async () => {
    try {
      setGhostingLoading(true);
      setGhostingMessage("");

      const { schedules, rows, matchedCount, totalCount } =
        await loadGhostingDataFromApi({
          apiBaseUrl,
          contacts,
          campaigns,
        });

      setGhostingSchedules(schedules);
      setGhostingRows(rows);
      setGhostingMessage(
        `Ghosting geladen. ${matchedCount} von ${totalCount} Leads mit Backend-State gefunden.`,
      );
    } catch (error) {
      console.error("ghosting load error:", error);
      setGhostingRows([]);
      setGhostingMessage("Ghosting-Daten konnten nicht geladen werden.");
    } finally {
      setGhostingLoading(false);
    }
  }, [apiBaseUrl, contacts, campaigns]);

  const sendGhostingDue = useCallback(
    async (row) => {
      try {
        setGhostingLoading(true);

        const data = await sendGhostingDueInApi({
          apiBaseUrl,
          row,
          sendAt: new Date().toISOString(),
        });

        if (typeof onContactsChange === "function") {
          onContactsChange((prev) =>
            prev.map((contact) =>
              String(contact.id) === String(row.contactId)
                ? {
                    ...contact,
                    messages: [
                      ...(contact.messages || []),
                      {
                        id: Date.now(),
                        role: "bot",
                        text: data.messageText || "",
                        time: getTimeLabel(),
                      },
                    ],
                    lastActivityAt: Date.now(),
                  }
                : contact,
            ),
          );
        }

        setGhostingMessage(`Ghosting gesendet: ${row.name}`);

        await loadGhostingData();
        if (typeof onReloadInbox === "function") {
          await onReloadInbox();
        }
      } catch (error) {
        console.error("ghosting send error:", error);
        setGhostingMessage(
          error instanceof Error
            ? error.message
            : "Ghosting-Nachricht konnte nicht gesendet werden.",
        );
      } finally {
        setGhostingLoading(false);
      }
    },
    [apiBaseUrl, loadGhostingData, onContactsChange, onReloadInbox],
  );

  const markGhostingSent = useCallback(
    async (row) => {
      try {
        setGhostingLoading(true);

        await markGhostingSentInApi({
          apiBaseUrl,
          row,
          sentAt: new Date().toISOString(),
        });

        setGhostingMessage(`Ghosting als gesendet markiert: ${row.name}`);

        await loadGhostingData();
        if (typeof onReloadInbox === "function") {
          await onReloadInbox();
        }
      } catch (error) {
        console.error("ghosting mark sent error:", error);
        setGhostingMessage(
          error instanceof Error
            ? error.message
            : "Ghosting konnte nicht als gesendet markiert werden.",
        );
      } finally {
        setGhostingLoading(false);
      }
    },
    [apiBaseUrl, loadGhostingData, onReloadInbox],
  );

  return {
    ghostingSchedules,
    ghostingRows,
    ghostingLoading,
    ghostingMessage,
    loadGhostingData,
    sendGhostingDue,
    markGhostingSent,
  };
}
