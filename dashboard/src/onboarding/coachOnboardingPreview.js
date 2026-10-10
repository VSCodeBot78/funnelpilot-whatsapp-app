export const EMPTY_COACH_DRAFT = Object.freeze({
  version: 1, preferredContact: "", welcomeLine: "", offers: [], faqs: [],
});

// Only a READ-ONLY preview of a future coach profile. This deliberately does
// not generate an AI prompt, a sellable offer, a paid checkout or live sends.
export function getCoachOnboardingPreview(settings = {}) {
  const draft = settings.coachOnboardingDraft || EMPTY_COACH_DRAFT;
  // A draft identity is exclusively draft-sourced: never silently mix with
  // live workspace identity, even when one draft field is still empty.
  const hasDraftIdentity = draft.identity && typeof draft.identity === "object" &&
    !Array.isArray(draft.identity);
  const identity = hasDraftIdentity ? draft.identity : settings;
  const brand = String(hasDraftIdentity ? identity.brandName || "" : identity.companyName || "").trim();
  const operator = String(hasDraftIdentity ? identity.operatorName || "" : identity.adminName || "").trim();
  const assistant = String(hasDraftIdentity ? identity.assistantName || "" : identity.assistantName || "").trim();
  const audience = String(hasDraftIdentity ? identity.audience || "" : identity.companyAudience || "").trim();
  const tone = String(hasDraftIdentity ? identity.tone || "" : identity.brandVoice || "").trim();
  const offers = (Array.isArray(draft.offers) ? draft.offers : [])
    .filter(item => item && String(item.name || "").trim());
  const faqs = (Array.isArray(draft.faqs) ? draft.faqs : [])
    .filter(item => item && String(item.question || "").trim() &&
      String(item.answer || "").trim());
  const warnings = [];
  if (!hasDraftIdentity) warnings.push(
    "Legacy-Vorschau: Marke und Assistent stammen noch aus dem aktiven Workspace. Für fremde Coaches eigene Entwurfs-Identität eingeben."
  );
  if (!brand || !operator || !assistant || !audience)
    warnings.push("Marke, Betreiber, Assistent und Zielgruppe vollständig eintragen.");
  if (!offers.length)
    warnings.push("Für neue Coaches mindestens ein eigenes Angebot als Entwurf hinterlegen.");
  const isOtherBrand = brand && !/eltern\s*fit\s*&\s*vital/i.test(brand);
  const jochenRefs = [
    settings.masterPrompt, settings.defaultBookingUrl, settings.starterCheckoutUrl,
    settings.onboardingBookingUrl, settings.fallbackReply, settings.bookingPrompt,
  ].some(text => /Jochen|Eltern fit\s*&\s*vital|jochen-kammerer\.de|nutrilize\.app/i.test(String(text || "")));
  if (isOtherBrand && jochenRefs) {
    warnings.push("Noch Jochen-/Eltern-fit-&-vital-Vorlagen oder Links hinterlegt. Vor einer Coach-Freigabe separat ersetzen und prüfen.");
  }
  return {
    brand, operator, assistant, audience, tone,
    preferredContact: String(draft.preferredContact || "").trim(),
    welcomeLine: String(draft.welcomeLine || "").trim(),
    offers, faqs, warnings,
    identitySource: hasDraftIdentity ? "coach_draft" : "active_workspace_legacy",
    draftOnly: true, liveReady: false, tenantIsolated: false,
  };
}
