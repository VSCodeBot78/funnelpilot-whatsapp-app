# Pete Conversation Intelligence – Phase 1 (2026-10-10)

## Actual architecture (not a live AI quality claim)

The historical natural flow in core/natural-conversation.ts is deterministic. It did not understand the founder's six-message angry-parent test (#73). It remains the default for compatibility, not production proof.

New core/pete-llm-conversation.ts is a separate, opt-in LLM orchestration path. It gives an OpenAI Responses model up to the most recent 36 consecutive user/assistant messages, a constrained German persona, answer-first rules and response JSON schema. It explicitly avoids another fixed scripted Q&A loop.

conversation-engine.ts executes STOP, human ownership, and critical medical/legal/emotional safety before choosing the new path. Real price, guide, checkout and booking/link requests retain the deterministic source-of-truth route. Free-form LLM replies are blocked if they contain amounts, URLs, unsupported transaction confirmations or multiple questions; unhelpful emojis and typographic long dashes are removed. Invalid/unavailable replies and missing consent transfer ownership to a human rather than restarting the question flow.

Cost/privacy gate: PETE_LLM_CONVERSATION_ENABLED=true AND PETE_LLM_API_CALLS_APPROVED=true AND a configured OPENAI_API_KEY AND persisted aiEnabled=true are required for any paid OpenAI call. Default is disabled. An old API key alone cannot enable it. No one has authorized paid API requests yet. Do not set these in a live environment or forward real leads to the provider until separately approved. Synthetic tests mock fetch and never send outside the process. Requests use store:false but that alone is not a privacy-compliance approval.

No Meta activation: This phase does not change Instagram/WhatsApp send flags, allowlists, local laptop locks, security preflight, external DM Closer or ManyChat.

## Phase 1 limitation and handover to Phase 2

A correct synthetic fetch test proves the code calls the intended API shape with full context, not that actual LLM responses are high quality. The legacy flow has not been removed, and explicit trusted transactional routes can still return some scripted text. Review intent matching, ambiguous human-handover vs. booking, medical boundaries, fallback delivery semantics, retry budgets, privacy and debugging in Phase 2. Don't advertise production readiness.

Phase 2: audit security and transport boundaries, add more data-bound guardrails, detailed deterministic regression tests and trace visibility. Define explicit model-test budget approval and real provider test setup, without enabling real outbound.

Phase 3: at least 50 genuinely challenging multi-turn parent roleplays (prefer 8–15 lead turns each), including every failure from #73, after explicit limited API test spending approval. Independent parent/coach evaluation, retry any failed runs and no fake real AI results.

Phase 4: founder tests on laptop only after Phase 3 passes. No production sends until separate sign-off.

Issues: #73, #74.
