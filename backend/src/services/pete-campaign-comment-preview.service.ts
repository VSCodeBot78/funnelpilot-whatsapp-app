import {
  getAllCampaigns,
  normalizeCampaignAutomationDraft,
  type CampaignRecord,
} from "../data/campaigns.store.js";

export type InstagramCommentEvent = {
  commentId: string;
  instagramAccountId: string;
  commenterId: string;
  mediaId: string;
  text: string;
  createdAtMs?: number;
};

export type InstagramCommentPlan = {
  campaignId: string;
  commentId: string;
  commenterId: string;
  mediaId: string;
  keyword: string;
  publicReply: string | null;
  openingDm: string | null;
  buttonLabel: string | null;
  resourceKey: "check" | "keto" | "selfstarter" | "none";
  // Deliberately no send/execute function or network call in this layer.
  previewOnly: true;
};

export type InstagramCommentMatchResult =
  | { ok: true; plan: InstagramCommentPlan }
  | { ok: false; reason: "no_match" | "ambiguous_campaigns" };

const normalize = (x: unknown) => String(x ?? "").trim();
const maxString = (x: unknown, max: number) => normalize(x).slice(0, max);
const parseMillis = (x: unknown): number | undefined => {
  const num = Number(x);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num < 1e12 ? num * 1000 : num;
};

/**
 * A comment is NOT a DM. Meta sends comment changes in a distinct envelope.
 * Parse comments separately without smuggling them into the message pipeline.
 */
export function parseInstagramCommentEvents(payload: unknown): InstagramCommentEvent[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const input = payload as Record<string, unknown>;
  if (normalize(input.object).toLowerCase() !== "instagram") return [];
  const entries = Array.isArray(input.entry) ? input.entry : [];
  const seen = new Set<string>();
  const events: InstagramCommentEvent[] = [];
  for (const item of entries.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const itemChange of changes.slice(0, 30)) {
      if (!itemChange || typeof itemChange !== "object") continue;
      const change = itemChange as Record<string, unknown>;
      if (normalize(change.field).toLowerCase() !== "comments") continue;
      const value = change.value && typeof change.value === "object"
        ? change.value as Record<string, unknown> : {};
      const from = value.from && typeof value.from === "object"
        ? value.from as Record<string, unknown> : {};
      const media = value.media && typeof value.media === "object"
        ? value.media as Record<string, unknown> : {};
      const commentId = maxString(value.id, 180);
      const commenterId = maxString(from.id, 180);
      const accountId = maxString(entry.id, 180);
      const mediaId = maxString(media.id, 180);
      const text = maxString(value.text, 900);
      if (!commentId || !commenterId || !accountId || !mediaId || !text || seen.has(commentId)) continue;
      seen.add(commentId);
      events.push({
        commentId, instagramAccountId: accountId,
        commenterId, mediaId, text,
        createdAtMs: parseMillis(value.timestamp ?? entry.time),
      });
      if (events.length >= 50) return events;
    }
  }
  return events;
}

const keywordTokens = (raw: string) => [...new Set(raw.split(",")
  .map(word => word.trim()).filter(Boolean))].slice(0, 12);
const escapeRegex = (value: string) => value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
function findKeyword(text: string, configured: string): string | null {
  for (const keyword of keywordTokens(configured)) {
    if (keyword.length < 2 || keyword.length > 32) continue;
    const pattern = new RegExp(
      "(?:^|[^\\p{L}\\p{N}_])" + escapeRegex(keyword) + "(?=$|[^\\p{L}\\p{N}_])", "iu",
    );
    if (pattern.test(text)) return keyword.toLocaleUpperCase("de-DE");
  }
  return null;
}

function stableIndex(commentId: string, campaignId: string, count: number): number {
  let value = 2166136261;
  for (const ch of commentId + "|" + campaignId) {
    value = Math.imul(value ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return count ? value % count : 0;
}

/**
 * Fail closed on ambiguous campaigns. A comment may only pick ONE setup.
 * The `next post` mode requires a separately captured next-media binding,
 * which is deliberately unavailable in this preview release.
 */
export function selectInstagramCommentCampaign(
  event: InstagramCommentEvent,
  campaigns: CampaignRecord[] = getAllCampaigns(),
): InstagramCommentMatchResult {
  const matched: { campaign: CampaignRecord; keyword: string; priority: number }[] = [];
  for (const campaign of campaigns) {
    const cfg = normalizeCampaignAutomationDraft(campaign.automationDraft);
    if (!cfg.enabled || !cfg.triggers.comments) continue;
    const keyword = findKeyword(event.text, cfg.keywords);
    if (!keyword) continue;
    if (cfg.commentScope === "next") continue;
    const specific = cfg.commentScope === "specific";
    if (specific && !cfg.specificPostIds.split(",").map(id => id.trim()).includes(event.mediaId))
      continue;
    matched.push({ campaign, keyword, priority: specific ? 2 : 1 });
  }
  if (!matched.length) return { ok: false, reason: "no_match" };
  const highest = Math.max(...matched.map(x => x.priority));
  const tied = matched.filter(x => x.priority === highest);
  if (tied.length !== 1) return { ok: false, reason: "ambiguous_campaigns" };
  const { campaign, keyword } = tied[0];
  const cfg = normalizeCampaignAutomationDraft(campaign.automationDraft);
  const variants = cfg.publicReplies.map(s => s.trim()).filter(Boolean);
  const publicReply = cfg.publicReplyEnabled && variants.length
    ? variants[stableIndex(event.commentId, campaign.id, variants.length)] : null;
  return {
    ok: true,
    plan: {
      campaignId: campaign.id,
      commentId: event.commentId,
      commenterId: event.commenterId,
      mediaId: event.mediaId,
      keyword,
      publicReply,
      openingDm: cfg.openingMessageEnabled ? cfg.openingMessage.trim() || null : null,
      buttonLabel: cfg.openingMessageEnabled ? cfg.confirmationLabel.trim() || null : null,
      resourceKey: cfg.resourceKey,
      previewOnly: true,
    },
  };
}

/**
 * Conservative follow-up safety: a public comment and a private reply do NOT
 * qualify as a user's DM. Even if configured for 24h, overdue messages are
 * suppressed when the 24h organic customer-service window has elapsed.
 */
export function maySendOrganicInstagramFollowUp(input: {
  lastInboundUserDmAt?: string;
  now: string;
  automationEnabled: boolean;
  isHumanOwned: boolean;
  aiPaused: boolean;
  stopped: boolean;
  optedOut: boolean;
  botEnabled: boolean;
}): boolean {
  if (!input.automationEnabled || input.isHumanOwned || input.aiPaused ||
      input.stopped || input.optedOut || !input.botEnabled || !input.lastInboundUserDmAt)
    return false;
  const now = Date.parse(input.now);
  const last = Date.parse(input.lastInboundUserDmAt);
  if (!Number.isFinite(now) || !Number.isFinite(last) || now < last) return false;
  // 5-minute guard before 24h expiry. No claim about special ad windows.
  return now - last < 23 * 60 * 60 * 1000 + 55 * 60 * 1000;
}
