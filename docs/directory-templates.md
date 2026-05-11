# Directory Templates

**Per-folder content generation for Obsidian vaults — one template fills a category of files.**

This is the long-form reference for Perplexed's directory-template system. For the short summary that lives in your vault after first plugin load, see `<your-vault>/Content-Dev/Templates/README.md` (auto-seeded from `src/docs/templates/README.md`). For the engineering changelog that introduced the feature, see [`changelog/2026-05-10_01.md`](../changelog/2026-05-10_01.md).

> The feature was originally specced as "prompt outlines" (see `context-v/specs/Using-Files-as-Prompt-Outlines.md`). The shipped naming — "directory templates" — reflects the eventual scope: it's not just an outline you point at a prompt, it's a template *bound to a directory* via a glob, with auto-seeding, frontmatter stamps, image embedding, and citation hygiene baked into the runtime.

---

## Why this exists

A working Obsidian vault collects categories of files that share a shape — concepts, vocabulary terms, sources, tooling profiles. The pre-template Perplexed flow had one mega-command per content type, each hand-tuned, each running on whichever file you happened to have open. Filling out 1,600 nearly-empty tool profiles in `Tooling/`, several hundred concepts in `concepts/`, the vocabulary, the source profiles, one editor-callback at a time, is untenable.

Directory templates close the gap. The paradigm has three primitives:

