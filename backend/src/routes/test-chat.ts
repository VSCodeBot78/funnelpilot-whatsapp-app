import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { getConversationState } from "../data/store.js";
import { appendAssistantMessage, appendHumanMessage, appendUserMessage, getOrCreateConversationState, persistConversationState, releaseToAi } from "../core/state-manager.js";
import { PETE_LAB_SCENARIOS, getScriptedLabLines, isPeteLabScenarioId, labScenarioPolicy } from "../config/pete-mobile-lab-scenarios.js";
import { getPeteBudgetStatusSafe, getPeteDesktopBudgetStatus, setPeteDesktopBudget } from "../services/pete-api-budget.service.js";
import { startDesktopBrowserSession, guardDesktopBrowser, issueDesktopLead, assertIssuedDesktopLead,
  desktopSessionHash, desktopProviderConfigured, runDesktopConversation } from "../services/pete-desktop-lab.service.js";
import { isPeteLlmReadyForProvider } from "../core/pete-llm-conversation.js";
import { getAllCampaigns } from "../data/campaigns.store.js";
import { evaluateCampaignEntryPreview } from "../services/pete-campaign-entry-preview.service.js";
import { OFFER_TRUTH } from "../config/offer-truth.js";
import { getCalendlyAvailableSlots } from "../services/calendly-availability.service.js";
import { formatAvailabilitySlot } from "../services/availability.service.js";
import { getProviderConfig } from "../config/scheduling-providers.js";
import { getAvailabilityConfig } from "../data/availability-config.store.js";

const router = Router();

// All paid desktop control stays under this authenticated local namespace.
// No provider request is made by session/status/budget/lead/entry endpoints.
router.post("/desktop/session", startDesktopBrowserSession);
// Browser same-origin GET omits Origin. Read-only POST aliases preserve the
// exact existing Origin/Host/session/CSRF/JSON guards; GET stays unchanged.
function desktopStatus(req: Request, res: Response) {
  const budget = getPeteDesktopBudgetStatus(desktopSessionHash(req));
  return res.json({ ok: true, budget, providerConfigured: desktopProviderConfigured(),
    model: "gpt-6.1-sol", globalApiCallsApproved: false, sendsEnabled: false });
}
router.route("/desktop/status")
  .get(guardDesktopBrowser, desktopStatus)
  .post(guardDesktopBrowser, desktopStatus);
router.post("/desktop/budget", guardDesktopBrowser, (req, res) => {
  const { enabled, budgetUsd, ownerManagedCosts } = req.body ?? {};
  if (typeof enabled !== "boolean" ||
      (enabled && !["0.25", "0.50", "1.00", "2.00"].includes(budgetUsd)) ||
      (ownerManagedCosts !== undefined && (ownerManagedCosts !== true || !enabled)) ||
      Object.keys(req.body).some(key => !["enabled", "budgetUsd", "ownerManagedCosts"].includes(key)))
    return res.status(400).json({ ok: false, error: "invalid_desktop_budget" });
  if (enabled && !desktopProviderConfigured())
    return res.status(409).json({ ok: false, error: "desktop_provider_not_configured" });
  try {
    setPeteDesktopBudget({ enabled, sessionHash: desktopSessionHash(req),
      ownerManagedCosts,
      limitMicroUsd: enabled ? Math.round(Number(budgetUsd) * 1_000_000) : undefined });
    return res.json({ ok: true, budget: getPeteDesktopBudgetStatus(desktopSessionHash(req)) });
  } catch {
    return res.status(409).json({ ok: false, error: "desktop_budget_locked",
      budget: getPeteDesktopBudgetStatus(desktopSessionHash(req)) });
  }
});
router.post("/desktop/lead", guardDesktopBrowser, (req, res) => {
  try {
    const leadId = issueDesktopLead(req);
    const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
    state.source = "lab_desktop";
    persistConversationState(state);
    return res.json({ ok: true, leadId, campaignId: DEFAULT_CAMPAIGN_ID });
  } catch { return res.status(409).json({ ok: false, error: "desktop_lead_not_created" }); }
});
function desktopState(req: Request, res: Response) {
  try {
    assertIssuedDesktopLead(req, req.params.leadId, DEFAULT_CAMPAIGN_ID);
    const state = getConversationState(req.params.leadId as string, DEFAULT_CAMPAIGN_ID);
    return res.json({ ok: true, state: { messages: publicLabMessages(state?.messages ?? []) } });
  } catch { return res.status(403).json({ ok: false, error: "desktop_server_issued_lead_required" }); }
}
router.route("/desktop/state/:leadId")
  .get(guardDesktopBrowser, desktopState)
  .post(guardDesktopBrowser, desktopState);
