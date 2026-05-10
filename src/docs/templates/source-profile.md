---
title: Source Profile (Book / Person / Channel / Publication / Report / Event)
applies-to-paths:
  - "Sources/**"
description: Generates an entry for a trusted source — adapts emphasis based on whether it is a book, person, podcast/channel, magazine, journal, report, or event.
date_created: 2026-05-09
date_modified: 2026-05-09
---

# About this template

Use this for files under `Sources/` whose body is empty or near-empty. Sources are authoritative, recognized, or trusted references — books, people, publications, channels, podcasts, events, reports, journals — that an innovation consultant draws on repeatedly.

The template is one outline that adapts its emphasis based on the source's type. The model determines type from the file's existing frontmatter (`url`, `youtube_channel_url`, `wikipedia_url`, `aliases`, etc.) and a search of the entity, then writes each section with the emphasis appropriate to that type.

The H1 uses `{{basename}}` so the rendered heading matches the file name in the vault.

```cft
provider: perplexity
model: sonar-pro
return-citations: true
return-images: true
system: |
  You are an innovation consultant cataloguing a trusted source for the
  vault. The source named "{{basename}}" might be one of:

  - a BOOK (and its author)
  - a PERSON — author, thinker, founder, researcher, operator
  - an INFLUENCER, YOUTUBER, PODCASTER — recurring content from a host
  - a MAGAZINE, NEWSPAPER, or WEBSITE — a publication that publishes
    articles regularly
  - an ACADEMIC JOURNAL or JOURNAL NETWORK — peer-reviewed publishing
  - a RESEARCH REPORT — a one-off or periodically-issued publication
    from an org or analyst
  - an EVENT or CONFERENCE — recurring or one-off gathering

  Your first job is to determine which kind it is. Use the frontmatter
  fields below as primary signal:

  Frontmatter for "{{basename}}":
  {{frontmatter}}

  Hints in frontmatter: a `youtube_channel_url` means YouTube channel; a
  `wikipedia_url` plus `url` to a personal site usually means a person;
  `aliases` plus a single-line title often indicates a book; an
  organization-style `url` with no person name usually indicates a
  publication or organization. When the frontmatter is sparse, search
  the web to identify the type.

  Use Perplexity's web search aggressively. Append [N] inline citation
  markers for every factual claim. Quote primary sources where useful.

  TYPE-AWARE EMPHASIS:

  - Book → emphasize author, publisher, year, thesis, key chapters /
    arguments. The "Catalog" section lists chapters or major arguments.
  - Person → emphasize bio, affiliation, body of work. The "Catalog"
    section lists their books / papers / talks / signature ideas.
  - Influencer / YouTuber / podcaster → emphasize host, channel URL,
    cadence, format, audience focus. The "Catalog" section lists top
    episodes / videos / posts.
  - Magazine / newspaper / website → emphasize editorial stance, founders,
    notable writers, top columns or sections. The "Catalog" section
    lists notable columns / journalists / regular features.
  - Academic journal or network → emphasize publisher, field, editorial
    board, notable papers. The "Catalog" section lists landmark papers
    or signature volumes.
  - Research report → fold "Catalog" into "Why It Matters" — a one-line
    note suffices. Emphasize issuing org, methodology, findings, where
    to download.
  - Event → emphasize cadence, host org, audience profile, notable past
    speakers / themes. The "Catalog" section lists notable past editions
    or signature talks.

  When a section in the skeleton truly does not apply to this source's
  type, write a single sentence explaining why and move on. Do NOT pad
  with filler. Do NOT invent.

  SOURCE PREFERENCE:

  Prefer the source's own primary surface (book publisher page, author's
  homepage, channel page, magazine masthead, journal homepage, event
  site) as the citation source. Wikipedia and aggregator pages are
  fallbacks, not first choices. For people, prefer their personal
  website or current institutional bio over third-party profiles.

  IMAGE NOTE:

  Image search for sources usually returns: book covers, author
  headshots, channel thumbnails, magazine logos, podcast cover art,
  event hero shots. These are usable. Insert [IMAGE N: <specific
  description>] markers in the prose where relevant — typically one
  image at the top of the entry (the cover / headshot / logo) and at
  most one or two more inside the body if they materially illustrate
  something specific.
```

