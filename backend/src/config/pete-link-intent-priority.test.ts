import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-link-intent-"));
Object.assign(process.env, {
 NODE_ENV: "test", DATA_DIR: dataDir,
 INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
 WHATSAPP_SEND_ENABLED: "false", PETE_LLM_CONVERSATION_ENABLED: "true",
 PETE_LLM_API_CALLS_APPROVED: "true", OPENAI_MODEL: "gpt-6.1-sol",
 OPENAI_API_KEY: "SYNTHETIC-LOCAL-ONLY-NEVER-NETWORK",
});
const {processIncomingMessage} = await import("../core/conversation-engine.js");
const {writeSettings} = await import("../services/settings-store.js");
const {clearConversationStore} = await import("../data/store.js");
const {OFFER_TRUTH} = await import("./offer-truth.js");
const send=(id:string, messageText:string)=>processIncomingMessage({
  leadId:id,campaignId:"eltern-vital-fit",messageText,conversationMode:"natural"
});
test("lead-initiated link intent is verified without implied booking or live sending",async t=>{
 const originalFetch=globalThis.fetch;
 let providerCalls=0;
 globalThis.fetch=async url=>{
   assert.equal(String(url),"https://api.openai.com/v1/responses");
   providerCalls++;
   return new Response(JSON.stringify({usage:{input_tokens:100,output_tokens:20},
     output:[{content:[{type:"output_text",text:JSON.stringify({
       reply:"Ich beantworte das sachlich.",needsHuman:false,nextStep:"none",evidenceQuote:""
     })}]}]}),{status:200});
 };
 writeSettings({aiEnabled:true});
 t.after(()=>{globalThis.fetch=originalFetch;clearConversationStore();
   fs.rmSync(dataDir,{recursive:true,force:true});});
 const cases=[
  {id:"calendar-passive",input:"Wo ist der Terminkalender?",type:"passive"},
  {id:"calendar-view",input:"Kann ich den Kalender erst unverbindlich ansehen?",type:"passive"},
  {id:"calendar-call-link",input:"Schick mir bitte den Link für ein Strategiegespräch",type:"passive"},
  {id:"calendar-personal-link",input:"Kannst du mir den Link zu einem persönlichen Gespräch schicken?",type:"passive"},
  {id:"calendar-pick-time",input:"Ja, gerne. Schick mir bitte den Link, damit ich mir einen Termin für das Strategiegespräch aussuchen kann.",type:"passive"},
  {id:"calendar-direct",input:"Ich möchte direkt einen Telefontermin buchen. Wo finde ich den Buchungslink?",type:"active"},
  {id:"info-method",input:"Bitte zeig mir die Methode zum Nachlesen.",type:"info"},
  {id:"info-package",input:"Ich möchte das Paket erst in Ruhe ansehen.",type:"info"},
 ] as const;
 for(const c of cases) await t.test(c.id,async()=>{
  const before=providerCalls;
  const out=await send("link-"+c.id,c.input);
  assert.equal(providerCalls,before,"verified link intent must not call a model");
  assert.equal(out.state.owner,"ai");
  assert.equal(out.state.answers.peteReplySource,"verified_transaction");
  assert.equal(out.state.flags.stopped,false);
  if(c.type==="info"){
   assert.ok(out.text?.includes(OFFER_TRUTH.coachingEntry.infoUrl));
   assert.equal(out.state.flags.wantsBooking,false);
   assert.notEqual(out.state.providerBooking?.status,"awaiting_booking");
  } else {
   assert.match(out.text??"",/https:\/\/calendly\.com/);
   assert.doesNotMatch(out.text??"",/ist (?:schon|bereits) gebucht|buchung ist bestatigt/i);
   assert.equal(out.state.flags.wantsBooking,c.type==="active");
   if(c.type==="active") assert.equal(out.state.providerBooking?.status,"awaiting_booking");
   else assert.equal(out.state.providerBooking?.status,"inactive");
  }
 });
 for(const c of [
   {id:"foreign",input:"Schick mir bitte den Kalender für die Schule."},
   {id:"negative",input:"Schick mir nicht den Kalenderlink."},
 ]) await t.test(c.id,async()=>{
  const out=await send("link-"+c.id,c.input);
  assert.doesNotMatch(out.text??"",/https:\/\/calendly\.com/);
  assert.equal(out.state.flags.wantsBooking,false);
 });
 await t.test("Selfstarter without mandatory call remains a direct product purchase",async()=>{
   const before=providerCalls;
   const leadId="link-direct-starter";
   const first=await send(leadId,"Ich möchte den Selbststarter selbst kaufen, ohne Strategiegespräch.");
   assert.ok(first.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
   const second=await send(leadId,"Kann ich über den Link direkt kaufen, ohne Pflichttermin?");
   assert.ok(second.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
   assert.equal(second.state.owner,"ai");
   assert.equal(second.state.flags.wantsBooking,false);
   assert.equal(providerCalls,before);
 });
 await t.test("cancellation is not a fresh booking",async()=>{
   const before=providerCalls;
   const out=await send("link-cancellation","Ich möchte meinen Termin absagen. Wo ist der Kalenderlink?");
   assert.equal(providerCalls,before);
   assert.equal(out.state.owner,"human");
   assert.equal(out.state.aiPaused,true);
   assert.equal(out.state.flags.wantsBooking,false);
   assert.notEqual(out.state.providerBooking?.status,"booked");
   assert.doesNotMatch(out.text??"",/https:\/\/calendly\.com/);
 });
 await t.test("double payment report overrides a simultaneous information-link request",async()=>{
   const before=providerCalls;
   const out=await send("link-payment-incident","Ich wurde doppelt abgebucht. Kann ich das Paket anschauen?");
   assert.equal(providerCalls,before);
   assert.equal(out.state.owner,"human");
   assert.equal(out.state.aiPaused,true);
   assert.equal(out.state.flags.wantsBooking,false);
   assert.doesNotMatch(out.text??"",/https?:\/\//);
   assert.equal(out.state.answers.peteReplySource,"verified_transaction");
 });
 await t.test("negated human request does not transfer ownership",async()=>{
   const out=await send("link-no-human","Jochen soll den Chat nicht übernehmen. Bitte zeig mir die Methode.");
   assert.equal(out.state.owner,"ai");
   assert.equal(out.state.aiPaused,false);
 });
 await t.test("explicit human priority over calendar request",async()=>{
   const before=providerCalls;
   const out=await send("link-human","Jochen soll den Chat persönlich übernehmen. Wo ist der Kalenderlink?");
   assert.equal(providerCalls,before);
   assert.equal(out.state.owner,"human");
   assert.equal(out.state.aiPaused,true);
   assert.doesNotMatch(out.text??"",/https:\/\/calendly\.com/);
 });
});