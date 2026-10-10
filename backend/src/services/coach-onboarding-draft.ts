import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

/**
 * Single-local-workspace, inert coach template. This is NOT a tenant, not an
 * activated agent, not a verified price list, and not a runtime campaign.
 */
export type CoachOfferDraft = {
  name: string;
  forWhom: string;
  priceText: string;
  linkUrl: string;
};
export type CoachOnboardingDraft = {
  schemaVersion: 1;
  status: "draft";
  updatedAt: string | null;
  brand: {
    name: string;
    coachName: string;
    niche: string;
    audience: string;
    websiteUrl: string;
  };
  assistant: {
    name: string;
    voice: string;
    language: string;
    escalation: string;
    boundaries: string;
    objections: string;
  };
  links: {
    guideUrl: string;
    checkUrl: string;
    videoUrl: string;
    bookingUrl: string;
  };
  offers: CoachOfferDraft[];
};

const FILE = path.join(env.DATA_DIR, "coach-onboarding-draft.json");
const LIMITS: Record<string, number> = {
  "brand.name": 120, "brand.coachName": 120, "brand.niche": 200,
  "brand.audience": 500, "brand.websiteUrl": 1500,
  "assistant.name": 100, "assistant.voice": 450, "assistant.language": 60,
  "assistant.escalation": 1200, "assistant.boundaries": 1200,
  "assistant.objections": 700, "links.guideUrl": 1500,
  "links.checkUrl": 1500, "links.videoUrl": 1500, "links.bookingUrl": 1500,
  "offers.name": 150, "offers.forWhom": 280,
  "offers.priceText": 150, "offers.linkUrl": 1500,
};

export function emptyCoachOnboardingDraft(): CoachOnboardingDraft {
  return {
    schemaVersion: 1, status: "draft", updatedAt: null,
    brand: { name: "", coachName: "", niche: "", audience: "", websiteUrl: "" },
    assistant: {
      name: "", voice: "", language: "Deutsch", escalation: "",
      boundaries: "", objections: "",
    },
    links: { guideUrl: "", checkUrl: "", videoUrl: "", bookingUrl: "" },
    offers: [],
  };
}

export type DraftIssue = { field: string; message: string };
type Result =
  | { ok: true; draft: CoachOnboardingDraft }
  | { ok: false; issues: DraftIssue[] };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

function isSafeHttps(value: string): boolean {
  if (!value) return true;
  try {
    const uri = new URL(value);
    return uri.protocol === "https:" && Boolean(uri.hostname) &&
      !uri.username && !uri.password && !uri.hash;
  } catch {
    return false;
  }
}

