---
title: Wall-clock timeout cuts off long deep-research streams
lede: "The directory-template runtime caps every stream by total wall-clock duration, but the legacy modal flow already moved to per-chunk idle-timeout discipline two iterations ago — and the discrepancy is now actively truncating analyst-grade market-map drafts mid-sentence."
date_created: 2026-05-26
date_modified: 2026-05-26
authors:
  - Michael Staton
augmented_with:
  - Claude Opus 4.7 (1M context)
semantic_version: 0.0.0.1
type: issue
status: open
target_repo: perplexed
tags:
  - Issue-Resolution
  - Perplexed
  - Streaming-Timeouts
  - Deep-Research
  - Directory-Templates
related:
  - "[[market-map-profile]]"
  - "[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]]"
  - "[[Partials-And-Preambles-For-Perplexed-Templates]]"
---

# Wall-clock timeout cuts off long deep-research streams

## Symptom

Running `market-map-profile` on `lost-in-public/market-maps/Humanoid Robots and their Input Industries.md` produced a ~7,500-word draft that terminated mid-sentence inside the *Frontier and Open Questions* section:

```
Will the evolution of robot-as-a-service (R
```

The trailing parenthesis is the last byte written. The *Adjacent Concepts and Maps* section — the final heading in the template skeleton — never appeared. The frontmatter stamps (`cf_last_run`, `cf_last_run_model`) landed correctly, so the run did complete its `processFrontMatter` post-step; what was lost was the streamed body content that hadn't yet arrived when the `AbortController` fired.

The Humanoid Robots run is the first observable instance of this specific cut-off shape, but the pattern is structural — it will reproduce on any sufficiently long deep-research generation run through the directory-template flow.

## Diagnosis

Two different streaming primitives live in this codebase, with two different timeout disciplines:

**Directory-template flow** ([`src/services/directoryTemplateService.ts`](../../src/services/directoryTemplateService.ts) `streamPerplexityToFile`, the function `market-map-profile` and the four other shipped templates run through):

```ts
const controller = new AbortController();
const timer = activeWindow.setTimeout(() => controller.abort(), timeoutMs);
```

A **single wall-clock `setTimeout`** is armed at the moment of fetch. After `timeoutMs` elapses — regardless of whether the stream is actively producing bytes — `controller.abort()` fires and the in-flight `reader.read()` throws. The catch sets `truncated = true` and falls through to a final flush of whatever streamed so far. The plugin-level default was `600_000` ms (10 min) before today's fix; analyst-grade deep-research runs routinely run 15-25 min, so the cut-off was inevitable on long templates.

**Legacy modal flow** ([`src/services/perplexityService.ts:659`](../../src/services/perplexityService.ts), `PerplexityModal`):

```ts
const STREAM_IDLE_TIMEOUT_MS = isDeepResearch ? 270_000 : 90_000;
const readWithIdleTimeout = (): Promise<...> => {
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
            reject(new Error(`stream went idle for ${...}s ...`));
        }, STREAM_IDLE_TIMEOUT_MS);
    });
    return Promise.race([reader.read(), timeout]).finally(() => {
        if (timer !== undefined) window.clearTimeout(timer);
    });
};
```

**Per-chunk idle timeout.** A fresh `setTimeout` is armed and racing each `reader.read()` call. As long as bytes keep arriving, the timer keeps getting cleared and re-armed. The stream is only killed if it goes *quiet* for 270 s (deep-research) or 90 s (normal). Total wall-clock duration is unbounded.

The legacy modal moved to this pattern because the same problem hit users there first — but the directory-template flow was forked from an earlier iteration of the streaming code and never received the idle-timeout backport. The legacy `PerplexityModal` and `streamPerplexityToFile` now disagree on how to time-bound a Perplexity stream, and the directory-template flow has the strictly weaker discipline.

## What we shipped today (partial fix)

Not a structural fix — a pressure-relief valve. Two changes:

1. **Bumped the plugin-level default** ([`main.ts:333`](../../main.ts)) from `600_000` ms (10 min) to `1_800_000` ms (30 min). The settings-pane description was updated to call out the override and the cost framing (`$10-$50 of analyst time per good output is worth waiting for`).
2. **Added a per-template override** — `request-timeout-ms:` in the cft block. Resolution code lives in [`directoryTemplateService.ts`](../../src/services/directoryTemplateService.ts) just before the `streamPerplexityToFile` call; accepts number or numeric-string, silently falls back on non-positive / non-numeric values.
3. **`market-map-profile.md`** declares `request-timeout-ms: 2400000` (40 min) with an inline comment explaining the budget; the other four shipped templates inherit the plugin-level 30-min default.
4. **Docs** — [`docs/directory-templates.md`](../../docs/directory-templates.md) gained a *Per-template timeout override* section with override semantics and a "when to bump" checklist; [`src/docs/templates/README.md`](../../src/docs/templates/README.md) calls out the key in the cft-block list.

