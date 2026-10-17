import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  getNormalizedPeteCampaignConfig,
  PETE_CAMPAIGN_SOURCES,
} from "../utils/dashboardHelpers.js";

test("Phase 3: campaign editor stores multiple safe draft entry sources", () => {
  const options = PETE_CAMPAIGN_SOURCES.map(([source]) => source);
  assert.equal(new Set(options).size, options.length);
  assert.ok(options.includes("instagram_dm"));
  assert.ok(options.includes("instagram_reel_comment"));
  assert.ok(options.includes("instagram_story_reply"));
  assert.ok(options.includes("instagram_new_follower"));
  assert.ok(options.includes("whatsapp_dm"));

  const config = getNormalizedPeteCampaignConfig({ peteCampaign: {
    sources: ["instagram_dm", "instagram_reel_comment", "instagram_dm", "invalid"],
    keywords: [" check ", "KETO", "check", "BULLSHIT", "bad keyword"],
    openingText: "Hey, danke für deinen Kommentar.",
    followUpEnabled: true,
  } });
  assert.deepEqual(config.sources, ["instagram_dm", "instagram_reel_comment"]);
  assert.deepEqual(config.keywords, ["CHECK", "KETO", "BULLSHIT"]);
  assert.equal(config.openingText, "Hey, danke für deinen Kommentar.");
  assert.equal(config.followUpEnabled, true);
});

test("Phase 3: existing campaigns default to safe draft settings", () => {
  const config = getNormalizedPeteCampaignConfig({ id: "existing-legacy-campaign", q1: "Alte Frage" });
  assert.deepEqual(config.sources, []);
  assert.deepEqual(config.keywords, []);
  assert.equal(config.openingText, "");
  assert.equal(config.followUpEnabled, false);
  const invalid = getNormalizedPeteCampaignConfig({ peteCampaign: {
    sources: "instagram_dm", keywords: null, openingText: "x".repeat(2000), followUpEnabled: "true",
  } });
  assert.deepEqual(invalid.sources, []);
  assert.deepEqual(invalid.keywords, []);
  assert.equal(invalid.openingText.length, 1000);
  assert.equal(invalid.followUpEnabled, false);
});

test("Phase 3: editor is no longer a required ABC qualification form", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.ok(editor.includes('title="Pete-Einstiege"'));
  assert.ok(editor.includes("PETE_CAMPAIGN_SOURCES.map"));
  assert.ok(editor.includes('title="Optionales Nachfassen"'));
  assert.ok(!editor.includes('title="Nachrichten / Fragen"'));
  assert.ok(!editor.includes('["Frage 1", "q1"]'));
});

test("Phase 4: dashboard exposes only preview endpoint, never a send command", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../services/campaignsApi.js", import.meta.url), "utf8");
  assert.match(editor, /Kampagnen-Einstieg testen/);
  assert.match(editor, /Einstieg nur simulieren/);
  assert.match(editor, /previewCampaignEntryInApi/);
  assert.match(api, /\/campaigns\/preview-entry/);
  assert.match(api, /data\.preview\.sendAllowed !== false/);
});

test("Phase 4B: Reel campaigns support all-vs-selected media IDs without enabling sends", () => {
  const specific = getNormalizedPeteCampaignConfig({ peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["CHECK"],
    reelTarget: "specific",
    reelMediaIds: ["17851537767246649", "17851537767246649", "not-valid"],
  } });
  assert.equal(specific.reelTarget, "specific");
  assert.deepEqual(specific.reelMediaIds, ["17851537767246649"]);
  const empty = getNormalizedPeteCampaignConfig({ peteCampaign: {
    reelTarget: "invalid", reelMediaIds: null,
  } });
  assert.equal(empty.reelTarget, "all");
  assert.deepEqual(empty.reelMediaIds, []);

  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.ok(editor.includes("Welche Reels sollen berücksichtigt werden?"));
  assert.ok(editor.includes("Nur ausgewählte Reels"));
  assert.ok(editor.includes("Reel-Media-ID für die Vorschau"));
});

test("Phase 4B: webhook origin lab only uses a read-only preview API", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const lab = fs.readFileSync(new URL("./WebhookEventPreview.jsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../services/campaignsApi.js", import.meta.url), "utf8");
  assert.ok(editor.includes('title="Webhook-Herkunft prüfen (Labor)"'));
  assert.ok(lab.includes("Webhook nur simulieren"));
  assert.ok(lab.includes("previewCampaignWebhookInApi"));
  assert.match(api, /\/campaigns\/preview-event/);
  assert.match(api, /data\.event\.mode !== "preview_only"/);
  assert.match(api, /data\.preview\.mode !== "preview_only"/);
  assert.match(api, /data\.event\.sendAllowed !== false/);
  assert.match(api, /data\.preview\.sendAllowed !== false/);
});

