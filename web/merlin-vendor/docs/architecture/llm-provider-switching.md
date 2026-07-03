# LLM provider switching

**Status:** proposed — not yet implemented as of 2026-05-11. Drafted from the chat conversation with JB on the same date.
**Track:** infra / pluggable AI
**Author:** JB + Claude, 2026-05-11

> Merlin runs end-to-end on Anthropic today (`@anthropic-ai/sdk`, `claude-sonnet-4-6` for thoughtful chat, `claude-haiku-4-5` for fast chat + agents + translation). This doc captures the plan for swapping in OpenAI as an alternative engine — and, more importantly, for letting Adaptiv flip between the two per-surface from the platform back-office without a code deploy.

## Why this exists

Two real reasons to want pluggability, on different timescales:

1. **Cost / quality measurement.** Anthropic's system-prompt caching (90% discount on cached input) makes Merlin's heavy system prompts cheap when traffic is warm. OpenAI's automatic prompt caching is shallower and less consistent. Anthropic Haiku and GPT-4o-mini look similar on the surface, but the cost shape is very different at our workload. The only honest way to know which is cheaper for Merlin is to run them side-by-side on the same surface and measure.
2. **Sales positioning.** "Powered by ChatGPT" carries brand recognition the average FM customer feels even when "Powered by Claude" doesn't. Being able to flip the engine per tenant (or per surface) for a sales motion has commercial value, separate from the engineering case.

Either reason alone is enough to want the abstraction. Both together make it worth doing right rather than as a one-shot swap.

---

## What calls Anthropic today

Four call sites, four different surfaces, all routed through `@anthropic-ai/sdk`. None share a wrapper; each builds its own `messages.create()` call.

| File                         | Surface                                                             | Model alias                                   | Notes                                                                                         |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `api/chat.js`                | Merlin chat (the floating panel + side rail)                        | `fast` = haiku-4-5, `thoughtful` = sonnet-4-6 | Router picks fast vs thoughtful per turn. Tools are passed inline. Streams responses via SSE. |
| `api/translate.js`           | On-read i18n translation cache (`text_translations` table)          | `translator` = haiku-4-5                      | Single-shot, no streaming, no tools.                                                          |
| `api/agents/_shared.js`      | Per-agent tick handlers (`api/agents/cleaning.js`, `hvac.js`, etc.) | `agent` = haiku-4-5                           | Structured-output JSON per agent, no streaming. The 7 active agents call this.                |
| `api/_lib/claude-pricing.js` | Cost tracking table for `claude_usage_events` rollup                | n/a (lookup table)                            | Maps model id → $/M input + $/M output for the platform Costs page.                           |

Plus indirect references in:

