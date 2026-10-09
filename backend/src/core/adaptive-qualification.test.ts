import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-phase3-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
delete process.env.OPENAI_API_KEY;

const {
  buildHumanChoiceClarifier,
  extractScaleValue,
  interpretChoiceDeterministically,
  parseParentContext,
} = await import("../domain/qualification-intelligence.js");
const { getCampaignById } = await import("../config/campaigns.js");
const { processIncomingMessage } = await import("./conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

const CAMPAIGN_ID = "eltern-vital-fit";

test("Adaptive qualification primitives", async (t) => {
  await t.test("detects Mama, Papa, parent and non-parent context", () => {
    assert.equal(parseParentContext("Ich bin Papa von zwei Kindern").role, "papa");
    assert.equal(parseParentContext("Mama, Tochter ist 7").role, "mama");
    assert.equal(parseParentContext("Wir haben Kinder").role, "parent");
    assert.equal(parseParentContext("Nein, ich habe keine Kinder").role, "not_parent");
  });

  await t.test("maps natural situation answers without requiring a/b/c/d", () => {
    const step = getCampaignById(CAMPAIGN_ID).flow.find(
      (item) => item.id === "situation_choice",
    );
    assert.ok(step);

    assert.equal(
      interpretChoiceDeterministically({
        stepId: "situation_choice",
        input: "Ich bin ständig platt und habe kaum Energie",
        options: step.options ?? [],
      }).mappedChoice,
      "a",
    );

    assert.equal(
      interpretChoiceDeterministically({
        stepId: "situation_choice",
        input: "Mein Bauch stört mich und ich bin gleichzeitig total müde",
        options: step.options ?? [],
      }).mappedChoice,
      "d",
    );
  });

  await t.test("maps natural goal answers without requiring a/b/c/d", () => {
    const step = getCampaignById(CAMPAIGN_ID).flow.find(
      (item) => item.id === "goal_choice",
    );
    assert.ok(step);

    assert.equal(
      interpretChoiceDeterministically({
        stepId: "goal_choice",
        input: "Ich will endlich wieder mehr Energie haben",
        options: step.options ?? [],
      }).mappedChoice,
      "a",
    );
  });

  await t.test("extracts natural scale values", () => {
    assert.equal(extractScaleValue("8 von 10", 1, 10), 8);
    assert.equal(extractScaleValue("Für mich ganz klar eine 10", 1, 10), 10);
    assert.equal(extractScaleValue("weiß ich nicht", 1, 10), null);
  });

  await t.test("clarifier explicitly permits normal language", () => {
    assert.match(
      buildHumanChoiceClarifier("situation_choice"),
      /nicht mit a\/b\/c/i,
    );
    assert.match(
      buildHumanChoiceClarifier("goal_choice"),
      /in deinen Worten/i,
    );
  });
});

test("Adaptive qualification end-to-end", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  async function send(leadId: string, messageText: string) {
    return processIncomingMessage({
      leadId,
      campaignId: CAMPAIGN_ID,
      messageText,
    });
  }

  await t.test("asks parent context before qualification when unknown", async () => {
    clearConversationStore();
    const leadId = "phase3-parent-context";

    let result = await send(leadId, "Max");
    assert.equal(result.state.currentStep, "intro_ack");

    result = await send(leadId, "Ja, leg los");
    assert.equal(result.state.currentStep, "parent_context");
    assert.match(result.text ?? "", /Mama|Papa|Elternteil/i);
  });

  await t.test("does not ask parent question twice when already known", async () => {
    clearConversationStore();
    const leadId = "phase3-known-parent";

    let result = await send(leadId, "Ich bin Max, Papa von zwei Kindern");
    assert.equal(result.state.answers.parentRole, "papa");
    assert.equal(result.state.currentStep, "intro_ack");

    result = await send(leadId, "Ja");
    assert.equal(result.state.currentStep, "situation_choice");
    assert.doesNotMatch(result.text ?? "", /Bist du Mama|Bist du Papa/i);
  });

  await t.test("routes explicit non-parent away from coaching qualification", async () => {
    clearConversationStore();
    const leadId = "phase3-non-parent";

    await send(leadId, "Max");
    await send(leadId, "Ja");
    const result = await send(leadId, "Nein, ich habe keine Kinder");

    assert.equal(result.state.answers.parentRole, "not_parent");
    assert.equal(result.state.currentStep, "info_only");
    assert.equal(result.state.flags.wantsInfoOnly, true);
  });

  await t.test("natural answers progress through qualification without choice letters", async () => {
    clearConversationStore();
    const leadId = "phase3-natural-flow";

    let result = await send(leadId, "Max");
    assert.equal(result.state.currentStep, "intro_ack");

    result = await send(leadId, "Ja");
    assert.equal(result.state.currentStep, "parent_context");

    result = await send(leadId, "Papa, zwei Kinder");
    assert.equal(result.state.currentStep, "situation_choice");
    assert.equal(result.state.answers.parentRole, "papa");

    result = await send(leadId, "Ich bin ständig platt und habe kaum Energie");
    assert.equal(result.state.currentStep, "tried_before_freetext");
    assert.equal(result.state.answers.situationChoice, "a");
    assert.equal(
      result.state.answers.situationChoiceText,
      "Ich bin ständig platt und habe kaum Energie",
    );

    result = await send(leadId, "Ich habe Kalorien gezählt und öfter Sport angefangen");
    assert.equal(result.state.currentStep, "consequence_freetext");
    assert.equal(
      result.state.answers.triedBeforeText,
      "Ich habe Kalorien gezählt und öfter Sport angefangen",
    );

    result = await send(leadId, "Mich würde nerven, dass ich weiter so platt bin");
    assert.equal(result.state.currentStep, "goal_choice");

    result = await send(leadId, "Ich will endlich wieder mehr Energie haben");
    assert.equal(result.state.currentStep, "importance_scale");
    assert.equal(result.state.answers.goalChoice, "a");

    result = await send(leadId, "8 von 10");
    assert.equal(result.state.currentStep, "commitment");
    assert.equal(result.state.answers.importanceScore, 8);

    result = await send(leadId, "Ich will das wirklich angehen");
    assert.equal(result.state.currentStep, "booking");
    assert.equal(result.state.answers.commitmentChoice, "really_start");
  });
});
