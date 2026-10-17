import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase4b-provider-preview-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { previewProviderCampaignEntry } =
  await import("../services/pete-provider-entry-preview.service.js");

const campaigns = [
  { id: "dm", peteCampaign: {
    sources: ["instagram_dm"], keywords: ["CHECK"],
    openingText: "Zum Check", followUpEnabled: false,
  }},
  { id: "story", peteCampaign: {
    sources: ["instagram_story_reply"], keywords: ["CHECK"],
    openingText: "Story-Antwort", followUpEnabled: false,
  }},
  { id: "comment", peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["CHECK"],
    openingText: "Reel-Kommentar", followUpEnabled: false,
  }},
  { id: "whatsapp-normal", peteCampaign: {
    sources: ["whatsapp_dm"], keywords: ["START"],
    openingText: "Willkommen", followUpEnabled: false,
  }},
  { id: "ctwa", peteCampaign: {
    sources: ["whatsapp_ctwa"], keywords: ["START"],
    openingText: "Aus Anzeige", followUpEnabled: false,
  }},
];

const igEvent = (message: Record<string, unknown>) => ({
  object: "instagram",
  entry: [{ messaging: [{
    sender: { id: "synthetic-sender" },
    recipient: { id: "synthetic-account" },
    message: { mid: "synthetic-mid", text: "CHECK", ...message },
  }] }],
});

const waEvent = (message: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{
    field: "messages", value: {
      messages: [{
        id: "synthetic-wa-mid", from: "synthetic-contact",
        type: "text", text: { body: "START" }, ...message,
      }],
    },
  }] }],
});

test("Phase 4B: provider entry metadata is evidence, never send authority", async t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await t.test("Instagram messages classify only as DM channel, never claim Story", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: igEvent({}),
    });
    assert.equal(result.reason, "instagram_dm_channel_only");
    assert.equal(result.source, "instagram_dm");
    assert.equal(result.entryPreview?.matchedCampaignId, "dm");
    assert.equal(result.sendAllowed, false);
    assert.equal(result.entryPreview?.sendAllowed, false);
  });

  await t.test("Instagram echoes do not become a new lead", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: igEvent({ is_echo: true }),
    });
    assert.equal(result.reason, "ignored_echo");
    assert.equal(result.source, null);
    assert.equal(result.entryPreview, null);
  });

  await t.test("Instagram shares cannot claim a Reel keyword or Story attribution", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: igEvent({ attachments: [{ type: "share" }] }),
    });
    assert.equal(result.reason, "unsupported_media");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("Instagram comments change needs separate provider validation", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: {
        object: "instagram", entry: [{
          changes: [{ field: "comments", value: { text: "CHECK" } }],
        }],
      },
    });
    assert.equal(result.reason, "unverified_story_or_reel");
    assert.equal(result.source, null);
    assert.equal(result.entryPreview, null);
  });

  await t.test("multiple Instagram messages cannot start two campaigns", () => {
    const envelope = igEvent({});
    envelope.entry[0].messaging.push({
      sender: { id: "another-sender" },
      recipient: { id: "synthetic-account" },
      message: { mid: "other-mid", text: "CHECK" },
    });
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: envelope,
    });
    assert.equal(result.reason, "ambiguous_event");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("Instagram duplicate raw events do not bypass parser dedupe", () => {
    const envelope = igEvent({});
    envelope.entry[0].messaging.push({
      sender: { id: "synthetic-sender" },
      recipient: { id: "synthetic-account" },
      message: { mid: "synthetic-mid", text: "CHECK" },
    });
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "instagram", payload: envelope,
    });
    assert.equal(result.reason, "ambiguous_event");
    assert.equal(result.sendAllowed, false);
    assert.equal(result.entryPreview, null);
  });

  await t.test("WhatsApp ordinary text is not confused with a Meta ad", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "whatsapp", payload: waEvent({}),
    });
    assert.equal(result.source, "whatsapp_dm");
    assert.equal(result.reason, "whatsapp_text");
    assert.equal(result.entryPreview?.matchedCampaignId, "whatsapp-normal");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("WhatsApp verified referral supports CTWA preview", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "whatsapp", payload: waEvent({
        referral: { source_type: "ad", ad_id: "synthetic-ad" },
      }),
    });
    assert.equal(result.source, "whatsapp_ctwa");
    assert.equal(result.reason, "whatsapp_ad_referral");
    assert.equal(result.entryPreview?.matchedCampaignId, "ctwa");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("WhatsApp unknown referral labels are not proof of ad attribution", () => {
    const result = previewProviderCampaignEntry(campaigns, {
      provider: "whatsapp", payload: waEvent({
        referral: { source_type: "unknown", source_url: "https://example.org" },
      }),
    });
    assert.equal(result.source, "whatsapp_dm");
    assert.equal(result.entryPreview?.matchedCampaignId, "whatsapp-normal");
  });

  await t.test("WhatsApp statuses and multiple messages do not qualify as an entry", () => {
    const onlyStatus = { object: "whatsapp_business_account", entry: [{
      changes: [{ field: "messages", value: { statuses: [{ id: "m", status: "sent" }] } }],
    }] };
    assert.equal(previewProviderCampaignEntry(campaigns, {
      provider: "whatsapp", payload: onlyStatus,
    }).reason, "unsupported_event");

    const two = waEvent({});
    const entry = two.entry[0].changes[0].value.messages;
    entry.push({ id: "another", from: "other", type: "text",
      text: { body: "START" } });
    assert.equal(previewProviderCampaignEntry(campaigns, {
      provider: "whatsapp", payload: two,
    }).reason, "ambiguous_event");
  });

  await t.test("malformed platform and provider data fail closed", () => {
    const examples = [
      { provider: "telegram", payload: igEvent({}) },
      { provider: "instagram", payload: {} },
      { provider: "whatsapp", payload: igEvent({}) },
      { provider: "instagram", payload: null },
    ];
    for (const input of examples) {
      const result = previewProviderCampaignEntry(campaigns, input);
      assert.equal(result.sendAllowed, false);
      assert.equal(result.source, null);
      assert.equal(result.entryPreview, null);
    }
  });

  await t.test("admin preview route does not use the messaging or send services", () => {
    const source = fs.readFileSync(
      new URL("../routes/campaigns.ts", import.meta.url), "utf8");
    assert.match(source, /preview-provider-entry/);
    assert.match(source, /previewProviderCampaignEntry/);
    assert.doesNotMatch(source, /sendMetaInstagramTextMessage|sendMetaWhatsappTextMessage/);
    assert.doesNotMatch(source, /processIncomingMessage\(/);
  });
});
