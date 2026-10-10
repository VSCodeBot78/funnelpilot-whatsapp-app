/**
 * Optional natural DM mode for a founder's short, needs-led Instagram chats.
 * Explicitly selected by an endpoint; the legacy WhatsApp A/B/C flow remains
 * available while integrations and existing tests are migrated.
 *
 * This is a deterministic, inspectable baseline, NOT a live LLM claim.
 * Central safety/stop/human ownership checks run before this module.
 */
import { OFFER_TRUTH } from "../config/offer-truth.js";
import type { ConversationState } from "../types/types.js";

export type NaturalReply = {
  text: string;
  phase?: string;
  track?: "keto" | "coaching" | "selfstarter";
  handoff?: boolean;
  booking?: boolean;
  infoOnly?: boolean;
};

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss").replace(/\s+/g, " ").trim();
}
function matches(value: string, re: RegExp): boolean {
  return re.test(normalize(value));
}
const bookingLink = (url?: string) =>
  url && /^https:\/\//i.test(url) ? url : null;
const priceFiveWeeks =
  "Die 5-Wochen-Startphase liegt bei " + OFFER_TRUTH.coachingEntry.priceText + ".";
const selfstarterText =
  "Wenn du erstmal selbst loslegen möchtest, ist der Selbststarter für " +
  OFFER_TRUTH.selfstarter.priceText +
  " genau dafür gedacht.\nHier findest du ihn: " + OFFER_TRUTH.selfstarter.productUrl;

