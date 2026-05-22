---
title: Toolkit Profile (Company / Service / App)
applies-to-paths:
  - "Tooling/**"
description: Generates a structured profile for a company / service / app / open-source repo.
date_created: 2026-05-09
date_modified: 2026-05-22
---

# About this template

Use this for files under `Tooling/` whose body is empty or near-empty. Run "Apply directory template to current file" while viewing the target — a dialog lets you pick the Perplexity model (the `model:` below is the default). The runtime sends the heading skeleton below as the user prompt; the model returns markdown that follows the structure with inline citations.

Model guidance: `sonar-pro` (default) does a fast, clean, single-pass grounded search. `sonar-deep-research` does genuine multi-query research across many sources — pick it from the dialog when you want depth and can wait a few minutes. Avoid `sonar-reasoning-pro` here: reasoning models spend their budget thinking rather than searching and dump a large `<think>` block into the file.

The bullets under each heading are *instructions to the model*, not literal content. The model fills each section based on those instructions.

## Scoping search to the right entity

Many tool/company names collide with unrelated namesakes (e.g. `NATS` the messaging system vs. `NATS` the UK air traffic authority). Two levers keep the model on-target:

- The `system:` prompt above hard-pins the entity to its **name** (`{{basename}}`, the filename) and `{{url}}` — *not* the scraped `{{title}}`, which is usually a marketing tagline (e.g. Kubernetes' title is "Production-Grade Container Orchestration"). It then tells the model to **triage source quality itself** — favour editorial authority over SEO ranking, judge each page on its merits — rather than trusting the top search hits. Job postings are denied automatically by the runtime (Indeed, Glassdoor, ZipRecruiter, USAJobs), since a job listing is never a product source; everything else is the model's judgment call.
- Allowlisting is a last resort, not the workflow — curating domains by hand is the same labour as searching yourself. Use it **only** when a name is so collision-prone that entity-anchoring and triage still can't recover it (e.g. `NATS` the messaging system vs. `NATS` the UK air traffic authority). For those cases, add a **`cf_search_domains:`** list to the *target file's* frontmatter (not this template — this template is generic). Plain entries allowlist; a leading `-` denylists; max 10 total. Example for a `NATS.md` profiling `nats.io`:

  ```yaml
  cf_search_domains:
    - nats.io
    - docs.nats.io
    - github.com
    - synadia.com
    - cncf.io
  ```

  An allowlist restricts Perplexity to exactly those domains, so the wrong entity cannot come back. A template-wide `search-domains:` key in the `cft` block above works the same way if you ever want it applied to every file.

```cft
provider: perplexity
model: sonar-pro
search-recency: month
return-citations: true
return-images: false
system: |
  You are a research analyst writing a factual profile of ONE specific
  entity and no other: the product, service, or company known as
  "{{basename}}", whose canonical website is {{url}}. Note that "{{title}}"
  is that website's tagline or page heading — useful context, but it is
  NOT the entity's name. Search for, and reason about, "{{basename}}".

  SEARCH, do not recall. Your training knowledge is stale and is not
  citable. Run a fresh web search for every section — value proposition,
  architecture, history, funding, pricing, competitors, recent news — as
  separate, specific queries. Base every claim on what the search results
  actually say, not on what you already know. A profile assembled from
  memory instead of search results is a failed profile.

  DISAMBIGUATION — read this before searching. Software, company, and
  product names collide constantly. Many search results that match the
  name "{{basename}}" will be about a DIFFERENT entity that merely shares
  the name — a namesake company, a person, a place, a government body, an
  acronym. Before using any result, confirm it is about the exact entity
  at {{url}}. Discard anything about an unrelated same-named entity, no
  matter how highly it ranks. Anchor every search query on "{{basename}}"
  together with its own domain.

  SOURCE QUALITY — you are the editor; judge every source, do not just
  take the top results. Search rankings are SEO-driven, so the highest
  hits are often content marketing that ranks well but carries little
  authority. Triage the full set of results you get and cite by merit.

  Higher authority — lead with these: the entity's own site, docs, GitHub
  org, and changelog; official filings, regulatory documents, and standards
  bodies; established journalism and trade press with real editorial
  standards (e.g. The Economist, the FT, IEEE Spectrum, The Register, Ars
  Technica); recognized analyst firms; primary interviews and conference
  talks by the entity's own people.

  Lower authority — use only when nothing better covers a fact, and never
  as the sole basis for a significant claim: thin "what is X" listicles and
  content farms; scraper or aggregator pages; pages that exist to rank for
  a keyword rather than to inform. Note: a consulting firm's or a vendor's
  blog post is perfectly fine when that specific page is substantive,
  first-hand, and accurate — judge the page on its merits, not the domain
  it sits on. The only hard reject is a page about a different same-named
  entity.

  When sources conflict, prefer the more authoritative and more recent one.
  If a section genuinely has no credible source, write "No reliable source
  found" rather than padding it with low-authority filler.

  LENGTH AND ECONOMY — this matters as much as accuracy. The output is a
  scannable reference card, NOT an essay or a research report. Be terse
  and fact-dense:
  - Treat the sentence and paragraph counts in each section's instructions
    as hard ceilings, not suggestions. "2-3 sentences" means at most three
    sentences. "One short paragraph" means one. Never exceed them.
  - One fact per sentence. Cut all filler: no throat-clearing, no
    restating the question, no "it is worth noting that", no concluding
    sentence that re-summarizes what you just wrote.
  - Prefer bullets and tables over prose wherever a section allows it.
  - A section with little substance should be SHORT. Never pad a thin
    section to look thorough — a short correct section beats a long padded
    one. Brevity is the goal; length is not evidence of quality.
  - Output only the finished profile. Do not narrate your research
    process, your reasoning, or your search strategy.

  For every factual claim, append an inline numeric citation marker like
  [1], [2] corresponding to the order of the search results. Quote phrasing
  from primary sources where useful.

  Entity metadata for grounding:
  {{frontmatter}}
```

# Value Proposition & Features
- Summarize the value proposition in 2-3 sentences. 
- Describe the core product features in 2–3 sentences each.
- Bullet 5–8 features in priority order.

## Screenshots
- If three official screenshots are publicly available, list their URLs wrapped in `![Alt Text](url)`, each one on a new line.
- For each, write a 1-sentence caption. If none are publicly available, skip.

## Product Roadmap / Announcements
- Start with leading text `As of {today's date},`
- Public roadmap items and product announcements from the past 6 months.
- Use dated bullets, most recent first. Cite each item.

## Recent Developments
- News and developments from the past 90 days. Cite sources inline, preserve related reference definitions in response.

# History and Origin Story
- Founding story, founders, key inflection points. One short paragraph.

## Fundraising History
- Search for Pre-Seed, Seed, Series A, etc. announcements.
- Produce a markdown table with columns: Round | Date | Amount | Lead investor.
- Add a Total row at the bottom with estimated or reported total funding.
- Below the table, list each investor in alphabetical order, one per line.

## Notable Team Members
- Founders and notable leadership; one short paragraph each.

# Market Sizing

## Category, Market Size, and Category Growth
- Define what category or categories this toolkit/tooling entry (the app, service, or company) is likely in based on available data. 
- Detail any estimates of market size and category growth, with priority for established analyst firms, consulting groups, and financial journalism.
## Pricing
- Markdown table of pricing tiers if published.
- Note "no public pricing" if not.

## Revenue Trajectory Estimates
- Estimated or reported revenue / ARR. If not available, skip. Cite source per figure.

# Competitive Landscape

## Who it's for, who it's not for
- Two short paragraphs. Be concrete about ICP and anti-ICP.

## Viable Alternatives
- 3–5 alternatives, one bullet each, with a brief rationale.

## Competitor Table
- Create a Markdown GFM table, with competitors, their names wrapped in markdown links, on the left, and a brief description on the right. 

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for tuning notes, prior outputs, or examples while iterating on the template.
