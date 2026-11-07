/**
 * Verified entry-level personal support, separate from the 499 EUR coaching.
 * Source of truth: owner-approved current WooCommerce Store products
 * 1853/1897/1929 (checked 2026-11-06). No live shop writes or purchase lookup.
 * Keep price/links out of generated LLM text; this reply is deterministic.
 */
import { OFFER_TRUTH, VERIFIED_SMALL_SUPPORT } from "../config/offer-truth.js";
import type { ConversationState } from "../types/types.js";
import { hasPeteActiveNoQuestionBoundary } from "./pete-question-boundary.js";

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
}

export function getPeteVerifiedSmallSupportAnswer(
  text: string, state: Pick<ConversationState, "messages">,
): string | null {
  const input = normalize(text);
  // Never intercept a STOP, human/medical issue, billing dispute, declined
  // offer, or a request for verified purchase/order status.
  if (/\b(?:stop|abmelden|keine weiteren nachrichten|lass mich in ruhe|keine angebote|keine kaufangebote|nichts kaufen|kein interesse mehr|nicht mehr anschreiben|keine begleitung|kein coaching|kein app[-\s]?starter)\b/.test(input) ||
      /\b(?:rechnung|abbuchung|abbuch\w*|abgebuch\w*|doppelt bezahlt|ruckerstattung|widerruf|datenschutz|medizin|diagnose|notfall|zugang fehlt|keine zugangsmail|passwort|freigeschaltet)\b/.test(input)) return null;

  // The buyer may refer only to durations after the assistant explained the
  // packages. A positive "one month first, then three" is an explicit upgrade
  // decision, not a question about a recurring App-only subscription.
  const stagedUpgrade =
    /\b(?:ein(?:en|em)?|erste[nmrs]?|1)[\s-]*monat\w*\b/.test(input) &&
    /\b(?:drei|3)[\s-]*monat\w*\b/.test(input) &&
    /\b(?:dann|danach|spater|anschliessend|erweiter\w*|upgrade\w*|aufstock\w*)\b/.test(input);
  const recentLighterInterest = (state.messages ?? []).slice(-10).some(message =>
    message.role === "user" &&
    /\b(?:begleit\w*|betreu\w*|coach\w*)\b/.test(normalize(message.text)) &&
    /\b(?:nicht so intensiv|weniger intensiv|nicht so umfangreich|klein\w*|kein riesen|ohne gleich ein riesen|ohne gleich ein großes|nicht gleich|mit etwas begleitung)\b/.test(normalize(message.text))
  );
  const asksHowToStart = recentLighterInterest &&
    /\b(?:wie|wo)\b.{0,45}\b(?:buchen|bestellen|kaufen|starten)\b|\b(?:kauf|buch|bestell)link\b/.test(input) &&
    /\b(?:das|es|angebot|paket|app|begleitung|starter|buchen|bestellen|kaufen|starten|link)\b/.test(input);
  const appNamed = /\bapp[\s-]*starter\b|\bapp[\s-]*upgrade\b/.test(input);
  // A parent may name the actual services, not the marketing product label.
  // "1 Monat App mit 1 Coaching" must not be intercepted as a DIY offer merely
  // because the same message also mentions an already-owned Selfstarter.
  const oneMonthAppCoaching =
    /\b(?:1|ein(?:en|em)?|erste[nmrs]?)[\s-]*monat\w*\b/.test(input) &&
    /\bapp\b/.test(input) && /\bcoach(?:ing)?\b|\b1[:\s-]*1\b/.test(input);
  const recentOneMonthAppCoaching = (state.messages ?? []).slice(-8).some(message =>
    message.role === "user" &&
    /\b(?:1|ein(?:en|em)?|erste[nmrs]?)[\s-]*monat\w*\b/.test(normalize(message.text)) &&
    /\bapp\b/.test(normalize(message.text)) &&
    /\bcoach(?:ing)?\b|\b1[:\s-]*1\b/.test(normalize(message.text))
  );
  const contextualThreeMonthUpgrade = recentOneMonthAppCoaching &&
    /\b(?:3|drei)[\s-]*monat\w*\b/.test(input) &&
    /\b(?:spater|danach|insgesamt|kostet|preis|erweiter\w*|upgrade|mochte|will)\b/.test(input);
  const claimsAlreadyOwnsSelfstarter = (message: string): boolean => {
    const stated = normalize(message);
    // Purchase is only CLAIMED, never verified. Accept everyday German word
    // order, including "den Selbststarter vor ein paar Wochen gekauft".
    // A mere mention of the product or a negated purchase is insufficient.
    const selfstarterNearPurchase =
      /\bselbststarter\b.{0,85}\b(?:gekauft|bestellt|besitze|habe|hab)\b/.test(stated) ||
      /\b(?:gekauft|bestellt|besitze|habe|hab)\b.{0,85}\bselbststarter\b/.test(stated);
    const explicitlyOwned = /\b(?:gekauft|bestellt|besitze|schon|bereits)\b/.test(stated);
    const deniedOwnership = /\b(?:nicht|nie|noch nicht|kein(?:en)?)\b.{0,25}\b(?:gekauft|bestellt|besitze|selbststarter)\b/.test(stated) ||
      /\bselbststarter\b.{0,40}\b(?:nicht|nie)\b.{0,18}\b(?:gekauft|bestellt|besitze)\b/.test(stated);
    return selfstarterNearPurchase && explicitlyOwned && !deniedOwnership;
  };
  const selfstarterOwnedClaim = claimsAlreadyOwnsSelfstarter(text) ||
    (state.messages ?? []).slice(-8).some(message =>
      message.role === "user" && claimsAlreadyOwnsSelfstarter(message.text)
    );
  const implementationNamed =
    /\bumsetzungs[\s-]*(?:upgrade|bundle)\b/.test(input) ||
    /\b(?:drei|3)[\s-]*monat\w*\b.{0,60}\b(?:app|begleit\w*|coach\w*)\b/.test(input) ||
    /\b(?:app|begleit\w*|coach\w*)\b.{0,60}\b(?:drei|3)[\s-]*monat\w*\b/.test(input);
  const lighterSupport =
    /\b(?:begleit\w*|betreu\w*|coach\w*|personlich\w*)\b/.test(input) &&
    /\b(?:nicht so intensiv|weniger intensiv|nicht so umfangreich|kleiner\w*|etwas weniger|weniger begleitung|mit etwas begleitung|ein bisschen begleitung|nicht gleich funf wochen|ohne gleich ein riesen|ohne gleich ein großes|ohne strategiegesprach|reinschnuppern|kurz testen|kleinen einstieg|sanfteren einstieg)\b/.test(input);
  const trialWithoutCall =
    /\b(?:testen|ausprobieren|reinschnuppern)\b/.test(input) &&
    /\bohne\s+(?:(?:ein(?:e|en)?|das|vorheriges?|personliches?)\s+){0,3}strategiegesprach\b/.test(input);
  const asksAppContinuation = /\bapp\b/.test(input) &&
    /\b(?:nach dem ersten monat|nach einem monat|weiter\s*nutz\w*|weiter\s*laufen|verlangern|verlangerung|abo|kundigungsfrist|monatlich danach)\b/.test(input);
  if (!appNamed && !implementationNamed && !lighterSupport &&
      !asksAppContinuation && !trialWithoutCall && !stagedUpgrade && !asksHowToStart &&
      !oneMonthAppCoaching && !contextualThreeMonthUpgrade) return null;

  const app = VERIFIED_SMALL_SUPPORT.appStarter;
  const implementation = VERIFIED_SMALL_SUPPORT.implementation;
  if (oneMonthAppCoaching) {
    // A claimed earlier purchase is not a verified payment. Explain the price
    // conditionally and send the actual smaller-support offer, never DIY again.
    return (selfstarterOwnedClaim
      ? "Wenn du den Selbststarter bereits hast, kostet das App-Starter-Upgrade zusätzlich "
      : "Das App-Starter-Upgrade kostet zusätzlich zum Selbststarter ") +
      app.upgradePriceText + " – also " + app.totalWithSelfstarterText +
      " insgesamt inklusive Selbststarter. Dafür gibt es 1 Monat App und ein persönliches " +
      app.coachingSessionMinutes + "-Minuten-Coaching. " +
      (selfstarterOwnedClaim
        ? "Hier findest du das App-Starter-Upgrade: " + app.productUrl
        : "Zum Einstieg zuerst der Selbststarter: " + OFFER_TRUTH.selfstarter.productUrl +
          " und anschließend das App-Starter-Upgrade: " + app.productUrl);
  }
  if (contextualThreeMonthUpgrade) {
    return "Wenn du nach dem App-Starter auf 3 Monate erweitern möchtest, kommen weitere " +
      implementation.upgradePriceText + " hinzu. Das macht " +
      implementation.totalWithSelfstarterText +
      " Gesamtpreis inklusive Selbststarter und App-Starter: 3 Monate App, " +
      "2 Coachings, individueller Startplan und Chat-Support. " +
      "Die Infos zur Erweiterung: " + implementation.productUrl +
      ". Eine bereits erfolgte Zahlung oder Buchung kann ich hier nicht bestätigen.";
  }
  if (stagedUpgrade || asksHowToStart) {
    // Clear closing guidance: send the first purchasable step now; do not
    // claim a payment or a booking happened, and do not claim upgrading is
    // possible after an expired entitlement without an owner confirmation.
    const startingLink = selfstarterOwnedClaim
      ? "Wenn du den Selbststarter bereits hast, ist der nächste Schritt das App-Starter-Upgrade: " +
        app.productUrl
      : "Zuerst der Selbststarter für " + OFFER_TRUTH.selfstarter.priceText + ": " +
        OFFER_TRUTH.selfstarter.productUrl + " Danach das App-Starter-Upgrade: " + app.productUrl;
    return "Ja, du kannst klein starten und danach auf die 3-Monats-Begleitung erweitern. " +
      startingLink + " Das App-Starter-Upgrade kostet zusätzlich " + app.upgradePriceText +
      " – also " + app.totalWithSelfstarterText +
      " insgesamt für 1 Monat App und ein persönliches 45-Minuten-Coaching. " +
      "Die spätere Erweiterung kostet weitere " + implementation.upgradePriceText +
      " und ergibt " + implementation.totalWithSelfstarterText +
      " insgesamt für 3 Monate App, 2 Coachings, Startplan und Chat-Support.";
  }
  if (asksAppContinuation && !implementationNamed) {
    return "Nach dem enthaltenen ersten Monat kannst du die App optional für " +
      app.optionalAppRenewalText + " weiter nutzen. Das wird separat eingerichtet; die Kündigungsfrist beträgt " +
      app.cancellationNoticeDays + " Tage. Eine automatische Verlängerung des 3-Monats-Umsetzungs-Bundles gibt es nicht.";
  }
  if (implementationNamed && !appNamed && !lighterSupport) {
    return "Für die 3-Monats-Umsetzung kommen nach Selbststarter und App-Starter weitere " +
      implementation.upgradePriceText + " dazu, also " + implementation.totalWithSelfstarterText +
      " insgesamt. Enthalten sind insgesamt 3 Monate App, zwei persönliche 45-Minuten-Coachings, " +
      "Startplan und Chat-Support. Das Bundle endet nach 3 Monaten automatisch. " +
      "Das Upgrade gibt es nach dem App-Starter: " + implementation.productUrl;
  }

  const noQuestion = hasPeteActiveNoQuestionBoundary(state);
  const first =
    (trialWithoutCall ? "Eine kostenlose Probephase ist nicht bestätigt. Aber " :
      "Ja, ") +
    "dafür gibt es eine kleinere persönliche Begleitung ohne vorgeschaltetes Strategiegespräch: " +
    "Selbststarter " + OFFER_TRUTH.selfstarter.priceText +
    " plus App-Starter-Upgrade " + app.upgradePriceText +
    " = " + app.totalWithSelfstarterText + " insgesamt. " +
    "Dafür bekommst du 1 Monat Nutrilize-App und ein persönliches 45-Minuten-Coaching.";
  const extra = " Für weitere " + implementation.upgradePriceText +
    " kannst du auf insgesamt " + implementation.totalWithSelfstarterText +
    " erweitern: 3 Monate App, 2 Coachings, Startplan und Chat-Support.";
  const link = appNamed
    ? " Die Upgrade-Infos: " + app.productUrl
    : " Dein Einstieg: " + OFFER_TRUTH.selfstarter.productUrl;
  return first + extra + link +
    (noQuestion ? "" : " Wäre die einmonatige Variante für dich passend?");
}
