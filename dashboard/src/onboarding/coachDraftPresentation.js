// UI-only draft helpers. Never map these values onto active Pete settings,
// live campaign offers, checkout URLs or workspace/tenant permissions.
export function emptyCoachDraft() {
  return {
    schemaVersion: 1,
    brand: { name: "", coachName: "", niche: "", audience: "", websiteUrl: "" },
    assistant: {
      name: "", voice: "", language: "Deutsch", escalation: "",
      boundaries: "", objections: "",
    },
    links: { guideUrl: "", checkUrl: "", videoUrl: "", bookingUrl: "" },
    offers: [],
  };
}

export function editableCoachDraft(raw) {
  const base = emptyCoachDraft();
  if (!raw || raw.schemaVersion !== 1) return base;
  function strings(input, target) {
    return Object.fromEntries(Object.keys(target).map(key => [
      key, typeof input?.[key] === "string" ? input[key] : target[key],
    ]));
  }
  return {
    schemaVersion: 1,
    brand: strings(raw.brand, base.brand),
    assistant: strings(raw.assistant, base.assistant),
    links: strings(raw.links, base.links),
    offers: Array.isArray(raw.offers) ? raw.offers.slice(0, 3).map(item =>
      strings(item, { name: "", forWhom: "", priceText: "", linkUrl: "" })
    ) : [],
  };
}

export function coachDraftChecklist(draft) {
  const present = key => Boolean(String(key || "").trim());
  return [
    { label: "Marke und Coach", complete: present(draft.brand.name) && present(draft.brand.coachName) },
    { label: "Nische und Zielgruppe", complete: present(draft.brand.niche) && present(draft.brand.audience) },
    { label: "Assistent und Markenstimme", complete: present(draft.assistant.name) && present(draft.assistant.voice) },
    { label: "Menschliche Übergabe und Grenzen", complete: present(draft.assistant.escalation) && present(draft.assistant.boundaries) },
    { label: "Mindestens ein Angebot", complete: draft.offers.some(offer => present(offer.name)) },
    { label: "Nächster Schritt", complete: present(draft.links.bookingUrl) || draft.offers.some(offer => present(offer.linkUrl)) },
  ];
}

export function coachDraftCompletion(draft) {
  const checks = coachDraftChecklist(draft);
  return { readyForReview: checks.every(item => item.complete),
    checked: checks.filter(item => item.complete).length, total: checks.length };
}
