import type { CampaignConfig } from "../types/types.js";
import { getCampaignById as getDashboardCampaignById } from "../data/campaigns.store.js";
import { DEFAULT_BOOKING_WINDOW_CONFIG } from "./booking-windows.js";
import { OFFER_TRUTH } from "./offer-truth.js";

export const DEFAULT_CAMPAIGN_ID = "eltern-vital-fit";
export const DEFAULT_VIDEO_GUIDE_URL =
  "https://jochen-kammerer.de/eltern-energie-training/";

export const campaigns: Record<string, CampaignConfig> = {
  "eltern-vital-fit": {
    id: "eltern-vital-fit",
    name: "Eltern Vital Methode",
    triggerKeywords: ["FIT", "RESET"],
    flow: [
      {
        id: "ask_name",
        type: "name",
        prompt: "Hey 😊 Mit wem schreibe ich gerade? Schreib mir einfach kurz deinen Vornamen.",
      },
      {
        id: "intro_ack",
        type: "ack",
      },
      {
        id: "parent_context",
        type: "freetext",
        prompt:
          "Kurz zur Einordnung: Bist du Mama, Papa oder grundsätzlich Elternteil?\nUnd wenn du magst: Wie alt sind deine Kinder ungefähr?",
      },
      {
        id: "situation_choice",
        type: "choice",
        prompt: "Was merkst du aktuell im Alltag am meisten?",
        options: [
          { key: "a", label: "ich bin oft müde / platt" },
          { key: "b", label: "ich fühle mich nicht mehr wohl in meinem Körper" },
          { key: "c", label: "ich kriege Bewegung nicht mehr richtig unter" },
          { key: "d", label: "irgendwie alles zusammen" },
        ],
      },
      {
        id: "tried_before_freetext",
        type: "freetext",
        prompt: "Hast du bisher schon mal was versucht, um etwas zu verändern?",
      },
      {
        id: "consequence_freetext",
        type: "freetext",
        prompt:
          "Und wenn sich in den nächsten 2-3 Monaten nichts verändert:\nWas würde dich daran am meisten nerven?",
      },
      {
        id: "goal_choice",
        type: "choice",
        prompt:
          "Und wenn du 3-6 Monate weiter wärst, was wäre für dich der wichtigste Unterschied?",
        options: [
          { key: "a", label: "wieder mehr Energie im Alltag" },
          { key: "b", label: "mich wieder wohler in meinem Körper fühlen" },
          { key: "c", label: "wieder regelmäßig Bewegung schaffen" },
          { key: "d", label: "endlich alles zusammen in den Griff bekommen" },
        ],
      },
      {
        id: "importance_scale",
        type: "scale",
        prompt:
          "Und wenn du jetzt 100% ehrlich bist:\nWie wichtig ist es dir gerade auf einer Skala von 1-10, das wirklich anzugehen?",
        minScale: 1,
        maxScale: 10,
      },
      {
        id: "commitment",
        type: "commitment",
        prompt:
          "Noch eine ehrliche Frage, bevor wir einen Termin festmachen:\nWillst du das gerade wirklich angehen\noder holst du dir eher erstmal nur ein paar Infos?",
        options: [
          { key: "a", label: "wirklich angehen" },
          { key: "b", label: "erstmal Infos" },
        ],
      },
      {
        id: "booking",
        type: "message",
      },
      {
        id: "info_only",
        type: "message",
      },
      {
        id: "done",
        type: "message",
      },
    ],
    offerContext: {
      priceInquiryText:
        `Der persönliche Einstieg ist das 5-Wochen-Coaching für ${OFFER_TRUTH.coachingEntry.priceText}. Wenn persönliche Begleitung aktuell nicht passt, gibt es den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}.`,
      infoLink1Enabled: true,
      infoLink1Label: "Eltern Vital Methode",
      infoLink1Url: OFFER_TRUTH.coachingEntry.infoUrl ?? "",
      infoLink2Enabled: true,
      infoLink2Label: "Selbststarter",
      infoLink2Url: OFFER_TRUTH.selfstarter.productUrl ?? "",
      infoLink3Enabled: true,
      infoLink3Label: "Elterncheck",
      infoLink3Url: OFFER_TRUTH.resources.elterncheck.url,
      infoLink4Enabled: true,
      infoLink4Label: "Keto Guide",
      infoLink4Url: OFFER_TRUTH.resources.ketoGuide.url,
      internalNote: "",
    },
    entryConfig: {
      entryChannel: "meta_ctwa",
      starterMode: "prefilled_message",
      suggestedEntryMessage: "FIT",
      matchingMode: "hybrid",
      exactTriggerRequired: false,
      triggerFallbackEnabled: true,
      ctwaAttributionEnabled: true,
      metaAdId: "",
      metaAdName: "",
      metaCampaignId: "",
      metaCampaignName: "",
      unknownEntryFallbackText:
        "Danke dir. Damit ich dich sauber einordne: Geht es bei dir gerade eher um Energie, Bauch, Schlaf/Stress oder Struktur?",
    },
    texts: {
      introTemplate:
        "Freut mich [Name]\nBevor ich dir einfach irgendwas schicke,\nlass uns kurz schauen, ob das überhaupt zu deiner Situation passt.\nIch stelle dir dazu kurz ein paar schnelle Fragen, ok?",
      infoShortText:
        "Mit der ELTERN VITAL METHODE helfe ich Eltern,\nihren Alltag wieder so aufzubauen,\ndass sie mehr Energie haben, fitter werden\nund sich wieder wohler in ihrem Körper fühlen.\n\nOhne Diätstress.\nOhne unrealistische Fitnesspläne.\nSondern so, dass es im echten Alltag überhaupt machbar wird.\n\nEs geht nicht darum, dir noch mehr Druck zu machen.\nSondern darum, wieder Struktur in Bewegung, Alltag und Entscheidungen zu bringen,\ndamit Veränderung überhaupt realistisch wird.\n\nWenn du danach merkst,\ndass du das wirklich angehen willst,\nkönnen wir gern kurz sprechen.",
      infoPageUrl:
        OFFER_TRUTH.coachingEntry.infoUrl ?? DEFAULT_VIDEO_GUIDE_URL,
      commitmentPrompt:
        "Noch eine ehrliche Frage, bevor wir einen Termin festmachen:\nWillst du das gerade wirklich angehen\noder holst du dir eher erstmal nur ein paar Infos?",
      bookingPrompt:
        "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\n" +
        "a) unter der Woche abends\n" +
        "b) Freitag oder Samstag tagsüber\n" +
        "c) ich bin flexibel",
      bookingFollowUpPrompt:
        "Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich gut passt.",
      bookingNoShowGuardTemplate:
        "Alles klar, dann blocke ich dir [Tag].\n" +
        "Kurze Bitte noch:\n" +
        "Ich halte mir die Zeit bewusst frei.\n" +
        "Passt das für dich, dass du den Termin auch wirklich wahrnimmst oder rechtzeitig Bescheid gibst, falls etwas dazwischenkommt?",
      bookingConfirmedTemplate:
        "Top, danke dir 👍\nDann steht dein Termin für [Tag].\nDie Terminbestätigung bekommst du zeitnah.\nIch freue mich drauf. Wir schauen uns dann deine Situation ganz entspannt an.",
      // Legacy property names kept for dashboard/backward compatibility.
      // Their meaning is the 499 EUR coaching entry, not the 14,95 EUR Selfstarter.
      starterPriceText: OFFER_TRUTH.coachingEntry.priceText,
      starterCheckoutUrl: OFFER_TRUTH.coachingEntry.checkoutUrl ?? "",
      starterDirectBuyText:
        `Klar. Das 5-Wochen-Coaching liegt bei ${OFFER_TRUTH.coachingEntry.priceText}.\nHier kannst du direkt starten:\n${OFFER_TRUTH.coachingEntry.checkoutUrl}`,
      starterPriceReply:
        `Das 5-Wochen-Coaching liegt bei ${OFFER_TRUTH.coachingEntry.priceText}.\nWenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}.`,
      longTermReply:
        "Wenn du die längere Begleitung willst, klären wir das kurz persönlich, damit wir sauber schauen, ob sie für deine Situation passt.\n" +
        DEFAULT_BOOKING_WINDOW_CONFIG.prompt,
      installmentsReply:
        "Wenn es um Ratenzahlung geht, klären wir das am besten kurz persönlich.\nSo kann ich dir sauber sagen, was in deiner Situation sinnvoll ist.\n" +
        DEFAULT_BOOKING_WINDOW_CONFIG.prompt,
      infoLinkReply:
        `Klar, hier findest du die Eltern Vital Methode:\n${OFFER_TRUTH.coachingEntry.infoUrl}\n\nWenn du erstmal selbst loslegen willst, gibt es den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}:\n${OFFER_TRUTH.selfstarter.productUrl}`,
      introAckValidationReply:
        "Wenn du willst, gehen wir’s kurz sauber durch.\nWenn du lieber direkt Infos, den Preis oder einen Link willst, sag’s einfach direkt.",

      onboardingBookingUrl:
        "https://calendly.com/eltern-fitundvital/strategiegespraech",
      starterPurchaseSuccessReply:
        "Stark 👊 deine Buchung für das 5-Wochen-Coaching hat geklappt.\nHier kannst du dir jetzt direkt deinen Termin für das Onboarding-Gespräch buchen:\n[ONBOARDING_LINK]",
    },
  },
};

