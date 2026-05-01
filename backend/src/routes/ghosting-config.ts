import { Router } from "express";
import {
  getGhostingConfig,
  resetGhostingConfig,
  updateGhostingSchedules,
  updateGhostingMessages,
} from "../data/ghosting-config.store.js";
import type { GhostingStage } from "../types/ghosting.types.js";

const router = Router();

router.get("/ghosting-config", (_req, res) => {
  return res.json({
    ok: true,
    config: getGhostingConfig(),
  });
});

router.patch("/ghosting-config/messages", (req, res) => {
  try {
    const messages = req.body?.messages;

    if (!messages || typeof messages !== "object") {
      return res.status(400).json({
        ok: false,
        error: "messages muss ein Objekt sein.",
      });
    }

    const normalizedEntries = Object.entries(messages).filter(
      ([, value]) => typeof value === "string",
    ) as Array<[GhostingStage, string]>;

    if (normalizedEntries.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Keine gültigen Ghosting-Texte übergeben.",
      });
    }

    const updated = updateGhostingMessages(Object.fromEntries(normalizedEntries));

    return res.json({
      ok: true,
      message: "Ghosting-Texte wurden aktualisiert.",
      config: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Aktualisieren der Ghosting-Texte.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.put("/ghosting-config/schedules", (req, res) => {
  try {
    const schedules = req.body?.schedules;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "schedules muss ein nicht-leeres Array sein.",
      });
    }

    const valid = schedules.every((schedule) => {
      return (
        typeof schedule?.cycle === "number" &&
        Array.isArray(schedule?.slots) &&
        schedule.slots.every(
          (slot: any) =>
            typeof slot?.stage === "string" &&
            typeof slot?.dayOffsetHours === "number" &&
            typeof slot?.sendHour === "number" &&
            typeof slot?.sendMinute === "number",
        )
      );
    });

    if (!valid) {
      return res.status(400).json({
        ok: false,
        error: "Ungültige schedules-Struktur.",
      });
    }

    const updated = updateGhostingSchedules(schedules);

    return res.json({
      ok: true,
      message: "Ghosting-Zyklen wurden aktualisiert.",
      config: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Aktualisieren der Ghosting-Zyklen.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/ghosting-config/reset", (_req, res) => {
  try {
    const reset = resetGhostingConfig();

    return res.json({
      ok: true,
      message: "Ghosting-Konfiguration wurde auf Standard zurückgesetzt.",
      config: reset,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Reset der Ghosting-Konfiguration.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
