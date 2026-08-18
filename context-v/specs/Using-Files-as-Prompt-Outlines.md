---
site_uuid: f33b9e0c-1ba5-4709-8c64-470981a84851
hex_code: lr8oid
title: Using Files as Prompt Outlines
date_created: 2026-05-02
date_authored_initial_draft: 2026-05-02
date_authored_current_draft: 2026-05-02
authors:
  - Michael Staton
at_semantic_version: 0.0.1.0
tags:
  - Spec
lede: "Prompt outlines become ordinary vault markdown, so adding one is dropping a file — and ArticleGeneratorModal stops being special-cased."
summary: "Early spec sketching outline-as-file for perplexed: two new commands, three new settings paths under a Content-Dev folder, an outline frontmatter shape declaring provider/model pairs, and a suggested body structure. Level-1 headings are prohibited in outline bodies because they break the model's nesting of the response. Read it against the later and more developed template system in content-farm's Per-Directory-Profile-Templates spec and perplexed's partials-and-preambles issue, which cover much of the same ground."
---


# Using Files as Prompt Outlines

## Development Goals

- New command: "Generate Prompt Outline from Template"
- New command: "Generate Prompt from Outline" opens a modal with: outline picker 
- ArticleGeneratorModal becomes one built-in outline (deep-research one-pager) — same flow, no
  special-casing.

## User Goals

An Obsidian user can create a folder that will host prompt outlines as markdown files.

## Sketch
  - New plugin settings
  - `contentDevFolderPath` (default `Content-Dev`) // nested folder for content development
   - `outlinesFolderPath` (default `Content-Dev/Outlines`)
   - `templatesFolderPath` (default `Content-Dev/Templates`)
  - Each .md file in that folder = one outline. Frontmatter declares 
  ```yaml
  title: String
  main_inquriy: String
  description: String
  providers_models: Array<string> // ("perplexity: {model}" | "perplexica: {model}" | "claude: {model}")
  ```
  Body is the prompt with optional preferred structure:

```markdown
  # Example Content
  {Obsidian backlink syntax to other files, optional}

  # Background

  {paragraph context eg background info, goals, user situation, model role eg analyst, academic, marketer, scientist, newsroom, columnist, optional}
  
  # Section Outline for Response
  
  {## Section Headers} // optional // must be level 2 headers or greater. No Level 1 headers, as it will mess with the LLM's ability to nest/parse the outline for the response with other elements.
  
  {ul or li list guiding questions, optional}
  
  {preferences or spectations for response eg dos and donts, optional}
  
  {preferences on research sources, include exclude ul, optional}
``` 


This decouples your prompt library from the codebase entirely. Add a new template = drop a .md in
the folder, no rebuild needed. It ALSO means when Claude does work, you can author Claude-specific
outlines without touching code.