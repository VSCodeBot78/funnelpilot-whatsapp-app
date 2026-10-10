import {
  PETE_ESCALATION_RULES,
  PETE_NEUTRAL_CONFIDENCE_FALLBACK,
  type PeteEscalationCategory,
} from "../config/pete-prompt-v1.js";
import { DEFAULT_VIDEO_GUIDE_URL } from "../config/campaigns.js";
import { OFFER_TRUTH } from "../config/offer-truth.js";
import type { CampaignConfig, FlowStepId } from "../types/types.js";

export type PeteRuntimeSafetyCategory =
  | "medical"
  | "medical_soft"
  | "medical_critical"
  | "emotional_crisis"
  | "legal_privacy"
  | "price"
  | "distrust_aggression"
  | "human_request"
  | "identity_question"
  | "scope_boundary"
  | "info_link"
  | "booking_link"
  | "link_clarification"
  | "unclear"
  | "none";

export type PeteRuntimeLeadTemperature = "cold" | "warm" | "hot" | "handoff";

export type PeteRuntimeSettingsContext = {
  tone?: string;
  answerLength?: string;
  noGos?: string;
  escalationRule?: string;
  fallbackText?: string;
  brandVoice?: string;
  botName?: string;
};

export type PeteRuntimeSafetyContext = {
  campaign?: CampaignConfig;
  currentStep?: FlowStepId;
  hasPendingBooking?: boolean;
  hasActiveProviderBooking?: boolean;
  askedPrice?: boolean;
  lastAssistantText?: string;
  bookingUrl?: string;
  settings?: PeteRuntimeSettingsContext;
};

export type PeteRuntimeSafetyResult = {
  shouldIntercept: boolean;
  category: PeteRuntimeSafetyCategory;
  leadTemperature?: PeteRuntimeLeadTemperature;
  replyText?: string;
  shouldHandoffToJochen?: boolean;
  shouldStopAutomation?: boolean;
  reason?: string;
};

const MEDICAL_KEYWORDS = [
  "pfeifen im ohr",
  "tinnitus",
  "ohrgeraeusch",
  "ohrgerausch",
  "schmerzen",
  "schmerz",
  "schwindel",
  "medikament",
  "diagnose",
  "krankheit",
  "chronisch",
  "essstoerung",
  "essstorung",
  "schwangerschaft",
  "stillzeit",
  "hormon",
  "lipoedem",
  "lipodem",
  "arzt",
  "aerzt",
  "blutdruck",
];

const MEDICAL_SOFT_KEYWORDS = [
  "pfeifen im ohr",
  "tinnitus",
  "ohrgeraeusch",
  "ohrgerausch",
];

const MEDICAL_CRITICAL_KEYWORDS = [
  "starke schmerzen",
  "akute schmerzen",
  "brustschmerzen",
  "atemnot",
  "ohnmacht",
  "schwindel",
  "medikament",
  "diagnose",
  "krankheit",
  "chronisch",
  "essstoerung",
  "essstorung",
  "schwangerschaft",
  "stillzeit",
  "hormon",
  "lipoedem",
  "lipodem",
  "arzt",
  "aerzt",
  "blutdruck",
  "therapie",
  "behandlung",
  "was soll ich machen",
  "was kann ich dagegen tun",
  "schnell abnehmen",
];

const EMOTIONAL_CRISIS_KEYWORDS = [
  "ich kann nicht mehr",
  "alles zu viel",
  "ich breche zusammen",
  "komplett am ende",
  "total am ende",
  "panik",
  "angst",
  "depressiv",
  "depression",
  "hoffnungslos",
  "burnout",
];

const LEGAL_PRIVACY_KEYWORDS = [
  "dsgvo",
  "datenschutz",
  "vertrag",
  "widerruf",
  "haftung",
  "impressum",
  "agb",
  "rechtlich",
];

const NUTRITION_PLAN_KEYWORDS = [
  "ernährungsplan",
  "ernaehrungsplan",
  "essensplan",
  "speiseplan",
  "meal plan",
  "individueller ernährungsplan",
  "individueller ernaehrungsplan",
];

const NUTRITION_PLAN_SCOPE_REPLY =
  "Einen individuellen Ernährungsplan gebe ich hier nicht einfach raus und ich verkaufe auch keinen isolierten Plan.\n" +
  "Bei mir geht es um Begleitung mit Struktur, Umsetzung und Anpassung an deinen echten Alltag.\n" +
  "Wenn das grundsätzlich interessant ist, machen wir hier mit deiner Situation weiter.";

