---
title: Market Map (Analyst Draft)
applies-to-paths:
  - "lost-in-public/market-maps/**"
  - "market-maps/**"
description: Generates an analyst-grade draft of a market map — either a Known Category (e.g., Humanoid Robots, Light-based Computing) or a Thesis-driven map (e.g., Neural Network Hardware as `Brains` for Robotics) that traverses known categories.
date_created: 2026-05-26
date_modified: 2026-05-26
---

# About this template

Use this for files under `lost-in-public/market-maps/` (or any top-level `market-maps/`) whose body is empty or whose curated lead-in (Topics, Lighthouse Examples) has been authored but the analytical body is missing.

A **market map** is the draft a well-paid analyst would hand to a partner: not an encyclopedia entry, not marketing copy. It explains who is doing what in a category, why now, who funded them, how segments differ, and what the open questions are. Two flavors are supported:

1. **Known Category** — Humanoid Robots, Light-based Computing, Quantum Computing. The taxonomy is roughly settled; the work is enumerating innovators within established sub-segments and explaining the current frontier.
2. **Thesis-Driven** — "Neural Network Hardware as `Brains` for Robotics." The thesis traverses multiple known categories under a hypothesis. The work is making the thesis legible, then enumerating innovators from each adjacent category that the thesis pulls in.

The heading skeleton works for both flavors. The model picks up the flavor from the file's `title`, `tags`, and any thesis paragraph the user has pre-authored above the body.

This template runs on `sonar-deep-research` and skips image embedding by design — deep research returns better citation density and analytical length but unreliable image metadata. Banner / portrait / square imagery for market maps is generated separately (Ideogram) and lives in frontmatter.

