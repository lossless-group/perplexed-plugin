---
title: Source Profile (Person / Publication / Channel)
applies-to-paths:
  - "Sources/**"
description: Generates a structured profile for a source — person, publication, or channel.
---

# About this template

Use this for files under `Sources/` whose body is empty or near-empty. The bullets under each heading are model-facing instructions, not literal output.

```cft
provider: perplexity
model: sonar-deep-research
search-recency: month
return-citations: true
return-images: false
system: |
  You are filling out a structured profile for the source named "{{title}}".
  Existing metadata:
  {{frontmatter}}
  Follow the heading skeleton and per-section bullet instructions in the
  user prompt. Use inline citations. Prefer first-party sources.
```

# Identity
- One paragraph summarizing who or what this source is.

## Type
- Person, publication, podcast, YouTube channel, newsletter, organization, etc. Pick one.

## Reach / Audience
- Estimated audience size, geography, and primary platforms. Cite sources where possible.

# Topical Coverage

## Primary Beats
- 3–6 topics this source covers regularly. One bullet each.

## Notable Recent Pieces
- 5 most-cited or most-relevant pieces from the past 12 months. Title, date, URL.

# Track Record
- Brief assessment of credibility and editorial style. Two short paragraphs.

## Known Biases or Editorial Stance
- Disclosed funding, ownership, or political stance if any.

# Adjacent Sources
- 3–5 sources that cover similar ground from different angles.

***

# User Notes

Authoring scratch zone — not sent to the model.
