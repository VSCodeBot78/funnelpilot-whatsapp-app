import assert from "node:assert/strict";
import test from "node:test";
import {
  canPrepareFirstCommentPrivateReply,
  canPrepareOrganicCampaignFollowup,
  evaluateCampaignResourceConfirmation,
  type PeteCommentCampaignJourney,
} from "../services/pete-campaign-engagement-policy.service.js";

// No Meta, OpenAI or HTTP call. Pure policy tests before any future send adapter.
const t0 = Date.parse("2026-10-13T08:00:00Z");
const H = 60 * 60 * 1000;
const comment: PeteCommentCampaignJourney = {
  campaignId: "check-2026", commentId: "1784140000001",
  commenterId: "1784140000123", commentCreatedAtMs: t0,
  botEnabled: true,
};
const reply = { ...comment, firstPrivateReplySentAtMs: t0 + H,
  firstPrivateReplyMessageId: "meta-private-123" };
const guide = { ...reply, lastInboundUserDmAtMs: t0 + 2 * H,
  linkSentAtMs: t0 + 2 * H + 60 * 1000 };

test("phase64: first private comment reply, confirmation and followups fail closed", async t => {
  await t.test("private reply only once and only within 7-day window", () => {
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: comment, nowMs: t0 + H, enabled: true,
    }).allowed, true);
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: comment, nowMs: t0 + H, enabled: false,
    }).reason, "not_enabled");
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: reply, nowMs: t0 + 2 * H, enabled: true,
    }).reason, "already_sent");
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: comment, nowMs: t0 + 7 * 24 * H, enabled: true,
    }).reason, "comment_too_old");
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: { ...comment, humanOwned: true }, nowMs: t0 + H, enabled: true,
    }).reason, "human_owned");
    assert.equal(canPrepareFirstCommentPrivateReply({
      journey: { ...comment, stopped: true }, nowMs: t0 + H, enabled: true,
    }).reason, "stopped");
  });

  await t.test("comment/first outbound private reply are NOT inbound-DM consent", () => {
    const noPrivateReply = evaluateCampaignResourceConfirmation({
      journey: comment, enabled: true, userMessage: "Ja, bitte",
      userMessageAtMs: t0 + 3 * H, verifiedInboundUserEvent: true,
    });
    assert.equal(noPrivateReply.reason, "missing_confirmed_private_reply");
    const noInbound = evaluateCampaignResourceConfirmation({
      journey: reply, enabled: true, userMessage: "Ja, bitte",
      userMessageAtMs: t0 + 3 * H, verifiedInboundUserEvent: false,
    });
    assert.equal(noInbound.reason, "no_user_dm");
    for (const input of ["Ja, bitte", "Schick mir den Check", "Klar", "gerne"]) {
      const accepted = evaluateCampaignResourceConfirmation({
        journey: reply, enabled: true, userMessage: input,
        userMessageAtMs: t0 + 3 * H, verifiedInboundUserEvent: true,
      });
      assert.equal(accepted.allowed, true, input);
    }
    for (const input of ["Nein danke", "Nur zum Schauen", "Ich möchte keinen Link"]) {
      assert.equal(evaluateCampaignResourceConfirmation({
        journey: reply, enabled: true, userMessage: input,
        userMessageAtMs: t0 + 3 * H, verifiedInboundUserEvent: true,
      }).allowed, false, input);
    }
    assert.equal(evaluateCampaignResourceConfirmation({
      journey: guide, enabled: true, userMessage: "Ja",
      userMessageAtMs: t0 + 3 * H, verifiedInboundUserEvent: true,
    }).reason, "already_sent");
  });

  await t.test("followups need confirmed link, real inbound DM and current 24h window", () => {
    assert.equal(canPrepareOrganicCampaignFollowup({
      journey: comment, nowMs: t0 + 3 * H, automationEnabled: true,
      configuredDelayHours: 1,
    }).allowed, false);
    assert.equal(canPrepareOrganicCampaignFollowup({
      journey: guide, nowMs: t0 + 3 * H, automationEnabled: true,
      configuredDelayHours: 20,
    }).reason, "not_due");
    const within = canPrepareOrganicCampaignFollowup({
      journey: guide, nowMs: t0 + 22 * H + 2 * 60 * 1000,
      automationEnabled: true, configuredDelayHours: 20,
    });
    assert.equal(within.allowed, true);
    assert.equal(canPrepareOrganicCampaignFollowup({
      journey: guide, nowMs: t0 + 26 * H, automationEnabled: true,
      configuredDelayHours: 24,
    }).reason, "outside_24h_window");
    assert.equal(canPrepareOrganicCampaignFollowup({
      journey: { ...guide, lastFollowupSentAtMs: t0 + 3 * H },
      nowMs: t0 + 22 * H + 2 * 60 * 1000,
      automationEnabled: true, configuredDelayHours: 20,
    }).reason, "already_followed_up");
    for (const mode of ["stopped", "aiPaused", "optedOut", "humanOwned"] as const) {
      assert.equal(canPrepareOrganicCampaignFollowup({
        journey: { ...guide, [mode]: true },
        nowMs: t0 + 22 * H + 2 * 60 * 1000,
        automationEnabled: true, configuredDelayHours: 20,
      }).allowed, false, mode);
    }
  });
});
