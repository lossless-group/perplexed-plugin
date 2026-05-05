---
title: "This Is an Obsidian Plugin — Read the Obsidian API Docs"
purpose: "Reminder for any human or AI working in this codebase: this is an Obsidian plugin. The Obsidian API at https://github.com/obsidianmd/obsidian-api is the source of truth. Consult it before guessing API shapes, and re-read it whenever the community plugin review bot flags something."
status: Authoritative
last_verified: 2026-05-04
applies_to: any plugin in the lossless-group/content-farm ecosystem
authors:
  - Michael Staton
augmented_with: Claude Code on Claude Opus 4.7 (1M context)
---

## The one rule

You are working on an Obsidian plugin. **The Obsidian API is the source of truth.**

- Canonical types and method signatures: <https://github.com/obsidianmd/obsidian-api>
- Developer docs: <https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin>
- Sample plugin: <https://github.com/obsidianmd/obsidian-sample-plugin>

Do not invent API shapes. Do not guess. Obsidian runs on Electron with a custom DOM model; browser conventions you reach for from muscle memory often do not apply.

## Common review-bot rejection reasons

The community plugin review bot is automated and uncompromising. The most frequent rejection reasons we (and others) hit:

- **`any` types — banned.** Use the actual types from the `obsidian` package. `eslint-disable` workarounds are themselves rejection reasons.
- **`innerHTML` / `outerHTML` — banned.** Use `createEl`, `setText`, `empty()`, etc.
- **`var` — banned.** `let` / `const` only.
- **Direct DOM manipulation outside the plugin's container.** Don't reach into Obsidian's UI from your plugin's code.
- **`console.log` left in shipped code.** Flagged.
- **Missing or incorrect `manifest.json` fields.** `id`, `name`, `version`, `minAppVersion`, `description`, `author`, and `isDesktopOnly` are mandatory.
- **Mobile compatibility.** Set `isDesktopOnly: true` honestly if you depend on Node APIs, or write a mobile-safe path.

## When in doubt

Read the API. Check the sample plugin. Look at how an existing plugin in this farm solves the same problem — the suite is small enough to grep across via the `content-farm` pseudomonorepo. If still unsure, write a small test in the dev sandbox before committing to the API call.

This file exists because it is *very easy* to write code that compiles and runs locally but gets rejected at submission time. The rule was learned the hard way; do not relearn it.
