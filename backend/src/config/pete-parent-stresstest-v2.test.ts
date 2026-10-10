import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// 70 entirely synthetic parent roleplays. Each script contains multiple
// lead turns, rather than isolated trigger words; no live OpenAI/Meta calls.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-parent-stress-v2-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

type Focus =
  | "family_context" | "time_pressure" | "free_guide" | "keto_coaching"
  | "no_sales" | "budget" | "approved_price" | "unapproved_price"
  | "human_handover" | "medical_handover" | "booking_claim"
  | "trust" | "context_switch" | "stop";

type ParentScript = { label: string; turns: string[] };
type Group = { focus: Focus; scripts: ParentScript[] };
const group = (focus: Focus, scripts: Array<[string, string[]]>): Group => ({
  focus, scripts: scripts.map(([label, turns]) => ({ label, turns })),
});

const groups: Group[] = [
  group("family_context", [
    ["Mama Frühschicht", ["Ich bin Mama von drei Kindern und mache Frühschicht. Abends bin ich völlig leer.", "Der Kleine wird nachts oft wach.", "Früher bin ich joggen gegangen, heute klappt das kaum."]],
    ["Papa Wechselmodell", ["Papa von zwei Kindern hier, seit dem Wechselmodell ist mein Alltag völlig durchgetaktet und ich bin müde.", "Eher der Schlaf und die Fahrerei.", "Zweimal Training angefangen und wieder abgebrochen."]],
    ["Mama Pflegearbeit", ["Ich pflege meine Mutter und habe zwei Schulkinder. Keine Energie mehr.", "Schon allein die Organisation macht mich müde.", "Ich weiß ehrlich nicht, wo ich anfangen soll."]],
    ["Papa Spätschicht", ["Ich bin Papa von 2 Kindern, arbeite Spätschicht und bin danach platt.", "Vor allem die Arbeit.", "Ich habe mal ein paar Übungen gemacht, aber nichts Regelmäßiges."]],
    ["Mama Kita und Homeoffice", ["Ich bin Mama, arbeite im Homeoffice und unsere Kita fällt ständig aus. Ich bin kaputt.", "Die Nächte sind kurz.", "Ich würde gern wieder Energie für die Kinder haben."]],
  ]),
  group("time_pressure", [
    ["Alleinerziehende Mama", ["Ich habe für Sport gar keine Zeit, bin alleinerziehend.", "Nicht mal 10 Minuten, ganz ehrlich.", "Job und Kinder lassen gerade nichts übrig."]],
    ["Papa Pendelstrecke", ["Für Training habe ich wenig Zeit, ich pendele täglich zwei Stunden.", "Zehn Minuten wären vielleicht drin.", "Früher habe ich YouTube-Workouts gemacht."]],
    ["Mama Doppelschicht", ["Ich will trainieren, aber ich habe keine Zeit für Sport mit Job und Baby.", "Im Moment nicht mal zehn Minuten.", "Der Schlaf ist gerade das größte Problem."]],
    ["Papa Bereitschaft", ["Keine Zeit für Fitness. Zwei Kinder und Bereitschaftsdienst.", "Ein Viertelstündchen wäre manchmal realistisch.", "Ich brauche etwas ohne festen Wochentag."]],
    ["Mama Familienchaos", ["Ich hab echt keine Zeit fürs Training.", "Vielleicht morgens zehn Minuten.", "Ich habe es schon mal mit einer App versucht."]],
  ]),
  group("free_guide", [
    ["Mama Guide", ["Schick mir bitte nur den kostenlosen Keto Guide.", "Danke! Ich möchte erst mal nur lesen.", "Passt für mich."]],
    ["Papa PDF", ["Ich hätte gern das Keto PDF.", "Danke, die Familie möchte auch mal reinschauen.", "Ich muss dafür doch nichts kaufen, oder?"]],
    ["Mama Audio", ["Kann ich den Keto Guide bekommen?", "Ich höre lieber beim Kinderwagen-Schieben.", "Danke, das reicht erstmal."]],
    ["Papa Anleitung", ["Keto Anleitung bitte.", "Geht das ohne persönliches Coaching?", "Super, lese ich am Wochenende."]],
    ["Mama Elterncheck", ["Ich hätte gern den Elterncheck.", "Ist das kostenlos?", "Okay, ich probier den Check am Sonntag."]],
  ]),
  group("keto_coaching", [
    ["Mama Familienessen", ["Ich möchte Keto-Coaching und habe zwei Kinder.", "Bei uns essen alle gemeinsam und ich koche ungern doppelt.", "Ich möchte Unterstützung beim Dranbleiben."]],
    ["Papa Schicht-Keto", ["Ich brauche Keto-Begleitung, bin Papa und arbeite nachts.", "An den Nachtschichten hakt es.", "Jemanden an der Seite hätte ich gerne."]],
    ["Mama kein Dogma", ["Ich möchte Hilfe beim Keto umsetzen, aber keine Verbote für meine Familie.", "Besonders die Wochenenden sind schwierig.", "Ich will nichts Starres."]],
    ["Papa Startschwierigkeiten", ["Ich will Keto-Coaching. Ich fange ständig neu an.", "Ich greife spätabends zum Brot.", "Allein bekomme ich keine Routine rein."]],
    ["Mama flexible Ernährung", ["Ich suche Unterstützung bei Keto mit Kind und Vollzeitjob.", "Für alle zweimal kochen geht auf keinen Fall.", "Mehr Energie wäre mir wichtiger als eine Zahl auf der Waage."]],
  ]),
  group("no_sales", [
    ["Mama keine Werbung", ["Ich will keine Werbung und kein Verkaufsgespräch.", "Danke. Ich schaue mich erstmal um.", "Vielleicht melde ich mich später."]],
    ["Papa bitte nicht verkaufen", ["Bitte nicht verkaufen, ich will nur schauen.", "Habe gerade genug um die Ohren.", "Alles klar, danke."]],
    ["Mama nur informieren", ["Ich schaue nur, ich bin nicht interessiert an einem Coaching.", "Ich wollte nur wissen, was ihr so macht.", "Danke für die Info."]],
    ["Papa ohne Kauf", ["Ich will nichts kaufen, ich informiere mich nur.", "Gerade fehlt mir ohnehin die Zeit.", "Okay, passt so."]],
    ["Mama kein Interesse", ["Kein Interesse, bitte keine Beratung.", "Ich wollte bloß die Seite ansehen.", "Alles gut, danke."]],
  ]),
  group("budget", [
    ["Mama hohe Miete", ["Das kann ich mir aktuell nicht leisten.", "Mit der Miete und den Kindern ist wirklich das Geld das Problem.", "Auch der kleine Einstieg wäre gerade schwierig."]],
    ["Papa Kita-Kosten", ["499 Euro sind mir zu teuer.", "Wir zahlen gerade hohe Kita-Kosten.", "Vielleicht später mal."]],
    ["Mama Alleinverdienerin", ["Ich habe kein Budget für Coaching.", "Nein, es liegt nicht an der Qualität, das Geld fehlt.", "Ich möchte erst selbst versuchen, günstiger anzufangen."]],
    ["Papa Kurzarbeit", ["Das kann ich mir nicht leisten, ich bin in Kurzarbeit.", "Wirklich nur Geld, nicht Unsicherheit.", "Auch 14,95 ist aktuell schwierig."]],
    ["Mama Umzug", ["Coaching ist für mich im Moment zu teuer.", "Wir ziehen gerade mit drei Kindern um.", "Ich könnte mir den Selbststarter anschauen."]],
  ]),
  group("approved_price", [
    ["Mama Selbststarter", ["Was kostet der Selbststarter?", "Was bekomme ich dafür?", "Den Link schaue ich mir an."]],
    ["Papa fünf Wochen", ["Was kostet das 5-Wochen-Coaching?", "Das ist die persönliche Begleitung, oder?", "Ich überlege mir das."]],
    ["Mama Preisvergleich", ["Sag mir jetzt den Preis.", "Die persönliche Begleitung meine ich.", "Danke, ich bespreche das Zuhause."]],
    ["Papa Keto Preis", ["Was kostet Keto-Coaching bei Jochen?", "Ist das dann fünf Wochen?", "Kann ich erst mehr Infos bekommen?"]],
    ["Mama kleines Produkt", ["Wie teuer ist der Selbststarter?", "Kann ich das ohne Call kaufen?", "Okay, danke."]],
  ]),
  group("unapproved_price", [
    ["Mama 6 Monate", ["Was kostet die 6-Monats-Begleitung?", "Gibt es eine Anrechnung der fünf Wochen?", "Dann frage ich Jochen direkt."]],
    ["Papa Premium", ["Was kostet Premium?", "Bitte sag mir eine monatliche Rate.", "Okay, dann persönlich."]],
    ["Mama Advanced", ["Wie teuer ist Advanced?", "Ich will wissen, ob das finanzierbar ist.", "Danke, ich kläre es."]],
    ["Papa sechs Monate", ["Was ist der Preis für sechs Monate Begleitung?", "Gibt es dafür einen Rabatt?", "Dann warte ich auf Jochen."]],
    ["Mama langfristig", ["Was kostet die langfristige Begleitung?", "Und wie sieht es mit einer Anzahlung aus?", "Verstanden, danke."]],
  ]),
  group("human_handover", [
    ["Mama direkt Jochen", ["Ich möchte mit Jochen sprechen.", "Hier im Chat bitte.", "Kann Jochen persönlich übernehmen?"]],
    ["Papa Chat statt Call", ["Kann ich direkt mit Jochen sprechen?", "Hier im Chat, ich habe keine Zeit für Termine.", "Danke, ich warte."]],
    ["Mama persönliche Frage", ["Ich würde gerne mit Jochen persönlich reden.", "Bitte hier im Chat.", "Schreib mir dann, wenn er Zeit hat."]],
    ["Papa menschlich", ["Kann Jochen persönlich mit mir sprechen?", "Im Chat.", "Ich brauche gerade keinen Kalenderlink."]],
    ["Mama keine KI", ["Ich will mit Jochen sprechen, nicht mit dem Bot.", "Hier direkt als Nachricht.", "Ich melde mich sonst später."]],
  ]),
  group("medical_handover", [
    ["Schwangere Mama", ["Ich bin schwanger und möchte Keto anfangen. Geht das mit dem Baby?", "Welche Kalorien soll ich essen?", "Und was kostet Coaching?"]],
    ["Papa Epilepsie", ["Ich habe Epilepsie und nehme Medikamente, kann ich Keto machen?", "Soll ich die Tabletten absetzen?", "Antwortest du noch?"]],
    ["Mama Essstörung", ["Ich habe eine Essstörung und will schnell abnehmen.", "Kannst du mir ein sehr strenges Kalorienlimit geben?", "Hallo?"]],
    ["Papa Krebs", ["Ich habe Krebs und möchte mit Keto meine Therapie ersetzen.", "Soll ich mit der Chemotherapie aufhören?", "Bist du da?"]],
    ["Mama Blutdruck", ["Ich nehme Medikamente für den Blutdruck und will radikal Keto machen.", "Kann ich sie dann reduzieren?", "Bitte antworte."]],
  ]),
  group("booking_claim", [
    ["Mama Calendly", ["Ich möchte ein Strategiegespräch buchen.", "Hab gebucht.", "Ist mein Termin jetzt bestätigt?"]],
    ["Papa Termin", ["Ich möchte einen Termin vereinbaren.", "Ich bin eingetragen.", "Siehst du den Termin?"]],
    ["Mama Strategie", ["Kann ich ein Strategiegespräch buchen?", "Termin steht.", "Bekomme ich eine Bestätigung von dir?"]],
    ["Papa Gespräch", ["Ich will einen Termin ausmachen.", "Hab den Termin gebucht.", "Ist mein Termin jetzt bestätigt?"]],
    ["Mama Buchung", ["Bitte einen Termin buchen.", "Hab gebucht.", "Kannst du mir den Termin garantieren?"]],
  ]),
  group("trust", [
    ["Mama abgezockt", ["Ich wurde beim letzten Coaching total abgezockt.", "Da ging es nur um den Abschluss.", "Was ist bei Jochen anders?"]],
    ["Papa Vertrauen", ["Wie kann ich wissen, dass das hier seriös ist?", "Ich möchte erst verstehen, was ich bekomme.", "Ich kaufe jedenfalls nicht heute."]],
    ["Mama Bot-Frage", ["Bist du schon wieder so ein Verkaufsbot?", "Ich habe keine Lust auf eine Verkaufsmasche.", "Okay, dann schick mir erst Informationen."]],
    ["Papa Vorbehalt", ["Ihr wollt mir doch nur etwas verkaufen.", "Ich möchte keinen Druck.", "Was macht Jochen eigentlich genau?"]],
    ["Mama Erfahrung", ["Was ist an eurer Begleitung denn anders?", "Ich hatte schon einen sehr schlechten Coach.", "Ich brauche Zeit."]],
  ]),
  group("context_switch", [
    ["Skepsis dann Guide", ["Ich wurde bei einem Coaching abgezockt.", "Schick mir stattdessen bitte den kostenlosen Keto Guide.", "Danke, ich lese nur."]],
    ["Preis dann Elterncheck", ["Sag mir den Preis.", "Ach, schick mir lieber den Elterncheck zuerst.", "Danke, vielleicht später."]],
    ["Keto dann Guide", ["Ich möchte Unterstützung bei Keto.", "Warte, ich will erstmal nur den Keto Guide.", "Danke, den lese ich erst."]],
    ["Zeit dann menschlich", ["Ich habe keine Zeit für Sport.", "Kann ich stattdessen mit Jochen sprechen?", "Hier im Chat bitte."]],
    ["Schlechte Erfahrung und Stopp", ["Beim letzten Programm hatte ich nur Ärger.", "Bitte nicht mehr schreiben.", "Auch wenn ich später frage?"]],
  ]),
  group("stop", [
    ["Mama direkt Stopp", ["Bitte nicht mehr schreiben.", "Hallo?", "Kannst du mir doch noch den Preis sagen?"]],
    ["Papa Ruhe", ["Lass mich in Ruhe, bitte.", "Wieso fragst du weiter?", "Schick mir nichts."]],
    ["Mama nicht anschreiben", ["Schreib mich nicht mehr an.", "Ich möchte keine weiteren Tipps.", "Hallo?"]],
    ["Papa kein Kontakt", ["Kontaktiere mich nicht mehr.", "Ich meinte das ernst.", "Danke."]],
    ["Mama abmelden", ["Ich möchte keine weiteren Nachrichten von dir.", "Bist du noch da?", "Das war ein Test."]],
  ]),
];

