---
title: "Multi-Stage Cooperative Claude + Perplexity with RAG"
lede: "What if a market-map draft were the output of three agents — a RAG pre-flight that names what to include, a Perplexity research run that finds the rest, and a Claude editorial pass that never steps on either — instead of one single-shot prompt?"
date_created: 2026-05-26
date_modified: 2026-05-26
authors:
  - Michael Staton
augmented_with:
  - Claude Opus 4.7 (1M context)
semantic_version: 0.0.0.1
tags:
  - Exploration
  - Perplexed
  - Multi-Stage-Generation
  - Agentic-Orchestration
  - RAG
  - Chroma
  - Market-Maps
  - Claude
  - Perplexity-Deep-Research
status: Open
related:
  - "[[market-map-profile]]"
  - "[[Using-Files-as-Prompt-Outlines]]"
  - "[[Partials-And-Preambles-For-Perplexed-Templates]]"
  - "[[Getting-Claude-to-Respond-With-Research]]"
  - "[[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]]"
site_uuid: ed0f1378-edb9-4d7b-be3f-2827b9176332
hex_code: bj863v
date_authored_initial_draft: 2026-05-26
date_authored_current_draft: 2026-05-26
---

# Multi-Stage Cooperative Claude + Perplexity with RAG

A market map is the kind of document where one-shot generation hits its limit. The lean v1 `market-map-profile` template ([`src/docs/templates/market-map-profile.md`](../../src/docs/templates/market-map-profile.md)) produces a respectable analyst draft in a single Perplexity deep-research run, but every analyst who has read one of our existing market maps notices the same gaps: the wikilinks back to our own `Tooling/` and `concepts/` aren't there, the segmentation occasionally misses a sub-bucket we cover heavily in the vault, and the editorial voice drifts from "well-paid analyst" toward "encyclopedia summary" without a second pass. The fix is multi-stage, but multi-stage has more design surface than it looks: who runs first, how they hand off, where the RAG context lives, and — the question that motivated this doc — **how do we keep Claude and Perplexity from overwriting each other's work?**

## The question

We want to evolve `market-map-profile` (and, by precedent, any other research-heavy template) from a one-shot Perplexity run into a cooperative pipeline that includes:

1. A **RAG pre-flight** that pulls canonical Lossless source material (vault tools, concepts, prior market maps; Chroma-indexed corpus chunks) and bakes it into the prompt context as named, citeable inputs.
2. A **Perplexity research stage** that does what `sonar-deep-research` does today, but primed with the RAG context so it cites our own canonical entries by name rather than generating shadow versions of them.
3. A **Claude editorial stage** that enforces analyst voice, prunes over-enumeration, restructures sub-segments where the data demands, emits `[[wikilink]]`s for entries that exist in the vault, and surfaces "the question this map answers" framing.

The specific design questions:

- **How do RAG-provided sources get expressed in a template?** The user articulated this as an `include_sources:` argument — a list of sources to include, distinct from `search-domains:` (which constrains where Perplexity searches the open web). What's the surface shape — a list of file paths, a Chroma query spec, both?
- **How do the three stages share a target file without clobbering each other?** Perplexity streams text into the file body. Claude's editorial pass needs to *edit* that text. If Claude runs while Perplexity is still streaming, or if Claude edits the same region Perplexity wrote, we get a race or a confused output.
- **Single file or multi-document folder?** A market map could remain one large markdown file with sectioned output, or it could become a folder where each sub-segment is its own document with a manifest at the root. The latter is more agentic-friendly (each section is independently re-runnable) but breaks the single-file mental model that every other directory template uses.
- **Where does the RAG index live, and how does it stay fresh?** The Chroma collections in [`lossless-monorepo/CLAUDE.md`](../../../../CLAUDE.md) (`context-vigilance-corpus`, `lossless-changelog`, `claude-code-sessions`, `claude-code-tool-traces`) are reachable via the `chroma` MCP server inside Claude Code, but the perplexed plugin runs inside Obsidian — it can't reach an MCP server. The plugin would need its own client to the same Chroma instance, OR the RAG pre-flight runs *outside* the plugin and writes its output into the target file before the plugin's Perplexity stage triggers.

## Why we don't already know

Three reasons.

