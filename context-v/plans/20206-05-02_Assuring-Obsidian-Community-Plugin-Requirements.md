---
title: "Plan — Bring Perplexed up to Obsidian Community-Plugin Publishing Standards"
status: Proposed
created: 2026-05-02
applies_to: perplexed Obsidian plugin
authors:
  - Michael Staton
augmented_with: Claude Code (Opus 4.7, 1M context)
related_reference: ../../cite-wide/context-v/reminders/Obsidian-Type-Safety.md
---

# Plan — Bring Perplexed up to Obsidian Community-Plugin Publishing Standards

## Context

The Perplexed Obsidian plugin (`/Users/mpstaton/code/lossless-monorepo/perplexed`) is being prepped for submission to the Obsidian community plugin marketplace. Its sister plugin `cite-wide` was rejected last week for type-safety violations (specifically `any` usage), and the rules that triggered that rejection are enforced automatically by `ObsidianReviewBot` on every submission PR with **no appeal mechanism**. There is also a set of metadata/repo-hygiene requirements that block submission independently.

The reference doc — `/Users/mpstaton/code/lossless-monorepo/cite-wide/context-v/reminders/Obsidian-Type-Safety.md` — captures the rules verbatim from the review bot and the patterns to satisfy them. This plan applies those rules to Perplexed and bundles in the non-type-safety publishing fixes uncovered during the audit.

