

- main.ts:95, 99 — example query content in the default JSON template ("What is Perplexica's
  architecture?"); it's example text, not a UI label.
  - main.ts:525 — internal throw new Error('Perplexica service not initialized') — surfaces in dev
  console only.
  - main.ts comments referring to "Perplexica" sections — code comments.
  - README.md:98, 100, 102 — inside the rename callout that distinguishes the two names by design.
  - All class names (PerplexicaService, PerplexicaModal), method names (queryPerplexica,
  registerPerplexicaCommands), CSS classes, command IDs, settings field names — internal; renaming
  would break compatibility or require migration.