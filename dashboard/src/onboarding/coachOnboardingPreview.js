export const EMPTY_COACH_DRAFT = Object.freeze({
  version: 1, preferredContact: "", welcomeLine: "", offers: [], faqs: [],
});

// Only a READ-ONLY preview of a future coach profile. This deliberately does
// not generate an AI prompt, a sellable offer, a paid checkout or live sends.
export function getCoachOnboardingPreview(settings = {}) {
  const draft = settings.coachOnboardingDraft || EMPTY_COACH_DRAFT;
  // Only the new coach's inert identity belongs in this preview.
  // NEVER use active Jochen fields as implicit values for another coach.
  const identity = draft.identity || {};
  const brand = String(identity.brandName || "").trim();
  const operator = String(identity.coachName || "").trim();
  const assistant = String(identity.assistantName || "").trim();
  const audience = String(identity.audience || "").trim();
  const tone = String(identity.brandVoice || "").trim();
  const offers = (Array.isArray(draft.offers) ? draft.offers : [])
    .filter(item => item && String(item.name || "").trim());
  const faqs = (Array.isArray(draft.faqs) ? draft.faqs : [])
    .filter(item => item && String(item.question || "").trim() &&
      String(item.answer || "").trim());
  const warnings = [];
  if (!brand || !operator || !assistant || !audience)
    warnings.push("Marke, Betreiber, Assistent und Zielgruppe vollständig eintragen.");
  if (!offers.length)
    warnings.push("Für neue Coaches mindestens ein eigenes Angebot als Entwurf hinterlegen.");
  // Active settings may still contain Jochen links; they never populate
  // this future coach preview, but should be checked before eventual activation.
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
    draftOnly: true, liveReady: false, tenantIsolated: false,
  };
}