const PRICE_KEYWORDS = [
  "was kostet",
  "preis",
  "kosten",
  "investition",
  "teuer",
  "rabatt",
  "ratenzahlung",
  "kann ich mir leisten",
  "zu teuer",
  "sag schon",
  "sag mir den preis",
  "nenn mir den preis",
  "raus mit dem preis",
];

const DIRECT_PRICE_KEYWORDS = [
  "sag schon",
  "sag mir den preis",
  "sag mir jetzt den preis",
  "nenn mir den preis",
  "nenn mir jetzt den preis",
  "raus mit dem preis",
  "preis jetzt",
];

const DISTRUST_AGGRESSION_KEYWORDS = [
  "coach der nur geld will",
  "wieder so ein coach",
  "abzocke",
  "scam",
  "verarschen",
  "bullshit",
  "nervt",
  "alles nur verkauf",
  "geldmacherei",
  "nur geld will",
  "nur geld",
];

const HUMAN_REQUEST_KEYWORDS = [
  "kann ich direkt mit jochen sprechen",
  "direkt mit jochen sprechen",
  "mit jochen sprechen",
  "mit jochen reden",
  "termin",
  "gespraech buchen",
  "gesprach buchen",
  "strategiegespraech",
  "strategiegesprach",
  "wann koennen wir sprechen",
  "wann konnen wir sprechen",
  "direkt starten",
  "ich brauche hilfe",
  "wie koennen wir starten",
  "wie konnen wir starten",
];

const LINK_REQUEST_KEYWORDS = [
  "schick mir den link",
  "schick den link",
  "hast du den link",
  "wo ist der link",
  "link bitte",
  "den link bitte",
  "ok schick mir den link",
  "send mir den link",
  "sende mir den link",
  "wo kann ich das anschauen",
  "schick die anleitung",
  "schick mir die anleitung",
  "schick mir das video",
  "wo ist die video anleitung",
  "video anleitung",
  "buchungslink",
  "terminlink",
  "kalenderlink",
];

const INFO_LINK_CONTEXT_KEYWORDS = [
  "kostenlose anleitung",
  "anleitung",
  "video anleitung",
  "video",
  "infos",
  "informationen",
  "anschauen",
  "ansehen",
  "lesen",
  "kostenlos",
];

const BOOKING_LINK_CONTEXT_KEYWORDS = [
  "buchungslink",
  "terminlink",
  "kalenderlink",
  "termin",
  "gespraech",
  "gesprach",
  "strategiegespraech",
  "strategiegesprach",
  "jochen",
  "sprechen",
];

const OFFER_LINK_CONTEXT_KEYWORDS = [
  "angebot",
  "programm",
  "begleitung",
  "coaching",
  "5 wochen",
  "5-wochen",
  "eltern vital",
  "selbststarter",
  "startphase",
];

const IDENTITY_QUESTION_KEYWORDS = [
  "bist du eine ki",
  "bist du ki",
  "bist du ein bot",
  "bist du bot",
  "ist das eine ki",
  "ist das ein bot",
  "schreibt hier eine ki",
  "schreibt hier ein bot",
  "ist das automatisiert",
  "automatische antwort",
  "bist du jochen",
  "ist das jochen",
  "schreibt jochen persoenlich",
  "schreibt jochen personlich",
  "schreibt jochen selbst",
  "antwortet jochen",
  "red ich mit jochen",
  "rede ich mit jochen",
  "spreche ich mit jochen",
];

const UNCLEAR_SHORT_INPUTS = [
  "ja",
  "ok",
  "okay",
  "haha",
  "keine ahnung",
  "weiss nicht",
  "weis nicht",
  "kp",
  "hm",
  "hmm",
  "mhm",
];

const INTRO_ACK_ACCEPTED = [
  "ja",
  "jap",
  "yes",
  "klar",
  "ok",
  "okay",
  "gerne",
  "passt",
  "mach",
  "go",
  "weiter",
];

const BOOKING_CONFIRMATION = [
  "ja",
  "jap",
  "yes",
  "klar",
  "ok",
  "okay",
  "passt",
  "natuerlich",
  "naturlich",
  "mache ich",
  "mach ich",
];

const PROVIDER_BOOKING_EXPECTED = [
  "ok",
  "okay",
  "link",
  "hab gebucht",
  "habe gebucht",
  "termin steht",
  "erledigt",
  "gemacht",
];

const PRICE_FALLBACK_REPLY =
  `Der persönliche Einstieg ist das 5-Wochen-Coaching für ${OFFER_TRUTH.coachingEntry.priceText}. Wenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}.`;