```cft
provider: perplexity
model: sonar-deep-research
return-citations: true
return-images: false
# 40-minute absolute wall-clock ceiling — the belt-and-suspenders cap.
# The primary safety is the per-chunk idle timer (270s for deep-research,
# inherited from the model-class default), which lets a slow-but-healthy
# stream complete naturally while killing a silently-stalled one fast.
# This ceiling is the "do not run longer than 40 min under any
# circumstances" cap on top of that. Market-map deep-research runs
# routinely produce 6-8K-word drafts with 20-40 named innovators across
# 4-8 sub-segments; a complete run is worth $10-$50 of analyst time, so
# the cap is generous. Set this key to 0 to disable the ceiling entirely
# and rely on idle-only safety.
request-timeout-ms: 2400000
# Generous output-token budget. Perplexity's default for sonar-deep-research
# (~8192 tokens, ~6K words) silently truncates market-map drafts mid-skeleton
# by ending the stream cleanly with finish_reason: length. Bumped to 24000
# (~18K-word budget) so a complete map can land with headroom for 20-40
# innovator cards across 4-8 sub-segments plus Market Dynamics, Frontier,
# and Adjacent Concepts.
max-tokens: 24000
system: |
  You are writing the analyst-grade draft of a MARKET MAP titled "{{basename}}".

  A market map is the draft a well-paid analyst hands to a partner. It is not
  an encyclopedia entry, not a marketing post, not a listicle. It explains:

  - WHO is doing what in this market — named companies, named founders, named
    research labs, with funding stage and primary URL.
  - HOW the market segments — what natural sub-buckets exist, and which
    innovators sit in which sub-bucket.
  - WHY NOW — what changed (technology unlock, regulatory shift, capital
    flow, customer behavior) that made this market legible.
  - WHAT IS DISPUTED — where credible operators disagree about category
    boundaries, winner archetypes, or thesis viability.

  Determine the FLAVOR of map from the title and frontmatter:

  - KNOWN CATEGORY (e.g., "Quantum Computing is Confusing", "Humanoid Robots",
    "Agentic AI in Fintech") — the category name is settled. Your job is to
    enumerate sub-segments and innovators within each, and explain the frontier.
  - THESIS-DRIVEN (e.g., "Neural Network Hardware as Brains for Robotics",
    "Blockchain and Web3 Institutional Invasions") — a hypothesis traverses
    known categories. Your job is to make the thesis legible, then enumerate
    innovators from each adjacent category the thesis pulls in.

  Frontmatter for "{{basename}}":
  {{frontmatter}}

  RESEARCH DISCIPLINE:

  - Use Perplexity's web search aggressively. For a market map, breadth of
    named entities matters more than depth on any single one.
  - For every factual claim — funding round, founding year, customer name,
    market sizing, product capability — append an inline numeric citation
    marker [1], [2], etc. corresponding to the search-result order.
  - Quote phrasing from primary sources where useful (founder interviews,
    investor blog posts, earnings notes, academic abstracts).
  - Prefer primary surfaces: company homepage, founder Twitter/X, technical
    blog posts, conference talks, investor announcements. Aggregator pages
    (Crunchbase, PitchBook summaries) are fallbacks for funding stage only.
  - Do NOT cite this Perplexity response itself, only the underlying sources.

  EDITORIAL STANCE — attribute innovation correctly:

  Markets are pioneered by startups, academics, research labs, and indie
  practitioners — NOT by tech giants. Training data over-represents
  incumbents. Counteract this systematically:

  - Treat big tech (Microsoft, Google, Amazon, Apple, Meta, Oracle, Salesforce,
    IBM post-1990s, Nvidia post-2020) as ADOPTERS or POPULARIZERS in this
    market unless the entry documents an originating research-lab paper or
    a heyday-era origination story (Bell Labs, Xerox PARC, DeepMind, OpenAI's
    early years).
  - In every Lighthouse Examples sub-bucket, cap big-tech entries at 1 of
    5–10. Prefer Series A-C startups, seed-stage frontier bets,
    open-source projects, indie practitioners, research labs.
  - In Market Dynamics, name the named operators driving the curve, not
    the incumbents profiting from it.
  - Where an incumbent IS the originator, say so explicitly with the
    research paper or product release that documents the origination.

  INNOVATOR CARD SHAPE:

  Each named innovator under "Innovator Profiles" follows this shape exactly:

      #### [Innovator Name](https://homepage.url)
      **Offering**: one-sentence description of what they do that is specific
      enough that a partner could repeat it back. Use product names, customer
      names, and category boundaries. Cite. [N]
      **Funding**: stage and round size if disclosed (e.g., "$30M Series A,
      DN Capital, 2024"). "Undisclosed" or "Bootstrapped" if no public data.
      **Why they matter**: one sentence on what makes them distinctive — the
      technical bet, the GTM angle, the team's background. Not marketing
      adjectives; a specific differentiator. Cite. [N]
      **Coverage**: 1-2 references in trade press, founder podcasts, or
      analyst notes if available. Format: `[Outlet, Title](url)`. Cite. [N]

  Aim for 3-7 innovators per sub-bucket. If a sub-bucket has fewer than 3
  credible named entities, MERGE it into an adjacent sub-bucket rather than
  padding with weak entries.

  LINKS AND WIKILINKS:

  - For innovator names and source links, use `[Name](https://url)` form.
  - Do NOT invent `[[wikilink]]` syntax. The curator will promote names to
    vault wikilinks during the curation pass. If you happen to know a
    canonical concept this market touches (e.g., "Compliance AI", "Agentic
    Workspaces"), surface the concept name as plain text in the Adjacent
    Concepts section so the curator can wikilink it later.

  CALIBRATION ON LENGTH:

  This is a deep-research run. Lean long, not short. A complete market map
  is roughly 4,000-8,000 words of body, with 20-40 named innovators across
  4-8 sub-buckets, a summary table per sub-bucket where useful, and explicit
  funding-trend / adoption-pattern data in Market Dynamics. Better to over-
  enumerate and let the curator prune than to under-enumerate.
```

# Market Snapshot

- One-paragraph italicized lede (max 2 sentences) that captures the punchy thesis of this market. Voice: the analyst opening their memo. Use markdown italics: `_..._`.
- Then the headline stat — one quoted statistic from a credible source that signals scale or velocity, with inline citation. Format the quote as a blockquote (`> "..."`).
- Then 2-3 sentences orienting the reader: what is this market, what is the timeframe, why is it worth a map right now.

# The Question this Map Answers

- One paragraph (3-5 sentences) stating the question this map clarifies for an operator or investor reading it.
- If the file is a KNOWN CATEGORY map, frame the question as "what shape has this category settled into, and where is the frontier."
- If the file is a THESIS-DRIVEN map, state the thesis explicitly in one sentence, then explain which adjacent categories the thesis traverses and why the traversal is non-obvious.

# Why Now

- 3-5 bullets, each one a specific unlock that explains why this market is mappable in the current quarter and would have been premature 18 months ago.
- Unlock types to consider: a technical capability crossing a threshold (cost, latency, accuracy), a regulatory or standards shift, a capital-formation pattern (a fund vintage, an exit precedent), a customer-behavior shift, an open-source release that lowered the floor.
- Cite each unlock. Where possible, quote a founder, researcher, or operator who named the unlock.

# Map of the Market — Sub-Segments

- Identify 4-8 natural sub-segments that partition this market. For a thesis-driven map, the sub-segments are the adjacent categories the thesis traverses.
- Give each sub-segment a 1-2 sentence definition: what falls inside, what falls outside, and what distinguishes it from its neighbors.
- This section is the TABLE OF CONTENTS for the Innovator Profiles section below. Sub-segment names here must match section headings below.

# Lighthouse Examples

- For each sub-segment, list 5-10 lighthouse innovators in `[Name](url) — one-line description` form. These are the names a partner would expect to hear in this category — recognized leaders, well-funded operators, frontier bets the analyst would brief on.
- Group under `## <Sub-segment name>` subheadings matching the Map of the Market above.
- This is a flat reference list. The deeper analysis lives in Innovator Profiles below.
- Use the editorial-stance cap: at most 1 of 5-10 in any sub-bucket may be big tech.

# Innovator Profiles

For each sub-segment from the Map of the Market, produce a `## <Sub-segment name>` heading and under it, 3-7 innovator cards in the format defined in the system prompt:

    #### [Innovator Name](https://homepage.url)
    **Offering**: ...
    **Funding**: ...
    **Why they matter**: ...
    **Coverage**: ...

- Order within each sub-segment from most-established to most-frontier (seed-stage / stealth at the end).
- After the innovator cards in each sub-segment, render a single summary table with columns: `Innovator | Stage | Differentiator | Primary Customer`. The table lets a partner skim the sub-segment without reading every card.

# Media, Voices, and Coverage

- 6-12 bullets covering the publications, podcasts, YouTubers, analysts, and individual operator-thinkers who shape the conversation about this market.
- Format: `**Name** — Platform — one-line note on their angle / why they are worth following`. Include a primary URL link.
- Sub-group with `## Publications`, `## Podcasts & YouTube`, `## Analysts & Operator-Thinkers` if the list is long enough to warrant it.
- Prefer specialized trade press over generalist business press. Prefer named operator-bloggers over corporate marketing surfaces.

# Market Dynamics

## Sizing and Growth

- 2-4 cited bullets covering: TAM / current market size, projected CAGR, the report or analyst behind each number.
- Be skeptical of single-source sizing claims; where two credible sources disagree, surface the disagreement.

## Adoption Patterns and Barriers

- 2-4 cited bullets covering: what percentage of the addressable buyer base has adopted, what the canonical barriers are (procurement cycle, regulatory uncertainty, technical readiness, talent shortage), and where the adoption curve is bending.

## Capital Flow

- 2-4 cited bullets covering: where the funding has concentrated by sub-segment, who the active funds are (named partners where public), and any recent exit, acquisition, or IPO that reset valuation expectations in the category.

# Frontier and Open Questions

- 4-7 bullets, each one a specific open question that a partner reading this map would want the analyst to think about next.
- Frame each as a question, not a statement: "Will agent-to-agent micropayments require a separate settlement rail, or will existing card networks absorb the use case?" not "Settlement rails are evolving."
- Pair each question with a one-sentence note on which innovators or research streams are likely to produce the answer.

# Adjacent Concepts and Maps

- 4-8 plain-text concept names (no wikilink syntax — the curator wikilinks during curation) that an operator working in this market would want to explore next.
- Mix of: adjacent market maps (other categories this one borders), foundational concepts (the mental models this market sits on), and vocabulary terms (the specific jargon the curator may want to define in `Vocabulary/`).
- Format: `- <Concept Name> — one-line on why it adjoins this map`.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for:

- The thesis paragraph (for thesis-driven maps) you want the model to fold into the system context. To do that, move the paragraph ABOVE the `***` divider — into the Market Snapshot or Question section — before running the template.
- Hand-curated `:::tool-showcase` blocks pointing to vault tools you want to feature.
- Tuning notes, prior model outputs, and iteration history while you refine the template for your domain.

## Multi-stage roadmap (deferred)

This v1 template is intentionally single-stage: one Perplexity Deep Research run produces the full draft, the curator promotes Lighthouse Examples to `:::tool-showcase` blocks and `[Name](url)` references to `[[wikilink]]` references during the curation pass.

The deferred multi-stage version will run:

1. **RAG pre-flight** — pull canonical Lossless sources for this market (tools under `Tooling/`, concepts under `concepts/`, prior market maps that overlap) and feed them as context to the research stage. This eliminates the wikilink-invention problem and lets the model name actual vault entries.
2. **Perplexity research stage** — deep research with the RAG context as a primer, producing the draft this v1 template produces.
3. **Claude editing stage** — an editorial pass that enforces the analyst voice, prunes the over-enumeration, restructures sub-segment boundaries where the data demands, and emits the final `[[wikilink]]` form.

The plumbing for stage 3 (the Claude orchestrator) lives in `claudeService.ts`. The plumbing for stage 1 (RAG over the Lossless corpus) is partially built via the `chroma` MCP server — the missing piece is a per-template `rag-context:` block in the cft fence that names which collections to query and how many results to inject. Spec lives in `context-v/specs/` — open it before starting the multi-stage build.
