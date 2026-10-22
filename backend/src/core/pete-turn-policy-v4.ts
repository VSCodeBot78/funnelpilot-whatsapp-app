/**
 * Pete Policy v4: one deterministic, privacy-preserving next-action decision.
 * This is not a second AI call. It plans a turn from already stored messages.
 * Safety/STOP/human ownership and verified payments stay in conversation-engine.
 */
import type { ConversationState } from "../types/types.js";
import { hasPeteActiveNoQuestionBoundary } from "./pete-question-boundary.js";

export type PeteTurnAction = "respect_boundary" | "direct_answer" |
  "concrete_help" | "clarify" | "acknowledge" | "offer_navigation";

export type PeteTurnPlan = {
  action: PeteTurnAction;
  reason: string;
  noNewQuestion: boolean;
  avoidTraining: boolean;
  alreadyHasPackedFood: boolean;
};

const norm = (v: string) => v.toLocaleLowerCase("de-DE")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ").trim();
const isDirectQuestion = (text: string) =>
  text.includes("?") && /(?:\bwie\b|\bwas\b|\bwarum\b|\bwomit\b|\bworan\b|\bwelche\b|\bwodurch\b|\bwieviel\b|\bwof[ua]r\b|\bfur wen\b|\bpasst\b|\bgeeignet\b|\bkann\b)/.test(text);
const hasReliablePrep = (text: string) =>
  /\b(?:essen|mahlzeiten?|snack|snacks?)\b.{0,65}\b(?:mit|dabei|vorbereit|eingepackt)\w*/.test(text) ||
  /\b(?:nehme|nehme|habe|hab)\w*\b.{0,45}\b(?:essen|mahlzeit|snack)\b.{0,30}\b(?:mit|dabei)\b/.test(text);
const hasFailedBreaks = (text: string) =>
  /\bpausen?\b.{0,45}\b(?:ausfall|fallen aus|fallt aus|fallen|aus|unplanbar|weg|keine|nicht)\b/.test(text) ||
  /\b(?:fallen|fallt|faellt)\b.{0,30}\bpausen?\b.{0,15}\baus\b/.test(text) ||
  /\bpausen?\b.{0,25}\b(?:ausfallen|fallen)\b/.test(text) ||
  /\b(?:ohne|keine)\s+(?:richtige\s+|feste\s+)?pausen?\b/.test(text);