export function validateCoachOnboardingDraft(input: unknown): Result {
  const issues: DraftIssue[] = [];
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [{ field: "draft", message: "Ungültiges Profil." }] };
  }
  // Explicitly whitelist the data model. Client cannot set status, tenant,
  // permissions, AI execution flags, keys or workspace ownership.
  const allowedRoot = new Set(["schemaVersion", "brand", "assistant", "links", "offers"]);
  for (const key of Object.keys(input)) {
    if (!allowedRoot.has(key)) issues.push({ field: key, message: "Nicht zulässiges Feld." });
  }
  if (input.schemaVersion !== 1) {
    issues.push({ field: "schemaVersion", message: "Nicht unterstützte Vorlagenversion." });
  }
  const record: Record<string, unknown> = input;
  const empty = emptyCoachOnboardingDraft();
  function section<T extends Record<string, string>>(
    name: "brand" | "assistant" | "links", model: T,
  ): T {
    const source = record[name];
    if (!isPlainRecord(source)) {
      issues.push({ field: name, message: "Abschnitt fehlt oder ist ungültig." });
      return model;
    }
    const out: Record<string, string> = {};
    const keys = Object.keys(model);
    for (const key of Object.keys(source)) {
      if (!keys.includes(key)) {
        issues.push({ field: name + "." + key, message: "Nicht zulässiges Feld." });
      }
    }
    for (const key of keys) {
      const field = name + "." + key;
      const raw = source[key];
      if (typeof raw !== "string") {
        issues.push({ field, message: "Bitte Text eingeben." });
        out[key] = model[key];
        continue;
      }
      const value = raw.trim();
      if (value.length > LIMITS[field] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
        issues.push({ field, message: "Text zu lang oder enthält ungültige Zeichen." });
      }
      if (key.toLowerCase().endsWith("url") && !isSafeHttps(value)) {
        issues.push({ field, message: "Nur gültige HTTPS-Links ohne Zugangsdaten oder Anker." });
      }
      out[key] = value;
    }
    return out as T;
  }
  const brand = section("brand", empty.brand);
  const assistant = section("assistant", empty.assistant);
  const links = section("links", empty.links);
  const offers: CoachOfferDraft[] = [];
  if (!Array.isArray(input.offers) || input.offers.length > 3) {
    issues.push({ field: "offers", message: "Maximal drei Angebote erlaubt." });
  } else {
    for (const [i, candidate] of input.offers.entries()) {
      if (!isPlainRecord(candidate)) {
        issues.push({ field: "offers." + i, message: "Angebot ungültig." });
        continue;
      }
      const keys = ["name", "forWhom", "priceText", "linkUrl"];
      const out: Record<string, string> = {};
      for (const key of Object.keys(candidate)) {
        if (!keys.includes(key)) {
          issues.push({ field: "offers." + i + "." + key, message: "Nicht zulässiges Feld." });
        }
      }
      for (const key of keys) {
        const field = "offers." + i + "." + key;
        if (typeof candidate[key] !== "string") {
          issues.push({ field, message: "Bitte Text eingeben." });
          out[key] = "";
          continue;
        }
        const value = (candidate[key] as string).trim();
        if (value.length > LIMITS["offers." + key] ||
            /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
          issues.push({ field, message: "Ungültiger oder zu langer Text." });
        }
        if (key === "linkUrl" && !isSafeHttps(value)) {
          issues.push({ field, message: "Nur gültige HTTPS-Links." });
        }
        out[key] = value;
      }
      if (!out.name && (out.priceText || out.linkUrl || out.forWhom)) {
        issues.push({ field: "offers." + i + ".name",
          message: "Bei Preis oder Link ist ein Angebotsname erforderlich." });
      }
      if (out.name) offers.push(out as CoachOfferDraft);
    }
  }
  if (issues.length > 0) return { ok: false, issues: issues.slice(0, 30) };
  return { ok: true, draft: {
    schemaVersion: 1, status: "draft", updatedAt: null,
    brand, assistant, links, offers,
  } };
}

export function readCoachOnboardingDraft(): CoachOnboardingDraft {
  if (!fs.existsSync(FILE)) return emptyCoachOnboardingDraft();
  try {
    const text = fs.readFileSync(FILE, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (!isPlainRecord(parsed)) throw new Error("invalid_draft");
    // Discard persisted server-only metadata before revalidation.
    const { brand, assistant, links, offers, schemaVersion } = parsed;
    const validation = validateCoachOnboardingDraft({
      brand, assistant, links, offers, schemaVersion,
    });
    if (!validation.ok) throw new Error("invalid_draft_shape");
    return {
      ...validation.draft,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    // Never overwrite a corrupt customer's existing onboarding draft.
    throw new Error("coach_draft_invalid_restore_required", { cause: error });
  }
}

export function saveCoachOnboardingDraft(input: unknown): Result {
  const validation = validateCoachOnboardingDraft(input);
  if (!validation.ok) return validation;
  // Check for existing invalid data first: no silent wipe of an older draft.
  if (fs.existsSync(FILE)) readCoachOnboardingDraft();
  const draft: CoachOnboardingDraft = {
    ...validation.draft, updatedAt: new Date().toISOString(),
  };
  writePrivateJsonAtomic(FILE, draft);
  return { ok: true, draft };
}
