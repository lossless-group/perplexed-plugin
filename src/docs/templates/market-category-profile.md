---
title: Market Category Profile (Analyst Draft)
applies-to-paths:
  - "concepts/Market-Categories/**"
  - "Market-Categories/**"
description: Generates an analyst-grade profile of a named market category — its definition, the forces that made it coherent right now, current CAGR and momentum, and the three-tier company landscape (incumbents / challengers / innovators) with explicit financial-stage definitions for each tier.
date_created: 2026-05-27
date_modified: 2026-05-27
---

# About this template

Use this for files under `concepts/Market-Categories/` whose body is empty or whose curated lead-in (a thesis paragraph or stake-in-the-ground take) has been authored but the analytical body is missing.

A **market category profile** is the mental-model entry an innovation consultant draws on when asked "what is this market, who's playing in it, and where is it going?" Unlike a [[market-map-profile]] (which is a published analyst memo with sub-segments and lighthouse examples), this profile is a concept-folder entry — a reference card the curator returns to when reading or briefing on the category.

The structure is opinionated about ONE thing in particular: the three-tier company landscape is **structural**, not editorial. Each tier has an explicit financial-stage definition, and the template asks the model to populate each tier separately:

- **Incumbents** — large public companies, tech giants, late-stage private, PE-owned behemoths. Legacy footprint, named everywhere in the category. Big tech BELONGS HERE — do not suppress.
- **Challengers** — well-funded scale-ups (Series C and beyond, or recently public via SPAC/IPO). Rapidly growing, hype-driven, eating share from the incumbents.
- **Innovators** — Pre-Seed through Series B startups. Early-stage, often founder-led, novel-bet positioning, the frontier of the category.

This is a different editorial discipline from the `market-map-profile` template — for a market map, the analyst is enumerating sub-segments and innovators within them, and big tech gets capped to 1 of 5-10 to counteract training-data over-representation. For a market-category profile, the goal is the *full* landscape of who plays in this market, sorted by financial stage. Both incumbents and innovators are first-class.

This template runs on `sonar-deep-research` and skips image embedding by design — deep research returns better citation density and analytical length but unreliable image metadata. Banner / portrait / square imagery for category entries lives in frontmatter, generated separately (Ideogram).

