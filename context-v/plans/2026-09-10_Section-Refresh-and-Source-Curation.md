---
title: "Plan — Section Refresh and Source Curation"
lede: "Reshape one sub-segment, reject a weak source and make the web find a better one — without regenerating the whole map."
publish: true
status: Draft
date_created: 2026-09-10
date_modified: 2026-09-10
date_authored_initial_draft: 2026-09-10
date_authored_current_draft: 2026-09-10
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
at_semantic_version: 0.0.0.2
site_uuid: 3ced294f-4bec-4116-bd15-c47797df2731
hex_code: kcszzs
applies_to: perplexed Obsidian plugin
tags:
  - Plan
  - Perplexed
  - Directory-Templates
  - Revision-Workflow
  - Source-Curation
  - Market-Maps
related:
  - "[[2026-09-10_Run-Snapshots-and-Restore]]"
  - "[[2026-09-10_Outline-Shaping-and-Adherence-Modes]]"
  - "[[2026-09-10_Exa-Retrieval-Stage-and-Include-Sources]]"
  - "[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]]"
summary: "Implementation plan for revising a generated document in place: refresh one heading-delimited section against its template instructions, and curate the sources footer so rejected sources are denylisted and replaced on re-run. Realizes the exploration's deferred Option C without needing cft-section blocks, because the template skeleton already carries per-heading instructions. Depends on the snapshots plan; names the byte-range replacement, source-footer merge, and citation-renumbering hazards that make this the largest chunk of the revision arc."
---

# Plan — Section Refresh and Source Curation

## Why care

A market map is 6–8K words across 4–8 sub-segments. When one sub-segment is wrong —
the segmentation is off, two innovators are actually the same company, a funding
figure came from a content farm — the only move available today is to regenerate the
entire document. That costs a forty-minute deep-research run, real money, and every
good paragraph in the other seven sub-segments.

The two operations that would make revision routine:

- **Refresh one section.** Re-run research for a single heading, with an optional
  instruction ("split this into hardware and orchestration", "add three more seed-stage
  names", "the Databricks entry is wrong, drop it"), and replace only that section.
- **Curate sources.** Look at what the footer actually cites, reject the sources that
  don't deserve to be there, and have the next run find replacements rather than
  re-citing the same weak page.


## Findings

Established by reading the current source on 2026-09-10.

### The per-section contract already exists — it just isn't indexed

This is the finding that shrinks the plan from "design a new schema" to "index what's
there."

`loadTemplate()` splits a template into a ```cft``` config block and a `userSkeleton`
— everything between the fence and the `***` scratch terminator. That skeleton is not
a list of bare headings. In `market-map-profile.md`, `# Innovator Profiles` is
followed by a full paragraph of card-shape rules, ordering instructions, and a summary-
table spec. Every section carries its own instructions already.

The exploration deferred Option C because embedding ```cft-section``` blocks per
section looked like over-design. It was right — and the reason it was right is that
those blocks would have duplicated instructions the skeleton already holds. Matching a
target heading back to its skeleton heading recovers the section contract for free.

### Domain rejection is already plumbed end to end

`parseDomainList()` reads both the template's `search-domains:` and the target file's
`cf_search_domains:` frontmatter, treats a leading `-` as a denylist entry, merges with
the built-in `JOB_BOARD_DENYLIST`, dedupes, and truncates to `SEARCH_DOMAIN_CAP`
before setting `search_domain_filter` on the payload.

So "reject this source" needs no new API plumbing — it needs a modal that writes
`-domain` into the target's frontmatter. The mechanism underneath is shipped and
exercised.

### The 10-domain cap is what forces a second rejection record

`SEARCH_DOMAIN_CAP = 10` is Perplexity's hard limit, and `parseDomainList`'s merge
order means declared entries win over the built-in denylist on truncation. On a
heavily curated document the eleventh rejection silently evicts an earlier one, and
the previously-rejected source becomes citable again without anything indicating it.

Hence `cf_rejected_sources:` as a durable record independent of the active filter, and
hence Exa's 1200-entry `excludeDomains` as the real escape hatch — see the Findings in
[[2026-09-10_Exa-Retrieval-Stage-and-Include-Sources]].

### The footer is rebuilt wholesale, which is the merge hazard

`buildSourcesFooter(sources)` renders one run's `search_results` array into a fresh
footer, and `applyTemplate` concatenates it onto the end of the document. There is no
notion of merging into an existing footer, and no stable delimiter marking where the
footer begins.

Both are prerequisites for section refresh: without a parseable fence the curation
modal cannot find the sources, and without merge semantics a refresh either destroys
the other sections' citations or duplicates the whole footer. This is the fiddliest
work in the plan and the most likely place for a subtle, plausible-looking wrong
citation to survive review.

## Relationship to prior art

[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]] mapped three options and
deferred Option C — per-section ```cft-section``` blocks embedded in the template —
as "the right generalization and also the right way to over-design."

That judgment holds for the *template* half and dissolves for the *target* half.
The insight that makes this tractable: **the template skeleton already carries
per-heading instructions.** `market-map-profile.md` has a `# Innovator Profiles`
heading with a full paragraph of shape rules under it. Refreshing the target's
`# Innovator Profiles` section means matching that heading back to the skeleton and
reusing the instructions already written there.

