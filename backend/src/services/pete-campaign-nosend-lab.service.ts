import crypto from "node:crypto";
import type { PeteCampaignDraftContext } from "./pete-campaign-entry-preview.service.js";
import { getCampaignById as getSavedCampaignById, normalizePeteCampaignConfig } from "../data/campaigns.store.js";

// A single synthetic bridge between saved V2 drafts and Pete's EXISTING owner lab.
// It has no transport, Meta, provider, campaign-runtime or send capability.
export type NoSendFlowStage = "await_button" | "await_link" | "pete_ready" | "finished";
export type NoSendFlowView = {
  version: 1;
  mode: "nosend_only";
  sendAllowed: false;
  campaignId: string;
  source: string;
  stage: NoSendFlowStage;
  buttonLabel: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  peteHandoffConfigured: boolean;
  openingVariant: number;
};
type InternalFlow = {
  sessionHash: string;
  expiresAt: number;
  view: NoSendFlowView;
  linkText: string;
  campaignFingerprint: string;
  matchedKeyword: string | null;
};
export type NoSendPeteCampaignContext = Readonly<{
  campaignId: string;
  source: string;
  matchedKeyword: string | null;
}>;
const FLOWS = new Map<string, InternalFlow>();
const TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FLOWS = 1024;

/** A changed/deleted campaign cannot silently become the default Pete offer. */
function campaignFingerprint(campaignId: string): string | null {
  const record = getSavedCampaignById(campaignId);
  if (!record || record.id !== campaignId) return null;
  const data = JSON.stringify({
    name: typeof record.name === "string" ? record.name : "",
    draft: normalizePeteCampaignConfig(record.peteCampaign),
    offer: record.offerContext ?? null,
  });
  return crypto.createHash("sha256").update(data).digest("hex");
}

function validSession(leadId: string, sessionHash: string): boolean {
  return /^lab_desktop_[a-f0-9]{48}$/.test(leadId) && /^[a-f0-9]{64}$/.test(sessionHash);
}
function cleanExpired(): void {
  const now = Date.now();
  for (const [id, flow] of FLOWS) if (flow.expiresAt <= now) FLOWS.delete(id);
}
function safeMessage(value: string | null | undefined): string {
  return String(value || "").trim();
}
function linkMessage(flow: InternalFlow): string {
  // A link is displayed, NOT visited and never delivered to Meta.
  return [flow.linkText, flow.view.linkUrl].filter(Boolean).join("\n");
}
function nextStage(view: NoSendFlowView): NoSendFlowStage {
  return view.peteHandoffConfigured ? "pete_ready" : "finished";
}

/** Returns null rather than pretending a disabled, ambiguous or Reel draft was run. */
export function startNoSendDraftFlow(input: {
  leadId: string;
  sessionHash: string;
  draft: PeteCampaignDraftContext | null;
}): { flow: NoSendFlowView; openingMessage: string } | null {
  const { leadId, sessionHash, draft } = input;
  if (!validSession(leadId, sessionHash)) throw Error("nosend_session_denied");
  if (!draft || draft.version !== 1 || draft.mode !== "preview_only" ||
      draft.sendAllowed !== false || draft.flowDraft.sendAllowed !== false ||
      !draft.flowDraft.enabled || !draft.flowDraft.autoReplyEnabled ||
      !safeMessage(draft.flowDraft.text) ||
      !["instagram_dm", "instagram_story_reply"].includes(draft.source)) return null;
  const fingerprint = campaignFingerprint(draft.campaignId);
  if (!fingerprint) return null;
  cleanExpired();
  if (FLOWS.has(leadId)) throw Error("nosend_flow_already_started");
  if (FLOWS.size >= MAX_FLOWS) throw Error("nosend_flow_capacity");

  const config = draft.flowDraft;
  const variants = [safeMessage(config.text), ...config.openingDmVariants.map(safeMessage).filter(Boolean)];
  const openingVariant = crypto.createHash("sha256").update(leadId).digest().readUInt32BE(0) % variants.length;
  const withButton = config.openingDmButtonEnabled && Boolean(safeMessage(config.openingDmButtonLabel));
  const withLink = config.linkEnabled && Boolean(config.linkUrl?.startsWith("https://"));
  const view: NoSendFlowView = {
    version: 1, mode: "nosend_only", sendAllowed: false,
    campaignId: draft.campaignId, source: draft.source,
    stage: withButton ? "await_button" : withLink ? "await_link" :
      config.peteHandoffEnabled ? "pete_ready" : "finished",
    buttonLabel: withButton ? safeMessage(config.openingDmButtonLabel) : null,
    linkLabel: withLink ? safeMessage(config.linkLabel) || "Link (Simulation)" : null,
    linkUrl: withLink ? config.linkUrl : null,
    peteHandoffConfigured: config.peteHandoffEnabled,
    openingVariant,
  };
  const flow: InternalFlow = { sessionHash, expiresAt: Date.now() + TTL_MS,
    view, linkText: safeMessage(config.linkMessageText),
    campaignFingerprint: fingerprint, matchedKeyword: draft.matchedKeyword };
  FLOWS.set(leadId, flow);
  const openingMessage = [variants[openingVariant], !withButton && withLink ? linkMessage(flow) : ""]
    .filter(Boolean).join("\n");
  return { flow: { ...view }, openingMessage };
}

/** Session scope is rechecked on every read/action; other sessions learn nothing. */
export function getNoSendDraftFlow(leadId: string, sessionHash: string): NoSendFlowView | null {
  if (!validSession(leadId, sessionHash)) return null;
  const record = FLOWS.get(leadId);
  if (!record || record.sessionHash !== sessionHash) return null;
  if (record.expiresAt <= Date.now()) { FLOWS.delete(leadId); return null; }
  return { ...record.view };
}

/** One explicit synthetic interaction advances exactly one persisted stage. */
export function advanceNoSendDraftFlow(input: {
  leadId: string;
  sessionHash: string;
  action: "button" | "link";
}): { flow: NoSendFlowView; message: string | null } {
  const { leadId, sessionHash, action } = input;
  const view = getNoSendDraftFlow(leadId, sessionHash);
  if (!view) throw Error("nosend_flow_missing");
  const record = FLOWS.get(leadId)!;
  if (campaignFingerprint(view.campaignId) !== record.campaignFingerprint)
    throw Error("nosend_campaign_context_stale");
  if (view.stage === "await_button" && action === "button") {
    record.view.buttonLabel = null;
    record.view.stage = view.linkUrl ? "await_link" : nextStage(view);
    return { flow: { ...record.view }, message: view.linkUrl ? linkMessage(record) : null };
  }
  if (view.stage === "await_link" && action === "link") {
    record.view.linkLabel = null;
    record.view.stage = nextStage(view);
    return { flow: { ...record.view }, message: null };
  }
  throw Error("nosend_action_out_of_order");
}

/** Only the owning authenticated test session can expose a ready campaign to Pete. */
export function getReadyNoSendPeteCampaignContext(
  leadId: string, sessionHash: string,
): NoSendPeteCampaignContext | null {
  const view = getNoSendDraftFlow(leadId, sessionHash);
  if (!view || view.stage !== "pete_ready" || !view.peteHandoffConfigured) return null;
  const record = FLOWS.get(leadId);
  if (!record || campaignFingerprint(view.campaignId) !== record.campaignFingerprint)
    return null;
  return Object.freeze({
    campaignId: view.campaignId,
    source: view.source,
    matchedKeyword: record.matchedKeyword,
  });
}
