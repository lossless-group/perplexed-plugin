---
title: "Plan — Upgrade Perplexed to Obsidian 1.13 (0.4.0)"
lede: "Perplexed has 56 settings across six research providers, and none of them show up in Obsidian's new settings search. 0.4.0 fixes that."
summary: "Execution plan for Perplexed 0.4.0: current toolchain, a zero-dependency test suite (command registration + settings definitions), the 787-line imperative settings tab rebuilt on getSettingDefinitions(), minAppVersion 1.13.0, docs, and release. Third plugin through the family migration after Image Gin 0.3.0 and Cite Wide 0.3.0; follows content-farm/context-v/plans/Migrate-Plugin-Family-to-Obsidian-1-13.md."
publish: true
date_created: 2026-10-06
date_modified: 2026-10-06
date_authored_initial_draft: 2026-10-06
date_authored_current_draft: 2026-10-06
date_authored_final_draft:
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
at_semantic_version: 0.0.0.1
site_uuid: 575bc1c0-1a09-4f97-84d8-ad55e8baf41d
hex_code: 735emd
status: Implementing
tags:
  - Plan
  - Obsidian-Plugin
  - Obsidian-1-13
  - Release-0-4-0
---

# Plan — Upgrade Perplexed to Obsidian 1.13 (0.4.0)

## Why Care?

Perplexed is the research plugin. It covers six providers (Perplexity, Claude, Gemini, LM Studio, Perplexica, Exa), prompt libraries, and per-directory templates, configured through 56 settings. On Obsidian 1.13 and later, none of those settings appear in settings search, because the tab predates Obsidian's declarative settings API. On Image Gin, that same hand-drawn style of tab broke outright on Obsidian 1.14 and hid half its settings.

## Starting point (surveyed 2026-10-06)

- Version **0.3.1**, `minAppVersion` 1.8.10. Tags `0.3.1` / `0.3.0` / `0.2.1`; the default branch is **`main`**, and releases sit on `development`, `main`, and `master` alike.
- Already has `eslint-plugin-obsidianmd` 0.4.1 and its own `pnpm-workspace.yaml` (`packages: ['.']`). It lacks `allowBuilds` for pnpm 11 and later.
- **No tests.**
- The settings tab is `PerplexedSettingTab` in `main.ts` (lines ~1466–2252, 787 lines, 56 rows), with an imperative `display()`.
- The vault loads it through a symlink to this repo; its live `data.json` has 33 keys.

## Steps

| # | Step | Done when |
|---|---|---|
| 1 | **Toolchain:** `obsidian` 1.13.1 (pinned), ESLint 10.12, typescript-eslint 8.71.1, eslint-plugin-obsidianmd 0.4.2, esbuild 0.28.2. **Held:** TypeScript 6.0.3 (typescript-eslint supports `<6.1`) and `@types/node` 22 (a 1.13 user can still be on Node 22). Add `allowBuilds` to `pnpm-workspace.yaml`. | Lint clean outside the settings tab; `CI=true pnpm@10 install --frozen-lockfile` passes |
| 2 | **Tests**, red first, with the zero-dependency harness (esbuild + `node:test`) copied from Cite Wide | `pnpm test` runs |
| 2a | `onload()` registers every current command ID | All IDs listed |
| 2b | Settings definitions: every current row present, every key valid, no `display()` override, nested get/set if any; a render check using the live `data.json` shape | Red, then green |
| 3 | **Settings tab** on `getSettingDefinitions()`. Prompt libraries become `type: 'list'`; providers become groups with `visible` dependents. Version 0.3.1 → **0.4.0**, `minAppVersion` → **1.13.0**, across `manifest.json`, `package.json`, and `versions.json`. | ESLint 0 errors and 0 warnings; all tests green |
| 4 | **Docs:** README (minimum version, stale content), a changelog entry, `changelog/releases/0.4.0.md` | Committed |
| 5 | **Real-world check:** load the built `main.js` with the live `data.json` outside Obsidian; every command registers | Passes |
| 6 | **Release:** fast-forward `development` → `main` → `master`, tag `0.4.0` (no `v`), verify assets and attestations, bump the parent pointer | Release live |

## Gates (before every code commit)

- `pnpm test`
- `tsc -noEmit -skipLibCheck`
- ESLint 0/0
- `node esbuild.config.mjs production`
- `CI=true pnpm@10 install --frozen-lockfile` (when dependencies change)

## Stand-alone rule

Perplexed installs, builds, tests, and releases on its own. The harness and patterns are **copied** from Cite Wide and Image Gin, never imported.

## Related

- `content-farm/context-v/plans/Migrate-Plugin-Family-to-Obsidian-1-13.md`
- `cite-wide/context-v/plans/2026-10-06_Upgrade-Cite-Wide-to-Obsidian-1-13.md`: the most recent run of this playbook
