---
title: Perplexed — directory templates
description: How the per-directory template system works in the perplexed plugin.
---

# Perplexed — directory templates

This folder is the home of **directory templates** used by the perplexed plugin's `Apply directory template…` commands. Each template is one markdown file with three zones — frontmatter, a fenced configuration block (`cft`), and a heading skeleton — and it tells perplexed how to fill out a category of vault files (concepts, vocabulary, sources, etc.) using Perplexity research.

The plugin seeds this folder on first run with the four templates below. You can edit them, delete them, add your own — perplexed only re-seeds when the folder is missing or empty (or when you click **Re-seed templates** in settings, which only fills in templates whose filenames don't already exist).

## Shipped templates

| File | Targets paths | Use for |
|---|---|---|
| `concept-profile.md` | `concepts/**` | Encyclopedia-style entries on ideas, patterns, mental models. Anti-incumbent editorial stance baked in. |
| `vocabulary-profile.md` | `Vocabulary/**` | Definitions of terms with disambiguation through an innovation-consulting lens. |
| `source-profile.md` | `Sources/**` | Profiles of trusted sources — books, people, channels, publications, journals, reports, events. Adapts emphasis to the source's type. |
| `toolkit-profile.md` | `Tooling/**` | Profiles of tools, products, platforms, frameworks. |

## How a template works

A template file has three zones:

```markdown
---
title: My Template
applies-to-paths:
  - "MyDir/**"
description: One-line description.
---

# Free-form intro
Anything before the cft block is ignored — it's documentation for you.

` ` `cft
provider: perplexity
model: sonar-pro
return-citations: true
return-images: true
system: |
  System prompt for the model. Can use {{basename}}, {{frontmatter}},
  {{title}}, {{today}}, or {{frontmatter.<key>}}.
` ` `

# Heading 1 — first section
- Bullet instructions tell the model what to write here.

# Heading 2 — next section
- More bullet instructions.

***

# User Notes

Anything below the `***` line is excluded from the request.
```

### The three zones

1. **Frontmatter** (top, between `---` lines) — carries `title`, `applies-to-paths` (array of glob patterns), and an optional `description`. The plugin uses `applies-to-paths` to match a template to a target file.
2. **`cft` block** (a code fence with language `cft`) — YAML config: `provider`, `model`, `search-recency`, `return-citations`, `return-images`, plus a multi-line `system:` prompt. Anything above the `cft` block is treated as documentation and dropped from the request.
3. **Heading skeleton** (everything between the `cft` block's closing fence and the first `***`) — the user prompt. This is the markdown structure the model fills in. Bullets under each heading are *instructions to the model*, not literal output.

The `***` divider terminates the user prompt. Anything below it (the User Notes zone) is for your own scratch work and never reaches the model.

### Interpolation tokens

These tokens get replaced before the request is sent:

| Token | Resolves to |
|---|---|
| `{{basename}}` | The target file's filename without extension. **Use this for the H1**, never the frontmatter `title`. |
| `{{title}}` | The frontmatter `title` field, or the basename if missing. |
| `{{today}}` | Today's date in `YYYY-MM-DD` form. |
| `{{frontmatter}}` | The whole frontmatter (whitelisted keys only) as YAML. Useful to give the model existing context. |
| `{{frontmatter.<key>}}` or `{{<key>}}` | A specific frontmatter value (string, number, or array joined by commas). |

The frontmatter whitelist is configurable in plugin settings (default: `title, og_description, tags, og_image`). Only whitelisted keys are interpolated into prompts.

## Invoking a template

Three commands in the Obsidian command palette:

- **Apply directory template to current file** — picks the template that matches the active file's path via `applies-to-paths`, fills the body, stamps `cf_last_run` and `cf_last_run_model` to frontmatter.
- **Apply directory template to folder** — runs the matched template across every markdown file under a chosen folder. Stops on Cancel.
- **Stop directory template batch** — stops a running folder batch.

Modes:

- **Fill** — runs when the target file's body is empty or whitespace-only. The template fills the empty body.
- **Append** — runs when the target file already has content. The template's output is appended after the existing body and before a new sources footer.

## Image markers and fallback

When a template sets `return-images: true`, the runtime auto-appends an instruction telling the model to insert `[IMAGE N: <description>]` markers in its prose where images would help. After streaming completes:

1. The runtime swaps each `[IMAGE N: …]` for `![desc](image_url)` using Perplexity's returned `images` array.
2. If the model didn't emit any markers (or if the regex misses) but Perplexity *did* return images, they're appended as a `# Images` section before the sources footer.
3. If Perplexity returned no images at all, you'll see a console warning explaining that the model/query combination didn't yield images. The image-placeholder bullet in the template body remains a manual fallback (run **Find images for selection** on the section).

Image quality is best with `sonar-pro`. `sonar-deep-research` does not reliably return images.

## Citation behavior

Templates auto-prepend a system directive that tells the model to inline numeric `[N]` citation markers tied 1:1 to Perplexity's returned search results. After streaming, the runtime appends a `# Sources` footer using the canonical Lossless `[N]: [Title](URL)` format. cite-wide's `Convert All Citations to Hex Format` command will swap the numeric markers for hex IDs.

## Frontmatter stamps

Every successful run stamps:

- `cf_last_run` — ISO timestamp of the run.
- `cf_last_run_model` — `Provider model` label (e.g., `Perplexity sonar-pro`).

Books additionally get `google_books_url` stamped if the model surfaces a Google Books URL in body content and the field isn't already in frontmatter.

## Writing your own template

Copy any shipped template, change:

- The frontmatter `title`, `description`, and `applies-to-paths`.
- The `cft` block's `system:` prompt to your domain.
- The heading skeleton to the structure you want the model to fill.

Save it as `<your-name>-profile.md` in this folder. The plugin picks it up on the next palette invocation — no reload needed.

`applies-to-paths` accepts an array of glob patterns. `**` matches any depth. The first template whose patterns match the target file's path wins; specificity isn't ranked, so don't write overlapping patterns across templates.

## Re-seeding

The plugin only auto-seeds when this folder is missing or empty. To pull in a fresh shipped template (e.g., after a plugin update added one), open plugin settings → **Directory templates** → click **Re-seed templates**. That command only writes files whose filenames don't already exist; your edits to existing templates are never overwritten. To reset a template to its shipped default, delete the file first, then click Re-seed.
