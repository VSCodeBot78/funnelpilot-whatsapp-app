# Pete stronger model candidate: GPT-6.1 Sol (2026-10-22)

## Status and boundaries
- Clean opt-in code support. Default `gpt-4.1-mini` is unchanged until the owner explicitly configures a local test.
- No live Instagram/WhatsApp sends, no production deploy, no subscription and no automatic recharge authorized.
- Desktop Pete-Labor requires separate local environment configuration and reconciliation of existing cumulative budgets.
- Do not merge or deploy based solely on a passing GitHub build.

## Confirmed synthetic smoke evidence
- Source QA branch: `pete-sol-model-smoke-20261022`, run 39725876384.
- Model: `gpt-6.1-sol`; eight unchanged hard cases; fourteen language-model replies, one verified transaction reply, one LLM handoff; four additional deterministic safety scenarios.
- Real internally metered spend: USD 0.228132 (15 metered API requests).
- Shared lifetime QA ledger after run: USD 5.456278 spent of USD 8.000000, USD 2.543722 remaining; local budget ledger is distinct and MUST be reconciled before another paid test.
- Improvements observed: exhausted parent receives permission to rest rather than another forced workout; repeat purchase question correctly refers to the already verified product URL; bodybuilder without target fit receives clear, respectful non-fit response.
- Still deficient: Schichtarbeit case mirrors the problem rather than delivering a concrete tactic; coaching skepticism triggers an unnecessary handoff; value proposition still too generic.
- These findings do NOT constitute 18/20 acceptance and do not authorize live sends.

## How the model is selected
Pete currently reads `OPENAI_MODEL` on backend startup. After checking API access and synchronizing the local budget record with the shared ledger, a *separately approved* desktop smoke environment may use:

```dotenv
OPENAI_MODEL=gpt-6.1-sol
INSTAGRAM_ENGINE_ENABLED=false
INSTAGRAM_SEND_ENABLED=false
WHATSAPP_SEND_ENABLED=false
ENABLE_GENERIC_WEBHOOKS=false
```

- Do not add `PETE_LLM_API_CALLS_APPROVED=true` or change owner persisted `aiEnabled` as part of passive configuration; those gates require explicit opt-in.
- This code adds official standard-tier cost weights (USD 2 input / USD 10 output per 1M tokens), low reasoning, up to 1,200 total output tokens, and 30-second provider timeout for the Sol model. Extra service tiers / regional surcharges require separately reviewed cost handling.
- Leave older `gpt-4.1-mini` as rollback until quality gates pass.
- Never assume the ChatGPT app's model menu changes Pete's API model.

## Next engineering steps
1. Inspect and hash actual runtime instructions, context and conversation facts without logging private leads or API credentials.
2. Implement explicit choice of direct answer, concrete help, qualification or offer; keep STOP, safety and human owner deterministic.
3. Evaluate 20 known scenarios + independent holdout. Required: at least 18/20 good cases, zero critical safety errors.
4. Only then consider explicit desktop roll-in and eventually production deployment.
