---
title: "What Perplexity's 2026 API Could Add to Perplexed"
lede: "Perplexity retired the Sonar endpoint Perplexed is built on and shipped five new APIs. Here is what we could integrate, ranked by payoff."
date_created: 2026-11-26
date_modified: 2026-11-26
date_authored_initial_draft: 2026-11-26
date_authored_current_draft: 2026-11-26
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
semantic_version: 0.0.0.1
site_uuid: 691c6bbb-41ef-413f-bb63-208ea6dbefdb
hex_code: y034ve
publish: true
status: Open
tags:
  - Exploration
  - Perplexed
  - Perplexity-API
  - Agent-API
  - Citations
related:
  - "[[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]]"
  - "[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]]"
---

# What Perplexity's 2026 API Could Add to Perplexed

Read on 2026-11-26 from the [Perplexity changelog](https://docs.perplexity.ai/docs/resources/changelog) (every entry, February 2025 through November 2026), the [Sonar migration overview](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) and [field-by-field guide](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to), the [Agent API web_search tool](https://docs.perplexity.ai/docs/agent-api/tools/web-search), and [background mode](https://docs.perplexity.ai/docs/agent-api/background-mode). Prices and dates are as those pages state them.

## Why Care?

Perplexed's research commands, including Apply directory template, call `POST /chat/completions` with Sonar models. **Perplexity ended support for Sonar Chat Completions on September 27, 2026.** Sync and streaming requests still work only because Perplexity rewrites them into Agent API requests behind the scenes, "rolling out gradually by model". So what Perplexed gets back is already changing without our code changing. Async Sonar requests are no longer supported at all.

Moving to the Agent API is the foundation. Most of the ideas below depend on it.

## Where Perplexed stands

| Already uses | Where |
|---|---|
| `/chat/completions` + Sonar models | article, enhancement, directory templates, `src/settings/PerplexedSettings.ts` |
| `search_domain_filter`, `search_recency_filter`, `return_images`, `return_related_questions`, `search_context_size` | Sonar payloads |
| `/v1/agent` | image search only (`src/services/imageSearchService.ts`, 0.6.0) |

## Ranked opportunities

### 1. Migrate research calls to the Agent API (foundation)

How Perplexity maps the old models onto effort levels:

| Sonar model | Agent API effort |
|---|---|
| sonar, sonar-pro | `fast` |
| sonar-reasoning-pro | `low` |
| sonar-deep-research | `high` (`xhigh` for the best deep research) |

What the move buys us:

- **Background mode** (`background: true`, poll `GET /v1/agent/{id}`, cancel with `POST /v1/agent/{id}/cancel`, resume a dropped stream with `?stream=true&starting_after=N`). This is the structural fix for [[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]] and the idle-timeout logic in `directoryTemplateService`.
- **Any frontier model** behind the same search tools. We could run a template on Claude Opus 5.5 with Perplexity search instead of choosing between Perplexed's Claude path and its Perplexity path.
- **Structured outputs** for frontmatter fields.

Migration gotchas:

- `return_related_questions` has no equivalent. Ask for follow-up questions in the prompt or a structured-output schema.
- `return_images` becomes the `image_search` tool, which we already use.
- `search_context_size` becomes explicit token budgets (`max_tokens`, `max_tokens_per_page`) on `web_search`.
- **Citation markers change shape.** `fast` cites `[1]`. `low`, `medium` and `high` cite `[web:1]`. Inline citations also depend on the prompt. The docs say to treat each `search_results` entry's `id` and `url` as the source of truth. The footer builders and cite-wide's parsing need to handle `[web:N]`, or the prompt has to require `[N]`.
- The model dropdowns can read `GET /v1/models` (no auth) instead of a hardcoded list.

### 2. Date filters for the "sources look too recent" problem

`web_search` accepts `search_after_date_filter` / `search_before_date_filter` (publication date, `MM/DD/YYYY`) and `last_updated_after_filter` / `last_updated_before_filter`. A template could declare a date window in its cft block (for example, `search_before_date_filter` a year back for backgrounders). This fixes recency at retrieval time; the citation-date display setting only fixes how it looks.

Results return both `date` (published) and `last_updated` as `YYYY-MM-DD`. That confirms "Published only" is the honest default for citation lines.

### 3. Context API: read known URLs

`POST /v1/context`, $1.00 per 1,000 fetched URLs (failures free). It returns Markdown, links, query-relevant `highlights`, and metadata for URLs we already have. Up to five yes/no `criteria` get a 0–1 score per page.

- **Standards-and-Specs:** fetch the spec page itself and feed it to the template, so the profile is grounded in the primary source rather than in what search turns up about it.
- **Citation checking:** after a run, fetch each cited URL with a criterion such as "Does this page support: <claim>?" and flag weak citations before publishing.
- **Time Machine:** `snapshot_as_of` (up to 365 days back) returns the saved copy of a page from a past date, which helps with dead or changed citation links.

### 4. Monitor API: keep reference notes fresh

`POST /v1/monitors`. A Page monitor tracks text changes at 1–10 known URLs ($0.001 per fetched URL per run); a Search monitor reruns a query on a schedule. A Standards-and-Specs note could own a monitor on its spec URL and get an "Updates" section when the spec changes. It needs somewhere to receive results: poll on plugin load, since webhooks need a server.

### 5. Decisions API: cheap relevance scoring

`POST /v1/decisions`, $0.02 per million input tokens, free output. Yes/no and choice answers come back as probabilities. It could replace prompt-based "is this source on-topic" checks in the include-sources stage. **Decider for Mac** serves the same API locally at `127.0.0.1:8080` with no key and no bill, which fits a local-first Obsidian plugin.

### 6. Batch API for folder runs

Up to 50,000 Agent API requests in one JSONL file, completed within 24 hours, with no separate price and no request rate limit. Good for applying a template to a large folder overnight; the plugin would submit, save the batch ID, and collect results on a later launch. Not available to zero-data-retention orgs, and inputs and outputs are kept 30 days.

### 7. Smaller fits

- **Native document input:** PDF, DOCX and TXT as `input_file`. "Research this PDF in my vault."
- **`finance_search` and `people_search` tools:** structured data for company and person profiles, overlapping with Fireround.
- **Embeddings** (`pplx-embed-v2-context-*`, $0.02–$0.12 per million tokens): semantic matching for the link-back service instead of title matching.

## Suggested order

1. Agent API migration with background mode and citation-marker handling (item 1).
2. Template-level date filters (item 2), alongside the citation-date setting.
3. Context API grounding for Standards-and-Specs (item 3).
4. The rest as features earn their place.
