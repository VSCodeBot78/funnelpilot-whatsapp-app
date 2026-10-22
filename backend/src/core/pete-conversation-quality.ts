/**
 * Pete's dialogue policy.
 *
 * Trusted transaction facts and genuine safety remain deterministic.
 * A generic mention of "Termin", "Preis" or "Coaching" in a longer
 * question MUST NOT divert the entire answer into the legacy questionnaire.
 */
import { OFFER_TRUTH, isUnverifiedLongTermPriceQuestion,
  LONG_TERM_PRICE_UNVERIFIED_REPLY } from "../config/offer-truth.js";
import type { ConversationState } from "../types/types.js";

export type PeteVerifiedAnswer = {
  text: string;
  handoff?: boolean;
  nextPhase?: string;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

const has = (s: string, regex: RegExp) => regex.test(norm(s));

// Shared opt-out recognition: the same explicit paid-offer refusal must
// suppress an immediate upsell AND persistently block scheduled sales follow-ups.
// Input is already normalized by the calling function.
// Lack of a previously received offer is not an opt-out if the parent
// explicitly asks us to provide one. Distinguish this from "keine weiteren
// Angebote" and never treat a positive offer request as a no-follow-up flag.
function isExplicitOfferRequest(input: string): boolean {
  // "I haven't received an offer" is not a decline, but "can you tell me why"
  // is not consent to be sold to either. Require a concrete offer request.
  return /\b(?:noch\s+)?kein(?:e|en)?\s+(?:angebote?|kaufangebote?)\s+(?:bekommen|erhalten|gefunden)\b/.test(input) &&
    (/\b(?:kannst du mir|konnt ihr mir|habt ihr)\s+(?:bitte\s+)?(?:noch\s+)?(?:(?:ein(?:e|en|es)?|das|den)\s+)?(?:angebote?|eins|eines|einen)\b/.test(input) ||
     /\b(?:schick\w*|sende\w*|zeig\w*)\s+(?:ihr\s+)?(?:mir\s+)?(?:bitte\s+)?(?:(?:ein(?:e|en|es)?|das|den)\s+)?(?:angebote?|eins|eines|einen)\b/.test(input));
}

// Reporting that no offer was received is a factual observation, not a ban on
// future sales messages. Keep explicit refusals in the same message intact.
function withoutMissingOfferStatements(input: string): string {
  return input.replace(
    /\b(?:(?:ich\s+)?(?:habe|hab|hatte)|wir\s+(?:haben|hatten))\s+(?:(?:bisher|bislang|noch|gar|uberhaupt)\s+){0,4}kein(?:e|en)?\s+(?:angebote?|kaufangebote?)\s+(?:bekommen|erhalten|gefunden)\b/g,
    " ",
  );
}

function isExplicitPaidOfferRefusal(input: string): boolean {
  if (isExplicitOfferRequest(input)) return false;
  const refusalText = withoutMissingOfferStatements(input);
  return (
    /\b(?:bitte\s+)?(?:auch\s+)?keine?\s+(?:(?:weiteren?|anderen?|gunstigeren?|billigeren?)\s+)?(?:kaufalternativen?|kaufangebote?|verkaufsangebote?|angebote?|selbststarter(?:-option)?)\b/.test(refusalText) ||
    /\b(?:ich\s+(?:will|mochte)\s+)?(?:wirklich\s+|gar\s+)?nichts\s+(?:kaufen|bestellen)\b/.test(refusalText) ||
    /\b(?:bitte\s+)?keine?\s+(?:weitere[nr]?\s+)?(?:verkaufsnachrichten?|kaufangebote?)\b/.test(refusalText) ||
    /\b(?:lass|lasst|lassen)\s+(?:mal\s+|bitte\s+)?(?:alle\s+)?(?:angebote?|verkaufsangebote?)\b/.test(refusalText)
  );
}


export function getPeteVerifiedTransactionAnswer(
  text: string, state: ConversationState, bookingUrl?: string,
): PeteVerifiedAnswer | null {
  const input = norm(text);
  // Exact source keywords are verified resource requests, including when
  // the genuinely conversational LLM path is selected. Never ask the model
  // to generate URLs or turn a keyword into a coaching sales pitch.
  const keyword = input.trim();
  // Already received the guide, and explicitly no coaching interest:
  // answer without an LLM and without promising any cross-channel follow-up state.
  if (/\b(?:danke|hab|habe|bekommen|bereits|schon)\b.{0,60}\bketo[\s-]*guide\b/.test(input) &&
      /\b(?:kein|keine|keinen|nicht|ohne)\b.{0,40}\b(?:coaching|begleitung|verkauf)\b/.test(input)) {
    return { text: "Gerne, lies den Guide in Ruhe. Wenn später eine konkrete Frage auftaucht, kannst du dich melden.", nextPhase: "info" };
  }
  if (keyword === "check") {
    return { text: "Hier ist der kostenlose Elternfitness-Check: " +
      OFFER_TRUTH.resources.elterncheck.url, nextPhase: "info" };
  }
  if (keyword === "keto") {
    return { text: "Hier findest du den kostenlosen Keto Guide als PDF und Hörversion: " +
      OFFER_TRUTH.resources.ketoGuide.url, nextPhase: "info" };
  }
  if (keyword === "bullshit" || keyword === "no bullshit") {
    return { text: "Hier kannst du dir den No Bullshit Elternfitness Selbststarter anschauen: " +
      OFFER_TRUTH.selfstarter.productUrl, nextPhase: "selfstarter_offered" };
  }
  // Mixed messages can contain both old buying words and a newer refusal.
  // Detect the current refusal BEFORE any checkout or paid-product CTA.
  const explicitlyDeclinesPaidOffers = isExplicitPaidOfferRefusal(input);
  // Scope is not proof: do not invent a number of coaching/video calls.
  // Answer an exact benefits question without assigning ownership to Jochen.
  const asksExactPersonalCalls =
    /\b(?:wie viele|wieviele|anzahl|wie oft)\b.{0,85}\b(?:videoanruf\w*|video.?call\w*|coach(?:ing)?call\w*|gesprach\w*)\b/.test(input) &&
    /\b(?:pro woche|je woche|enthalten|inbegriffen|im preis|startphase|begleitung)\b/.test(input);
  if (asksExactPersonalCalls) {
    return { text: "Eine verbindliche Anzahl persönlicher Videoanrufe pro Woche ist in den geprüften Angebotsdaten nicht hinterlegt. Ich möchte dir nichts zusagen, was nicht bestätigt ist. Den genauen Umfang kannst du vor einer Entscheidung mit Jochen klären.", nextPhase: "info" };
  }

  // A concrete purchase request must lead to the VERIFIED product URL now.
  // Never let the model invent a future checkout event or a fake payment.
  const declinedSelfstarterPurchase =
    /\b(?:nicht|kein|keinen|nie|niemals)\s+(?:jetzt\s+|mehr\s+|direkt\s+|aktuell\s+)?(?:kaufen|bestellen)\b/.test(input) ||
    /\b(?:kein|keinen)\s+(?:kauf|interesse)\b/.test(input);
  if (/\bselbststarter\b/.test(input) && !declinedSelfstarterPurchase && !explicitlyDeclinesPaidOffers &&
      /\b(?:kaufen|bestellen|bestell\w*|wo kann ich|wie kann ich|zum checkout|zur kasse)\b/.test(input) &&
      !/\b(?:schon|bereits)\s+(?:gekauft|bestellt|bezahlt)\b/.test(input)) {
    return {text:"Hier findest du den No Bullshit Elternfitness Selbststarter: " +
      OFFER_TRUTH.selfstarter.productUrl + ". Die verbindliche Gesamtsumme und Bedingungen siehst du vor dem Kauf im Checkout.",
      nextPhase:"selfstarter_offered"};
  }
  // An explicit buyer of the VERIFIED five-week entry may receive its stored
  // checkout directly. A vague interest or price objection is NOT consent.
  // Avoid guessing which offer the lead means if several are mentioned.
  const namesFiveWeek = /\b(?:5[\s-]*wochen|funf[\s-]*wochen|startphase)\b/.test(input);
  const explicitlyBuysFiveWeek =
    /\bich (?:will|mochte|nehme)\b.{0,110}\b(?:kaufen|bestellen)\b/.test(input) ||
    /\b(?:wo|wie)\s+(?:kann|konnt)\w*\b.{0,90}\b(?:kaufen|bestellen)\b/.test(input) ||
    /\b(?:schick|sende|gib|zeig)\w*\b.{0,90}\b(?:link|checkout|kaufweg)\b/.test(input);
  const asksFiveWeekDetails =
    /\b(?:was bekomme|was beinhaltet|welche leistungen|wie viele|wie oft)\b/.test(input);
  const hasFiveWeekBudgetBarrier =
    /\b(?:kein(?:e|en)?\s+(?:geld|budget)|nicht\s+leisten|zu\s+teuer|sprengt\s+(?:mein|das)\s+budget|geld\s+reicht\s+nicht|nicht\s+bezahlbar|nicht\s+finanzierbar|nicht\s+(?:genug|genugend)\s+geld|zu\s+wenig\s+geld)\b/.test(input) ||
    /\b(?:wenn|falls)\b.{0,80}\b(?:geld|budget)\b.{0,30}\b(?:habe|reicht|da)\b/.test(input);
  // A conditional "I want to buy, but first..." is not a finalized purchase
  // decision. Leave an unresolved joint decision or reflection to the
  // regular respectful conversation path, never force a checkout link.
  const hasPendingFiveWeekDecision =
    /\b(?:erst|noch|vorher|zuerst|muss)\b.{0,75}\b(?:frau|mann|partner(?:in)?|ehepartner(?:in)?)\b.{0,35}\b(?:fragen|besprechen|sprechen|absprechen|zustimm\w*|klaren|reden)\b/.test(input) ||
    /\b(?:wenn|falls)\b.{0,80}\b(?:frau|mann|partner(?:in)?)\b.{0,40}\b(?:zustimm\w*|einverstanden)\b/.test(input) ||
    /\b(?:brauche|warte|erst)\b.{0,75}\b(?:zustimmung|einverstandnis)\b.{0,50}\b(?:frau|mann|partner(?:in)?)\b/.test(input) ||
    /\bohne\b.{0,55}\b(?:frau|mann|partner(?:in)?)\b.{0,35}\b(?:fragen|einverstandnis|zustimmung)\b/.test(input) ||
    /\b(?:erst|noch|muss)\b.{0,35}\b(?:daruber|druber)\b.{0,20}\bschlafen\b/.test(input) ||
    /\b(?:aber|erst|noch|vorher|zuerst|brauche)\b.{0,70}\b(?:bedenkzeit|daruber|druber|nachdenken|uberlegen|zustimmung)\b/.test(input) ||
    /\bkeine\s+weiteren?\s+(?:nachrichten|verkaufsnachrichten)\b/.test(input);
  if (namesFiveWeek && explicitlyBuysFiveWeek &&
      !hasFiveWeekBudgetBarrier && !hasPendingFiveWeekDecision &&
      !asksFiveWeekDetails && !/\b(?:selbststarter|6[\s-]*monat|sechs[\s-]*monat)\b/.test(input) &&
      !declinedSelfstarterPurchase && !explicitlyDeclinesPaidOffers) {
    return {
      text: "Hier ist der hinterlegte Kaufweg für die persönliche 5-Wochen-Startphase: " +
        OFFER_TRUTH.coachingEntry.checkoutUrl +
        ". Bitte prüfe die verbindlichen Angaben im Checkout vor einer Bestellung.",
      nextPhase: "info",
    };
  }

  // Verified offer facts win over a generic LLM answer when a parent asks
  // about the concrete time commitment or DIY scope. We have no approved
  // minute-per-day promises or detailed module inventory in offer-truth.
  const selfstarterMentioned = /\bselbststarter\b/.test(input);
  const fiveWeekMentioned = /\b(?:5[\s-]*wochen|funf[\s-]*wochen|startphase)\b/.test(input);
  const asksTimeCommitment =
    /\b(?:wie\s+viel\s+zeit|wieviel\s+zeit|zeitaufwand|wie\s+lange\s+dauert|wie\s+viele\s+(?:minuten|stunden))\b/.test(input);
  if (asksTimeCommitment && selfstarterMentioned && !fiveWeekMentioned && !explicitlyDeclinesPaidOffers) {
    return {
      text: "Den Selbststarter nutzt du eigenständig, ohne persönliches Einzelcoaching. Einen verbindlichen Zeitaufwand kann ich dir dafür nicht nennen, weil dazu keine geprüfte Angabe vorliegt. Die Produktinhalte findest du hier: " +
        OFFER_TRUTH.selfstarter.productUrl,
      nextPhase: "info",
    };
  }
  if (asksTimeCommitment && fiveWeekMentioned && !selfstarterMentioned) {
    return {
      text: "Die persönliche Startphase dauert fünf Wochen. Wie viele Minuten oder Stunden pro Woche du dafür einplanen musst, ist hier nicht verbindlich hinterlegt. Den genauen Aufwand kann Jochen mit dir klären.",
      nextPhase: "info",
    };
  }
  const asksSelfstarterContents =
    /\b(?:was|welche)\b.{0,65}\b(?:drin|enthalten|beinhaltet|inhalt\w*|umfang|bekomme)\b/.test(input) ||
    /\b(?:einzelcoaching|selbermachen|selbst\s+machen|eigenstandig)\b/.test(input);
  if (selfstarterMentioned && asksSelfstarterContents && !explicitlyDeclinesPaidOffers) {
    return {
      text: "Der Selbststarter kostet " + OFFER_TRUTH.selfstarter.priceText +
        ", ist zum eigenständigen Umsetzen gedacht und kein persönliches Einzelcoaching. Die genaue Inhaltsliste steht auf der Produktseite: " +
        OFFER_TRUTH.selfstarter.productUrl,
      nextPhase: "info",
    };
  }

  // Topic switch or explicit interest in a free resource. Do not repeat an
  // already-delivered guide merely because someone says thanks or no coaching.
  if (/\bketo[\s-]*guide\b/.test(input) &&
      (/\b(?:interessier\w*|mochte|will|hatte gern|suche|brauche|wo finde|wo bekomme)\b.{0,100}\bketo[\s-]*guide\b/.test(input) ||
       /\b(?:schick\w*|sende\w*|zeig\w*|kannst du mir|bitte|sondern)\b.{0,100}\bketo[\s-]*guide\b/.test(input)) &&
      !/\b(?:kein(?:en|e)?|ohne)\s+(?:(?:den|einen|kostenlosen?|gratis)\s+){0,3}keto[\s-]*guide\b/.test(input) &&
      !/\bketo[\s-]*guide\b.{0,22}\b(?:nicht|kein|keinen)\b/.test(input) &&
      !/\b(?:habe|hab|schon|bekommen|gelesen)\b.{0,15}\bketo[\s-]*guide\b/.test(input)) {
    return {text:"Klar, hier ist der kostenlose Keto Guide als PDF und Hörversion: " +
      OFFER_TRUTH.resources.ketoGuide.url, nextPhase:"info"};
  }
  // A budget objection is NOT consent to pitch a cheaper option.
  // Explicitly declining alternative purchases takes priority over offers.
  // Keep this deterministic because a generic prompt cannot reliably undo
  // a scripted low-price upsell in the verified-transaction path.
  if (explicitlyDeclinesPaidOffers) {
    return { text: "Verstanden. Dann lasse ich Kaufangebote weg. Wenn du später von dir aus eine Frage hast, kannst du dich melden.", nextPhase: "info" };
  }
  // When someone explicitly has *no* money, do not pitch an allegedly
  // affordable product. The person can request a self-directed offer later.
  if (/\b(?:gar kein geld|kein budget|kein geld|uberhaupt kein geld)\b/.test(input) &&
      /\b(?:coaching|begleitung|startphase)\b/.test(input)) {
    return { text: "Dann ist eine kostenpflichtige Begleitung gerade nicht passend. Du musst dafür keine Schulden machen oder dich jetzt entscheiden." };
  }
  // A price boundary is not an emergency or a reason for compulsory handover.
  if (/\b(?:499\s*euro|499\s*€|coaching|begleitung)\b/.test(input) &&
      /\b(?:zu teuer|zu viel|nicht leisten|sprengt mein budget|kein geld)\b/.test(input) &&
      !/\b(?:ratenzahlung|raten|vertrag|rechnung|zahlung|gebucht|gekauft)\b/.test(input)) {
    return {text:"Klar, das ist mit Kindern und vielen Ausgaben keine Kleinigkeit. Ich mache da keinen Druck. Falls du lieber eigenständig starten möchtest, kann ich dir die Selbststarter-Option erklären."};
  }
  // A CTA-click in an already documented Selfstarter conversation is a
  // request for the link, not permission to replay the entire advertising pitch.
  // The old ManyChat word "Bundle" must never invent an unknown other offer.
  const wantsBundleLink = /\b(?:zeig(?:e)? mir|schick mir|sende mir|link (?:zum|furs|fuer das))\b.{0,38}\bbundle\b/.test(input) ||
    /\bwo (?:finde|bekomme) ich\b.{0,35}\bbundle\b/.test(input);
  const previousSelfstarter = (state.messages ?? []).slice(0, -1).some(message => {
    const earlier = norm(message.text).trim();
    return (message.role === "user" && /^(?:no )?bullshit$/.test(earlier)) ||
      (message.role === "assistant" &&
        (message.text.includes(OFFER_TRUTH.selfstarter.productUrl) ||
          /no bullshit elternfitness selbststarter/i.test(message.text)));
  });
  // The verified selfstarter product page allows independent checkout.
  // A follow-up about a compulsory call is NOT a human-handover request.
  // Require the VERIFIED selfstarter link in this same conversation first.
  const asksBuyWithoutAppointment =
    /\b(?:kaufen|bestellen|direkt|link|checkout)\b/.test(input) &&
    /\b(?:ohne|kein(?:en|e)?|pflicht)\b.{0,30}\b(?:pflichttermin|pflichtcall|strategiegesprach|termin|call|gesprach)\b/.test(input);
  if (asksBuyWithoutAppointment && previousSelfstarter && !explicitlyDeclinesPaidOffers) {
    return { text: "Ja, den Selbststarter kannst du eigenständig über die Produktseite kaufen, ohne vorheriges Strategiegespräch. Hier ist der verifizierte Link: " +
      OFFER_TRUTH.selfstarter.productUrl +
      ". Die verbindliche Gesamtsumme und Bedingungen stehen vor dem Kauf im Checkout.",
      nextPhase: "selfstarter_offered" };
  }
  // A repeat link request uses ONLY a checkout URL already delivered in this
  // conversation AND still approved in offer-truth. No model-generated link,
  // no guessed product and no unverified payment/booking confirmation.
  const asksToResendCheckout =
    /\b(?:schick\w*|sende\w*|gib|zeig\w*)\b.{0,70}\b(?:link|kaufweg|checkout)\b/.test(input) &&
    /\b(?:noch\s*mal|nochmal|erneut|wieder|verloren|nicht mehr)\b/.test(input) &&
    !/\b(?:nicht|kein(?:e|en|es)?)\b.{0,30}\b(?:schick\w*|sende\w*|gib|link|kaufweg|checkout)\b/.test(input) &&
    !/\b(?:link|kaufweg|checkout)\b.{0,25}\bnicht\s+(?:mehr\s+)?(?:noch\s*mal|nochmal|schicken|senden)\b/.test(input);
  if (asksToResendCheckout && !explicitlyDeclinesPaidOffers &&
      !/\b(?:keto|elterncheck|fitnesscheck)\b/.test(input)) {
    const previousCheckout = (state.messages ?? []).slice(0, -1).slice(-30).reverse().find(message =>
      message.role === "assistant" &&
      (message.text.includes(OFFER_TRUTH.selfstarter.productUrl) ||
       message.text.includes(OFFER_TRUTH.coachingEntry.checkoutUrl)));
    if (previousCheckout) {
      const hasSelfstarter = previousCheckout.text.includes(OFFER_TRUTH.selfstarter.productUrl);
      const hasCoaching = previousCheckout.text.includes(OFFER_TRUTH.coachingEntry.checkoutUrl);
      const namedSelfstarter = /\bselbststarter\b/.test(input);
      const namedCoaching = /\b(?:coaching|startphase|5[\s-]*wochen)\b/.test(input);
      if (hasSelfstarter !== hasCoaching &&
          (!namedSelfstarter || hasSelfstarter) &&
          (!namedCoaching || hasCoaching)) {
        return hasSelfstarter
          ? { text: "Klar, hier ist der verifizierte Selbststarter-Link noch einmal: " +
              OFFER_TRUTH.selfstarter.productUrl, nextPhase: "selfstarter_offered" }
          : { text: "Klar, hier ist der verifizierte Link zur 5-Wochen-Startphase noch einmal: " +
              OFFER_TRUTH.coachingEntry.checkoutUrl +
              ". Die verbindlichen Bedingungen siehst du vor dem Kauf im Checkout.", nextPhase: "info" };
      }
    }
  }

  if (wantsBundleLink && previousSelfstarter && !explicitlyDeclinesPaidOffers) {
    return { text: "Klar, hier kannst du dir den No Bullshit Elternfitness Selbststarter anschauen: " +
      OFFER_TRUTH.selfstarter.productUrl, nextPhase: "selfstarter_offered" };
  }
  // An actual report of duplicate cross-channel messages is an incident,
  // not a multi-turn FAQ. Hand it to Jochen on the FIRST report. Do not
  // imply that the other provider (e.g. ManyChat) has already been paused.
  const twoNamedChannels = /\binstagram\b/.test(input) && /\bwhatsapp\b/.test(input);
  const actualDoubleReply = (
    /\b(?:bekomm\w*|erhalt\w*|krieg\w*|schreib\w*|antwort\w*|kommen)\b.{0,72}\b(?:beiden? kanal\w*|beiden?|doppelt|zweimal|gleichzeitig)\b/.test(input) ||
    /\b(?:beiden? kanal\w*|doppelt|zweimal|gleichzeitig)\b.{0,72}\b(?:antwort\w*|nachricht\w*|bots?|geschrieb\w*)\b/.test(input)
  );
  const explicitDoubleBotComplaint =
    /\b(?:zwei\s+bots|doppel\w*|gleichzeitig)\b/.test(input) &&
    /\b(?:antwort\w*|nachricht\w*|bots?|angeschrieb\w*|angequatscht|schreib\w*|nerv\w*)\b/.test(input);
  if ((twoNamedChannels && actualDoubleReply) || explicitDoubleBotComplaint) {
    return {
      text: "Das klingt nach doppelten Antworten. Ich gebe den Chat an Jochen zur Prüfung weiter und pausiere Pete hier. Ob auf dem anderen Kanal noch etwas läuft, muss Jochen separat prüfen.",
      handoff: true,
    };
  }
  // Cross-channel delivery is not verifiable from this single chat.
  // Never promise Instagram or WhatsApp automation will stop elsewhere.
  const recentMultiChannelComplaint = (state.messages ?? []).slice(0, -1).slice(-8).some(message =>
    message.role === "user" &&
    /\binstagram\b/.test(norm(message.text)) &&
    /\bwhatsapp\b/.test(norm(message.text)));
  const asksWhoStopsWhenHumanWrites =
    /\b(?:jochen|menschen|personlich)\b/.test(input) &&
    /\b(?:ki|bot|automatik)\b/.test(input) &&
    /\b(?:stopp\w*|aufhor\w*|paus\w*|nicht mehr|ubernehm\w*)\b/.test(input);
  if (recentMultiChannelComplaint && asksWhoStopsWhenHumanWrites) {
    return {
      text: "Sobald Jochen diesen Chat tatsächlich übernimmt, muss Pete dort pausiert bleiben. Ob die Automatik in einem anderen Kanal ebenfalls gestoppt ist, kann ich hier nicht verifizieren oder garantieren. Jochen muss das im System prüfen.",
      handoff: true,
    };
  }
  if (recentMultiChannelComplaint &&
      /\b(?:zwei\s+bots|doppel\w*|gleichzeitig|beide\w*|kanal\w*)\b/.test(input) &&
      /\b(?:nicht|nerv\w*|schreib\w*|antwort\w*|angeschrieb\w*|angequatscht)\b/.test(input)) {
    return {
      text: "Das verstehe ich. Ich kann hier nicht zuverlässig feststellen, was auf dem anderen Kanal noch automatisch läuft. Ich verspreche daher nicht, dass schon alles stillgelegt ist. Jochen kann die Kanalsteuerung prüfen.",
    };
  }
  const twoChannels = /\binstagram\b/.test(input) && /\bwhatsapp\b/.test(input);
  const crossChannelConcern = /\b(?:doppel\w*|beide\w*|kanal\w*|chat\w*)\b/.test(input) &&
    /\b(?:antwort\w*|nachricht\w*|bot\w*|schreib\w*|automatisch)\b/.test(input);
  if (twoChannels && crossChannelConcern) {
    return {
      text: "Doppelte Antworten auf Instagram und WhatsApp wären nervig. Ich kann in diesem Chat nicht prüfen oder garantieren, dass die Automatik im anderen Kanal pausiert. Das sollte Jochen im System prüfen. Ich behaupte nicht, dass es schon abgeschaltet ist.",
    };
  }
  if (/\b(?:garantier\w*|sicherstell\w*|versprech\w*)\b/.test(input) &&
      /\b(?:kanal\w*|doppel\w*|chat\w*|whatsapp|instagram)\b/.test(input)) {
    return {
      text: "Eine automatische Sperre über beide Kanäle hinweg kann ich hier nicht verifizieren oder garantieren. Jochen muss die konkreten Einstellungen prüfen, bevor ich dazu eine Zusage machen dürfte.",
    };
  }

  // "Bought yesterday, access email missing" is an ownership issue even when
  // the lead does not use the exact word "payment" or "receipt".
  if (/\b(?:selbststarter|buch|produkt|coaching)\b/.test(input) &&
      /\b(?:gekauft|bestellt|bezahlt)\b/.test(input) &&
      /\b(?:zugangs\w*|zugang|freischalt\w*|login)\b/.test(input) &&
      /\b(?:nicht|kein\w*|fehl\w*|vermisse\w*|finde\w*\s+nicht)\b/.test(input)) {
    return {
      text: "Ob der Kauf erfasst wurde und warum deine Zugangs-Mail fehlt, kann ich hier nicht verlässlich prüfen. Bitte prüf auch den Spam-Ordner. Wenn nichts angekommen ist, gebe ich den Vorgang an Jochen zur tatsächlichen Bestellprüfung weiter, ohne einen Zahlungseingang zu bestätigen.",
      handoff: true,
    };
  }

  const asksVerifiedStatus =
    /\b(?:bestatigt|bestatigung|verifiziert|wirklich gebucht|tatsachlich gebucht|sicher gebucht|angekommen|zahlungseingang|habe bezahlt|hab bezahlt|zugang fehlt|bestellung|kaufbeleg|abbuchung)\b/.test(input) &&
    /\b(?:termin|kalender|calendly|buchung|gebucht|zahlung|bezahlt|gekauft|bestellung|zugang|kauf|rechnung|bezahlen)\b/.test(input);
  const payment = /\b(?:bezahlt|zahlung|abbuchung|rechnung|kaufbeleg|bestellung|gekauft|zugang fehlt|zahlungseingang)\b/.test(input);
  const booking = /\b(?:termin|gebucht|kalender|calendly|buchung)\b/.test(input);

  // Verification wins over any past sales choice. Never use user testimony
  // as proof of a transaction.
  if (asksVerifiedStatus) {
    if (payment) {
      return {
        text: "Ob deine Zahlung eingegangen ist, kann ich im Chat nicht verlässlich prüfen. Ich gebe den Vorgang an Jochen zur persönlichen Prüfung weiter. Eine Bestätigung wäre sonst geraten.",
        handoff: true,
      };
    }
    if (booking) {
      return state.providerBooking?.status === "booked"
        ? { text: "Der Termin ist im angebundenen Buchungssystem bestätigt." }
        : {
          text: "Ich sehe hier keine verifizierte Buchungsbestätigung. Eine eigene Nachricht reicht dafür nicht. Prüfe bitte deine Bestätigung vom Buchungssystem. Falls etwas nicht stimmt, klärt Jochen das persönlich.",
          handoff: true,
        };
    }
  }

  // Identical concern, even without exact "confirmed" vocabulary.
  if (/\b(?:hab|habe)\s+(?:einen\s+)?termin\s+gebucht\b/.test(input) ||
      /\b(?:hab|habe)\s+gebucht\b/.test(input)) {
    return state.providerBooking?.status === "booked"
      ? { text: "Der Termin ist im angebundenen Buchungssystem bestätigt." }
      : { text: "Deine Nachricht allein bestätigt die Buchung noch nicht. Bitte prüf die Buchungsbestätigung. Wenn sie fehlt, kann Jochen das persönlich klären." };
  }

  // A historical bad checkout experience is not a current payment dispute.
  if (/\b(?:checkout|kasse|bestellprozess)\b/.test(input) &&
      /\b(?:uberrasch\w*|schlechte\s+erfahrung\w*|abofalle|reingefallen)\b/.test(input) &&
      !/\b(?:bezahlt|gekauft|bestellt|zahlungseingang)\b/.test(input)) {
    return { text: "Bei einer schlechten Checkout-Erfahrung lohnt es sich, die Bedingungen vor einem Kauf genau anzusehen. Ich kann keine Vertragsdetails bestätigen, die ich nicht geprüft habe. Schau dir die Kaufübersicht in Ruhe an, bevor du dich entscheidest." };
  }

  // Fearing checkout extras is a factual trust question, not proof of a
  // purchase or an invitation to make unverified "no extra charges" claims.
  if (/\b(?:versteckt\w*\s+(?:kosten|gebuhren|extras)|zusatzkosten|ungewollte extras|unerwartete gebuhren)\b/.test(input)) {
    return {
      text: "Verständlich, dass du vor dem Kauf Klarheit willst. Schau dir bitte die Gesamtsumme und Bedingungen in der Kaufübersicht an. Falls etwas unklar bleibt, prüft Jochen das persönlich. Ich kann zusätzliche Kosten weder ausschließen noch bestätigen.",
    };
  }

  // A lead's own claim is not a verified payment; missing access requires
  // actual owner intervention, even if the user's wording is elliptical.
  if (/\b(?:zahlung|bezahlt|gekauft|bestellung|kauf)\b/.test(input) &&
      /\b(?:zugang|freischaltung|freigeschaltet|login)\b/.test(input) &&
      /\b(?:fehlt|vermisst|nicht erhalten|nicht bekommen|pruf\w*|problem)\b/.test(input)) {
    return {
      text: "Das sollte niemand raten: Ob die Zahlung angekommen ist und warum der Zugang fehlt, muss anhand der tatsächlichen Bestellung geprüft werden. Ich gebe den Vorgang an Jochen weiter, ohne den Kauf als bestätigt zu markieren.",
      handoff: true,
    };
  }

  // "I may have bought it but cannot find a receipt" is about verifying a
  // transaction, not a lead to ask about their training motivation.
  if (/\b(?:selbststarter|produkt|buch|kauf|zahlung|bestellung|gekauft)\b/.test(input) &&
      /\b(?:beleg|bestatigung|rechnung|abgebucht)\b/.test(input) &&
      /\b(?:kein\w*|nicht|fehlt|finde\w*\s+nicht|vermut\w*|unsicher)\b/.test(input)) {
    return {
      text: "Ob dein Kauf wirklich erfasst wurde, kann ich ohne einen verifizierten Beleg nicht bestätigen. Bitte prüfe zuerst die Bestell- oder Zahlungsbestätigung. Wenn sie fehlt, übernimmt Jochen die Klärung.",
      handoff: true,
    };
  }

  // Combined scope-and-cost question: answer only approved product facts.
  // Do not assert absence of extras, discounts or contract conditions.
  if (/\b(?:was ist|was genau|was bekomme|was beinhaltet|was umfasst)\b/.test(input) &&
      /\b(?:angebot|coaching|begleitung|selbststarter)\b/.test(input) &&
      /\b(?:verbindlich|zahlen|kosten|preis|enthalten)\b/.test(input)) {
    if (/\bselbststarter\b/.test(input) && !/\b(?:coaching|begleitung)\b/.test(input)) {
      return {
        text: "Der Selbststarter kostet " + OFFER_TRUTH.selfstarter.priceText +
          " und ist für die eigenständige Umsetzung gedacht. Die genaue Inhaltsliste findest du auf der Produktseite: " +
          OFFER_TRUTH.selfstarter.productUrl +
          ". Zu möglichen Zusatzkosten oder Vertragsdetails kann ich ohne die konkrete Kaufübersicht keine verbindliche Zusage machen.",
      };
    }
    return {
      text: "Der Selbststarter für " + OFFER_TRUTH.selfstarter.priceText +
        " ist zum eigenständigen Einstieg gedacht. Die persönliche 5-Wochen-Begleitung kostet " +
        OFFER_TRUTH.coachingEntry.priceText +
        " und verbindet Bewegung, Ernährung, Schlaf und die Umsetzung im Elternalltag. Details zu Vertragsbedingungen oder möglichen Zusatzkosten kann ich ohne die konkrete Kaufübersicht nicht verbindlich bestätigen.",
    };
  }

  if (isUnverifiedLongTermPriceQuestion(text)) {
    return { text: LONG_TERM_PRICE_UNVERIFIED_REPLY, nextPhase: "longterm_unverified" };
  }
  const explicitPrice = has(text,
    /\b(?:was kostet|wie teuer|wieviel kostet|wie viel kostet|preis fur|preis von|nenn mir den preis|preis bitte|preis\?|kosten\?|monatsrate|ratenzahlung)\b/);
  const specificSelfstarter = /\b(?:selbststarter|buch)\b/.test(input);
  const specificCoaching = /\b(?:5.?wochen|funf wochen|coaching|startphase|begleitung)\b/.test(input);
  const substantiveQuestion = /\b(?:wie unterscheid|was ist anders|wie funktioniert|was bekomme|was enthalt|was beinhaltet|was ist drin|wie geht es|warum|wie genau|wie vereinbar|wie hilft)\b/.test(input);
  // Combined "explain the offer and its cost" should not become a price
  // interrogation. Answer price if verified, then let Pete explain the rest.
  if (explicitPrice && !substantiveQuestion) {
    if (specificSelfstarter) {
      return { text: "Der Selbststarter kostet " + OFFER_TRUTH.selfstarter.priceText +
        ". Das ist der eigenständige Einstieg. Die Produktseite enthält die genauen Inhalte: " +
        OFFER_TRUTH.selfstarter.productUrl };
    }
    if (specificCoaching) {
      return { text: "Die persönliche 5-Wochen-Startphase kostet " +
        OFFER_TRUTH.coachingEntry.priceText +
        ". Sie verbindet Bewegung, Ernährung, Schlaf und Alltag. Ratenzahlung und genaue Vertragsbedingungen sind hier nicht verbindlich bestätigt. Wenn du diese Angaben vor deiner Entscheidung brauchst, kannst du sie persönlich mit Jochen klären." };
    }
    if (/\b(?:monatsrate|ratenzahlung)\b/.test(input)) {
      return { text: "Ob Ratenzahlung möglich ist, ist hier nicht verbindlich bestätigt. Das muss Jochen persönlich klären." };
    }
    return { text: "Für den eigenständigen Einstieg gibt es den Selbststarter für " +
      OFFER_TRUTH.selfstarter.priceText + ". Der persönliche Einstieg über fünf Wochen kostet " +
      OFFER_TRUTH.coachingEntry.priceText +
      ". Wenn du eine bestimmte Variante meinst, sag mir welche." };
  }

  const resourceRequest = /\b(?:schick|sende|link|download|wo finde|wo bekomme|her damit)\b/.test(input);
  if (resourceRequest && /\b(?:keto.?guide|keto.?pdf|keto.?anleitung)\b/.test(input)) {
    return { text: "Hier ist Jochens kostenloser Keto Guide mit PDF und Audio: " +
      OFFER_TRUTH.resources.ketoGuide.url };
  }
  if (resourceRequest && /\b(?:eltern.?check|fitness.?check)\b/.test(input)) {
    return { text: "Hier ist der kostenlose Elternfitness-Check: " +
      OFFER_TRUTH.resources.elterncheck.url };
  }
  if (/\b(?:buchungslink|terminlink|calendly.?link|strategiegesprach buchen)\b/.test(input) &&
      !/\b(?:nicht|kein|ohne|erstmal nicht|lieber hier)\b/.test(input)) {
    return bookingUrl?.startsWith("https://")
      ? { text: "Hier kannst du einen Termin für ein Strategiegespräch auswählen: " + bookingUrl,
          nextPhase: "booking_offered" }
      : { text: "Ich kann dir hier keinen verifizierten Buchungslink nennen. Jochen kann dir den richtigen Weg zeigen.", handoff: true };
  }

  // A generic mention of "price", "book", "appointment" or "Jochen"
  // without a concrete verified transaction stays with the LLM.
  return null;
}

/**
 * The old keyword safety detector handles medical emergencies. Its
 * "diagnose", "arzt", "schwangerschaft" tokens sometimes flag a NEGATED
 * diagnostic request or a historical pregnancy as critical. Narrow relief
 * requires an unambiguously general question and no other red flags.
 */
/**
 * A potentially acute cardiopulmonary emergency must be a deterministic 112
 * response even if the legacy keyword classifier misses "Druck auf der Brust".
 * Never ask an LLM whether a caller should train with current chest symptoms.
 */
export function isPeteChestBreathingEmergency(text: string): boolean {
  const input = norm(text);
  const breath = /\b(?:atemnot|luftnot|kurzatmig(?:keit)?|kaum\s+luft|keine\s+luft|schlecht\s+luft|schwer\s+luft|nicht\s+atmen|(?:bekomme|krieg(?:e)?)\s+(?:kaum|keine|schlecht|schwer|nur\s+schwer|nicht\s+richtig|zu\s+wenig)\s+luft|(?:kann|konnte)\s+(?:kaum|nicht\s+richtig|nicht)\s+(?:atmen|durchatmen))\b/.test(input);
  const chest = /\b(?:brustschmerz\w*|brustenge|enge\s+(?:auf|in)\s+der\s+brust|druck\s+(?:auf|in)\s+der\s+brust|schmerzen?\s+(?:auf|in)\s+der\s+brust)\b/.test(input);
  return breath && chest;
}

/**
 * Past pregnancies plus shame about one's body are not, by themselves,
 * pregnancy complications or an acute medical emergency. Any red flag still
 * keeps the existing medical guard active.
 */
export function isPeteNonMedicalPostPregnancyBodyImage(text: string): boolean {
  const input = norm(text);
  const history = /\b(?:seit|nach)\s+(?:(?:den|der|meiner|meinen)\s+)?schwangerschaft\w*\b/.test(input) ||
    /\b(?:seit|nach)\s+(?:der|den)\s+geburt\w*\b/.test(input) ||
    // Historical pregnancy phrasing, not present pregnancy.
    /\b(?:meine|die)?\s*(?:letzte|fruhere|vorige)\s+schwangerschaft\s+(?:liegt|ist)(?:\s+schon)?\s+(?:\d+|ein|zwei|drei|vier|funf)\s+jahre?\s+(?:zuruck|her)\b/.test(input);
  const bodyImage = /\b(?:scham\w*|unsicher|unwohl|korperbild|selbstbild|bauch|figur)\b/.test(input) ||
    /\bfuhle\s+mich\s+(?:in\s+(?:meinem|dem)\s+korper\s+)?nicht\s+wohl\b/.test(input);
  const redFlag = /\b(?:schwanger|atemnot|luftnot|kaum\s+luft|brustschmerz\w*|brustenge|herzschmerz\w*|blutung\w*|schmerz\w*|suizid\w*|selbstverletz\w*|medikament\w*|krankheit\w*|therapie|diagnose|akut\w*|fieber)\b/.test(input);
  return history && bodyImage && !redFlag;
}

export function isGeneralNonMedicalKnowledgeRequest(text: string): boolean {
  const input = norm(text);
  if (/\b(?:brustschmerz\w*|herzschmerz\w*|atemnot|schwindel|ohnmacht|insulin\w*|medikament\w*|schwanger\b|schwangerschaftsdiabetes|typ.?1|essstorung|essanfall|selbstverletz|suizid|krebs|blutung|dosierung|krankheit|therapie|schmerz\w*|tabletten|entzundung|fieber|blutungen|akut\w*|behandlung|diagnose)\b/.test(input))
    return false;
  // Explicit past pregnancy such as "Meine letzte Schwangerschaft ist über
  // zwei Jahre her" is not current pregnancy. Red-flag symptoms remain gated.
  if (/\b(?:letzte|fruhere|vorige)\s+schwangerschaft\s+ist\s+(?:(?:uber|mehr als|rund|fast|schon)\s+)*(?:\d+|ein|eine|zwei|drei|vier|funf|sechs)\s+jahre?\s+her\b/.test(input) &&
      /\b(?:trainier\w*|krafttraining|abnehm\w*|gewicht\w*|bewegun\w*|fitness)\b/.test(input)) return true;
  if (/\b(?:nach der schwangerschaft|nach schwangerschaft|seit der geburt|nach der geburt)\b/.test(input) &&
      /\b(?:trainier\w*|abnehm\w*|gewicht\w*|energie|fitness|bewegung|nehme\w*|nimmt)\b/.test(input)) return true;
  if (/\b(?:ohne (?:eine )?(?:medizinische )?(?:fern)?diagnose|keine ferndiagnose)\b/.test(input) &&
      /\b(?:evidenz|studien|wissenschaft|allgemein|training|ernahrung|schlaf|stoffwechsel)\b/.test(input)) return true;
  if (/\b(?:blutwerte|arzt|arztlich)\b/.test(input) &&
      /\b(?:schon|bereits)\b/.test(input) && /\b(?:kontrolliert|untersucht|uberpruft|gepruft)\b/.test(input) &&
      !/\b(?:was bedeuten meine werte|diagnostizier|behandlung|dosis)\b/.test(input)) return true;
  return false;
}


/**
 * The model sometimes asks for a human for a simple budget boundary or a
 * refusal of sales pressure. Such a request is not a purchase dispute.
 * Permit ONLY this narrow, noncritical case to continue, with a verified,
 * non-commercial reply. Unknown and safety-related cases still fail closed.
 */
/** Distinct from STOP: block unsolicited sales reminders, not direct replies. */
export function isSalesFollowUpOptOut(text: string): boolean {
  const input = norm(text);
  const refusalText = withoutMissingOfferStatements(input);
  if (isExplicitOfferRequest(input)) {
    // An offer may be requested once while future sales follow-ups are
    // explicitly forbidden. Do not let the positive request erase that choice.
    // Exclude the generic "keine Angebote bekommen" phrase from opt-out.
    return [
      /\bkein(?:e|en)?\s+(?:weiteren?|anderen?)\s+(?:angebote?|kaufangebote?|verkaufsnachrichten?|nachrichten?)\b/,
      /\bkein(?:e|en)?\s+(?:werbenachrichten?|werbung|verkaufsnachrichten?)\b/,
      /\b(?:bitte\s+)?nicht\s+(?:mehr\s+)?(?:nachfassen|nachhaken|anschreiben|kontaktieren)\b/,
      /\bich\s+melde\s+mich\s+(?:(?:dann|spater|wieder)\s+)?selbst\b/,
      /\b(?:wirklich\s+|gar\s+)?nichts\s+(?:kaufen|bestellen)\b/,
    ].some(pattern => pattern.test(refusalText));
  }
  return isExplicitPaidOfferRefusal(input) || [
    /\bkein(?:e|en)?\s+(?:weiteren?\s+)?(?:verkaufsnachrichten?|werbenachrichten?|werbung|angebote?|verkaufsgesprache?)\b/,
    /\b(?:nicht|kein)\s+(?:mehr\s+)?nachfassen\b/,
    /\b(?:bitte\s+)?nicht\s+(?:(?:mehr|weiter|erneut|nochmal)\s+)?(?:hinterherlaufen|hinterherschreiben|nachhaken)\b/,
    /\bich\s+melde\s+mich\s+(?:(?:dann|spater|wieder)\s+)?selbst\b/,
    /\b(?:bitte\s+)?nicht\s+(?:mehr\s+|weiter\s+|erneut\s+|nochmal\s+)?(?:mit\s+)?(?:werbung|angeboten?|verkaufsnachrichten?)\s+(?:anschreiben|kontaktieren|nerven|nachfassen)\b/,
    /\bkein(?:e|en)?\s+(?:weiteren?\s+)?(?:verkaufs|marketing)[- ]?follow[ -]?ups?\b/,
  ].some(pattern => pattern.test(refusalText));
}

/**
 * Narrow, fact-checked reply for a false model escalation after a parent
 * asks how the *coaching routine* handles a sick child. Never advises on
 * a child's symptoms, diagnosis or treatment, and cannot authorize a send.
 * This function runs only after the engine has checked owner/STOP/safety.
 */
export function peteSafeRoutineRepairReply(state: ConversationState): string | null {
  const leadTexts = (state.messages ?? [])
    .filter(message => message.role === "user")
    .slice(-2).map(message => String(message.text ?? ""));
  const context = norm(leadTexts.join(" "));
  if (!/\b(?:wie funktioniert|wie geht|wie kann)\b.{0,100}\b(?:eure|die|unsere)?\s*(?:methode|training|alltagsroutine|plan)\b/.test(context) ||
      !/\bkrank(?:em|en|es|e)?\s+kind\b/.test(context)) return null;
  if (/\b(?:atemnot|brustschmerz|fieber|schmerz|insulin|medikament|arzt|medizin|diagnose|therapie|behandlung|notfall|dosierung|selbstverletzung|suizid|krise|widerruf|datenschutz|stop|nicht mehr schreiben|lass mich in ruhe)\b/.test(context) ||
      /\b(?:jochen|ein mensch)\b.{0,40}\b(?:ubernimm|ubernehmen|personlich|antworten)\b/.test(context)) return null;
  return "Wenn dein Kind krank ist, darf das Training pausieren. Sobald wieder Luft ist, steigst du mit einer kurzen Einheit ein, statt verpasste Einheiten nachzuholen. So bleibt die Routine auch in unruhigen Familienwochen machbar.";
}

/**
 * Policy v4.1. The model sometimes sets needsHuman=true for ordinary
 * method/scope questions. Respond with ONLY independently verified high-level
 * facts, instead of permanently assigning the chat to Jochen. Never use the
 * model's untrusted answer to form this fallback, and never guess package
 * terms or claim a guaranteed coaching outcome.
 *
 * Scope is deliberately narrow: a person who explicitly requests human
 * ownership, a sensitive transaction, or medical advice still requires the
 * normal engine's guarded route.
 */
export function peteSafeNoncriticalExplanationReply(state: ConversationState): string | null {
  const turns = (state.messages ?? []).filter(message => message.role === "user");
  const latest = norm(String(turns.at(-1)?.text ?? ""));
  if (!latest || latest.length > 600) return null;
  const context = norm(turns.slice(-2).map(message => String(message.text ?? "")).join(" "));
  if (/\b(?:brust|atemnot|luftnot|schlecht luft|kaum luft|schmerz\w*|fieber|krankheit|medikament\w*|insulin|diagnos\w*|therapie|behandlung|arzt|notfall|suizid|selbstverletz\w*|schwanger|krise|akut|dosierung|blutdruck|medizin\w*|rezept\w*|widerruf|datenschutz|losch\w*|rechnung|zahlung|bezahlt|zugang fehlt|ratenzahlung|stop|nicht mehr schreiben|lass mich in ruhe)\b/.test(context)) return null;
  if (/\b(?:jochen|mensch|personlich)\b.{0,50}\b(?:ubernimm\w*|ubernehmen|antworten|schreiben|hier im chat|direkt sprechen)\b/.test(latest) ||
      /\b(?:bitte|mochte|will)\s+(?:mit\s+)?(?:jochen|einem menschen)\b/.test(latest)) return null;

  // We know the offer orientation, NOT required intake calls or exact timings.
  if (/\b(?:wie|was)\b.{0,42}\b(?:einstieg|start|anmeldung|anfang)\b.{0,45}\b(?:strukturiert|lauft|beginnt|funktioniert|organisiert|ablauf)\b/.test(latest) ||
      /\b(?:wie ist der einstieg strukturiert|wie lauft der einstieg|wie beginnt die begleitung|wie starte ich mit euch)\b/.test(latest)) {
    return "Für die persönliche Begleitung gibt es die 5-Wochen-Startphase. Dabei geht es um Bewegung, Ernährung sowie Schlaf und Stress im Elternalltag. Wie die Anmeldung oder der genaue Start organisiert ist, kann ich dir hier nicht verbindlich sagen. Einen Pflicht-Call möchte ich dir nicht behaupten.";
  }
  // Skepticism is not a request to transfer chat ownership.
  if (/\b(?:wie|warum)\b.{0,85}\b(?:unterbrechungen|uberstunden|familie|alltag|dranbleiben|wiedereinstieg)\b.{0,60}\b(?:um|funktioniert|geht|anders)\b/.test(latest) ||
      /\b(?:wie geht ihr mit unterbrechungen|wie hilft eure methode bei familienchaos|was ist bei euch anders)\b/.test(latest) ||
      // The user asks how the approach handles a disrupted family schedule.
      // This is ordinary method information, not a medical or transaction case.
      (/\b(?:was passiert|was macht ihr|wie reagiert ihr|wie geht ihr|wie funktioniert)\b/.test(latest) &&
       /\b(?:kinderbetreuung|betreuung|familienalltag|familie|kinder|woche|zeitplan)\b/.test(latest) &&
       /\b(?:ausfall\w*|fallt aus|unterbrech\w*|durcheinander\w*|spontan|chaos)\b/.test(latest))) {
    return "Unser Ansatz berücksichtigt, dass bei Eltern durch Kinder oder Überstunden immer wieder etwas ausfällt. Entscheidend ist ein machbarer Wiedereinstieg statt alles nachholen zu wollen. Fitness, Ernährung, Schlaf und Stress betrachten wir gemeinsam. Wie das in einer persönlichen Begleitung konkret umgesetzt wird, müsste vor einer Entscheidung geklärt werden.";
  }
  return null;
}

export function peteSafeBudgetBoundaryReply(latestText: string): string | null {
  const input = norm(latestText);
  if (!/\b(?:geld|budget|finanziell|leisten|verkaufsshow|verkaufsgespr[a-z]*|verkaufsdruck|aufgedrangt|gedrangt)\b/.test(input))
    return null;
  if (/\b(?:arzt|medizin|krankheit|medikament|insulin|schwindel|schmerz|brust|schwanger|essstorung|suizid|angst|krise|akut|rezept|datenschutz|losch|stop|nicht mehr schreiben|nicht mehr kontaktieren)\b/.test(input))
    return null;
  if (/\b(?:jochen|mensch|personlich|ubernimm|ubernehm|bitte weitergeben|direkt sprechen|bitte jemand|bezahl|zahlung|gekauft|bestell|buchung|gebucht|rechnung|beleg|zugang|vertragsbruch|widerruf)\b/.test(input))
    return null;
  return "Verstanden. Dann geht es erst mal um Orientierung, nicht um einen Kauf. Du musst hier nichts entscheiden. Wenn du etwas zu Ablauf oder Inhalten wissen möchtest, beantworte ich es dir sachlich, ohne Verkaufsdruck.";
}

export function isUnsafeLlmClaim(reply: string): boolean {
  const input = norm(reply);
  // User's desire for a human is not proof that Pete is that human.
  if (/\b(?:ich antworte personlich|ich bleibe personlich|ich bleibe hier[^.?!]{0,90}antworte personlich|du schreibst (?:direkt )?mit jochen|ich bin jochen|(?:das kenne ich (?:gut|selbst)|ich kenne das (?:gut|aus eigener erfahrung))|ich habe selbst (?:kinder|erlebt))\b/.test(input)) return true;
  if (/\b(?:ganz\s+)?ohne\s+(?:weiteres|erneutes)\s+nachfassen\b/.test(input)) return true;
  // Never claim that an unverified commerce or cross-channel infrastructure
  // guarantee is already in force.
  if (/\b(?:keine versteckten kosten|keine extras|alles verbindlich|ohne zusatzgebuhren|garantiert keine doppelantworten|ohne automatische antworten|ohne automatische nachsendungen|keine doppelantworten|ich schreibe dir nur hier weiter|wir halten es ab jetzt hier|die ki stoppt automatisch|keine weiteren automatischen nachrichten|alles basiert auf echten informationen|zahlung (?:ist|wurde) verifiziert)\b/.test(input)) return true;
  return false;
}

/** Typography cleanup must never introduce a stray dot in the sentence. */
export function normalizePeteReplyStyle(reply: string): string {
  return reply
    .replace(/ich bin (?:übrigens )?Petes KI-Assistent(?: für Jochen)?/gi,
      "Ich bin Pete, Jochens KI-Assistent")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*[,.;]/g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
