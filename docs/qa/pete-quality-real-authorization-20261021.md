# Pete real-model QA: one-time owner approval, 21 October 2026

This commit authorizes **only one** isolated synthetic QA run on GitHub Actions, with a **strict US$2 cumulative hard cap for this run**.

- All 20 lead conversations are fictional.
- Instagram and WhatsApp sends, webhook ingress, calendar, checkout and any production deployment stay disabled.
- The provider is the actual OpenAI Responses API, **gpt-4.1-mini**, not a canned reply generator or local mock.
- Every turn records its `replySource`: `llm` versus rule/safety routing.
- A durable reservation is pushed to `pete-phase3-budget-ledger` **before** any paid request, and a one-time marker makes reruns ineligible for renewed spending.
- The 2 USD cap does not grant any wider access or subscription.
- Results need independent qualitative review; a green workflow is **not** Pete's A− approval.
- This run follows successful offline CI: backend 441/441 tests, dashboard build/tests green.
