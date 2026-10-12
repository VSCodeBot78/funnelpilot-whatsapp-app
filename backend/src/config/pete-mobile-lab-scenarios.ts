import { evaluateInstagramSharedMedia } from "../services/instagram-shared-media-policy.js";
import { OFFER_TRUTH } from "./offer-truth.js";

/** Synthetic source messages. They have NEVER been sent to Instagram. */
type ScriptedLabLine = { readonly kind: "lead" | "human" | "automation"; readonly text: string };

export const PETE_LAB_SCENARIOS = {
  follower: { label: "Neuer Follower", text: "Hey Jochen, bin neu auf deiner Seite. Was machst du so?" },
  jochen_greeting: { label: "Jochen begrüßt persönlich", humanText: "Hey 😊 Schön, dass du hier bist. Was hat dich auf meine Seite gebracht?" },
  check: { label: "CHECK", text: "CHECK" },
  bullshit: { label: "BULLSHIT", text: "BULLSHIT" },
  keto: { label: "KETO", text: "KETO" },
  video: { label: "VIDEO", text: "Ich hätte gern dein Video." },
  guide: { label: "GUIDE", text: "GUIDE" },
  reel_only: { label: "Geteiltes Reel ohne Text", text: "", hasAttachments: true },
  reel_fun: { label: "Privates Reel / 😂", text: "😂 Haha, genau so!", hasAttachments: true },
  reel_question: { label: "Reel mit Frage", text: "Wie geht die Übung aus dem Reel genau?", hasAttachments: true },
  reel_keyword: { label: "Reel + KETO", text: "KETO", hasAttachments: true },

  // These are PREPARED conversation histories, not Meta webhook test events.
  // Start only seeds stored history. Pete responds to a subsequent lab/message.
  follower_handoff: {
    label: "Follower-Begrüßung -> Pete übernimmt",
    source: "manual_follower",
    transferToPete: true,
    scripted: [
      { kind: "human", text:
        "Hi, herzlich willkommen bei mir auf dem Profil 🙌\nFreut mich wirklich, dass du da bist.\n\nWas beschäftigt dich gerade am meisten, mehr Energie, abnehmen oder endlich wieder fitter werden?" },
    ],
  },
  manychat_check_handoff: {
    label: "ManyChat CHECK -> Lead antwortet",
    source: "manychat_dm",
    transferToPete: true,
    scripted: [
      { kind: "lead", text: "CHECK" },
      { kind: "automation", text:
        "Hier ist dein kostenloser No Bullshit Elternfitness Check. In wenigen Minuten siehst du deinen wichtigsten Hebel und bekommst Orientierung für die nächsten 7 Tage. " +
        OFFER_TRUTH.resources.elterncheck.url },
      { kind: "automation", text: "Hey, hast du deinen Check schon gemacht? Ja, gemacht / Noch nicht / Später" },
    ],
  },
  manychat_keto_handoff: {
    label: "ManyChat KETO -> Lead antwortet",
    source: "manychat_dm",
    transferToPete: true,
    scripted: [
      { kind: "lead", text: "KETO" },
      { kind: "automation", text:
        "Hier ist dein No Bullshit Keto Guide als PDF und Hörvariante. Keto ist ein Werkzeug, kein Muss. " +
        OFFER_TRUTH.resources.ketoGuide.url },
      { kind: "automation", text:
        "Was möchtest du mit Keto gerade am ehesten erreichen? Gewicht reduzieren, mehr Energie oder fitter werden?" },
    ],
  },
  manychat_bullshit_handoff: {
    label: "ManyChat BULLSHIT -> Bundle angefragt",
    source: "manychat_dm",
    transferToPete: true,
    scripted: [
      { kind: "lead", text: "BULLSHIT" },
      { kind: "automation", text:
        "Hier kannst du dir den No Bullshit Elternfitness Selbststarter anschauen: " +
        OFFER_TRUTH.selfstarter.productUrl },
    ],
  },
  reel_comment_bullshit_handoff: {
    label: "Reel-Kommentar BULLSHIT -> DM",
    source: "reel_comment",
    transferToPete: true,
    publicReplyPreview: "Hey 🙌 Schau mal in deine Nachrichten.",
    scripted: [
      { kind: "lead", text: "BULLSHIT" },
      { kind: "automation", text:
        "Danke für deinen Kommentar 🙌 Hier ist der No Bullshit Elternfitness Selbststarter: " +
        OFFER_TRUTH.selfstarter.productUrl },
    ],
  },
  reel_comment_check_handoff: {
    label: "Reel-Kommentar CHECK -> DM",
    source: "reel_comment",
    transferToPete: true,
    publicReplyPreview: "Danke dir 🙌 Schau mal in deine DMs.",
    scripted: [
      { kind: "lead", text: "CHECK" },
      { kind: "automation", text:
        "Hier findest du den kostenlosen Elternfitness-Check: " +
        OFFER_TRUTH.resources.elterncheck.url },
    ],
  },
  story_reply_keto_handoff: {
    label: "Story-Antwort KETO -> DM",
    source: "story_reply",
    transferToPete: true,
    scripted: [
      { kind: "lead", text: "KETO" },
      { kind: "automation", text:
        "Hier ist der kostenlose Keto Guide als PDF und Hörversion: " +
        OFFER_TRUTH.resources.ketoGuide.url },
    ],
  },
} as const;
export type PeteLabScenarioId = keyof typeof PETE_LAB_SCENARIOS;

export function isPeteLabScenarioId(id: unknown): id is PeteLabScenarioId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PETE_LAB_SCENARIOS, id);
}

export function labScenarioPolicy(id: PeteLabScenarioId) {
  const entry = PETE_LAB_SCENARIOS[id];
  const media = "hasAttachments" in entry && entry.hasAttachments === true;
  return evaluateInstagramSharedMedia(media, "text" in entry ? entry.text : "");
}
export function getScriptedLabLines(id: PeteLabScenarioId): readonly ScriptedLabLine[] | null {
  const entry = PETE_LAB_SCENARIOS[id];
  return "scripted" in entry ? entry.scripted : null;
}
