import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import test from "node:test";
process.env.NODE_ENV="test";
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),"pete-pl19-sol10-repair-"));
process.env.PETE_LLM_CONVERSATION_ENABLED="true";
process.env.PETE_LLM_API_CALLS_APPROVED="false";
process.env.INSTAGRAM_ENGINE_ENABLED="false";
process.env.INSTAGRAM_SEND_ENABLED="false";
process.env.WHATSAPP_SEND_ENABLED="false";
delete process.env.OPENAI_API_KEY;
const {processIncomingMessage}=await import("../core/conversation-engine.js");
const {DEFAULT_CAMPAIGN_ID}=await import("./campaigns.js");
const say=async(id:string,text:string)=>processIncomingMessage({leadId:id,campaignId:DEFAULT_CAMPAIGN_ID,messageText:text,conversationMode:"natural"});
test("Sol10 V1: cheaper personal offer question answers real price",async()=>{
 const r=await say("sol10-v1","Was kostet die kleine Variante genau, und was bekomme ich dafür?");
 assert.match(r.text??"",/99/);
 assert.ok((r.text??"").includes("no-bullshit-elternfitness_app-starter"));
 assert.notEqual(r.state.owner,"human");
});
test("Sol10 V3: direct question how to book Jochen is NOT silent human handoff",async()=>{
 const r=await say("sol10-v3","Kann ich persönlich mit Jochen sprechen, und wie buche ich das?");
 assert.ok((r.text??"").includes("calendly.com"));
 assert.notEqual(r.state.owner,"human");
 assert.notEqual(r.state.providerBooking?.status,"booked");
});
test("Sol10 V8: call without purchase duty answers without a handoff",async()=>{
 const r=await say("sol10-v8","Geht das erste Gespräch auch ohne Kaufpflicht?");
 assert.match(r.text??"",/ohne Kaufpflicht/);
 assert.notEqual(r.state.owner,"human");
});
test("Sol10 V9: free check after explicit no paid offer still delivers trusted link",async()=>{
 const id="sol10-v9";
 await say(id,"Moment, ich will gar nichts kaufen. Weder 99 noch 499. Hör auf mit Angeboten.");
 const r=await say(id,"Ich interessiere mich nur für einen kostenlosen Fitness-Check. Gibt es den ohne Kauf?");
 assert.ok((r.text??"").includes("check.jochen-kammerer.de"));
 assert.notEqual(r.state.owner,"human");
});
test("Sol10 V10: free check link despite no purchase wish",async()=>{
 const r=await say("sol10-v10","Ich möchte erst mal nur einen kostenlosen Check-Link und überlegen.");
 assert.ok((r.text??"").includes("check.jochen-kammerer.de"));
});
test("Sol10 V6: low-grade knee discomfort gets cautious response rather than silent handoff",async()=>{
 const r=await say("sol10-v6","Seit Wochen zwickt mein Knie beim Treppensteigen, und ich will trotzdem wieder mit Sport anfangen.");
 assert.match(r.text??"",/Knie/);
 assert.notEqual(r.state.owner,"human");
 assert.doesNotMatch(r.text??"",/Kniebeugen sind sicher|medizinische Freigabe/);
});
test("Sol10 guard: direct chat takeover remains human",async()=>{
 const r=await say("sol10-hum","Jochen soll bitte diesen Chat persönlich übernehmen.");
 assert.equal(r.state.owner,"human");assert.equal(r.text,null);
});
test("Sol10 guard: STOP remains absolute",async()=>{
 const id="sol10-stop";await say(id,"Bitte schreib mir keine weiteren Nachrichten.");
 const r=await say(id,"Wie teuer ist jetzt das Coaching?");
 assert.equal(r.text,null);assert.equal(r.state.flags.stopped,true);
});
test("Sol10 guard: severe acute medical concern precedes cheap offers",async()=>{
 const r=await say("sol10-med","Starke Brustschmerzen mit Atemnot, wie viel kostet die kleine Begleitung?");
 assert.ok(!(r.text??"").includes("no-bullshit-elternfitness_app-starter"));
});
test("Sol10 guard: payment conflict cannot become a sales reply",async()=>{
 const r=await say("sol10-payment","Mir wurde der Selbststarter doppelt abgebucht. Gib mir den App-Starter Link.");
 assert.equal(r.state.owner,"human");
 assert.ok(!(r.text??"").includes("no-bullshit-elternfitness_app-starter"));
});
test("Sol10 guard: refusing an appointment does not create booking consent",async()=>{
 const r=await say("sol10-no-book","Ich will keinen Termin buchen, keinen Calendly-Link.");
 assert.notEqual(r.state.providerBooking?.status,"booked");
 assert.ok(!(r.text??"").includes("calendly.com"));
});
