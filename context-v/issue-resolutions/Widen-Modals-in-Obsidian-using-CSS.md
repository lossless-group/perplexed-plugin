---
title: "Widening (and Re-Sizing) Obsidian Plugin Modals via CSS"
date_authored: 2026-05-02
status: Resolved
applies_to: Any Obsidian plugin Modal subclass
authored_in_context_of: perplexed → ClaudeModal
related_files:
  - src/modals/ClaudeModal.ts
  - src/styles/claude-modal.css
  - src/styles/perplexity-modal.css   # counter-example (narrow)
  - src/styles/text-enhancement-modal.css   # mixed example (sets max-width on contentEl, partial effect)
---

## TL;DR

The block that controls a Modal's outer width is the **outer DOM element** Obsidian creates for the modal — accessed via `this.modalEl` inside `Modal.onOpen()` — **not** `this.contentEl`. If you add your CSS class to `contentEl` (which is the long-standing convention in plugin examples), your `width` / `max-width` rules apply only to the *inner* content area; the outer `.modal` element keeps Obsidian's default constraints and the modal stays narrow.

**The one-line fix:**

```ts
// In Modal.onOpen()
this.modalEl.addClass('my-modal');   // ← attach to the OUTER element
// not:
// this.contentEl.addClass('my-modal');   // ← inner content area only
```

**The matching CSS:**

```css
.my-modal {
  width: 90vw;
  max-width: 640px;   /* or 800px, 960px — whatever your design wants */
}
```

Now `width` actually does what you'd expect.

---

## The Two DOM Elements You Need to Distinguish

Inside any class extending `Modal` (from `obsidian`), two members are exposed:

| Field        | What it is                                           | Default classes Obsidian adds |
|--------------|------------------------------------------------------|--------------------------------|
| `this.modalEl`   | The OUTER container — the popup itself           | `.modal`                       |
| `this.contentEl` | The INNER content area — the slot you fill in    | `.modal-content`               |

When Obsidian renders a modal, the DOM hierarchy looks like this (simplified):

```
<div class="modal-container">         ← Obsidian's overlay/backdrop
  <div class="modal mod-something">   ← this.modalEl  ← width LIVES HERE
    <div class="modal-close-button">…</div>
    <div class="modal-title">…</div>
    <div class="modal-content">       ← this.contentEl  ← what you fill in
      …your widgets here…
    </div>
  </div>
</div>
```

Obsidian's stock CSS targets `.modal` (the outer one) for the width constraints. Setting `width: 90vw` on `.modal-content` (the inner one) doesn't override the outer element's constraint — the inner one is just sized to fit *inside* whatever the outer container allows.

---

## Why So Many Plugin Modals Stay Narrow

The plugin-template convention — repeated across dozens of community plugins — is:

```ts
onOpen() {
  const { contentEl } = this;
  contentEl.addClass('my-modal');     // ← the convention
  contentEl.createEl('h2', { text: 'My Modal' });
  // …
}
```

Then:

```css
.my-modal {
  width: 90vw;        /* ← applies to .modal-content; NO EFFECT on outer width */
  max-width: 800px;
}
```

