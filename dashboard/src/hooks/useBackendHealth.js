import { useEffect, useState } from "react";
import { checkBackendHealth } from "../services/healthApi";

export function useBackendHealth({ apiBaseUrl }) {
  const [backendHealthy, setBackendHealthy] = useState(null);
  const [backendHealthMessage, setBackendHealthMessage] = useState("");

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
          "Backend-Verbindung fehlgeschlagen. Prüfe, ob der Backend-Server erreichbar ist.",
        );
      }
    }

    loadHealth();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  return {
    backendHealthy,
    backendHealthMessage,
  };
}
