import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-value-map-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { writeSettings, readSettings } = await import("../services/settings-store.js");
const { buildPeteEffectiveInstructions } = await import("../core/pete-llm-conversation.js");

test("coach offer-value mapping persists and informs Pete while claims stay nonbinding", t => {
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const map = [
    "ANGEBOT: 5-Wochen-Startphase",
    "LEISTUNG: Begleitung zu Bewegung, Ernährung, Schlaf und Stress",
    "VORTEIL: Umsetzung im Elternalltag statt nur weiterer Fitnessinformationen",
    "MÖGLICHER NUTZEN: Weniger Start-Stopp auf dem Weg zum eigenen Ziel",
    "NACHWEIS: Nur tatsächlich bestätigte Referenzen oder Leistungen"
  ].join("\n");
  writeSettings({ offerValueMap: map });
  assert.equal(readSettings().offerValueMap, map);
  const prompt = buildPeteEffectiveInstructions();
  assert.match(prompt, /angebot_leistung_vorteil_kundennutzen_als_coach_angabe/);
  assert.match(prompt, /Weniger Start-Stopp/);
  assert.match(prompt, /Leistung, ihren praktischen Vorteil/);
  assert.match(prompt, /KEIN Beleg fuer eine Erfolgsgarantie/);
  const maxed = writeSettings({ offerValueMap: "X".repeat(6000) });
  assert.equal(maxed.offerValueMap.length, 5000);
  assert.equal(readSettings().offerValueMap.length, 5000);
});
