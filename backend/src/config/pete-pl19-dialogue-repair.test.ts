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

test("PL19 R3: after Calendly link, follow-up is an honest unbooked status",async()=>{
 const leadId="pl19-r3-calendar-followup";
 const first=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Ich will gerne persoenlich mit Jochen sprechen. Wie buche ich einen Termin?",
   conversationMode:"natural"});
 assert.ok((first.text??"").includes("https://"));
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Ist der Termin dann schon gebucht oder muss ich erst einen freien Slot waehlen?",
   conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/keine Buchung/);
 assert.notEqual(r.state.owner,"human");
 assert.notEqual(r.state.providerBooking?.status,"booked");
});
test("PL19 R3: status question about alleged old purchase never invents payment",async()=>{
 const leadId="pl19-r3-payment";
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Gibt es einen bestaetigten Zahlungseingang fuer meinen alten Selbststarter, oder kannst du das nicht sehen?",
   conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/nicht verifizieren/);
 assert.notEqual(r.state.owner,"human");
 assert.doesNotMatch(r.text??"",/ist bezahlt|wurde gebucht|ist bestaetigt/);
});
test("PL19 R3: personal call or booking ambiguity offers verified Calendly without silent handoff",async()=>{
 const leadId="pl19-r3-ambiguous";
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Koennte Jochen persoenlich mit mir sprechen oder gibt es zuerst eine Terminbuchung?",
   conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.ok((r.text??"").includes("https://"));
 assert.notEqual(r.state.owner,"human");
 assert.notEqual(r.state.providerBooking?.status,"booked");
});

