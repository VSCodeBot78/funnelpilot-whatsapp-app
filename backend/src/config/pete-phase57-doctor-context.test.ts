import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pete-phase57-"));
process.env.NODE_ENV="test";
process.env.DATA_DIR=dir;
process.env.PETE_LLM_CONVERSATION_ENABLED="false";
process.env.PETE_LLM_API_CALLS_APPROVED="false";
process.env.INSTAGRAM_SEND_ENABLED="false";
process.env.WHATSAPP_SEND_ENABLED="false";
delete process.env.OPENAI_API_KEY;
const {DEFAULT_CAMPAIGN_ID}=await import("./campaigns.js");
const {processIncomingMessage}=await import("../core/conversation-engine.js");
const {clearConversationStore}=await import("../data/store.js");
const {writeSettings}=await import("../services/settings-store.js");
const {isGeneralNonMedicalKnowledgeRequest}=await import("../core/pete-conversation-quality.js");
const send=(leadId:string,messageText:string)=>processIncomingMessage({
 leadId,campaignId:DEFAULT_CAMPAIGN_ID,messageText,conversationMode:"natural",
});
const mock=(reply:string)=>new Response(JSON.stringify({
 output:[{content:[{type:"output_text",
 text:JSON.stringify({reply,needsHuman:false})}]}],
 usage:{input_tokens:300,output_tokens:70},
}),{status:200});
test("Phase57: historical doctor check and declined remote diagnosis retain safe context",async t=>{
 const originalFetch=globalThis.fetch;
 t.after(()=>{
  globalThis.fetch=originalFetch;
  process.env.PETE_LLM_CONVERSATION_ENABLED="false";
  process.env.PETE_LLM_API_CALLS_APPROVED="false";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  clearConversationStore();
  fs.rmSync(dir,{force:true,recursive:true});
 });
 await t.test("previously reviewed values and no diagnostic request is general",async()=>{
  assert.equal(isGeneralNonMedicalKnowledgeRequest(
   "Ich möchte keine Ferndiagnose. Meine Werte wurden beim Arzt schon überprüft."),true);
  assert.equal(isGeneralNonMedicalKnowledgeRequest(
   "Meine Blutwerte wurden bereits ärztlich geprüft."),true);
  assert.equal(isGeneralNonMedicalKnowledgeRequest(
   "Was bedeuten meine Werte? Der Arzt hat sie schon untersucht."),false);
 });
 await t.test("real prior context stays active with mocked safe medical boundaries",async()=>{
  clearConversationStore();
  process.env.PETE_LLM_CONVERSATION_ENABLED="true";
  process.env.PETE_LLM_API_CALLS_APPROVED="true";
  process.env.OPENAI_API_KEY="mock-only";
  process.env.OPENAI_MODEL="gpt-4.1-mini";
  writeSettings({aiEnabled:true});
  let calls=0;
  globalThis.fetch=async()=>{
   calls++;
   return mock(calls===1
    ? "Du trainierst bereits regelmäßig. Für eine allgemeine Einordnung sind Schlaf, Energiebilanz und Alltagsbewegung hilfreiche Prüfpunkte."
    : "Verstanden, du möchtest keine Ferndiagnose. Dass deine Werte bereits geprüft wurden, ist wichtig; hier geht es um die allgemeine Umsetzung im Alltag.");
  };
  const id="phase57-history";
  const first=await send(id,"Meine letzte Schwangerschaft ist über zwei Jahre her. Ich trainiere zweimal pro Woche schwer und die Waage steht still.");
  assert.equal(first.state.answers.peteReplySource,"llm");
  const next=await send(id,"Ich möchte keine Ferndiagnose. Meine Werte wurden beim Arzt schon überprüft.");
  assert.equal(next.state.answers.peteReplySource,"llm");
  assert.equal(next.state.owner,"ai");
  assert.equal(next.state.aiPaused,false);
  assert.equal(calls,2);
 });
 await t.test("active symptoms and medication changes remain blocked even if doctor reviewed values",async()=>{
  for(const input of [
   "Meine Werte wurden beim Arzt schon überprüft, aber ich habe jetzt Brustschmerzen und Atemnot.",
   "Mein Arzt hat die Werte schon überprüft, wie ändere ich meine Insulindosis?",
   "Meine Werte wurden überprüft. Ich bin schwanger und möchte Keto versuchen.",
  ]) assert.equal(isGeneralNonMedicalKnowledgeRequest(input),false,input);
  clearConversationStore();
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error("No risky calls")};
  const blocked=await send("phase57-acute",
   "Meine Werte wurden beim Arzt schon überprüft, aber jetzt habe ich Brustschmerzen und Atemnot.");
  assert.equal(blocked.state.owner,"human");
  assert.equal(blocked.state.aiPaused,true);
  assert.equal(calls,0);
 });
 await t.test("acute Brustschmerzen alone override negated diagnosis and reviewed values",async()=>{
  assert.equal(isGeneralNonMedicalKnowledgeRequest(
   "Keine Ferndiagnose. Meine Werte wurden beim Arzt überprüft, jetzt habe ich Brustschmerzen."),false);
  assert.equal(isGeneralNonMedicalKnowledgeRequest(
   "Keine Ferndiagnose. Meine Werte wurden beim Arzt überprüft, jetzt habe ich Herzschmerzen."),false);
 });
 await t.test("a guard reply is never miscounted as the previous AI model reply",async()=>{
  clearConversationStore();
  process.env.PETE_LLM_CONVERSATION_ENABLED="true";
  process.env.PETE_LLM_API_CALLS_APPROVED="true";
  process.env.OPENAI_API_KEY="mock-only";
  process.env.OPENAI_MODEL="gpt-4.1-mini";
  writeSettings({aiEnabled:true});
  let calls=0;
  globalThis.fetch=async()=>{calls++;return mock("Allgemein helfen Schlaf und Bewegung, ohne eine Diagnose zu stellen.");};
  const lead="phase58-source";
  const first=await send(lead,"Ich möchte wieder mehr Energie, aber arbeite viel.");
  assert.equal(first.state.answers.peteReplySource,"llm");
  const urgent=await send(lead,"Ich habe Brustschmerzen beim Training.");
  assert.equal(urgent.state.owner,"human");
  assert.equal(urgent.state.answers.peteReplySource,"guarded_safety");
  assert.equal(urgent.state.aiPaused,true);
  assert.equal(calls,1);
 });

});