const scenarioCount = groups.reduce((total, item) => total + item.scripts.length, 0);
assert.equal(scenarioCount, 70, "QA must exercise seventy distinct parent scripts");
const totalLeadTurns = groups.reduce(
  (total, item) => total + item.scripts.reduce((n, s) => n + s.turns.length, 0), 0,
);
assert.equal(totalLeadTurns, 210);

test("Phase 30: 70 roleplayed parent conversations, 210 lead turns, no live API", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  let totalReplies = 0;
  let totalSuppressed = 0;
  let logged = 0;

  for (const [gi, section] of groups.entries()) {
    for (const [si, scenario] of section.scripts.entries()) {
      await t.test(section.focus + ": " + scenario.label, async () => {
        clearConversationStore();
        const replies: Array<{
          lead: string;
          pete: string | null;
          owner: string | undefined;
          stopped: boolean;
          phase: string | undefined;
          suppressed?: string;
        }> = [];

        for (const [turnIndex, messageText] of scenario.turns.entries()) {
          const previous = replies.at(-1);
          const result = await processIncomingMessage({
            leadId: "parent-stress-v2-" + gi + "-" + si,
            campaignId: DEFAULT_CAMPAIGN_ID,
            conversationMode: "natural",
            messageText,
          });
          const pete = result.text;
          const snapshot = {
            lead: messageText, pete, owner: result.state.owner,
            stopped: Boolean(result.state.flags.stopped),
            phase: result.state.answers.naturalPhase as string | undefined,
            suppressed: result.replySuppressedReason,
          };
          replies.push(snapshot);

          assert.equal(result.state.messages.at(-1)?.role,
            pete ? "assistant" : "user",
            scenario.label + " message actor/order at " + turnIndex);
          if (previous?.owner === "human" || previous?.stopped) {
            assert.equal(pete, null,
              scenario.label + ": Pete must stay silent after prior takeover/STOP");
          }

          if (pete) {
            totalReplies++;
            assert.ok(pete.length <= 800, scenario.label + " overlong response");
            assert.ok((pete.match(/\?/g) ?? []).length <= 1,
              scenario.label + " asks more than one question: " + pete);
            assert.doesNotMatch(pete, /(?:^|\n)\s*[a-d]\)\s/i);
            assert.doesNotMatch(pete, /2[.\s]?499|2[.\s]?000|2499|2000\s*€/i);
            assert.doesNotMatch(pete, /ich bin Jochen(?:\s|[.,!])/i);
            assert.doesNotMatch(pete, /(?:garantiert|versprochen)\s+(?:10\s*kilo|abnehmen|gewichtsverlust)/i);
            assert.doesNotMatch(pete, /(?:hier ist dein|ich erstelle dir|ich schicke dir)\s+(?:individuellen?\s+)?(?:ernahrungs|ernährungs)plan/i);
          } else {
            totalSuppressed++;
          }

          if (section.focus === "free_guide" && si === 0 && turnIndex === 2) {
            assert.doesNotMatch(pete ?? "", /\?/,
              "Closing an info-only conversation must not restart qualification");
          }
          if (section.focus === "no_sales" && si === 0 && turnIndex === 2) {
            assert.doesNotMatch(pete ?? "", /\?/,
              "A parent who may return later is not an invitation to qualify");
          }
          if (section.focus === "budget" && turnIndex === 0) {
            assert.doesNotMatch(pete ?? "", /größte Knackpunkt im Alltag/i,
              "Explicit affordability concerns must not fall into generic opening");
            assert.match(pete ?? "", /Geld|Preis|leisten|finanz|Budget/i);
          }
          if (section.focus === "approved_price" && si === 0 && turnIndex === 1) {
            assert.match(pete ?? "", /no-bullshit-elternfitness-selbststarter/,
              "Concrete Selfstarter contents question needs grounded product information");
          }
          if (section.focus === "unapproved_price" && si === 0 && turnIndex === 1) {
            assert.match(pete ?? "", /Jochen persönlich|klärt Jochen/i,
              "Unverified credit question must not restart qualification");
          }
          if (section.focus === "trust" && si === 0 && turnIndex === 2) {
            assert.match(pete ?? "", /Ernährung|Bewegung|Schlaf/i);
            assert.doesNotMatch(pete ?? "", /größte Knackpunkt im Alltag/i);
          }
          if (section.focus === "no_sales" && turnIndex === 0) {
            assert.doesNotMatch(pete ?? "", /499\s*€|14,95\s*€|checkout|calendly|jetzt buchen/i);
          }
          if (section.focus === "unapproved_price" && turnIndex === 0) {
            assert.match(pete ?? "", /Jochen persönlich|klärt Jochen/i);
            assert.doesNotMatch(pete ?? "", /\d+[.,]?\d*\s*€/);
          }
          if (section.focus === "medical_handover" && turnIndex === 0) {
            assert.equal(result.state.owner, "human", scenario.label);
            assert.equal(result.state.aiPaused, true, scenario.label);
            assert.doesNotMatch(pete ?? "", /499\s*€|14,95\s*€|kaufen|checkout/i);
          }
          if (section.focus === "human_handover" && turnIndex === 1) {
            assert.equal(result.state.owner, "human", scenario.label);
            assert.equal(result.state.aiPaused, true, scenario.label);
          }
          if (section.focus === "booking_claim" && turnIndex >= 1) {
            assert.notEqual(result.state.providerBooking?.status, "booked");
            assert.doesNotMatch(pete ?? "", /Ja, dein Termin ist im Buchungssystem bestätigt/i);
          }
          if (section.focus === "stop" && turnIndex === 0) {
            assert.equal(result.state.flags.stopped, true, scenario.label);
          }
          if (section.focus === "context_switch" && si === 0 && turnIndex === 1) {
            assert.match(pete ?? "", /jochen-kammerer\.de\/keto-guide\//,
              "Explicit free guide request should override an old trust phase");
          }
          if (section.focus === "context_switch" && si === 4 && turnIndex === 1) {
            assert.equal(result.state.flags.stopped, true);
          }
        }
        // A bounded evidence sample of complete transcripts for actual language review:
        // one full conversation from each major segment, not just passing counters.
        if (si === 0) {
          console.log("PETE_PARENT_STRESS_V2 " + JSON.stringify({
            label: scenario.label,
            focus: section.focus,
            source: "synthetic parent script; actual deterministic engine outputs; no LLM or Meta",
            turns: replies,
          }));
          logged++;
        }
        assert.equal(replies.length, scenario.turns.length);
      });
    }
  }
  console.log("PETE_PARENT_STRESS_V2_TOTALS " + JSON.stringify({
    conversations: scenarioCount, leadTurns: totalLeadTurns,
    aiReplies: totalReplies, suppressed: totalSuppressed,
    transcriptSamples: logged, liveSends: 0,
  }));
});