This buys headroom. It does not fix the structural problem: any sufficiently long deep-research run will still hit the wall eventually. The 40-min cap is a *guess* about how long the longest reasonable market-map should take, not a property derived from the stream's actual behavior.

## Why this is only a partial fix

The wall-clock timeout fails in two distinct shapes that the idle-timeout pattern handles correctly:

**Shape 1 — slow but healthy stream.** Deep-research generations on long templates may sustain a slow trickle of tokens for 30-45 minutes. The wall-clock cap kills them at the ceiling regardless of whether they're still producing. The idle-timeout pattern lets them complete naturally as long as some byte arrives every N seconds.

**Shape 2 — silently stalled stream.** Conversely, a stream may go quiet at minute 3 (Perplexity rate-limit, socket close, upstream stall) and the wall-clock cap won't notice until minute 30. The user stares at an empty file, watching the spinner spin, for 27 unnecessary minutes. The idle-timeout pattern surfaces the failure within `STREAM_IDLE_TIMEOUT_MS` seconds — fast feedback when something is genuinely wrong.

Both shapes are real. The wall-clock pattern punishes the healthy-but-slow case while tolerating the stalled-but-silent case. The idle-timeout pattern inverts both — slow-but-healthy completes; stalled-but-silent fails fast.

## Proposed structural fix

Port the idle-timeout pattern from [`perplexityService.ts:659-668`](../../src/services/perplexityService.ts) into `streamPerplexityToFile`. Concretely:

1. Replace the single wall-clock `setTimeout(controller.abort, timeoutMs)` with a per-chunk `readWithIdleTimeout()` that wraps each `reader.read()` in a `Promise.race` against a fresh timeout.
2. Choose idle-timeout values consistent with the existing modal flow: `270_000` ms (4.5 min) for deep-research models, `90_000` ms (1.5 min) for normal models. Detect deep-research from the resolved model name string (`/deep-research/i`), the same way `perplexityService.ts` does.
3. Retain the cft-block override key, but rename it to `stream-idle-timeout-ms:` for accuracy. Templates that have been declaring `request-timeout-ms:` need a compatibility alias for one release; document the rename in the changelog entry.
4. Optionally retain a generous absolute wall-clock ceiling (60 min or 120 min) as a sanity backstop — but that's belt-and-suspenders, not load-bearing. The idle timeout is doing the actual safety work.

The diff is moderate — `streamPerplexityToFile` is ~140 lines today; the refactor touches roughly the first 40 of those (the timer setup and the `reader.read()` call inside the loop). The post-stream cleanup pipeline (`wrapThinkBlocks`, `processContentWithImages`, `buildSourcesFooter`) is unaffected.

## Open items before this becomes a spec

- [ ] Decide whether the cft-block key stays named `request-timeout-ms:` (which becomes a misnomer once idle-timeout is what's actually applied) or migrates to `stream-idle-timeout-ms:`. Compatibility-alias plan if the latter.
- [ ] Decide whether to retain a wall-clock absolute ceiling alongside the idle timeout, and if so what the value is (60 min? 120 min? infinite with a Notice that surfaces "this run has been going for X min" past a threshold?).
- [ ] Audit other long-stream callsites in the codebase that may have the same wall-clock pathology (Gemini service, LM Studio service, Claude service streaming flows) — the idle-timeout discipline should be the house style across all of them.
- [ ] Confirm the model-name-based deep-research detection (`/deep-research/i` regex on the resolved model) is robust against future Perplexity model name changes; consider exposing the idle-timeout values as plugin settings so they can be tuned without a code change.

## Related

- [[market-map-profile]] — the template that surfaced the bug
- [[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]] — the broader exploration this issue feeds findings back into; the idle-timeout refactor is listed there as an open item
- [[Partials-And-Preambles-For-Perplexed-Templates]] — the architecture-review structure of that issue is the precedent this one follows
- [`src/services/perplexityService.ts`](../../src/services/perplexityService.ts) lines 659-668 — the idle-timeout implementation in the legacy modal flow that we're proposing to port
- [`src/services/directoryTemplateService.ts`](../../src/services/directoryTemplateService.ts) `streamPerplexityToFile` lines 499-635 — the wall-clock implementation in the directory-template flow that the port replaces
