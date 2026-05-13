import { Router, type Request, type Response } from "express";
import {
  readSettings,
  writeSettings,
  resetSettings,
  type SettingsConfig,
} from "../services/settings-store.js";
import { env } from "../config/env.js";

const router = Router();

function isValidOptionalUrl(value: unknown): boolean {
  const url = String(value ?? "").trim();
  return !url || url.startsWith("http://") || url.startsWith("https://");
}

function validateLegalSettings(payload: Partial<SettingsConfig>): string | null {
  if (!isValidOptionalUrl(payload.privacyPolicyUrl)) {
    return "privacy_policy_url_invalid";
  }

  if (!isValidOptionalUrl(payload.imprintUrl)) {
    return "imprint_url_invalid";
  }

  return null;
}

router.get("/settings-config", (_req: Request, res: Response) => {
  try {
    const settings = readSettings();

    return res.json({
      ok: true,
      settings,
      openAiApiKeyConfigured: env.OPENAI_API_KEY_CONFIGURED,
      openAiModelConfigured: Boolean(settings.aiModel?.trim()),
    });
  } catch (error) {
    console.error("settings GET error:", error);

    return res.status(500).json({
      ok: false,
      error: "settings_load_failed",
    });
  }
});

router.post("/settings-config", (req: Request, res: Response) => {
  try {
    const payload = (req.body ?? {}) as Partial<SettingsConfig>;
    const validationError = validateLegalSettings(payload);

    if (validationError) {
      return res.status(400).json({
        ok: false,
        error: validationError,
        message:
          "Rechtliche Links müssen leer sein oder mit http:// bzw. https:// beginnen.",
      });
    }

    const nextSettings = writeSettings(payload);

    return res.json({
      ok: true,
      settings: nextSettings,
      openAiApiKeyConfigured: env.OPENAI_API_KEY_CONFIGURED,
      openAiModelConfigured: Boolean(nextSettings.aiModel?.trim()),
    });
  } catch (error) {
    console.error("settings POST error:", error);

    return res.status(500).json({
      ok: false,
      error: "settings_save_failed",
    });
  }
});

router.post("/settings-config/reset", (_req: Request, res: Response) => {
  try {
    const reset = resetSettings();

    return res.json({
      ok: true,
      settings: reset,
      openAiApiKeyConfigured: env.OPENAI_API_KEY_CONFIGURED,
      openAiModelConfigured: Boolean(reset.aiModel?.trim()),
    });
  } catch (error) {
    console.error("settings RESET error:", error);

    return res.status(500).json({
      ok: false,
      error: "settings_reset_failed",
    });
  }
});

export default router;
