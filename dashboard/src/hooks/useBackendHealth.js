import { useEffect, useState } from "react";
import { checkBackendHealth } from "../services/healthApi";

export function useBackendHealth({ apiBaseUrl }) {
  const [backendHealthy, setBackendHealthy] = useState(null);
  const [backendHealthMessage, setBackendHealthMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      setBackendHealthy(null);
      setBackendHealthMessage("");

      try {
        const data = await checkBackendHealth(apiBaseUrl);

        if (!mounted) {
          return;
        }

        setBackendHealthy(true);
        setBackendHealthMessage(
          `Backend verbunden: ${data.service} (${data.status})`,
        );
      } catch (error) {
        if (!mounted) {
          return;
        }

        console.error("backend health check failed", error);
        setBackendHealthy(false);
        setBackendHealthMessage(
          "Backend nicht erreichbar. Das Fenster „Funnel Pilot Backend“ prüfen; danach über „Erneut prüfen“ den Status abfragen. Keine Demo-Leads oder Live-Sends starten.",
        );
      }
    }

    loadHealth();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, retryKey]);

  return {
    backendHealthy,
    backendHealthMessage,
    retryBackendHealth: () => setRetryKey(value => value + 1),
  };
}
