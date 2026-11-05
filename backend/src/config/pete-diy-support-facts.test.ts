import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fp-diy-support-"));
Object.assign(process.env,{
 NODE_ENV:"test",DATA_DIR:dir,INSTAGRAM_ENGINE_ENABLED:"false",
 INSTAGRAM_SEND_ENABLED:"false",WHATSAPP_SEND_ENABLED:"false",
 PETE_LLM_CONVERSATION_ENABLED:"true",PETE_LLM_API_CALLS_APPROVED:"true",
 OPENAI_MODEL:"gpt-6.1-sol",OPENAI_API_KEY:"SYNTHETIC-NEVER-NETWORK"
});
const {processIncomingMessage}=await import("../core/conversation-engine.js");
const {writeSettings}=await import("../services/settings-store.js");
const {clearConversationStore}=await import("../data/store.js");
const send=(id:string,messageText:string)=>processIncomingMessage({
 leadId:id,campaignId:"eltern-vital-fit",messageText,conversationMode:"natural"
});
test("DIY chat-support uncertainty is a factual reply, not a model sale or takeover",async t=>{
 const old=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async url=>{
  assert.equal(String(url),"https://api.openai.com/v1/responses");calls++;
  return new Response(JSON.stringify({usage:{input_tokens:100,output_tokens:20},
   output:[{content:[{type:"output_text",text:JSON.stringify({
    reply:"Das kann ich nur allgemein beantworten.",needsHuman:false,nextStep:"none",evidenceQuote:""
   })}]}]}),{status:200});
 };
 writeSettings({aiEnabled:true});
 t.after(()=>{globalThis.fetch=old;clearConversationStore();fs.rmSync(dir,{recursive:true,force:true});});
 for(const [i,message]of [
  "Beim Selbststarter für 14,95 Euro, gibt es persönlichen Chat-Support dazu?",
  "Ist beim DIY Chat-Support enthalten?"
 ].entries()) await t.test("product facts: "+message,async()=>{
  const before=calls,id="diy-support-"+i;
  const out=await send(id,message);
  assert.equal(out.state.owner,"ai");
  assert.equal(out.state.flags.peteRuntimeHandoffActive===true,false);
  assert.equal(out.state.answers.peteReplySource,"verified_transaction");
  assert.match(out.text??"",/nicht verbindlich best[aä]tigt/i);
  assert.equal(calls,before);
  const next=await send(id,"Danke, ich überlege mir das.");
  assert.equal(next.state.owner,"ai");
 });
 await t.test("actual double charge still takes priority over FAQ",async()=>{
  const before=calls;
  const out=await send("diy-support-charge","Beim Selbststarter ist Chat-Support enthalten? Meine Zahlung wurde doppelt abgebucht.");
  assert.equal(out.state.owner,"human");
  assert.equal(out.state.aiPaused,true);
  assert.equal(calls,before);
 });
});