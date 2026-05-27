**Mermaid syntax discipline — read every rule before emitting a fence; broken mermaid is the #1 failure mode of these templates.** Mermaid is a strict parser. Every chart you emit must follow these rules or the page renders a syntax error instead of the diagram. Each rule below pairs a BAD example with a GOOD example — match the GOOD shape exactly.

**Quote every multi-word node and edge label in double quotes.** The parser cannot handle `(`, `)`, `&`, `:`, `,`, `/`, `#`, `=`, `+`, `[`, `]`, `{`, `}`, `<`, `>`, `|`, backtick, or LaTeX syntax inside a bare label. When in doubt, quote.

- BAD:  `A[Raw inputs (text, audio)]`
- GOOD: `A["Raw inputs (text, audio)"]`

- BAD:  `B -->|Sends data & status| C`
- GOOD: `B -->|"Sends data &amp; status"| C`

**Escape `&` as `&amp;` inside quoted labels.** Bare `&` is interpreted as the start of an HTML entity even when the label is quoted.

- BAD:  `D["Search & filter"]`
- GOOD: `D["Search &amp; filter"]`

**No nested double quotes.** The outer `"..."` is the only quoting layer the parser supports. Drop the inner quotes or rephrase.

- BAD:  `B["Legal view<br/>\"Which laws apply?\""]`
- GOOD: `B["Legal view<br/>Which laws apply?"]`

**Line breaks inside labels are `<br/>`, never `\n`.** `\n` renders as the literal two characters backslash-n.

- BAD:  `B1[Membrane potential\nintegrates spikes]`
- GOOD: `B1["Membrane potential<br/>integrates spikes"]`

**Subgraph titles with spaces need an ID plus a quoted display title.** A bare `subgraph My Title` breaks in stricter renderers.

- BAD:  `subgraph Spiking neuron dynamics`
- GOOD: `subgraph Spiking_neuron_dynamics ["Spiking neuron dynamics"]`

**Quote decision-node (diamond) labels too.** Same rules as `[...]` labels apply to `{...}` shapes.

- BAD:  `B2{Threshold reached?}`
- GOOD: `B2{"Threshold reached?"}`

**Allowed shapes:** rectangle `A["x"]`, rounded `A("x")`, circle `A(("x"))`, decision/rhombus `A{"x"}`. Pick one consistently per fence; don't mix exotic shapes.

**Structural rules every fence must follow:**

- Start with a direction header: `flowchart LR` for process flows, `flowchart TD` for hierarchies or taxonomies.
- Node IDs are short alphanumerics (`X`, `F1`, `Add`, `H`) — distinct from labels, no spaces, no punctuation.
- One statement per line. No semicolons. No trailing whitespace inside labels.
- No HTML outside quoted labels. No markdown inside labels.

**Self-check before emitting the ` ```mermaid ` block.** Mentally walk every node and edge label and confirm all six:

1. Every multi-word label is wrapped in `"..."`.
2. Every `&` inside a label is written `&amp;`.
3. No label contains nested `"`.
4. Every line break inside a label is `<br/>`, not `\n`.
5. Every subgraph whose title contains a space uses the `id ["display title"]` form.
6. Every `[`, `(`, `{` has a matching close.

If you cannot satisfy all six, **simplify the labels** (drop the parenthetical sub-text, replace `&` with "and", shorten the phrasing) rather than emit a broken diagram. Do not emit a fence you cannot validate. A working diagram with shortened labels is always better than a broken diagram with the labels you wanted.
