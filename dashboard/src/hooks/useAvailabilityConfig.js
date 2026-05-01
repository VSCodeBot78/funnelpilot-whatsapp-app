import { useCallback, useEffect, useState } from "react";
import { getEmptyAvailabilityForm } from "../utils/dashboardHelpers";
import {
  loadAvailabilityConfigFromApi,
  resetAvailabilityConfigInApi,
  saveAvailabilityConfigToApi,
} from "../services/availabilityConfigApi";

export function useAvailabilityConfig({ apiBaseUrl, autoLoad = true }) {
  const [availabilityForm, setAvailabilityForm] = useState(
    getEmptyAvailabilityForm(),
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  useEffect(() => {
    if (!availabilityMessage) return;

    const timeout = setTimeout(() => {
      setAvailabilityMessage("");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [availabilityMessage]);

  const loadAvailabilityConfig = useCallback(async () => {
    try {
      setAvailabilityLoading(true);
      setAvailabilityMessage("");

      const form = await loadAvailabilityConfigFromApi(apiBaseUrl);

      setAvailabilityForm(form);
    } catch (error) {
      console.error("availability config load error:", error);
      setAvailabilityMessage(
        error instanceof Error
          ? error.message
          : "Availability-Konfiguration konnte nicht geladen werden.",
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }, [apiBaseUrl]);

  const saveAvailabilityConfig = useCallback(async () => {
    try {
      setAvailabilitySaving(true);
      setAvailabilityMessage("");

      const savedForm = await saveAvailabilityConfigToApi({
        apiBaseUrl,
        form: availabilityForm,
      });

      setAvailabilityForm(savedForm);
      setAvailabilityMessage("Availability-Konfiguration gespeichert.");
    } catch (error) {
      console.error("availability config save error:", error);
      setAvailabilityMessage(
        error instanceof Error
          ? error.message
          : "Speichern der Availability-Konfiguration fehlgeschlagen.",
      );
    } finally {
      setAvailabilitySaving(false);
    }
  }, [apiBaseUrl, availabilityForm]);

  const resetAvailabilityConfigForm = useCallback(async () => {
    try {
      setAvailabilitySaving(true);
      setAvailabilityMessage("");

      const resetForm = await resetAvailabilityConfigInApi(apiBaseUrl);

      setAvailabilityForm(resetForm);
      setAvailabilityMessage("Availability-Konfiguration zurückgesetzt.");
    } catch (error) {
      console.error("availability config reset error:", error);
      setAvailabilityMessage(
        error instanceof Error
          ? error.message
          : "Reset der Availability-Konfiguration fehlgeschlagen.",
      );
    } finally {
      setAvailabilitySaving(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!autoLoad || !apiBaseUrl) return;

    loadAvailabilityConfig();
  }, [autoLoad, apiBaseUrl, loadAvailabilityConfig]);

  return {
    availabilityForm,
    availabilityLoading,
    availabilitySaving,
    availabilityMessage,
    setAvailabilityForm,
    loadAvailabilityConfig,
    saveAvailabilityConfig,
    resetAvailabilityConfigForm,
  };
}