**Audit totals:** 25 explicit-`any` sites + 3 `as any` casts + 5 metadata/repo blockers + ESLint config that lets `any` through as a warning. No floating-promises, no `[object Object]` interpolations, no `innerHTML`, no `(window as any)` patterns, no hand-rolled YAML (Perplexed doesn't touch frontmatter — different surface area than cite-wide). Critical files all reviewed.

---

## Phase 1 — Tighten ESLint to Match the Review Bot

**Why first:** if the local lint config matches the bot, we catch every remaining issue during `pnpm build` instead of at submission. The current config (`eslint.config.mjs:29`) has `no-explicit-any: "warn"` which lets violations through.

**File:** `/Users/mpstaton/code/lossless-monorepo/perplexed/eslint.config.mjs`

Change the `rules` block:
- `"@typescript-eslint/no-explicit-any": "error"` (was `"warn"`)
- Add `"@typescript-eslint/no-unnecessary-type-assertion": "error"`
- Add `"@typescript-eslint/no-floating-promises": "error"`
- Add `"@typescript-eslint/no-base-to-string": "error"`
- `"@typescript-eslint/no-unused-vars": ["error", { args: "none" }]` — already present, keep
- Add CLI flag in `package.json` build script: `eslint . --report-unused-disable-directives` before `tsc`. Current build script: `"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"` — change to `"build": "eslint . --report-unused-disable-directives && tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"`.

After this change, `pnpm build` will fail loudly. That failure surface drives the rest of the plan.

---

## Phase 2 — Fix Manifest, Versions, and Package Metadata

**Why:** four-part version strings (`X.Y.Z.W`) are not semver and the bot rejects them. The `minAppVersion` placeholder will also be flagged.

### 2.1 `manifest.json`
- `version`: `"0.0.0.1"` → `"0.0.1"`
- `minAppVersion`: `"0.0.0.1"` → `"0.15.0"` (matches the sole entry in `versions.json`; safe baseline for current Obsidian APIs we use)

### 2.2 `versions.json`
- Key `"0.0.1.0"` → `"0.0.1"` (must match the new manifest version, must be valid semver)

### 2.3 `package.json`
- `version`: `"0.0.0.6"` → `"0.0.1"` (sync to manifest)
- Remove unused dependencies confirmed not imported anywhere in `src/` or `main.ts`:
  - `fastify`
  - `@modelcontextprotocol/sdk`
  - `zod`
  - Keep: `dotenv`, `@anthropic-ai/sdk` (the latter is used by `claudeService.ts`)
- After removal: `pnpm install` (or `npm install`) to regenerate the lockfile.

---

## Phase 3 — Add LICENSE File

**Why:** `package.json` declares MIT but no `LICENSE` file exists at the repo root. Obsidian's submission requirements expect the license file to be present and discoverable.

- Create `/Users/mpstaton/code/lossless-monorepo/perplexed/LICENSE` with the standard MIT license text, copyright year `2025-2026`, copyright holder `The Lossless Group` (matches `manifest.json` author).

---

## Phase 4 — Eliminate `any` (the type-safety pass)

**Why:** this is the rule that rejected cite-wide. 25 sites + 3 casts must be eliminated. The reference doc's §2 and §5 give the exact replacement patterns.

Order chosen so each step compiles cleanly before the next:

### 4.1 Fix the ambient shim — `src/types/obsidian.d.ts:5`

`commands: any` → minimal documented interface for the methods Perplexed actually calls. Search `main.ts` and services for `app.commands.*` usage and type only what's used (likely `executeCommandById(id: string): boolean` and `commands: Record<string, { id: string; name: string }>`). If usage is one-off, fall back to `unknown` and narrow at the call site.

### 4.2 Fix the logger — `src/utils/logger.ts`

Six sites, all the same pattern: replace every `details?: any` and `details: any` with `details?: unknown`.
- Line 8: `details?: any;` (in `LogEntry` interface)
- Line 81: `addEntry(... details?: any)`
- Lines 109, 113, 117, 121: `error/warn/info/debug(message: string, details?: any)`

The logger only stringifies `details` — no structural access — so `unknown` is a drop-in replacement. The one exception is line 86 (`details instanceof Error`), which is already a proper narrowing and works identically against `unknown`.

### 4.3 Fix the date util — `src/utils/formatDate.ts`

Lines 41, 58: `source: any` → `source: unknown`. Add an internal `Source` interface (the `getMostRecentDate` and `formatPublicationInfo` functions look for `date_published`, `last_updated`, etc. — read both functions, define the interface from the actual field accesses, then narrow with the `isRecord` guard from the reference doc §3.3 before reading fields). This requires also adding a small `coerce.ts` helper file with `isRecord`, `asString`, and `asDate` (same shapes from the reference doc) — these will be reused in 4.4.

**New file to create:** `src/utils/coerce.ts` — copy the `asString`, `asNumber`, `asStringArray`, `asDate`, `isRecord` helpers verbatim from the reference doc §3.3. They are general-purpose and will pay for themselves several times in 4.4.

### 4.4 Fix the API service payload types — `src/services/{perplexity,perplexica,lmStudio}Service.ts`

Three services share the same shape problems:
- `promptsService?: any` and `private promptsService: any` (in constructor options + class field)
- `let payload: any` (request body builder)
- API response objects like `finalResponseData: any` and `images: any[]`

**Per-service fixes:**

`perplexicaService.ts` — Lines 7, 17, 77.
- Replace `promptsService` field/option type with `import type { PromptsService } from './promptsService'`. (Direct import; the cyclical-init concern in the reference doc §5.5 is about singleton patterns, which Perplexed doesn't have — these are constructor params.)
- Define `interface PerplexicaPayload { ... }` from the actual fields assigned (read lines ~70–110 to see what's set on `payload`).

`perplexityService.ts` — Lines 14, 21, 51, 232, 397, 609, 707, 761, 777, plus the three `as any` casts at 225/227/228.
- Same `PromptsService` import for fields/options.
- Define `interface PerplexityPayload`, `interface PerplexityImage`, `interface PerplexitySource`, and `interface PerplexityResponse` from the response shape Perplexity returns (read lines 600–800 to enumerate fields actually accessed). Make the response interface use `unknown` for fields the code doesn't dereference, and concrete types for fields it does.
- The `loadingInterval` casts (`(this as any).loadingInterval`) are the exact pattern in reference doc §5.5: declare `private loadingInterval: ReturnType<typeof setInterval> | null = null;` on the class and remove all three casts.
- Lines 51 and 232 — `images: any[]` and `sources: any[]` — type with `PerplexityImage[]` and `PerplexitySource[]`.

`lmStudioService.ts` — Lines 13, 19, 82, 93.
- `PromptsService` import (same as above).
- `const messages: any[] = []` → `const messages: ChatMessage[] = []` where `interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }` (OpenAI-compatible shape used by LM Studio).
- `let payload: any` → `interface LMStudioPayload { ... }`.

### 4.5 Verify no `any` remains

After the above, run `pnpm build`. The eslint step from Phase 1 will fail if any `any` slipped through. Fix any newly surfaced sites the same way (type with a minimal interface, narrow with `isRecord`, or use `unknown`).

---

## Phase 5 — Console-Log Hygiene (recommended, not blocking)

**Why:** the audit found 86 `console.*` calls in `main.ts`. These are not a hard ObsidianReviewBot rejection criterion, but the published guidelines discourage shipping debug logging. They also leak internals (paths, model names) into the user's devtools console.

**Decision point — ask the user:** should we (a) remove all console statements, (b) gate them behind a `DEBUG` flag in settings, or (c) route them all through the existing `FileLogger` and drop the console output? The reference doc doesn't mandate a choice; cite-wide chose (c). Recommend (c) for consistency with cite-wide.

This phase can ship in a follow-up PR if the user wants to keep the type-safety/metadata fix focused.

---

## Verification

After the implementation, run from `/Users/mpstaton/code/lossless-monorepo/perplexed`:

1. **Lint clean:** `pnpm exec eslint . --report-unused-disable-directives` — expect zero errors. Specifically, expect zero `@typescript-eslint/no-explicit-any` errors.
2. **TypeScript clean:** `pnpm exec tsc -noEmit -skipLibCheck` — expect zero errors. Strict flags in `tsconfig.json` (already correct, do not weaken) will catch any residual narrowing gaps.
3. **Build clean:** `pnpm build` — expect a clean `main.js` produced.
4. **Manual smoke test in Obsidian:**
   - Symlink or copy the built `main.js`, `manifest.json`, `styles.css` into a test vault's `.obsidian/plugins/perplexed/` folder.
   - Enable the plugin, run each of: Perplexity research command, Perplexica research command, LM Studio command, Claude command (the WIP one — known broken per recent commits, just verify it doesn't crash on load).
   - Confirm settings UI loads, all four endpoint fields render and save.
   - Trigger an error path (e.g. invalid API key) and confirm the logger captures it without console-only output.
5. **Resubmission readiness check:**
   - `manifest.json` version, `versions.json` key, `package.json` version all equal `"0.0.1"`.
   - `LICENSE` file present at repo root.
   - `git diff` shows zero `any` remaining in `.ts` files (excluding `node_modules` and `main.js`): `git grep -n ': any\|as any\|<any>\|any\[\]' -- '*.ts' ':!node_modules'` should return nothing from our source files.

---

## Critical Files Touched

- `eslint.config.mjs` — Phase 1
- `package.json` — Phase 1 (build script), Phase 2.3 (version, deps)
- `manifest.json` — Phase 2.1
- `versions.json` — Phase 2.2
- `LICENSE` — Phase 3 (new)
- `src/types/obsidian.d.ts` — Phase 4.1
- `src/utils/logger.ts` — Phase 4.2
- `src/utils/formatDate.ts` — Phase 4.3
- `src/utils/coerce.ts` — Phase 4.3 (new)
- `src/services/perplexicaService.ts` — Phase 4.4
- `src/services/perplexityService.ts` — Phase 4.4 (largest single file change)
- `src/services/lmStudioService.ts` — Phase 4.4

`main.ts` is **not** in the type-safety touch list — the audit found zero `any` in it. Phase 5 (optional) would touch it for console hygiene.

## Reused Utilities

- `coerce.ts` helpers (`asString`, `asNumber`, `asStringArray`, `asDate`, `isRecord`) — verbatim from reference doc §3.3, will be reused across `formatDate.ts` and the three service-payload narrowings in 4.4.
- Existing `FileLogger` singleton in `src/utils/logger.ts` — already present and properly designed, just needs `unknown` substitution.
- Obsidian's typed `App`, `Editor`, `TFile`, `Vault`, `Modal` from `'obsidian'` — already imported throughout; no new shim needed beyond the cleanup of `commands: any`.
