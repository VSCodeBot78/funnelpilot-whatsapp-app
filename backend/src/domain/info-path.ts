import { getCampaignById } from "../config/campaigns.js";

const INFO_LINK_ONLY_KEYWORDS = [
  "schick link",
  "schick mir den link",
  "send mir den link",
  "sende mir den link",
  "nur den link",
  "einfach den link",
  "ich will erstmal lesen",
  "ich will erst lesen",
  "ich will nur lesen",
  "ich möchte erstmal lesen",
  "ich möchte erst lesen",
  "ich schau erstmal",
  "ich möchte erstmal schauen",
  "ich will erstmal schauen",
  "ich will erstmal nur schauen",
  "mehr infos",
  "noch mehr infos",
  "hast du mehr infos",
  "hast du noch mehr infos",
  "gibt es mehr infos",
  "kannst du mir mehr infos schicken",
];

const INFO_ONLY_KEYWORDS = [
  "infos",
  "info",
  "erstmal infos",
  "erst mal infos",
  "ich will infos",
  "ich möchte infos",
  "schick infos",
  "schick mir infos",
  "ich hätte gern infos",
  "ich hätte gerne infos",
  "nur infos",
  "erstmal nur infos",
  "ich will erstmal infos",
  "ich möchte erstmal infos",
  "erstmal infos bitte",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

export function isInfoOnlyRequest(input: string): boolean {
  return includesAnyKeyword(input, INFO_ONLY_KEYWORDS) !== null;
}

export function isInfoLinkOnlyRequest(input: string): boolean {
  return includesAnyKeyword(input, INFO_LINK_ONLY_KEYWORDS) !== null;
}

export function isFollowUpInfoLinkRequest(input: string): boolean {
  return isInfoLinkOnlyRequest(input);
}

export function getInfoOnlyReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.infoShortText;
}

export function getInfoLinkReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.infoLinkReply;
}

export function getInfoPageUrl(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.infoPageUrl;
}

export function shouldSendInfoLinkDirectly(input: string): boolean {
  return isInfoLinkOnlyRequest(input);
}
