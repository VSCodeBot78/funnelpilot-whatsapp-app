import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase4-preview-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tmp;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { evaluateCampaignEntryPreview } =
  await import("../services/pete-campaign-entry-preview.service.js");
const { saveCampaign, getAllCampaigns } =
  await import("../data/campaigns.store.js");

const campaigns = [
  { id: "generic", peteCampaign: {
    sources: ["instagram_dm", "whatsapp_dm", "instagram_new_follower"],
    keywords: [], openingText: "Hallo, wie kann ich helfen?", followUpEnabled: false,
  } },
  { id: "check", peteCampaign: {
    sources: ["instagram_dm", "instagram_reel_comment", "instagram_new_follower"],
    keywords: ["CHECK"], openingText: "Hier geht es zum Elterncheck.", followUpEnabled: true,
  } },
  { id: "keto", peteCampaign: {
    sources: ["instagram_story_reply"], keywords: ["KETO"],
    openingText: "Hier findest du den Keto Guide.", followUpEnabled: false,
  } },
];

test("Phase 4: read-only campaign matching stays fail-closed", async t => {
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  await t.test("explicit keyword wins over a general Instagram-DM campaign", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_dm", messageText: " #check! ",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.matchedCampaignId, "check");
    assert.equal(result.matchedKeyword, "CHECK");
    assert.equal(result.sendAllowed, false);
    assert.equal(result.mode, "preview_only");
    assert.equal(result.followUpDraftConfigured, true);
  });

  await t.test("short keyword must be exact, not part of a sales conversation", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_reel_comment", messageText: "CHECK das mal",
    });
    assert.equal(result.status, "no_match");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("unconfigured incoming source does not select a campaign", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "whatsapp_ctwa", messageText: "CHECK",
    });
    assert.equal(result.status, "no_match");
  });

  await t.test("generic WhatsApp-DM source can be previewed without sending", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "whatsapp_dm", messageText: "Hallo, ich habe eine Frage",
    });
    assert.equal(result.matchedCampaignId, "generic");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("two equal campaigns lead to ambiguity, not two replies", () => {
    const result = evaluateCampaignEntryPreview([...campaigns, {
      id: "check-duplicate", peteCampaign: {
        sources: ["instagram_dm"], keywords: ["CHECK"], openingText: "Andere",
        followUpEnabled: false,
      },
    }], { source: "instagram_dm", messageText: "CHECK" });
    assert.equal(result.status, "ambiguous");
    assert.equal(result.matchedCampaignId, null);
    assert.deepEqual(result.candidateIds, ["check", "check-duplicate"]);
    assert.equal(result.sendAllowed, false);
  });

  await t.test("new follower can only be greeted manually", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_new_follower", messageText: "CHECK",
    });
    assert.equal(result.status, "manual_only");
    assert.equal(result.matchedCampaignId, null);
    assert.equal(result.sendAllowed, false);
  });

  await t.test("invalid input is rejected and never matched", () => {
    for (const input of [
      { source: "instagram_fake", messageText: "CHECK" },
      { source: "instagram_dm", messageText: { text: "CHECK" } },
      { source: "instagram_dm", messageText: "x".repeat(2001) },
    ]) {
      const result = evaluateCampaignEntryPreview(campaigns, input);
      assert.equal(result.sendAllowed, false);
      assert.equal(result.matchedCampaignId, null);
      assert.ok(result.status.startsWith("invalid"));
    }
  });

  await t.test("saved draft settings are available without enabling runtime sends", () => {
    saveCampaign({
      id: "phase4-preview-campaign",
      peteCampaign: {
        sources: ["instagram_story_reply"],
        keywords: ["KETO"],
        openingText: "Keto Guide.",
        followUpEnabled: false,
      },
    });
    const result = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: "instagram_story_reply", messageText: "KETO",
    });
    assert.equal(result.matchedCampaignId, "phase4-preview-campaign");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("Pete receives a versioned read-only snapshot of exactly the saved campaign", () => {
    saveCampaign({
      id: "coach-campaign-check",
      name: "Coach-spezifischer Check",
      peteCampaign: {
        sources: ["instagram_reel_comment"],
        keywords: ["CHECK"],
        openingText: "Willkommen beim gespeicherten Check.",
        followUpEnabled: true,
        reelTarget: "specific",
        reelMediaIds: ["17851537767246649"],
      },
    });
    const result = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: "instagram_reel_comment", messageText: "CHECK",
      mediaId: "17851537767246649",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.sendAllowed, false);
    assert.deepEqual(result.draftContext, {
      version: 1, mode: "preview_only", sendAllowed: false,
      campaignId: "coach-campaign-check",
      campaignName: "Coach-spezifischer Check",
      source: "instagram_reel_comment",
      matchedKeyword: "CHECK",
      openingText: "Willkommen beim gespeicherten Check.",
      followUpDraftConfigured: true,
      reelTarget: "specific",
      reelMediaIds: ["17851537767246649"],
      flowDraft: {
        enabled: false,
        autoReplyEnabled: false,
        text: null,
        linkEnabled: false,
        linkLabel: "",
        linkUrl: null,
        peteHandoffEnabled: false,
        commentReplyEnabled: false, commentReplyVariants: [],
        openingDmButtonEnabled: false, openingDmButtonLabel: "", linkMessageText: "",
        sendAllowed: false,
      },
    });
    // The context shows stored configuration; it cannot send messages.
    assert.equal(result.draftContext?.sendAllowed, false);
    assert.equal(result.followUpDraftConfigured, true);
  });

  await t.test("ManyChat-style desktop flow steps survive backend persistence but cannot send", () => {
    const id = "desktop-flow-checked";
    saveCampaign({
      id, name: "Elterncheck Flow-Entwurf",
      peteCampaign: {
        sources: ["instagram_dm", "instagram_reel_comment"],
        keywords: ["CHECK"], openingText: "Hier ist dein Elterncheck.",
        followUpEnabled: false, reelTarget: "specific",
        reelMediaIds: ["17851537767246651"],
        flowDraftEnabled: true, autoReplyEnabled: true,
        linkEnabled: true, linkLabel: "Elterncheck öffnen",
        linkUrl: "https://check.jochen-kammerer.de",
        peteHandoffEnabled: true,
      },
    });
    const persisted = getAllCampaigns().find(c => c.id === id);
    assert.ok(persisted);
    const flow = persisted.peteCampaign as Record<string, unknown>;
    assert.equal(flow.flowDraftEnabled, true);
    assert.equal(flow.autoReplyEnabled, true);
    assert.equal(flow.linkEnabled, true);
    assert.equal(flow.linkUrl, "https://check.jochen-kammerer.de/");
    assert.equal(flow.peteHandoffEnabled, true);
    const preview = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: "instagram_reel_comment", messageText: "CHECK",
      mediaId: "17851537767246651",
    });
    assert.equal(preview.status, "matched");
    assert.equal(preview.sendAllowed, false);
    assert.equal(preview.draftContext?.flowDraft?.sendAllowed, false);
    assert.deepEqual(preview.draftContext?.flowDraft, {
      enabled: true,
      autoReplyEnabled: true,
      text: "Hier ist dein Elterncheck.",
      linkEnabled: true,
      linkLabel: "Elterncheck öffnen",
      linkUrl: "https://check.jochen-kammerer.de/",
      peteHandoffEnabled: true,
      commentReplyEnabled: false, commentReplyVariants: [],
      openingDmButtonEnabled: false, openingDmButtonLabel: "", linkMessageText: "",
      sendAllowed: false,
    });
  });

  await t.test("Public comment, DM-button and link-message drafts persist but never execute", () => {
    saveCampaign({
      id: "manychat-style-draft",
      name: "No Bullshit Demoflow",
      peteCampaign: {
        sources: ["instagram_reel_comment"],
        keywords: ["BULLSHIT"],
        openingText: "Hey, du hast BULLSHIT geschrieben.",
        followUpEnabled: false,
        reelTarget: "specific",
        reelMediaIds: ["17851537767246657"],
        flowDraftEnabled: true,
        commentReplyEnabled: true,
        commentReplyVariants: ["Hey, schau in deine DM!", "Nachricht vorbereitet.", "Dritter Text", "nicht mehr"],
        autoReplyEnabled: true,
        openingDmButtonEnabled: true,
        openingDmButtonLabel: "Ja, zeig mir das Bundle",
        linkEnabled: true,
        linkMessageText: "Perfekt, hier findest du das Bundle.",
        linkLabel: "No Bullshit Bundle",
        linkUrl: "https://example.org/bundle",
        peteHandoffEnabled: false,
      },
    });
    const saved = getAllCampaigns().find(c => c.id === "manychat-style-draft");
    assert.ok(saved);
    const config = saved.peteCampaign;
    assert.equal(config?.commentReplyEnabled, true);
    assert.deepEqual(config?.commentReplyVariants, [
      "Hey, schau in deine DM!", "Nachricht vorbereitet.", "Dritter Text",
    ]);
    const preview = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: "instagram_reel_comment", messageText: "BULLSHIT",
      mediaId: "17851537767246657",
    });
    assert.equal(preview.status, "matched");
    assert.equal(preview.sendAllowed, false);
    assert.equal(preview.draftContext?.flowDraft.sendAllowed, false);
    assert.equal(preview.draftContext?.flowDraft.openingDmButtonEnabled, true);
    assert.equal(preview.draftContext?.flowDraft.openingDmButtonLabel, "Ja, zeig mir das Bundle");
    assert.equal(preview.draftContext?.flowDraft.linkMessageText, "Perfekt, hier findest du das Bundle.");
    assert.deepEqual(preview.draftContext?.flowDraft.commentReplyVariants, [
      "Hey, schau in deine DM!", "Nachricht vorbereitet.", "Dritter Text",
    ]);
  });

  await t.test("unsafe links and nonboolean switches are not enabled by coercion", async () => {
    const { normalizePeteCampaignConfig } = await import("../data/campaigns.store.js");
    for (const unsafe of [
      "javascript:alert(1)", "http://example.com", "//example.com",
      "https://localhost/test", "https://u:p@example.com",
      "https://127.0.0.1/", "not-a-link",
    ]) {
      const value = normalizePeteCampaignConfig({
        sources: ["instagram_dm"], keywords: ["CHECK"],
        flowDraftEnabled: "true", autoReplyEnabled: 1,
        linkEnabled: "on", linkUrl: unsafe, peteHandoffEnabled: "true",
      });
      assert.equal(value.flowDraftEnabled, false);
      assert.equal(value.autoReplyEnabled, false);
      assert.equal(value.linkEnabled, false);
      assert.equal(value.peteHandoffEnabled, false);
      assert.equal(value.linkUrl, "");
    }
    const old = normalizePeteCampaignConfig({ sources: ["instagram_dm"], keywords: ["CHECK"] });
    assert.equal(old.flowDraftEnabled, false);
    assert.equal(old.autoReplyEnabled, false);
    assert.equal(old.linkEnabled, false);
    assert.equal(old.peteHandoffEnabled, false);
  });

  await t.test("unmatched, ambiguous and manual follower entries never expose a Pete context", () => {
    const noMatch = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_dm", messageText: "INVALID-KEYWORD",
    });
    // A generic campaign can legitimately match unmatched keywords.
    assert.equal(noMatch.status, "matched");
    assert.equal(noMatch.draftContext?.campaignId, "generic");
    const noSource = evaluateCampaignEntryPreview(campaigns, {
      source: "whatsapp_ctwa", messageText: "CHECK",
    });
    assert.equal(noSource.status, "no_match");
    assert.equal(noSource.draftContext, null);
    const ambiguous = evaluateCampaignEntryPreview([
      { id: "a", peteCampaign: { sources: ["instagram_dm"], keywords: ["CHECK"], openingText: "A", followUpEnabled: false } },
      { id: "b", peteCampaign: { sources: ["instagram_dm"], keywords: ["CHECK"], openingText: "B", followUpEnabled: false } },
    ], { source: "instagram_dm", messageText: "CHECK" });
    assert.equal(ambiguous.status, "ambiguous");
    assert.equal(ambiguous.draftContext, null);
    const follower = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_new_follower", messageText: "CHECK",
    });
    assert.equal(follower.status, "manual_only");
    assert.equal(follower.draftContext, null);
  });

  await t.test("Pete draft blocks the old ghosting sender even when a template toggle is true", async () => {
    const { getOrCreateConversationState, persistConversationState } =
      await import("../core/state-manager.js");
    const { getConversationState } = await import("../data/store.js");
    const { default: app } = await import("../app.js");
    const campaignId = "phase4-ghosting-draft";
    const leadId = "phase4-ghosting-test-lead";
    saveCampaign({ id: campaignId, peteCampaign: {
      sources: ["instagram_dm"], keywords: ["CHECK"],
      openingText: "Bitte erstmal nur prüfen.", followUpEnabled: true,
    } });
    const state = getOrCreateConversationState(leadId, campaignId);
    state.source = "Instagram";
    state.owner = "ai";
    state.aiPaused = false;
    state.flags.stopped = false;
    persistConversationState(state);
    const originalLength = state.messages.length;
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const result = await fetch(
        `http://127.0.0.1:${address.port}/ghosting/send-due/${campaignId}/${leadId}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendAt: new Date().toISOString() }) },
      );
      assert.equal(result.status, 200);
      const body = await result.json() as Record<string, unknown>;
      assert.equal(body.sent, false);
      assert.equal(body.dryRun, true);
      assert.equal(body.sendSkipped, true);
      assert.equal(body.sendSkipReason, "pete_campaign_preview_only");
      const saved = getConversationState(leadId, campaignId);
      assert.ok(saved);
      assert.equal(saved.messages.length, originalLength);
      assert.equal(saved.ghosting?.sentHistory?.length ?? 0, 0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve()));
    }
  });
});