test("Phase 4B: campaign switching keeps stale scheduling data out of the active form", () => {
  const hook = fs.readFileSync(new URL("../hooks/useCampaigns.js", import.meta.url), "utf8");
  // Switching selection must not re-fetch the entire campaign list.
  assert.match(hook, /loadCampaigns\(\);\s*return \(\) => \{ cancelled = true; \};\s*\}, \[settings\.apiBaseUrl\]\)/);
  // A late response for campaign A cannot write its booking data into B.
  assert.match(hook, /cancelled \|\| campaignToLoad\.useGlobalBookingDefaults/);
  assert.match(hook, /prev\?\.id === campaignToLoad\.id/);
  assert.match(hook, /if \(!cancelled\) setCampaignLoading\(false\)/);
});

test("Phase 4B: campaign save requires backend confirmation before marking local state saved", () => {
  const hook = fs.readFileSync(new URL("../hooks/useCampaigns.js", import.meta.url), "utf8");
  const save = hook.split("  async function saveCampaign() {")[1]
    .split("  async function deleteCampaign() {")[0];
  assert.ok(save.includes("campaignSavedToBackend = true;"));
  assert.ok(save.indexOf("campaignSavedToBackend = true;") <
    save.indexOf("setCampaigns((prev) =>"));
  assert.ok(save.includes("Kampagne nicht im Backend gespeichert."));
  assert.ok(save.includes("Kampagne gespeichert, aber Buchungslogik nicht bestätigt."));
  assert.ok(!save.includes("setActiveCampaignId(updatedCampaign.id)"));
  assert.ok(save.includes("prev?.id === updatedCampaign.id"));
});

test("Phase 4B: campaign editor does not force multi-column overflow on narrow screens", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.ok(editor.includes("repeat(auto-fit, minmax(min(100%, 180px), 1fr))"));
  assert.ok(editor.includes("repeat(auto-fit, minmax(min(100%, 160px), 1fr))"));
  assert.ok(!editor.includes("repeat(2, minmax(180px, 1fr))"));
  assert.ok(!editor.includes("repeat(3, minmax(160px, 1fr))"));
});

test("Phase 4B: versioned preview context is never treated as execution permission", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../services/campaignsApi.js", import.meta.url), "utf8");
  assert.ok(editor.includes("Pete-Kontext aus der gespeicherten Kampagne (nur Vorschau)"));
  assert.ok(editor.includes("previewResponse.draftContext"));
  assert.ok(editor.includes("Follow-up:"));
  assert.ok(api.includes('data.preview.draftContext?.version !== 1'));
  assert.ok(api.includes('data.preview.draftContext?.mode !== "preview_only"'));
  assert.ok(api.includes('data.preview.draftContext?.sendAllowed !== false'));
  assert.ok(api.includes('data.preview.draftContext?.campaignId !== data.preview.matchedCampaignId'));
  assert.ok(api.includes('data.preview.status !== "matched" && data.preview.draftContext != null'));
});

test("Phase 4B: preview does not leak a stale campaign across editor selection", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.ok(editor.includes("const previewRequestId = useRef(0)"));
  assert.ok(editor.includes("previewRequestId.current += 1"));
  assert.ok(editor.includes("requestId === previewRequestId.current"));
  assert.ok(editor.includes("campaignForm?.id, campaignForm?.name, campaignForm?.peteCampaign"));
  assert.ok(editor.includes("key={campaignForm.id}"));
});

test("Phase 4B: dashboard preview inputs invalidate requests before editing results", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  for (const field of ["setPreviewSource", "setPreviewMessage", "setPreviewMediaId"]) {
    assert.ok(editor.includes(`invalidatePreview(); ${field}(e.target.value)`));
  }
  assert.ok(editor.includes("previewRequestId.current += 1"));
  assert.ok(editor.includes("requestId === previewRequestId.current"));
  assert.ok(editor.includes("settings.apiBaseUrl]);"));
});

test("Phase 4B: webhook preview is race-safe and uses a correct example for each channel", () => {
  const lab = fs.readFileSync(new URL("./WebhookEventPreview.jsx", import.meta.url), "utf8");
  assert.ok(lab.includes("const WHATSAPP_EXAMPLE"));
  assert.ok(lab.includes('object: "whatsapp_business_account"'));
  assert.ok(lab.includes('nextChannel === "whatsapp" ? WHATSAPP_EXAMPLE : REEL_EXAMPLE'));
  assert.ok(lab.includes("invalidatePreview(); setPayloadText(e.target.value)"));
  assert.ok(lab.includes("requestSerial.current += 1"));
  assert.ok(lab.includes("requestId === requestSerial.current"));
  assert.ok(lab.includes("Pete-Kontext aus der gespeicherten Kampagne (nur Vorschau)"));
  assert.ok(lab.includes('gesperrt (Prüfmodus)'));
});
