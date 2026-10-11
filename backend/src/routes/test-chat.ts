import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { getConversationState } from "../data/store.js";
import { appendHumanMessage, appendUserMessage, getOrCreateConversationState, persistConversationState } from "../core/state-manager.js";
import { PETE_LAB_SCENARIOS, isPeteLabScenarioId, labScenarioPolicy } from "../config/pete-mobile-lab-scenarios.js";
import { readSettings } from "../services/settings-store.js";
import { getPeteBudgetStatusSafe } from "../services/pete-api-budget.service.js";

const router = Router();

// TEMPORARY mobile laboratory, not a general remote administration API.
// Production requests also require the existing authenticated reverse proxy.
// Run this only in a fresh isolated DATA_DIR without real leads.
function guardMobileLab(_req: Request, res: Response, next: NextFunction): void {
  const permitted = process.env.PETE_MOBILE_LAB_ENABLED === "true" &&
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA === "true" &&
    /^[0-9]{1,7}$/.test(process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD ?? "") &&
    !env.INSTAGRAM_SEND_ENABLED && !env.WHATSAPP_SEND_ENABLED &&
    !env.INSTAGRAM_ENGINE_ENABLED && !env.INSTAGRAM_ALLOW_ALL_SENDERS &&
    !env.WHATSAPP_ALLOW_ALL_RECIPIENTS;
  if (!permitted) {
    res.status(404).json({ ok: false, error: "pete_mobile_lab_not_enabled" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
}

function isLabId(value: unknown): value is string {
  return typeof value === "string" && /^lab_[a-zA-Z0-9_-]{20,90}$/.test(value);
}

function publicLabMessages(messages: { id?: string; role: string; text: string }[]) {
  return messages.filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ id: m.id, role: m.role, actor: "actor" in m ? m.actor : undefined, text: m.text }));
}

// Purpose-specific routes: never allow remote lab clients to choose a campaign,
// arbitrary lead ID or access raw conversation state.
router.get("/lab/budget", guardMobileLab, (_req, res) => {
  const status = getPeteBudgetStatusSafe();
  if (!status.ok) return res.status(503).json(status);
  return res.json(status);
});

// Scenario scripts are entirely backend-owned: clients cannot inject a fake
// official opening, change campaign, select a real lead, or send to Meta.
// Start always creates a fresh, empty synthetic conversation.
router.post("/lab/start", guardMobileLab, async (req, res) => {
  const leadId = req.body?.leadId;
  const scenarioId = req.body?.scenarioId;
  if (!isLabId(leadId) || !isPeteLabScenarioId(scenarioId)) {
    return res.status(400).json({ ok: false, error: "invalid_synthetic_scenario" });
  }
  if (!getPeteBudgetStatusSafe().ok) {
    return res.status(503).json({ ok: false, error: "pete_budget_unavailable" });
  }
  if (getConversationState(leadId, DEFAULT_CAMPAIGN_ID)) {
    return res.status(409).json({ ok: false, error: "lab_scenario_already_started" });
  }

  const scenario = PETE_LAB_SCENARIOS[scenarioId];
  try {
    if ("humanText" in scenario) {
      const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
      appendHumanMessage(state, scenario.humanText);
      persistConversationState(state);
      return res.json({
        ok: true, scenarioId, replySource: "human_manual",
        replySuppressedReason: "human_owned",
        state: { messages: publicLabMessages(state.messages) },
      });
    }
    if (labScenarioPolicy(scenarioId) === "human_review") {
      const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
      // Synthetic-only diagnostic marker. Never invent the Reel's actual contents.
      appendUserMessage(state,
        "[Instagram-Anhang geteilt - Inhalt für Pete nicht sichtbar] " + scenario.text);
      persistConversationState(state);
      return res.json({
        ok: true, scenarioId, replySource: "media_guard",
        replySuppressedReason: "shared_media_needs_human_review",
        state: { messages: publicLabMessages(state.messages) },
      });
    }
    const result = await processIncomingMessage({
      leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText: scenario.text,
      conversationMode: "natural",
    });
    return res.json({
      ok: true, scenarioId, reply: result.text,
      replySource: result.state.answers.peteReplySource ?? "deterministic",
      replySuppressedReason: result.replySuppressedReason ?? null,
      state: { messages: publicLabMessages(result.state.messages) },
    });
  } catch {
    return res.status(500).json({ ok: false, error: "pete_mobile_lab_scenario_failed" });
  }
});

router.post("/lab/message", guardMobileLab, async (req, res) => {
  const leadId = req.body?.leadId;
  const text = req.body?.messageText;
  if (!isLabId(leadId) || typeof text !== "string" ||
      !text.trim() || text.length > 1000) {
    return res.status(400).json({ ok: false, error: "invalid_synthetic_test_input" });
  }
  // UI cannot spend while ledger is down, and backend fails closed as well.
  if (!getPeteBudgetStatusSafe().ok) {
    return res.status(503).json({ ok: false, error: "pete_budget_unavailable" });
  }
  try {
    const result = await processIncomingMessage({
      leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText: text,
      conversationMode: "natural",
    });
    return res.json({
      ok: true, reply: result.text,
      replySource: result.state.answers.peteReplySource ?? "deterministic",
      replySuppressedReason: result.replySuppressedReason ?? null,
      state: { messages: publicLabMessages(result.state.messages) },
    });
  } catch {
    return res.status(500).json({ ok: false, error: "pete_mobile_lab_test_failed" });
  }
});

router.get("/lab/state/:leadId", guardMobileLab, (req, res) => {
  const { leadId } = req.params;
  if (!isLabId(leadId)) {
    return res.status(404).json({ ok: false, error: "synthetic_test_only" });
  }
  const state = getConversationState(leadId, DEFAULT_CAMPAIGN_ID);
  if (!state) return res.status(404).json({ ok: false, error: "test_session_missing" });
  return res.json({
    ok: true, state: { messages: publicLabMessages(state.messages) },
  });
});

router.get("/budget", (_req, res) => res.json(getPeteBudgetStatusSafe()));

router.post("/message", async (req, res) => {
  try {
    const { leadId, campaignId, messageText } = req.body ?? {};

    if (!leadId || !campaignId || !messageText) {
      return res.status(400).json({
        ok: false,
        error: "leadId, campaignId und messageText sind erforderlich.",
      });
    }

    const result = await processIncomingMessage({
      leadId,
      campaignId,
      messageText,
      conversationMode: readSettings().dmConversationMode === "natural" ? "natural" : "legacy",
    });

    return res.json({
      ok: true,
      reply: result.text,
      nextStep: result.nextStep,
      detectedIntent: result.detectedIntent,
      replySource: result.state.answers.peteReplySource ?? "legacy",
      replySuppressedReason: result.replySuppressedReason ?? null,
      state: result.state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Test-Chat.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.get("/state/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;

    if (!leadId || !campaignId) {
      return res.status(400).json({
        ok: false,
        error: "leadId und campaignId sind erforderlich.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    return res.json({
      ok: true,
      leadId,
      campaignId,
      state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Laden des Test-States.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
