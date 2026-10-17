import assert from "node:assert/strict";
import test from "node:test";

// Only pure functions and synthetic inputs. No provider API, HTTP send or model.
const { classifyCampaignWebhookExample } =
  await import("../services/pete-campaign-event-classifier.service.js");
const { evaluateCampaignEntryPreview } =
  await import("../services/pete-campaign-entry-preview.service.js");
const { normalizePeteCampaignConfig } =
  await import("../data/campaigns.store.js");

const story = {
  object: "instagram",
  entry: [{ messaging: [{
    sender: { id: "test-parent" },
    recipient: { id: "test-business" },
    message: {
      mid: "story-1", text: "KETO",
      reply_to: { story: { id: "17893310459840806" } },
    },
  }] }],
};

const reel = (mediaId: string, kind = "REELS") => ({
  object: "instagram",
  entry: [{ changes: [{
    field: "comments",
    value: {
      id: "comment-1", text: "CHECK",
      from: { id: "test-commenter" },
      media: { id: mediaId, media_product_type: kind },
    },
  }] }],
});

const wa = (referral: Record<string, unknown> | null) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{
    field: "messages", value: {
      messages: [{
        id: "wamid.test", from: "test-contact", type: "text",
        text: { body: "CHECK" },
        ...(referral ? { referral } : {}),
      }],
    },
  }] }],
});

const rule = { id: "reels-specific", peteCampaign: {
  sources: ["instagram_reel_comment"], keywords: ["CHECK"],
  reelTarget: "specific", reelMediaIds: ["17851537767246649"],
  openingText: "Danke für den Kommentar.", followUpEnabled: false,
} };

test("Phase 4B: Instagram/WhatsApp webhook origins are classified only in preview mode", async t => {
  await t.test("known Reel comment includes verified media ID", () => {
    const event = classifyCampaignWebhookExample("instagram", reel("17851537767246649"));
    assert.equal(event.status, "recognized");
    assert.equal(event.source, "instagram_reel_comment");
    assert.equal(event.mediaId, "17851537767246649");
    assert.equal(event.sendAllowed, false);
    const preview = evaluateCampaignEntryPreview([rule], {
      source: event.source, messageText: event.messageText, mediaId: event.mediaId,
    });
    assert.equal(preview.matchedCampaignId, "reels-specific");
    assert.equal(preview.sendAllowed, false);
  });

  await t.test("only a selected Reel media ID is eligible", () => {
    const unknown = classifyCampaignWebhookExample("instagram", reel("17851537767246650"));
    assert.equal(unknown.status, "recognized");
    const preview = evaluateCampaignEntryPreview([rule], {
      source: unknown.source, messageText: unknown.messageText, mediaId: unknown.mediaId,
    });
    assert.equal(preview.status, "no_match");
    const withoutMedia = evaluateCampaignEntryPreview([rule], {
      source: "instagram_reel_comment", messageText: "CHECK",
    });
    assert.equal(withoutMedia.sendAllowed, false);
    assert.equal(withoutMedia.matchedCampaignId, null);
  });

  await t.test("all Reels permits verified IDs, but never enables sending", () => {
    const all = { id: "all-reels", peteCampaign: {
      sources: ["instagram_reel_comment"], keywords: ["CHECK"],
      reelTarget: "all", reelMediaIds: [],
      openingText: "", followUpEnabled: true,
    } };
    const matched = evaluateCampaignEntryPreview([all], {
      source: "instagram_reel_comment", messageText: "CHECK", mediaId: "17851537767246651",
    });
    assert.equal(matched.matchedCampaignId, "all-reels");
    assert.equal(matched.followUpDraftConfigured, true);
    assert.equal(matched.sendAllowed, false);
  });

  await t.test("non-Reel and missing author metadata fail closed", () => {
    for (const payload of [
      reel("17851537767246649", "FEED"),
      { object: "instagram", entry: [{ changes: [{ field: "comments",
        value: { id: "comment-1", media: { id: "17851537767246649",
          media_product_type: "REELS" }, text: "CHECK" } }] }] },
    ]) {
      const event = classifyCampaignWebhookExample("instagram", payload);
      assert.equal(event.status, "manual_review");
      assert.equal(event.sendAllowed, false);
      assert.equal(event.source, null);
    }
  });

  await t.test("Story reply is not treated like an ordinary DM", () => {
    const event = classifyCampaignWebhookExample("instagram", story);
    assert.equal(event.status, "recognized");
    assert.equal(event.source, "instagram_story_reply");
    assert.equal(event.mediaId, "17893310459840806");
    assert.equal(event.sendAllowed, false);
  });

  await t.test("unverified reply context and media-only shares need a human", () => {
    const cases = [
      { object: "instagram", entry: [{ messaging: [{
        sender: { id: "x" }, message: { mid: "x", text: "CHECK", reply_to: {} },
      }] }] },
      { object: "instagram", entry: [{ messaging: [{
        sender: { id: "x" }, message: { mid: "x", attachments: [{ type: "image" }] },
      }] }] },
      { object: "instagram", entry: [{ messaging: [{
        sender: { id: "x" }, message: { mid: "x", text: "CHECK", is_echo: true },
      }] }] },
    ];
    for (const payload of cases) {
      const event = classifyCampaignWebhookExample("instagram", payload);
      assert.equal(event.status, "manual_review");
      assert.equal(event.sendAllowed, false);
    }
  });

  await t.test("plain Instagram text DM is recognized without guessing a Reel", () => {
    const event = classifyCampaignWebhookExample("instagram", {
      object: "instagram", entry: [{ messaging: [{
        sender: { id: "parent" }, message: { mid: "dm-1", text: "Hallo" },
      }] }],
    });
    assert.equal(event.source, "instagram_dm");
    assert.equal(event.sendAllowed, false);
  });

  await t.test("WhatsApp CTWA requires explicit referral evidence", () => {
    assert.equal(classifyCampaignWebhookExample("whatsapp", wa({ ctwa_clid: "abc" })).source, "whatsapp_ctwa");
    assert.equal(classifyCampaignWebhookExample("whatsapp", wa({ source_type: "ad" })).source, "whatsapp_ctwa");
    assert.equal(classifyCampaignWebhookExample("whatsapp", wa(null)).source, "whatsapp_dm");
    const ambiguous = classifyCampaignWebhookExample("whatsapp", wa({ source_type: "post" }));
    assert.equal(ambiguous.status, "manual_review");
    assert.equal(ambiguous.sendAllowed, false);
  });

  await t.test("combined messages and comments are not picked opportunistically", () => {
    const payload = reel("17851537767246649");
    payload.entry[0].changes.push({ field: "messages", value: {
      sender: { id: "user" }, message: { mid: "other", text: "CHECK" },
    } } as never);
    const event = classifyCampaignWebhookExample("instagram", payload);
    assert.equal(event.status, "manual_review");
  });

  await t.test("normalization enforces exact numeric Reel IDs", () => {
    const config = normalizePeteCampaignConfig({
      sources: ["instagram_reel_comment"], keywords: ["check"],
      reelTarget: "specific",
      reelMediaIds: ["17851537767246649", "17851537767246649", "not-a-media-id", " "],
      followUpEnabled: "true",
    });
    assert.equal(config.reelTarget, "specific");
    assert.deepEqual(config.reelMediaIds, ["17851537767246649"]);
    assert.equal(config.followUpEnabled, false);
  });
});
