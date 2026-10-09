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

function getActiveInfoLinks(campaignId: string): Array<{ label: string; url: string }> {
  const campaign = getCampaignById(campaignId);
  const context = campaign.offerContext;
  const links: Array<{ label: string; url: string }> = [];

  for (const index of [1, 2, 3, 4] as const) {
    const enabledKey = `infoLink${index}Enabled` as keyof typeof context;
    const labelKey = `infoLink${index}Label` as keyof typeof context;
    const urlKey = `infoLink${index}Url` as keyof typeof context;

    if (!context || context[enabledKey] !== true) {
      continue;
    }

    const url = String(context[urlKey] ?? "").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      continue;
    }

    links.push({
      label: String(context[labelKey] ?? "Info-Link").trim() || "Info-Link",
      url,
    });
  }

  return links;
}

export function getInfoLinkReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  const links = getActiveInfoLinks(campaignId);

  if (links.length === 0) {
    return campaign.texts.infoLinkReply;
  }

  if (links.length === 1) {
    return `Klar, hier ist der Link:\n${links[0].label}\n${links[0].url}`;
  }

  return `Klar. Was davon meinst du: ${links.map((link) => link.label).join(", ")}?`;
}

export function getInfoPageUrl(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  const [firstLink] = getActiveInfoLinks(campaignId);
  return firstLink?.url || campaign.texts.infoPageUrl;
}

export function shouldSendInfoLinkDirectly(input: string): boolean {
  return isInfoLinkOnlyRequest(input);
}
