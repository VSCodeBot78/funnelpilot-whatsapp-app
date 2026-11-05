import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fp-trial-facts-"));
Object.assign(process.env,{
 NODE_ENV:"test",DATA_DIR:dir,INSTAGRAM_ENGINE_ENABLED:"false",
 INSTAGRAM_SEND_ENABLED:"false",WHATSAPP_SEND_ENABLED:"false",
 PETE_LLM_CONVERSATION_ENABLED:"true",PETE_LLM_API_CALLS_APPROVED:"true",
 OPENAI_MODEL:"gpt-6.1-sol",OPENAI_API_KEY:"SYNTHETIC-NEVER-REAL-NETWORK"
});
const {processIncomingMessage}=await import("../core/conversation-engine.js");
const {writeSettings}=await import("../services/settings-store.js");
const {clearConversationStore}=await import("../data/store.js");
const {OFFER_TRUTH}=await import("./offer-truth.js");
const send=(id:string,messageText:string)=>processIncomingMessage({
 leadId:id,campaignId:"eltern-vital-fit",messageText,conversationMode:"natural"
});
test("verified trial facts cannot mute real privacy/payment disputes or cost model calls",async t=>{
 const oldFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async url=>{
   assert.equal(String(url),"https://api.openai.com/v1/responses");
   calls++;
   return new Response(JSON.stringify({usage:{input_tokens:100,output_tokens:20},
    output:[{content:[{type:"output_text",text:JSON.stringify({
     reply:"Bitte lies die Vertragsbedingungen in Ruhe.",needsHuman:false,nextStep:"none",evidenceQuote:""
    })}]}]}),{status:200});
 };
 writeSettings({aiEnabled:true});
 t.after(()=>{globalThis.fetch=oldFetch;clearConversationStore();fs.rmSync(dir,{recursive:true,force:true});});
 await t.test("trial request and factual follow-up use trusted offer, no provider or invented conditions",async()=>{
  const before=calls;
  const first=await send("trial-info","Kann ich die Zusammenarbeit ein paar Wochen testen?");
  assert.equal(first.state.owner,"ai");
  assert.equal(first.state.answers.peteReplySource,"verified_transaction");
  assert.match(first.text??"",/nicht verbindlich zugesagt|nicht verbindlich bestätigt/i);
  assert.ok(first.text?.includes(OFFER_TRUTH.coachingEntry.infoUrl));
  const second=await send("trial-info","Ich will keine frei erfundenen Vertragsbedingungen. Was steht denn fest?");
  assert.equal(second.state.owner,"ai");
  assert.equal(second.state.answers.peteReplySource,"verified_transaction");
  assert.match(second.text??"",/nicht verbindlich zugesagt|nicht verbindlich bestätigt/i);
  assert.ok(second.text?.includes(OFFER_TRUTH.coachingEntry.infoUrl));
  assert.equal(calls,before);
 });
 for(const [i,text] of [
  "Ich will widerrufen.",
  "Ich möchte meinen Vertrag kündigen.",
  "Bitte lösche meine personenbezogenen Daten.",
  "Mein Anwalt prüft die Haftung.",
  "Meine Zahlung ist abgebucht und ich will eine Rückzahlung."
 ].entries()) await t.test("trial context cannot override safety: "+text,async()=>{
   const before=calls,id="trial-sensitive-"+i;
   const first=await send(id,"Kann ich die Zusammenarbeit ein paar Wochen testen?");
   assert.equal(first.state.owner,"ai");
   const second=await send(id,"Was steht denn fest? "+text);
   assert.equal(second.state.owner,"human");
   assert.equal(second.state.aiPaused,true);
   assert.equal(second.state.answers.peteReplySource,"guarded_safety");
   const after=await send(id,"Gibt es trotzdem die Anleitung?");
   assert.equal(after.text,null);
   assert.equal(after.state.owner,"human");
   assert.equal(calls,before,"trial and safety must cost no provider calls");
 });
});