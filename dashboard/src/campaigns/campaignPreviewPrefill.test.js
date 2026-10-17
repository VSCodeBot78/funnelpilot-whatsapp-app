import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getCampaignPreviewPrefill } from "./campaignPreviewPrefill.js";

test("Desktop QA prefill: an unsaved campaign and missing source cannot be previewed", () => {
  assert.deepEqual(getCampaignPreviewPrefill(null),
    { ok: false, reason: "Bitte zuerst eine Kampagne speichern." });
  assert.deepEqual(getCampaignPreviewPrefill({ id: "blank", peteCampaign: {} }),
    { ok: false, reason: "Bitte zuerst einen Einstiegskanal speichern." });
});

test("Desktop QA prefill: Instagram DM and Story pick the first saved keyword", () => {
  const dm = getCampaignPreviewPrefill({ id: "dm", peteCampaign: {
    sources: ["instagram_dm"], keywords: ["CHECK", "START"],
  } });
  assert.equal(dm.ok, true);
  assert.equal(dm.source, "instagram_dm");
  assert.equal(dm.messageText, "CHECK");
  assert.equal(dm.mediaId, "");
  assert.equal(dm.needsMediaId, false);

  const story = getCampaignPreviewPrefill({ id: "story", peteCampaign: {
    sources: ["instagram_story_reply"], keywords: ["KETO"],
  } });
  assert.equal(story.source, "instagram_story_reply");
  assert.equal(story.messageText, "KETO");
});

test("Desktop QA prefill: selected Reel uses saved confirmed ID; all Reels needs a real ID", () => {
  const specific = getCampaignPreviewPrefill({ id: "reel", peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["BULLSHIT"],
    reelTarget: "specific", reelMediaIds: ["17851537767246649"],
  } });
  assert.equal(specific.mediaId, "17851537767246649");
  assert.equal(specific.needsMediaId, false);
  assert.equal(specific.messageText, "BULLSHIT");

  const all = getCampaignPreviewPrefill({ id: "all-reels", peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["CHECK"],
    reelTarget: "all",
  } });
  assert.equal(all.mediaId, "");
  assert.equal(all.needsMediaId, true);
  assert.match(all.notice, /bestätigte Reel-Media-ID/);

  const emptySpecific = getCampaignPreviewPrefill({ id: "missing-reel", peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["CHECK"],
    reelTarget: "specific", reelMediaIds: [],
  } });
  assert.equal(emptySpecific.needsMediaId, true);
});

test("Desktop QA prefill: follower remains manual; no-keyword entries get plain placeholder", () => {
  const follower = getCampaignPreviewPrefill({ id: "follower", peteCampaign: {
    sources: ["instagram_new_follower"], keywords: [],
  } });
  assert.equal(follower.source, "instagram_new_follower");
  assert.equal(follower.messageText, "");
  assert.match(follower.notice, /nur manuell/);
  const noKeyword = getCampaignPreviewPrefill({ id: "no-keyword", peteCampaign: {
    sources: ["whatsapp_dm"], keywords: [],
  } });
  assert.equal(noKeyword.messageText, "Hallo");
});

test("Desktop QA button prefill is explicitly manual and never invokes providers", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const helper = fs.readFileSync(new URL("./campaignPreviewPrefill.js", import.meta.url), "utf8");
  assert.match(editor, /getCampaignPreviewPrefill\(savedCampaign\)/);
  assert.match(editor, /onClick=\{useSavedCampaignExample\}/);
  assert.match(editor, /disabled=\{!savedCampaign \|\| hasUnsavedPeteChanges \|\| previewLoading\}/);
  assert.match(editor, /Gespeicherten Kampagneneinstieg übernehmen/);
  assert.match(editor, /setPreviewMediaId\(example\.mediaId\)/);
  assert.doesNotMatch(helper, /fetch\(|axios|sendMessage|onClick|meta\/|openai/i);
});