const DIRECT_PRICE_REPLY_FALLBACK =
  `Das 5-Wochen-Coaching liegt bei ${OFFER_TRUTH.coachingEntry.priceText}.\n` +
  `Der Selbststarter liegt bei ${OFFER_TRUTH.selfstarter.priceText}.\n` +
  "Was davon sinnvoll ist, hängt davon ab, wie viel Unterstützung du gerade brauchst.";

const LEGACY_STARTPHASE_INFO_URL =
  "https://jochen-kammerer.de/die-eltern-energie-startphase/";

const LINK_CLARIFICATION_REPLY =
  "Klar. Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck, den Keto Guide oder direkt um einen Termin?";

const MEDICAL_CRITICAL_REPLY =
  "Da m\u00f6chte ich nichts Falsches sagen. Bei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber \u00e4rztlich abgekl\u00e4rt werden. Ich gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst.";

const EMOTIONAL_CRISIS_REPLY =
  "Das klingt gerade nicht nach einem normalen Alltagsthema. Ich m\u00f6chte hier nichts glattb\u00fcgeln. Ich gebe das an Jochen weiter, damit er pers\u00f6nlich draufschaut.";

const LEGAL_PRIVACY_REPLY =
  "Das ist ein Thema, das Jochen direkt beantworten sollte. Ich gebe das weiter, damit du keine unklare Antwort bekommst.";

const DISTRUST_AGGRESSION_REPLY =
  "Verstehe ich. Genau deshalb soll hier auch niemand in irgendwas reingedr\u00fcckt werden. Wenn du nur kurz pr\u00fcfen willst, ob die kostenlose Anleitung f\u00fcr deinen Alltag Sinn macht, k\u00f6nnen wir das ruhig machen. Wenn nicht, ist auch okay.";

const HUMAN_REQUEST_HANDOFF_REPLY =
  "Ja, das macht Sinn.\n" +
  "Dann halte ich kurz fest, worum es geht, und Jochen meldet sich pers\u00f6nlich bei dir.";

const IDENTITY_QUESTION_REPLY =
  "Ich bin Pete, Jochens KI-Assistent. Ich helfe hier bei der ersten Einordnung, damit du schnell eine saubere Antwort bekommst. Wenn es pers\u00f6nlich oder konkreter wird, \u00fcbernimmt Jochen direkt.";

const UNCLEAR_CONTEXT_REPLY =
  "Alles klar. Dann machen wir es einfach:\nWelches Thema m\u00f6chtest du in den n\u00e4chsten Wochen zuerst angehen: Energie, Bauch, Schlaf/Stress oder Struktur?";

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s€]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(input: string, keywords: string[]): string | undefined {
  return keywords.find((keyword) => input.includes(normalizeText(keyword)));
}

function getPromptRule(category: PeteEscalationCategory) {
  return PETE_ESCALATION_RULES.find((rule) => rule.category === category);
}

function buildReason(
  category: PeteEscalationCategory,
  matchedKeyword: string | undefined,
  fallback: string,
): string {
  const rule = getPromptRule(category);
  const matchedText = matchedKeyword ? `matched "${matchedKeyword}"` : fallback;

  return rule?.behavior ? `${matchedText}; ${rule.behavior}` : matchedText;
}

function isExpectedShortContext(
  normalized: string,
  context?: PeteRuntimeSafetyContext,
): boolean {
  if (!normalized || !context?.currentStep) {
    return false;
  }

  if (
    context.currentStep === "intro_ack" &&
    INTRO_ACK_ACCEPTED.some((keyword) => normalized === keyword)
  ) {
    return true;
  }

  if (
    (context.currentStep === "situation_choice" ||
      context.currentStep === "goal_choice") &&
    ["a", "b", "c", "d"].includes(normalized)
  ) {
    return true;
  }

  if (
    context.currentStep === "commitment" &&
    ["a", "b", "wirklich angehen", "erstmal infos", "erst mal infos"].includes(
      normalized,
    )
  ) {
    return true;
  }

  if (
    context.currentStep === "importance_scale" &&
    /^(10|[1-9])$/.test(normalized)
  ) {
    return true;
  }

  if (
    context.currentStep === "booking" &&
    context.hasPendingBooking &&
    BOOKING_CONFIRMATION.some((keyword) => normalized === keyword)
  ) {
    return true;
  }

  if (
    context.hasActiveProviderBooking &&
    PROVIDER_BOOKING_EXPECTED.some(
      (keyword) => normalized === keyword || normalized.includes(keyword),
    )
  ) {
    return true;
  }

  return false;
}

