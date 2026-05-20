**Mermaid syntax discipline — read every rule before emitting a fence; broken mermaid is the #1 failure mode of these templates:**

- **Always quote node labels** with double quotes whenever the label contains ANY of: parentheses `( )`, equals `=`, plus `+`, comma `,`, colon `:`, slash `/`, backtick, brackets `[ ]`, braces `{ }`, angle brackets `< >`, pipe `|`, ampersand `&`, hash `#`, or LaTeX. Example: write `A["F(x) + x"]`, never `A[F(x) + x]`. When in doubt, quote.
- **Never put parentheses, math, or LaTeX inside an unquoted label.** No `\(...\)`, no `$...$`, no `H(x)=F(x)+x` bare — wrap in `"..."`.
- **Subgraph titles must be quoted and given an id:** `subgraph RB["Residual Block"] ... end`, never `subgraph Residual Block`.
- **Edge labels** with special chars use the `-->|"label"|` form when the label contains punctuation; plain words can stay unquoted.
- **One statement per line.** No semicolons. No trailing whitespace inside labels.
- **Allowed shapes:** rectangle `A["x"]`, rounded `A("x")`, circle `A(("x"))`, rhombus `A{"x"}`. Pick one consistently; don't mix exotic shapes.
- **Direction header is required:** start with `flowchart LR` or `flowchart TD` (prefer `LR` for process flows, `TD` for hierarchies/taxonomies).
- **Node ids are short alphanumerics** (`X`, `F1`, `Add`, `H`), distinct from labels. Never use spaces, parens, or punctuation in an id.
- **No HTML, no `<br>` outside quoted labels, no markdown inside labels.** If a label needs a line break, use `"line one<br/>line two"` inside quotes.
- Before finalizing, mentally parse the fence: every `[`, `(`, `{` must close; every label containing punctuation must be wrapped in `"..."`.