The CSS *parses correctly*, the rules *apply*, but the outer `.modal` element is still constrained to ~600px (or whatever Obsidian's theme allows). The inner content area shrinks to fit. You get a narrow modal with extra inner whitespace and conclude "Obsidian doesn't let me size modals." That's the wrong conclusion.

A real example from this repo shows the partial-fix attempt — `text-enhancement-modal.css`:

```css
.text-enhancement-modal {
  max-width: 800px;     /* tries the right values */
  width: 90vw;
  /* …but applied to contentEl, so it doesn't override the outer */
}
```

Visually this modal is wider than the bare default because some theme rules let `.modal-content` push its parent open a bit, but it's still not the 800px it asks for. The `claude-modal` is, because it attaches to `modalEl`.

---

## The Fix, in Full

### Step 1 — attach the class to `modalEl`

```ts
// src/modals/ClaudeModal.ts (excerpt)
import { App, Modal } from 'obsidian';

export class ClaudeModal extends Modal {
  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('claude-modal');   // ← outer element gets the class
    contentEl.empty();
    // …build the body here using contentEl…
  }
}
```

### Step 2 — set width on the outer element

```css
.claude-modal {
  width: 90vw;
  max-width: 640px;
}
```

This is enough to widen the modal. Everything below is layout polish on top.

### Step 3 — kill the default `.modal-content` padding so your own sections control spacing

Obsidian gives `.modal-content` an internal padding (theme-dependent, often ~20px). Once you build a custom layout with header / sections / footer, that built-in padding fights you. Zero it out and put padding on your own children:

```css
.claude-modal .modal-content {
  padding: 0;
}
```

Then each section you build inside `contentEl` gets its own padding:

```css
.claude-modal__header   { padding: 24px 28px 16px; }
.claude-modal__section  { padding: 18px 28px 4px; }
.claude-modal__footer   { padding: 16px 28px 24px; }
```

---

## Width Sizing Strategy: `vw` + `max-width` (the right way)

```css
.claude-modal {
  width: 90vw;
  max-width: 640px;
}
```

**Why both:**

- `width: 90vw` lets the modal grow with the viewport — feels natural on wide monitors and on a side-pane Obsidian window. On a 1440px screen, that's 1296px (clamped by `max-width`); on a 700px window, it's 630px.
- `max-width: 640px` keeps it from becoming an unreadable full-width slab on a 4K display. Pick the value based on content density: form-style modals like this one work at 600–700px; data tables or side-by-side layouts can go to 900–1100px.

**Common width budgets that work well:**

| Modal kind                             | Suggested `max-width` |
|----------------------------------------|------------------------|
| Single-column form (this modal)        | 600–700px              |
| Settings-dense form with inline help   | 800px                  |
| Side-by-side / comparison              | 960–1100px             |
| Full content review (like a paste-in)  | `min(95vw, 1200px)`    |

**Avoid** absolute pixel widths without `vw`. A bare `width: 800px` makes the modal hilariously wide on a narrow Obsidian sidepane and tiny-feeling in a maximized window.

---

## Height: usually let it grow naturally

Don't set a fixed `height` on `.claude-modal`. Obsidian's modal system handles vertical sizing fine — it grows to fit content up to a viewport-relative cap. If you have a large scrollable region inside (say, a long list), constrain *that* with `max-height`, not the whole modal:

```css
.claude-modal__results-list {
  max-height: 50vh;
  overflow-y: auto;
}
```

If you absolutely need a bounded modal height (rare):

```css
.claude-modal {
  max-height: 85vh;
}

.claude-modal .modal-content {
  /* Let the content area scroll if it overflows */
  max-height: calc(85vh - var(--modal-chrome-height, 60px));
  overflow-y: auto;
}
```

But the default behavior is usually right — content-driven modals breathe better when their height isn't capped.

---

## Layout Pattern: header / sections / footer

Once you've claimed the outer width, the next problem is what to do with all that real estate. The pattern that worked here:

```html
<div class="claude-modal">                <!-- modalEl -->
  <div class="modal-content" style="padding: 0">  <!-- contentEl, padding zeroed -->
    <div class="claude-modal__header">    <!-- title + subtitle -->
    <div class="claude-modal__section">   <!-- one logical group -->
    <div class="claude-modal__section">   <!-- another -->
    <div class="claude-modal__footer">    <!-- right-aligned buttons -->
  </div>
</div>
```

```css
.claude-modal__header {
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.claude-modal__section {
  padding: 18px 28px 4px;
}

.claude-modal__section + .claude-modal__section {
  border-top: 1px solid var(--background-modifier-border-hover);
}

.claude-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 28px 24px;
  background-color: var(--background-secondary);
  border-top: 1px solid var(--background-modifier-border);
}
```

**Why this layout works:**

1. **Visual hierarchy without heavy chrome.** Hairline borders (`--background-modifier-border`, `--background-modifier-border-hover`) separate sections without screaming.
2. **Persistent action area.** The `.claude-modal__footer` with `--background-secondary` background reads as "this is where you commit the action." Right-aligned buttons match every native macOS / Windows convention the user expects.
3. **Scoped padding.** Each section owns its padding so you can adjust one without rippling the others.

---

## Theme Token Choices (Why `var(...)` everywhere)

Every color in `claude-modal.css` uses Obsidian's CSS custom properties so the modal inherits the user's theme — light, dark, and any community theme:

| Token                                  | Used for                                      |
|----------------------------------------|------------------------------------------------|
| `--text-normal`                        | Body text, headings                            |
| `--text-muted`                         | Subtitle, descriptions, section labels         |
| `--text-faint`                         | Placeholder text                               |
| `--text-on-accent`                     | Text on the primary CTA button                 |
| `--background-primary`                 | Textarea, default-button background            |
| `--background-secondary`               | Footer tray (subtle "action zone" tint)        |
| `--background-modifier-border`         | Hairline borders between header/footer/body    |
| `--background-modifier-border-hover`   | Subtler hairlines between sub-sections         |
| `--background-modifier-hover`          | Default-button hover state                     |
| `--interactive-accent`                 | CTA button background, focus-ring              |
| `--interactive-accent-hover`           | CTA button hover, focus-ring halo              |
| `--font-text`                          | Textarea font (matches Obsidian's body type)   |

**Don't hardcode `#fff`, `#000`, `#333`** — your modal will look fine in light mode and unreadable in dark mode, or vice versa. Using the tokens means the modal is theme-portable for free.

---

## Native `Setting` Integration

When you build the body in `contentEl`, you can mix raw HTML (for things `Setting` doesn't fit, like a tall textarea) with Obsidian's native `Setting` API (for dropdowns, toggles, side-aligned name+control rows):

```ts
// Inside onOpen()
const optionsSection = contentEl.createDiv({ cls: 'claude-modal__section' });

new Setting(optionsSection)
  .setName('Model')
  .setDesc('Most capable — research / agentic / vision')
  .addDropdown(dd => dd.addOption('claude-opus-4-7', 'Opus 4.7'));

new Setting(optionsSection)
  .setName('Adaptive Thinking')
  .setDesc('Lets Claude reason before answering.')
  .addToggle(t => t.setValue(false));
```

Obsidian's `Setting` renders as a flex row (`.setting-item`) with name+description on the left and the control on the right. To make these fit a custom layout, tighten their default vertical padding:

```css
.claude-modal__section .setting-item {
  padding: 10px 0;
  border-top: none;          /* we're using our own borders between sections */
}

.claude-modal__section .setting-item + .setting-item {
  border-top: 1px solid var(--background-modifier-border-hover);
}
```

The result: native-looking dropdowns/toggles with proper light-and-dark theme support, but spaced to match your custom sections instead of fighting them.

---

## Custom Textarea (Where `Setting` Isn't a Good Fit)

`Setting` puts the control on the right edge — fine for one-line text inputs, terrible for a 6-row textarea. So drop down to raw HTML for the question/prompt area:

```ts
const querySection = contentEl.createDiv({ cls: 'claude-modal__section' });
querySection.createEl('label', {
  text: 'Question',
  cls: 'claude-modal__label',
  attr: { for: 'claude-modal-query' },
});
const queryTextarea = querySection.createEl('textarea', {
  cls: 'claude-modal__textarea',
  attr: { id: 'claude-modal-query', rows: '6', placeholder: '…' },
});
```

```css
.claude-modal__label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.claude-modal__textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px 14px;
  font-family: var(--font-text);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-normal);
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  resize: vertical;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.claude-modal__textarea:focus {
  outline: none;
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 3px var(--interactive-accent-hover);
}

.claude-modal__textarea::placeholder {
  color: var(--text-faint);
}
```

**Why it works:**

- `width: 100%` + `box-sizing: border-box` — fills the parent section width without overflowing because the padding is included in the 100%.
- `resize: vertical` — user can drag taller, can't drag wider (which would break the layout).
- `border-radius: 8px` — slightly larger than Obsidian's default (4px) so the textarea reads as a "card" within the section, distinct from inline text inputs in `Setting` rows.
- `box-shadow: 0 0 0 3px var(--interactive-accent-hover)` on focus — the 3px halo is the trick that makes focus state feel modern; using the *hover* shade of the accent gives a softer ring than the saturated accent itself.

---

## Buttons — BEM-Scoped Plus Obsidian Conventions

```css
.claude-modal__button {
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background-color: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
}

.claude-modal__button:hover    { background-color: var(--background-modifier-hover); }
.claude-modal__button:active   { transform: translateY(1px); }
.claude-modal__button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Primary action — opt into Obsidian's mod-cta convention */
.claude-modal__button.mod-cta {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.claude-modal__button.mod-cta:hover {
  background-color: var(--interactive-accent-hover);
  border-color: var(--interactive-accent-hover);
}
```

**Two design choices worth flagging:**

1. **`mod-cta` is Obsidian's own convention** for primary buttons — they style it themselves in some contexts. Adopting it means the primary button responds to theme tweaks the same way native Obsidian buttons do.
2. **`transform: translateY(1px)` on `:active`** is a 1-line trick that makes a button feel physically clickable. Costs nothing, payoff is large.

---

## Selector Specificity: Use BEM (`__`) to Stay Scoped

```css
.claude-modal__header { … }
.claude-modal__section { … }
.claude-modal__footer { … }
.claude-modal__button { … }
```

**Why BEM and not nested selectors?**

If you write:

```css
.claude-modal .header { … }
.claude-modal .section { … }
```

Then any future child anywhere in the modal that happens to have `class="header"` (e.g., from a third-party widget) gets unexpectedly styled. BEM-style `__` selectors are flat and unambiguous — `.claude-modal__header` only matches the element you explicitly named.

Inside the modal you can still target Obsidian-native classes when you need to override them (`.claude-modal .modal-content`, `.claude-modal .setting-item`), and that's fine because those are intentional override hooks.

---

## Responsive Breakpoint

```css
@media (max-width: 600px) {
  .claude-modal {
    width: 95vw;
    max-width: none;          /* let it fill the narrow viewport */
  }

  .claude-modal__header,
  .claude-modal__section,
  .claude-modal__footer {
    padding-left: 18px;       /* tighter padding on small screens */
    padding-right: 18px;
  }

  .claude-modal__footer {
    flex-direction: column-reverse;   /* stack buttons; CTA on top */
  }

  .claude-modal__button {
    width: 100%;              /* full-width tap targets */
  }
}
```

**Notes on the breakpoint choices:**

- `600px` is the natural threshold where a side-by-side button layout stops feeling comfortable. Below that, stack.
- `column-reverse` puts the primary CTA *above* the Cancel — on mobile thumb-reach UIs this is the dominant convention (the action you're most likely to tap is closer to the bottom screen edge).
- `max-width: none` (rather than `max-width: 95vw`) explicitly tells the cascade to ignore the inherited max-width — important because forgetting this means the modal stays at 640px even though `width: 95vw` is now smaller, leaving an awkward gap.

---

## Common Gotchas

**1. Adding the class to both `modalEl` and `contentEl`.**
Don't. You'll have two ambiguous scopes. Pick `modalEl` and stick with it; target `.modal-content` from inside that scope when you need to.

**2. Forgetting to zero the `.modal-content` padding.**
Your section borders will look indented because Obsidian's default ~20px padding is still there.

```css
.claude-modal .modal-content { padding: 0; }
```

**3. Hardcoding colors / fonts.**
Breaks dark mode and breaks community themes. Always reach for `var(--text-normal)`, `var(--font-text)`, etc. before reaching for hex codes.

**4. Setting `height` instead of letting content drive it.**
A fixed-height modal with shorter content gets dead space; with longer content gets cut off. Let height be content-driven; cap *internal* scrollable regions instead.

**5. Using class names that collide with Obsidian's own.**
Anything starting with `mod-`, `is-`, `has-`, `setting-`, `modal-`, `workspace-`, `nav-` is risky — those prefixes are Obsidian's. Prefix with your plugin name (`claude-modal__…`).

**6. CSS file not being picked up.**
If your build pipeline uses esbuild and an aggregated `main.css`, **make sure your new `.css` file is `@import`-ed** from `src/styles/main.css`. The build won't error if you forget — your new styles will simply not appear in the compiled `styles.css`.

```css
/* src/styles/main.css */
@import './claude-modal.css';
```

---

## Complete Working Reference (Copy-Paste Starter)

A minimal, complete CSS file for a wide modal. Pair with `modalEl.addClass('my-modal')` in `onOpen()`.

```css
/* === my-modal.css ============================================== */

.my-modal {
  width: 90vw;
  max-width: 640px;
}

.my-modal .modal-content {
  padding: 0;
}

/* Header */
.my-modal__header {
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.my-modal__title {
  margin: 0 0 6px;
  font-size: 1.5em;
  font-weight: 600;
  color: var(--text-normal);
}

.my-modal__subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-muted);
}

/* Sections */
.my-modal__section {
  padding: 18px 28px 4px;
}

.my-modal__section + .my-modal__section {
  border-top: 1px solid var(--background-modifier-border-hover);
}

.my-modal__section .setting-item {
  padding: 10px 0;
  border-top: none;
}

.my-modal__section .setting-item + .setting-item {
  border-top: 1px solid var(--background-modifier-border-hover);
}

/* Footer */
.my-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 28px 24px;
  margin-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
  background-color: var(--background-secondary);
}

.my-modal__button {
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background-color: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
}

.my-modal__button:hover  { background-color: var(--background-modifier-hover); }
.my-modal__button:active { transform: translateY(1px); }
.my-modal__button:disabled { opacity: 0.5; cursor: not-allowed; }

.my-modal__button.mod-cta {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.my-modal__button.mod-cta:hover {
  background-color: var(--interactive-accent-hover);
  border-color: var(--interactive-accent-hover);
}

/* Responsive */
@media (max-width: 600px) {
  .my-modal { width: 95vw; max-width: none; }
  .my-modal__header, .my-modal__section, .my-modal__footer {
    padding-left: 18px;
    padding-right: 18px;
  }
  .my-modal__footer { flex-direction: column-reverse; }
  .my-modal__button { width: 100%; }
}
```

And the matching modal class skeleton:

```ts
import { App, Modal } from 'obsidian';

export class MyModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('my-modal');     // ← THE LINE THAT WIDENS IT
    contentEl.empty();

    const header = contentEl.createDiv({ cls: 'my-modal__header' });
    header.createEl('h2', { text: 'My Modal', cls: 'my-modal__title' });
    header.createEl('p', { text: 'Subtitle / explainer.', cls: 'my-modal__subtitle' });

    const section = contentEl.createDiv({ cls: 'my-modal__section' });
    // …add Settings / inputs here…

    const footer = contentEl.createDiv({ cls: 'my-modal__footer' });
    const cancel = footer.createEl('button', { text: 'Cancel', cls: 'my-modal__button' });
    const ok = footer.createEl('button', { text: 'OK', cls: 'my-modal__button mod-cta' });
    cancel.addEventListener('click', () => this.close());
    ok.addEventListener('click', () => { /* … */ });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

---

## Verification Receipts (from this repo)

- **Working wide modal** — `src/modals/ClaudeModal.ts` + `src/styles/claude-modal.css`. Uses `modalEl.addClass(...)`. Renders at 640px max in normal viewport.
- **Narrow modal (counter-example)** — `src/modals/PerplexityModal.ts` + `src/styles/perplexity-modal.css`. Uses `contentEl.addClass(...)`. CSS sets `width: 100%` on inputs but never on the modal container; outer width stays at Obsidian default.
- **Partial-fix attempt** — `src/styles/text-enhancement-modal.css`. Sets `max-width: 800px` on `.text-enhancement-modal`, but the class is added to `contentEl` in `TextEnhancementModal.ts`, so the rule applies to the inner content area only and the outer modal stays at the Obsidian default. This is the diff that showed us why the convention fails.

---

## When You Want to Apply This to Existing Modals

For each modal you want to widen:

1. In the `.ts` file, change:

   ```ts
   contentEl.addClass('my-modal');
   ```

   to:

   ```ts
   modalEl.addClass('my-modal');
   ```

2. In the matching `.css` file, add (or confirm):

   ```css
   .my-modal {
     width: 90vw;
     max-width: <your-target>;
   }
   .my-modal .modal-content { padding: 0; }
   ```

3. Move whatever inner-content padding you previously relied on (Obsidian's default) into your own `__section` / `__header` / `__footer` rules.

4. Rebuild (`pnpm run build` or your equivalent) — the change is purely DOM + CSS, no runtime cost, no API impact.

That's the whole fix. The mystery isn't in the CSS — it's in which DOM node the CSS targets.