function isEmojiOnlyOrEmptyContext(inputText: string, normalized: string): boolean {
  if (!inputText.trim()) {
    return false;
  }

  return !normalized && inputText.trim().length <= 8;
}

function isUnclearContext(
  inputText: string,
  normalized: string,
  context?: PeteRuntimeSafetyContext,
): boolean {
  if (isExpectedShortContext(normalized, context)) {
    return false;
  }

  if (isEmojiOnlyOrEmptyContext(inputText, normalized)) {
    return true;
  }

  if (UNCLEAR_SHORT_INPUTS.some((keyword) => normalized === keyword)) {
    return true;
  }

  if (
    normalized.length <= 24 &&
    (normalized.includes("keine ahnung") ||
      normalized.includes("weiss nicht") ||
      normalized.includes("weis nicht")) &&
    (normalized.includes("ok") || normalized.includes("haha"))
  ) {
    return true;
  }

  return false;
}

function hasAggressiveClosingText(text: string): boolean {
  const normalized = normalizeText(text);

  return [
    "buchungslink",
    "checkout",
    "platz sichern",
    "direkt sichern",
    "direkt buchen",
    "direkt kaufen",
  ].some((keyword) => normalized.includes(keyword));
}

function hasNormalFlowJochenThirdPersonText(text: string): boolean {
  const normalized = normalizeText(text);

  return [
    "jochen schaut",
    "jochen sagt",
    "jochen kann",
    "jochen wird",
    "jochen sollte",
    "jochen macht",
    "jochen gibt",
    "an jochen",
    "jochen uebernimmt",
    "jochen ubernimmt",
  ].some((keyword) => normalized.includes(keyword));
}

function getSafeOfferPriceText(campaign?: CampaignConfig): string | undefined {
  const text = campaign?.offerContext?.priceInquiryText?.trim();

  if (
    !text ||
    hasAggressiveClosingText(text) ||
    hasNormalFlowJochenThirdPersonText(text)
  ) {
    return undefined;
  }

  return text;
}

function isHttpUrl(value: string | undefined): value is string {
  const url = value?.trim();
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));
}

type RuntimeLinkOption = {
  label: string;
  url: string;
};

