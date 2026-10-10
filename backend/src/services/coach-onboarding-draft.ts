// Draft-only information for future independent coach workspaces.
// These fields must never override hard safety rules, prices or live replies
// until a separate explicit activation and validated offer integration exists.
export type CoachOfferDraft = {
  name: string;
  priceLabel: string;
  url: string;
};
export type CoachFaqDraft = { question: string; answer: string };
export type CoachIdentityDraft = {
  brandName: string;
  coachName: string;
  niche: string;
  audience: string;
  websiteUrl: string;
  assistantName: string;
  brandVoice: string;
  escalation: string;
  noGos: string;
};

export const EMPTY_COACH_IDENTITY: CoachIdentityDraft = {
  brandName: "", coachName: "", niche: "", audience: "", websiteUrl: "",
  assistantName: "", brandVoice: "", escalation: "", noGos: "",
};
export type CoachOnboardingDraft = {
  version: 1;
  identity?: CoachIdentityDraft;
  preferredContact: string;
  welcomeLine: string;
  offers: CoachOfferDraft[];
  faqs: CoachFaqDraft[];
};

export const DEFAULT_COACH_ONBOARDING_DRAFT: CoachOnboardingDraft = {
  version: 1,
  preferredContact: "",
  welcomeLine: "",
  offers: [],
  faqs: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function cleanHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname &&
      !url.username && !url.password && !url.hash &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  } catch { return false; }
}

function onlyFields(obj: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(obj).every(key => allowed.includes(key));
}

export function parseCoachOnboardingDraft(input: unknown):
  { ok: true; value: CoachOnboardingDraft } | { ok: false; error: string } {
  if (!isPlainObject(input) ||
    !onlyFields(input, ["version", "identity", "preferredContact", "welcomeLine", "offers", "faqs"]) ||
    input.version !== 1 ||
    !validText(input.preferredContact, 180) ||
    !validText(input.welcomeLine, 420) ||
    !Array.isArray(input.offers) || input.offers.length > 4 ||
    !Array.isArray(input.faqs) || input.faqs.length > 5) {
    return { ok: false, error: "coach_onboarding_draft_invalid_structure" };
  }

  // The identity is a pure draft; it never changes active settings or Pete.
  // Optional so version-1 records saved before this fix remain readable.
  let identity: CoachIdentityDraft | undefined;
  if (input.identity !== undefined) {
    if (!isPlainObject(input.identity) ||
        !onlyFields(input.identity, Object.keys(EMPTY_COACH_IDENTITY))) {
      return { ok: false, error: "coach_identity_draft_invalid" };
    }
    const limits: Record<keyof CoachIdentityDraft, number> = {
      brandName: 120, coachName: 120, niche: 180, audience: 500,
      websiteUrl: 700, assistantName: 100, brandVoice: 600,
      escalation: 1000, noGos: 1000,
    };
    const collected: Record<string, string> = {};
    for (const field of Object.keys(limits) as Array<keyof CoachIdentityDraft>) {
      const raw = input.identity[field];
      if (!validText(raw, limits[field])) {
        return { ok: false, error: "coach_identity_draft_invalid" };
      }
      collected[field] = raw.trim();
    }
    if (!cleanHttpsUrl(collected.websiteUrl)) {
      return { ok: false, error: "coach_identity_website_invalid" };
    }
    identity = collected as CoachIdentityDraft;
  }

  const offers: CoachOfferDraft[] = [];
  for (const item of input.offers) {
    if (!isPlainObject(item) ||
      !onlyFields(item, ["name", "priceLabel", "url"]) ||
      !validText(item.name, 100) ||
      !validText(item.priceLabel, 80) ||
      !validText(item.url, 700) ||
      !cleanHttpsUrl(item.url.trim())) {
      return { ok: false, error: "coach_offer_draft_invalid" };
    }
    const name = item.name.trim();
    const priceLabel = item.priceLabel.trim();
    const url = item.url.trim();
    if (!name && !priceLabel && !url) continue;
    if (!name) return { ok: false, error: "coach_offer_name_required" };
    offers.push({ name, priceLabel, url });
  }

  const faqs: CoachFaqDraft[] = [];
  for (const item of input.faqs) {
    if (!isPlainObject(item) ||
      !onlyFields(item, ["question", "answer"]) ||
      !validText(item.question, 240) ||
      !validText(item.answer, 700)) {
      return { ok: false, error: "coach_faq_draft_invalid" };
    }
    const question = item.question.trim();
    const answer = item.answer.trim();
    if (!question && !answer) continue;
    if (!question || !answer) return { ok: false, error: "coach_faq_question_and_answer_required" };
    faqs.push({ question, answer });
  }

  return {
    ok: true,
    value: {
      version: 1,
      ...(identity ? { identity } : {}),
      preferredContact: input.preferredContact.trim(),
      welcomeLine: input.welcomeLine.trim(),
      offers,
      faqs,
    },
  };
}
