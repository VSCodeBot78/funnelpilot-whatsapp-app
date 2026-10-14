import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-comment-journey-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { InstagramCommentJourneyStore } =
  await import("../data/instagram-comment-journey.store.js");

const file = path.join(dir, "phase65-journeys.json");
const now = Date.parse("2026-10-14T08:00:00Z");
const comment = {
  instagramAccountId: "ig-business", commentId: "comment-001",
  commenterId: "visitor", mediaId: "reel-001",
  campaignId: "check", keyword: "CHECK",
  commentCreatedAtMs: now - 1000,
  publicReplyPrepared: true, privateReplyPrepared: true,
};

test("Phase 65: persistent comment journey and idempotent delivery fence, no network", t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new InstagramCommentJourneyStore(file);

  const first = store.register(comment, now);
  assert.equal(first.result, "created");
  assert.equal(first.journey.delivery.public_reply.status, "prepared");
  assert.equal(first.journey.delivery.private_reply.status, "prepared");
  assert.equal(first.journey.delivery.resource_link.status, "not_prepared");
  assert.equal(store.register(comment, now + 1).result, "duplicate");
  assert.equal(store.register({ ...comment, campaignId: "keto" }, now + 1).result, "conflict");
  assert.equal(store.register({ ...comment, commenterId: "attacker" }, now + 1).result, "conflict");

  const afterRestart = new InstagramCommentJourneyStore(file);
  assert.equal(afterRestart.get("ig-business", "comment-001")?.campaignId, "check");
  assert.equal(afterRestart.register(comment, now + 2).result, "duplicate");

  const advance = (kind: "private_reply" | "resource_link" | "followup",
    nextStatus: "prepared" | "dispatching" | "sent" | "uncertain",
    atMs: number, metaMessageId?: string) => afterRestart.advance({
    accountId: "ig-business", commentId: "comment-001",
    kind, nextStatus, atMs, metaMessageId,
  });

  assert.throws(() => advance("resource_link", "prepared", now + 10),
    /journey_link_requires_user_confirmation/);
  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-1", atMs: now + 10,
    verifiedInbound: true, positiveForCampaign: true,
  }), "blocked");

  advance("private_reply", "dispatching", now + 20);
  assert.throws(() => advance("private_reply", "dispatching", now + 21),
    /journey_transition_not_allowed/);
  assert.throws(() => advance("private_reply", "sent", now + 22),
    /journey_transition_not_allowed/);
  advance("private_reply", "sent", now + 22, "meta-confirmed-1");
  assert.throws(() => advance("private_reply", "sent", now + 23, "meta-confirmed-2"),
    /journey_transition_not_allowed/);

  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-1", atMs: now + 25,
    verifiedInbound: false, positiveForCampaign: true,
  }), "blocked");
  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-1", atMs: now + 25,
    verifiedInbound: true, positiveForCampaign: false,
  }), "blocked");
  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-1", atMs: now + 25,
    verifiedInbound: true, positiveForCampaign: true,
  }), "recorded");
  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-1", atMs: now + 25,
    verifiedInbound: true, positiveForCampaign: true,
  }), "duplicate");
  assert.equal(afterRestart.recordVerifiedConfirmation({
    accountId: "ig-business", commentId: "comment-001",
    eventId: "dm-2", atMs: now + 30,
    verifiedInbound: true, positiveForCampaign: true,
  }), "blocked");

  assert.throws(() => advance("followup", "prepared", now + 30),
    /journey_followup_requires_sent_resource/);
  advance("resource_link", "prepared", now + 30);
  advance("resource_link", "dispatching", now + 31);
  advance("resource_link", "sent", now + 32, "meta-link-1");
  advance("followup", "prepared", now + 40);
  advance("followup", "dispatching", now + 41);
  advance("followup", "sent", now + 42, "meta-followup-1");

  const last = new InstagramCommentJourneyStore(file);
  assert.equal(last.get("ig-business", "comment-001")?.delivery.followup.metaMessageId,
    "meta-followup-1");

  const unsure = last.register({ ...comment, commentId: "comment-002" }, now + 50);
  assert.equal(unsure.result, "created");
  last.advance({ accountId: "ig-business", commentId: "comment-002",
    kind: "private_reply", nextStatus: "dispatching", atMs: now + 51 });
  last.advance({ accountId: "ig-business", commentId: "comment-002",
    kind: "private_reply", nextStatus: "uncertain", atMs: now + 52 });
  assert.throws(() => last.advance({ accountId: "ig-business", commentId: "comment-002",
    kind: "private_reply", nextStatus: "dispatching", atMs: now + 53 }),
  /journey_transition_not_allowed/);

  fs.writeFileSync(file, "{broken json", "utf8");
  assert.throws(() => new InstagramCommentJourneyStore(file),
    /instagram_comment_journey_restore_failed/);
});
