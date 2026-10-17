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

test("Phase 4B: Meta examples are synthetic and preview-only", async () => {
  const { PROVIDER_PREVIEW_EXAMPLES, getSyntheticProviderPreviewExample } =
    await import("./providerPreviewExamples.js");
  const kinds = PROVIDER_PREVIEW_EXAMPLES.map(([id]) => id);
  assert.ok(kinds.includes("instagram_dm"));
  assert.ok(kinds.includes("instagram_comment"));
  assert.ok(kinds.includes("whatsapp_ctwa"));
  assert.equal(new Set(kinds).size, kinds.length);

  const dm = getSyntheticProviderPreviewExample("instagram_dm", "CHECK");
  assert.equal(dm.provider, "instagram");
  assert.equal(dm.payload.entry[0].messaging[0].message.text, "CHECK");

  const ad = getSyntheticProviderPreviewExample("whatsapp_ctwa", "START");
  assert.equal(ad.provider, "whatsapp");
  assert.equal(ad.payload.entry[0].changes[0].value.messages[0].referral.source_type, "ad");
  assert.equal(getSyntheticProviderPreviewExample("unknown"), null);

  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../services/campaignsApi.js", import.meta.url), "utf8");
  assert.match(editor, /Meta-Ereignisse simulieren/);
  assert.match(editor, /simulateProviderEvent/);
  assert.match(api, /\/campaigns\/preview-provider-entry/);
  assert.match(api, /data\.preview\.sendAllowed !== false/);
});
