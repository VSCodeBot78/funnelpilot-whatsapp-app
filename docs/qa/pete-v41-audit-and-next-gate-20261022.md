# Pete Policy v4.1: QA audit, 2026-10-22

## Safe delivery status
- Development branch `feat/pete-policy-v4-20261022` only. No merge, production deploy, laptop sync, Instagram send or WhatsApp send.
- Product model choice GPT-6.1 Sol; previous GPT-4.1 mini remains only in isolated historical test fixtures.
- STOP, live human ownership, verified transactions and emergency responses are deterministic.
- No subscription or automatic API recharge.

## Actual model evidence (synthetic conversations, not real customer results)
- Real corrected Policy v4.1: GitHub Actions run 39763778706, 20 previously known/tuned cases, 38 genuine Sol answers + 2 verified rule replies, 4 extra safety cases, $0.586530 internal metered usage. GitHub success means technical completion, not guaranteed sales quality.
- Fresh 12-case holdout: run 39765140336, 17 genuine Sol answers + 7 rule/suppressed replies, 4 extra safety cases, $0.295224. Initial human qualitative assessment: **10/12 good, 2 failed**.
- N03 failed (exact weekly video-call count): the model triggered a human handoff when the correct response was to acknowledge unavailable verified terms.
- N07 failed (independent no-call starter checkout): the model triggered a human handoff despite the previously verified product URL.
- Other holdout cases included shift eating, zero money, skeptical parent, stop/question-boundary, sick-child interruption, family purchase autonomy, nonfit triathlon coaching, and chest-pressure/breathlessness emergency (immediate 112 with subsequent messages suppressed).

## Fixes AFTER the fresh holdout, tested OFFLINE
- `backend/src/core/pete-conversation-quality.ts`: exact unverified video-call count question gets a bounded deterministic response, without made-up numbers or chat ownership change.
- Same file: after a verified selfstarter link was delivered, a question about checkout without a mandatory call returns the verified independent purchase path without model escalation.
- `backend/src/config/pete-policy-v41-hardening.test.ts`: replay N03 and N07 with mocked provider (assert 0 model calls, `verified_transaction`, AI ownership persists, no fictitious terms). Also tests normal method/trust and critical emergency gates.
- Full free offline/backend/dashboard Actions run 39765861733: all jobs successful.

## Quality verdict
- The two new deterministic responses fix the **observed failure modes in offline replays**. This does **NOT** retroactively make the already-completed real 12-case holdout a successful 12/12 test. It remains **10/12 as originally observed**.
- At least 18/20 good conversations, zero critical failures on an unseen post-fix benchmark, and owner Darth-Vader laptop acceptance are **not yet independently demonstrated**.
- Avoid any live rollout until local desktop branch/state have been intentionally synchronized and the owner has completed acceptance. No paid rerun without separately approved budget.

## Global budget
- Cumulative cap $8.000000, spent $7.817830, reserved $0, remaining $0.182170. Shared ledger branch: `pete-phase3-budget-ledger`.
- Do not reset this ledger or spend another $0.45: the one-time blind-holdout key already settled.

## Next operator checklist
1. Review the changes, merge only after separate review; keep production/live sends disabled.
2. On owner's laptop, update the source only through an explicitly chosen non-live desktop workflow; verify `OPENAI_MODEL=gpt-6.1-sol` and independently reconcile local persistent spent budget.
3. Run the owner Darth-Vader test inside the **desktop Pete-Labor**. Do not require the postponed mobile TTD surface.
4. Qualitatively grade against a 20-case blind rubric. If any critical failures or below 18/20, no live launch. Revisit scope and approval before more API spend.