function getDashboardCampaignCandidates(campaignId: string): string[] {
  const normalized = String(campaignId || "").trim();
  const candidates = [normalized];

  if (normalized === "eltern-vital-fit") {
    candidates.push("fit");
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function mergeRuntimeOfferContext(
  base: CampaignConfig,
  campaignId: string,
): CampaignConfig["offerContext"] {
  const baseContext = base.offerContext;

  if (!baseContext) {
    return baseContext;
  }

  let persisted:
    | ReturnType<typeof getDashboardCampaignById>
    | undefined;

  for (const candidate of getDashboardCampaignCandidates(campaignId)) {
    persisted = getDashboardCampaignById(candidate);
    if (persisted) break;
  }

  const saved = persisted?.offerContext;
  if (!saved || typeof saved !== "object") {
    return baseContext;
  }

  const merged = { ...baseContext };

  for (const index of [1, 2, 3, 4] as const) {
    const urlKey = `infoLink${index}Url` as const;
    const labelKey = `infoLink${index}Label` as const;
    const enabledKey = `infoLink${index}Enabled` as const;

    const savedUrl = String(saved[urlKey] ?? "").trim();
    if (!savedUrl) {
      continue;
    }

    merged[urlKey] = savedUrl;
    merged[labelKey] =
      String(saved[labelKey] ?? "").trim() || merged[labelKey];
    merged[enabledKey] =
      typeof saved[enabledKey] === "boolean"
        ? saved[enabledKey]
        : merged[enabledKey];
  }

  if (typeof saved.internalNote === "string") {
    merged.internalNote = saved.internalNote;
  }

  return merged;
}

export function getCampaignById(campaignId: string): CampaignConfig {
  const base = campaigns[campaignId] ?? campaigns[DEFAULT_CAMPAIGN_ID];

  return {
    ...base,
    offerContext: mergeRuntimeOfferContext(base, campaignId),
  };
}

export function getCampaignByTrigger(trigger: string): CampaignConfig {
  const normalized = trigger.trim().toUpperCase();

  const found = Object.values(campaigns).find((campaign) =>
    campaign.triggerKeywords.some(
      (keyword) => keyword.toUpperCase() === normalized,
    ),
  );

  return found ?? campaigns[DEFAULT_CAMPAIGN_ID];
}