**One — the existing `cft` template surface is intentionally minimal.** The `ParsedTemplate` interface ([`src/services/directoryTemplateService.ts:31`](../../src/services/directoryTemplateService.ts)) gives a template four things: a config block, a system prompt, a user skeleton, and the four shipped templates ride that surface comfortably because each is *one* provider call. The moment we add a second provider — Claude after Perplexity, or a RAG client before either — we need to decide whether the template is still one file (with multiple stages declared inside) or whether it's a *pipeline* with a per-stage manifest. We have no precedent in this codebase for the latter.

**Two — `include_sources` isn't a Perplexity API field, and we haven't decided what it means.** `search_domain_filter` constrains where Perplexity searches; it doesn't inject our content into the prompt. What the user is gesturing at — "a list of sources to include" — is closer to **retrieval-augmented generation**: pull canonical text from named documents (or a Chroma vector query), splice it into the prompt as named, citeable inputs, then let the model lean on it. We already have the splice primitive (`{{include: name}}` partials, [`directoryTemplateService.ts:83`](../../src/services/directoryTemplateService.ts)) — but partials are pure snippets, content-agnostic. RAG sources need different handling: they want to be named, attributed, and bounded so the model knows what it's quoting.

**Three — we don't yet know whether the editing stage should run as an *edit* or as an *additive pass*.** The user's framing — *"Perplexity and Claude do not overwrite each other until editing"* — implies a model where Perplexity writes its draft in one zone of the file, Claude writes in another, and only at the explicit edit-phase do they consolidate. That's a real design choice with consequences for the file shape, the cft block schema, and how the user knows where they are in the pipeline.

## Options

Three architectures to weigh. They are not mutually exclusive — Option C is closer to a generalization of A and B than a distinct third path.

### Option A — Sequential single-file appends with named zones

The template stays one markdown file in `zz-cf-lib/templates/`. The cft block grows new keys but the file shape stays familiar.

Pipeline:

1. **RAG pre-flight (in-plugin).** Plugin reads `include_sources:` from the cft block, resolves it (vault paths and/or Chroma queries), splices the retrieved text into the system prompt as a named context block. No file writes happen at this stage — RAG context flows straight into the prompt.
2. **Perplexity stage.** Runs as today: streams body content into the target file, stamps `cf_last_run` / `cf_last_run_model`, appends `# Sources` footer. Output lands in a zone delimited by `<!-- perplexity:start -->` and `<!-- perplexity:end -->` HTML comments.
3. **Claude editorial stage.** Reads the entire file, runs Claude with a specific edit prompt (`edit-system:` from the cft block, or a separate `claude` block), writes the edited version into a NEW zone delimited by `<!-- claude:start -->` and `<!-- claude:end -->`. The Perplexity zone is preserved untouched as provenance; the Claude zone is what the published doc draws from.

cft block grows:

```yaml
provider: perplexity
model: sonar-deep-research
include-sources:
  - vault: "Tooling/AI-Toolkit/Agentic AI/**"
  - vault: "concepts/Explainers for AI/Agentic Workspaces.md"
  - chroma:
      collection: context-vigilance-corpus
      query: "{{title}} market map prior art"
      n_results: 5
system: |
  ...

editor:
  provider: anthropic
  model: claude-opus-4-7
  pass: editorial-restructure
  system: |
    You are editing the Perplexity-drafted market map below into final form...
```

**Pros:**

- One file per market map; consistent with every other directory template.
- The zoned-append discipline (Perplexity zone, Claude zone) makes provenance auditable — you can read exactly what each agent produced.
- Both stages re-runnable independently. Re-run Perplexity to refresh the source data; re-run Claude to refresh the edit without re-burning a deep-research credit.
- `include-sources` becomes a structured field that handles both vault-path and Chroma-query forms, with the resolution logic centralized in the plugin.

**Cons:**

- One file gets long fast. Market maps are already 4-8K words; doubling the body to keep both zones means the on-disk file is hefty. Obsidian handles it, but readability degrades.
- The Chroma client has to run inside the Obsidian plugin. That means embedding a Chroma HTTP client in `main.js`, configuring the Chroma URL in plugin settings, and handling the failure mode where Chroma is unreachable.
- The HTML-comment zone markers are fragile — a user editing the file in another pane could break them, and at that point the re-run logic doesn't know where to write.
- Claude's editorial output sitting in a sibling zone means downstream rendering (the public site) needs to know to draw from the Claude zone, not the Perplexity zone. That's a coupling that didn't exist before.

### Option B — Multi-document folder, section per file, with a manifest

