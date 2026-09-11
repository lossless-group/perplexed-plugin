---
title: "Plan — Outline Shaping and Adherence Modes"
lede: "Hand-author an outline into a market map today and the plugin appends the draft below it instead of following it."
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
site_uuid: 218772c0-8f50-4fc4-a5da-4b1a96c7fb94
hex_code: rbiq26
applies_to: perplexed Obsidian plugin
tags:
  - Plan
  - Perplexed
  - Directory-Templates
  - Outlines
  - Prompt-Engineering
  - Market-Maps
related:
  - "[[Using-Files-as-Prompt-Outlines]]"
  - "[[Partials-And-Preambles-For-Perplexed-Templates]]"
  - "[[2026-09-10_Exa-Retrieval-Stage-and-Include-Sources]]"
  - "[[2026-09-10_Section-Refresh-and-Source-Curation]]"
summary: "Implementation plan for per-file outlines that shape a single directory-template run, plus a three-way adherence toggle (hard-follow / include-but-don't-limit / loose-suggestion) shipped as vault-editable partials. Documents the fill-vs-append bug that currently strands a hand-authored outline, specifies the three-tier outline resolution order, and explains why adherence rides the existing preamble machinery instead of new prompt-assembly code. Supersedes the ambitions of the early Using-Files-as-Prompt-Outlines spec, most of which the template system already absorbed."
---

# Plan — Outline Shaping and Adherence Modes

## Why care

The `market-map-profile` template produces a very good analyst draft, and the reason
it does is the heading skeleton below its ```cft``` fence — that skeleton *is* an
outline, and Perplexity follows it closely. But the skeleton is shared by every file
matching `applies-to-paths: ["market-maps/**"]`. There is no way to say "for *this*
map, I want these seven sub-segments in this order, and I want you to treat that as
binding" without editing the template that every other map also uses.

Worse, the obvious move fails silently. `applyTemplate` decides fill-vs-append by
whether the target body is empty:

```ts
const mode = existingBody.trim().length === 0 ? 'fill' : 'append';
```

So a hand-authored outline in the target file makes the body non-empty, the run
switches to append mode, and **the draft gets written underneath the outline instead
of following it.** The outline is stranded as dead prose above a draft that ignored
it. That is the bug this plan fixes first.

Second, even with an outline in hand there's no way to say how binding it is. The
three modes are not a nicety — they're three genuinely different research tasks:

- **Hard follow** — the outline is a contract. Useful when the map has to line up
  with a deck, a prior map, or a partner's expectations.
- **Include but don't limit** — every named section must appear, and the model may
  add sections where the research warrants. The default for real analyst work.
- **Loose suggestions** — shape and emphasis only. Useful for a first pass on a
  market you don't know well enough to outline confidently.


## Findings

Established by reading the current source on 2026-09-10.

### The fill-vs-append bug is real and silent

`applyTemplate` sets `mode` from `existingBody.trim().length === 0`. A hand-authored
outline in the target file makes the body non-empty, so the run takes the `append`
branch, `initialContent` becomes `frontmatter + existingBody + blank lines`, and the
generated draft is concatenated **below** the outline.

Nothing errors. The user gets a complete, well-cited draft that ignored the outline
they wrote, sitting under the outline they wrote. The most likely reading of that
output is "the adherence setting didn't work" — which is why this bug needs fixing
before the adherence modes ship, or the modes will be blamed for it.

### Prior art is largely superseded, but not by this plan alone

[[Using-Files-as-Prompt-Outlines]] (2026-05-02) predates the directory-template
system. Of its proposals: outline-as-vault-file, config frontmatter, and a body of
level-2-or-deeper headings are all now provided by templates themselves. What has
never been built is the per-*target* outline — the thing that shapes one file's run
without editing the shared template.

Its one durable technical claim is worth carrying forward verbatim: **no level-1
headings in an outline body**, because they collide with the model's own nesting of
the response. The three adherence partials should restate this rather than assume it.

Note the file's `status:` has not been touched — per the drift policy, promoting it to
`Superseded` is a decision for the user, not a side effect of writing this plan.

### Adherence has a natural home in machinery that already exists

The partials system shipped: `expandIncludes()` with depth and cycle guards,
`BUNDLED_PREAMBLES` with vault-first / bundled-fallback resolution, and a seeder that
writes defaults into `zz-cf-lib/` without clobbering user edits. Three adherence
partials drop into that with no new prompt-assembly code.

This matters beyond convenience: it means the operator can **edit the wording of the
adherence contract itself** without a plugin release. If "hard follow" isn't strict
enough in practice, that is a one-line vault edit, not an issue filed against the
plugin.

## Relationship to prior art

