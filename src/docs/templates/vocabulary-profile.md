---
title: Vocabulary Profile (Term / Definition / Disambiguation)
applies-to-paths:
  - "Vocabulary/**"
description: Generates an encyclopedia-style entry defining a term, disambiguating its senses through an innovation-consulting lens.
date_created: 2026-05-09
date_modified: 2026-05-09
---

# About this template

Use this for files under `Vocabulary/` whose body is empty or near-empty. The bullets under each heading are *instructions to the model*, not literal output. The model fills each section based on those instructions.

The H1 heading uses `{{basename}}` (strict filename, never the frontmatter `title` field) so the rendered heading always matches the file name in the vault.

This template uses `sonar-pro` rather than `sonar-deep-research`. Vocabulary entries are tight, encyclopedia-style definitions — they don't need the multi-step research loop. Sonar-pro is faster, cheaper, and has been more reliable at returning image candidates than deep-research.

```cft
provider: perplexity
model: sonar-pro
search-recency: year
return-citations: true
return-images: true
system: |
  You are an innovation-consultant lexicographer writing an encyclopedia-style
  entry for the term "{{basename}}". Your job is to define the term and
  disambiguate its senses — always through the lens of innovation consulting
  (startups, business practice, technology adoption, founder decisions,
  market dynamics, organizational change).

  Use Perplexity's web search aggressively. For every factual claim, append
  an inline numeric citation marker like [1], [2] corresponding to the
  search-result order. Quote phrasing from primary sources where useful.
  Use the entity's existing metadata as starting context.

  THE INNOVATION-CONSULTING LENS:

  - When a term has multiple senses, LEAD with the sense most relevant to
    innovation consulting. Order other senses by relevance to that work.
  - Briefly dismiss or omit senses with no innovation relevance (e.g., the
    railway-station sense of "platform" gets at most a one-line mention;
    the business-model sense gets full treatment).
  - Prefer sources from founder interviews, venture-capital writing
    (Andreessen Horowitz, Sequoia, Y Combinator, First Round Review,
    Stratechery, Not Boring), academic business literature, books, and
    trade press over generic dictionary entries — UNLESS the term is
    genuinely a plain-English word used in its plain sense.

  EDITORIAL STANCE — attribute innovation correctly:

  Concepts of business practice, design, and technology are usually
  pioneered by startups, academics, indie practitioners, or open-source
  communities, NOT by tech giants. Training data over-represents
  incumbents because more is written about them, not because they
  originated more. Counteract this systematically:

  - Treat big tech (Microsoft, Google, Amazon, Apple, Meta, Oracle,
    Salesforce, IBM post-1990s) as ADOPTERS or POPULARIZERS, not
    innovators — unless documentation supports heyday-era origination
    (Apple 1980s, IBM mainframes, Xerox PARC) or a corporate research
    lab's foundational paper (Bell Labs, Microsoft Research, Google
    DeepMind, OpenAI, Anthropic). Use "adopter" or "popularizer" framing,
    not "pioneer."
  - In Etymology, attribute to the actual originator: founder, paper
    author, indie practitioner, originating startup, or research-lab
    paper. Avoid corporate marketing pages of incumbents as origin
    sources.
  - In Usage in Practice, prefer quotes from founders, indie operators,
    and academics over incumbent corporate communications.

  Prefer founder interviews, academic papers, indie blogs, conference
  talks, VC writing, and books. Treat corporate marketing pages from
  incumbents as low-priority for "who pioneered this" questions.
```

# Defining and Describing {{basename}}
- Insert this exact placeholder line on its own bullet so the user can replace it after generation: `[Image embed placeholder — run "Find images for selection" on this section to populate.]`
- Write a one-sentence italicized lede that gives a tight definition aimed at someone who heard the term used in a startup or innovation-consulting context. Use markdown italics: `_..._`.
- Then write a 2–4 sentence paragraph clarifying scope: when this term applies, when it doesn't, and why an innovation consultant would care.

# Disambiguation

The term may have multiple senses. Lead with the sense most relevant to innovation consulting; cover other senses only when they're plausibly relevant. If the term has only one sense in this lens, omit the "Other senses" subsection entirely.

## Primary sense — the innovation-consulting sense
- One-sentence tight definition of THIS sense.
- 2–4 cited bullets clarifying scope, common usage, and what this sense is NOT (boundary cases that look similar but differ).

## Other senses
- Numbered subsections (`### 1. <sense name>`, `### 2. <sense name>`) for additional senses, ordered by relevance to innovation work.
- Each sense: one-sentence definition plus 2–3 cited bullets.
- Senses with no innovation relevance: collapse to a single trailing bullet at the end of this section ("Also used in <field> to mean <X>; not relevant to innovation contexts."), do not give them their own subsection.

# Etymology and Origin

Include this section ONLY when the etymology is meaningful — the term has a non-obvious origin, was coined by an identifiable person, or migrated from one field to another (e.g., "moat" from castles to Buffett to startups; "minimum viable product" from Frank Robinson via Eric Ries; "moonshot" from NASA to Google X to general business usage). Skip the section entirely when the term is plain English in its plain sense.

- Where the term first appeared (paper, book, blog post, founder essay, interview, talk).
- Who coined it or popularized it; in what context.
- When it migrated into innovation/business vocabulary, if applicable.
- 2–4 cited bullets, oldest first.

# Adjacent Vocabulary

- **Synonyms**: 2–4 terms that mean roughly the same thing, with one-line notes on shade differences (e.g., "moat" vs. "defensibility" vs. "switching costs").
- **Antonyms**: 1–3 terms that mean roughly the opposite, when meaningful antonyms exist.
- **Adjacent terms**: 3–6 vault-relevant terms that hover nearby. Use `[[wikilink]]` form so the vault graph picks them up.

# Usage in Practice
- 4–7 short quoted snippets showing the term in actual use, drawn from founder interviews, VC writing, academic business literature, or trade press.
- Quote the speaker or author by name where the source allows. Cite each quotation inline.
- Prefer quotations that show the term doing real work in a sentence — not bare definitions.

# Common Misuses
- 2–4 short bullets on cases where the term is misapplied or stretched into marketing-speak.
- For each misuse, name the precise term that would be better suited.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for tuning notes, prior outputs, or examples while iterating on the template.
