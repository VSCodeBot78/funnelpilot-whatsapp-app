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

  // Questions about the method, implementation, value or what to do have
  // priority over qualification. Unverified offer facts remain off limits.
  if (isDirectQuestion(latest) ||
      /\b(?:sag mir konkret|bitte konkret|erklare mir|beantworte meine frage|was ware realistisch)\b/.test(latest)) {
    return { ...base, action: "direct_answer", reason: "explicit_request",
      noNewQuestion: /\b(?:keine frage|ohne fragen|bitte konkret und kurz|nur die antwort)\b/.test(latest) };
  }
  if ((breakFailure && /\b(?:schicht|pausen|essen|training)\b/.test(context)) ||
      /\b(?:noch ein pflichtplan|abends komplett erledigt|total erschopft|nicht noch einen plan)\b/.test(context)) {
    return { ...base, action: "concrete_help",
      reason: breakFailure ? "irregular_breaks" : "exhaustion",
      noNewQuestion: true };
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
    concrete_help: "Einen passenden, greifbaren allgemeinen Lösungsansatz liefern, nicht nur das Problem neu formulieren. Kein individueller Ernährungs-/Trainingsplan.",
    clarify: "Nur wenn entscheidende Information wirklich fehlt, EINE kurze neue Frage. Keine bereits beantwortete Frage wiederholen.",
    acknowledge: "Grenze oder fehlendes Kaufinteresse kurz anerkennen, ohne neuen Pitch.",
    offer_navigation: "Nur nach echtem Interesse zum verifizierten Angebot verweisen. Niemals Preise, Links, Verfügbarkeit oder Vertragsdetails erfinden.",
  };
  return "\nPETE POLICY V4 (entscheidet diesen Turn; nachrangige generische Fragenregeln gelten hier NICHT): " +
    "Aktion=" + plan.action + ". " + goals[plan.action] +
    (plan.noNewQuestion ? " NULL Rueckfragen in dieser Nachricht." : " Maximal EINE sinnvolle Frage, nur falls wirklich erforderlich.") +
    (plan.avoidTraining ? " Bekannter Kontext: Training ist NICHT der Engpass; KEINE Workout-Empfehlung." : "") +
    (plan.alreadyHasPackedFood ? " Essen wurde bereits vorbereitet/mitgenommen: NICHT nochmal Essen mitnehmen oder Meal-Prep als Neuigkeit empfehlen." :
      plan.reason === "irregular_breaks" ? " Ausfallende Pausen: falls noch nicht mitgenommen, EINE praktisch transportable Essensidee; ansonsten den tatsächlichen Engpass erklären." : "") +
    " Bedürfnisse, Sicherheit und Verifizierbarkeit haben Vorrang. needsHuman=true NUR bei wirklicher notwendiger menschlicher Freigabe, ausdruecklicher Uebernahme oder ungeklärtem sensiblen Vorgang. Ein skeptischer Einwand oder die Frage nach der Methode ist ALLEIN kein Handoff-Grund.";
}
