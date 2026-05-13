import type { CampaignConfig } from "../types/types.js";
import { DEFAULT_BOOKING_WINDOW_CONFIG } from "./booking-windows.js";

export const DEFAULT_CAMPAIGN_ID = "eltern-vital-fit";

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
        "Die Preise hängen davon ab, welche Begleitung wirklich zu deiner Situation passt. Wenn du möchtest, schauen wir im Strategiegespräch kurz, was sinnvoll ist.",
      infoLink1Enabled: true,
      infoLink1Label: "Angebot ansehen",
      infoLink1Url: "",
      infoLink2Enabled: false,
      infoLink2Label: "Video ansehen",
      infoLink2Url: "",
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
        "https://jochen-kammerer.de/die-eltern-energie-startphase/",
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
      starterPriceText: "499 €",
      starterCheckoutUrl:
        "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      starterDirectBuyText:
        "Klar. Dann schicke ich dir direkt den Buchungslink, damit du dir den Platz sichern kannst:\nhttps://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      starterPriceReply:
        "Die Eltern Energie Startphase liegt bei 499 €.\nWenn du dazu Fragen hast, sag direkt Bescheid.\nWenn du direkt starten willst, schicke ich dir den Buchungslink, damit du dir den Platz direkt sichern kannst.",
      longTermReply:
        "Wenn du eher eine längere bzw. intensivere Begleitung suchst, macht ein kurzer Austausch am meisten Sinn.\nDann kann ich dir sauber sagen, was in deiner Situation sinnvoll ist.\n" +
        DEFAULT_BOOKING_WINDOW_CONFIG.prompt,
      installmentsReply:
        "Wenn es um Ratenzahlung geht, klären wir das am besten kurz persönlich.\nSo kann ich dir sauber sagen, was in deiner Situation sinnvoll ist.\n" +
        DEFAULT_BOOKING_WINDOW_CONFIG.prompt,
      infoLinkReply:
        "Klar, dann schau dir hier erstmal alles in Ruhe an:\nhttps://jochen-kammerer.de/die-eltern-energie-startphase/\n\nUnd wenn du merkst, dass du das wirklich angehen willst, können wir danach kurz sprechen.",
      introAckValidationReply:
        "Wenn du willst, gehen wir’s kurz sauber durch.\nWenn du lieber direkt Infos, den Preis oder einen Link willst, sag’s einfach direkt.",

      onboardingBookingUrl:
        "https://calendly.com/eltern-fitundvital/strategiegespraech",
      starterPurchaseSuccessReply:
        "Stark 👊 deine Buchung hat geklappt.\nHier kannst du dir jetzt direkt deinen Termin für das Onboarding-Gespräch buchen:\n[ONBOARDING_LINK]",
    },
  },
};

export function getCampaignById(campaignId: string): CampaignConfig {
  return campaigns[campaignId] ?? campaigns[DEFAULT_CAMPAIGN_ID];
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