So no new `cft-section` schema, no per-section prompt blocks in the template file, no
multi-block parser. The section contract that Option C would have introduced already
exists — it just was never indexed by heading.

## Design

### Section refresh

**Command: "Refresh section under cursor."**

1. Snapshot (per [[2026-09-10_Run-Snapshots-and-Restore]], reason `section-refresh`).
2. Parse the target body into heading-delimited sections. Templates use H1 for
   top-level sections and H2 for sub-segments, so the parser must let the user pick
   the granularity — refreshing `## Neuromorphic Hardware` inside
   `# Innovator Profiles` is the common case, not the exception.
3. Identify the section containing the cursor; confirm it in a modal that also takes
   a free-text revision instruction.
4. Match the section heading against the template skeleton to recover its
   instructions. On no match — the model invented a section, or the user renamed one —
   fall back to the parent section's instructions and say so in the modal.
5. Build a prompt: system preambles + template system + a new
   `section-revision` preamble + the section's instructions + the user's revision note
   + **the rest of the document as read-only context**.
6. Stream to a scratch buffer, not the target.
7. Replace the section's byte range in the target. Merge sources. Stamp frontmatter.

### The hazards

**Byte-range replacement against a live file.** The user may edit the document while
a deep-research refresh runs for several minutes. Re-locate the section by heading
text at write time rather than trusting offsets captured at read time, and abort with
a Notice if the heading is gone. Never write a stale offset.

**Source-footer merge, not replace.** A refresh returns its own `search_results`
array. Those sources must be *merged* into the existing footer — deduplicated by URL,
appended, and the section's inline citation markers renumbered to match their new
positions. `buildSourcesFooter` currently rebuilds the footer wholesale from one
run's results; it needs to become merge-aware. This is the fiddliest part of the plan
and the most likely source of subtle wrongness, because a mis-renumbered citation
looks correct and points at the wrong document.

Suggested containment: the refreshed section's sources get appended to the footer and
the section's markers are rewritten in one pass over that section only. Other sections
keep their existing numbering untouched, which means the footer is append-only and
existing markers never shift.

**Context budget for the read-only document.** Sending a full 8K-word map as context
for every section refresh is expensive and dilutes attention. Default to sending the
document's *heading structure* plus the target section's current content, with a
setting to send the full body when cross-section consistency matters.

### Source curation

**Command: "Curate sources for this file."**

The footer is machine-written, so give it stable parseable markers first — an HTML
comment fence around the sources block. Then:

1. Modal lists each cited source: marker, title, domain, and which sections cite it.
2. Keep / reject per source.
3. Rejecting writes the domain into the target's `cf_search_domains:` as a `-domain`
   entry — a mechanism that **already works end to end** via `parseDomainList` →
   `search_domain_filter`, capped at Perplexity's 10 domains.
4. Rejected sources are also recorded in `cf_rejected_sources:` with the URL and a
   timestamp, so the rejection survives even when the 10-domain cap pushes the entry
   out of the active filter.
5. Kept sources can be **pinned** — promoted into `include-sources:` via the Exa
   plan's resolver, so a re-run treats them as canonical rather than re-discovering
   them.

The Perplexity 10-domain cap is the real constraint on rejection-driven replacement,
and it is why `cf_rejected_sources:` exists separately from `cf_search_domains:`.
Where the cap bites, Exa's `excludeDomains` (1200 entries) is the escape hatch — a
further argument for routing retrieval through Exa on documents that get curated
heavily.

## Steps

1. **Section parser** — heading-delimited, granularity-aware, returns ranges plus
   heading text for re-location.
2. **Skeleton heading index** — map template skeleton headings to their instruction
   blocks; parent fallback on no match.
3. **`section-revision` bundled preamble** — the "you are revising one section of an
   existing document, do not restate the rest, match the surrounding voice" contract.
4. **Refresh modal** — section confirmation, revision instruction field, model
   selector, full-body-context toggle.
5. **Scratch-buffer streaming + safe byte-range replacement** with heading
   re-location at write time.
6. **Merge-aware sources footer** with the fenced markers and append-only numbering.
7. **Curation modal** and the `cf_rejected_sources:` / pinning wiring.
8. **Docs** in `docs/directory-templates.md`.

## Verification

- Refreshing one H2 leaves every other section byte-identical.
- Editing the document during a long refresh either lands correctly or aborts
  cleanly — never writes to the wrong range.
- Merged footer has no duplicate URLs, and every inline marker in the refreshed
  section resolves to the right footer entry.
- Markers in *unrefreshed* sections still resolve correctly after a merge.
- A rejected domain does not appear in the next run's sources.
- Rejections survive past the 10-domain cap via `cf_rejected_sources:`.

## Open items

- [ ] Whether refresh should offer a Claude editorial pass on the refreshed section
      (the `editor:` stage from the exploration), or stay Perplexity-only for v1.
      Perplexity-only is the smaller build and the exploration's own recommendation.
- [ ] Whether to support refreshing a *range* of sections in one command, or require
      one at a time. One at a time is safer and probably sufficient.
- [ ] Whether the append-only footer numbering degrades legibility badly enough over
      many refreshes to warrant a "renumber all citations" maintenance command.
