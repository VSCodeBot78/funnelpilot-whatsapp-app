import { Router } from "express";
import {
  checkStaticAvailability,
  formatAvailabilitySlot,
} from "../services/availability.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const requestedDayLabel =
      typeof req.body?.requestedDayLabel === "string"
        ? req.body.requestedDayLabel
        : undefined;

    const requestedTimeText =
      typeof req.body?.requestedTimeText === "string"
        ? req.body.requestedTimeText
        : undefined;

    const requestedPreference =
      req.body?.requestedPreference === "vormittags" ||
      req.body?.requestedPreference === "nachmittags"
        ? req.body.requestedPreference
        : "unknown";

    const result = await checkStaticAvailability({
      requestedDayLabel,
      requestedTimeText,
      requestedPreference,
    });

    return res.json({
      ok: true,
      requestedDayLabel: result.requestedDayLabel,
      requestedTimeText: result.requestedTimeText,
      isBookable: result.isBookable,
      matchedSlot: result.matchedSlot
        ? {
            day: result.matchedSlot.day,
            time: result.matchedSlot.time,
            label: formatAvailabilitySlot(result.matchedSlot),
          }
        : null,
      suggestions: result.suggestions.map((slot) => ({
        day: slot.day,
        time: slot.time,
        label: formatAvailabilitySlot(slot),
      })),
      reason: result.reason ?? null,
    });
  } catch (error) {
    console.error("availability route error:", error);

    return res.status(500).json({
      ok: false,
      error: "availability_check_failed",
    });
  }
});

export default router;
