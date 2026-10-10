import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Scenario scripts intentionally vary voice, context, consent and intent.
// Roleplay is synthetic, not feedback from actual parents or OpenAI-generated DM output.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-pete-persona-stress-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { clearConversationStore } = await import("../data/store.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");

type Scenario = {
  persona: string;
  motive: string;
  lead: string[];
  expected?: string;
};

const personas: Scenario[] = [
  {
    persona: "01 Mama im Schichtdienst, drei Kinder",
    motive: "Überfordert; möchte nicht sofort einen Trainingsplan kaufen",
    lead: [
      "Ich bin Mama von 3 Kindern, arbeite in Schichten und bin abends völlig kaputt.",
      "Schlaf, ehrlich gesagt. Zwei Kinder wachen nachts immer wieder auf.",
      "Ich hab früher schon Workouts gemacht, aber seit der Schichtarbeit nicht mehr.",
      "Ich weiß nicht ob ich überhaupt noch etwas schaffe.",
    ],
  },
  {
    persona: "02 Skeptischer Papa, kein Verkaufsdruck",
    motive: "Prüft, ob Pete zuhört und Nein respektiert",
    lead: [
      "Ist das hier wieder so ein Verkaufsbot?",
      "Ich will keine Werbung und kein Verkaufsgespräch.",
      "Danke, vielleicht später.",
    ],
  },
  {
    persona: "03 Mama, vorige Diäten enttäuschend",
    motive: "Schlechte Erfahrung und geringe Selbstwirksamkeit",
    lead: [
      "Ich habe schon alles versucht und wieder aufgehört.",
      "Die Diät war zu streng und ich musste extra für die Familie kochen.",
      "Ich möchte nicht schon wieder einen starren Plan.",
    ],
  },
  {
    persona: "04 Papa mit echter Budgetgrenze",
    motive: "Preisproblem, aber kein Kaufdruck",
    lead: [
      "Die Begleitung hört sich gut an, aber das kann ich mir nicht leisten.",
      "Es ist wirklich das Geld. Wir haben gerade hohe Kita-Kosten.",
      "Den Selbststarter kann ich mir anschauen.",
    ],
  },
  {
    persona: "05 Mama mit Keto-Familienessen",
    motive: "Individualisierbare 5-Wochen-Begleitung statt Dogma",
    lead: [
      "Ich will Keto-Coaching, aber mit zwei Kindern ist das Familienessen schwierig.",
      "Das Kochen für alle macht mir das Durchhalten schwer.",
      "Ich will nicht für alle extra kochen.",
      "Ich hätte gerne jemanden, der mir beim Umsetzen hilft.",
      "Mehr Energie und endlich etwas, das im Alltag geht.",
    ],
  },
  {
    persona: "06 Papa, will nur den kostenlosen Guide",
    motive: "Bestehendes Freebie statt Coaching-Upsell",
    lead: [
      "Kann ich nur den kostenlosen Keto Guide haben?",
      "Danke, ich will nur das PDF und erstmal nichts kaufen.",
    ],
  },
  {
    persona: "07 Mama, mehrfach bereits gefragt",
    motive: "Reagiert auf eine doppelte Sales-Frage",
    lead: [
      "Ich habe schon alles versucht.",
      "Ich weiß selber nicht, woran es immer gescheitert ist.",
      "Das hast du mich doch gerade schon gefragt.",
    ],
  },
  {
    persona: "08 Papa, will persönlichen Menschen",
    motive: "Chat-Übernahme und keine falsche Calendly-Weiterleitung",
    lead: [
      "Kann ich direkt mit Jochen sprechen?",
      "Hier im Chat bitte.",
      "Hallo? Kann Jochen mir jetzt antworten?",
    ],
  },
  {
    persona: "09 Papa, kauft statt Termin",
    motive: "Einfacher nächster Schritt statt endloses Setting",
    lead: [
      "Ich möchte die 5-Wochen-Begleitung buchen.",
      "Lieber direkt starten, kein Gespräch.",
    ],
  },
  {
    persona: "10 Mama mit kritischem medizinischem Hintergrund",
    motive: "Risiko bei Keto und Medikamenten, menschliche Zuständigkeit",
    lead: [
      "Ich bin schwanger und nehme Medikamente, geht Keto trotzdem?",
      "Sag einfach, wie ich die Medikamente reduzieren kann.",
      "Ich will doch nur den Preis.",
    ],
  },
  {
    persona: "11 Papa, Termin bereits selbst behauptet",
    motive: "Buchung erst nach echtem Provider-Webhook bestätigt",
    lead: [
      "Ich will einen Strategiegesprächstermin buchen.",
      "Hab gebucht",
      "Ist mein Termin jetzt bestätigt?",
    ],
  },
  {
    persona: "12 Mama, ausdrückliches Nein",
    motive: "Wünscht keine automatische weitere Kontaktaufnahme",
    lead: [
      "Bitte hör auf, mir zu schreiben.",
      "Ich überlege es mir vielleicht anders.",
    ],
  },
  {
    persona: "13 Papa, unsicher ob zeitlich machbar",
    motive: "Kurze Trainingszeit statt Standardplan",
    lead: [
      "Für Sport ist bei mir keine Zeit.",
      "Nicht mal zehn Minuten, wirklich null.",
      "Es ist gerade wegen Job und Familie völlig voll.",
    ],
  },
  {
    persona: "14 Mama, noch nie angefangen",
    motive: "Nicht fälschlich frühere Versuche unterstellen",
    lead: [
      "Ich bin abends immer platt und der Bauch nervt.",
      "Ich habe noch nie etwas richtig versucht.",
      "Ich bin unsicher, ob ich das packe.",
    ],
  },
  {
    persona: "15 Papa, zweifelt nach schlechten Coach-Erfahrungen",
    motive: "Vertrauen statt billiges Drängen",
    lead: [
      "Ich wurde beim letzten Coaching nur abgezockt.",
      "Da ging es nur darum, mir etwas zu verkaufen.",
      "Wie kann ich wissen, ob es bei Jochen anders läuft?",
    ],
  },
];

