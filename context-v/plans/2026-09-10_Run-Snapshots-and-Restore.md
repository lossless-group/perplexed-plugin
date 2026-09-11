---
title: "Plan — Run Snapshots and Restore"
lede: "Line 830 wipes the target before the first byte of the stream arrives. Nothing in the plugin can undo that."
publish: true
status: Partially-Shipped
date_created: 2026-09-10
date_modified: 2026-09-11
date_first_published: 2026-09-11
date_authored_initial_draft: 2026-09-10
date_authored_current_draft: 2026-09-10
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
at_semantic_version: 0.0.1.0
site_uuid: 8f7635e9-27e1-44ba-928f-9097b2e6ed64
hex_code: g4mier
applies_to: perplexed Obsidian plugin
tags:
  - Plan
  - Perplexed
  - Directory-Templates
  - Safety
  - Versioning
related:
  - "[[2026-09-10_Section-Refresh-and-Source-Curation]]"
  - "[[2026-09-10_Exa-Retrieval-Stage-and-Include-Sources]]"
  - "[[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]]"
summary: "Implementation plan for pre-run snapshots of every directory-template target plus a restore command, stored as visible markdown under the library root. The prerequisite for the whole revision arc — section refresh and source curation are only safe to attempt once a bad run is cheaply reversible. Covers the snapshot-before-any-write ordering rule, why truncated runs make this urgent rather than merely nice, the retention policy, and the graph-pollution mitigations that come with the visible-folder choice."
---

# Plan — Run Snapshots and Restore

## Why care

`applyTemplate` opens with a destructive write. Before a single byte of the response
arrives:

```ts
await app.vault.modify(target, initialContent);
```

In `fill` mode `initialContent` is just the frontmatter and a newline — the body is
gone. In `append` mode the existing body survives, but a second full draft is
concatenated below it, so the file doubles in length every run.

Neither branch has an undo. Obsidian's editor undo does not cover programmatic vault
writes reliably, and the plugin keeps no history of its own. Combined with the
already-documented truncation failure mode in
[[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]] — where a stalled stream
leaves a partial document behind — the practical situation is: **a forty-minute
deep-research market map can be replaced by half a draft, and the good version is
gone.**

That is the reason this plan comes before section refresh and source curation. Both of
those are iteration features, and iteration is only reasonable when a bad iteration is
cheap to reverse. Snapshots are the safety net the rest of the revision arc stands on.


## Findings

Established by reading the current source on 2026-09-10.

### There is exactly one destructive write, and it is unguarded

`applyTemplate` calls `app.vault.modify(target, initialContent)` before opening the
stream. In `fill` mode `initialContent` is frontmatter plus a newline — the entire
prior body is gone at that instant, before any network response has been received.

There is no snapshot, no backup, and no plugin-side undo. Obsidian's editor undo stack
does not reliably cover programmatic vault writes.

### The batch path is the same write, multiplied

`applyTemplateBatch` walks every markdown file in a folder through the same
`applyTemplate`. It is the most destructive operation the plugin exposes and currently
the least reversible — a mis-targeted folder pick rewrites every file in it. Snapshots
must be wired into the batch path, not only the single-file path.

### Truncation makes this urgent rather than merely prudent

`streamPerplexityToFile` catches idle-timeout, ceiling-abort, and dropped-socket
conditions by setting `truncated = true` and falling through to a final flush — a
deliberate and correct choice, since `sonar-deep-research` delivers the whole document
in its first SSE event and discarding a late-disconnected stream would throw away good
work.

The consequence, though, is that a truncated run **still writes to the target**. The
prior draft is already gone by then. So the documented failure mode in
[[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]] does not merely produce a
short document — on a re-run of an existing map, it replaces a complete draft with a
partial one, irreversibly.

Body length in the restore picker is the cheap tell for exactly this case, which is
why it earns a column.

### `zz-cf-lib/` already has the shape for a fourth peer

The library root holds `templates/`, `partials/`, and `preambles/`, each seeded
idempotently and each with its own README. `history/` (and `retrieved/` from the Exa
plan) extend a layout that is already established rather than introducing one.

## Storage decision

**Visible folder under the library root**, chosen deliberately over a hidden
dot-folder:

```
zz-cf-lib/history/<target-path>/<ISO-timestamp>__<model>.md
```

The tradeoff: history files are browsable and diffable in Obsidian itself, using the
same reading and comparison affordances as any other note — which matters a lot when
the question is "was the previous draft actually better?" The cost is that they appear
in search, graph view, and backlink panes unless excluded.

Mitigations to ship alongside:

- Document the Obsidian **Settings → Files & Links → Excluded files** filter for
  `zz-cf-lib/history` in the seeded README, so the user can suppress search noise in
  one click.
- Give every snapshot `publish: false` and a `cf_snapshot: true` frontmatter marker
  so downstream roll-ups and corpus ingesters skip them structurally rather than by
  path convention.
- Keep the target's own wikilinks *out* of the snapshot's link graph by fencing the
  body — a snapshot is an artifact, not a note, and should not inflate backlink
  counts on every company it names.

