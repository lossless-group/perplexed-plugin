

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