1. **A template** — a markdown file in your `Content-Dev/Templates/` folder, with frontmatter that says *which paths it applies to* via a glob (`concepts/**`), a fenced `cft` configuration block, and a heading skeleton that tells the model what to write.
2. **A runtime** — two commands (`Apply directory template to current file`, `Apply directory template to folder`) match the template to a target via the glob, build a streaming request, and write the response back as it arrives.
3. **A cleanup pipeline** — after the stream completes, the runtime wraps `<think>` blocks, swaps `[IMAGE N: …]` markers for real embeds (with a fallback `# Images` section when the model didn't emit markers but Perplexity returned images), strips unreplaced placeholder bullets, appends a `# Sources` footer in the format cite-wide can convert to hex citations, and stamps `cf_last_run` and `cf_last_run_model` into the target's frontmatter.

The combination — template + runtime + editorial stance baked into the system prompts — turns a one-file-at-a-time chore into a batched generative pass with auditable provenance.

---

## Anatomy of a template

A template file has three zones:

```markdown
---
title: Concept Profile
applies-to-paths:
  - "concepts/**"
description: Encyclopedia-style entry on a concept, pattern, or mental model.
---

# Free-form intro (ignored)

Anything before the cft block is documentation for the human editing
the template. The runtime drops it from the request.

` ` `cft
provider: perplexity
model: sonar-pro
return-citations: true
return-images: true
system: |
  You are writing an encyclopedia-style entry about {{basename}}.

  Editorial stance:
  - Tech giants are adopters/popularizers, not innovators, unless
    documented heyday-era origination supports otherwise.
  - Cap big tech at 1–2 of 5–7 entries in any Examples section.
  - Prefer founder interviews, startup origin stories, and
    research-lab papers as attribution.
` ` `

# Definition
- One-paragraph definition. Plain language. No marketing prose.

# Origins
- Who originated this concept and when. Cite the founder, paper, or
  originating startup, not the company that later popularized it.
- [IMAGE 1: a diagram or screenshot illustrating the concept]

# Examples
- 5–7 real-world examples. At most 1–2 from big tech.

***

# User Notes

Anything below the *** divider is excluded from the request.
You can keep your own notes here without polluting the prompt.
```

(In the actual file, `cft` is a real code-fence — the spaces in the example above are a markdown-escape trick for this doc.)

### The three zones

1. **Frontmatter** (between `---` lines at the top) — carries `title`, `applies-to-paths` (array of globs), and an optional `description`. The runtime uses `applies-to-paths` to match a template to a target file.
2. **`cft` block** (a code fence with language `cft`) — YAML carrying `provider`, `model`, optional `search-recency`, `return-citations`, `return-images`, and a multi-line `system:` prompt. Everything **above** the `cft` block is dropped from the request.
3. **Heading skeleton** — the markdown structure between the `cft` block's closing fence and the first `***` divider. This becomes the user prompt. Bullets under each heading are *instructions to the model*, not literal output. Everything **below** the first `***` is excluded from the request.

### Interpolation tokens

These tokens are substituted into the `system:` prompt before the request is sent:

| Token | Resolves to |
|---|---|
| `{{basename}}` | The target file's filename without extension. **Use this for any H1 the template wants the model to emit** — never use the frontmatter `title`, which the user may have customized away from the basename. |
| `{{title}}` | The target file's frontmatter `title` field, or the basename if missing. |
| `{{today}}` | Today's date in `YYYY-MM-DD` form. |
| `{{frontmatter}}` | The whole frontmatter (whitelisted keys only) as YAML, useful for giving the model existing context about the file. |
| `{{frontmatter.<key>}}` or `{{<key>}}` | A specific frontmatter value (string, number, or array joined with commas). |

The interpolation whitelist is configurable in plugin settings (default: `title, og_description, tags, og_image`). Only whitelisted keys are exposed to prompts.

---

## How a run works

### Path matching

When you invoke **Apply directory template to current file**, the runtime walks every template in `Content-Dev/Templates/`, expands each one's `applies-to-paths` globs, and picks the first that matches the active file's vault path. If multiple templates match (overlapping globs), the first-loaded wins — specificity is not ranked. Don't write overlapping patterns.

When you invoke **Apply directory template to folder**, you get a folder picker, then a template picker (defaults to the template whose glob covers the folder), then a confirmation modal with the file count. The runtime iterates each markdown file under the folder and applies the chosen template. **Stop directory template batch** halts an in-flight batch.

### Fill vs. append

- **Fill mode** runs when the target file's body (everything after frontmatter) is empty or whitespace-only. The streamed output replaces the empty body.
- **Append mode** runs when the target file already has content. The streamed output is appended after the existing body, before the sources footer. The intent: re-running a template never destroys prior work, it accretes.

### Streaming + the cleanup pipeline

The streaming primitive is a real `fetch()` SSE connection — Obsidian's `request()` and `requestUrl` both buffer the whole response, which defeats the point. The runtime:

1. **Streams** the response, parses each `data:` chunk, and flushes accumulated text to the file every ~500ms so you see progress. Failures surface within seconds instead of after a 60-second silent wait.
2. **Captures** Perplexity's `search_results` and `images` arrays as they arrive in the SSE metadata.
3. After the stream ends, runs the cleanup pipeline:
   - `wrapThinkBlocks` — converts `<think>…</think>` to fenced ` ```think-output` blocks.
   - `processContentWithImages` — swaps `[IMAGE N: …]` markers (permissive regex matches `[Image …]`, `[IMAGE …]`, and the markdown-image-shaped `![IMAGE N](…)` variant) for `![desc](image_url)` using the captured `images` array.
   - `buildFallbackImagesSection` — if no markers replaced but `images.length > 0`, emit a `# Images` block before the sources footer so images never silently vanish.
   - `stripUnreplacedImagePlaceholders` — remove any `[Image embed placeholder …]` lines the model emitted but didn't replace.
   - `buildSourcesFooter` — emit `***`, `# Sources`, and `[N]: [Title](URL)` reference definitions in the canonical Lossless format that cite-wide's `REFDEF_NUM_RE` recognises. Run **Convert All Citations to Hex Format** afterward to swap the numeric markers for stable hex IDs.

### Frontmatter stamps

Every successful run stamps three keys into the target's frontmatter via Obsidian's `processFrontMatter`:

| Key | Value | When |
|---|---|---|
| `cf_last_run` | ISO timestamp | Every run |
| `cf_last_run_model` | `Provider model` label (e.g. `Perplexity sonar-pro`) | Every run |
| `google_books_url` | Harvested URL | Only for book-type sources, only when not already present |

These let you query for stale files later (`cf_last_run` older than X), audit which model produced an entry, and skip Google-Books-URL lookups on subsequent runs.

---

## Shipped templates

Four templates ship inlined into `main.js` (via esbuild's `.md` text loader) and are seeded into the user's vault on first plugin load.

| File | Targets | Model | Notes |
|---|---|---|---|
| `concept-profile.md` | `concepts/**` | `sonar-pro` | Encyclopedia-style entries on ideas, patterns, mental models. Anti-incumbent editorial stance baked in. Switched off `sonar-deep-research` because deep-research is unreliable for image return. |
| `vocabulary-profile.md` | `Vocabulary/**` | `sonar-pro` | Term definitions with disambiguation through an innovation-consulting lens. |
| `source-profile.md` | `Sources/**` | `sonar-pro` | Profiles of trusted sources — books, people, channels, publications, journals, reports, events. Type-aware: the system prompt enumerates seven canonical types and the model picks one from frontmatter signals (`youtube_channel_url` → channel, `aliases` → likely book, etc.). Each section has per-type bullet shapes. |
| `toolkit-profile.md` | `Tooling/**` | `sonar-pro` | Profiles of tools, products, platforms, frameworks. |

`source-profile` is the trickiest because `Sources/` is genuinely heterogeneous. The solution is one template, type-conditional content. Books also trigger Google Books URL handling: frontmatter `google_books_url` is used if present, otherwise the model finds it; either way the URL is harvested into frontmatter post-generation via regex, so subsequent runs skip the search.

### The anti-incumbent editorial stance

`concept-profile`, `vocabulary-profile`, and `source-profile` all embed an "editorial stance — attribute innovation correctly" block in their system prompts. The rules:

- Tech giants (Microsoft, Google, Amazon, Apple, Meta, Oracle, Salesforce, post-1990s IBM) are adopters/popularizers, not innovators, unless documented heyday-era origination or a research-lab paper supports innovator framing.
- Origins favor founder / paper / originating-startup attribution.
- "Best Real-World Examples" caps big tech at 1–2 of 5–7 entries.
- Case studies prefer narratives of smaller innovators outpacing incumbents.

This is saved as project memory in the parent monorepo so future templates inherit the rule. It's not Perplexity-specific bias — every default LLM corpus leans incumbent because that's where the training-data signal is.

---

## First-run seeder and re-seed

`templateSeederService.ts` bundles the four templates plus the user-facing README into `main.js` at build time, then writes them to the configured templates folder on `onload`. The policy is **two-tier**:

- **README** (`Content-Dev/Templates/README.md`) — always ensured present. If you delete it, the next plugin load writes it back.
- **Templates** — only seeded when the templates folder is missing or contains no non-README markdown. A folder with even one shipped template is treated as user-managed and left alone.

The **Re-seed templates** button in plugin settings (under *Directory templates*) writes any shipped file whose filename doesn't already exist. Use it after a plugin update introduced a new template, without overwriting your edits to existing ones. To force-reset a template to its shipped default, delete the file first, then click Re-seed.

---

## Writing your own template

1. Copy any shipped template under a new filename (`<your-name>-profile.md`).
2. Change the frontmatter — `title`, `description`, and especially `applies-to-paths`.
3. Rewrite the `cft` block's `system:` to your domain. Use `{{basename}}` for any H1 you want the model to emit. Add interpolation tokens (`{{frontmatter.tags}}`, etc.) where prior context should reach the model.
4. Rewrite the heading skeleton with the structure you want. Use bullets to instruct the model. Use `[IMAGE N: <description>]` markers in places where an image would help — set `return-images: true` in the cft block to activate image embedding.
5. Save it in `Content-Dev/Templates/`. The plugin picks it up on the next palette invocation — no reload needed.

Don't write overlapping `applies-to-paths` patterns across templates; the first matched wins and there's no ranking.

---

## Commands

| Command | Behavior |
|---|---|
| **Apply directory template to current file** | Match the active file's path to a template's `applies-to-paths`; fill or append according to file state. |
| **Apply directory template to folder** | Folder picker → template picker → confirmation modal with file count → batch apply. |
| **Stop directory template batch** | Halt an in-flight batch at the current file boundary. |

All three appear in the Obsidian command palette under `Perplexed: …`.

---

## Settings

`Plugin settings → Directory templates`:

- **Content-Dev folder path** — root for content-development resources (default: `Content-Dev`).
- **Templates folder path** — where templates live (default: `Content-Dev/Templates`).
- **Frontmatter interpolation whitelist** — comma-separated keys exposed to `{{frontmatter.<key>}}` (default: `title, og_description, tags, og_image`).
- **Re-seed templates** — write any shipped template whose filename doesn't exist in the templates folder.

---

## Known limits and open items

(Mirrored from the changelog's *Open Items* section for completeness — see `changelog/2026-05-10_01.md` for the canonical list.)

- **Image quality on abstract concepts.** Perplexity image search keyword-matches against alt text, so it favors marketing heroes over feature/dashboard screenshots even when the latter would be more illustrative. For concept and vocabulary entries with no canonical visual referent, image search often returns nothing useful. Tier-2 mitigations (multimodal re-rank, headless screenshot service, Ideogram-generated illustrations) are deferred.
- **`<think>` block streaming UX.** Raw `<think>…</think>` blocks land in the file during streaming and only get wrapped to a fenced block at the end. A live wrap during streaming would be cleaner.
- **Multi-`cft` per template.** Each template has one `cft` block today. A multi-block template would let a single template define per-section refresh prompts. Unblocked but not designed.
- **Defensive model capture from API response.** The stamped model name comes from the cft config. If Perplexity silently substitutes a different model (rate-limit fallback), we won't reflect that. Capturing the model name from the SSE response and stamping that instead would close the loop.
- **Citation/backlink preservation under cite-wide.** The image-placeholder strip and `[IMAGE N: …]` replacement run on the streamed string before any cite-wide processing. The ordering is consistent today but isn't pre-flight-checked.

---

## See also

- [`changelog/2026-05-10_01.md`](../changelog/2026-05-10_01.md) — the changelog entry that shipped this paradigm, with full *What Was Built / What Changed in Approach / Files Touched* breakdown.
- [`src/docs/templates/README.md`](../src/docs/templates/README.md) — the shorter doc that gets seeded into the user's vault on first plugin load.
- [`context-v/specs/Using-Files-as-Prompt-Outlines.md`](../context-v/specs/Using-Files-as-Prompt-Outlines.md) — the original "outlines" spec sketch (kept as historical context; the shipped naming and shape evolved past this).
- `cite-wide` plugin's `llmCitationParserService.ts` (`REFDEF_NUM_RE`) — the `[N]: [Title](URL)` form the sources footer emits is what cite-wide's *Convert All Citations to Hex Format* command consumes.