Each market map becomes a folder, not a file. `lost-in-public/market-maps/Quantum Computing is Confusing/` rather than `Quantum Computing is Confusing.md`. Inside the folder:

```
Quantum Computing is Confusing/
├── _manifest.md           # frontmatter only — title, lede, banner_image, etc.
├── 00-snapshot.md         # Market Snapshot section
├── 01-question.md         # The Question this Map Answers
├── 02-why-now.md          # Why Now
├── 03-map.md              # Map of the Market — Sub-Segments
├── 04-lighthouse.md       # Lighthouse Examples
├── 05-profiles-superconducting.md   # one file per sub-segment
├── 05-profiles-photonic.md
├── 05-profiles-trapped-ion.md
├── 06-media.md
├── 07-dynamics.md
├── 08-frontier.md
├── 09-adjacent.md
└── _sources.md            # consolidated sources footer
```

Each `NN-*.md` file is independently re-runnable. The template becomes a *pipeline manifest* that names which agent runs on which file and in what order. The cft format extends to declare per-file stages.

Pipeline:

1. **Scaffold.** A new command — `Initialize market map folder` — creates the folder structure from a template manifest, populating each section file's frontmatter with its position in the pipeline.
2. **Per-section RAG + Perplexity.** Each section file declares its own `include-sources:` and runs its own targeted Perplexity query. Sub-segment files (`05-profiles-*.md`) get the most aggressive RAG injection (vault tools matching the sub-segment).
3. **Section-level Claude pass.** Claude edits each section file independently against a section-specific edit prompt.
4. **Roll-up.** A final command stitches the section files into one rendered markdown file for publication, or the public site renders the folder directly via a folder-aware renderer.

**Pros:**

- Each section is independently re-runnable. The biggest pain in a one-shot 6K-word generation is "the trapped-ion sub-segment is thin, I'd like to re-run just that one." Folder form makes that natural.
- RAG context can be tightly scoped per section — the Lighthouse Examples section gets a different vault query than the Media section. With one mega-prompt, RAG context is one-size-fits-all.
- Per-section editorial passes are cheaper. Editing a 600-word section is faster and tighter than editing a 6K-word document.
- The folder maps cleanly to how an actual analyst works — they don't write the whole memo in one sitting; they research the sub-segments first, then sequence the framing prose.
- Agentic orchestration becomes natural: a future orchestrator-agent can iterate over the section files, decide which need refresh, and dispatch jobs in parallel.

**Cons:**

- Breaks every existing convention in the perplexed plugin and the vault. The four shipped templates target one file each; making market maps target a folder is a tier shift.
- The existing `applies-to-paths` glob ([`directoryTemplateService.ts`](../../src/services/directoryTemplateService.ts)) matches a file against a template; we'd need parallel `applies-to-folders` matching, or a new command entirely.
- Cross-section consistency is harder. The Innovator Profiles section needs to reference the same sub-segment names declared in the Map of the Market section. With separate files, drift across sections becomes likely.
- The published-on-the-web rendering needs a folder-aware renderer. Astro Knots can do this (it already renders nested content), but every existing market map is a single file and migrating them is its own project.
- Users edit market maps as one document in their head. A folder breaks that mental model.

### Option C — Per-section refresh blocks inside a single file

Take the multi-`cft` idea floated in the directory-templates doc's *Known limits and open items* and run with it. The template file stays one markdown file. The skeleton declares per-section refresh prompts via dedicated `cft` blocks inline under each H1.

```markdown
# Market Snapshot

```cft-section
provider: perplexity
model: sonar-deep-research
include-sources: [...]
prompt: |
  Write the Market Snapshot section per the instructions below.
```

- Bullet instructions for this section...

# Innovator Profiles

```cft-section
provider: perplexity
model: sonar-deep-research
include-sources:
  - vault: "Tooling/AI-Toolkit/Agentic AI/**"
prompt: |
  Write the Innovator Profiles section. Use RAG content to name actual
  vault tools where possible.
```

- Bullet instructions...
```

A header-level `cft` block stays at the top of the template declaring the editorial stage (Claude pass) that runs across the whole file at the end.

Pipeline:

1. **Section-by-section Perplexity runs.** The plugin walks each `cft-section` block and runs its own targeted query. Section content lands under that H1.
2. **File-level Claude editorial pass.** After all sections are filled, Claude reads the assembled file and writes the edited version per the file-level `editor:` block.

**Pros:**