The same `zz-cf-lib/` root already holds `templates/`, `partials/`, and `preambles/`,
and will hold `retrieved/` from the Exa plan. `history/` is a fourth peer, consistent
with the established layout.

## Design

### The ordering rule

Snapshot before *any* mutation of the target, and specifically before the
`vault.modify(target, initialContent)` call. This is the same ordering constraint the
Exa plan states for source resolution, and for the same reason: everything that can
fail should fail while the target file is still intact.

If the snapshot write itself fails, abort the run with a Notice. A run that cannot be
undone should not start.

### Snapshot frontmatter

Each snapshot records enough to answer "what produced the version I'm looking at?"
without opening the plugin:

```yaml
cf_snapshot: true
publish: false
cf_snapshot_of: "market-maps/Agentic-AI-in-Fintech.md"
cf_snapshot_taken: 2026-09-10T14:22:11Z
cf_snapshot_reason: full-run | section-refresh | restore
cf_template: market-map-profile
cf_model: sonar-deep-research
cf_outline_source: fence | file | skeleton
cf_source_count: 34
cf_truncated: false
```

`cf_snapshot_reason: restore` matters — restoring is itself destructive, so a restore
snapshots the *current* state before overwriting it. There is no way to lose work by
restoring the wrong version.

### Commands

- **"Restore a previous version of this file"** — modal listing snapshots newest
  first, each row showing timestamp, model, reason, source count, and body length.
  Length is the cheap signal that catches a truncated run at a glance. Selecting one
  snapshots current state, then writes the chosen body back.
- **"Open snapshot history for this file"** — reveals the folder in the file explorer,
  for users who'd rather read and diff in Obsidian directly.

### Retention

Default: keep the most recent N per target (ship N = 20), prune oldest beyond that.
Settable, with 0 meaning unlimited. Prune on write, not on a timer.

A deep-research market map is 6–8K words, so twenty snapshots of one map is a few
hundred KB — negligible. The reason to prune at all is folder legibility, not disk.

## Steps

1. **Snapshot writer** — `writeSnapshot(app, settings, target, meta)` returning the
   created path or throwing. Path-safe encoding of the target path into a folder name.
2. **Wire into `applyTemplate`** ahead of the first `vault.modify`. Abort on failure.
3. **Also wire into `applyTemplateBatch`** — a batch run across a folder is the single
   most dangerous operation the plugin offers, and currently the least reversible.
4. **Restore modal + command**, including the snapshot-before-restore step.
5. **Retention pruning** and the settings input.
6. **Seeded README** for `zz-cf-lib/history/` covering the excluded-files filter and
   what the frontmatter keys mean.
7. **Settings section** — history root path, retention count, and a master
   enable/disable toggle for users who keep their vault in git and don't want a second
   history mechanism.

## Verification

- A `fill`-mode run on a populated file leaves a snapshot whose body equals the
  pre-run body byte-for-byte.
- A run aborted mid-stream still has its pre-run snapshot.
- Restore round-trips: run, restore, and the file matches the pre-run state.
- Restoring twice in a row produces two snapshots, not a lost intermediate state.
- A batch run across ten files produces ten snapshots.
- With the master toggle off, no history folder is created and behavior is unchanged.

## Open items

- [ ] Should the snapshot capture frontmatter too, or body only? Body-only keeps the
      restore surgical, but `cf_last_run*` stamps and any harvested
      `google_books_url` would not roll back. Leaning full-file capture with a
      body-only restore option.
- [ ] Whether a "compare with current" affordance is worth building in-plugin, or
      whether pointing users at an existing diff plugin is the right scope boundary.
- [ ] Interaction with vaults already under git — the master toggle covers it, but
      the seeded README should say plainly when each mechanism is the better one.

## Remaining work (as of 2026-09-11)

A snapshot writer landed in `dbe6b25` because remake mode could not ship
without one — see [[2026-09-11_02]]. It is deliberately the narrow version.

**Done:** pre-run snapshot on the remake path, written to
`zz-cf-lib/history/<target path>/<basename>__<stamp>__pre-remake.md`, aborting
the run if the write fails. Folder creation is idempotent.

**Not done — everything that makes it a feature rather than a guardrail:**

- **Snapshots on the fill and append paths.** The destructive write at the top
  of `applyTemplate` is still unguarded for ordinary runs. This is the original
  motivation for the plan and it is still open.
- **`applyTemplateBatch`.** Still the most destructive operation in the plugin
  and still the least reversible.
- **The restore command and its picker.** Recovery today means opening the
  history folder and copying by hand. The body-length column that catches a
  truncated run does not exist.
- **Retention pruning**, the master enable/disable toggle, and the seeded
  README explaining the excluded-files filter.
- **Snapshot frontmatter.** The current writer stores the raw file with no
  `cf_snapshot` marker, no `publish: false`, and no provenance stamps — so
  snapshots will pollute search and graph until that lands.

The storage decision held up in practice: visible files under the library root
were immediately readable when checking what a remake had replaced.
