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
semantic_version: 0.0.0.2
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

## Addendum (2026-11-26): premium data sources

Perplexity's help center lists [premium data sources](https://www.perplexity.ai/help-center/en/articles/12870803-premium-data-sources) (last modified 2026-11-17): licensed content that isn't on the open web, answered with citations. **They belong to the Perplexity app, not the API.** That decides how we can use them.

### What there is

**Included sources** come with every Perplexity plan, with no partner account. Each plan gets a limited number of premium queries a month.

| Source | What it holds | Who in our tree wants it |
|---|---|---|
| PitchBook Essentials | Company profiles, funding history, key investors, leadership | Deal Scout (Resolve and Score), memopop, `crawl-fetch-ingest` |
| CB Insights | Market trends, market maps, company activity | Market-map and market-category templates, Deal Scout |
| Statista | Statistics, market data, forecasts | Market-sizing sections in memos and profiles |
| Wiley | Business, STEM, psychology and medical books and journals | Concept and vocabulary profiles |
| Midpage | 13.8M U.S. court opinions, statutes, regulations, with a citator | Standards-and-Specs, compliance explainers |

**Licensed connectors** link a subscription someone already holds (Pro, Max or Enterprise, plus the partner's license):

- **Private markets:** Crunchbase, Grata, D&B, Chronograph, AngelList, Papermark, Guidepoint expert transcripts, Octus.
- **Public markets:** FactSet, Morningstar, Daloopa, Quartr, IBISWorld, MT Newswires, SEC filings tools and others.
- **Crypto:** Coinbase and several onchain data sources.

Several need a separate entitlement on the partner's side. FactSet MCP access isn't included with FactSet Workstation, for example.

### How code can reach them

| Path | Reaches premium sources? | Auth and billing | Fits |
|---|---|---|---|
| Perplexity app (`@PitchBook …`) | Yes | A person's plan | Manual research |
| **Computer MCP server** (`https://www.perplexity.ai/rest/computer/mcp`) | **Yes.** Its connector list includes CB Insights, PitchBook, Statista and SEC EDGAR among 400+ services | OAuth as a Perplexity user, with no API key. Usage draws on that account's credits | Agent sessions in Claude Code or claude.ai; tasks take minutes |
| Agent API | No. Its managed connectors are GitHub, Slack, Google Drive, Datadog, Linear and Notion | API key | The nearest equivalents are `finance_search` (public markets only, $5 per 1,000 calls) and `people_search` |
| Agent API **custom connector** to a partner's own MCP server | Only for partners that publish one; the help page names FactSet's and Morningstar's MCP access | The partner's license, and our API key | Unattended pipelines, if a client holds the license |

So for now, premium data comes from a person in the app, or from an agent signed in as a person through Computer MCP. Perplexed, as an API client, can't reach it. The Agent API is the shape to watch: if premium sources ever become connectors there, they slot into everything above.

### How we could use them

1. **Deal Scout: Resolve and Score.** PitchBook Essentials gives funding history, investors and leadership for a company record. That's half the enrichment `crawl-fetch-ingest` does by crawling. CB Insights adds the market map a company sits in. It also answers the spec's open question about paying for Crunchbase or PitchBook: a firm can try both through Perplexity first. PitchBook Essentials is included, and Crunchbase connects a subscription the firm may already have.
2. **memopop: market and comps sections.** Market sizes come from Statista, with Quartr or Daloopa for public comparables when the firm has them. A firm's Guidepoint transcripts can ground a memo's "what experts say" section.
3. **Perplexed templates, run by an agent.** A Claude Code session with Computer MCP can run a market-category or market-map profile that cites Statista and CB Insights. Standards-and-Specs and legal explainers can cite statutes and regulations through Midpage. Perplexed's own run can't do this until the API can.
4. **VC back office.** AngelList, Chronograph and Papermark cover capital accounts, portfolio metrics and data rooms. That's adjacent to Twenty CRM and DidiDecks for a firm that uses them.

### Cautions

- **Licensed data isn't ours to publish.** Licensed connectors run "under your existing agreement with that partner", and included sources carry their publishers' terms. That's fine for a partner's private memo or deal brief. It's a problem for Lasso, whose output is public marketing. Lasso's quality bar also requires "a captured source a human can open", and a PitchBook or Statista citation sits behind a paywall. Treat premium-sourced claims as private by default, and mark them on the saved source (for example, `license: restricted`).
- **Quotas.** Included sources have a monthly premium query limit per plan, and licensed connectors spend the partner account's quota. A batch run over a folder could use up a month's allowance.
- **A person's account.** Computer MCP acts as the signed-in user and spends that person's credits. An unattended agent on that path is running on someone's seat, so decide whose before wiring it into the Deal Scout's clock.
- **"Essentials" is a subset.** PitchBook Essentials is basic firmographics, funding history, key investors and leadership, not the full PitchBook dataset.

### Next steps

1. Connect the Computer MCP server to Claude Code (OAuth, in the next session) and run one Deal Scout Resolve by hand. Pick a company the firm already tracks and compare PitchBook Essentials against what `crawl-fetch-ingest` found.
2. Run one market-category profile through Computer with Statista and CB Insights, and compare its citations with a plain Perplexed run.
3. Add `license:` to the saved-source fields in the Lasso and Deal Scout specs.
