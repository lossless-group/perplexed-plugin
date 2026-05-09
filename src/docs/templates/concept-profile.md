---
title: Concept Profile (Idea / Pattern / Mental Model)
applies-to-paths:
  - "concepts/**"
description: Generates an encyclopedia-style entry for a concept — definition, usage, history, examples, case studies.
---

# About this template

Use this for files under `concepts/` whose body is empty or near-empty. The bullets under each heading are *instructions to the model*, not literal output. The model fills each section based on those instructions.

The H1 heading uses `{{basename}}` (strict filename, never the frontmatter `title` field) so the rendered heading always matches the file name in the vault.

```cft
provider: perplexity
model: sonar-deep-research
search-recency: year
return-citations: true
return-images: false
system: |
  You are a research analyst writing an encyclopedia-style entry for the
  concept named "{{basename}}". Use Perplexity's web search aggressively for
  every section. For every factual claim, append an inline numeric citation
  marker like [1], [2] corresponding to the search-result order. Quote
  phrasing from primary sources where useful. Prefer first-party sources,
  academic literature, books, and reputable industry analysis. Use the
  entity's existing metadata as starting context.
```

# Defining and Describing {{basename}}
- Insert this exact placeholder line on its own bullet so the user can replace it after generation: `[Image embed placeholder — run "Find images for selection" on this section to populate.]`
- If this concept involves a process, hierarchy, taxonomy, or part-relationship that a diagram clarifies, render a `mermaid` codefence here. If a diagram does not add insight, omit it entirely — do not force one.
- Write a one-sentence italicized lede (a zinger or kicker) that captures the core insight in plain language. Use markdown italics: `_..._`.
- Then write a 2–4 sentence paragraph giving more context: what the concept is, when it applies, and why it matters.

# Uses in Context
- 3–6 bullets describing how the concept is invoked — typically in business, technology, design, or popular culture — to describe something or convey meaning.
- Quote phrasing from sources where they invoke the term inline. Cite each.

# History of Use

## Origins
- Where the term first appeared (academic paper, book, blog post, industry report).
- Who introduced it and in what context.
- One concise paragraph or 2–4 cited bullets, whichever fits.

## Evolution
- 2–3 inflection points where the concept was adapted, redefined, or expanded.
- Dated bullets, oldest first. Cite each.

# Best Real-World Examples
- 5–7 one-line bullets, each naming a service, product, organization, or research finding that exemplifies the concept.
- Use `[Name](url)` form for the entity name in each bullet.

# Case Studies
- 2–3 paragraph-length narratives going deeper than the Examples bullets above.
- Each case study explains: who, when, what they did, what changed, what it shows about the concept.
- Cite each factual claim.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for tuning notes, prior outputs, or examples while iterating on the template.
