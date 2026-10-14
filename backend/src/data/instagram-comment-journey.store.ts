import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "./private-json-file.js";

/**
 * Phase 65: persistent, single-process Instagram comment journey ledger.
 * NO Meta calls, scheduler, AI spend or live-send permission are provided here.
 * A real sender must still verify Meta scopes, consent, the current human/STOP
 * guard and the allowed reply window IMMEDIATELY before every outbound call.
 *
 * This JSON store is NOT safe for multiple Node replicas or shared DATA_DIR
 * writers. Multi-instance deployment requires transactional database locking.
 */
export type CommentDeliveryKind =
  | "public_reply" | "private_reply" | "resource_link" | "followup";
export type CommentDeliveryStatus =
  | "not_prepared" | "prepared" | "dispatching" | "dry_run"
  | "blocked" | "failed" | "uncertain" | "sent";
export type CommentDeliveryReceipt = {
  status: CommentDeliveryStatus;
  updatedAtMs?: number;
  metaMessageId?: string;
  errorCode?: string;
};
export type InstagramCommentJourney = {
  key: string;
  instagramAccountId: string;
  commentId: string;
  commenterId: string;
  mediaId: string;
  campaignId: string;
  keyword: string;
  commentCreatedAtMs: number;
  createdAtMs: number;
  confirmedInboundEventId?: string;
  confirmedInboundAtMs?: number;
  delivery: Record<CommentDeliveryKind, CommentDeliveryReceipt>;
};
export type NewCommentJourney = Pick<InstagramCommentJourney,
  "instagramAccountId" | "commentId" | "commenterId" | "mediaId" |
  "campaignId" | "keyword" | "commentCreatedAtMs"> & {
  publicReplyPrepared: boolean;
  privateReplyPrepared: boolean;
};
export type JourneyRegistration =
  | { result: "created" | "duplicate"; journey: InstagramCommentJourney }
  | { result: "conflict"; journey: InstagramCommentJourney };

const STAGES: CommentDeliveryStatus[] = [
  "not_prepared", "prepared", "dispatching", "dry_run",
  "blocked", "failed", "uncertain", "sent",
];
const validTime = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const clean = (value: string): string => value.trim();
const copy = (value: InstagramCommentJourney): InstagramCommentJourney =>
  structuredClone(value);
const stepNames: CommentDeliveryKind[] = [
  "public_reply", "private_reply", "resource_link", "followup",
];

/** Do not use message-events.json for durable idempotency: it keeps only 1,000 entries. */
export class InstagramCommentJourneyStore {
  private journeys: Record<string, InstagramCommentJourney>;

  constructor(private readonly file: string) {
    this.journeys = this.load();
  }

