import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL(file, import.meta.url), "utf8");

test("Pete dashboard exposes Sol, not an editable mini model", () => {
  const panel = read("./SettingsBotPanel.jsx");
  assert.match(panel, /<option value="gpt-6\.1-sol">GPT-6\.1 Sol<\/option>/);
  assert.doesNotMatch(panel, /<option[^>]*gpt-4\.1-mini/);
  assert.doesNotMatch(panel, /value=\{safeSettings\.aiModel\}/);
  assert.match(panel, /openAiModelConfigured/);
});
test("coach dashboard can edit the offer-to-benefit-to-goal description", () => {
  const panel = read("./SettingsBotPanel.jsx");
  assert.match(panel, /Angebote: Leistung, Vorteil und Kundennutzen/);
  assert.match(panel, /updateField\("offerValueMap", event\.target\.value\)/);
  assert.match(read("../hooks/useSettingsConfig.js"), /offerValueMap: ""/);
});

test("dashboard defaults use Sol for new and migrated settings", () => {
  assert.match(read("./SettingsView.jsx"), /aiModel: "gpt-6\.1-sol"/);
  assert.match(read("../hooks/useSettingsConfig.js"), /aiModel: "gpt-6\.1-sol"/);
  assert.doesNotMatch(read("../hooks/useSettingsConfig.js"), /aiModel: "gpt-4\.1-mini"/);
});
