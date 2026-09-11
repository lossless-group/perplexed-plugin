---
title: "Plan — Vault-Aware Linking in Both Directions"
lede: "Generated notes arrived orphaned, and the templates forbade linking rather than risk a model inventing a path."
publish: true
status: Shipped
date_created: 2026-09-11
date_modified: 2026-09-11
date_authored_initial_draft: 2026-09-11
date_authored_current_draft: 2026-09-11
date_first_published: 2026-09-11
date_work_started: 2026-09-10
date_work_completed: 2026-09-11
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
at_semantic_version: 0.1.0.0
site_uuid: 0f2cd4de-0a82-44af-a48b-2002bd954a8e
hex_code: y509zs
applies_to: perplexed Obsidian plugin
tags:
  - Plan
  - Perplexed
  - Wikilinks
  - Knowledge-Graph
  - Directory-Templates
  - Retroactive
related:
  - "[[2026-09-10_Exa-Retrieval-Stage-and-Include-Sources]]"
  - "[[2026-09-10_Section-Refresh-and-Source-Curation]]"
  - "[[2026-09-11_02]]"
summary: "Retroactive plan for the vault-linking work shipped in dbe6b25 — written after the fact so the feature is tracked like its siblings rather than living only in a changelog entry. Covers both directions: include-backlinks: feeds real vault paths into generation so a draft can link back, and the Link back to vault notes command bulk-converts unlinked mentions in existing notes behind a human review table. Records the API choice (resolvedLinks over the undocumented getBacklinksForFile), the absolute-path link format the published sites depend on, the confidence tiers that keep common words from being linkified, and the inbound/outbound conflation that cost a detour mid-session."
---

# Plan — Vault-Aware Linking in Both Directions

> **Written retroactively.** This feature shipped in `dbe6b25` before it had a
> plan document, unlike the four drafted on 2026-09-10. Recorded here so it is
> tracked like its siblings, and because the inbound/outbound distinction is
> exactly the kind of thing that gets re-conflated six months later.

## Why care

Two problems that look unrelated and are the same problem.

**A generated note arrived orphaned.** Perplexed would produce an excellent
profile of a company that linked to nothing in the vault it was written into.
The standing instruction in `market-map-profile.md` and `toolkit-profile.md` was
literally *"Do NOT invent `[[wikilink]]` syntax"* — with the curator expected to
promote names to wikilinks by hand during a later pass. That rule was correct
given what the model knew: a model guessing vault paths produces broken links.
But the conclusion it forced — forbid linking entirely — meant every note had to
be hand-wired into the graph afterward.

**Existing notes were full of unlinked mentions.** Obsidian surfaces these in
its "Unlinked mentions" pane and has never offered to apply them. With ~1,180
notes in the vault and hundreds already drafted, the backlog is the larger half
of the problem, and it is not addressed by anything done at generation time.

The fix for the first is to stop withholding the paths. The fix for the second
is a bulk-convert with review.

## The distinction that matters

These are opposite operations and conflating them cost a real detour during the
session — a scan was built for the outbound direction while the request was for
the inbound one, and the fact that Obsidian calls the inbound pane "Linked
mentions" did not help.

| | Direction | Source of truth | What it does |
|---|---|---|---|
| `include-backlinks:` | **inbound** | `metadataCache.resolvedLinks` | Notes that link **to** this one, fed into generation as real paths |
| "Link back to vault notes" | **outbound** | the note's own prose | Titles of other notes found **in** this one, offered for linking |

The load-bearing consequence: **an inbound backlink usually does not appear as
text in the target note at all.** Four notes linking to `ThoughtSpot` contained
zero occurrences of their own titles in ThoughtSpot's body. So inbound links can
never be handled by text replacement — they are generation context, not a
find-and-replace. That is why the two halves are different mechanisms rather
than one shared one.

## Findings

Established while building, verified against the live vault.

### `resolvedLinks` over `getBacklinksForFile()`

The "Linked mentions" pane uses `app.metadataCache.getBacklinksForFile()`, which
is **absent from `obsidian.d.ts`** (checked against obsidian 1.12.3). Community-
plugin review flags undocumented API use, and this plugin is being prepped for
submission — see the submission-blocker plans.

`resolvedLinks` is documented and typed: `Record<source, Record<target, count>>`.
Backlinks are its inversion, which is O(files) over a map already held in memory.
No reason to reach for the internal API.

### The link format is load-bearing, and it is not the default

Links must be emitted vault-root-absolute with a display alias:

```
[[Tooling/Software Development/Programming Languages/Go|Go]]
```

