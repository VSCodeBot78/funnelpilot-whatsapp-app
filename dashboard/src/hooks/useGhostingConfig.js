import { useCallback, useEffect, useState } from "react";
import {
  loadGhostingConfigFromApi,
  resetGhostingConfigInApi,
  saveGhostingConfigToApi,
} from "../services/ghostingConfigApi";

const emptyGhostingConfig = {
  schedules: [],
  messages: {},
};

function updateSlot(config, scheduleIndex, slotIndex, field, value) {
  const nextSchedules = [...(config.schedules || [])];

  if (!nextSchedules[scheduleIndex]) {
    return config;
  }

  const nextSchedule = {
    ...nextSchedules[scheduleIndex],
    slots: [...(nextSchedules[scheduleIndex].slots || [])],
  };

  const nextSlot = {
    ...nextSchedule.slots[slotIndex],
    [field]:
      field === "stage"
        ? value
        : Number.isNaN(Number(value))
          ? 0
          : Number(value),
  };

  nextSchedule.slots[slotIndex] = nextSlot;
  nextSchedules[scheduleIndex] = nextSchedule;

  return {
    ...config,
    schedules: nextSchedules,
  };
}

function updateMessage(config, stage, text) {
  return {
    ...config,
    messages: {
      ...(config.messages || {}),
      [stage]: text,
    },
  };
}

function addSlot(config, scheduleIndex) {
  const nextSchedules = [...(config.schedules || [])];

  if (!nextSchedules[scheduleIndex]) {
    return config;
  }

  const schedule = nextSchedules[scheduleIndex];
  const nextSchedule = {
    ...schedule,
    slots: [...(schedule.slots || [])],
  };

  const newStage = `cycle${schedule.cycle}_custom_${Date.now()}`;

  nextSchedule.slots.push({
    cycle: schedule.cycle,
    stage: newStage,
    dayOffsetHours:
      schedule.cycle === 1 ? 24 : schedule.cycle === 2 ? 48 : 72,
    sendHour: 9,
    sendMinute: 0,
  });

  nextSchedules[scheduleIndex] = nextSchedule;

  return {
    ...config,
    schedules: nextSchedules,
    messages: {
      ...(config.messages || {}),
      [newStage]: "",
    },
  };
}

function removeSlot(config, scheduleIndex, slotIndex) {
  const nextSchedules = [...(config.schedules || [])];

  if (!nextSchedules[scheduleIndex]) {
    return config;
  }

  const schedule = nextSchedules[scheduleIndex];
  const nextSchedule = {
    ...schedule,
    slots: [...(schedule.slots || [])],
  };

  const removedSlot = nextSchedule.slots[slotIndex];

  nextSchedule.slots.splice(slotIndex, 1);
  nextSchedules[scheduleIndex] = nextSchedule;

  const nextMessages = { ...(config.messages || {}) };

  if (removedSlot?.stage) {
    delete nextMessages[removedSlot.stage];
  }

  return {
    ...config,
    schedules: nextSchedules,
    messages: nextMessages,
  };
}

export function useGhostingConfig({
  apiBaseUrl,
  autoLoad = false,
  onConfigChanged,
}) {
  const [ghostingConfig, setGhostingConfig] = useState(emptyGhostingConfig);
  const [ghostingConfigMessage, setGhostingConfigMessage] = useState("");

  useEffect(() => {
    if (!ghostingConfigMessage) return;

    const timeout = setTimeout(() => {
      setGhostingConfigMessage("");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [ghostingConfigMessage]);

  const loadGhostingConfig = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setGhostingConfigMessage("");
        }

        const config = await loadGhostingConfigFromApi(apiBaseUrl);

        setGhostingConfig(config);

        if (!silent) {
          setGhostingConfigMessage("Ghosting-Konfiguration neu geladen.");
        }

        return config;
      } catch (error) {
        console.error("ghosting config load error:", error);

        setGhostingConfig(emptyGhostingConfig);
        setGhostingConfigMessage(
          error instanceof Error
            ? error.message
            : "Ghosting-Konfiguration konnte nicht geladen werden.",
        );

        return emptyGhostingConfig;
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    if (!autoLoad || !apiBaseUrl) return;

    loadGhostingConfig({ silent: true });
  }, [autoLoad, apiBaseUrl, loadGhostingConfig]);

  function onGhostingSlotChange(scheduleIndex, slotIndex, field, value) {
    setGhostingConfig((prev) =>
      updateSlot(prev, scheduleIndex, slotIndex, field, value),
    );
  }

  function onGhostingMessageChange(stage, text) {
    setGhostingConfig((prev) => updateMessage(prev, stage, text));
  }

  function onAddGhostingSlot(scheduleIndex) {
    setGhostingConfig((prev) => addSlot(prev, scheduleIndex));
  }

  function onRemoveGhostingSlot(scheduleIndex, slotIndex) {
    setGhostingConfig((prev) => removeSlot(prev, scheduleIndex, slotIndex));
  }

  async function onSaveGhostingConfig() {
    try {
      setGhostingConfigMessage("");

      const savedConfig = await saveGhostingConfigToApi({
        apiBaseUrl,
        config: ghostingConfig,
      });

      setGhostingConfig(savedConfig);
      setGhostingConfigMessage("Ghosting-Konfiguration gespeichert.");

      if (typeof onConfigChanged === "function") {
        await onConfigChanged();
      }
    } catch (error) {
      console.error("ghosting config save error:", error);

      setGhostingConfigMessage(
        error instanceof Error
          ? error.message
          : "Ghosting-Konfiguration konnte nicht gespeichert werden.",
      );
    }
  }

  async function onReloadGhostingConfig() {
    await loadGhostingConfig({ silent: false });
  }

  async function onResetGhostingConfig() {
    try {
      setGhostingConfigMessage("");

      const resetConfig = await resetGhostingConfigInApi(apiBaseUrl);

      setGhostingConfig(resetConfig);
      setGhostingConfigMessage("Ghosting-Konfiguration zurückgesetzt.");

      if (typeof onConfigChanged === "function") {
        await onConfigChanged();
      }
    } catch (error) {
      console.error("ghosting config reset error:", error);

      setGhostingConfigMessage(
        error instanceof Error
          ? error.message
          : "Ghosting-Konfiguration konnte nicht zurückgesetzt werden.",
      );
    }
  }

  return {
    ghostingConfig,
    ghostingConfigMessage,
    loadGhostingConfig,
    onGhostingSlotChange,
    onGhostingMessageChange,
    onAddGhostingSlot,
    onRemoveGhostingSlot,
    onSaveGhostingConfig,
    onReloadGhostingConfig,
    onResetGhostingConfig,
  };
}