- `src/app/Chat.jsx` — copy referencing model names ("Live · Sonnet 4.6 vs Demo mode") — JB has already asked for model names to stay hidden from end users (PR #191), so this is a one-line cleanup.
- `supabase/migrations/*` — the `claude_usage_events` table name + columns (`cost_usd`, `tokens_in`, `tokens_out`, `model`). Schema is generic but the name carries the Anthropic brand.

## Where the divergence actually lives

Things that **look** different but are easy to normalize:

- **System prompt placement** — Anthropic accepts `system` as a top-level field; OpenAI requires it as the first message with `role: 'system'`.
- **Streaming chunk shape** — Anthropic emits `content_block_delta` events; OpenAI emits `chunk.choices[0].delta.content`.
- **Token usage shape** — different field names (`usage.input_tokens` vs `usage.prompt_tokens`).
- **Pricing tables** — different unit rates, but the same input/output structure.

Things that take real care:

- **Tool use** — Anthropic uses `tool_use` content blocks with named tools and JSON schema. OpenAI uses `function_call` / `tool_calls` on the message itself. Schemas are structurally similar (JSON Schema) but the _shape of the response_ the model returns is different, and the way you reply to it (`tool_result` content block vs `role: 'tool'` message) is different. Merlin chat passes ~6 tools today; each will need a normalized adapter on both sides.
- **Prompt caching** — Anthropic uses explicit cache breakpoints (`cache_control: { type: 'ephemeral' }`) within the system prompt and tools. OpenAI's automatic prompt caching just kicks in on long stable prefixes; you don't mark them. The abstraction can model both as "this section is stable" and let each provider apply its own caching semantics.
- **Reasoning / thinking** — Anthropic has explicit extended thinking. OpenAI's `o1`/`o3` reasoning models have their own pattern. If Merlin's "thoughtful" route grows to use thinking, the abstraction needs to expose it cleanly.

---

## Plan

### Phase 1 — Provider abstraction (no behavior change, ~2 days)

New module `api/_lib/llm.js` exposes a single async function:

```js
complete({
  system,           // string — system prompt
  messages,         // [{ role: 'user' | 'assistant', content: ... }]
  modelAlias,       // 'fast' | 'thoughtful' | 'agent' | 'translator'
  maxTokens,        // number
  tools,            // optional — array of { name, description, input_schema }
  stream,           // boolean
}) → { content, toolCalls, usage, providerRaw }
```

Internal model aliases (`fast`, `thoughtful`, `agent`, `translator`) map per provider. `AnthropicProvider` ships first with today's call shapes.

Swap the four call sites — `api/chat.js`, `api/translate.js`, `api/agents/_shared.js`, plus any narrate / recommendation paths that show up during the swap — to use `complete()` instead of `anthropic.messages.create(...)`.

**Hard guarantee:** nothing user-visible changes. Pure refactor. Regression-test each surface (chat with tools, translate, an agent tick) before merging.

### Phase 2 — OpenAI provider behind a flag (~2 days)

Add `openai` to `package.json`. Implement `OpenAIProvider` with the same `complete()` shape. Map aliases:

- `fast` → `gpt-4o-mini`
- `thoughtful` → `gpt-4o`
- `agent` → `gpt-4o-mini`
- `translator` → `gpt-4o-mini`

Inside the provider, normalize the four divergences:

| Divergence    | Anthropic                              | OpenAI                                      | Abstraction                                                    |
| ------------- | -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| System prompt | top-level `system` field               | first message `{ role: 'system' }`          | Layer takes `system` as a string; provider places it correctly |
| Tools         | `tool_use` content blocks              | `tool_calls` on the assistant message       | Layer normalizes both into `toolCalls: [{ name, input }]`      |
| Streaming     | `content_block_delta` events           | `choices[0].delta.content` chunks           | Layer emits unified `onChunk({ type: 'text', delta })`         |
| Token usage   | `usage.input_tokens` / `output_tokens` | `usage.prompt_tokens` / `completion_tokens` | Layer normalizes into `usage.inputTokens` / `outputTokens`     |

Add `LLM_PROVIDER` env var (`anthropic` | `openai`) to pick the implementation at server boot. Default `anthropic` so existing deploys are unchanged. Test each surface manually with the env var flipped.

### Phase 3 — UI toggle, per-surface (~1 day)

Adaptiv's switch lives in `platform_settings` (same table as the ads kill switch and `platform_settings.feature_flags`). New row:

```json
{ "key": "llm_provider", "value": { "chat": "anthropic", "translate": "anthropic", "agents": "anthropic" } }
```

`/platform/experimental` gets three toggles — one per surface — so combos like "chat on OpenAI, agents on Claude" are reachable. Server reads `platform_settings.llm_provider` on each request and routes accordingly. **Switch takes effect on the next request — no deploy needed.**

Cost tracking gets a `provider` column on `claude_usage_events` (and a rename to `llm_usage_events` while we're there). The platform Costs page splits the chart by provider so the A/B comparison shows up natively. Cost-by-provider becomes a primary metric on that page.

### Phase 4 — Observability (~2 days, optional)

Once Phases 1–3 are live and Adaptiv has flipped at least one surface to OpenAI for a day:

- Per-provider Sentry tags so error rates are comparable.
- Cost-by-provider chart on the Costs page (already added in Phase 3).
- 50/50 A/B routing for chat with side-by-side latency / cost log.
- Decision: keep on the new provider, revert, or split per surface long-term.

---

## Key tradeoff to know going in

**Anthropic's prompt-caching discount on Merlin's heavy system prompts is a real cost moat.** Merlin's chat surface in particular runs ~6k tokens of system prompt + tool definitions + building context + agent state on every turn. With Anthropic prompt caching that ~6k is billed at the 10% rate on warm requests, which is most of them. OpenAI's automatic caching is shallower; the same workload on `gpt-4o-mini` costs less per raw token but more per request once the system prompt is in the mix.

The flip side: GPT-4o-mini is meaningfully cheaper at the input rate (~$0.15/M vs Haiku ~$1/M), so on cold prompts or short turns OpenAI wins on cost outright. And `gpt-4o` is genuinely competitive with `sonnet-4-6` on reasoning quality for the kinds of tasks Merlin chat does (summarization, structured extraction, intent classification).

So: the right answer is almost certainly **per-surface mixing**, not a global swap. The agents (short prompts, structured output) probably favor OpenAI on cost. The chat panel (long stable system prompt, lots of tool use) probably favors Anthropic on cost. Phase 3's per-surface toggle is what lets us measure rather than guess.

---

## What this doc deliberately doesn't cover

- **OpenAI Assistants API vs Chat Completions API.** The plan above uses Chat Completions (standard `chat.completions.create`). Switching to Assistants would change the interaction model substantially and isn't in scope.
- **Self-hosted / open-weight models** (Llama 3, Qwen, etc.). Same provider-abstraction shape would work but the operational story is very different.
- **Multimodal inputs.** Merlin chat is text-only today. If we add image inputs (e.g. an FM photographing a broken fixture), the abstraction will need to grow.
- **Per-tenant routing.** The plan routes per _surface_, not per _tenant_. Per-tenant would let "Sell to Acme with OpenAI badging" work but adds complexity to the cost-tracking + audit paths. Defer until there's a sales conversation that needs it.

---

## When to revisit this doc

- Before starting Phase 1 — confirm the call-site map (`api/chat.js`, `api/translate.js`, `api/agents/_shared.js`, `api/_lib/claude-pricing.js`) hasn't grown.
- After Phase 2 ships — capture the actual divergences hit during the OpenAI implementation. The "easy to normalize" / "real care" table above is the prediction; the post-Phase-2 reality is the source of truth.
- After the first A/B comparison — record the cost + latency + quality deltas per surface and recommend a default split.