[[Using-Files-as-Prompt-Outlines]] (2026-05-02) proposed outlines as standalone vault
files with their own frontmatter and provider declarations, plus two new commands.
Most of that ambition was absorbed by the directory-template system that shipped
after it — templates already are vault files with config fences and heading
skeletons. What survives from the old spec and is still wanted is the narrow part:
**a per-target outline, resolvable from a file, that shapes one run.** This plan
implements that and lets the older spec be marked superseded.

## Design

### Outline resolution — three tiers, first hit wins

1. **A `cf-outline` fenced block in the target file body.** Inline, visible, edited
   in place next to the work.
2. **A `cf_outline:` frontmatter key** naming a vault path. For an outline reused
   across several maps, or one long enough to be its own document.
3. **The template's user skeleton** — today's behavior, unchanged.

Both new tiers matter and they're about twenty lines apart in implementation, so
build both rather than picking.

### The fill-vs-append fix

The empty-body check must exclude the `cf-outline` fence. Concretely: strip the fence
from `existingBody` *before* the `.trim().length === 0` test, so a file containing
only an outline is still `fill` mode.

Then decide what happens to the fence after a successful run. Three options, and this
needs a call before implementation:

- **Preserve it above the draft** — provenance stays visible, file is noisier
- **Move it below a `***` divider** — mirrors the template's own scratch convention
- **Strip it, having stamped `cf_outline_used:` into frontmatter** — cleanest file,
  provenance lives in metadata

Lean toward preserving, because the whole revision arc
([[2026-09-10_Section-Refresh-and-Source-Curation]]) wants the outline still present
when a section is refreshed later.

### Adherence modes as partials, not code

The three modes ship as three bundled partials under `src/docs/partials/`:

- `outline-adherence-strict.md`
- `outline-adherence-inclusive.md`
- `outline-adherence-loose.md`

They are seeded into `zz-cf-lib/partials/` like every other partial, which means the
user can *edit the wording of the adherence contract itself* without a plugin
release. That is the whole reason to do it this way rather than as string constants —
it matches the doctrine already established in
[[Partials-And-Preambles-For-Perplexed-Templates]], where the entire point was that
shared prompt rules must be vault-visible.

The selected partial splices into the user prompt immediately before the outline
block, so the instruction and the thing it governs are adjacent.

### Selecting a mode

Precedence, most specific wins:

1. Run-modal dropdown (per-run override)
2. `cf_outline_adherence:` in the target file's frontmatter
3. `outline-adherence:` in the template's cft fence
4. Plugin default setting (ship as `inclusive`)

UI labels use the operator's vocabulary, not the slugs: "Hard follow — the outline is
a contract", "Include but don't limit — every section, plus what the research
warrants", "Loose suggestions — shape and emphasis only".

## Steps

1. **Fix the empty-body check** so a `cf-outline` fence doesn't force append mode.
   This is the load-bearing bug; it is worth landing on its own.
2. **Outline resolution** — `resolveOutline(app, target, template)` returning
   `{ text, source: 'fence' | 'file' | 'skeleton' }`. The `source` field feeds the
   frontmatter stamp and the run Notice.
3. **Three bundled partials** + `BUNDLED_PARTIALS` registration + seeder coverage.
4. **Mode selection chain** and `outline-adherence:` cft key parsing.
5. **Run-modal dropdown**, defaulted from the resolved chain and labeled in operator
   vocabulary. `DirectoryTemplateRunModal` already carries template and model
   selectors; this is a third `Setting`.
6. **Prompt assembly** in `applyTemplate` — splice adherence partial, then outline,
   in place of the skeleton when an outline resolved.
7. **Frontmatter stamps** — `cf_outline_used:`, `cf_outline_adherence:` so a finished
   map records how it was shaped.
8. **Docs** — `docs/directory-templates.md` gets an Outlines section; mark
   [[Using-Files-as-Prompt-Outlines]] superseded by this plan.

## Verification

- A file containing only a `cf-outline` fence runs in `fill` mode, not `append`.
- Strict mode on a seven-section outline returns exactly seven H1s, in order.
- Inclusive mode on the same outline returns at least those seven and marks additions.
- Loose mode departs from the outline without being penalized as a failure.
- A template with no outline anywhere behaves byte-identically to today.

## Open items

- [ ] Post-run disposition of the `cf-outline` fence — preserve / move / strip.
      Leaning preserve; decide before step 6.
- [ ] Should an outline be able to carry per-section instructions (bullets under each
      heading, like the template skeleton does), or is it headings-only? Headings-only
      is simpler; per-section bullets make the outline a full local template override
      and start to overlap with the section-refresh plan.
- [ ] Whether strict mode should *post-validate* the returned headings against the
      outline and warn on mismatch, or trust the prompt. Post-validation is cheap and
      turns a soft failure into a visible one.
