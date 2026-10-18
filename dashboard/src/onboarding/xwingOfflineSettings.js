// X-Wing first-start rehearsal. Intentionally never clones real settings,
// API credentials, customer records, provider status or URLs.
export function createXWingOfflineSettings() {
  return {
    productName: "Funnel Pilot",
    companyName: "",
    companyWebsite: "",
    companyNiche: "",
    companyAudience: "",
    companyOfferSummary: "",
    adminName: "",
    assistantName: "",
    brandVoice: "",
    masterPrompt: "",
    customerTopObjections: "",
    escalationHint: "",
    noGos: "",
    defaultBookingUrl: "",
    starterCheckoutUrl: "",
    setupVideoUrl: "",
    apiBaseUrl: "",
    coachOnboardingDraft: {
      version: 1,
      identity: { brandName: "", operatorName: "", assistantName: "",
        audience: "", tone: "" },
      preferredContact: "", welcomeLine: "", offers: [], faqs: [],
    },
  };
}