  private load(): Record<string, InstagramCommentJourney> {
    if (!fs.existsSync(this.file)) return {};
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("invalid_journey_store");
      const root = parsed as { version?: unknown; journeys?: unknown };
      if (root.version !== 1 || !root.journeys ||
          typeof root.journeys !== "object" || Array.isArray(root.journeys))
        throw new Error("invalid_journey_store_version");
      const records = root.journeys as Record<string, InstagramCommentJourney>;
      for (const [key, journey] of Object.entries(records)) {
        if (!journey || typeof journey !== "object" || journey.key !== key ||
            !journey.commentId || !journey.instagramAccountId ||
            !validTime(journey.commentCreatedAtMs) ||
            !journey.delivery || stepNames.some(name =>
              !journey.delivery[name] ||
              !STAGES.includes(journey.delivery[name].status)))
          throw new Error("invalid_journey_record");
      }
      return records;
    } catch (error) {
      // Unlike preview logs, losing a sent/delivered history could cause
      // repeat messages. Refuse to reconstruct an empty store on corruption.
      throw new Error("instagram_comment_journey_restore_failed", { cause: error });
    }
  }

  private persist(next: Record<string, InstagramCommentJourney>): void {
    writePrivateJsonAtomic(this.file, { version: 1, journeys: next });
    this.journeys = next; // publish in-memory only AFTER successful disk replace
  }

  get(accountId: string, commentId: string): InstagramCommentJourney | undefined {
    const found = this.journeys[JSON.stringify([clean(accountId), clean(commentId)])];
    return found && copy(found);
  }

  register(input: NewCommentJourney, nowMs: number): JourneyRegistration {
    const accountId = clean(input.instagramAccountId);
    const commentId = clean(input.commentId);
    const key = JSON.stringify([accountId, commentId]);
    const required = [
      accountId, commentId, clean(input.commenterId), clean(input.mediaId),
      clean(input.campaignId), clean(input.keyword),
    ];
    if (required.some(value => !value) || !validTime(nowMs) ||
        !validTime(input.commentCreatedAtMs) || input.commentCreatedAtMs > nowMs)
      throw new Error("invalid_comment_journey_input");

    const existing = this.journeys[key];
    if (existing) {
      const consistent = existing.commenterId === clean(input.commenterId) &&
        existing.mediaId === clean(input.mediaId) &&
        existing.campaignId === clean(input.campaignId);
      return { result: consistent ? "duplicate" : "conflict", journey: copy(existing) };
    }

    const initial = (prepared: boolean): CommentDeliveryReceipt => ({
      status: prepared ? "prepared" : "not_prepared", updatedAtMs: nowMs,
    });
    const journey: InstagramCommentJourney = {
      key, instagramAccountId: accountId, commentId,
      commenterId: clean(input.commenterId), mediaId: clean(input.mediaId),
      campaignId: clean(input.campaignId), keyword: clean(input.keyword),
      commentCreatedAtMs: input.commentCreatedAtMs, createdAtMs: nowMs,
      delivery: {
        public_reply: initial(input.publicReplyPrepared),
        private_reply: initial(input.privateReplyPrepared),
        resource_link: initial(false),
        followup: initial(false),
      },
    };
    this.persist({ ...this.journeys, [key]: journey });
    return { result: "created", journey: copy(journey) };
  }

  /** Caller must prove the signed inbound event and its campaign-specific positive intent. */
  recordVerifiedConfirmation(input: {
    accountId: string; commentId: string; eventId: string; atMs: number;
    verifiedInbound: boolean; positiveForCampaign: boolean;
  }): "recorded" | "duplicate" | "blocked" {
    const item = this.get(input.accountId, input.commentId);
    if (!item || !input.verifiedInbound || !input.positiveForCampaign ||
        !clean(input.eventId) || !validTime(input.atMs) ||
        item.delivery.private_reply.status !== "sent" ||
        !item.delivery.private_reply.updatedAtMs ||
        input.atMs < item.delivery.private_reply.updatedAtMs)
      return "blocked";
    if (item.confirmedInboundEventId)
      return item.confirmedInboundEventId === clean(input.eventId) ? "duplicate" : "blocked";
    item.confirmedInboundEventId = clean(input.eventId);
    item.confirmedInboundAtMs = input.atMs;
    this.persist({ ...this.journeys, [item.key]: item });
    return "recorded";
  }

  /**
   * Transitions persist before a network operation is attempted.
   * 'dispatching' is a crash/retry fence, not a successful send. A crash at
   * this stage MUST be reconciled manually; never auto-retry it.
   */
  advance(input: {
    accountId: string; commentId: string; kind: CommentDeliveryKind;
    nextStatus: Exclude<CommentDeliveryStatus, "not_prepared">;
    atMs: number; metaMessageId?: string; errorCode?: string;
  }): InstagramCommentJourney {
    const item = this.get(input.accountId, input.commentId);
    if (!item || !validTime(input.atMs) || !stepNames.includes(input.kind))
      throw new Error("journey_transition_invalid");
    const prior = item.delivery[input.kind].status;
    const next = input.nextStatus;
    const allowed =
      (prior === "not_prepared" && next === "prepared") ||
      (prior === "prepared" && ["dispatching", "blocked", "dry_run"].includes(next)) ||
      (prior === "dispatching" && ["sent", "failed", "uncertain"].includes(next));
    if (!allowed || (next === "sent" && !clean(input.metaMessageId || "")) ||
        (next === "failed" && !clean(input.errorCode || "")))
      throw new Error("journey_transition_not_allowed");

    if (input.kind === "resource_link" && ["prepared", "dispatching", "sent"].includes(next) &&
        (!item.confirmedInboundEventId || item.delivery.private_reply.status !== "sent"))
      throw new Error("journey_link_requires_user_confirmation");
    if (input.kind === "followup" && ["prepared", "dispatching", "sent"].includes(next) &&
        item.delivery.resource_link.status !== "sent")
      throw new Error("journey_followup_requires_sent_resource");

    item.delivery[input.kind] = {
      status: next, updatedAtMs: input.atMs,
      ...(next === "sent" ? { metaMessageId: clean(input.metaMessageId || "") } : {}),
      ...(next === "failed" || next === "blocked" || next === "uncertain"
        ? { errorCode: clean(input.errorCode || "") || next } : {}),
    };
    this.persist({ ...this.journeys, [item.key]: item });
    return item;
  }
}

export const instagramCommentJourneys = new InstagramCommentJourneyStore(
  path.join(env.DATA_DIR, "instagram-comment-journeys.json"),
);
