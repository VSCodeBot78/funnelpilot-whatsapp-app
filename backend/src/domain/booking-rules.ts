import { getCampaignById } from "../config/campaigns.js";
import { DEFAULT_BOOKING_WINDOW_CONFIG, type BookingWindowKey } from "../config/booking-windows.js";
import type {
  BookingPreference,
  BookingRequestDetectionResult,
} from "../types/types.js";

const MORNING_KEYWORDS = [
  "vormittag",
  "vormittags",
  "morgens",
  "morgen früh",
  "früh",
];

const AFTERNOON_KEYWORDS = [
  "nachmittag",
  "nachmittags",
  "mittags",
  "abends",
  "später",
];

const DAY_KEYWORDS = [
  "montag",
  "dienstag",
  "mittwoch",
  "donnerstag",
  "freitag",
  "samstag",
  "sonntag",
  "morgen",
  "übermorgen",
  "uebermorgen",
];

const BOOKING_CONFIRM_KEYWORDS = [
  "ja",
  "ja klar",
  "klar",
  "passt",
  "natürlich",
  "natuerlich",
  "safe",
  "mache ich",
  "geb bescheid",
  "gebe bescheid",
  "ich sage bescheid",
  "ich gebe bescheid",
  "yes",
  "okay",
  "ok",
];

const WEEKDAY_EVENING_KEYWORDS = [
  "unter der woche",
  "wochentags",
  "abends",
  "unter der woche abends",
  "woche abends",
  "mo do abends",
  "mo-do abends",
  "montag bis donnerstag abends",
  "abend",
];

const FRI_SAT_DAYTIME_KEYWORDS = [
  "freitag oder samstag",
  "freitag und samstag",
  "freitag",
  "samstag",
  "tagsüber",
  "tagsueber",
  "fr sa tagsüber",
  "fr sa tagsueber",
  "freitag samstag tagsüber",
  "freitag samstag tagsueber",
];

const FLEXIBLE_KEYWORDS = [
  "flexibel",
  "ich bin flexibel",
  "relativ flexibel",
  "bin flexibel",
  "mir egal",
  "geht alles",
];

const LEADING_FILLER_PATTERNS: RegExp[] = [
  /^\s*vormittags[\s,.-]*/i,
  /^\s*nachmittags[\s,.-]*/i,
  /^\s*morgens[\s,.-]*/i,
  /^\s*abends[\s,.-]*/i,
  /^\s*mittags[\s,.-]*/i,
  /^\s*wie wäre es(?:\s+denn)?(?:\s+wenn)?[\s,.-]*/i,
  /^\s*wie waere es(?:\s+denn)?(?:\s+wenn)?[\s,.-]*/i,
  /^\s*wie sieht'?s aus[\s,.-]*/i,
  /^\s*wie sieht es aus[\s,.-]*/i,
  /^\s*direkt[\s,.-]*/i,
  /^\s*eigentlich[\s,.-]*/i,
  /^\s*bei mir geht[\s,.-]*/i,
  /^\s*bei mir würde(?:\s+gehen)?[\s,.-]*/i,
  /^\s*bei mir wuerde(?:\s+gehen)?[\s,.-]*/i,
  /^\s*bei mir passt[\s,.-]*/i,
  /^\s*passt bei mir[\s,.-]*/i,
  /^\s*ich könnte(?:\s+auch)?[\s,.-]*/i,
  /^\s*ich koennte(?:\s+auch)?[\s,.-]*/i,
  /^\s*ich kann(?:\s+auch)?[\s,.-]*/i,
  /^\s*für mich(?:\s+wäre)?[\s,.-]*/i,
  /^\s*fuer mich(?:\s+waere)?[\s,.-]*/i,
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAnyKeyword(input: string, keywords: string[]): string | null {
  const normalized = normalizeText(input);

  for (const keyword of keywords) {
    if (normalized.includes(normalizeText(keyword))) {
      return keyword;
    }
  }

  return null;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hasDayKeyword(input: string): boolean {
  return DAY_KEYWORDS.some((keyword) => input.includes(keyword));
}

function hasTimePattern(input: string): boolean {
  return (
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i.test(input) ||
    /\b([01]?\d|2[0-3])\s*uhr\b/i.test(input)
  );
}

function hasLooseHourPattern(input: string): boolean {
  return /\b(?:um\s*)?([01]?\d|2[0-3])\b/i.test(input);
}

function normalizeHourTime(value: string): string {
  const trimmed = value.trim();

  const fullMatch = trimmed.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i);
  if (fullMatch) {
    return `${fullMatch[1]}:${fullMatch[2]}`;
  }

  const hourMatch = trimmed.match(/\b([01]?\d|2[0-3])\s*uhr\b/i);
  if (hourMatch) {
    return `${hourMatch[1]} Uhr`;
  }

  const looseHourMatch = trimmed.match(/\b(?:um\s*)?([01]?\d|2[0-3])\b/i);
  if (looseHourMatch) {
    return `${looseHourMatch[1]} Uhr`;
  }

  return trimmed;
}

function extractRequestedDay(input: string): string | undefined {
  const normalized = normalizeText(input);
  return DAY_KEYWORDS.find((day) => normalized.includes(day));
}

function extractRequestedTimeText(input: string, hasDay: boolean): string | undefined {
  const cleaned = input.trim();

  const fullTimeMatch = cleaned.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i);
  if (fullTimeMatch) {
    return normalizeHourTime(fullTimeMatch[0]);
  }

  const hourWithUhrMatch = cleaned.match(/\b([01]?\d|2[0-3])\s*uhr\b/i);
  if (hourWithUhrMatch) {
    return normalizeHourTime(hourWithUhrMatch[0]);
  }

  const looseHourMatch =
    !fullTimeMatch && !hourWithUhrMatch
      ? cleaned.match(/\b(?:um\s*)?([01]?\d|2[0-3])\b/i)
      : null;

  if (looseHourMatch && hasDay) {
    return normalizeHourTime(looseHourMatch[0]);
  }

  return undefined;
}

