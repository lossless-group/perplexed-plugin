---
title: Partials and preambles for perplexed templates
date_created: 2026-05-19
type: issue
status: open
target_repo: perplexed
related:
  - "[[Nudgeing-AI-Search-to-Return-Contextually-Appriate-Images]]"
  - "[[Obsidian-Review-Bot-Feedback-on-Perplexed-Submission]]"
site_uuid: 06b625a0-c4b9-4c01-825e-c7add2a052b0
hex_code: 4jxhw1
date_authored_initial_draft: 2026-05-19
date_authored_current_draft: 2026-05-19
lede: "Mermaid rules sit in all four templates and three directives are hardcoded in TS — pull both into vault-visible partials and preambles."
summary: "Open design issue proposing two primitives for perplexed's template system: {{include: name}} partials and settings-wired preambles, both as vault-visible markdown under zz-cf-lib/. Includes an architecture review of the current seed/load/apply path, a seven-step incremental implementation plan starting with moving the three hardcoded directives out of directoryTemplateService.ts, the deliberate asymmetry in missing-file behavior between partials and preambles, and the seeder caveat that stops template updates from reaching an already-seeded vault."
---

# Partials and preambles for perplexed templates

## Symptom

Shared guidance — mermaid syntax discipline, citation enforcement, image-placement directives, the editorial "anti-incumbent" stance — is duplicated across the four profile templates (`concept-profile`, `vocabulary-profile`, `source-profile`, `toolkit-profile`) AND/OR hardcoded in TypeScript as inlined constants. When the rule needs to change, every copy drifts.

Concrete recent example: a mermaid diagram emitted by a `concept-profile` run for *Residual Learning in AI* used unquoted parens inside node labels (`F1[Layer(s) compute F(x)]`, `H[Output H(x) = F(x) + x]`), which broke mermaid's parser in Obsidian. The fix — a "mermaid syntax discipline" checklist (quote labels with special chars, quote subgraph titles with ids, no bare LaTeX, allowed shapes, etc.) — got pasted into all four templates as a duplicated block. This is the exact failure mode that motivates extracting the rule into a single artifact.

The same shape applies to the three directives currently hardcoded in `src/services/directoryTemplateService.ts:49-51`:

- `INLINE_CITATION_DIRECTIVE` — prepended to every system prompt
- `IMAGE_PLACEMENT_DIRECTIVE` — appended to user prompt when `return-images: true`
- `buildResearchFraming()` — wraps the user skeleton with metadata + skeleton-follows-this framing

These are already preambles in spirit; they just live in code instead of vault-visible markdown.

## Architecture review (so the proposal makes sense)

**Source of truth at build time:** `src/docs/templates/*.md` are bundled into `main.js` via esbuild's text loader and imported statically by `templateSeederService.ts`.

**Seeding:** `seedTemplatesIfMissing()` writes the bundled defaults to `settings.templatesRoot` (this vault uses `zz-cf-lib/templates/`) on first run / when the folder is empty. README always seeded; the four templates only seeded into an empty folder so user edits are never clobbered.

**Runtime:** `listTemplates()` reads **live from the vault**, not from the bundle. Once seeded, `zz-cf-lib/templates/*.md` is authoritative. `loadTemplate()` parses each into a ```cft YAML config + system prompt and a user skeleton (up to the `***` scratch terminator). `applyTemplate()` then:

1. `interpolate(text, ctx)` — mustache-style token replacement only: `{{basename}}`, `{{title}}`, `{{frontmatter}}`, `{{today}}`, `{{frontmatter.X}}`. No includes, no recursion, no async file reads (`directoryTemplateService.ts:278-290`).
2. Prepends the hardcoded `INLINE_CITATION_DIRECTIVE` to the template system prompt.
3. Wraps the user skeleton with `buildResearchFraming()` and optionally `IMAGE_PLACEMENT_DIRECTIVE`.
4. `buildPayload` → POST to Perplexity. (Perplexity's sonar endpoints are OpenAI-compatible text-only `/chat/completions` — no file-upload, no attachment API. Anything shared must be inlined as text.)

## Why this isn't just DRY hygiene

The user-facing intent matters: **partials and preambles must be vault-visible files in `zz-cf-lib/` so users can read, edit, and wikilink to them from notes**, the same way they already do with templates. Hiding shared rules in plugin code makes them invisible to the human writing or debugging a generation. The "templates are vault files" decision is the load-bearing design choice this proposal extends, not subverts.

## Proposed mechanism

Two complementary primitives — same underlying read-a-vault-file-and-splice-text-into-the-prompt — applied at different scopes.

### Partial — `{{include: name}}`

Per-template, opt-in. A template references a partial by name; expansion happens before token interpolation so partials can themselves contain `{{basename}}` etc.

- New folder: `zz-cf-lib/partials/`
- Syntax: `{{include: mermaid-discipline}}` resolves to `zz-cf-lib/partials/mermaid-discipline.md`. Strip frontmatter from the included file, splice the body at the directive's line.
- Recursive expansion with depth limit (5) and cycle detection (`Set<string>` of names being expanded).
- Missing-file behavior: emit a visible inline marker `[[include: <name> — file not found]]` instead of failing the run.

### Preamble — auto-attached to system or user message

Plugin-wide, opt-in via settings. Replaces the three hardcoded directives.

- New folder: `zz-cf-lib/preambles/`
- New settings:
  - `preamblesRoot` — default `zz-cf-lib/preambles`
  - `systemPreambles: string[]` — default `["inline-citation"]`
  - `userPreambles: { name: string; when: "always" | "return-images" }[]` — default `[{research-framing, always}, {image-placement, return-images}]`
- Per-template override via `cft` config keys:
  ```yaml
  preambles:
    system: ["inline-citation", "house-rules"]   # override defaults for this template
    skip-user: ["research-framing"]              # opt out of one
  ```

### Proposed vault layout

```
zz-cf-lib/
├── templates/         (existing — unchanged)
│   ├── concept-profile.md
│   ├── source-profile.md
│   ├── toolkit-profile.md
│   ├── vocabulary-profile.md
│   └── README.md
├── partials/          (new)
│   ├── mermaid-discipline.md
│   ├── editorial-stance-anti-incumbent.md
│   └── README.md
└── preambles/         (new)
    ├── inline-citation.md           (replaces INLINE_CITATION_DIRECTIVE)
    ├── image-placement.md           (replaces IMAGE_PLACEMENT_DIRECTIVE)
    ├── research-framing.md          (replaces buildResearchFraming)
    └── README.md
