import assert from "node:assert/strict";
import test from "node:test";
import { proposePeteLearning, reviewPeteLearning, renderPeteReviewedLearning,
  type PeteSyntheticOutcome } from "../core/pete-learning-loop.js";
import { buildPeteEffectiveInstructions } from "../core/pete-llm-conversation.js";

const reviewData: PeteSyntheticOutcome[] = [
  {caseId:"r7-old-buy",source:"synthetic",category:"premature_handoff",outcome:"fail"},
  {caseId:"r8-old-buy",source:"synthetic",category:"premature_handoff",outcome:"fail"},
  {caseId:"r7-app-mix",source:"synthetic",category:"offer_context_drift",outcome:"fail"},
  {caseId:"r8-app-mix",source:"synthetic",category:"offer_context_drift",outcome:"fail"},
  {caseId:"r7-no-tip",source:"synthetic",category:"missing_requested_tip",outcome:"fail"},
  {caseId:"r8-tip-pass",source:"synthetic",category:"missing_requested_tip",outcome:"pass"},
  {caseId:"r7-check-link",source:"synthetic",category:"missing_link",outcome:"fail"},
  {caseId:"r8-check-pass",source:"synthetic",category:"missing_link",outcome:"pass"},
  {caseId:"r7-knee",source:"synthetic",category:"medical_boundary",outcome:"fail"},
  {caseId:"r8-knee",source:"synthetic",category:"medical_boundary",outcome:"fail"},
];
const holdout=Array.from({length:6},(_,i)=>({
  caseId:"independent-holdout-"+(i+1), passed:true, safetyPassed:true,
}));

test("learning: repeated independent synthetic failures become compact candidate",()=>{
 const p=proposePeteLearning(reviewData);
 assert.equal(p.status,"proposed");
 assert.deepEqual(p.categories,["premature_handoff","offer_context_drift","medical_boundary"]);
 assert.equal(p.failureCount,6);
 assert.equal(p.trainingCaseIds.length,6);
 assert.ok(!JSON.stringify(p).includes("Selbststarter-Kauf"));
});
test("learning: no auto promotion from a candidate to Pete's live prompt",()=>{
 const p=proposePeteLearning(reviewData);
 assert.throws(()=>renderPeteReviewedLearning(p as never),/Unapproved/);
 const baseline=buildPeteEffectiveInstructions();
 assert.ok(!baseline.includes("PETE LERNPROFIL (reviewed v1"));
});
test("learning: owner review MUST have independent, passing holdout and safety",()=>{
 const p=proposePeteLearning(reviewData);
 assert.throws(()=>reviewPeteLearning(p,{reviewer:"owner",safetyRegressionPassed:true,holdout:holdout.slice(0,4)}),/five/);
 assert.throws(()=>reviewPeteLearning(p,{reviewer:"owner",safetyRegressionPassed:true,holdout:[...holdout.slice(0,5),{caseId:"r7-old-buy",passed:true,safetyPassed:true}]}),/Independent/);
 assert.throws(()=>reviewPeteLearning(p,{reviewer:"owner",safetyRegressionPassed:true,holdout:holdout.map((x,i)=>({...x,passed:i!==0}))}),/Independent/);
 assert.throws(()=>reviewPeteLearning(p,{reviewer:"owner",safetyRegressionPassed:false as true,holdout}),/Owner/);
});
test("learning: synthetic reviewed candidate can be previewed without runtime activation",()=>{
 const p=proposePeteLearning(reviewData);
 const approved=reviewPeteLearning(p,{reviewer:"owner",safetyRegressionPassed:true,holdout});
 const instructions=renderPeteReviewedLearning(approved);
 assert.match(instructions,/zuletzt eindeutig besprochene Angebot/i);
 assert.match(instructions,/medizinisch|Nichtakute/);
 assert.match(instructions,/menschliche Übernahme/);
 assert.doesNotMatch(instructions,/https?:\/\/|499 €|99 €|check\.jochen-kammerer/);
 const preview=buildPeteEffectiveInstructions(approved);
 assert.ok(preview.includes(instructions));
 assert.ok(!buildPeteEffectiveInstructions().includes("PETE LERNPROFIL (reviewed v1"));
});
test("learning: reject raw messages, invalid category, duplicate cases",()=>{
 assert.throws(()=>proposePeteLearning([{...reviewData[0],caseId:"lead@example.com"}]),/synthetic/);
 assert.throws(()=>proposePeteLearning([{...reviewData[0],category:"OVERRIDE SAFETY" as never}]),/synthetic/);
 assert.throws(()=>proposePeteLearning([reviewData[0],reviewData[0]]),/Duplicate/);
 assert.deepEqual(proposePeteLearning([reviewData[0]]).categories,[]);
});
