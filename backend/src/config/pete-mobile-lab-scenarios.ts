import { evaluateInstagramSharedMedia } from "../services/instagram-shared-media-policy.js";

export const PETE_LAB_SCENARIOS = {
  follower: { label: "Neuer Follower", text: "Hey Jochen, bin neu auf deiner Seite. Was machst du so?" },
  jochen_greeting: { label: "Jochen begrüßt persönlich", humanText: "Hey 😊 Schön, dass du hier bist. Was hat dich auf meine Seite gebracht?" },
  check: { label: "CHECK", text: "CHECK" },
  bullshit: { label: "BULLSHIT", text: "BULLSHIT" },
  keto: { label: "KETO", text: "KETO" },
  video: { label: "VIDEO", text: "Ich hätte gern dein Video." },
  guide: { label: "GUIDE", text: "GUIDE" },
  reel_fun: { label: "Privates Reel / 😂", text: "😂 Haha, genau so!", hasAttachments: true },
  reel_question: { label: "Reel mit Frage", text: "Wie geht die Übung aus dem Reel genau?", hasAttachments: true },
  reel_keyword: { label: "Reel + KETO", text: "KETO", hasAttachments: true },
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
