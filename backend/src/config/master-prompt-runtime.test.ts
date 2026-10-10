import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-master-prompt-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "synthetic-ci-only-not-real";
const { readSettings, writeSettings } = await import("../services/settings-store.js");
const { generateAlreadyTriedBridgeReply } = await import("../services/ai-funnel.service.js");

test("customer-editable master prompt survives storage and reaches actual OpenAI request", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const initial = readSettings();
  assert.match(initial.masterPrompt, /Eltern fit & vital/);
  assert.match(initial.masterPrompt, /Keto ist optionales Werkzeug/);
  writeSettings({
    aiEnabled: true,
    companyName: "Coach-Testmarke",
    companyAudience: "Mütter mit Schichtarbeit",
    assistantName: "Nora",
    brandVoice: "Nüchtern und freundlich",
    masterPrompt: "Sonderregel Testmandant: Stelle nur eine Frage und vermeide Werbesprech.",
  });
  assert.equal(readSettings().masterPrompt,
    "Sonderregel Testmandant: Stelle nur eine Frage und vermeide Werbesprech.");

  let body: any = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(init?.method, "POST");
    body = JSON.parse(String(init?.body));
    return {
      ok: true,
      json: async () => ({ output: [
        { content: [ { type: "output_text", text: JSON.stringify({
          category: "already_tried",
          mode: "mirror",
          replyText: "Klingt, als wäre das mit Schichtarbeit echt eng.",
          returnToFunnel: true,
          targetStep: "consequence_freetext",
          mappedChoice: null,
          confidence: 0.95,
        }) } ] },
      ] }),
    } as Response;
  }) as typeof fetch;

  const response = await generateAlreadyTriedBridgeReply({
    userMessage: "Ich habe wegen der Schichten schon dreimal aufgehört.",
    currentStep: "tried_before_freetext",
    nextStep: "consequence_freetext",
    leadName: "Nina",
  });
  assert.ok(response);
  assert.match(response?.replyText || "", /Schichtarbeit/);
  const system = body.input[0].content as string;
  assert.match(system, /Coach-Testmarke/);
  assert.match(system, /Mütter mit Schichtarbeit/);
  assert.match(system, /Nora/);
  assert.match(system, /Sonderregel Testmandant/);
  assert.match(system, /niemals Preise, Verfügbarkeiten, medizinische Aussagen/);
  assert.equal(body.input[1].role, "user");
  assert.match(body.input[1].content, /Schichten/);
  assert.equal(body.text.format.type, "json_schema");

  writeSettings({ masterPrompt: "Geänderter Kundentext" });
  assert.equal(readSettings().companyName, "Coach-Testmarke");
  assert.equal(readSettings().masterPrompt, "Geänderter Kundentext");

  writeSettings({ aiEnabled: false });
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("API must not be called with aiEnabled=false");
  }) as typeof fetch;
  const disabledResult = await generateAlreadyTriedBridgeReply({
    userMessage: "Ich bin müde",
    currentStep: "tried_before_freetext",
    nextStep: "consequence_freetext",
  });
  assert.equal(disabledResult, null);
  assert.equal(called, false);
});
