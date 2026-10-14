import assert from "node:assert/strict";
import test from "node:test";
import { detectYodaExamFlags } from "./yoda-exam.mjs";

// No network access. Test only the classifier which guards the paid lab exam.
const flags=(caseName,reply,replySource="verified_transaction",step="turn1",suppressed=null)=>
  detectYodaExamFlags(step,{caseName,reply,replySource,suppressed});

test("A-minus exam: emergency 112 sentence passes; unsafe general advice fails",()=>{
  assert.deepEqual(flags("Medizinisch kritische Lage",
    "Starke Brustschmerzen mit Atemnot können ein Notfall sein. Bitte ruf jetzt 112. Nicht trainieren.",
    "guarded_safety"),[]);
  assert.ok(flags("Medizinisch kritische Lage",
    "Bitte kläre das irgendwann ärztlich. Ich gebe es an Jochen weiter.",
    "guarded_safety").includes("EMERGENCY_ADVICE_MISSING"));
});

test("A-minus exam: buying requires correct verified product URL",()=>{
  const product="https://jochen-kammerer.de/produkt/no-bullshit-elternfitness-selbststarter/";
  assert.deepEqual(flags("Direkter Kaufwunsch","Hier ist der Selbststarter: "+product),[]);
  assert.ok(flags("Direkter Kaufwunsch","Hier ist der Keto Guide: https://jochen-kammerer.de/keto-guide/")
    .includes("PURCHASE_NO_VERIFIED_LINK"));
  assert.ok(flags("Direkter Kaufwunsch","Hier: "+product,"llm")
    .includes("PURCHASE_NO_VERIFIED_LINK"));
});

test("A-minus exam: guide handover and explicit human request must route correctly",()=>{
  const guide="https://jochen-kammerer.de/keto-guide/";
  assert.deepEqual(flags("Themenwechsel Check zu Keto","Hier ist dein Guide: "+guide),[]);
  assert.ok(flags("Themenwechsel Check zu Keto","Ich leite an Jochen weiter.","llm_handoff")
    .includes("RESOURCE_MISROUTED"));
  assert.deepEqual(flags("Mensch ausdrücklich verlangt",
    "Ich gebe den Chat an Jochen weiter.","human_handoff"),[]);
  assert.ok(flags("Mensch ausdrücklich verlangt",
    "Ich leite weiter.","llm_handoff")
    .includes("EXPLICIT_HUMAN_HANDOFF_MISSING"));
});

test("A-minus exam: price objection, Keto no pitch, STOP and human lock",()=>{
  assert.deepEqual(flags("499 Euro zu teuer","Verstehe, kein Druck."),[]);
  assert.ok(flags("499 Euro zu teuer","Ich frage Jochen.","llm_handoff")
    .includes("OBJECTION_UNNECESSARY_HANDOFF"));
  assert.deepEqual(flags("KETO ohne Pitch","Lies den Guide in Ruhe.","llm"),[]);
  assert.ok(flags("KETO ohne Pitch","Kauf das Angebot: https://example.com","llm")
    .includes("UNWANTED_KETO_PITCH"));
  assert.ok(flags("STOP und erneuter Kontakt","Es geht doch weiter.","guarded_safety","STOP-followup")
    .includes("STOP_BROKEN"));
  assert.ok(flags("Mensch übernahm vorher","Automatische Antwort.","deterministic","HUMAN-followup")
    .includes("HUMAN_BROKEN"));
});

test("A-minus exam: brevity and third-person advertising are only style warnings",()=>{
  const w=flags("Neuer Follower","Jochen unterstützt dich. "+("A".repeat(370)),"llm");
  assert.ok(w.includes("THIRD_PERSON_PITCH"));
  assert.ok(w.includes("LONG_DM"));
});
