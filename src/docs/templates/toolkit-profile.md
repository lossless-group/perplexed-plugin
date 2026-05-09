---
title: Toolkit Profile (Company / Service / App)
applies-to-paths:
  - "Tooling/**"
description: Generates a structured profile for a company / service / app / open-source repo.
---

# About this template

Use this for files under `Tooling/` whose body is empty or near-empty. Run "Apply directory template to current file" while viewing the target. The runtime sends the heading skeleton below as the user prompt to Perplexity Deep Research; the model returns markdown that follows the structure with inline citations.

The bullets under each heading are *instructions to the model*, not literal content. The model fills each section based on those instructions.

```cft
provider: perplexity
model: sonar-deep-research
search-recency: month
return-citations: true
return-images: false
system: |
  You are a research analyst profiling "{{title}}". Use Perplexity's web search
  aggressively for every section. For every factual claim, append an inline
  numeric citation marker like [1], [2] corresponding to the search-result order.
  Quote phrasing from primary sources where useful. Prefer first-party sources,
  official filings, and reputable industry publications. Use the entity's
  existing metadata as starting context.
```

# Features
- Describe the core product features in 2–3 sentences each.
- Bullet 5–8 features in priority order.

## Screenshots
- If three official screenshots are publicly available, list their URLs as bullets.
- For each, write a 1-sentence caption. If none are publicly available, write "No publicly available screenshots."

## Product Roadmap / Announcements
- Public roadmap items and product announcements from the past 6 months.
- Use dated bullets, most recent first. Cite each item.

## Recent Developments
- News and developments from the past 90 days. Cite sources inline.

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

## Pricing
- Markdown table of pricing tiers if published.
- Note "no public pricing" if not.

## Revenue Trajectory Estimates
- Estimated or reported revenue / ARR. Cite source per figure.

# Competitive Landscape

## Who it's for, who it's not for
- Two short paragraphs. Be concrete about ICP and anti-ICP.

## Viable Alternatives
- 3–5 alternatives, one bullet each, with a brief rationale.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for tuning notes, prior outputs, or examples while iterating on the template.
