**Obsidian MathJax discipline — Obsidian uses `$$...$$` for block math and `$...$` for inline math, NOT the `\[...\]` / `\(...\)` form.** Math wrapped in `\[...\]` or `\(...\)` renders as literal escape sequences, not as a formula.

**Block math** uses `$$...$$`:

- BAD:  `\[\text{CAGR} = (V_e / V_b)^{1/n} - 1\]`
- GOOD: `$$\text{CAGR} = (V_e / V_b)^{1/n} - 1$$`

**Inline math** uses `$...$`:

- BAD:  `where \(n\) is the number of years`
- GOOD: `where $n$ is the number of years`

**Escape literal dollar signs as `\$` in prose.** If you mention a dollar amount anywhere in the document, escape the currency symbol so Obsidian does not pair it with another `$` and try to render the span between as inline math.

- BAD:  `revenue grew from $500,000 to $2.5M`
- GOOD: `revenue grew from \$500,000 to \$2.5M`

This applies throughout the document, not just near math blocks. Two unescaped `$` characters in the same paragraph will be parsed as an inline-math span no matter how far apart they are.