router.post("/desktop/message", guardDesktopBrowser, async (req, res) => {
  const { leadId, campaignId, messageText } = req.body ?? {};
  try { assertIssuedDesktopLead(req, leadId, campaignId); }
  catch { return res.status(403).json({ ok: false, error: "desktop_server_issued_lead_required" }); }
  if (typeof messageText !== "string" || !messageText.trim() || messageText.length > 1500 ||
      Object.keys(req.body).some(key => !["leadId", "campaignId", "messageText"].includes(key)))
    return res.status(400).json({ ok: false, error: "invalid_desktop_message" });
  try {
    const result = await runDesktopConversation(req, leadId, () => processIncomingMessage({
      leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText, conversationMode: "natural",
    }));
    const a = result.state.answers;
    return res.json({ ok: true, reply: result.text,
      replySource: a.peteReplySource ?? "deterministic",
      providerUsage: a.peteReplySource === "llm" && a.peteProviderUsageMetered === true
        ? { model: a.peteProviderModel, inputTokens: a.peteProviderInputTokens,
          outputTokens: a.peteProviderOutputTokens } : null,
      replySuppressedReason: result.replySuppressedReason ?? null,
      state: { messages: publicLabMessages(result.state.messages) },
      budget: getPeteDesktopBudgetStatus(desktopSessionHash(req)) });
  } catch {
    return res.status(503).json({ ok: false, error: "desktop_test_unavailable",
      budget: getPeteDesktopBudgetStatus(desktopSessionHash(req)) });
  }
});

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
function simulateDesktopEntry(req: Request, res: Response) {
  if (env.NODE_ENV === "production" ||
      (env.NODE_ENV !== "test" && !env.LOCAL_LAPTOP_TEST_MODE) ||
      env.INSTAGRAM_SEND_ENABLED || env.WHATSAPP_SEND_ENABLED ||
      env.INSTAGRAM_ENGINE_ENABLED) {
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
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    entryKeyword: keyword, entrySource: source,
    matchedRealCampaign: preview.status === "matched",
    campaignMatchStatus: preview.status,
    note: preview.status === "matched"
      ? "Kampagnenentwurf als synthetische Nachricht verwendet."
      : "Beispiel-Einstieg; keine echte Kampagne oder Meta-Zustellung verifiziert.",
    state: { messages: publicLabMessages(state.messages) },
  });
}
router.post("/simulate-entry", simulateDesktopEntry);
router.post("/desktop/entry", guardDesktopBrowser, (req, res) => {
  if (Object.keys(req.body ?? {}).some(key => !["keyword", "source"].includes(key)))
    return res.status(400).json({ ok: false, error: "invalid_desktop_entry" });
  try {
    const leadId = issueDesktopLead(req);
    req.body = { ...req.body, leadId };
    return simulateDesktopEntry(req, res);
  } catch { return res.status(409).json({ ok: false, error: "desktop_entry_not_created" }); }
});

// OWNER DIAGNOSTIC ONLY: does not mutate leads, book events or send messages.
// The read-only Calendly API is contacted only after the owner presses the
// corresponding test-lab button. Never claim ChatGPT OAuth is Funnel Pilot OAuth.
router.get("/calendly-readiness", async (_req, res) => {
  if (env.NODE_ENV === "production" || env.INSTAGRAM_SEND_ENABLED ||
      env.WHATSAPP_SEND_ENABLED || env.INSTAGRAM_ENGINE_ENABLED) {
    return res.status(403).json({ ok: false, status: "test_mode_required" });
  }
  res.setHeader("Cache-Control", "no-store");
  const activeSourceMode = getAvailabilityConfig().sourceMode;
  const peteUsesCalendar = activeSourceMode === "calendar";
  const url = getProviderConfig(DEFAULT_CAMPAIGN_ID, "calendly").bookingUrl;
  const bookingUrl = typeof url === "string" && /^https:\/\/(?:www\.)?calendly\.com\//i.test(url) ? url : null;
  if (!process.env.CALENDLY_PAT?.trim()) {
    return res.json({ ok: true, status: "credentials_missing",
      checkedAt: new Date().toISOString(), slots: [], bookingUrl,
      peteUsesCalendar, source: "not_checked", note: "Funnel Pilot hat keinen CALENDLY_PAT. ChatGPT-Verbindungen gelten hier nicht." });
  }
  try {
    const slots = await getCalendlyAvailableSlots({ campaignId: DEFAULT_CAMPAIGN_ID, daysAhead: 14 });
    return res.json({
      ok: true, status: slots.length ? "verified_slots" : "no_verified_slots",
      checkedAt: new Date().toISOString(), bookingUrl, peteUsesCalendar, source: "calendly_api",
      slots: slots.filter(slot => slot.date && slot.startAt).slice(0, 9)
        .map(slot => ({ date: slot.date, time: slot.time, startAt: slot.startAt,
          label: formatAvailabilitySlot(slot) })),
      note: slots.length ? "Echte Provider-Abfrage in Funnel Pilot. Keine Reservierung." :
        "Calendly hat keine aktuell verifizierbaren Slots für diesen Eventtyp geliefert.",
    });
  } catch {
    return res.json({ ok: true, status: "provider_unavailable",
      checkedAt: new Date().toISOString(), slots: [], bookingUrl, peteUsesCalendar, source: "calendly_api_failed",
      note: "Calendly-Verfügbarkeit konnte nicht geprüft werden. Keine Zeiten versprechen." });
  }
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