```

Three peer folders. Partials and preambles separate because they play different roles: partials are referenced explicitly by templates; preambles are wired in by settings and apply to every request.

## Implementation plan (incremental, load-bearing first)

1. **Move the three hardcoded directives** out of `directoryTemplateService.ts:49-51` into bundled markdown files at `src/docs/preambles/{inline-citation,image-placement,research-framing}.md`. Keep them as fallback content when the vault copy is missing.
2. **Create bundled partials** at `src/docs/partials/mermaid-discipline.md` (and any other rules currently duplicated across templates).
3. **Extend `seedTemplatesIfMissing`** to also seed `partialsRoot` and `preamblesRoot` with the bundled defaults — same idempotent rule (only seed when target folder is missing or empty).
4. **Add `expandIncludes(app, text, partialsRoot, seen, depth)`** to `directoryTemplateService.ts` — async, recursive, depth + cycle guarded.
5. **Refactor `applyTemplate`** to:
   - read system + user preamble files (vault first, fall back to bundled defaults)
   - run `expandIncludes` on `cftSystem` and `userSkeleton`
   - then `interpolate` as today
   - assemble: `[system preambles joined] + templateSystem` and `[user preambles up to research-framing] + skeleton + [user preambles after, e.g. image-placement]`
6. **Settings tab additions:** path inputs for the two new roots; comma-separated lists for system / user preamble names with per-template-override docs.
7. **Update the four bundled templates** to use `{{include: mermaid-discipline}}` instead of the duplicated discipline block currently pasted into all four. Delete the duplicates.

## Tradeoffs / decisions baked in

- **Folder layout:** three peers under `zz-cf-lib/` instead of nested `zz-cf-lib/templates/_partials/`. The peer layout is more discoverable in the Obsidian file tree and matches the conceptual separation. Easy to flip if it turns out to be the wrong call.
- **Async expansion:** `interpolate()` stays sync (pure string-replace). New `expandIncludes()` is async because it reads vault files. `applyTemplate` is already async — invisible to callers.
- **Bundle defaults, read from vault at runtime.** Same pattern as templates today. Bundled copy = first-run safety net; vault copy = source of truth once seeded. User edits are sticky.
- **Missing-file behavior asymmetry:**
  - Partial not found → visible inline marker `[[include: <name> — file not found]]`. The user wrote the include explicitly; surface their typo.
  - Preamble not found → fall back to bundled default silently (with `console.warn`). Preambles are infrastructure the user didn't explicitly invoke from this template.
- **No Perplexity-side attachment.** The sonar endpoints don't accept files or system-prompt attachments. Inlining text into `messages` is the only path; this proposal makes that inlining file-driven instead of code-driven.

## Vault-seeding caveat that recurs

Until step 7 ships, existing vault templates still contain the duplicated mermaid-discipline block. The seeder's "only seed empty folders" rule means an updated `src/docs/templates/*.md` won't auto-replace what's already in `zz-cf-lib/templates/`. To roll out template changes mid-design, the user must either copy bundle → vault manually or delete the vault copy and reload the plugin. Worth a short section in the README of `zz-cf-lib/templates/` (and the future `partials/` + `preambles/` READMEs) describing this so the asymmetry isn't surprising.

## Open questions for follow-up

- Should partials support their own frontmatter (e.g., `applies-to: [system, user]` so an include is rejected when used in the wrong slot)? Probably no for v1 — partials are pure snippets — but worth revisiting if misuse appears.
- Should the `cft` config support `preambles: skip-all: true` for a fully bespoke template that wants no global directives? Useful escape hatch; trivial to add.
- Naming: `partial` vs `include` vs `snippet`. Current proposal uses `partial` for the folder and `{{include:}}` for the directive (Liquid/Jekyll convention). Acceptable but worth flagging if a different vocabulary fits the rest of the plugin family.