- One file per market map (keeps Option A's familiarity).
- Per-section RAG and Perplexity targeting (gets Option B's tight scoping).
- Re-runnable per section — invoke `Refresh section` on the active section's H1 to re-run just that `cft-section`.
- Sub-segment-aware RAG: each section's `include-sources` can be tuned to what that section needs.

**Cons:**

- The `cft-section` schema is novel; we'd have to design the multi-block parser, the per-section command surface, and the interaction with the existing one-`cft` flow.
- The file is longer at-rest because it carries every section's prompt inline. This is a feature (visible provenance) and a bug (clutter) at the same time.
- "Append vs. fill" semantics become per-section. The mode logic in `applyTemplate` gets more states.

## The `include_sources` sub-exploration

This is the design call most likely to set the trajectory of everything else. The user named it as a key argument, and it sits at the intersection of three primitives we already have:

| Primitive | What it does today | What's missing for `include_sources` |
|---|---|---|
| `search-domains:` ([`directoryTemplateService.ts:486`](../../src/services/directoryTemplateService.ts)) | Constrains Perplexity's open-web search to a domain allowlist + a job-board denylist | Doesn't inject content into the prompt; only filters where the model searches |
| `{{include: name}}` partials ([`directoryTemplateService.ts:83`](../../src/services/directoryTemplateService.ts)) | Splices a named partial's body into the prompt, content-agnostic | No naming/attribution wrapper for the spliced content; no Chroma-query form |
| Chroma collections (`context-vigilance-corpus` et al, [`lossless-monorepo/CLAUDE.md`](../../../../CLAUDE.md)) | Section-chunked vault content indexed and queryable via the `chroma` MCP server | Only reachable from inside Claude Code today, not from inside Obsidian plugin runtime |

Proposed shape for `include-sources:` in the cft block:

```yaml
include-sources:
  # Vault path — read the file, splice its body into the prompt as a named,
  # attributed context block. Glob form is allowed; matched files are
  # concatenated with their basenames as the attribution label.
  - vault: "concepts/Explainers for AI/Agentic Workspaces.md"
  - vault: "Tooling/AI-Toolkit/Agentic AI/**"
    max_files: 10            # cap for glob expansion
    body_only: true          # strip each file's frontmatter (default true)

  # Chroma query — run a semantic search against a named collection,
  # splice the top N results into the prompt with their source_path
  # and source_repo_slug as attribution.
  - chroma:
      collection: context-vigilance-corpus
      query: "{{title}} market segmentation"
      n_results: 5
      where:                 # optional metadata filter
        source_repo_slug: "lossless"

  # External URL — fetch and inline. Lowest priority because we can't
  # cache, but useful for one-off canonical references the user wants
  # baked in. Requires explicit opt-in in settings.
  - url: "https://www.lossless.group/projects/gallery/agentic-workspaces"
    max_chars: 8000
```

How the spliced content lands in the prompt:

```
## Canonical sources (use these as primary attributions where applicable)

### Source: Tooling/AI-Toolkit/Agentic AI/Crew AI.md
<body of that vault file>

### Source: concepts/Explainers for AI/Agentic Workspaces.md
<body of that vault file>

### Source: Chroma (context-vigilance-corpus) — n=3
<top chunks, each labeled with source_path>

## Search the open web for additional sources beyond the canonical set above.
```

This shape solves the "named, attributed" problem (the model knows what it's quoting and can cite by vault path), keeps glob expansion bounded (`max_files`), and degrades gracefully when Chroma is unreachable (skip the chroma entries with a warning notice; vault entries still resolve).

Open sub-questions:

- **Does `include-sources` belong at the template level or the section level?** Template-level is simpler. Section-level is more powerful but only matters if we go Option B or C.
- **How big can the canonical-sources block grow before we OOM the prompt?** `sonar-deep-research` has generous context but not infinite. A vault glob matching 100 files is too much. The `max_files` cap matters; defaults should be conservative (5-10).
- **Is the Chroma client an in-plugin dependency or an out-of-plugin pre-flight?** If we ship a Chroma client in `main.js`, plugin size grows and we need to surface Chroma URL configuration in settings. If we keep RAG pre-flight outside the plugin (a CLI that writes a `_rag-context.md` partial the plugin then includes), the plugin stays lean but the workflow gains an extra step.

## "Perplexity and Claude do not overwrite each other until editing"

This is the design heuristic that distinguishes Option A's zoned-append from a naive sequential pipeline. Three implementations of the heuristic, in increasing strictness:

1. **Soft separation (zones).** Perplexity writes into one zone, Claude writes into another. Both zones live in the same file. Provenance is preserved; the published doc draws from the Claude zone but the Perplexity zone is readable.
2. **Hard separation (files).** Perplexity writes its draft to `<map>.perplexity.md`. Claude reads that file and writes its edit to `<map>.md` (or vice versa, depending on which is canonical). The original is preserved untouched.
3. **Strict additive (no edits, only appendages).** Both agents append; neither edits. The final document is a stitched sequence of their outputs with explicit attribution. Useful if we want to preserve "the analyst's draft" and "the editor's reorganization" as separate readable artifacts.

The strict additive form (3) has appeal — it makes the multi-agent collaboration audit-trail-perfect — but it's hostile to the actual editorial goal, which is *to merge the two voices into one coherent document*. Soft separation (1) hits the right tradeoff for a v1: provenance is preserved, the final published form is one voice, and re-running either stage doesn't destroy the other's work.

The "until editing" clause is where the user's framing gets sharp. **The editing stage is the only point at which the two agents' outputs are consolidated.** Before that, they're parallel artifacts. This is why Option A's zoned append is the most faithful interpretation: Perplexity and Claude do their work in parallel zones; the editing stage (which Claude itself performs) is when the consolidation happens, producing the canonical Claude zone.

## Live example surfacing the timeout issue

The first real-world run of the v1 `market-map-profile` template — `lost-in-public/market-maps/Humanoid Robots and their Input Industries.md`, executed 2026-05-26 — produced a ~7,500-word draft that terminated mid-sentence inside *Frontier and Open Questions* because the directory-template runtime's wall-clock `AbortController` fired before the stream completed. That truncation is the motivating use case for the **per-template `request-timeout-ms:` cft-block override** we shipped on the same day as this exploration (default bumped to 30 min, market-map-profile overridden to 40 min). The pressure-relief valve is in place; the structural fix — porting the idle-timeout discipline from `perplexityService.ts:659-668` into `streamPerplexityToFile` — is captured as its own issue at [[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]] and feeds back into this exploration's *Open items* below.

This is the shape of validation we want for the multi-stage pipeline overall: ship the lean v1, run it on a real document, surface the structural gaps as their own context-v issues (where they get the attention they deserve), and let the issues feed into the eventual spec.

## Findings so far

From this exploration session, the [partials-and-preambles issue](../issues/Partials-And-Preambles-For-Perplexed-Templates.md) the architecture builds on, and the [wall-clock-timeout issue](../issues/Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams.md) surfaced by the first real market-map run:

- **The `{{include: name}}` partial primitive is already structurally close to what `include-sources` needs.** What's missing is (a) the per-source attribution wrapper, (b) the Chroma-query form, and (c) the multi-source named-block formatting in the prompt. The partial loader's depth and cycle guards transfer directly.
- **The cft config is already a structured YAML surface.** Adding `include-sources:` (a list) and `editor:` (an object) doesn't break the existing parser; the four shipped templates remain valid because they don't declare either key.
- **`search-domains:` and `include-sources:` are complementary, not redundant.** Domains constrain where Perplexity searches the open web; include-sources injects canonical content into the prompt directly. A future market-map run would likely use both: include-sources to seed our canonical entries, search-domains to keep open-web search restricted to credible analyst sources (Bloomberg, FT, sector trade press, founder blogs).
- **Claude can already stream to a file** ([`claudeService.ts:48`](../../src/services/claudeService.ts) `queryClaude`). The editorial stage doesn't need a new transport — it needs a different prompt construction path and a different write-zone strategy.
- **The `editor:` block can be opt-in.** Templates that don't declare it stay single-stage and behave exactly as they do today. The four shipped templates would stay single-stage; only `market-map-profile` and any future research-heavy templates would declare an `editor:`.
- **Chroma reachability from inside Obsidian is the long pole.** The MCP server only exists in Claude Code; the Obsidian plugin runs in Electron and needs its own HTTP client to a Chroma instance, OR we keep RAG pre-flight as an out-of-band step that writes a context partial the plugin then includes.

## Tentative direction

Lean toward **Option A (zoned single-file appends) with the `include-sources:` and `editor:` keys added to the cft schema**, and keep RAG pre-flight as an *in-plugin* feature with Chroma queries optional (vault-path includes always work; Chroma includes degrade to a Notice when unreachable).

Reasoning:

- Option A is the smallest delta from the existing template surface. The four shipped templates remain unchanged; market-map-profile gains two new keys.
- Vault-path includes get us most of the RAG win without the Chroma-reachability problem. The dominant value of "include our canonical tools and concepts" is satisfied by globbed vault includes; Chroma adds discoverability over the wider corpus but isn't load-bearing for the first iteration.
- Zoned appends preserve the "Perplexity and Claude do not overwrite each other until editing" heuristic literally: each agent writes its zone, the editing stage consolidates. If we want hard separation later, we can promote the zones into separate files without redesigning the schema.
- Option B (multi-doc folder) is the right end-state for sufficiently complex maps but is a tier shift that should be earned, not pre-emptively designed.
- Option C (per-section cft blocks) is the right *generalization* but is also the right way to over-design. Defer until we've shipped Option A and felt the actual pain.

Defer for a follow-up spec:

- The Chroma in-plugin client work. Ship vault-path includes first; revisit Chroma after we know whether the in-plugin client size cost is worth the discoverability gain.
- The multi-doc folder form (Option B). Track as a possible v3 once we have 10+ market maps and can feel the cross-section consistency pain.
- The per-section `cft-section` block (Option C). Track as a possible v2 alternative if Option A's zoned appends turn out to be insufficient for sub-segment scoping.

## Open items before we promote to a spec

- [ ] Confirm zone delimiter shape. HTML comments are tolerant in Obsidian and Astro Knots renderers; named-anchor headings (`<!-- region: perplexity -->`) work too. Pick one and document.
- [ ] Decide whether `editor:` is a block or a list. A list (`editor: [{ provider: anthropic, ... }, { provider: anthropic, pass: copyedit, ... }]`) would let us chain multiple Claude passes; a block keeps the single-pass v1 simpler.
- [ ] Spec the `include-sources` resolution order and de-duplication policy. If a vault glob and a Chroma query both surface the same source file, do we splice it twice?
- [ ] Decide attribution-block format. Does each included source get a top-level H2 in the prompt context, or a fenced block, or YAML-front-matter-wrapped? Trade off model-comprehension against prompt-token economy.
- [ ] Decide what `cf_last_run` stamps look like for a multi-stage run. One timestamp per stage (`cf_last_run_perplexity`, `cf_last_run_editor`)? A composite? This matters for the "is this map stale?" query later.
- [ ] Verify Chroma collections are queryable from a non-MCP HTTP client. The [chroma-local skill](../../../../context-v/skills/chroma-local/SKILL.md) covers `ChromaClient`/`HttpClient` setup; should be a 30-minute spike.
- [ ] Resolve [[Wall-Clock-Timeout-Cuts-Off-Long-Deep-Research-Streams]] before the multi-stage spec lands — the current wall-clock primitive cuts off long stage-2 (Perplexity) runs and will cut off long stage-3 (Claude editorial) runs too, since the editor's per-section reasoning on a 7-8K-word draft is itself a long generation. The structural fix (idle-timeout discipline) belongs upstream of multi-stage, not as part of it.

## Outcome

Open. When this resolves, the expected artifacts are:

1. A spec in [`context-v/specs/`](../specs/) — `Multi-Stage-Templates-with-Include-Sources-and-Editor.md` (working title) — that pins down the cft schema additions, the zone-delimiter format, the resolution order for `include-sources`, the editorial-stage contract, and the migration path for existing templates.
2. A prompt in [`context-v/plans/`](../plans/) — chunked implementation steps for the spec.
3. The `market-map-profile` template updated to use the new keys, treated as the reference implementation.
4. A v2 follow-up exploration in this folder once we've felt how Option A actually behaves with one or two real market maps generated through it.

## Related

- [[market-map-profile]] — the lean v1 template this exploration extends
- [[Using-Files-as-Prompt-Outlines]] — the original spec that motivated directory templates
- [[Partials-And-Preambles-For-Perplexed-Templates]] — the issue that established the splice primitive `include-sources` builds on
- [[Getting-Claude-to-Respond-With-Research]] — prior work on Claude as a research-aware agent
- [[search-lossless-corpus]] — the Claude-Code-side skill that already encodes the four-collection RAG discipline; the in-plugin RAG flow is the Obsidian analog
- [`lossless-monorepo/CLAUDE.md`](../../../../CLAUDE.md) — the canonical description of the four Chroma collections this exploration's RAG stage would draw on
