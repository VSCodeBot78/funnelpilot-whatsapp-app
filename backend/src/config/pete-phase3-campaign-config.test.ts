import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Backend persistence checks only. No real leads or provider traffic.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase3-draft-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { getAllCampaigns, getCampaignById, saveCampaign, normalizePeteCampaignConfig } =
  await import("../data/campaigns.store.js");

test("Phase 3: new configuration persists without changing existing legacy fields", t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const existing = getAllCampaigns()[0];
  assert.ok(existing);
  const oldQuestions = { q1: existing.q1, q2: existing.q2, trigger: existing.trigger };
  const updated = saveCampaign({
    ...existing,
    peteCampaign: {
      sources: ["instagram_story_reply", "instagram_dm"],
      keywords: ["CHECK", "KETO"],
      openingText: "Hey, danke für deine Nachricht.",
      followUpEnabled: false,
    },
  });
  assert.deepEqual(updated.peteCampaign?.sources, ["instagram_story_reply", "instagram_dm"]);
  const loaded = getCampaignById(existing.id);
  assert.ok(loaded);
  assert.equal(loaded.q1, oldQuestions.q1);
  assert.equal(loaded.q2, oldQuestions.q2);
  assert.equal(loaded.trigger, oldQuestions.trigger);
  assert.deepEqual(loaded.peteCampaign, updated.peteCampaign);
});

test("Phase 3: normalization prevents unsupported sources and unrequested follow-ups", () => {
  const result = normalizePeteCampaignConfig({
    sources: ["whatsapp_ctwa", "whatsapp_ctwa", "something_else", 2],
    keywords: [" start ", "START", "bad keyword", "#unsafe", "GUIDE"],
    openingText: "x".repeat(2000),
    followUpEnabled: "true",
  });
  assert.deepEqual(result.sources, ["whatsapp_ctwa"]);
  assert.deepEqual(result.keywords, ["START", "GUIDE"]);
  assert.equal(result.openingText.length, 1000);
  assert.equal(result.followUpEnabled, false);
  assert.deepEqual(normalizePeteCampaignConfig(null), {
    sources: [], keywords: [], openingText: "", followUpEnabled: false,
    reelTarget: "all", reelMediaIds: [],
    flowDraftEnabled: false, autoReplyEnabled: false,
    linkEnabled: false, linkLabel: "", linkUrl: "",
    peteHandoffEnabled: false,
    commentReplyEnabled: false, commentReplyVariants: [], openingDmVariants: [],
    openingDmButtonEnabled: false, openingDmButtonLabel: "", linkMessageText: "",
  });
});
