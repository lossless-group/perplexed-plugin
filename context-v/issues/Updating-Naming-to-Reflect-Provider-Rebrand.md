---
site_uuid: dda3ed2d-93dd-42a9-9556-6d649611c6bb
hex_code: s4w7op
title: Updating Naming to Reflect Provider Rebrand
date_created: 2026-05-04
date_authored_initial_draft: 2026-05-04
date_authored_current_draft: 2026-05-04
authors:
  - Michael Staton
at_semantic_version: 0.0.1.0
tags:
  - Issue
lede: "Inventory of the Perplexica mentions that deliberately stay — class names, command IDs, settings fields, where renaming would break things."
summary: "Fragmentary issue note listing the Perplexica references in perplexed that survive the rebrand on purpose: example prompt text, an internal error string, code comments, a README callout that distinguishes the two names by design, and all class, method, CSS, command-ID, and settings-field identifiers. Treat it as the do-not-rename list before any find-and-replace across perplexed; renaming the identifiers would break compatibility or require a settings migration."
---


- main.ts:95, 99 — example query content in the default JSON template ("What is Perplexica's
  architecture?"); it's example text, not a UI label.
  - main.ts:525 — internal throw new Error('Perplexica service not initialized') — surfaces in dev
  console only.
  - main.ts comments referring to "Perplexica" sections — code comments.
  - README.md:98, 100, 102 — inside the rename callout that distinguishes the two names by design.
  - All class names (PerplexicaService, PerplexicaModal), method names (queryPerplexica,
  registerPerplexicaCommands), CSS classes, command IDs, settings field names — internal; renaming
  would break compatibility or require migration.