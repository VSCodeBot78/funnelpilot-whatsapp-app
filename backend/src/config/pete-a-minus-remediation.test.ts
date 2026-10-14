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

test("A- fixer: guide context switch honors free resource without needless handoff",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "Danke, den Check habe ich. Jetzt interessiert mich doch eher dein kostenloser Keto Guide.",state);
  assert.ok(result?.text.includes(OFFER_TRUTH.resources.ketoGuide.url));
  assert.notEqual(result?.handoff,true);
});
test("A- fixer: already received guide gets no duplicate link",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "Danke für den Keto Guide. Ich möchte zurzeit wirklich kein Coaching, nur lesen.",state);
  assert.equal(result,null);
});

test("A- fixer: financial decline does not request a human or sell aggressively",()=>{
  const result=getPeteVerifiedTransactionAnswer(
    "499 Euro sind mir zu viel, wir haben Kinder und viele Ausgaben.",state);
  assert.ok(result?.text.includes("keinen Druck"));
  assert.notEqual(result?.handoff,true);
});

test("A- fixer: direct human request includes 'Jochen persönlich schreiben'",()=>{
  assert.equal(isExplicitPeteHumanTakeoverRequest(
    "Ich will hier mit Jochen persönlich schreiben. Kein Bot bitte."),true);
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
