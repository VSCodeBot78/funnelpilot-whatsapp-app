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
  extractScaleValue,
  interpretChoiceDeterministically,
  parseParentContext,
} = await import("../domain/qualification-intelligence.js");
const { campaigns, DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

test("Phase 3 adaptive qualification", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("parent role is detected without forcing a/b answers", () => {
    assert.equal(parseParentContext("Ich bin Mama von zwei Kindern").role, "mama");
    assert.equal(parseParentContext("Papa, zwei Kids").role, "papa");
    assert.equal(parseParentContext("Ich bin Elternteil").role, "parent");
    assert.equal(parseParentContext("Ich habe keine Kinder").role, "not_parent");
  });

  await t.test("natural situation text maps to existing structured choices", () => {
    const step = campaigns[DEFAULT_CAMPAIGN_ID].flow.find(
      (item) => item.id === "situation_choice",
    );
    assert.ok(step);

    const energy = interpretChoiceDeterministically({
      stepId: "situation_choice",
      input: "Ich bin eigentlich ständig müde und platt.",
      options: step.options ?? [],
    });
    assert.equal(energy.mappedChoice, "a");

    const combined = interpretChoiceDeterministically({
      stepId: "situation_choice",
      input: "Ich bin müde und mein Bauch nervt mich auch.",
      options: step.options ?? [],
    });
    assert.equal(combined.mappedChoice, "d");
  });

  await t.test("natural goal text maps to the right goal", () => {
    const step = campaigns[DEFAULT_CAMPAIGN_ID].flow.find(
      (item) => item.id === "goal_choice",
    );
    assert.ok(step);

    const result = interpretChoiceDeterministically({
      stepId: "goal_choice",
      input: "Ich will endlich wieder mehr Energie im Alltag.",
      options: step.options ?? [],
    });

    assert.equal(result.mappedChoice, "a");
  });

  await t.test("scale accepts normal language like 8 von 10", () => {
    assert.equal(extractScaleValue("Ehrlich gesagt eine 8 von 10.", 1, 10), 8);
  });

  await t.test("parent context can also answer the situation and skip a redundant turn", async () => {
    clearConversationStore();
    const leadId = "phase3-parent-and-situation";

    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Max",
    });

    const afterAck = await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ja, gerne",
    });

    assert.equal(afterAck.nextStep, "parent_context");
    assert.match(afterAck.text ?? "", /Mama|Papa|Elternteil/);

    const result = await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Papa von zwei Kindern, 5 und 2, und ehrlich gesagt ständig müde.",
    });

    assert.equal(result.state.answers.parentRole, "papa");
    assert.equal(result.state.answers.isTargetParent, true);
    assert.equal(result.state.answers.situationChoice, "a");
    assert.equal(result.nextStep, "tried_before_freetext");
    assert.match(result.text ?? "", /Energie/);
    assert.match(result.text ?? "", /bisher schon mal was versucht/i);
  });

  await t.test("free-text bridge advances immediately instead of burning an extra turn", async () => {
    clearConversationStore();
    const leadId = "phase3-no-dead-turn";

    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Tom",
    });
    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ja",
    });
    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Papa von einem Kind",
    });
    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ich bin oft müde.",
    });

    const result = await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ich habe schon mal mit Training angefangen.",
    });

    assert.equal(result.nextStep, "consequence_freetext");
    assert.equal(result.state.currentStep, "consequence_freetext");
    assert.match(result.text ?? "", /nächsten 2-3 Monaten|nachsten 2-3 Monaten/i);
    assert.equal(result.state.answers.pendingAiFollowUpQuestion, undefined);
  });

  await t.test("natural goal and scale answers keep the funnel moving", async () => {
    clearConversationStore();
    const leadId = "phase3-natural-goal";

    const stateSteps = [
      ["Lena", "intro_ack"],
      ["Ja", "parent_context"],
      ["Mama von zwei Kindern", "situation_choice"],
      ["Mein Bauch nervt mich", "tried_before_freetext"],
      ["Ich habe schon einiges probiert", "consequence_freetext"],
      ["Dass ich mich weiter unwohl fühle", "goal_choice"],
      ["Ich will mich wieder wohler in meinem Körper fühlen", "importance_scale"],
      ["Ehrlich eine 8 von 10", "commitment"],
    ] as const;

    let last;
    for (const [message, expectedNext] of stateSteps) {
      last = await processIncomingMessage({
        leadId,
        campaignId: DEFAULT_CAMPAIGN_ID,
        messageText: message,
      });
      assert.equal(last.nextStep, expectedNext);
    }

    assert.equal(last?.state.answers.goalChoice, "b");
    assert.equal(last?.state.answers.importanceScore, 8);
  });

  await t.test("non-parent leads are not pushed into the parent coaching funnel", async () => {
    clearConversationStore();
    const leadId = "phase3-non-parent";

    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Chris",
    });
    await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ja",
    });

    const result = await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ich habe keine Kinder.",
    });

    assert.equal(result.state.answers.parentRole, "not_parent");
    assert.equal(result.state.answers.isTargetParent, false);
    assert.equal(result.nextStep, "info_only");
    assert.match(result.text ?? "", /für Eltern|Eltern gebaut/i);
  });
});