function cleanupBookingText(value: string): string {
  let cleaned = value
    .replace(/\?/g, " ")
    .replace(/\!/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of LEADING_FILLER_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  cleaned = cleaned
    .replace(/\b(direkt|eigentlich)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = normalizeText(cleaned);
  const dayMatch = extractRequestedDay(normalized);
  const preference = detectBookingPreference(normalized);
  const timeText = extractRequestedTimeText(cleaned, Boolean(dayMatch));

  let result = "";

  if (dayMatch) {
    result = dayMatch;
  } else if (preference !== "unknown") {
    result = preference === "vormittags" ? "vormittags" : "nachmittags";
  }

  if (result && timeText) {
    result = `${result} um ${timeText}`;
  } else if (!result && timeText) {
    result = timeText;
  }

  if (!result) {
    result = cleaned;
  }

  result = result.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  return capitalizeFirst(result);
}

export function detectBookingPreference(input: string): BookingPreference {
  const normalized = normalizeText(input);

  if (includesAnyKeyword(normalized, MORNING_KEYWORDS)) {
    return "vormittags";
  }

  if (includesAnyKeyword(normalized, AFTERNOON_KEYWORDS)) {
    return "nachmittags";
  }

  return "unknown";
}

export function detectBookingWindow(input: string): BookingWindowKey {
  const normalized = normalizeText(input);

  if (includesAnyKeyword(normalized, FLEXIBLE_KEYWORDS)) {
    return "flexible";
  }

  if (includesAnyKeyword(normalized, WEEKDAY_EVENING_KEYWORDS)) {
    return "weekday_evening";
  }

  if (includesAnyKeyword(normalized, FRI_SAT_DAYTIME_KEYWORDS)) {
    return "fri_sat_daytime";
  }

  return "unknown";
}

export function hasConcreteBookingRequest(input: string): boolean {
  const normalized = normalizeText(input);
  const hasDay = hasDayKeyword(normalized);
  const hasTime = hasTimePattern(normalized) || (hasDay && hasLooseHourPattern(normalized));

  return hasDay || hasTime;
}

export function detectBookingRequest(input: string): BookingRequestDetectionResult {
  const normalized = normalizeText(input);
  const preference = detectBookingPreference(normalized);
  const concrete = hasConcreteBookingRequest(normalized);

  if (!concrete) {
    return {
      preference,
      hasConcreteRequest: false,
    };
  }

  const requestedDay = extractRequestedDay(normalized);
  const requestedTimeText = extractRequestedTimeText(input, Boolean(requestedDay));

  return {
    preference,
    hasConcreteRequest: true,
    requestedText: cleanupBookingText(input),
    requestedDay,
    requestedTimeText,
  };
}

export function isNoShowGuardConfirmation(input: string): boolean {
  return includesAnyKeyword(input, BOOKING_CONFIRM_KEYWORDS) !== null;
}

export function getBookingPrompt(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.bookingPrompt;
}

export function getBookingFollowUpPrompt(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.bookingFollowUpPrompt;
}

export function getBookingWindowPrompt(): string {
  return DEFAULT_BOOKING_WINDOW_CONFIG.prompt;
}

export function getBookingPreferenceFollowUpText(input: BookingPreference | BookingWindowKey): string {
  if (input === "weekday_evening") {
    return DEFAULT_BOOKING_WINDOW_CONFIG.followUpByKey.weekday_evening;
  }

  if (input === "fri_sat_daytime") {
    return DEFAULT_BOOKING_WINDOW_CONFIG.followUpByKey.fri_sat_daytime;
  }

  if (input === "flexible") {
    return DEFAULT_BOOKING_WINDOW_CONFIG.followUpByKey.flexible;
  }

  if (input === "vormittags") {
    return "Passt. Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich tagsüber gut passt.";
  }

  if (input === "nachmittags") {
    return "Passt. Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich abends oder tagsüber gut passt.";
  }

  return "Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich gut passt.";
}

export function getBookingNoShowGuardText(
  campaignId: string,
  params: { day?: string; time?: string; bookingText?: string },
): string {
  const campaign = getCampaignById(campaignId);

  let slotText = "";

  if (params.bookingText?.trim()) {
    slotText = params.bookingText.trim();
  } else if (params.day && params.time) {
    slotText = `${params.day} um ${params.time}`;
  } else if (params.day) {
    slotText = params.day;
  }

  return campaign.texts.bookingNoShowGuardTemplate
    .replace("[Tag]", slotText || "dem Termin")
    .replace("[Uhrzeit]", "");
}

export function getBookingConfirmedText(
  campaignId: string,
  params: { day?: string; time?: string; bookingText?: string },
): string {
  const campaign = getCampaignById(campaignId);

  let slotText = "";

  if (params.bookingText?.trim()) {
    slotText = params.bookingText.trim();
  } else if (params.day && params.time) {
    slotText = `${params.day} um ${params.time}`;
  } else if (params.day) {
    slotText = params.day;
  }

  return campaign.texts.bookingConfirmedTemplate
    .replace("[Tag]", slotText || "dem vereinbarten Termin")
    .replace("[Uhrzeit]", "");
}