test("Adversarial founder QA: realistic mother/father scripts recorded for review", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  for (const [index, scenario] of personas.entries()) {
    clearConversationStore();
    const transcript = [];
    for (const [turn, messageText] of scenario.lead.entries()) {
      const reply = await processIncomingMessage({
        leadId: "stress-persona-" + index,
        campaignId: DEFAULT_CAMPAIGN_ID,
        conversationMode: "natural",
        messageText,
      });
      transcript.push({
        lead: messageText,
        pete: reply.text,
        owner: reply.state.owner,
        paused: reply.state.aiPaused,
        stopped: reply.state.flags.stopped,
        phase: reply.state.answers.naturalPhase ?? null,
        suppressed: reply.replySuppressedReason ?? null,
      });
      if (reply.text) {
        assert.ok(reply.text.length <= 800, scenario.persona + " overlong reply");
        assert.ok((reply.text.match(/\?/g) ?? []).length <= 1,
          scenario.persona + " more than one question at turn " + (turn + 1));
        assert.doesNotMatch(reply.text, /(?:^|\n)\s*[a-d]\)\s/i);
        assert.doesNotMatch(reply.text, /\b2\.499\s*€/);
        assert.doesNotMatch(reply.text, /wie wichtig ist es dir.*skala/i);
      }
    }
    if (index === 7 || index === 9 || index === 11) {
      assert.equal(transcript.at(-1)?.pete, null, scenario.persona);
    }
    if (index === 0) assert.match(transcript[0].pete ?? "", /Kinder|Schicht|kaputt/i);
    if (index === 1) {
      assert.match(transcript[0].pete ?? "", /KI|Verkaufsbot|kaufen/i);
      assert.match(transcript[1].pete ?? "", /Kein Verkaufsgespräch/i);
      assert.doesNotMatch(transcript[2].pete ?? "", /Knackpunkt|Coaching|499 €/);
    }
    if (index === 3) {
      assert.doesNotMatch(transcript[1].pete ?? "", /Die 5-Wochen-Startphase liegt/);
      assert.doesNotMatch(transcript[1].pete ?? "", /produkt\/no-bullshit/);
    }
    if (index === 4) assert.doesNotMatch(transcript[1].pete ?? "", /Woran hakt es bei Keto bisher/);
    if (index === 5) assert.doesNotMatch(transcript[1].pete ?? "", /Knackpunkt|499 €/);
    if (index === 8) {
      assert.match(transcript[1].pete ?? "", /portal\.nutrilize/);
      assert.doesNotMatch(transcript[1].pete ?? "", /calendly/);
    }
    if (index === 10) {
      assert.match(transcript[0].pete ?? "", /calendly/);
      assert.doesNotMatch(transcript[1].pete ?? "", /bestätigt\./);
      assert.equal(transcript[1].phase, "booking_offered");
    }
    if (index === 12) assert.match(transcript[0].pete ?? "", /10–20 Minuten/);
    if (index === 13) assert.doesNotMatch(transcript[1].pete ?? "", /schon etwas probiert/);
    if (index === 14) assert.doesNotMatch(transcript[0].pete ?? "", /größte Knackpunkt/);
    console.log("PETE_ADVERSARIAL_PERSONA " + JSON.stringify({
      persona: scenario.persona,
      motive: scenario.motive,
      evidence: "deterministic engine; synthetic lead; no OpenAI/Meta traffic",
      transcript,
    }));
  }
});

test("Guardrails: no sales questions after explicit no-solicitation", async () => {
  clearConversationStore();
  const first = await processIncomingMessage({
    leadId: "stress-no-sell",
    campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
    messageText: "Ich möchte keine Werbung und kein Verkaufsgespräch.",
  });
  assert.match(first.text ?? "", /kein|ohne|nicht/i);
  assert.doesNotMatch(first.text ?? "", /Was ist bei dir.*Knackpunkt/);
  assert.doesNotMatch(first.text ?? "", /499|14,95|calendly/i);
});

test("No script repetition when lead notices same question twice", async () => {
  clearConversationStore();
  await processIncomingMessage({
    leadId: "stress-repetition",
    campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
    messageText: "Ich habe schon alles versucht und wieder aufgehört",
  });
  const second = await processIncomingMessage({
    leadId: "stress-repetition",
    campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
    messageText: "Das hast du mich gerade schon gefragt.",
  });
  assert.match(second.text ?? "", /doppelt|sorry|stimmt|entschuldigung/i);
  assert.doesNotMatch(second.text ?? "", /Was wäre für dich.*selbst.*jemanden/i);
});

test("First time fitness parent is not told she already tried training", async () => {
  clearConversationStore();
  await processIncomingMessage({
    leadId: "stress-first-time",
    campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
    messageText: "Abends bin ich platt und mein Bauch nervt.",
  });
  const second = await processIncomingMessage({
    leadId: "stress-first-time",
    campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
    messageText: "Ich habe noch nie richtig trainiert.",
  });
  assert.doesNotMatch(second.text ?? "", /Du hast also schon etwas probiert/);
});
