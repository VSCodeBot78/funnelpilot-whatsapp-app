// Hard boundary for the zero-cost static mobile preview.
// Vite replaces the campaign API imports with this module during the isolated
// preview build. Even an accidentally missing injected demo handler cannot
// reach a real backend, Pete model, Meta API, or contacts.
export async function previewCampaignEntryInApi() {
  throw new Error("Demo-Modus: keine Backend-Verbindung.");
}

export async function previewCampaignWebhookInApi() {
  throw new Error("Demo-Modus: keine Backend-Verbindung.");
}