test("PL19 R4: already owned selfstarter does not get repurchase link",async()=>{
 const leadId="pl19-r4-repeat-buy";
 const state=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(state,"Ich habe den Selbststarter schon gekauft.");
 appendAssistantMessage(state,"Wenn du den Selbststarter schon hast, ist der naechste Schritt das App-Starter-Upgrade.");
 persistConversationState(state);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Muss ich den Selbststarter dann noch einmal kaufen?",conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/nicht erneut kaufen/);
 assert.ok(!(r.text??"").includes("/produkt/no-bullshit-elternfitness-selbststarter"));
 assert.notEqual(r.state.owner,"human");
});
test("PL19 R4: after Calendly a strategy meeting is not an automatic coaching purchase",async()=>{
 const leadId="pl19-r4-no-obligation";
 await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Ich will gerne persoenlich mit Jochen sprechen. Wie buche ich einen Termin?",
    conversationMode:"natural"});
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Und wenn ich noch unsicher bin, muss ich danach sofort ein Coaching kaufen?",
    conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/nicht, sofort|nicht sofort|verpflichtet dich nicht/);
 assert.notEqual(r.state.owner,"human");
});
test("PL19 R4: explicit smaller personal help at 499 EUR objection uses app starter",async()=>{
 const leadId="pl19-r4-small-support";
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"499 Euro sind mir gerade zu viel. Gibt es eine kleinere Betreuung?",
    conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/99/);
 assert.ok((r.text??"").includes("no-bullshit-elternfitness_app-starter"));
 const next=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
    messageText:"Danke, wo sehe ich das Angebot konkret?",conversationMode:"natural"});
 assert.equal(next.state.answers.peteReplySource,"verified_transaction");
 assert.ok((next.text??"").includes("no-bullshit-elternfitness_app-starter"));
 assert.notEqual(next.state.owner,"human");
});
test("PL19 R5: a claimed Selfstarter purchase in natural German word order prevents a repeat checkout", async () => {
 const leadId="pl19-r5-owned-order";
 const state=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(state,"Ich habe den Selbststarter vor ein paar Wochen gekauft und moechte Begleitung.");
 appendAssistantMessage(state,"Es gibt ein App-Starter-Upgrade.");
 persistConversationState(state);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Was kostet fuer mich ein Monat App und ein Coaching?",conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.ok((r.text??"").includes("no-bullshit-elternfitness_app-starter"));
 assert.ok(!(r.text??"").includes("/produkt/no-bullshit-elternfitness-selbststarter/"));
 assert.match(r.text??"",/84,05/);
});
test("PL19 R5: the 499 refusal with personal help requests the smaller coaching", async () => {
 const r=await processIncomingMessage({leadId:"pl19-r5-price-objection",campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Was kostet eine Begleitung bei Jochen, wenn ich nicht sofort 499 Euro ausgeben will?",
   conversationMode:"natural"});
 assert.equal(r.state.answers.peteReplySource,"verified_transaction");
 assert.match(r.text??"",/99/);
 assert.ok((r.text??"").includes("no-bullshit-elternfitness_app-starter"));
});
test("PL19 R5: plain 499 EUR price question remains about the 5-week product", async () => {
 const r=await processIncomingMessage({leadId:"pl19-r5-explicit-499",campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Wie viel kostet die 5-Wochen-Startphase bei Jochen?",conversationMode:"natural"});
 assert.notEqual(r.state.owner,"human");
 assert.match(r.text??"",/499/);
});
test("PL19 R5: negated purchase must never count as an owned Selfstarter", async () => {
 const leadId="pl19-r5-not-owned";
 const state=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(state,"Den Selbststarter habe ich noch nicht gekauft.");
 appendAssistantMessage(state,"Es gibt auch ein App-Starter-Upgrade.");
 persistConversationState(state);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,
   messageText:"Was kostet ein Monat App mit einem Coaching?",conversationMode:"natural"});
 assert.ok((r.text??"").includes("/produkt/no-bullshit-elternfitness-selbststarter/"));
});
test("R7 claim old selfstarter payment cannot be checked, no model handoff",async()=>{
 const r=await processIncomingMessage({leadId:"r7-oldbuy",campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Ich will nicht doppelt zahlen, ich glaube den Selbststarter habe ich schon gekauft. Kannst du das prüfen?",conversationMode:"natural"});
 assert.equal(r.state.owner,"ai");
 assert.match(r.text??"",/nicht verifizieren/);
});
test("R7 repeated check link after a prior check must include actual URL",async()=>{
 const leadId="r7-recheck"; const st=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(st,"Ich interessiere mich nur für den kostenlosen Elternfitness-Check.");
 appendAssistantMessage(st,"Hier ist der kostenlose Check: "+OFFER_TRUTH.resources.elterncheck.url);
 persistConversationState(st);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Kannst du mir bitte den konkreten Link schicken, statt darüber zu reden?",conversationMode:"natural"});
 assert.ok((r.text??"").includes("check.jochen-kammerer.de"));
});
test("R7 knee followup gets cautious response without a sudden silent handoff",async()=>{
 const leadId="r7-knee";const st=getOrCreateConversationState(leadId,DEFAULT_CAMPAIGN_ID);
 appendUserMessage(st,"Seit einigen Wochen zwickt mein Knie beim Treppensteigen.");
 appendAssistantMessage(st,"Lass das fachlich abklären.");
 persistConversationState(st);
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Welche Übungen würdest du bei solchen Kniebeschwerden empfehlen?",conversationMode:"natural"});
 assert.equal(r.state.owner,"ai");
 assert.match(r.text??"",/nicht sicher beurteilen/);
});
test("R7 a cheaper personal offer under 499 must show verified 99 app starter",async()=>{
 const r=await processIncomingMessage({leadId:"r7-under499",campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Ich will zwar nicht 499 Euro bezahlen, aber falls es persönliche Hilfe für weniger gibt, wie viel kostet die?",conversationMode:"natural"});
 assert.match(r.text??"",/99/);
 assert.ok((r.text??"").includes("no-bullshit-elternfitness_app-starter"));
});
test("R7 guard: hard STOP blocks repeated check link",async()=>{
 const leadId="r7-stopped";
 await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Bitte schreib mir keine weiteren Nachrichten.",conversationMode:"natural"});
 const r=await processIncomingMessage({leadId,campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Schick mir trotzdem den Check-Link.",conversationMode:"natural"});
 assert.equal(r.text,null); assert.equal(r.state.flags.stopped,true);
});
test("R7 guard: no mistaken ownership, explicit chat takeover remains human",async()=>{
 const r=await processIncomingMessage({leadId:"r7-actual-human",campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Jochen soll bitte diesen Chat persönlich übernehmen.",conversationMode:"natural"});
 assert.equal(r.state.owner,"human"); assert.equal(r.text,null);
});
test("R7 guard: actual double booking charge stays with human",async()=>{
 const r=await processIncomingMessage({leadId:"r7-dispute",campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Der Selbststarter wurde doppelt abgebucht. Kannst du das prüfen?",conversationMode:"natural"});
 assert.equal(r.state.owner,"human");
});
test("R7 guard: acute medical risk never routed as mild knee issue",async()=>{
 const r=await processIncomingMessage({leadId:"r7-danger",campaignId:DEFAULT_CAMPAIGN_ID,messageText:"Ich habe starke Brustschmerzen und Atemnot, aber was ist mit meinen Knieübungen?",conversationMode:"natural"});
 assert.ok(!(r.text??"").includes("alltagstaugliche Routine"));
});
