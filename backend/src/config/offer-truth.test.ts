import assert from "node:assert/strict";
import test from "node:test";

import { campaigns, DEFAULT_CAMPAIGN_ID } from "./campaigns.js";
import {
  OFFER_TRUTH,
  LONG_TERM_PRICE_UNVERIFIED_REPLY,
  hasUnapprovedOfferPrice,
  containsGeneratedPrice,
  isUnverifiedLongTermPriceQuestion,
  getCoachingEntryOffer,
  getLongTermOffer,
  getSelfstarterOffer,
} from "./offer-truth.js";
import {
  getCoachingEntryPriceReply,
  getLongTermReply,
  getMatchedPricingIntent,
  getSelfstarterReply,
} from "../domain/pricing-rules.js";
import { detectLeadIntent } from "../core/intent-detector.js";
import {
  buildPeteRuntimeInfoLinkReply,
  evaluatePeteRuntimeSafety,
} from "../core/pete-runtime-safety.js";

test("Offer Truth is unambiguous", async (t) => {
  await t.test("Selfstarter is the 14,95 EUR low-ticket offer", () => {
    const offer = getSelfstarterOffer();

    assert.equal(offer.id, "selfstarter");
    assert.equal(offer.priceEur, 14.95);
    assert.equal(offer.priceText, "14,95 €");
    assert.equal(
      offer.productUrl,
      "https://jochen-kammerer.de/produkt/no-bullshit-elternfitness-selbststarter/",
    );
    assert.notEqual(offer.priceEur, 499);
  });

  await t.test("5-week coaching is the 499 EUR primary coaching entry", () => {
    const offer = getCoachingEntryOffer();

    assert.equal(offer.id, "coaching_5w");
    assert.equal(offer.priceEur, 499);
    assert.equal(offer.priceText, "499 €");
    assert.equal(offer.role, "primary_coaching_entry");
    assert.ok(offer.checkoutUrl);
  });

  await t.test("long-term continuation is pending approval, without old numerical fields", () => {
    const offer = getLongTermOffer();
    assert.equal(offer.id, "long_term_6m");
    assert.equal(offer.verificationStatus, "pending_founder_approval");
    assert.equal(offer.requiresHumanDecision, true);
    for (const field of ["priceEur", "priceText", "creditedEntryAmountEur", "upgradeBalanceEur"]) {
      assert.equal(Object.hasOwn(offer, field), false, field);
    }
  });

  await t.test("App-Starter and Umsetzungs-Bundle remain post-purchase only", () => {
    assert.deepEqual(OFFER_TRUTH.postPurchaseOnly, [
      "App-Starter",
      "Umsetzungs-Bundle",
    ]);
  });

  await t.test("free resources are explicit and separate from paid offers", () => {
    assert.equal(
      OFFER_TRUTH.resources.elterncheck.url,
      "https://check.jochen-kammerer.de",
    );
    assert.equal(
      OFFER_TRUTH.resources.ketoGuide.url,
      "https://jochen-kammerer.de/keto-guide/",
    );
  });
});

