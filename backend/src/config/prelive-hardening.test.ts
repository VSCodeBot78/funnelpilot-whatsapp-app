import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-prelive-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
delete process.env.OPENAI_API_KEY;

const {
  DEFAULT_CAMPAIGN_ID,
  getCampaignById,
} = await import("../config/campaigns.js");
const {
  saveCampaign,
} = await import("../data/campaigns.store.js");
const {
  saveSchedulingConfig,
} = await import("../data/scheduling-config.store.js");
const {
  getOrCreateConversationState,
  persistConversationState,
  takeOverByHuman,
  releaseToAi,
} = await import("../core/state-manager.js");
const {
  evaluateLatestAiOutboundPermission,
} = await import("../services/ai-outbound-guard.service.js");
const {
  buildPeteRuntimeInfoLinkReply,
} = await import("../core/pete-runtime-safety.js");
const {
  getInfoLinkReply,
} = await import("../domain/info-path.js");
const {
  getCoachingEntryCheckoutUrl,
} = await import("../domain/pricing-rules.js");
const {
  clearConversationStore,
} = await import("../data/store.js");

test("Phase 6 pre-live hardening", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("latest-state outbound guard blocks human takeover", () => {
    clearConversationStore();
    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: "phase6-missing",
        campaignId: DEFAULT_CAMPAIGN_ID,
      }),
      { allowed: false, reason: "conversation_missing" },
    );
    const state = getOrCreateConversationState(
      "phase6-outbound-guard",
      DEFAULT_CAMPAIGN_ID,
    );

    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: state.leadId,
        campaignId: state.campaignId,
      }),
      { allowed: true, reason: null },
    );

    state.aiPaused = true;
    persistConversationState(state);
    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: state.leadId,
        campaignId: state.campaignId,
      }),
      { allowed: false, reason: "ai_paused" },
    );
    state.aiPaused = false;
    persistConversationState(state);

    takeOverByHuman(state);
    persistConversationState(state);

    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: state.leadId,
        campaignId: state.campaignId,
      }),
      { allowed: false, reason: "human_owned" },
    );

    releaseToAi(state);
    persistConversationState(state);

    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: state.leadId,
        campaignId: state.campaignId,
      }),
      { allowed: true, reason: null },
    );

    state.flags.stopped = true;
    persistConversationState(state);

    assert.deepEqual(
      evaluateLatestAiOutboundPermission({
        leadId: state.leadId,
        campaignId: state.campaignId,
      }),
      { allowed: false, reason: "stopped" },
    );
  });

  await t.test("dashboard offer links are used by Pete at runtime", () => {
    const customCheckUrl = "https://example.test/custom-elterncheck";

    saveCampaign({
      id: "fit",
      offerContext: {
        priceInquiryText: "Test",
        infoLink1Enabled: true,
        infoLink1Label: "Eltern Vital Methode",
        infoLink1Url: "https://example.test/methode",
        infoLink2Enabled: true,
        infoLink2Label: "Selbststarter",
        infoLink2Url: "https://example.test/selbststarter",
        infoLink3Enabled: true,
        infoLink3Label: "Elterncheck",
        infoLink3Url: customCheckUrl,
        infoLink4Enabled: true,
        infoLink4Label: "Keto Guide",
        infoLink4Url: "https://example.test/keto-guide",
        internalNote: "",
      },
    });

    const runtimeCampaign = getCampaignById(DEFAULT_CAMPAIGN_ID);

    assert.equal(
      runtimeCampaign.offerContext?.infoLink3Url,
      customCheckUrl,
    );
    assert.equal(
      runtimeCampaign.offerContext?.priceInquiryText,
      "Test",
    );

    const checkReply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Elterncheck",
      runtimeCampaign,
    );

    assert.match(checkReply, /custom-elterncheck/);
    assert.doesNotMatch(checkReply, /check\.jochen-kammerer\.de/);

    const ketoReply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Keto Guide",
      runtimeCampaign,
    );

    assert.match(ketoReply, /example\.test\/keto-guide/);
    assert.doesNotMatch(ketoReply, /jochen-kammerer\.de\/keto-guide/);
  });

  await t.test("generic info request exposes the editable link labels", () => {
    const reply = getInfoLinkReply(DEFAULT_CAMPAIGN_ID);

    assert.match(reply, /Eltern Vital Methode/);
    assert.match(reply, /Selbststarter/);
    assert.match(reply, /Elterncheck/);
    assert.match(reply, /Keto Guide/);
  });

  await t.test("Elterncheck is not confused with a checkout URL in an earlier link", () => {
    saveCampaign({
      id: "fit",
      offerContext: {
        priceInquiryText: "Test",
        infoLink1Enabled: true,
        infoLink1Label: "Eltern Vital Methode",
        infoLink1Url: "https://example.test/checkout-499",
        infoLink2Enabled: true,
        infoLink2Label: "Selbststarter",
        infoLink2Url: "https://example.test/selbststarter",
        infoLink3Enabled: true,
        infoLink3Label: "Elterncheck",
        infoLink3Url: "https://example.test/custom-resource",
        infoLink4Enabled: true,
        infoLink4Label: "Keto Guide",
        infoLink4Url: "https://example.test/keto-guide",
        internalNote: "",
      },
    });
    const reply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Elterncheck",
      getCampaignById(DEFAULT_CAMPAIGN_ID),
    );
    assert.match(reply, /example\\.test\\/custom-resource/);
    assert.doesNotMatch(reply, /checkout-499/);
    assert.doesNotMatch(reply, /check\\.jochen-kammerer\\.de/);
  });

  await t.test("disabled dashboard resource does not fall back to a static link", () => {
    saveCampaign({
      id: "fit",
      offerContext: {
        priceInquiryText: "Test",
        infoLink1Enabled: true,
        infoLink1Label: "Eltern Vital Methode",
        infoLink1Url: "https://example.test/methode",
        infoLink2Enabled: true,
        infoLink2Label: "Selbststarter",
        infoLink2Url: "https://example.test/selbststarter",
        infoLink3Enabled: false,
        infoLink3Label: "Elterncheck",
        infoLink3Url: "https://example.test/disabled-elterncheck",
        infoLink4Enabled: true,
        infoLink4Label: "Keto Guide",
        infoLink4Url: "https://example.test/keto-guide",
        internalNote: "",
      },
    });

    const runtimeCampaign = getCampaignById(DEFAULT_CAMPAIGN_ID);
    const reply = buildPeteRuntimeInfoLinkReply(
      "Schick mir den Elterncheck",
      runtimeCampaign,
    );

    assert.doesNotMatch(reply, /disabled-elterncheck/);
    assert.doesNotMatch(reply, /check\.jochen-kammerer\.de/);
  });

  await t.test("dashboard checkout override is used by direct-buy runtime", () => {
    const customCheckout = "https://example.test/checkout-499";

    saveSchedulingConfig(DEFAULT_CAMPAIGN_ID, {
      defaultProvider: "manual",
      providers: {
        manual: {
          provider: "manual",
          platform: "manual",
          meetingType: "phone",
        },
      },
      texts: {
        starterCheckoutUrl: customCheckout,
      },
    });

    assert.equal(
      getCoachingEntryCheckoutUrl(DEFAULT_CAMPAIGN_ID),
      customCheckout,
    );
  });
});