function normalizeUrlForCompare(value: string | undefined): string {
  return String(value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

function isLegacyStartphaseInfoUrl(value: string | undefined): boolean {
  return (
    normalizeUrlForCompare(value) ===
    normalizeUrlForCompare(LEGACY_STARTPHASE_INFO_URL)
  );
}

function buildDefaultVideoGuideLink(): RuntimeLinkOption {
  return {
    label: "Kostenlose Video-Anleitung",
    url: DEFAULT_VIDEO_GUIDE_URL,
  };
}

function buildElterncheckLink(): RuntimeLinkOption {
  return {
    label: OFFER_TRUTH.resources.elterncheck.name,
    url: OFFER_TRUTH.resources.elterncheck.url,
  };
}

function buildKetoGuideLink(): RuntimeLinkOption {
  return {
    label: OFFER_TRUTH.resources.ketoGuide.name,
    url: OFFER_TRUTH.resources.ketoGuide.url,
  };
}

function hasElterncheckIntent(normalized: string): boolean {
  return (
    normalized.includes("elterncheck") ||
    normalized.includes("eltern check") ||
    normalized.includes("check")
  );
}

function hasKetoGuideIntent(normalized: string): boolean {
  return (
    normalized.includes("keto guide") ||
    normalized.includes("keto-guide") ||
    normalized.includes("ketoguide") ||
    normalized.includes("keto")
  );
}

type ConfiguredResourceKind = "elterncheck" | "keto";

function resolveConfiguredResourceLink(
  campaign: CampaignConfig | undefined,
  kind: ConfiguredResourceKind,
): { matched: boolean; link?: RuntimeLinkOption } {
  const context = campaign?.offerContext;
  if (!context) {
    return { matched: false };
  }

  const slots = [
    {
      enabled: context.infoLink1Enabled,
      label: context.infoLink1Label,
      url: context.infoLink1Url,
    },
    {
      enabled: context.infoLink2Enabled,
      label: context.infoLink2Label,
      url: context.infoLink2Url,
    },
    {
      enabled: context.infoLink3Enabled,
      label: context.infoLink3Label,
      url: context.infoLink3Url,
    },
    {
      enabled: context.infoLink4Enabled,
      label: context.infoLink4Label,
      url: context.infoLink4Url,
    },
  ];

  for (const slot of slots) {
    const label = String(slot.label ?? "").trim();
    const url = String(slot.url ?? "").trim();
    const haystack = `${normalizeText(label)} ${normalizeUrlForCompare(url)}`;
    const isMatch =
      kind === "elterncheck"
        ? haystack.includes("check")
        : haystack.includes("keto");

    if (!isMatch) {
      continue;
    }

    if (slot.enabled !== true || !isHttpUrl(url)) {
      return { matched: true };
    }

    return {
      matched: true,
      link: {
        label: label || "Info-Link",
        url,
      },
    };
  }

  return { matched: false };
}

function hasVideoGuideIntent(normalized: string): boolean {
  return (
    normalized.includes("video") ||
    normalized.includes("anleitung") ||
    normalized.includes("kostenlos")
  );
}

function linkLooksLikeVideoGuide(link: RuntimeLinkOption): boolean {
  const label = normalizeText(link.label);
  const url = normalizeUrlForCompare(link.url);

  return (
    label.includes("video") ||
    label.includes("anleitung") ||
    label.includes("kostenlos") ||
    url.includes("video") ||
    url.includes("anleitung") ||
    url.includes("training") ||
    url.includes("eltern-energie-training")
  );
}

function linkLooksLikeOffer(link: RuntimeLinkOption): boolean {
  const label = normalizeText(link.label);
  const url = normalizeUrlForCompare(link.url);

  return (
    label.includes("angebot") ||
    label.includes("programm") ||
    label.includes("coaching") ||
    label.includes("eltern vital") ||
    label.includes("selbststarter") ||
    label.includes("startphase") ||
    url.includes("die-eltern-vital-methode") ||
    url.includes("no-bullshit-elternfitness-selbststarter") ||
    url.includes("die-eltern-energie-startphase")
  );
}

function getConfiguredInfoLinks(campaign?: CampaignConfig): RuntimeLinkOption[] {
  const offerContext = campaign?.offerContext;
  const links: RuntimeLinkOption[] = [];

  if (offerContext?.infoLink1Enabled && isHttpUrl(offerContext.infoLink1Url)) {
    links.push({
      label: offerContext.infoLink1Label?.trim() || "Info-Link",
      url: offerContext.infoLink1Url.trim(),
    });
  }

  if (offerContext?.infoLink2Enabled && isHttpUrl(offerContext.infoLink2Url)) {
    links.push({
      label: offerContext.infoLink2Label?.trim() || "Info-Link",
      url: offerContext.infoLink2Url.trim(),
    });
  }

  if (offerContext?.infoLink3Enabled && isHttpUrl(offerContext.infoLink3Url)) {
    links.push({
      label: offerContext.infoLink3Label?.trim() || "Info-Link",
      url: offerContext.infoLink3Url.trim(),
    });
  }

  if (offerContext?.infoLink4Enabled && isHttpUrl(offerContext.infoLink4Url)) {
    links.push({
      label: offerContext.infoLink4Label?.trim() || "Info-Link",
      url: offerContext.infoLink4Url.trim(),
    });
  }

  if (
    links.length === 0 &&
    isHttpUrl(campaign?.texts.infoPageUrl) &&
    !isLegacyStartphaseInfoUrl(campaign?.texts.infoPageUrl)
  ) {
    links.push({
      label: "Kostenlose Video-Anleitung",
      url: campaign.texts.infoPageUrl.trim(),
    });
  }

  if (links.length === 0) {
    links.push(buildDefaultVideoGuideLink());
  }

  return links;
}

function getMatchingInfoLinks(
  links: RuntimeLinkOption[],
  normalized: string,
): RuntimeLinkOption[] {
  if (hasElterncheckIntent(normalized)) {
    const configured = links.filter((link) => {
      const label = normalizeText(link.label);
      const url = normalizeUrlForCompare(link.url);
      return label.includes("check") || url.includes("check.");
    });
    return configured.length > 0 ? configured : [buildElterncheckLink()];
  }

  if (hasKetoGuideIntent(normalized)) {
    const configured = links.filter((link) => {
      const label = normalizeText(link.label);
      const url = normalizeUrlForCompare(link.url);
      return label.includes("keto") || url.includes("keto");
    });
    return configured.length > 0 ? configured : [buildKetoGuideLink()];
  }

  if (links.length <= 1) {
    if (hasVideoGuideIntent(normalized)) {
      return links.filter(
        (link) =>
          linkLooksLikeVideoGuide(link) && !isLegacyStartphaseInfoUrl(link.url),
      );
    }

    return links.filter((link) => !isLegacyStartphaseInfoUrl(link.url));
  }

  const wantsVideoGuide = hasVideoGuideIntent(normalized);
  const wantsOffer =
    normalized.includes("angebot") ||
    normalized.includes("programm") ||
    normalized.includes("coaching") ||
    normalized.includes("eltern vital") ||
    normalized.includes("selbststarter") ||
    normalized.includes("startphase");

  if (wantsVideoGuide) {
    return links.filter(
      (link) =>
        linkLooksLikeVideoGuide(link) && !isLegacyStartphaseInfoUrl(link.url),
    );
  }

  const matching = links.filter((link) => {
    return wantsOffer && linkLooksLikeOffer(link);
  });

  const safeLinks = links.filter((link) => !isLegacyStartphaseInfoUrl(link.url));
  return matching.length > 0 ? matching : safeLinks;
}

export function buildPeteRuntimeInfoLinkReply(
  inputText: string,
  campaign?: CampaignConfig,
  context?: PeteRuntimeSafetyContext,
): string {
  const normalized = normalizeText(inputText);
  const normalizedLinkContext = [normalized, normalizeText(context?.lastAssistantText)]
    .filter(Boolean)
    .join(" ");

  const requestedResource: ConfiguredResourceKind | null =
    hasElterncheckIntent(normalizedLinkContext)
      ? "elterncheck"
      : hasKetoGuideIntent(normalizedLinkContext)
        ? "keto"
        : null;

  if (requestedResource) {
    const configuredResource = resolveConfiguredResourceLink(
      campaign,
      requestedResource,
    );

    if (configuredResource.matched) {
      if (!configuredResource.link) {
        return LINK_CLARIFICATION_REPLY;
      }

      return (
        "Klar, hier ist der Link:\n" +
        `${configuredResource.link.label}\n` +
        configuredResource.link.url
      );
    }
  }

  const matchingLinks = getMatchingInfoLinks(
    getConfiguredInfoLinks(campaign),
    normalizedLinkContext,
  );
  const links =
    matchingLinks.length > 0
      ? matchingLinks
      : hasVideoGuideIntent(normalizedLinkContext)
        ? [buildDefaultVideoGuideLink()]
        : matchingLinks;

  if (links.length === 0) {
    return LINK_CLARIFICATION_REPLY;
  }

  if (links.length > 1) {
    const labels = links.map((link) => link.label).join(" oder ");
    return `Meinst du ${labels}?`;
  }

  const [link] = links;
  const label = normalizeText(link.label);
  const intro =
    label.includes("video") || label.includes("anleitung")
      ? "Klar, hier ist die kostenlose Video-Anleitung:"
      : "Klar, hier ist der Link:";

  return `${intro}\n${link.label}\n${link.url}`;
}

function buildBookingLinkReply(bookingUrl?: string): string {
  if (!isHttpUrl(bookingUrl)) {
    return HUMAN_REQUEST_HANDOFF_REPLY;
  }

  return (
    "Ja, das macht Sinn.\n" +
    "Dann lass uns direkt einen Termin festmachen, damit das nicht im Chat versandet.\n" +
    "Hier kannst du dir ein Strategiegespr\u00e4ch sichern:\n" +
    bookingUrl.trim()
  );
}

function buildMedicalSoftReply(matchedKeyword: string): string {
  const matched = normalizeText(matchedKeyword);
  const intro =
    matched.includes("pfeifen") ||
    matched.includes("tinnitus") ||
    matched.includes("ohr")
      ? "Das mit dem Pfeifen im Ohr notiere ich mir."
      : "Den gesundheitlichen Hinweis notiere ich mir.";

  return (
    `${intro} Sowas sollte bei Bedarf sauber abgekl\u00e4rt werden.\n` +
    "F\u00fcr die Einordnung hier ist wichtig:\n" +
    "Geht es bei dir zus\u00e4tzlich eher um Stress/Schlaf, Energie oder Bauch?"
  );
}

function buildDirectPriceReply(_campaign?: CampaignConfig): string {
  return (
    `Das 5-Wochen-Coaching liegt bei ${OFFER_TRUTH.coachingEntry.priceText}.\n` +
    `Der Selbststarter liegt bei ${OFFER_TRUTH.selfstarter.priceText}.\n` +
    `Die 6-Monats-Begleitung liegt regulär bei ${OFFER_TRUTH.longTerm.priceText}; nach dem 5-Wochen-Coaching bleiben durch die Anrechnung noch ${OFFER_TRUTH.longTerm.upgradeBalanceEur?.toLocaleString("de-DE")} € offen.`
  );
}

function buildPriceReply(
  normalized: string,
  context?: PeteRuntimeSafetyContext,
): string {
  const directPriceRequest =
    context?.askedPrice ||
    includesAnyKeyword(normalized, DIRECT_PRICE_KEYWORDS) !== undefined;

  if (directPriceRequest) {
    return buildDirectPriceReply(context?.campaign) || DIRECT_PRICE_REPLY_FALLBACK;
  }

  return getSafeOfferPriceText(context?.campaign) ?? PRICE_FALLBACK_REPLY;
}

type LinkIntentKind = "info" | "booking" | "clarify";

function classifyLinkIntent(
  normalized: string,
  context?: PeteRuntimeSafetyContext,
): LinkIntentKind | null {
  const linkMatch = includesAnyKeyword(normalized, LINK_REQUEST_KEYWORDS);
  if (!linkMatch) {
    return null;
  }

  const previousAssistantText = normalizeText(context?.lastAssistantText);
  const currentHasInfoContext =
    includesAnyKeyword(normalized, INFO_LINK_CONTEXT_KEYWORDS) !== undefined;
  const currentHasBookingContext =
    includesAnyKeyword(normalized, BOOKING_LINK_CONTEXT_KEYWORDS) !== undefined;
  const currentHasOfferContext =
    includesAnyKeyword(normalized, OFFER_LINK_CONTEXT_KEYWORDS) !== undefined;
  const previousHasInfoContext =
    includesAnyKeyword(previousAssistantText, INFO_LINK_CONTEXT_KEYWORDS) !==
    undefined;
  const previousHasBookingContext =
    includesAnyKeyword(previousAssistantText, BOOKING_LINK_CONTEXT_KEYWORDS) !==
    undefined;

  if (currentHasBookingContext) {
    return "booking";
  }

  if (currentHasInfoContext || currentHasOfferContext || previousHasInfoContext) {
    return "info";
  }

  if (previousHasBookingContext) {
    return "booking";
  }

  return "clarify";
}

function getHumanRequestMatch(
  normalized: string,
  context?: PeteRuntimeSafetyContext,
): string | undefined {
  const matchedKeyword = includesAnyKeyword(normalized, HUMAN_REQUEST_KEYWORDS);

  if (!matchedKeyword) {
    return undefined;
  }

  const ambiguousBookingTerm = matchedKeyword === "termin";
  if (
    ambiguousBookingTerm &&
    (context?.hasActiveProviderBooking || context?.currentStep === "booking")
  ) {
    return undefined;
  }

  return matchedKeyword;
}

function result(params: Omit<PeteRuntimeSafetyResult, "shouldIntercept">): PeteRuntimeSafetyResult {
  return {
    shouldIntercept: params.category !== "none",
    ...params,
  };
}

export function evaluatePeteRuntimeSafety(
  inputText: string | null | undefined,
  context: PeteRuntimeSafetyContext = {},
): PeteRuntimeSafetyResult {
  const normalized = normalizeText(inputText);

  if (!normalized && !String(inputText ?? "").trim()) {
    return result({
      category: "none",
      leadTemperature: "cold",
      reason: "empty_input",
    });
  }

  const emotionalMatch = includesAnyKeyword(
    normalized,
    EMOTIONAL_CRISIS_KEYWORDS,
  );
  if (emotionalMatch) {
    return result({
      category: "emotional_crisis",
      leadTemperature: "handoff",
      replyText: EMOTIONAL_CRISIS_REPLY,
      shouldHandoffToJochen: true,
      shouldStopAutomation: true,
      reason: buildReason("mental_emotional", emotionalMatch, "emotional_crisis"),
    });
  }

  const medicalMatch =
    includesAnyKeyword(normalized, MEDICAL_KEYWORDS) ??
    includesAnyKeyword(normalized, MEDICAL_SOFT_KEYWORDS);
  const medicalCriticalMatch = includesAnyKeyword(
    normalized,
    MEDICAL_CRITICAL_KEYWORDS,
  );
  if (medicalMatch && medicalCriticalMatch) {
    return result({
      category: "medical_critical",
      leadTemperature: "handoff",
      replyText: MEDICAL_CRITICAL_REPLY,
      shouldHandoffToJochen: true,
      shouldStopAutomation: true,
      reason: buildReason("medical", medicalCriticalMatch, "medical_critical"),
    });
  }

  if (medicalMatch) {
    return result({
      category: "medical_soft",
      leadTemperature: "warm",
      replyText: buildMedicalSoftReply(medicalMatch),
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: buildReason("medical", medicalMatch, "medical_soft"),
    });
  }

  const legalPrivacyMatch = includesAnyKeyword(
    normalized,
    LEGAL_PRIVACY_KEYWORDS,
  );
  if (legalPrivacyMatch) {
    return result({
      category: "legal_privacy",
      leadTemperature: "handoff",
      replyText: LEGAL_PRIVACY_REPLY,
      shouldHandoffToJochen: true,
      shouldStopAutomation: true,
      reason: buildReason("legal_privacy", legalPrivacyMatch, "legal_privacy"),
    });
  }

  const identityQuestionMatch = includesAnyKeyword(
    normalized,
    IDENTITY_QUESTION_KEYWORDS,
  );
  if (identityQuestionMatch) {
    return result({
      category: "identity_question",
      leadTemperature: "warm",
      replyText: IDENTITY_QUESTION_REPLY,
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: `matched "${identityQuestionMatch}"; honest bot identity answer`,
    });
  }

  const nutritionPlanMatch = includesAnyKeyword(
    normalized,
    NUTRITION_PLAN_KEYWORDS,
  );
  if (nutritionPlanMatch) {
    return result({
      category: "scope_boundary",
      leadTemperature: "warm",
      replyText: NUTRITION_PLAN_SCOPE_REPLY,
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: `scope_boundary_nutrition_plan:${nutritionPlanMatch}`,
    });
  }

  const humanRequestMatch = getHumanRequestMatch(normalized, context);
  if (humanRequestMatch) {
    const hasBookingUrl = isHttpUrl(context.bookingUrl);
    return result({
      category: "human_request",
      leadTemperature: "hot",
      replyText: hasBookingUrl
        ? buildBookingLinkReply(context.bookingUrl)
        : HUMAN_REQUEST_HANDOFF_REPLY,
      shouldHandoffToJochen: !hasBookingUrl,
      shouldStopAutomation: !hasBookingUrl,
      reason: buildReason("hot_lead", humanRequestMatch, "human_request"),
    });
  }

  const linkIntent = classifyLinkIntent(normalized, context);
  if (linkIntent === "info") {
    return result({
      category: "info_link",
      leadTemperature: "warm",
      replyText: buildPeteRuntimeInfoLinkReply(normalized, context?.campaign, context),
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: "contextual_info_link_request",
    });
  }

  if (linkIntent === "booking") {
    const hasBookingUrl = isHttpUrl(context.bookingUrl);
    return result({
      category: "booking_link",
      leadTemperature: "hot",
      replyText: buildBookingLinkReply(context.bookingUrl),
      shouldHandoffToJochen: !hasBookingUrl,
      shouldStopAutomation: !hasBookingUrl,
      reason: hasBookingUrl
        ? "contextual_booking_link_request"
        : "booking_link_requested_without_safe_url",
    });
  }

  if (linkIntent === "clarify") {
    return result({
      category: "link_clarification",
      leadTemperature: "warm",
      replyText: LINK_CLARIFICATION_REPLY,
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: "ambiguous_link_request",
    });
  }

  const priceMatch = includesAnyKeyword(normalized, PRICE_KEYWORDS);
  if (priceMatch) {
    return result({
      category: "price",
      leadTemperature: "warm",
      replyText: buildPriceReply(normalized, context),
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: buildReason("price_negotiation", priceMatch, "price"),
    });
  }

  const distrustAggressionMatch = includesAnyKeyword(
    normalized,
    DISTRUST_AGGRESSION_KEYWORDS,
  );
  if (distrustAggressionMatch) {
    return result({
      category: "distrust_aggression",
      leadTemperature: "warm",
      replyText: DISTRUST_AGGRESSION_REPLY,
      shouldHandoffToJochen: true,
      shouldStopAutomation: false,
      reason: buildReason(
        "aggression_mistrust",
        distrustAggressionMatch,
        "distrust_aggression",
      ),
    });
  }

  if (isUnclearContext(String(inputText ?? ""), normalized, context)) {
    return result({
      category: "unclear",
      leadTemperature: "cold",
      replyText: UNCLEAR_CONTEXT_REPLY || PETE_NEUTRAL_CONFIDENCE_FALLBACK,
      shouldHandoffToJochen: false,
      shouldStopAutomation: false,
      reason: buildReason("unclear_context", undefined, "unclear_context"),
    });
  }

  return result({
    category: "none",
    leadTemperature: "cold",
    reason: "no_runtime_safety_match",
  });
}

export function buildPeteRuntimeHandoffPendingReply(): string {
  return (
    "Ich habe das schon an Jochen weitergegeben.\n" +
    "Er schaut pers\u00f6nlich drauf, bevor hier automatisch weitergeantwortet wird."
  );
}
