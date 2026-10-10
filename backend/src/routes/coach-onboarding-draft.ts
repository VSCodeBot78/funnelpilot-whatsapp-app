import { Router } from "express";
import {
  readCoachOnboardingDraft, saveCoachOnboardingDraft,
} from "../services/coach-onboarding-draft.js";

const router = Router();

// Configuration-only single-workspace draft. Never activates AI, campaigns,
// payments, live sends, new workspaces, or Meta integrations.
router.get("/coach-onboarding-draft", (_req, res) => {
  try {
    return res.json({ ok: true, draft: readCoachOnboardingDraft() });
  } catch {
    return res.status(409).json({
      ok: false, error: "coach_draft_invalid_restore_required",
      message: "Gespeicherte Coach-Vorlage kann nicht gelesen werden. Datei sichern und prüfen.",
    });
  }
});

router.post("/coach-onboarding-draft", (req, res) => {
  try {
    const result = saveCoachOnboardingDraft(req.body);
    if (!result.ok) {
      return res.status(400).json({
        ok: false, error: "coach_draft_validation_failed", issues: result.issues,
      });
    }
    return res.json({ ok: true, draft: result.draft,
      message: "Coach-Vorlage gespeichert. Nicht aktiviert." });
  } catch {
    return res.status(409).json({
      ok: false, error: "coach_draft_invalid_restore_required",
      message: "Vorlage konnte nicht gespeichert werden. Bestehende Datei wird nicht überschrieben.",
    });
  }
});

export default router;
