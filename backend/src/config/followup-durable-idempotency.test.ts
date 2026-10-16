import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Entirely offline: test filesystem reservations, never Meta or GPT transport.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-followup-claims-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { beginAutomatedFollowUpClaim, finalizeAutomatedFollowUpClaim } =
  await import("../services/automated-followup-claims.service.js");

test("Durable follow-up stage idempotency, fail closed on restarts/uncertainty", async t => {
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const identity = { campaignId: "eltern-vital-fit", leadId: "synthetic:parent-001" };

  await t.test("a pending stage blocks a duplicate and all other simultaneous stages", () => {
    const first = beginAutomatedFollowUpClaim({ ...identity, stage: "ghosting:1:24h" });
    assert.equal(first.allowed, true);
    if (!first.allowed) return;
    const duplicate = beginAutomatedFollowUpClaim({ ...identity, stage: "ghosting:1:24h" });
    assert.deepEqual(duplicate, { allowed: false, reason: "followup_conversation_locked" });
    const booking = beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder24h" });
    assert.deepEqual(booking, { allowed: false, reason: "followup_conversation_locked" });
    finalizeAutomatedFollowUpClaim(first.claim, "sent");
  });

  await t.test("a confirmed send cannot repeat its stage even after lock release", () => {
    assert.deepEqual(
      beginAutomatedFollowUpClaim({ ...identity, stage: "ghosting:1:24h" }),
      { allowed: false, reason: "followup_claim_exists" },
    );
    const nextStage = beginAutomatedFollowUpClaim({ ...identity, stage: "ghosting:1:3d" });
    assert.equal(nextStage.allowed, true);
    if (nextStage.allowed) finalizeAutomatedFollowUpClaim(nextStage.claim, "not_sent");
  });

  await t.test("dry-run clears only its own claim, allowing a later real send", () => {
    const first = beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder24h" });
    assert.equal(first.allowed, true);
    if (!first.allowed) return;
    finalizeAutomatedFollowUpClaim(first.claim, "not_sent");
    const again = beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder24h" });
    assert.equal(again.allowed, true);
    if (again.allowed) finalizeAutomatedFollowUpClaim(again.claim, "sent");
    assert.deepEqual(
      beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder24h" }),
      { allowed: false, reason: "followup_claim_exists" },
    );
  });

  await t.test("unknown provider result retains a durable conversation-wide block", () => {
    const attempt = beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder3d" });
    assert.equal(attempt.allowed, true);
    if (!attempt.allowed) return;
    finalizeAutomatedFollowUpClaim(attempt.claim, "uncertain");
    assert.ok(fs.existsSync(attempt.claim.lockPath));
    assert.ok(fs.existsSync(attempt.claim.markerPath));
    assert.deepEqual(
      beginAutomatedFollowUpClaim({ ...identity, stage: "booking:reminder3d" }),
      { allowed: false, reason: "followup_conversation_locked" },
    );
    assert.deepEqual(
      beginAutomatedFollowUpClaim({ ...identity, stage: "ghosting:2:24h" }),
      { allowed: false, reason: "followup_conversation_locked" },
    );
  });

  await t.test("different synthetic parent is unaffected by one blocked conversation", () => {
    const other = beginAutomatedFollowUpClaim({
      campaignId: identity.campaignId, leadId: "synthetic:parent-002",
      stage: "ghosting:1:24h",
    });
    assert.equal(other.allowed, true);
    if (other.allowed) finalizeAutomatedFollowUpClaim(other.claim, "not_sent");
  });
});