This is Obsidian's "New link format: Absolute path in vault" setting, and the
published web renderings depend on it — a shortened link resolves in Obsidian
and breaks in production.

`fileManager.generateMarkdownLink()` honours that setting, so it would produce
the right output *today*. The links are built explicitly anyway, because output
that feeds published sites must not silently change shape if a vault preference
is toggled.

### Confidence tiers are not polish

A scan of a real note against 1,155 indexed vault notes returned eleven
candidates: seven correct (`Gartner Magic Quadrant`, `General Catalyst`,
`Geodesic Capital`, `Metabase`) and four noise (`backed`, `pivot`, `slide`,
`data infrastructure`).

`backed` is a genuine vault note **and** an ordinary English verb. So are `Hex`,
`Layer`, `Element` and `Go` — all real companies, all common words. Auto-linking
on title match alone would quietly corrupt prose at a rate that is invisible
until someone reads a sentence closely.

Hence: high confidence (exact case, and either multi-word or ≥6 characters)
starts **checked**; everything else starts **unchecked**. Clicking "Select all"
then Apply still cannot do damage, because the dangerous rows were never
pre-selected.

### Regions that must never be linkified

Code fences, inline code, existing wikilinks, markdown links, bare URLs,
footnote and reference definitions, headings (linking one breaks the TOC), and
everything from the generated `# Sources` heading down. Longest candidate wins,
so `Agentic Analytics` claims its span before `Analytics` can.

### The instruction for weaving, not listing

The first version of the inbound prompt produced a tidy list of every backlink
at the bottom of the note — the thing nobody reads. The instruction that
produced usable output names a count and bans the list shape:

> Work **ONE OR TWO** of them into your prose where they genuinely fit — inline,
> as part of a sentence you were going to write anyway. … Do NOT add a "Related
> notes" section, a bulleted list of links, or a See-also block. … Linking
> nothing is better than linking something irrelevant.

Result on a live Sintra run: *"…the same general space referenced in market-map
notes like `[[…|Agentic AI in Fintech]]`"* — a link in the middle of a sentence,
where a human would have put it.

## What shipped

- `src/services/linkBackService.ts` — outbound scan (`findLinkCandidates`,
  `applyLinkCandidates`), inbound lookup (`findBacklinks`,
  `renderBacklinksBlock`), and the shared `buildWikilink`.
- `src/modals/LinkBackModal.ts` + styles — the review table: checkbox, matched
  text, target note with full path, surrounding context, select-all/none, and a
  live count on the apply button.
- `include-backlinks:` / `backlinks-limit:` cft keys, wired into `applyTemplate`
  and enabled on `toolkit-profile`.
- The "Link back to vault notes" command.

## Remaining work

- **Aliases are read but untested.** `aliasesFor()` handles `aliases:` and
  `alias:` frontmatter, and candidates are tagged `via: 'alias'` in the table,
  but no vault note with aliases was exercised during the session.
- **`excludeRoots` is hardcoded** to `['zz-cf-lib']` in `DEFAULT_SCAN_OPTIONS`.
  It should be a setting — a vault with a large archive or daily-notes folder
  will want them excluded, and `minLength` / `includeLowConfidence` likewise.
- **No batch mode.** The outbound command runs on the active file only. The
  backlog it exists to clear is hundreds of notes, so a folder-scoped run with
  one review pass is the obvious next step.
- **The scan is synchronous over every markdown file.** Fine at 1,155 notes;
  unmeasured above that.
- **The templates still say "Do NOT invent `[[wikilink]]` syntax".** That rule
  is now wrong when `include-backlinks:` is on, and the prose in
  `market-map-profile.md` and `toolkit-profile.md` has not been updated to say
  so. Doing it needs care: the rule is still correct for notes the model was
  *not* handed a path for.
- **`include-backlinks:` is enabled on `toolkit-profile` only.**
  `market-map-profile` is the template that would benefit most — its whole
  Adjacent Concepts section exists because the curator has to wikilink by hand.

## Open items

- [ ] Should the outbound scan offer to create a note for a *high-confidence
      unresolved* mention — a term used repeatedly with no vault note behind it?
      That is closer to vault authoring than to linking; probably its own tool.
- [ ] Whether `include-backlinks:` should also surface **unresolved** links
      (`metadataCache.unresolvedLinks`) — notes that *tried* to link to this
      subject before the note existed. Cheap to add, unclear whether useful.
- [ ] Whether the one-or-two-links instruction should scale with document
      length. A 6,000-word market map can carry more than a 900-word toolkit
      profile without reading as link spam.