export function decidePeteTurnV4(state: ConversationState): PeteTurnPlan {
  const turns = (state.messages ?? []).filter(m => m.role === "user");
  const latest = norm(String(turns.at(-1)?.text ?? ""));
  const context = norm(turns.slice(-6).map(m => m.text).join(" "));
  const packed = hasReliablePrep(context);
  const breakFailure = hasFailedBreaks(context);
  const avoidTraining = /(?:training|sport|workouts?)\s+(?:lauft|klappt|ist nicht das problem)|(?:kein|nicht noch|ohne)\s+(?:mehr\s+)?(?:training|sport|workouts?)|(?:training|sport)\s+(?:bitte\s+)?(?:nicht|raus|aussen vor)|\bnicht\s+(?:wieder\s+|nochmal\s+)?training\s+empfehlen/.test(context);
  const base = { avoidTraining, alreadyHasPackedFood: packed };
  if (hasPeteActiveNoQuestionBoundary(state)) return {
    ...base, action: "respect_boundary", reason: "no_questions", noNewQuestion: true,
  };

  // Explicit needs: value, scope, entry process and evening-eating tactics.
  // These four case-sensitive decisions prevent generic sales questions from
  // outranking an already stated information need. Never infer service terms.
  if (/\bmehrwert\b/.test(latest) &&
      /\b(?:bezahl|konnte|konnten|kann|nutzen|nicht klar|sehe|verstehe)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "value_proposition", noNewQuestion: true };
  }
  if (/\b(?:was ich konkret bekomme|was bekomme ich|was genau bekomme ich|welche leistungen|umfang|fehlt.*klarheit)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "offer_scope", noNewQuestion: false };
  }
  if (/\b(?:wie lauft der einstieg|wie startet|wie beginnt|wie melde ich mich|wie lauft das starten)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "coaching_entry", noNewQuestion: false };
  }
  if (/\b(?:anders als ein ernahrungsplan|unterschied.*ernahrungsplan|bei euch anders)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "practical_difference", noNewQuestion: true };
  }

  // Schichtarbeit is a discovery opportunity, not an invitation to provide
  // unpaid meal/training plans. Acknowledge any direct question briefly, then
  // discover the one missing part of the parent's day. A real work break
  // cannot simply be replaced by a made-up food trick.
  if (breakFailure && /\b(?:schicht\w*|pausen?|essen|training)\b/.test(context)) {
    return { ...base, action: "clarify", reason: "shift_day_discovery", noNewQuestion: false };
  }

  // Questions about the method, implementation, value or what to do have
  // priority over qualification. Unverified offer facts remain off limits.
  if (isDirectQuestion(latest) ||
      /\b(?:sag mir konkret|bitte konkret|erklare mir|beantworte meine frage|was ware realistisch)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "explicit_request",
      noNewQuestion: /\b(?:keine frage|ohne fragen|bitte konkret und kurz|nur die antwort)\b/.test(latest) };
  }
  if (/\b(?:noch ein pflichtplan|abends komplett erledigt|total erschopft|nicht noch einen plan)\b/.test(context)) {
    return { ...base, action: "concrete_help", reason: "exhaustion", noNewQuestion: true };
  }
  if (/\b(?:ich will direkt kaufen|schick.*(?:link|kaufweg)|angebot|mehrwert|was kostet)\b/.test(latest)) {
    return { ...base, action: "offer_navigation", reason: "purchase_topic", noNewQuestion: true };
  }
  if (/\b(?:nein danke|kein interesse|nur umschauen|in ruhe lesen|kein verkauf)\b/.test(latest)) {
    return { ...base, action: "acknowledge", reason: "respect_decline", noNewQuestion: true };
  }
  return { ...base, action: "clarify", reason: "open_conversation", noNewQuestion: false };
}

