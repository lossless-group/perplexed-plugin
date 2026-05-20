# Partials

Reusable snippets referenced from templates via `{{include: <name>}}`. The plugin reads partials live from this folder at request time, so edits take effect on the next "Apply template" run without rebuilding the plugin.

## Syntax

In a template (or preamble, or another partial):

```
{{include: mermaid-discipline}}
```

Resolves to `<partialsRoot>/mermaid-discipline.md`. The `.md` extension is optional. Frontmatter in the partial is stripped before splicing.

## Recursion

Partials may include other partials. The expander enforces:

- **Max depth 5** — guards against accidental deep nesting.
- **Cycle detection** — a partial that (transitively) includes itself errors at the cycle, not by stack overflow.

## Missing-file behavior

A typo or missing partial surfaces as an inline marker in the output:

```
[[include: typo-name — file not found]]
```

This is intentional — partials are explicitly invoked from the template, so a missing one is the user's bug to fix, not infrastructure to paper over.

## Tokens

Partials support the same `{{basename}}` / `{{title}}` / `{{frontmatter}}` / `{{today}}` / `{{frontmatter.X}}` tokens as templates. Token substitution runs **after** include expansion, so partials may reference any token the calling template would have access to.
