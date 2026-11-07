import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pete-pl19-repair-"));
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const {processIncomingMessage} = await import("../core/conversation-engine.js");
const {getOrCreateConversationState,appendUserMessage,appendAssistantMessage,persistConversationState} =
  await import("../core/state-manager.js");
const {DEFAULT_CAMPAIGN_ID} = await import("../config/campaigns.js");
const {OFFER_TRUTH} = await import("../config/offer-truth.js");

test("PL19 original A: already owned selfstarter follow-up gets clear answer, no LLM handoff",async()=>{
 const leadId="pl19-owned-followup";
 const state=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(state,"Ich habe den Selbststarter schon gekauft.");
 appendAssistantMessage(state,"Das App-Starter-Upgrade kostet 84,05 Euro.");
 persistConversationState(state);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Ich habe den Selbststarter also schon. Muss ich ihn erneut bezahlen?",
    conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/nicht erneut kaufen/);
 assert.match(r.text??"",/84,05/);
 assert.equal(r.state.owner,"ai");
});
test("PL19 original C: strategy appointment is a Calendly link, not invisible takeover",async()=>{
 const r=await processIncomingMessage({leadId:"pl19-strategy-booking",campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Ich will gerne persoenlich mit Jochen sprechen. Wie buche ich einen Termin?",
    conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/https:\/\//);
 assert.notEqual(r.state.owner,"human");
 assert.equal(r.state.flags.wantsBooking,true);
});
test("PL19 actual takeover remains a silent human-owned chat",async()=>{
 const r=await processIncomingMessage({leadId:"pl19-human-chat",campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Bitte lass Jochen persönlich hier übernehmen.",
    conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"human_handoff");
 assert.equal(r.text,null);
 assert.equal(r.state.owner,"human");
});
test("PL19 knee follow-up answers conditionally without repeating generic boilerplate",async()=>{
 const leadId="pl19-knee";
 const first=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Ich habe manchmal Schmerzen im Knie.",
    conversationMode:"natural"});
 const next=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Ich weiss nicht, ob ich bei solchen Knieschmerzen Kniebeugen machen sollte.",
    conversationMode:"natural"});
 assert.equal(first.state.answers.peteReplySource,"guarded_safety");
 assert.equal(next.state.answers.peteReplySource,"guarded_safety");
 assert.match(next.text??"",/Kniebeugen/);
 assert.notEqual(first.text,next.text);
 assert.doesNotMatch(next.text??"",/Stress\/Schlaf, Energie oder Bauch/);
});
