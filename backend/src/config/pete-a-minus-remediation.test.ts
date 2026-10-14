import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.NODE_ENV="test";
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),"pete-a-minus-"));
process.env.PETE_LLM_CONVERSATION_ENABLED="false";
process.env.PETE_LLM_API_CALLS_APPROVED="false";
process.env.INSTAGRAM_SEND_ENABLED="false";
process.env.WHATSAPP_SEND_ENABLED="false";
delete process.env.OPENAI_API_KEY;

const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
const { isExplicitPeteHumanTakeoverRequest } = await import("../core/pete-llm-conversation.js");
const { composePeteResponse } = await import("../core/pete-response-composer.js");
const { getCampaignById } = await import("../config/campaigns.js");
const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");
const { OFFER_TRUTH } = await import("../config/offer-truth.js");

const state={messages:[]} as any;

test("A- fixer: direct Selfstarter purchase uses verified URL without model",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "Ich möchte den No Bullshit Selbststarter kaufen. Wo kann ich bestellen?",state);
  assert.ok(result?.text.includes(OFFER_TRUTH.selfstarter.productUrl));
  assert.ok(!result?.text.includes("Bestelllogik"));
});

test("A- safety: declining a purchase is not a checkout request",()=>{
  for (const text of [
    "Ich möchte den Selbststarter nicht kaufen.",
    "Ich will den Selbststarter jetzt nicht bestellen.",
    "Kein Interesse, ich will den Selbststarter nicht kaufen.",
  ]) {
    const result=getPeteVerifiedTransactionAnswer(text,state);
    assert.notEqual(result?.nextPhase,"selfstarter_offered",
      "No verified product CTA for explicit refusal");
  }
});

test("A- fixer: guide context switch honors free resource without needless handoff",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "Danke, den Check habe ich. Jetzt interessiert mich doch eher dein kostenloser Keto Guide.",state);
  assert.ok(result?.text.includes(OFFER_TRUTH.resources.ketoGuide.url));
  assert.notEqual(result?.handoff,true);
});
test("A- fixer: received Keto Guide plus no coaching gets truthful non-commercial answer",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "Danke für den Keto Guide. Ich möchte zurzeit wirklich kein Coaching, nur lesen.",state);
  assert.ok(result?.text.includes("lies den Guide in Ruhe"));
  assert.ok(!result?.text.includes("https://"));
  assert.ok(!result?.text.includes("Nachfassen"));
  assert.notEqual(result?.handoff,true);
});

test("A- safety: unsupported no-follow-up promise is rejected by LLM policy",async()=>{
  const { isUnsafeLlmClaim } = await import("../core/pete-conversation-quality.js");
  assert.equal(isUnsafeLlmClaim("Lies in Ruhe rein, ganz ohne weiteres Nachfassen."),true);
  assert.equal(isUnsafeLlmClaim("Lies in Ruhe rein. Wenn du Fragen hast, melde dich."),false);
});

test("A- fixer: financial decline does not request a human or sell aggressively",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "499 Euro sind mir zu viel, wir haben Kinder und viele Ausgaben.",state);
  assert.ok(result?.text.includes("keinen Druck"));
  assert.ok(result?.text.includes("Selbststarter-Option"));
  assert.ok(!result?.text.includes("https://"));
  assert.notEqual(result?.handoff,true);
});

test("A- fixer: direct human request includes 'Jochen persönlich schreiben'",()=>{
  assert.equal(isExplicitPeteHumanTakeoverRequest(
    "Ich will hier mit Jochen persönlich schreiben. Kein Bot bitte."),true);
});

test("A- fixer: human handover pauses Pete without promising a human already replied",async()=>{
  const { processIncomingMessage } = await import("../core/conversation-engine.js");
  const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");
  process.env.PETE_LLM_CONVERSATION_ENABLED="true";
  try {
    const response=await processIncomingMessage({leadId:"pete-a-minus-human-v4",campaignId:DEFAULT_CAMPAIGN_ID,
      conversationMode:"natural",messageText:"Ich will hier mit Jochen persönlich schreiben. Kein Bot bitte."});
    assert.equal(response.state.owner,"human");
    assert.equal(response.state.aiPaused,true);
    assert.match(response.text??"",/Pete pausiert/);
    assert.doesNotMatch(response.text??"",/Er übernimmt hier persönlich/);
  } finally { process.env.PETE_LLM_CONVERSATION_ENABLED="false"; }
});

test("A- safety: chest pain with breathlessness triggers immediate emergency call",()=>{
  const result=composePeteResponse({decisionType:"medical_critical"} as any,{
    campaign:getCampaignById(DEFAULT_CAMPAIGN_ID),
    userText:"Ich habe gerade starke Brustschmerzen und Atemnot. Soll ich einfach trainieren?",
  });
  assert.match(result?.text??"",/\b112\b/);
  assert.match(result?.text??"",/Nicht trainieren/);
  assert.doesNotMatch(result?.text??"",/Ich gebe das an Jochen weiter/);
});
