import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-ig-comment-preview-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.META_APP_SECRET = "offline-signature-test";
process.env.INSTAGRAM_APP_SECRET = "offline-signature-test";
process.env.INSTAGRAM_ACCOUNT_ID = "test-ig-account";
process.env.INSTAGRAM_ENGINE_ENABLED = "true";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "test-commenter";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { saveCampaign, normalizeCampaignAutomationDraft } =
  await import("../data/campaigns.store.js");
const {
  parseInstagramCommentEvents,
  selectInstagramCommentCampaign,
  maySendOrganicInstagramFollowUp,
} = await import("../services/pete-campaign-comment-preview.service.js");
const { getMessageEventByMessageId } = await import("../data/message-events.store.js");
const { instagramCommentJourneys } = await import("../data/instagram-comment-journey.store.js");
const { default: app } = await import("../app.js");

const payload = (commentId: string, text: string, mediaId = "test-media") => ({
  object: "instagram",
  entry: [{
    id: "test-ig-account",
    time: Math.floor(Date.now() / 1000),
    changes: [{
      field: "comments",
      value: {
        id: commentId, text,
        from: { id: "test-commenter", username: "sample" },
        media: { id: mediaId, media_product_type: "REELS" },
      },
    }],
  }],
});
const draft = (patch: Record<string, unknown> = {}) =>
  normalizeCampaignAutomationDraft({
    enabled: true,
    triggers: { comments: true, directMessages: true },
    commentScope: "all",
    keywords: "CHECK, KETO",
    publicReplies: ["Nachricht ist unterwegs.", "Schau in deine DMs."],
    ...patch,
  });

test("Phase 63: Instagram comment mini automation, safely preview-only", async t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await t.test("parses comments in changes without interpreting them as DMs", () => {
    const events = parseInstagramCommentEvents(payload("comment-1", "CHECK"));
    assert.equal(events.length, 1);
    assert.equal(events[0].commentId, "comment-1");
    assert.equal(events[0].commenterId, "test-commenter");
    assert.equal(events[0].mediaId, "test-media");
    assert.deepEqual(parseInstagramCommentEvents({ ...payload("comment-2", "CHECK"), object: "page" }), []);
    assert.deepEqual(parseInstagramCommentEvents({ object: "instagram", entry: [{ id: "test-ig-account", messaging: [{
      sender: { id: "user" }, message: { mid: "dm1", text: "CHECK" },
    }] }] }), []);
  });

  await t.test("case-insensitive keywords and stable one-campaign selection", () => {
    const campaign = { id: "phase63-check", automationDraft: draft() };
    const comment = parseInstagramCommentEvents(payload("comment-3", "Hi! check bitte."))[0];
    const choice = selectInstagramCommentCampaign(comment, [campaign]);
    assert.equal(choice.ok, true);
    if (!choice.ok) return;
    assert.equal(choice.plan.keyword, "CHECK");
    assert.equal(choice.plan.previewOnly, true);
    assert.equal(choice.plan.campaignId, "phase63-check");
    assert.equal(choice.plan.commentId, "comment-3");
    assert.equal(choice.plan.publicReply,
      (selectInstagramCommentCampaign(comment, [campaign]) as typeof choice).plan.publicReply);
    assert.equal(selectInstagramCommentCampaign(
      { ...comment, text: "Schicke die Checkliste" }, [campaign]).ok, false);
    assert.equal(selectInstagramCommentCampaign(comment, [{
      id: "off", automationDraft: draft({ enabled: false }),
    }]).ok, false);
  });

  await t.test("specific post wins, ambiguous campaigns fail closed, next-post needs binding", () => {
    const event = parseInstagramCommentEvents(payload("comment-4", "KETO", "media-special"))[0];
    const any = { id: "any", automationDraft: draft() };
    const specific = { id: "specific", automationDraft: draft({
      commentScope: "specific", specificPostIds: "media-special",
    }) };
    const choice = selectInstagramCommentCampaign(event, [any, specific]);
    assert.equal(choice.ok, true);
    if (choice.ok) assert.equal(choice.plan.campaignId, "specific");
    assert.deepEqual(selectInstagramCommentCampaign(event, [any, { ...any, id: "also-any" }]),
      { ok: false, reason: "ambiguous_campaigns" });
    assert.equal(selectInstagramCommentCampaign(event, [{
      id: "next", automationDraft: draft({ commentScope: "next" }),
    }]).ok, false);
  });

  await t.test("comment alone cannot unlock 24h follow-up", () => {
    const now = "2026-10-13T20:00:00.000Z";
    const defaults = {
      now, automationEnabled: true, isHumanOwned: false,
      aiPaused: false, stopped: false, optedOut: false, botEnabled: true,
    };
    assert.equal(maySendOrganicInstagramFollowUp(defaults), false);
    assert.equal(maySendOrganicInstagramFollowUp({
      ...defaults, lastInboundUserDmAt: "2026-10-12T20:00:00.000Z",
    }), false);
    assert.equal(maySendOrganicInstagramFollowUp({
      ...defaults, lastInboundUserDmAt: "2026-10-13T19:00:00.000Z",
    }), true);
    assert.equal(maySendOrganicInstagramFollowUp({
      ...defaults, lastInboundUserDmAt: "2026-10-13T19:00:00.000Z", optedOut: true,
    }), false);
    assert.equal(maySendOrganicInstagramFollowUp({
      ...defaults, lastInboundUserDmAt: "2026-10-13T19:00:00.000Z", isHumanOwned: true,
    }), false);
  });

  await t.test("signed comment webhook previews and deduplicates without sending", async () => {
    saveCampaign({ id: "phase63-route-check", name: "CHECK test only", automationDraft: draft() });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = "http://127.0.0.1:" + address.port;
    const message = payload("route-comment-a", "CHECK");
    const raw = JSON.stringify(message);
    const signature = "sha256=" + crypto.createHmac("sha256", "offline-signature-test")
      .update(Buffer.from(raw, "utf8")).digest("hex");
    const post = async () => fetch(base + "/webhooks/meta/instagram", {
      method: "POST", headers: {
        "Content-Type": "application/json", "X-Hub-Signature-256": signature,
      }, body: raw,
    });
    try {
      const one = await post();
      assert.equal(one.status, 200);
      const first = await one.json();
      assert.equal(first.commentActionsDryRun, true);
      assert.equal(first.commentsReceived, 1);
      assert.equal(first.commentPreviews, 1);
      assert.equal(first.sent, false);
      const recorded = getMessageEventByMessageId("meta_instagram", "comment:route-comment-a");
      assert.ok(recorded);
      assert.equal(recorded.raw?.messageSent, false);
      const persistent = instagramCommentJourneys.get("test-ig-account", "route-comment-a");
      assert.equal(persistent?.campaignId, "phase63-route-check");
      assert.equal(persistent?.delivery.private_reply.status, "prepared");
      assert.equal(persistent?.delivery.resource_link.status, "not_prepared");
      const two = await post();
      assert.equal(two.status, 200);
      const duplicate = await two.json();
      assert.equal(duplicate.commentDuplicates, 1);
      assert.equal(duplicate.commentPreviews, 0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close(err => err ? reject(err) : resolve()));
    }
  });
});