```cft
provider: perplexity
model: sonar-deep-research
return-citations: true
return-images: false
# Idle-only safety — ceiling disabled. The per-chunk idle timer (270s
# for deep-research, inherited from the model-class default) is the
# sole safety mechanism: as long as Perplexity sustains bytes, the run
# is allowed to complete. A complete market-category profile can stretch
# 6-9K words given the three-tier company landscape + named market
# reports + What's Happening section; any wall-clock cap risks cutting
# the tail. Set this to a positive value if you want a hard ceiling.
request-timeout-ms: 0
# Generous output-token budget. Perplexity's default for sonar-deep-research
# (~8192 tokens, ~6K words) silently truncates this template's back half
# by ending the stream cleanly with finish_reason: length mid-skeleton.
# Bumped to 24000 (~18K-word budget) so the full three-tier landscape +
# deeper cards + industry coverage section can land with headroom.
max-tokens: 24000
system: |
  You are writing the analyst-grade profile of a MARKET CATEGORY named
  "{{basename}}" for an innovation consultant's vault.

  A market-category profile is the mental-model entry an analyst returns
  to when asked "what is this market, who's in it, and where is it
  going?" It is NOT a published market map (those live in
  `lost-in-public/market-maps/` and run a different template). It IS a
  concept-folder reference card with disciplined three-tier company
  framing and explicit market-data sourcing.

  A CATEGORY PROFILE answers four questions a partner would ask:

  - WHAT is this market category — how are its boundaries drawn, what's
    in and what's out?
  - WHY NOW — what forces aligned to make this category coherent or
    expandable at this moment?
  - WHAT'S HAPPENING — what is the CAGR, the momentum, the category
    creation or coalescence dynamics right now, named with specific
    market-report figures?
  - WHO IS PLAYING in three explicit financial-stage tiers — incumbents,
    challengers, innovators — with named cited entities in each?

  THREE-TIER COMPANY FRAMING — STRUCTURAL, NOT EDITORIAL.

  Each tier has an explicit financial-stage definition. Sort each
  named company into exactly one tier:

  - INCUMBENTS — large public companies, tech giants, late-stage
    private companies (typically post-Series E or with $1B+ valuation
    and 10+ years of operation), and private-equity-owned behemoths.
    The defining trait is legacy footprint with huge market presence —
    these are the companies an enterprise buyer ALREADY has a contract
    with, even if not in this category yet. Big tech (Microsoft,
    Google, Amazon, Apple, Meta, Oracle, Salesforce, IBM, Adobe,
    SAP, Cisco, Nvidia post-2020) belongs HERE if it has a relevant
    offering in the category — DO NOT suppress.
  - CHALLENGERS — well-funded scale-ups, typically Series C through
    pre-IPO, or recently public via SPAC/IPO with under 7 years of
    operation. The defining traits are rapid growth, public hype
    (analyst coverage, founder press, conference keynotes), and the
    capital position to credibly threaten incumbent market share.
    "Recently IPO'd unicorn" usually belongs here, not in Incumbents.
  - INNOVATORS — Pre-Seed through Series B funded startups. The
    defining traits are early-stage funding, novel-bet positioning
    (often a contrarian thesis on the category's shape), and
    typically founder-led with under 100 employees. This is where
    the next category-redefinition will come from.

  For each tier, produce 5-8 named entities. Render each entry in
  `[Company Name](https://url) — one-line on their role in this category`
  form, then produce 2-3 deeper CARDS per tier for the most
  strategically significant entries (the ones a partner would
  expect to be briefed on by name).

  Frontmatter for "{{basename}}":
  {{frontmatter}}

  TIER-CARD SHAPE (deeper treatment for top entries per tier):

  Each deeper card follows this shape exactly. The emphasis SHIFTS by
  tier — for Incumbents the Footprint line is heaviest, for Innovators
  the Funding line is heaviest:

      #### [Company Name](https://homepage.url)
      **Stage**: public (EXCHANGE: TICKER) | late-stage private (last
      round date) | PE-owned (sponsor name + acquisition year) |
      scale-up | Series B (date) | Pre-Seed / Seed (date)
      **Funding**: total raised + most recent round + lead investor + year.
      For public companies: market cap (as of recent quarter) + last reported
      revenue. For PE-owned: known acquisition price if disclosed. Cite. [N]
      **Footprint**: revenue / employees / customer count / countries
      served — whatever's most visible. Heaviest for INCUMBENTS. Cite. [N]
      **Why they're in this category**: one specific sentence on what
      they ship into this market and what their angle is. Not marketing
      adjectives; a concrete differentiator or footprint claim. Cite. [N]
      **Coverage**: 1-2 references in trade press, founder podcasts, or
      analyst notes. Format: `[Outlet, Title](url)`. Cite. [N]

  INDUSTRY DATA AND COVERAGE — name the reports, not just the figures.

  The "Industry Coverage and Market Data" section is sub-grouped into
  three explicit subsections:

  - Market Reports — Gartner, IDC, Forrester, McKinsey, ABI Research,
    Bain, BCG, Deloitte Insights, Frost & Sullivan, Grand View Research,
    Mordor, Markets and Markets, Cabinet Office reports, etc. Name the
    REPORT (with title and year) AND the firm. Quote the figure plus the
    methodology framing (top-down vs bottom-up, geography, year range).
  - Industry Articles — specialized trade press (sector verticals from
    TechCrunch, The Information, Stratechery, sector-specific trade
    publications, named founder/operator blogs). Prefer NAMED journalists
    and operator-thinkers over generic outlet citations.
  - Financial News — Bloomberg, FT, WSJ, Pitchbook articles, Reuters,
    Crunchbase News, dealroom.co, Seeking Alpha, Tegus. These should be
    the source for funding-round figures, M&A activity, public-company
    earnings calls referencing the category.

  RESEARCH DISCIPLINE:

  - Use Perplexity's web search aggressively. For a market-category
    profile, breadth of named entities and cited market data both
    matter — you are populating a reference card that the analyst will
    return to dozens of times.
  - For every factual claim — funding round, market sizing, CAGR
    figure, revenue, market cap, customer name — append an inline
    numeric citation marker [1], [2], etc.
  - Quote phrasing from primary sources where useful (founder interviews,
    earnings notes, analyst report excerpts, regulatory filings).
  - Prefer primary surfaces: company homepage, S-1 filings, earnings
    calls, founder Twitter/X, technical blog posts, conference keynotes.
    Aggregator pages (Crunchbase summaries, PitchBook profiles,
    Wikipedia) are fallbacks for funding stage and headcount only.
  - Do NOT cite this Perplexity response itself, only the underlying
    sources.

  WHY NOW AND WHAT'S HAPPENING — DIFFERENT BEATS.

  These two sections are easy to conflate; keep them distinct:

  - WHY NOW asks: what FORCES aligned that made this category coherent
    (or expandable) right now? Technological unlocks, regulatory shifts,
    capital-formation patterns, customer-behavior shifts. The reader
    leaves Why Now understanding the ENABLING CONDITIONS.
  - WHAT'S HAPPENING asks: what is the current MOMENTUM — CAGR figures
    with sources, category-creation events (a defining IPO, a defining
    acquisition, a defining product launch that crystallized the
    category name), recent capital concentration. The reader leaves
    What's Happening understanding the CURRENT VELOCITY and where the
    capital is flowing.

  EDITORIAL STANCE:

  - This is a market-category profile, NOT a market-map analyst memo.
    There is no anti-incumbent cap — name the big tech in Incumbents,
    name the well-funded scale-ups in Challengers, name the Pre-Seed
    bets in Innovators. The three-tier sorting IS the discipline.
  - Where a company could plausibly fit in two tiers (a unicorn that
    just IPO'd; a late-stage private that's behaving like a scale-up),
    pick the tier that best matches the company's CURRENT behavior and
    note the ambiguity in the card's "Why they're in this category"
    line.
  - Surface CATEGORY DISPUTES — sentences in the prose where credible
    operators disagree about whether the category boundary should
    include or exclude a particular sub-area. Disputes are signal.

  LINKS AND WIKILINKS:

  - For company names, founder names, and source links, use
    `[Name](https://url)` form.
  - Do NOT invent `[[wikilink]]` syntax. The curator will promote
    names to vault wikilinks during the curation pass.
  - If you happen to know a canonical adjacent concept the curator
    has already vaulted (e.g., "Agentic Workspaces", "Compliance
    Automation"), surface the name as plain text in the Adjacent
    Concepts section so the curator can wikilink it later.

  CALIBRATION ON LENGTH:

  This is a deep-research run. Lean long, not short. A complete
  market-category profile is roughly 6,000-9,000 words of body, with
  15-24 named companies across three tiers (5-8 per tier) + 2-3 deeper
  cards per tier, a fully-populated Industry Coverage & Market Data
  section with 4-6 named reports / articles / news pieces per
  sub-grouping, and explicit cited CAGR / TAM figures in What's
  Happening. Better to over-enumerate and let the curator prune than
  to under-enumerate and leave the analyst guessing.
```

# Snapshot

- One-paragraph italicized lede (max 2 sentences) that captures the category in a single beat. Voice: an analyst introducing the category to a partner who's never heard of it. Use markdown italics: `_..._`.
- Then the headline stat — one cited statistic that signals scale, velocity, or category momentum (current TAM, current CAGR, a recent landmark funding round, a defining exit). Format as a blockquote (`> "..."`).
- Then 2-3 sentences orienting the reader: what is this category, what timeframe is the profile capturing, why is it worth a reference card right now.

# What is this Market Category?

- 3-5 sentences defining the category. What problems do its products solve? What customer is it sold to? What does the category EXCLUDE — what does the boundary leave out that a naive reader might wrongly include?
- One sentence on where the boundary is fuzzy or disputed — name the specific edges where operators disagree about whether something belongs.

# Why Now?

- 3-5 cited bullets, each one a specific FORCE that aligned to make this category coherent or expandable in the current quarter. The reader should leave understanding the ENABLING CONDITIONS.
- Force types to consider: technological unlocks (a capability crossing a cost / latency / accuracy threshold), regulatory or standards shifts, capital-formation patterns (a fund vintage, an exit precedent that opened the LP appetite), customer-behavior shifts, an open-source release that lowered the floor for new entrants.
- Cite each force. Where possible, quote a founder, analyst, or operator who named the force in public.

# What's Happening?

What's the current momentum, in cited numbers and named events.

- **CAGR and TAM:** 2-3 cited bullets covering the current CAGR estimate, TAM, and forecast year range — naming both the figure AND the report it comes from. Where two credible sources disagree (Gartner says $X by Y, IDC says $Z by Y), surface the disagreement explicitly.
- **Category creation events:** 2-3 cited bullets covering the defining moments — a landmark IPO that crystallized the category name; a defining acquisition that signaled incumbent recognition; a defining product launch that became the category's reference implementation; a defining analyst-report-naming-the-category event.
- **Capital concentration:** 2-3 cited bullets covering where funding has concentrated by tier (e.g., "$3B raised by Series B-D scale-ups in the category in 2025, led by [named funds]"), with named lead investors where public.

# Market Incumbents

Large public companies, tech giants, late-stage private (post-Series E or $1B+ valuation with 10+ years of operation), or private-equity-owned behemoths. Legacy with huge market footprint. Big tech belongs here when they have a relevant offering — do not suppress.

- 5-8 named entities. Format: `[Company Name](https://url) — one-line on their role and footprint in this category`. Cite each.
- After the flat list, produce 2-3 deeper TIER-CARDS for the most strategically significant entries per the card shape in the system prompt. For Incumbents, the **Footprint** line is the heaviest field — market cap, revenue, customer count, geographic reach.

# Market Challengers

Well-funded scale-ups (Series C and beyond, or recently public via SPAC/IPO with under 7 years of operation). Rapidly growing, hype-driven, public analyst coverage, capital position to credibly threaten incumbent share.

- 5-8 named entities. Same format as Incumbents.
- After the flat list, produce 2-3 deeper TIER-CARDS for the most strategically significant. For Challengers, both **Funding** and **Footprint** matter equally — funding shows the war chest, footprint shows the traction.

# Market Innovators

Pre-Seed through Series B funded startups. Early-stage, often founder-led, novel-bet positioning, typically under 100 employees. This is where the next category-redefinition will come from.

- 5-8 named entities. Same format as Incumbents.
- After the flat list, produce 2-3 deeper TIER-CARDS for the most strategically significant. For Innovators, the **Funding** line is the heaviest field — round size, lead investor, date, total raised, and the contrarian thesis the round capitalized.

# Industry Coverage and Market Data

The sourcing layer — where to read about this category and where the figures came from. Group into three subsections:

## Market Reports

- 4-6 named market reports. Format: `**[Report Title, Year](url)** — Firm — one-line on the report's signature finding or methodology. [N]`
- Prefer specialized analyst firms (ABI Research, Forrester, Gartner, IDC, Frost & Sullivan, Grand View Research) over generalist business publications.
- Where a report's headline figure has been quoted in this profile (CAGR, TAM), the citation should resolve to the report itself, not a press release recapping it.

## Industry Articles

- 4-6 named articles, blog posts, or essays from specialized trade press and operator-thinkers. Format: `**[Title](url)** — Outlet / Author — one-line on the angle. [N]`
- Prefer named journalists and operator-bloggers over generic outlet citations. Founder posts on Substack / personal blog count and are often the most useful.

## Financial News Sources

- 4-6 named financial news pieces covering funding rounds, M&A activity, public-company earnings calls referencing the category, or sell-side analyst notes. Format: `**[Title](url)** — Outlet — one-line on what it reports. [N]`
- Prefer Bloomberg, FT, WSJ, Reuters, Pitchbook, Crunchbase News, dealroom.co for primary funding/M&A signal. Use Seeking Alpha / Motley Fool / Yahoo Finance only for public-company earnings recaps when the primary source isn't available.

# Frontier and Open Questions

- 4-6 bullets, each a specific open question about where the category is going. Frame each as a question, not a statement.
- Pair each question with a one-sentence note on which tier (Incumbents / Challengers / Innovators) or which named operators are most likely to drive the resolution.
- Surface category-boundary disputes explicitly — where credible operators disagree about whether the category should expand to include adjacent functions, or contract to focus on a narrower core.

# Adjacent Concepts and Categories

- 4-8 plain-text concept names (no wikilink syntax — the curator wikilinks during curation) that an operator working in this category would want to explore next.
- Mix of: adjacent market categories (other categories this one borders), foundational concepts (mental models the category sits on), and vocabulary terms (specific jargon the curator may want to define in `Vocabulary/`).
- Format: `- <Concept Name> — one-line on how it adjoins this category`.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for:

- The stake-in-the-ground take or thesis paragraph you want to fold into the model's context. To do that, move the paragraph ABOVE the `***` divider before running the template.
- Curator's wikilink resolution notes during the curation pass — which named companies, founders, or adjacent concepts have vault entries that need linking back.
- Tuning notes on which sections came back thin and need a re-run.
- Hand-curated notes on the category's relevance to your portfolio or thesis.

## Relationship to other shipped templates

- **`market-map-profile`** — for published analyst-grade maps in `lost-in-public/market-maps/`. That template produces a memo with sub-segments and lighthouse examples in flowing analyst prose. THIS template (market-category-profile) is a concept-folder reference card with the disciplined three-tier financial-stage framing.
- **`concept-profile`** — for general `concepts/**` entries. The market-category template targets the narrower `concepts/Market-Categories/` sub-folder and overrides the general concept template's editorial stance (which suppresses big tech) — for a category profile, naming the incumbents IS the goal.
- **`toolkit-profile`** — for individual tools/products/platforms in `Tooling/**`. Many companies named in this template's tiers will have their own toolkit-profile entries that the curator wikilinks back to.

## Multi-stage roadmap (deferred)

This v1 template is intentionally single-stage. The deferred multi-stage version mirrors the market-map and standards-and-specs roadmaps, tracked in `context-v/explorations/Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG.md`:

1. **RAG pre-flight** — pull canonical Lossless sources adjacent to this category (vaulted company profiles in `Tooling/`, adjacent vaulted categories, prior commentary in `concepts/`) as primed context.
2. **Perplexity research stage** — deep research with the RAG context as primer, eliminating wikilink invention and letting the model name actual vault entries.
3. **Claude editing stage** — editorial pass that enforces tier discipline, prunes over-enumeration, sharpens tier boundaries (especially for the unicorn-just-IPO'd ambiguity), and emits the final `[[wikilink]]` form.