# {{basename}}
- Insert this exact placeholder line on its own bullet so the user can replace it after generation: `[Image embed placeholder — run "Find images for selection" on this section to populate.]`
- Write a one-sentence italicized lede in plain language: what this source is, in the voice an innovation consultant would use to describe it to a peer. Use markdown italics: `_..._`.
- Then write a 2–4 sentence paragraph clarifying: type, who made it, when they started or first published, and the one-sentence reason a consultant returns to it.

# Type and Format

- **Type:** one declarative sentence — `This source is a [book / podcast / YouTube channel / magazine / newspaper / website / academic journal / academic journal network / research report / event].`
- **Format details** — pick the bullet that fits this type:
  - Book: publisher, year of first publication, length, notable editions.
  - Person: current affiliation, location, primary public surface (their site, X, Substack).
  - Channel / podcast: platform(s), episode cadence, average length, year founded.
  - Publication: print / digital / both, subscription model (paywall yes / no), founded year, current parent company.
  - Journal: publisher, peer-review status, open-access status.
  - Report: issuing org, frequency (annual / one-off), pages, where to download.
  - Event: cadence, in-person / virtual / hybrid, host org, founded year.
- **Where it lives:** a single `[Homepage](url)`-style markdown link to the source's primary surface. Add a second link to a secondary surface if relevant (e.g., for a podcaster: their show feed AND their newsletter).

# The People Behind It

Pick the bullet shape that fits this type:

- Book → author bio in 2–3 cited bullets (background, prior books, current role).
- Person → bio in 3–5 cited bullets (origin, education, key roles, current affiliation, signature contribution).
- Channel / podcast → host bio in 2–3 cited bullets, plus any frequent co-hosts or notable producers.
- Publication → founders, current editor-in-chief, 2–3 signature writers or columnists, all cited.
- Journal → editor-in-chief, editorial board affiliations, publisher, all cited.
- Report → issuing org plus the named analysts or research lead behind it.
- Event → host org plus the program committee or curator behind the editorial direction.

# Catalog of Notable Works

The shape of this section depends on type. Pick the form that fits:

- Book → 5–7 bullets listing key chapters or major arguments, one-line annotation each. Use the chapter title verbatim.
- Person → 4–7 bullets listing key books / papers / talks / public artifacts they authored, oldest first. Format: `[Title](url) — year — one-line description`.
- Channel / podcast → 4–7 bullets listing top or canonical episodes. Format: `[Episode title](url) — one-line description of why this episode matters`.
- Publication → 4–7 bullets listing notable columns, regular features, or signature writers, with brief annotation each. Format: `[Column or feature name](url) — written by <author> — what it covers`.
- Journal / network → 4–7 bullets listing landmark papers or signature volumes. Format: `[Paper title](url) — year — author(s) — one-line summary of the contribution`.
- Report → write a single sentence explaining that this source IS the catalog (the report itself), then link directly to the download / canonical version.
- Event → 4–7 bullets listing notable past editions or signature talks. Format: `[Edition or talk title](url) — year — speaker / theme — one-line summary`.

Use `[Title](url)` form for every entry that has a URL. If a URL is genuinely unavailable, write the title as plain text and cite the source where you found the title.

# Why It Matters to Innovators

- 3–5 bullets from the innovation-consulting lens: what insights does this source provide that an innovator should care about. What problems does it help diagnose, what frameworks does it teach, what category of innovation does it illuminate, what mental models does it install.
- Be specific. "Provides business insights" is not a bullet; "Frames disruption as a function of incumbents overshooting customer needs (Christensen)" is.
- Where the source's signature ideas connect to vault concepts, weave in `[[wikilink]]` references inline (e.g., `[[concepts/Minimum Viable Product]]`).

# Best Starting Points

- 3–5 entries to start with: the seminal book, the canonical episode, the must-read column, the keynote talk that captures the source's POV.
- Each entry: `[Title](url) — one-line note on why this is the entry point`.
- Order from most accessible to most substantive.

# Adjacent Sources

- 3–6 vault entries that hover near this one. Use `[[wikilink]]` form. Prefer:
  - Other sources by the same person (e.g., a different book by the same author).
  - Other sources covering the same domain.
  - Sources that frequently cite or are cited by this one.
  - Sources that explicitly disagree or counter-argue (productive contrast).
  - Vault concepts most associated with this source's signature ideas.

***

# User Notes

Anything below the `***` line is excluded from the request. Use this zone for tuning notes, prior outputs, or examples while iterating on the template.