export function getNaturalConversationReply(params: {
  text: string;
  state: ConversationState;
  bookingUrl?: string;
}): NaturalReply | null {
  const { text, state } = params;
  const input = normalize(text);
  const phase = String(state.answers.naturalPhase ?? "opening");
  const lastTrack = String(state.answers.naturalTrack ?? "");
  const lastMessages = state.messages.slice(-8)
    .filter(m => m.role === "user").map(m => normalize(m.text)).join(" ");
  const ketoInConversation = lastTrack === "keto";
  const bookingUrl = bookingLink(params.bookingUrl);

  // Provider booking follows its verified legacy webhook confirmation flow.
  // A self-reported "I booked" must never be treated as verified.
  if (state.currentStep === "booking" &&
      /^(hab(e)? gebucht|ist gebucht|termin steht|bin eingetragen)$/i.test(input)) {
    return null;
  }

  // "Mit Jochen sprechen" is ambiguous: live chat or booking? Ask only once.
  if (phase === "human_choice") {
    if (matches(input, /\b(hier|chat|dm|nachricht|personlich ubernehmen|im gespräch hier)\b/)) {
      return {
        text: "Klar 👍 Ich gebe das an Jochen weiter. Er meldet sich hier persönlich bei dir.",
        phase: "human_handover", handoff: true,
      };
    }
    if (matches(input, /\b(termin|strategiegesprach|gesprach|buchen|vereinbaren|kalender)\b/)) {
      return bookingUrl
        ? { text: "Klar, hier kannst du dir ein Strategiegespräch aussuchen:\n" + bookingUrl,
            phase: "booking_offered", booking: true }
        : { text: "Klar, ich gebe deinen Terminwunsch an Jochen weiter.",
            phase: "human_handover", handoff: true };
    }
    return { text: "Magst du hier im Chat direkt mit Jochen schreiben oder lieber ein Strategiegespräch vereinbaren?", phase };
  }

  if (matches(input, /\b(mit jochen sprechen|jochen personlich|mit jochen reden|jochen kontaktieren|jochen erreichen)\b/) &&
      !matches(input, /\b(termin|strategiegesprach|buchen|vereinbaren)\b/)) {
    return {
      text: "Klar 👍 Möchtest du, dass Jochen hier persönlich übernimmt, oder möchtest du direkt ein Strategiegespräch mit ihm vereinbaren?",
      phase: "human_choice",
    };
  }
  if (matches(input, /\b(jochen soll hier|jochen hier ubernehmen|personlich hier schreiben)\b/)) {
    return { text: "Klar. Ich gebe den Chat an Jochen weiter.",
      phase: "human_handover", handoff: true };
  }
  if (matches(input, /\b(strategiegesprach|termin buchen|termin vereinbaren)\b/)) {
    return bookingUrl
      ? { text: "Hier kannst du dir direkt ein Strategiegespräch aussuchen:\n" + bookingUrl,
          phase: "booking_offered", booking: true }
      : { text: "Ich gebe deinen Terminwunsch an Jochen weiter.",
          phase: "human_handover", handoff: true };
  }

  if (matches(input, /\b(bist du eine ki|schreibt jochen|bist du ein bot)\b/)) {
    return {
      text: "Ich bin Pete, Jochens KI-Assistent. Ich helfe hier bei der ersten Einordnung. Wenn es persönlicher wird, übernimmt Jochen.",
      phase,
    };
  }

  if (matches(input, /\b(ernahrungsplan|essensplan|speiseplan|meal plan)\b/)) {
    return {
      text: "Einen isolierten Ernährungsplan verkauft Jochen nicht.\n" +
        "Es geht darum, Ernährung so aufzubauen, dass sie zu deinem Alltag passt und du sie auch umgesetzt bekommst.\n" +
        "Wo stehst du damit gerade?",
      phase: "attempts",
    };
  }

  // "Keto-Begleitung" is paid personalized coaching, not a guide keyword.
  const ketoSupport = matches(input,
    /\b(keto|ketogen|ketose)\b.*\b(begleitung|coaching|coach|betreuung|umsetzen|unterstutzung|startphase|hilfe)\b|\b(begleitung|coaching|coach|betreuung)\b.*\b(keto|ketogen)\b/);
  const guideRequest = matches(input,
    /\b(keto[\s-]*guide|keto[\s-]*pdf|keto[\s-]*anleitung|kostenloser keto[\s-]*guide)\b/) ||
    /^(keto|guide)$/i.test(input);

  if (ketoSupport && ["opening", "info", "selfstarter_offered"].includes(phase)) {
    return {
      text: "Keto kann Jochen in die 5-Wochen-Begleitung einbauen, wenn es zu dir passt. Es ist kein Muss und kein Dogma.\n" +
        "Geht es dir gerade eher ums Anfangen oder darum, Keto im Alltag durchzuhalten?",
      phase: "keto_need", track: "keto",
    };
  }
  if (guideRequest) {
    return {
      text: "Klar 😊 Mein Keto Guide ist kostenlos. Du bekommst ihn als PDF und als Hörversion.\n" +
        "Hier findest du ihn: " + OFFER_TRUTH.resources.ketoGuide.url,
      phase: "info", infoOnly: true,
    };
  }
  if (matches(input, /\b(elterncheck|eltern[\s-]*check|check schicken)\b/)) {
    return {
      text: "Klar, hier findest du den kostenlosen Elternfitness-Check:\n" +
        OFFER_TRUTH.resources.elterncheck.url,
      phase: "info", infoOnly: true,
    };
  }
  if (matches(input, /\b(selbststarter)\b/)) {
    return { text: selfstarterText, phase: "selfstarter_offered", track: "selfstarter",
      infoOnly: true };
  }

  // Price reference: first use the present chat context, never a three-product list.
  if (matches(input, /\b(was kostet|preis|kosten|wie teuer|investition|sag mir jetzt den preis)\b/) &&
      !matches(input, /\b(nicht leisten|zu teuer|kein geld|budget problem)\b/)) {
    if (matches(input, /\b(6[\s-]*monat(?:e|s)|sechs[\s-]*monat(?:e|s)|premium|advanced)\b/)) {
      return {
        text: "Den konkreten Preis und Umfang der längeren Begleitung klärt Jochen aktuell persönlich. Ich möchte dir hier nichts Falsches nennen.\nMöchtest du dazu direkt mit ihm sprechen?",
        phase: "human_choice",
      };
    }
    if (matches(input, /\b(selbststarter|buch)\b/) || lastTrack === "selfstarter") {
      return { text: "Der Selbststarter liegt bei " + OFFER_TRUTH.selfstarter.priceText + ".",
        phase, track: "selfstarter" };
    }
    if (ketoInConversation || lastTrack === "coaching" ||
        matches(input, /\b(coaching|begleitung|startphase|5[\s-]*wochen)\b/) ||
        matches(lastMessages, /\b(coaching|begleitung|startphase)\b/)) {
      return { text: priceFiveWeeks, phase, track: ketoInConversation ? "keto" : "coaching" };
    }
    return {
      text: "Meinst du die persönliche 5-Wochen-Begleitung oder den Selbststarter zum Selbermachen?",
      phase: "price_clarify",
    };
  }

  if (matches(input, /\b(kann ich mir nicht leisten|zu teuer|kein budget|kein geld|zu viel geld|geht finanziell nicht)\b/)) {
    return {
      text: "Verstanden. Ist gerade wirklich der Preis das Problem oder bist du noch unsicher, ob die Begleitung das Richtige für dich ist?",
      phase: "budget_clarify",
    };
  }
  if (phase === "price_clarify") {
    if (matches(input, /\b(selbst|buch)\b/)) return {
      text: "Der Selbststarter liegt bei " + OFFER_TRUTH.selfstarter.priceText + ".",
      phase: "selfstarter_offered", track: "selfstarter",
    };
    if (matches(input, /\b(coaching|begleitung|personlich|5 wochen|keto)\b/)) {
      return { text: priceFiveWeeks, phase: "coaching_next",
        track: matches(input, /keto/) ? "keto" : "coaching" };
    }
  }
  if (phase === "budget_clarify") {
    if (matches(input, /\b(preis|geld|budget|finanziell|kann ich nicht|zu teuer)\b/) &&
        !matches(input, /\b(unsicher|zweifel|weis nicht|weiss nicht)\b/)) {
      return { text: "Dann macht es gerade keinen Sinn, dich in eine Begleitung zu drängen.\n" + selfstarterText,
        phase: "selfstarter_offered", track: "selfstarter", infoOnly: true };
    }
    return { text: "Verstanden. Was müsste für dich klarer sein, damit du einschätzen kannst, ob die Begleitung passt?",
      phase: "coaching_next", track: "coaching" };
  }

  if (matches(input, /\b(keine zeit fur sport|keine zeit zum trainieren|keine zeit fur training|keine zeit fur fitness)\b/)) {
    return {
      text: "Das ist bei vielen Eltern genau der Knackpunkt. Job, Kinder und Alltag sind schon voll.\n" +
        "Was wäre bei dir realistisch: 10–20 Minuten ein paarmal pro Woche oder ist selbst das gerade schwierig?",
      phase: "time_capacity",
    };
  }
  if (phase === "time_capacity") {
    if (matches(input, /\b(nicht mal|schwierig|keine|gar nicht)\b/)) {
      return { text: "Dann wäre ein großer Trainingsplan gerade völlig daneben.\n" +
        "Was nimmt dir momentan am meisten Luft: Job, Schlaf oder Familienorganisation?",
        phase: "blocker" };
    }
    return { text: "Damit kann man schon sinnvoll anfangen, ohne den Alltag umzukrempeln.\n" +
      "Was hast du bisher probiert, um Bewegung regelmäßig unterzubringen?",
      phase: "attempts" };
  }

  if (phase === "keto_need") {
    return {
      text: "Verstanden. Die Ernährung muss zu deinem Alltag passen, nicht umgekehrt.\n" +
        "Woran hakt es bei Keto bisher am meisten?",
      phase: "blocker", track: "keto",
    };
  }

  if (matches(input, /\b(ich will starten|ich mochte starten|will ich buchen|ich will das buchen|direkt kaufen|ich will die begleitung)\b/)) {
    if (lastTrack === "selfstarter") return {
      text: selfstarterText, phase: "selfstarter_offered", track: "selfstarter", infoOnly: true,
    };
    return {
      text: (ketoInConversation ? "Keto kann in der 5-Wochen-Startphase individuell eingebaut werden.\n" : "") +
        priceFiveWeeks +
        "\nWillst du dazu erst ein Strategiegespräch oder direkt mit der Startphase beginnen?",
      phase: "coaching_close", track: ketoInConversation ? "keto" : "coaching",
    };
  }

  if (phase === "coaching_close" || phase === "coaching_next") {
    if (matches(input, /\b(direkt|checkout|kaufen|loslegen|beginnen|link)\b/) &&
        !matches(input, /\b(gesprach|strategie|termin)\b/)) {
      return {
        text: "Hier kannst du dir die 5-Wochen-Startphase ansehen und direkt starten:\n" +
          OFFER_TRUTH.coachingEntry.checkoutUrl,
        phase: "checkout_offered", track: ketoInConversation ? "keto" : "coaching",
      };
    }
    if (matches(input, /\b(termin|gesprach|strategie)\b/)) {
      return bookingUrl
        ? { text: "Hier kannst du dir ein Strategiegespräch aussuchen:\n" + bookingUrl,
            phase: "booking_offered", booking: true }
        : { text: "Ich gebe deinen Gesprächswunsch an Jochen weiter.",
            phase: "human_handover", handoff: true };
    }
    return {
      text: "Die 5-Wochen-Startphase kann Jochen auf deine Situation abstimmen.\n" +
        "Möchtest du persönlich darüber sprechen oder direkt starten?",
      phase: "coaching_close", track: ketoInConversation ? "keto" : "coaching",
    };
  }

  if (phase === "preference") {
    if (matches(input, /\b(selbst|allein|selber|ohne coach|erstmal infos)\b/)) {
      return { text: selfstarterText, phase: "selfstarter_offered", track: "selfstarter", infoOnly: true };
    }
    if (matches(input, /\b(begleitung|coach|personlich|gemeinsam|unterstutzung|dranbleiben)\b/)) {
      return {
        text: "Genau dafür ist die persönliche Begleitung gedacht.\n" +
          "Was wäre für dich das wichtigste Ergebnis nach fünf Wochen?",
        phase: "coaching_goal", track: ketoInConversation ? "keto" : "coaching",
      };
    }
    return { text: "Möchtest du erstmal selbst mit einem klaren Plan loslegen oder Unterstützung beim Umsetzen?",
      phase };
  }

  if (phase === "coaching_goal") {
    return {
      text: (ketoInConversation ? "Keto kann Jochen passend dazu einbauen, ohne es zur Pflicht zu machen.\n" : "") +
        "Die 5-Wochen-Startphase liegt bei " + OFFER_TRUTH.coachingEntry.priceText + ".\n" +
        "Möchtest du dazu ein Strategiegespräch oder lieber direkt starten?",
      phase: "coaching_close", track: ketoInConversation ? "keto" : "coaching",
    };
  }

  if (phase === "attempts") {
    return {
      text: "Dann fehlt dir wahrscheinlich nicht noch mehr Wissen, sondern etwas, das im Alltag wirklich funktioniert.\n" +
        "Woran ist es bisher meistens gescheitert?",
      phase: "blocker", track: ketoInConversation ? "keto" : undefined,
    };
  }
  if (phase === "blocker") {
    return {
      text: "Das erklärt, warum es bisher schwer war, dranzubleiben.\n" +
        "Was wäre für dich gerade besser: selbst mit einem klaren Plan loslegen oder jemanden an der Seite haben, der mit dir dranbleibt?",
      phase: "preference", track: ketoInConversation ? "keto" : undefined,
    };
  }
  if (phase === "energy_source") {
    return { text: "Klar, das zieht Energie.\n" +
      "Was hast du bisher versucht, um daran etwas zu ändern?", phase: "attempts" };
  }

  if (matches(input, /\b(papa|mama|zwei kinder|kindern)\b/) &&
      matches(input, /\b(platt|mude|erschopft|leer|keine energie)\b/)) {
    return {
      text: "Kinder, Job und abends komplett leer – dann fehlt dir wahrscheinlich nicht einfach nur Wissen 😅\n" +
        "Was zieht dir aktuell am meisten Energie: Job, Schlaf oder der ganze Alltag?",
      phase: "energy_source",
    };
  }
  if (matches(input, /\b(keto|ketogen)\b/)) {
    return {
      text: "Keto kann ein Werkzeug sein, muss aber nicht für jeden passen.\n" +
        "Was möchtest du damit erreichen?",
      phase: "attempts", track: "keto",
    };
  }
  if (matches(input, /\b(platt|mude|bauch|energie|abnehmen|bewegung|training|stress|schlaf|dranbleiben)\b/)) {
    return {
      text: "Verstanden. Klingt, als wäre der Alltag gerade schon voll genug.\n" +
        "Was hast du bisher versucht, um daran etwas zu ändern?",
      phase: "attempts",
    };
  }
  if (matches(input, /^(hallo|hi|hey|moin|guten tag|servus)\b/)) {
    return { text: "Hey 😊 Was möchtest du gerade am liebsten verändern?", phase: "opening" };
  }
  return { text: "Was ist bei dir gerade der größte Knackpunkt im Alltag?", phase: "opening" };
}