/** Strict turn priority appended last in the instruction set, not another prompt pile. */
export function explainPeteTurnV4(plan: PeteTurnPlan): string {
  const goals: Record<PeteTurnAction,string> = {
    respect_boundary: "Grenze respektieren. Keine Fragen, kein Angebot, kein CTA.",
    direct_answer: "Erst die konkrete Kundenfrage sachlich beantworten. Nicht mit einer Bedarfserhebung, Gegenfrage oder bloßer Paraphrase ausweichen.",
    concrete_help: "Kurz und allgemein auf eine ausdrückliche Frage reagieren. Kein individueller Ernährungs-/Trainingsplan.",
    clarify: "Nur wenn entscheidende Information wirklich fehlt, EINE kurze neue Frage. Keine bereits beantwortete Frage wiederholen.",
    acknowledge: "Grenze oder fehlendes Kaufinteresse kurz anerkennen, ohne neuen Pitch.",
    offer_navigation: "Nur nach echtem Interesse zum verifizierten Angebot verweisen. Niemals Preise, Links, Verfügbarkeit oder Vertragsdetails erfinden.",
  };
  return "\nPETE POLICY V4 (entscheidet diesen Turn; nachrangige generische Fragenregeln gelten hier NICHT): " +
    "Aktion=" + plan.action + ". " + goals[plan.action] +
    (plan.noNewQuestion ? " NULL Rueckfragen in dieser Nachricht." : " Maximal EINE sinnvolle Frage, nur falls wirklich erforderlich.") +
    (plan.avoidTraining ? " Bekannter Kontext: Training ist NICHT der Engpass; KEINE Workout-Empfehlung." : "") +
    (plan.alreadyHasPackedFood ? " Essen wurde bereits vorbereitet/mitgenommen: NICHT nochmal Essen mitnehmen oder Meal-Prep als Neuigkeit empfehlen." : "") +
    (plan.reason === "shift_day_discovery" ?
      " SETTER-FOKUS SCHICHT: Kein kostenloser Trainings- oder Ernährungsplan. Fehlende Arbeitspausen sind der bekannte Engpass. Frage, wenn noch nicht bekannt, genau EINEN Aspekt des restlichen Tages (z.B. Wie sieht dein Alltag als Papa/Mama nach der Schicht aus?). Anschliessend bei Bedarf Schlaf, freie Zeit, vorhandenes Essen ODER Training kontextbezogen klaeren, nicht alles in einer Nachricht. Sind Ziel und Alltag hinreichend bekannt UND will die Person Unterstützung, freiwilliges Telefongespraech mit Jochen anbieten. Niemals behaupten, eine echte Pause lasse sich einfach durch Essen ohne Pause ersetzen." : "") +
    (plan.reason === "value_proposition" ?
      " Antwort auf Mehrwert: Unterschied von Informationen zu persoenlicher Umsetzung anhand eines realistischen Elternalltagsbeispiels erklaeren (z.B. Wiedereinstieg bei krankem Kind). Der Lead kann zahlen: NICHT erneut das Budget abfragen und KEIN Preis-/Leistungsversprechen erfinden." : "") +
    (plan.reason === "offer_scope" ?
      " SETTER-FOKUS ZIELBILD: Die konkrete Frage zuerst mit verifizierten Fakten beantworten: Selbststarter eigenstaendig; 5-Wochen-Startphase persoenliche Umsetzung der Saeulen Bewegung, Ernaehrung, Schlaf und Stress. Keine unbekannten Betreuungsdetails erfinden. Danach, falls noch kein Ziel bekannt und der Interessent offen ist, genau EINE Frage wie 'Was moechtest du in sechs Monaten im Spiegel oder im Alltag merken?' Seine eigene Antwort zu einem anschaulichen moeglichen Zukunftsbild verbinden (z.B. mehr Energie oder lockere Hose NUR wenn sein Ziel dazu passt), NICHT als Garantie. Kein erzwungenes Zukunftsbild statt Leistungsantwort." : "") +
    (plan.reason === "coaching_entry" ?
      " SETTER/CLOSER EINSTIEG: Frage nach der konkreten Frage zuerst bekannte 5-Wochen-Startphase und Ausrichtung nennen, keine Vertragsdetails erfinden. Ist der persoenliche Unterstuetzungsbedarf und das Ziel noch unbekannt, hoechstens EINE passende Bedarf- oder Ziel-Frage. Nach Bestaetigung von Bedarf und Gespraechsbereitschaft EIN freiwilliges Telefonat/Strategiegespraech mit Jochen anbieten. Will die Person DIREKT starten, nicht mit Pflicht-Telefonat bremsen; klaere bei echter Unklarheit Selbststarter eigenstaendig vs. persoenliche Startphase. Kauf- und Kalenderlinks duerfen nur aus verifizierter Systemlogik kommen. needsHuman=false bei normaler Information." : "") +
    (plan.reason === "practical_difference" ?
      " Bei stressbedingtem Abendessen nicht nur die Saeulen aufzählen: greifbares allgemeines Beispiel fuer Umsetzungsentlastung statt einer neuen Diaet, ohne persoenliche Betreuung oder Leistungsbestandteile zu erfinden." : "") +
    " Bedürfnisse, Sicherheit und Verifizierbarkeit haben Vorrang. needsHuman=true NUR bei wirklicher notwendiger menschlicher Freigabe, ausdruecklicher Uebernahme oder ungeklärtem sensiblen Vorgang. Ein skeptischer Einwand oder die Frage nach der Methode ist ALLEIN kein Handoff-Grund.";
}
