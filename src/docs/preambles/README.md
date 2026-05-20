# Preambles

Plugin-wide text fragments that get prepended (or appended) to every Perplexity request the directory-template feature sends. Unlike templates (per-directory) and partials (per-template, opt-in), preambles apply to **every** request unless a specific template overrides them.

## Wiring

Configured under "Directory templates" in the Perplexed settings tab:

- **System preambles** (default: `inline-citation`) — joined with blank lines and prepended to the template's own `system:` block before sending to Perplexity.
- **User preambles** (default: `research-framing` always, `image-placement` when the template sets `return-images: true`) — `research-framing` wraps the user skeleton; `image-placement` is appended after it.

## Per-template override

A template's ```cft fence may override the defaults:

```yaml
preambles:
  system: ["inline-citation", "house-rules"]   # replace defaults for this template
  skip-user: ["research-framing"]              # opt out of one user preamble
```

## Fallback

If a preamble file referenced by settings is missing from this folder, the plugin falls back to a bundled default (the original hardcoded text from before this feature shipped). Missing-preamble silence is intentional — preambles are infrastructure, not content. Check the console for a `console.warn` if you suspect drift.

## Authoring

Preambles support the same `{{basename}}` / `{{title}}` / `{{frontmatter}}` / `{{today}}` / `{{frontmatter.X}}` tokens as templates, and may also use `{{include: <partial-name>}}` to pull in a shared snippet from the partials folder.
