On the Outlines folder feature — yes, totally feasible and a great unlock. Sketch:

  - New plugin setting: outlinesFolderPath (default Outlines-Perplexed).
  - Each .md file in that folder = one template. Frontmatter declares name, description, provider
  (perplexity | claude | both), optional model, optional effort. Body is the prompt with {{TERM}} /
  {{TOPIC}} / {{QUERY}} placeholders.
  - New command: "Generate from Outline…" opens a modal with: outline picker (dropdown of files in
  the folder), term/topic input, provider/model overrides, submit.
  - ArticleGeneratorModal becomes one built-in outline (deep-research one-pager) — same flow, no
  special-casing.

  This decouples your prompt library from the codebase entirely. Add a new template = drop a .md in
  the folder, no rebuild needed. It ALSO means when Claude does work, you can author Claude-specific
  outlines without touching code.