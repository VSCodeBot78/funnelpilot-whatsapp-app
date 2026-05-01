import { Router } from "express";
import {
  getAvailabilityConfig,
  resetAvailabilityConfig,
  updateAvailabilityConfig,
} from "../data/availability-config.store.js";
import type { AvailabilityDayKey } from "../types/availability.types.js";

const router = Router();

const DAY_KEYS: AvailabilityDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();

  const fullTimeMatch = trimmed.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (fullTimeMatch) {
    const hour = String(fullTimeMatch[1]).padStart(2, "0");
    const minute = String(fullTimeMatch[2]).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  const hourOnlyMatch = trimmed.match(/^([01]?\d|2[0-3])$/);
  if (hourOnlyMatch) {
    const hour = String(hourOnlyMatch[1]).padStart(2, "0");
    return `${hour}:00`;
  }

  return null;
}

function parseWeeklySlots(input: unknown): Partial<Record<AvailabilityDayKey, string[]>> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const raw = input as Record<string, unknown>;
  const result: Partial<Record<AvailabilityDayKey, string[]>> = {};

  for (const dayKey of DAY_KEYS) {
    const dayValue = raw[dayKey];

    if (!Array.isArray(dayValue)) {
      continue;
    }

    const normalized = dayValue
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeTime(entry))
      .filter((entry): entry is string => Boolean(entry));

    result[dayKey] = normalized;
  }

  return result;
}

router.get("/", (_req, res) => {
  return res.json({
    ok: true,
    config: getAvailabilityConfig(),
  });
});

router.post("/", (req, res) => {
  try {
    const sourceMode =
      req.body?.sourceMode === "static" ||
      req.body?.sourceMode === "dashboard" ||
      req.body?.sourceMode === "calendar"
        ? req.body.sourceMode
        : undefined;

    const maxSuggestions =
      typeof req.body?.maxSuggestions === "number"
        ? req.body.maxSuggestions
        : undefined;

    const weeklySlots = parseWeeklySlots(req.body?.weeklySlots);

    const config = updateAvailabilityConfig({
      sourceMode,
      maxSuggestions,
      weeklySlots,
    });

    return res.json({
      ok: true,
      config,
    });
  } catch (error) {
    console.error("availability-config route error:", error);

    return res.status(500).json({
      ok: false,
      error: "availability_config_update_failed",
    });
  }
});

router.post("/reset", (_req, res) => {
  try {
    const config = resetAvailabilityConfig();

    return res.json({
      ok: true,
      config,
    });
  } catch (error) {
    console.error("availability-config reset error:", error);

    return res.status(500).json({
      ok: false,
      error: "availability_config_reset_failed",
    });
  }
});

export default router;
