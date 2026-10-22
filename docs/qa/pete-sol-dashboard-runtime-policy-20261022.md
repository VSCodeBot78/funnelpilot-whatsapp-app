# Pete / Funnel Pilot: Sol-only product selection and safe runtime alignment
Date: 2026-10-22

## Implemented (draft, not deployed)
- GPT-6.1 Sol is the only Pete product model in the Dashboard settings selector. GPT-4.1 mini is not a product option.
- `settings.aiModel` is now the effective model for normal Pete model calls and the legacy structured service. `OPENAI_MODEL` is no longer a production UI/runtime mismatch.
- Previously persisted Mini or unknown model values are normalized in memory to Sol during settings reads; they are rewritten to Sol on a later authorized save. No migration automatically activates AI or paid calls.
- POST /settings-config rejects unsupported product-model values with `unsupported_ai_model`; unknown model strings cannot be selected through the API.
- Shared budget status shows the effective model, and Sol uses separately pre-existing metered model pricing.
- The historical legacy AI funnel path is disabled by default. It needs distinct opt-in flags and a budget reservation before any paid call.
- Older Mini/GPT-5.4 model requests survive ONLY in NODE_ENV=test via explicit test environment variables for historical offline regression fixtures. Neither appears in the public Dashboard selector.
- Historical budget and QA data are not reset; original global USD 8 lifetime ceiling remains unchanged.
- No live Instagram or WhatsApp sending, no production deployment, no new subscription, no automatic recharge.
- Not a functional/qualitative 18/20 acceptance result.

## Verification
- Offline-only GitHub Actions run: https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39728487966
- Both jobs succeeded: Backend build + full mocked test suite, Dashboard tests + Vite builds. No real provider calls were enabled.
- Sol real-model precursor smoke: https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39725876384 ; eight known difficult dialogs, 14 LLM responses, USD 0.228132; objective quality shortcomings remain.
- Last reconciled shared global ledger on that smoke: USD 5.456278 used of USD 8; USD 2.543722 remained.

## Next separate stages (do not merge into model-switch experiment)
1. Read-only effective instruction and context audit: prove which priority rules and which conversation facts actually reach the provider, without logging lead contents or keys.
2. Small, reversible Policy v4 decision stage (direct answer vs concrete help vs clarify vs verified next step). Safety and opt-out remain deterministic.
3. Repeat the same eight hard holdout dialogs against Sol without changing the model, plus a new unknown holdout and calibrated human scoring. Do not label a green CI run as a sales-quality pass.
4. Roll back or iterate based on evidence. Minimum quality target is 18/20 with zero critical violations before owner Darth-Vader desktop test.
5. Owner-approved local Pete-Labor activation and later separate live rollout after all gates; no new mobile TTD requirement.

## How to turn on after explicitly authorized local release
Review and merge the model/dashboard changes; use the Desktop Pete-Labor, verify the AI switch and existing no-send flags remain off in transport; verify the persisted settings report `aiModel: "gpt-6.1-sol"`. No need to paste new API keys into Dashboard. Consent and spend caps remain separate.
