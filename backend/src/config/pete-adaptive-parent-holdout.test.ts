import assert from "node:assert/strict";
import test from "node:test";
import { chooseAdaptiveParentFollowUp } from "./pete-adaptive-parent-holdout.js";
import { runQaDialogues, validateQaCases, type QaBudget } from "./pete-repeatable-qa-evidence.js";
const entry = { id: "F15-07-consultation-voluntary", lines: [
  "Ich möchte erst die Methode sehen.", "Brauche ich dafür zwingend einen Call?"
], adaptiveTurns: 5 };
test("blind follow-ups depend on Pete's actual previous reply", () => {
 const base = [{reply:"Okay",user:"x"}];
 const q = chooseAdaptiveParentFollowUp(entry, [...base,{reply:"Wäre dir ein Call lieber?"}]);
 const link = chooseAdaptiveParentFollowUp(entry,[...base,{reply:"Schau hier: https://example.invalid/"}]);
 const direct = chooseAdaptiveParentFollowUp(entry,[...base,{reply:"Nein, ein Call ist nicht notwendig."}]);
 assert.notEqual(q,link);assert.notEqual(link,direct);assert.match(q,/Buchung/);
});
test("adaptive holdout preserves the real engine transcript and bounds turn count",async()=>{
 const e={...entry,adaptiveTurns:4};
 validateQaCases([e]);
 let n=0;const b=():QaBudget=>({ok:true,blocked:false,requestsStarted:0,requestsMetered:0,inputTokens:0,outputTokens:0});
 const r=await runQaDialogues({cases:[e],budget:b,
  reply:async(id,message)=>{n++;return{text:n===2?"Was meinst du genau?":"Nein, keine Pflicht.",state:{answers:{peteReplySource:"verified_transaction"},flags:{stopped:false}}};},
  nextAdaptiveUser:chooseAdaptiveParentFollowUp
 });
 assert.equal(n,4);assert.equal(r.totalCompleted,1);assert.equal(r.cases[0].plannedLeadTurns,4);
 assert.match(String(r.cases[0].turns[2].user),/Buchung/);
});
test("no adaptive free text means fail-closed, not silent fixed replies",async()=>{
 const bad={...entry,adaptiveTurns:5};let calls=0;
 const r=await runQaDialogues({cases:[bad],budget:()=>({ok:true}),reply:async()=>{
  calls++;return{text:"Okay",state:{answers:{},flags:{stopped:false}}};
 }});
 assert.equal(calls,2);assert.equal(r.totalCompleted,0);
 assert.equal(r.haltedReason,"adaptive_lead_invalid");
});
test("adaptive data cannot exceed bounded QA turns",()=>assert.throws(()=>validateQaCases([{...entry,adaptiveTurns:13}])));