test("Pricing and intent routing use the current offer truth", async (t) => {
  await t.test("explicit Selfstarter request is not routed to 499 EUR coaching", () => {
    const intent = detectLeadIntent("Was kostet der Selbststarter?");

    assert.equal(intent.intent, "selfstarter_interest");

    const reply = getSelfstarterReply();
    assert.match(reply, /14,95 €/);
    assert.match(reply, /no-bullshit-elternfitness-selbststarter/);
    assert.doesNotMatch(reply, /499 €/);
  });

  await t.test("generic direct start intent points to coaching entry", () => {
    const intent = getMatchedPricingIntent("Ich will direkt starten");
    assert.equal(intent.intent, "direct_buy_coaching_entry");
  });

  await t.test("generic coaching price answer leads with 499 EUR", () => {
    const reply = getCoachingEntryPriceReply(DEFAULT_CAMPAIGN_ID);

    assert.match(reply, /5-Wochen-Coaching/);
    assert.match(reply, /499 €/);
    assert.match(reply, /Selbststarter/);
    assert.match(reply, /14,95 €/);
  });

  await t.test("legacy long-term reply defers terms to Jochen without old amounts", () => {
    const reply = getLongTermReply(DEFAULT_CAMPAIGN_ID);
    assert.equal(reply, LONG_TERM_PRICE_UNVERIFIED_REPLY);
    assert.match(reply, /Jochen persönlich/);
    assert.doesNotMatch(reply, /2\.499|2499|2\.000|2000|499 €/);
  });

  await t.test("Pete runtime direct price answer uses current offer truth", () => {
    const result = evaluatePeteRuntimeSafety("Sag mir jetzt den Preis", {
      campaign: campaigns[DEFAULT_CAMPAIGN_ID],
      askedPrice: true,
    });

    assert.equal(result.category, "price");
    assert.match(result.replyText ?? "", /5-Wochen-Coaching/);
    assert.match(result.replyText ?? "", /499 €/);
    assert.match(result.replyText ?? "", /Selbststarter/);
    assert.match(result.replyText ?? "", /14,95 €/);
    assert.doesNotMatch(result.replyText ?? "", /2\.499|2499|2\.000|2000/);
    assert.doesNotMatch(result.replyText ?? "", /Eltern-Energie-Startphase/);
  });

  await t.test("Pete runtime can return Elterncheck and Keto Guide explicitly", () => {
    const campaign = campaigns[DEFAULT_CAMPAIGN_ID];

    const checkReply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Elterncheck",
      campaign,
    );
    assert.match(checkReply, /check\.jochen-kammerer\.de/);

    const ketoReply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Keto Guide",
      campaign,
    );
    assert.match(ketoReply, /jochen-kammerer\.de\/keto-guide\//);
  });

  await t.test("campaign links match the current offer truth", () => {
    const campaign = campaigns[DEFAULT_CAMPAIGN_ID];

    assert.equal(
      campaign.offerContext?.infoLink1Url,
      OFFER_TRUTH.coachingEntry.infoUrl,
    );
    assert.equal(
      campaign.offerContext?.infoLink2Url,
      OFFER_TRUTH.selfstarter.productUrl,
    );
    assert.equal(campaign.offerContext?.infoLink2Enabled, true);
  });
});

test("Unapproved pricing is guarded consistently", async (t) => {
  await t.test("legacy and alternate names for six-month prices are recognized", () => {
    for (const input of [
      "Was kostet die 6-Monats-Begleitung?",
      "Wie teuer sind sechs Monate Coaching?",
      "Preis Premium?",
      "Was kostet die längere Begleitung?",
    ]) {
      assert.equal(isUnverifiedLongTermPriceQuestion(input), true, input);
    }
    assert.equal(isUnverifiedLongTermPriceQuestion("Was kostet der Selbststarter?"), false);
  });

  await t.test("old and invented EUR amounts are rejected, approved short offers preserved", () => {
    for (const input of ["2.499 €", "2499 Euro", "2.000 €", "2000 EUR", "3.500 €", "3500 €"]) {
      assert.equal(hasUnapprovedOfferPrice(input), true, input);
    }
    assert.equal(hasUnapprovedOfferPrice("5 Wochen 499 € oder Selbststarter 14,95 €"), false);
    assert.equal(containsGeneratedPrice("Das 5-Wochen-Coaching liegt bei 499 €."), true);
    assert.equal(containsGeneratedPrice("Du musst heute nichts entscheiden."), false);
  });

  await t.test("legacy safety intercept defers specifically requested longer-term prices", () => {
    const campaign = campaigns[DEFAULT_CAMPAIGN_ID];
    const r = evaluatePeteRuntimeSafety("Was kostet die 6-Monats-Begleitung?", {
      campaign, askedPrice: true,
    });
    assert.equal(r.category, "price");
    assert.equal(r.replyText, LONG_TERM_PRICE_UNVERIFIED_REPLY);
    assert.doesNotMatch(r.replyText ?? "", /499 €|14,95 €/);
  });

  await t.test("operator-customized obsolete offer text is not reused", () => {
    const campaign = {
      ...campaigns[DEFAULT_CAMPAIGN_ID],
      offerContext: {
        ...campaigns[DEFAULT_CAMPAIGN_ID].offerContext!,
        priceInquiryText: "Unsere sechsmonatige Begleitung kostet 2.499 €.",
      },
    };
    const r = evaluatePeteRuntimeSafety("Wie teuer ist das?", { campaign, askedPrice: false });
    assert.equal(r.category, "price");
    assert.doesNotMatch(r.replyText ?? "", /2\.499|2499|2\.000|2000/);
    assert.match(r.replyText ?? "", /499 €/);
  });
});
