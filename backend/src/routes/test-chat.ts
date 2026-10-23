import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { getConversationState } from "../data/store.js";
import { appendAssistantMessage, appendHumanMessage, appendUserMessage, getOrCreateConversationState, persistConversationState, releaseToAi } from "../core/state-manager.js";
import { PETE_LAB_SCENARIOS, getScriptedLabLines, isPeteLabScenarioId, labScenarioPolicy } from "../config/pete-mobile-lab-scenarios.js";
import { getPeteBudgetStatusSafe } from "../services/pete-api-budget.service.js";
import { isPeteLlmReadyForProvider } from "../core/pete-llm-conversation.js";
import { getAllCampaigns } from "../data/campaigns.store.js";
import { evaluateCampaignEntryPreview } from "../services/pete-campaign-entry-preview.service.js";
import { OFFER_TRUTH } from "../config/offer-truth.js";

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
    .map(m => ({ id: m.id, role: m.role, actor: "actor" in m ? m.actor : undefined,
      syntheticAutomation: "transport" in m && m.transport === "lab_scripted_automation",
      text: m.text }));
}

// Purpose-specific routes: never allow remote lab clients to choose a campaign,
// arbitrary lead ID or access raw conversation state.
router.get("/lab/budget", guardMobileLab, (_req, res) => {
  const status = getPeteBudgetStatusSafe();
  if (!status.ok) return res.status(503).json(status);
  // Report the actual backend mode. No secrets, model-generated messages,
  // profile data, or live channel switches are sent to the phone.
  let llmReady = false;
  try { llmReady = isPeteLlmReadyForProvider(); }
  catch { llmReady = false; }
  return res.json({ ...status, llmReady, mode: llmReady ? "gpt-5.4" : "deterministic" });
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
    const scripted = getScriptedLabLines(scenarioId);
    if (scripted) {
      const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
      // Simulate an existing history WITHOUT dispatching the messages, calling
      // an LLM, or talking to a social provider. These are fictional events.
      for (const line of scripted) {
        if (line.kind === "lead") appendUserMessage(state, line.text);
        else if (line.kind === "human") appendHumanMessage(state, line.text);
        else {
          appendAssistantMessage(state, line.text);
          // The mobile UI must not mislabel a simulated ManyChat message as
          // a genuine Pete response or offer thumbs-up review for it.
          const saved = state.messages.at(-1);
          if (saved) {
            saved.transport = "lab_scripted_automation";
            saved.outboundStatus = "dry_run";
            saved.dryRun = true;
            saved.sent = false;
          }
        }
      }
      // This is an EXPLICIT synthetic handoff for test purposes only.
      // The old jochen_greeting scenario still represents real human ownership.
      if ("transferToPete" in scenario && scenario.transferToPete === true) {
        releaseToAi(state);
      }
      state.source = "source" in scenario ? "lab_" + scenario.source : "lab_scripted";
      state.answers.labScenarioId = scenarioId;
      if ("publicReplyPreview" in scenario)
        state.answers.labPublicReplyPreview = scenario.publicReplyPreview;
      persistConversationState(state);
      return res.json({
        ok: true, scenarioId, reply: null,
        replySource: "scripted_context",
        replySuppressedReason: "awaiting_synthetic_lead_reply",
        publicReplyPreview: "publicReplyPreview" in scenario
          ? scenario.publicReplyPreview : null,
        state: { messages: publicLabMessages(state.messages) },
      });
    }
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
    // Scripted scenarios were handled above. Explicitly narrow the remaining
    // union before reading `text`; all non-scripted scenarios have text.
    if (!("text" in scenario)) {
      return res.status(400).json({ ok: false, error: "invalid_synthetic_scenario_type" });
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
    ok: true,
    publicReplyPreview: typeof state.answers.labPublicReplyPreview === "string"
      ? state.answers.labPublicReplyPreview : null,
    state: { messages: publicLabMessages(state.messages) },
  });
});

// Desktop-only entry simulation: the opening is ALWAYS scripted, with no
// LLM call, no Meta event, no outbound transport and no use of real contacts.
// A later human-typed reply goes through the ordinary test-chat message route.
const DESKTOP_ENTRY_KEYWORDS = ["CHECK", "KETO", "BULLSHIT"] as const;
const DESKTOP_ENTRY_SOURCES = [
  "instagram_dm", "instagram_story_reply", "instagram_reel_comment",
] as const;
router.post("/simulate-entry", (req, res) => {
  if (env.NODE_ENV === "production" || env.INSTAGRAM_SEND_ENABLED ||
      env.WHATSAPP_SEND_ENABLED || env.INSTAGRAM_ENGINE_ENABLED) {
    return res.status(403).json({ ok: false, error: "desktop_synthetic_lab_only_send_flags_off" });
  }
  const { leadId, keyword, source } = req.body ?? {};
  if (typeof leadId !== "string" ||
      !/^lab_desktop_[a-zA-Z0-9_-]{10,70}$/.test(leadId) ||
      !DESKTOP_ENTRY_KEYWORDS.includes(keyword) ||
      !DESKTOP_ENTRY_SOURCES.includes(source)) {
    return res.status(400).json({ ok: false, error: "invalid_synthetic_entry" });
  }
  if (getConversationState(leadId, DEFAULT_CAMPAIGN_ID)) {
    return res.status(409).json({ ok: false, error: "synthetic_entry_already_started" });
  }
  const preview = evaluateCampaignEntryPreview(getAllCampaigns(), {
    source, messageText: keyword,
  });
  // For a reel comment without a trustworthy media ID, the existing matcher
  // will deliberately show manual_review, not pretend a Meta event matched.
  const safeExamples: Record<string, string> = {
    CHECK: "Hier findest du den Elterncheck: " + OFFER_TRUTH.resources.elterncheck.url +
      ". Wenn du Fragen dazu hast, schreib mir einfach.",
    KETO: "Hier ist der kostenlose Keto Guide: " + OFFER_TRUTH.resources.ketoGuide.url +
      ". Bei Fragen kannst du mir direkt schreiben.",
    BULLSHIT: "Hier ist der No Bullshit Elternfitness Selbststarter: " +
      OFFER_TRUTH.selfstarter.productUrl + ". Schau ihn dir in Ruhe an.",
  };
  const storedOpening = preview.status === "matched"
    ? preview.openingTextPreview : null;
  const openingText = storedOpening || safeExamples[keyword];
  const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
  // A public Reel comment is NOT an inbound DM and cannot create a 24h
  // private conversation window. A user's later DM reply does open one.
  if (source !== "instagram_reel_comment") appendUserMessage(state, keyword);
  appendAssistantMessage(state, openingText);
  const message = state.messages.at(-1);
  if (message) {
    message.transport = "lab_scripted_automation";
    message.outboundStatus = "dry_run";
    message.dryRun = true;
    message.sent = false;
  }
  state.source = "lab_" + source;
  state.answers.labEntryKeyword = keyword;
  state.answers.labEntrySource = source;
  state.answers.labCampaignMatchStatus = preview.status;
  persistConversationState(state);
  return res.json({
    ok: true, reply: null, replySource: "scripted_context",
    entryKeyword: keyword, entrySource: source,
    matchedRealCampaign: preview.status === "matched",
    campaignMatchStatus: preview.status,
    note: preview.status === "matched"
      ? "Kampagnenentwurf als synthetische Nachricht verwendet."
      : "Beispiel-Einstieg; keine echte Kampagne oder Meta-Zustellung verifiziert.",
    state: { messages: publicLabMessages(state.messages) },
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
      conversationMode: "natural",
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
