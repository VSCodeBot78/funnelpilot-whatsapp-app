/**
 * Optional natural DM mode for a founder's short, needs-led Instagram chats.
 * Explicitly selected by an endpoint; the legacy WhatsApp A/B/C flow remains
 * available while integrations and existing tests are migrated.
 *
 * This is a deterministic, inspectable baseline, NOT a live LLM claim.
 * Central safety/stop/human ownership checks run before this module.
 */
import {
  OFFER_TRUTH,
  LONG_TERM_PRICE_UNVERIFIED_REPLY,
  isUnverifiedLongTermPriceQuestion,
} from "../config/offer-truth.js";
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
function wantsPersonalSupport(value: string): boolean {
  const text = normalize(value);
  if (/\b(kein(?:e|en)?|ohne|nicht)\s+(?:coach|begleitung|unterstutzung)\b/.test(text)) {
    return false;
  }
  return /\b(begleitung|coaching|coach|unterstutzung|personliche hilfe|gemeinsam|jemand(?:en)?|dranbleib(?:en|t|e|st)?|an meiner seite)\b/.test(text);
}
function wantsSelfGuided(value: string): boolean {
  const input = normalize(value);
  return /\b(ohne coach|erstmal infos|selbststarter|selbst (?:versuchen|machen|loslegen|starten|angehen|probieren)|selber (?:versuchen|machen|loslegen|starten|angehen|probieren)|allein (?:versuchen|machen|loslegen|starten|angehen|probieren))\b/.test(input);
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
      /\b(hab(?:e)? gebucht|ist gebucht|termin steht|bin eingetragen|termin bestatigt|bestatigung|termin jetzt|hab den termin)\b/i.test(input)) {
    // Only a signed provider callback can mark a booking as confirmed.
    return state.providerBooking?.status === "booked"
      ? { text: "Ja, dein Termin ist im Buchungssystem bestätigt.", phase: "booking_confirmed" }
      : { text: state.messages.some(m => m.role === "assistant" &&
            m.text.includes("Ich kann den Termin hier noch nicht als bestätigt sehen."))
          ? "Ich sehe weiterhin keine bestätigte Buchung. Falls du schon eine Calendly-Mail bekommen hast, klär das bitte direkt mit Jochen."
          : "Ich kann den Termin hier noch nicht als bestätigt sehen. Bitte prüf, ob du von Calendly eine Bestätigung erhalten hast.",
          phase: "booking_offered" };
  }

  // A human may reject marketing or call out mechanical questioning without
  // issuing a formal STOP. Respect that boundary instead of repeating a pitch.
  if (matches(input,
      /\b(keine werbung|kein verkaufsgesprach|keine verkaufsgesprach|kein interesse|nicht interessiert|nur schauen|ich schaue nur|ich will keine werbung|will nichts kaufen|bitte nicht verkaufen)\b/)) {
    return {
      text: "Alles gut. Kein Verkaufsgespräch. Wenn du irgendwann eine konkrete Frage hast, kannst du dich einfach melden.",
      phase: "info", infoOnly: true,
    };
  }
  if (matches(input,
      /\b(das hast du mich|hast du mich (doch )?(schon|gerade)|schon gefragt|gleiche frage|immer wieder das gleiche|fragst du nochmal)\b/)) {
    return {
      text: "Stimmt, das war doppelt. Danke für den Hinweis. Ich will dich nicht mit Fragen nerven. Sag einfach, was du gerade wissen möchtest.",
      phase: "info", infoOnly: true,
    };
  }
  if (phase === "info" && matches(input,
      /\b(danke|vielleicht spater|vielleicht melde ich mich spater|alles klar|passt so|passt fur mich|ok danke|ich lese nur|erstmal nur lesen|erst mal nur lesen)\b/)) {
    const alreadyClosed = state.messages.some(m => m.role === "assistant" &&
      m.text === "Gerne. Meld dich einfach, wenn du noch eine Frage hast.");
    return { text: alreadyClosed ? "Alles klar 👍" :
        "Gerne. Meld dich einfach, wenn du noch eine Frage hast.",
      phase: "info", infoOnly: true };
  }

  const rejectsCall = matches(input, /\b(kein(?:en)?|ohne|nicht)\s+(gesprach|strategiegesprach|termin|call)\b/);

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
  if (!rejectsCall && matches(input, /\b(strategiegesprachstermin|strategiegesprach|termin buchen|termin vereinbaren|termin ausmachen|termin machen)\b/)) {
    return bookingUrl
      ? { text: "Hier kannst du dir direkt ein Strategiegespräch aussuchen:\n" + bookingUrl,
          phase: "booking_offered", booking: true }
      : { text: "Ich gebe deinen Terminwunsch an Jochen weiter.",
          phase: "human_handover", handoff: true };
  }

  if (matches(input, /\b(wie kann ich wissen|was ist anders|warum sollte ich vertrauen|woran erkenne ich)\b/)) {
    return {
      text: "Das musst du nicht blind glauben. Jochen kann dir konkret erklären, wie er arbeitet und was die Begleitung beinhaltet. Du kannst dann in Ruhe entscheiden.\nWas wäre dir dabei am wichtigsten?",
      phase: "trust_clarify",
    };
  }
  // A question about being a sales bot is NOT evidence of a previous bad offer.
  // Identify Pete plainly before interpreting any objections or experiences.
  if (matches(input, /\b(verkaufsbot|bist du eine ki|schreibt jochen|bist du ein bot)\b/)) {
    return {
      text: "Ja, ich bin Pete, Jochens KI-Assistent. Hier muss niemand etwas kaufen. Was möchtest du gerade wissen?",
      phase: "info", infoOnly: true,
    };
  }
  if (matches(input, /\b(wieder so ein verkauf|abzock|abgezockt|abgezock|scam|verarscht|vertrauen|vertraue|geldmacherei)\b/)) {
    return {
      text: "Verstehe, dass du nach solchen Erfahrungen skeptisch bist. Ich bin Pete, Jochens KI-Assistent, und du musst hier nichts kaufen.\nWas war beim letzten Angebot für dich das größte Problem?",
      phase: "trust_clarify",
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

  // An explicit buying request must not be sent back into an opening
  // qualification flow, including when someone wants Keto coaching.
  if (matches(input,
      /\b(ich (mochte|will) (die |das )?(5[\s-]*wochen[\s-]*)?(begleitung|startphase|coaching) (buchen|kaufen)|ich will die begleitung|ich mochte die begleitung|ich will starten|ich mochte starten|direkt kaufen)\b/)) {
    return {
      text: (ketoSupport || ketoInConversation
        ? "Keto kann dabei individuell eingebaut werden, wenn es zu dir passt.\n"
        : "") +
        priceFiveWeeks +
        "\nMöchtest du dazu zuerst ein Strategiegespräch oder lieber direkt starten?",
      phase: "coaching_close", track: ketoSupport || ketoInConversation ? "keto" : "coaching",
    };
  }

  if (ketoSupport && ["opening", "info", "selfstarter_offered"].includes(phase)) {
    return {
      text: "Keto kann Jochen in die 5-Wochen-Begleitung einbauen, wenn es zu dir passt. Es ist kein Muss und kein Dogma.\n" +
        "Geht es dir gerade eher ums Anfangen oder darum, Keto im Alltag durchzuhalten?",
      phase: "keto_need", track: "keto",
    };
  }
  if (guideRequest) {
    return {
      text: "Klar 😊 Jochens Keto Guide ist kostenlos. Du bekommst ihn als PDF und als Hörversion.\n" +
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

  // A concrete question about an already shown product is not a reason to
  // restart the qualification flow. No invented product contents.
  if (phase === "selfstarter_offered" &&
      matches(input, /\b(den link schaue ich|schaue ich mir an|schaue mir den link|ich schaue es mir an|schaue mir das an|erstmal anschauen)\b/)) {
    return { text: "Klar, schau es dir in Ruhe an. Wenn etwas unklar ist, meld dich.",
      phase: "info", infoOnly: true };
  }
  if (phase === "selfstarter_offered" &&
      matches(input, /\b(was bekomme ich|was ist da drin|was beinhaltet|was ist enthalten|umfang)\b/)) {
    return { text: "Der Selbststarter ist für den eigenständigen Einstieg gedacht. Die genauen Inhalte findest du auf der Produktseite:\n" +
        OFFER_TRUTH.selfstarter.productUrl,
      phase: "selfstarter_offered", track: "selfstarter", infoOnly: true };
  }

  if (phase === "longterm_unverified") {
    if (matches(input, /\b(anrechnung|angerechnet|verrechnen|gutschrift)\b/)) {
      return { text: "Ob die fünf Wochen auf eine längere Begleitung angerechnet werden können, klärt Jochen persönlich. Ich möchte dir dazu nichts zusagen, was nicht feststeht.",
        phase: "longterm_unverified", infoOnly: true };
    }
    if (matches(input, /\b(rabatt|anzahlung|raten|rate|monatlich|zahlung|konditionen|preis|kostet|wie teuer)\b/)) {
      return { text: LONG_TERM_PRICE_UNVERIFIED_REPLY, phase: "longterm_unverified", infoOnly: true };
    }
    if (matches(input, /\b(danke|verstanden|frage ich jochen|jochen direkt|alles klar)\b/)) {
      return { text: "Genau. Jochen kann dir die aktuellen Konditionen persönlich erklären.",
        phase: "info", infoOnly: true };
    }
  }

  if (phase === "budget_clarify") {
    if (matches(input, /\b(preis|geld|budget|finanziell|kann ich nicht|zu teuer|kita[\s-]*kosten|wirklich das geld)\b/) &&
        !matches(input, /\b(unsicher|zweifel|weis nicht|weiss nicht)\b/)) {
      return { text: "Dann macht es gerade keinen Sinn, dich in eine Begleitung zu drängen.\n" +
        "Wäre ein selbstständiger Einstieg für 14,95 € eine Option oder ist im Moment auch das zu viel?",
        phase: "selfstarter_budget_offer", track: "coaching" };
    }
    return { text: "Verstanden. Was müsste für dich klarer sein, damit du einschätzen kannst, ob die Begleitung passt?",
      phase: "coaching_next", track: "coaching" };
  }
  if (phase === "selfstarter_budget_offer") {
    if (matches(input, /\b(auch das zu viel|auch nicht|gerade nicht|kein geld|kein budget|nichts kaufen|nein danke)\b/)) {
      return { text: "Verstanden. Dann lassen wir das erstmal. Wenn du später eine Frage hast, meld dich gern.",
        phase: "info", infoOnly: true };
    }
    if (matches(input, /\b(ja|okay|ok|interessiert|anschauen|selbststarter|geht|machbar|passt)\b/)) {
      return { text: selfstarterText, phase: "selfstarter_offered",
        track: "selfstarter", infoOnly: true };
    }
    return { text: "Kein Stress. Du musst dich jetzt nicht entscheiden.",
      phase: "info", infoOnly: true };
  }

  // Price reference: first use the present chat context, never a three-product list.
  if (matches(input, /\b(was kostet|preis|kosten|wie teuer|investition|sag mir jetzt den preis)\b/) &&
      !matches(input, /\b(nicht leisten|zu teuer|kein geld|kein budget|budget problem|finanziell nicht)\b/)) {
    if (isUnverifiedLongTermPriceQuestion(input)) {
      return { text: LONG_TERM_PRICE_UNVERIFIED_REPLY, phase: "longterm_unverified", infoOnly: true };
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

  if (matches(input, /\b(nicht leisten|zu teuer|kein budget|kein geld|zu viel geld|geht finanziell nicht)\b/)) {
    return {
      text: "Verstanden. Ist gerade wirklich der Preis das Problem oder bist du noch unsicher, ob die Begleitung das Richtige für dich ist?",
      phase: "budget_clarify",
    };
  }
  if (phase === "think_clarify") {
    if (matches(input, /\b(nur informieren|erstmal informieren|nicht der richtige zeitpunkt|gerade nicht)\b/)) {
      return { text: "Alles gut, dann lassen wir das erstmal so. Wenn es wieder aktuell wird, kannst du dich melden.",
        phase: "info", infoOnly: true };
    }
    return { text: "Verstanden. Was wäre für dich gerade der wichtigste Punkt, damit du entscheiden kannst, ob die Begleitung sinnvoll ist?",
      phase: "coaching_next", track: "coaching" };
  }
  if (matches(input, /\b(ich muss uberlegen|muss ich uberlegen|ich uberlege es mir|bin noch unsicher|brauche bedenkzeit|noch nicht sicher)\b/)) {
    return {
      text: "Klar, nimm dir die Zeit. Ist noch etwas zur Begleitung offen oder passt der Zeitpunkt gerade nicht?",
      phase: "think_clarify",
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
  if ((matches(input, /\b(keine zeit|wenig zeit|keinen freiraum)\b/) &&
       matches(input, /\b(sport|training|fitness|trainieren)\b/)) ||
       matches(input, /\b(fur sport .*keine zeit)\b/)) {
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
    if (matches(input, /\b(familie|familienessen|kochen|extra kochen|alle|kinder)\b/)) {
      return {
        text: "Wenn du für alle kochst, darf Keto nicht bedeuten, dass du jeden Abend zwei Gerichte machen musst.\n" +
          "Wo hakt es eher: beim gemeinsamen Essen oder bei der Planung?",
        phase: "blocker", track: "keto",
      };
    }
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
        (rejectsCall || !matches(input, /\b(gesprach|strategie|termin)\b/))) {
      return {
        text: "Hier kannst du dir die 5-Wochen-Startphase ansehen und direkt starten:\n" +
          OFFER_TRUTH.coachingEntry.checkoutUrl,
        phase: "checkout_offered", track: ketoInConversation ? "keto" : "coaching",
      };
    }
    if (!rejectsCall && matches(input, /\b(termin|gesprach|strategie)\b/)) {
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

  // Answer a specific trust question with what Jochen actually does,
  // instead of restarting from "largest everyday problem" or pushing a call.
  if (matches(input, /\b(was ist bei jochen anders|was macht jochen anders|was macht ihr anders)\b/)) {
    return { text: "Jochen verbindet kurze, alltagstaugliche Bewegung mit familienkompatibler Ernährung und schaut auch auf Schlaf und Stress. Das ist keine Erfolgsgarantie, und du musst hier nichts überstürzen.",
      phase: "info", infoOnly: true };
  }
  // A past objection must never swallow a new explicit guide, product,
  // price, booking or other context-switch request from the lead.
  if (phase === "trust_clarify") {
    return {
      text: "Kann ich verstehen. Du musst hier keine Entscheidung treffen.\nWas wäre dir wichtig, damit du dich bei einer Begleitung gut aufgehoben fühlst?",
      phase: "info",
    };
  }

  if (phase === "preference") {
    if (matches(input, /\b(keinen starren plan|nicht schon wieder einen starren plan|keine starre diat|keine strenge diat)\b/)) {
      return { text: "Das verstehe ich. Noch ein starrer Plan, der nicht zum Familienalltag passt, bringt dir nichts.\nWäre dir flexible Unterstützung beim Umsetzen lieber?",
        phase: "preference", track: ketoInConversation ? "keto" : undefined };
    }
    if (wantsSelfGuided(input)) {
      return { text: selfstarterText, phase: "selfstarter_offered", track: "selfstarter", infoOnly: true };
    }
    if (wantsPersonalSupport(input)) {
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

  if (phase === "opening" && matches(input,
      /\b(schon alles versucht|schon viel probiert|mehrfach angefangen|zweimal angefangen|wieder aufgehort|immer wieder aufgehort|nicht drangeblieben|durchhalten klappt nicht)\b/)) {
    return {
      text: "Klingt, als wäre Dranbleiben bisher der Knackpunkt. Woran ist es meistens gescheitert?",
      phase: "blocker",
    };
  }

  if (phase === "attempts") {
    if (matches(input, /\b(noch nie|nie richtig|gar nichts|noch nichts|nichts probiert|noch nicht angefangen)\b/)) {
      return {
        text: "Dann bist du eher am Anfang, und das ist völlig okay. Was würde dir den Einstieg gerade am meisten erleichtern?",
        phase: "blocker", track: ketoInConversation ? "keto" : undefined,
      };
    }
    return {
      text: "Du hast also schon etwas probiert, aber es hat nicht dauerhaft gepasst.\n" +
        "Woran ist es bisher meistens gescheitert?",
      phase: "blocker", track: ketoInConversation ? "keto" : undefined,
    };
  }
  if (phase === "blocker") {
    if (matches(input, /\b(job|familie|kinder|schlaf|schichten)\b/) &&
        matches(lastMessages, /\b(nicht mal zehn|wirklich null|gar keine zeit)\b/)) {
      return {
        text: "Mit Job und Familie ist bei dir gerade wirklich alles voll. Da muss jetzt nicht noch ein Trainingsprogramm oben drauf. Wenn wieder etwas Luft ist, können wir einen kleinen Einstieg suchen.",
        phase: "info", infoOnly: true,
      };
    }
    if (matches(input, /\b(unsicher|ob ich das packe|nicht schaffen|schaffe es nicht|angst dass)\b/)) {
      return {
        text: "Klar, wenn du erst anfängst, ist das eine Hürde. Es muss nicht gleich ein perfekter Trainingsplan sein.\nWas wäre für dich ein kleiner realistischer Anfang?",
        phase: "preference",
      };
    }
    if (matches(input, /\b(weiss nicht|weis nicht|keine ahnung|nicht sagen|weiss selber nicht|unsicher ob)\b/)) {
      return { text: "Okay, dann will ich dir keine Ursache unterstellen.\nWas kommt dir am ehesten dazwischen: Zeit, Energie oder Planung?",
        phase: "blocker", track: ketoInConversation ? "keto" : undefined };
    }
    if (wantsPersonalSupport(input)) {
      return {
        text: "Du willst also nicht noch einen Plan, sondern Unterstützung beim Dranbleiben.\n" +
          "Was wäre für dich das wichtigste Ergebnis nach fünf Wochen?",
        phase: "coaching_goal", track: ketoInConversation ? "keto" : "coaching",
      };
    }
    if (wantsSelfGuided(input)) {
      return { text: selfstarterText, phase: "selfstarter_offered", track: "selfstarter",
        infoOnly: true };
    }
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

  // Reflect concrete shift-work context instead of the generic "kids + job" line.
  if (matches(input, /\b(schichtdienst|schichtarbeit|schichten|nachtschicht|fruhschicht|spatschicht)\b/) &&
      matches(input, /\b(papa|mama|vater|mutter|kinder|kindern)\b/) &&
      matches(input, /\b(platt|mude|erschopft|leer|keine energie|kaputt|fertig)\b/)) {
    const children = matches(input, /\b(drei|3) (?:kinder|kindern)\b/) ? "Drei Kinder" :
      matches(input, /\b(zwei|2) (?:kinder|kindern)\b/) ? "Zwei Kinder" : "Kinder";
    return {
      text: children + ", Schichtdienst und abends völlig platt. Was schlaucht dich gerade mehr: der Schlaf oder die Arbeit?",
      phase: "energy_source",
    };
  }
  if (matches(input, /\b(papa|mama|vater|mutter|kinder|kindern|schichtdienst|schichtarbeit)\b/) &&
      matches(input, /\b(platt|mude|erschopft|leer|keine energie|kaputt|fertig)\b/)) {
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
