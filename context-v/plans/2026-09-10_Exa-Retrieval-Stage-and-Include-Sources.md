---
title: "Plan — Exa Retrieval Stage and the `include-sources:` Slot"
lede: "Perplexity writes well but retrieves badly on companies; Exa retrieves well but doesn't write. Split the job."
publish: true
status: Shipped
date_created: 2026-09-10
date_modified: 2026-09-11
date_first_published: 2026-09-11
date_authored_initial_draft: 2026-09-10
date_authored_current_draft: 2026-09-10
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
at_semantic_version: 0.1.0.0
site_uuid: ba3d81ed-b244-470a-829f-782b91bdd704
hex_code: mk63yl
applies_to: perplexed Obsidian plugin
tags:
  - Plan
  - Perplexed
  - Exa
  - Retrieval-Augmented-Generation
  - Include-Sources
  - Directory-Templates
related:
  - "[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]]"
  - "[[Partials-And-Preambles-For-Perplexed-Templates]]"
  - "[[2026-09-10_Outline-Shaping-and-Adherence-Modes]]"
  - "[[2026-09-10_Run-Snapshots-and-Restore]]"
summary: "Implementation plan for adding Exa.ai as a retrieval stage that runs before the Perplexity generation call, splicing named company data into the prompt via a generic `include-sources:` cft key. Names the four non-obvious hazards — citation-namespace collision between two providers, prompt-context budget, degrade-don't-block failure semantics, and retrieval caching across re-runs — and specifies the provider-registry shape so a standalone Exa `/answer` generation path can be added later without refactoring. Read this before touching exaService.ts."
---

# Plan — Exa Retrieval Stage and the `include-sources:` Slot

## Why care

Perplexity writes an excellent profile and a genuinely good market map. What it does
less well is *find the right company* — especially for names that collide (the
canonical `NATS` messaging-system-vs-air-traffic-authority case already documented in
`toolkit-profile.md`), and especially for structured company facts: founding year,
funding stage, round size, investor names, customer logos.

Exa is built for exactly that half of the job. Its `POST /search` accepts
`category: "company"`, returns an `entities` object of structured company data per
result, and `contents.summary.schema` lets us demand specific facts back as JSON
against a schema we define. It does not write prose we'd want to publish.

So: **let Exa retrieve, let Perplexity write.** Exa runs first, its results splice
into the Perplexity user prompt as named, attributed canonical sources, and
Perplexity does what it already does well on top of better inputs.

This lands as the first real implementation of the `include-sources:` key that
[[Multi-Stage-Cooperative-Claude-and-Perplexity-with-RAG]] specified but deferred.
Exa is provider #1 in that slot; vault globs and Chroma queries are #2 and #3 and
should drop in without a refactor.


## Findings

Established by reading the current source and fetching Exa's live docs on 2026-09-10.
Recorded separately from the design below because these are **facts to build against**,
not proposals — a future session should be able to trust them without re-deriving.

### Exa's auth and endpoint are settled

`POST https://api.exa.ai/search`, header `Authorization: Bearer $EXA_API_KEY`. The
docs' own curl example uses Bearer, not the `x-api-key` form some Exa SDK wrappers
still show. Build against Bearer.

### Cost is a non-issue and should not be designed around

Verified rates: **$7 / 1k searches** (up to 10 results included), **$1 / 1k pages per
content type** (text, highlights, and summary each bill separately), **$1 / 1k results**
beyond the first 10, **$5 / 1k** for the `/answer` endpoint. Deep variants run
$12–$15 / 1k.

A typical toolkit run — one search, eight results with `summary` + `text` — is about
**$0.023**. The free tier is $20 of credits at signup plus $10/month.

The consequence for this plan: **do not build cost-guarding machinery.** No budget
caps, no per-run confirmation dialogs, no usage meter. Log the `costDollars` field
Exa returns on every response and move on. The engineering effort belongs on the
context-budget problem, which is a real ceiling, rather than the money, which is not.

### `includeDomains` caps at 1200, against Perplexity's 10

This is the finding with the widest blast radius, and it changes advice already
written elsewhere in the repo.

Perplexity's `search_domain_filter` is capped at 10 entries — a constraint hard-coded
as `SEARCH_DOMAIN_CAP` in `directoryTemplateService.ts` and the reason the built-in
job-board denylist is dropped whenever a run declares an allowlist (deny entries would
otherwise burn slots the allowlist needs). Exa's `includeDomains` / `excludeDomains`
accept **up to 1200 entries each**.

Two consequences:

1. **Entity-pinning becomes cheap.** `toolkit-profile.md`'s "Scoping search to the
   right entity" section currently argues that allowlisting is a last resort because
   curating domains by hand is the same labour as searching yourself. That argument
   was shaped by the 10-domain ceiling. With Exa doing retrieval, pinning a
   collision-prone entity to its own domain plus a handful of credible outlets costs
   nothing and cannot push anything else out. That section needs rewriting, not just
   amending.
2. **Source rejection stops hitting a wall.** The curation flow in
   [[2026-09-10_Section-Refresh-and-Source-Curation]] denylists rejected domains, and
   under Perplexity alone the tenth rejection evicts an earlier one. Exa's
   `excludeDomains` is the escape hatch, which is an independent argument for routing
   retrieval through Exa on any document that gets curated heavily.

### Two providers in one prompt breaks the citation contract

The single most consequential finding, and the reason this feature is not a
straightforward splice.

`buildSourcesFooter()` renders Perplexity's `search_results` array, and the model is
instructed by `inline-citation.md` to emit `[1]`, `[2]` markers **against the ordinal
positions of that array**. Sources spliced into the user prompt from Exa are not
members of it. Nothing in the current pipeline detects a marker that points outside
the array's bounds.

So a model that cites a spliced Exa source as `[3]` produces a document where a
claim sourced from Exa is footnoted to whatever Perplexity's third search result
happened to be. The output passes every check we currently run: it has inline
markers, it has a populated footer, the markers all resolve. It is simply wrong, and
wrong in the way that is hardest to catch by reading — a plausible citation attached
to the wrong document.

This is why the design below spends a whole mechanism (`[E1]` namespace + dedicated
preamble + two-section footer) on what looks superficially like formatting. It is not
formatting; it is the correctness boundary between the two providers.

The cheap detector worth shipping alongside: warn when any bare `[N]` in the output
exceeds `search_results.length`.

### Spike resolved — verified against the live API with a real key, 2026-09-10

Three of the plan's open items were answered by running the NATS collision case
through Exa directly. Costs below are actual, from `costDollars`.

**`summary.schema` works, and omits rather than fabricates.** Asking for
`founded_year`, `funding`, `notable_customers` against five company pages
returned populated fields on the real company sites and *empty* fields on a thin
LinkedIn showcase page. It did not invent a funding round to satisfy the schema.
That answers the open item directly: the innovator-card `Funding` line can trust
Exa, and a blank field means "unknown", not "free". Sample value:

> `"Total funding USD 41,200,000 across multiple rounds (Seed 2018-02-01: …)"`

That is materially better than what Perplexity returns for the same field.

**Two API shapes differ from the obvious assumption, and both bit the first
implementation:**

- `entities` is an **array**, not an object, and the payload is nested under
  `properties`. Observed keys for `type: "company"`: `name`, `description`,
  `foundedYear`, `headquarters`, `workforce`, `financials`, `webTraffic`,
  `research`. It resolves to a curated record at `exa.ai/library/organization/…`.
- When `contents.summary.schema` is supplied, `summary` comes back as a **JSON
  string, not an object**. It must be `JSON.parse`d to reach the fields.

**Retrieval precision is a knob, and `category: company` alone does not solve
entity collision.** Exa's search is similarity-based, so the same query returns
different things depending on how tightly it is pinned:

| Pinning | Result on the NATS case | Cost |
|---|---|---|
| None, `category: company` | 1 of 5 correct — the rest were Nstream, Element, Mio: *competitors*, not NATS | $0.012 |
| Broad allowlist incl. `github.com`, `cncf.io` | 1 of 5 correct — Apache APISIX and a Gurugram meetup page rode in on the broad domains | $0.012 |
| Narrow allowlist (`nats.io`, `synadia.com`, `docs.nats.io`) | **1 of 1 correct** | $0.008 |

Two consequences, and the second one reframes part of this plan:

1. **Broad domains in an allowlist are actively harmful.** `github.com` and
   `cncf.io` are large enough that similarity search always finds *something* on
   them. This directly contradicts the example `cf_search_domains:` block
   currently in `toolkit-profile.md`, which lists exactly those two — that
   example must be rewritten before Exa ships, or it will degrade the runs it is
   meant to help. Note this narrows the earlier finding about the 1200-entry
   ceiling: the ceiling makes pinning *cheap*, but precision still comes from
   pinning *narrowly*, not from pinning *broadly*.
2. **Competitor bleed is a feature in the other direction.** Unpinned
   `category: company` returning Nstream, Element and Mio for a NATS query is
   exactly what a market map wants — that is enumeration of a segment. So the
   collision problem and the market-map enumeration problem are the same knob
   turned opposite ways, and `include-sources:` needs a per-spec pinning mode
   rather than one global policy:
   - `pin: entity` — narrow allowlist from the target's own domain. Toolkit.
   - `pin: none` — similarity across the category. Market map.

### Two defects the first implementation shipped, caught by running it

Both found by exercising the real resolver against the live API, not by review.

**Marker contiguity is part of the citation contract.** The budget pass fills
greedily — it keeps packing smaller sources in after a large one has been
skipped — so markers assigned during retrieval came out as `E1, E3, E4`, with a
hole where `E2` was dropped. That is not cosmetic. The prompt instructs the model
to cite `[E2]`, nothing matches it, and a model that "helpfully" renumbers `E3`
down to `E2` silently repoints every citation at the wrong source — the exact
corruption the namespace exists to prevent. **Markers must be assigned after
truncation, never during retrieval.**

**Fact keys arrive in two spellings and must be collapsed.** The schema summary
returns `founded_year`; the curated entity record returns `foundedYear`. Both
landed in the YAML, so the model saw the same fact asserted twice. Exa's entity
records also carry explicit nulls for unknown fields (`postalCode: null`,
`fundingLatestRound: null`) which read as asserted absences and burn context.
Both need normalizing — key-id collapse and a recursive empty-strip.

### Unpinned mode needs an aggregator denylist

`pin: none` on the NATS query returned `github.com/` and `en.wikipedia.org/` —
bare platform homepages, not sources about anything. Useful competitor results
(RisingWave, Element) came back alongside them, so the mode works; it just needs
the same treatment `JOB_BOARD_DENYLIST` already gives the Perplexity path.

Candidate default `excludeDomains` for unpinned retrieval: `github.com`,
`wikipedia.org`, `linkedin.com`, `reddit.com`, `medium.com`. Exa's 1200-entry
ceiling means this costs nothing, unlike Perplexity where deny entries compete
with allow entries for 10 slots. Not yet built.

### `includeDomains` is a SUBSTRING match, not a host match

The most dangerous finding so far, and one the NATS case could not surface.

Pinning a Cresta run to `includeDomains: ["cresta.com", "docs.cresta.com"]`
returned six companies:

| Host | Actually is |
|---|---|
| `cresta.com` | the target |
| `cresta.com.au` | an unrelated Australian company |
| `alcresta.com` | Alcresta Therapeutics — a pharma company |
| `codecresta.com` | a dev shop |
| `grupocresta.com.gt` | a Guatemalan group |
| `ridgecresta.com` | a training company |

Every one of them *ends with* the pinned string. Exa filters `includeDomains` by
substring, so a short domain pins nothing — it widens.

`nats.io` has no such collisions, which is exactly why the first spike passed and
reported entity pinning as solved. **A pin that works on one entity proves
nothing about the mechanism.**

**Consequence: entity pinning is not enforceable API-side and must be re-checked
on the results.** `hostMatchesPin()` accepts a result only when its hostname is
the pinned host or a true subdomain (`docs.cresta.com` yes, `alcresta.com` no).
Without it every short-domain company profile silently ingests its namesakes —
and because the model then cites them as `[E2]`…`[E6]`, the note looks
*better* sourced while being wrong.

### A `type: string` schema field returns the WORD "null", not a null

A schema field declared `type: string` cannot hold JSON null, so when Exa has no
value the model writes the word instead:

```json
{"founded_year": "2023", "funding": "null", "notable_customers": ["null"]}
```

Non-deterministic on the same query — one call returned a real JSON null, the
next returned the string. So a null check alone is not enough; a sentinel-string
set is required. Rendered unstripped, `funding: null` reads to the writing model
as an asserted fact about the company rather than as missing data.

`Undisclosed` and `Bootstrapped` are deliberately not treated as sentinels —
those are real statements about funding.

### Context budget is the real ceiling

Restated here because it is the constraint that will actually bind in practice. Eight
results at `text.maxCharacters: 4000` is ~32K characters — roughly 8K tokens —
inserted into a user message that must also carry preambles, research framing, and
the section skeleton.

The dangerous failure is not size. It is that **the model's attention drifts to the
pasted source text and away from the skeleton**, and the output stops following the
outline. That is the same signature as the `max-tokens` truncation documented in
`buildPayload`: a run that completes cleanly and produces a draft that quietly
ignored its instructions.

### Transport: `requestUrl()`, not `node:https`

The `node:https` pattern in `perplexityService.ts` and `directoryTemplateService.ts`
exists for one specific reason, recorded in the comment at the top of
`streamPerplexityToFile`: `activeWindow.fetch` is blocked by Perplexity's CORS policy
from the `app://obsidian.md` origin, and streaming had to route through the OS network
stack instead.

That reason does not transfer. Exa retrieval is a single non-streaming JSON POST.
Obsidian's `requestUrl()` bypasses CORS, is the documented API for exactly this case,
and reads better in a community-plugin review than raw Node networking — which the
plugin is already carrying review risk on per the submission punch-list plans.

**Decision: `requestUrl()` for Exa.** The transport asymmetry with the Perplexity
services is deliberate and this paragraph is the record of why.

### Ordering is a shared constraint across three plans

`applyTemplate` performs a destructive `app.vault.modify(target, initialContent)`
before the first byte of the response arrives. Everything that can fail — snapshot
writing, Exa retrieval, outline resolution — must happen **before** that line, so a
failure leaves the target file intact. The three plans in this arc each state this
independently; it is one rule, and it belongs in whichever of them lands first.

## Scope

**In scope:**

- `src/services/exaService.ts` — a retrieval client and nothing else
- An `include-sources:` resolver in `directoryTemplateService.ts` with a provider
  registry, Exa registered as the first provider
- New settings: `exaApiKey`, `exaEndpoint`, and a spliced-context character budget
- A new bundled preamble governing how the model must cite spliced sources
- `toolkit-profile.md` updated as the reference implementation
- Sources-footer changes so Exa-derived sources survive into the finished note

**Out of scope for this plan (tracked, not built):**

- The standalone Exa `/answer` generation path — the provider registry must *admit*
  it without redesign, but we do not build it here
- Vault-glob and Chroma `include-sources` providers
- `market-map-profile.md` adoption — comes after toolkit proves the shape
- Exa Websets

## The API, as verified 2026-09-10

`POST https://api.exa.ai/search`, auth `Authorization: Bearer $EXA_API_KEY`.

Request keys we care about:

| Key | Use |
|---|---|
| `query` | anchored on `{{basename}}` + the target's `url` frontmatter |
| `category` | `company` for Tooling; also `publication`, `news`, `people`, `financial report` |
| `type` | `auto` default; `deep` / `deep-reasoning` available and more expensive |
| `includeDomains` / `excludeDomains` | up to 1200 entries — no 10-domain cap, unlike Perplexity |
| `numResults` | 1–100, default 10 |
| `contents.text` | `{ maxCharacters, verbosity }` — full page text |
| `contents.summary` | `{ query, schema }` — LLM summary against a JSON Schema |
| `contents.highlights` | relevant snippets |
| `startPublishedDate` / `endPublishedDate` | recency control |

Response per result: `title`, `url`, `publishedDate`, `author`, `id`, plus
`text` / `highlights` / `summary` when requested, plus **`entities`** (structured
company/person/publication data) and `favicon` / `image`. Response metadata carries
`requestId`, `searchTime`, and a `costDollars` breakdown.

**Cost is not a constraint.** $7/1k searches, $1/1k pages per content type, $1/1k
extra results beyond 10. A typical toolkit run — one search, eight results with
`summary` + `text` — is roughly **$0.023**. Free tier is $20 of credits plus $10/month.
Do not build cost-guarding machinery; build a `costDollars` log line and move on.

## The four hazards, and how each is answered

Cost and transport are easy. These four are the plan. Hazards 1 and 2 are evidenced
in Findings above; repeated here only as the design response.

### 1. Citation-namespace collision between two providers

*Evidence: Findings — "Two providers in one prompt breaks the citation contract."*

**Resolution:** give spliced sources a distinct marker namespace. Exa sources are
cited `[E1]`, `[E2]`, …; Perplexity's own results keep bare numerics. Enforce it with
a new bundled preamble (`spliced-source-citation.md`) that ships alongside
`inline-citation.md`, and render two footer sections — "Sources (web search)" and
"Sources (retrieved)". The `E` prefix generalizes: a future Chroma provider gets `[C1]`,
vault globs get `[V1]`.

Ship the detector with it: warn when any bare `[N]` in the output exceeds
`search_results.length`.

### 2. Prompt-context budget, which is the real ceiling

*Evidence: Findings — "Context budget is the real ceiling."*

**Resolution:** default to `summary` (short, schema-shaped, ~400 chars) rather than
`text`. Make `text` opt-in per source spec. Add a plugin-level
`exaSplicedContextMaxChars` budget (default ~12000), truncate deterministically
oldest-result-first when exceeded, and emit a visible
`<!-- perplexed: N sources truncated to fit context budget -->` marker so a human
reading the note can see it happened. Never truncate silently.

### 3. Degrade, never block

A `market-map-profile` deep-research run is minutes long and represents real money
and real waiting. If Exa is unreachable, rate-limited, or the key is unset, the run
must **proceed without the spliced sources** and surface a `Notice` — never abort,
never throw into the Perplexity path.

Corollary: `include-sources:` resolution happens *before* `app.vault.modify(target,
initialContent)` in `applyTemplate`, so an Exa failure can't leave a half-wiped target
file. This is the shared ordering constraint recorded in Findings.

### 4. Retrieval caching across re-runs

Re-running a toolkit profile — which the whole revision arc exists to make routine —
should not re-pay for and re-fetch the same Exa results, and more importantly should
not silently *change* the source set between a draft and its revision. A section
refresh that pulls different sources than the original run is not a revision, it's a
different document.

**Resolution:** write resolved sources to a sidecar under the library root
(`zz-cf-lib/retrieved/<target-path>/<timestamp>.json`, matching the visible-folder
decision made for snapshots), and stamp `cf_retrieved_sources:` into the target's
frontmatter pointing at the current set. A re-run reuses the cached set unless the
user asks for a refresh via a modal toggle or the cache is older than a settable TTL.

## Design

### `include-sources:` in the cft fence

```yaml
include-sources:
  - provider: exa
    query: "{{basename}} {{url}} company overview funding product"
    category: company
    num-results: 8
    include-domains: ["{{url_domain}}"]     # optional entity pin
    contents:
      summary:
        query: "What does this company do? Founded when? Funding raised? Customers?"
      text: false
```

A list, so multiple providers compose in one template. Absent key → today's behavior
exactly. The four shipped templates stay valid and unchanged.

### Provider registry — the shape that admits `/answer` later

```ts
interface SourceProvider {
  id: string;                                  // 'exa' | 'vault' | 'chroma'
  marker: string;                              // 'E' | 'V' | 'C'
  resolve(spec, ctx): Promise<ResolvedSource[]>;
}

interface ResolvedSource {
  marker: string;        // 'E1'
  title: string;
  url?: string;
  publishedDate?: string;
  body: string;          // summary or text, already budget-trimmed
  entities?: unknown;    // Exa structured company data, rendered as YAML
  providerId: string;
}
```

`exaService.ts` exports the retrieval function; the *provider registration* lives in
`directoryTemplateService.ts` so the service stays a thin API client. A later
standalone `/answer` path registers as a **generation** provider alongside
perplexity/claude/gemini — a separate registry, not this one. Keeping retrieval and
generation registries distinct is what stops the refactor.

### Splice format in the prompt

Rendered above the section skeleton, below the research framing:

```markdown
## Retrieved sources — cite these as [E1], [E2], …

### [E1] Crew AI — https://crewai.com  (published 2025-03-11)
founded: 2023
funding: $18M Series A, Insight Partners
<summary body>
```

Structured `entities` render as a small YAML block because models parse key-value
pairs more reliably than prose for exactly the facts (founding year, round size) the
innovator-card format demands.

### Transport

Use Obsidian's `requestUrl()`, not `node:https`. Exa is a single non-streaming JSON
POST; `requestUrl` bypasses CORS, is the idiomatic Obsidian API, and reads better in
a community-plugin review than raw Node networking. The `node:https` precedent in
`perplexityService.ts` and `directoryTemplateService.ts` exists specifically because
*streaming* was needed — that reason does not apply here.

## Steps

1. **Settings + service skeleton.** `exaApiKey`, `exaEndpoint`
   (`https://api.exa.ai/search`), `exaSplicedContextMaxChars`. Settings-tab section
   with a link to the Exa dashboard. `exaService.ts` with one `searchExa()` function
   and typed request/response interfaces. Ship a "Exa service status" command
   mirroring the existing per-provider status commands.
2. **Provider registry + resolver** in `directoryTemplateService.ts`.
   `resolveIncludeSources(app, settings, cftConfig, ctx)` returning
   `ResolvedSource[]`. Register Exa. Budget-trim here, not in the service.
3. **Citation namespace.** New bundled preamble
   `src/docs/preambles/spliced-source-citation.md`. Add to
   `BUNDLED_PREAMBLES` and to the seeder. Wire into the system-preamble list only
   when the run actually resolved sources — an empty splice must not add citation
   instructions for sources that aren't there.
4. **Splice into `applyTemplate`.** Resolve before the first `vault.modify`. Render
   the block between framing and skeleton. Handle the degrade path with a Notice.
5. **Footer + frontmatter.** Extend `buildSourcesFooter` to a second "Sources
   (retrieved)" section. Stamp `cf_retrieved_sources:` and `cf_last_run_retrieval:`.
6. **Caching sidecar.** Write/read `zz-cf-lib/retrieved/…`, TTL setting, a modal
   toggle to force refresh.
7. **`toolkit-profile.md` as reference implementation.** Add the `include-sources:`
   block, and rewrite the template's "Scoping search to the right entity" prose —
   Exa's `includeDomains` has a 1200-entry ceiling versus Perplexity's 10, which
   makes entity-pinning genuinely cheap and changes the advice in that section.
8. **Docs.** Update `docs/directory-templates.md` and the seeded
   `zz-cf-lib/templates/README.md`.

## Verification

- Run `toolkit-profile` on a known-collision entity (`NATS`) with and without the
  Exa block; the Exa run must profile the messaging system.
- Confirm no bare `[N]` marker exceeds `search_results.length` in output.
- Unset `exaApiKey` and confirm the run completes Perplexity-only with a Notice.
- Re-run the same file and confirm the cached source set is reused, not re-fetched.
- Confirm a run with `text: true` and eight results trips the budget marker rather
  than silently sending 32K characters.

## Open items

- [ ] Does `contents.summary.schema` reliably return the fields we ask for across
      thin company pages, or does it hallucinate into the schema? Spike before
      relying on it for the innovator-card `Funding` line.
- [ ] `category: company` behavior for open-source projects with no company behind
      them — does it degrade, or should the spec fall back to no category?
- [ ] Whether `entities` is populated consistently enough to be worth rendering, or
      whether `summary` alone carries the load.

## Post-ship note — 2026-09-11

Shipped in `dbe6b25`, logged in [[2026-09-11_01]]. Steps 1-5 and 7 landed:
service, provider dispatch, citation namespace, splice, footer, and
`toolkit-profile` as the reference implementation.

**Deliberately not built:**

- **Step 6, the retrieval cache.** Re-running still re-fetches and re-pays.
  Cheap enough ($0.02) that it never bit during the session, but it remains the
  correctness argument rather than the cost one: a section refresh that pulls a
  different source set than the original run is not a revision.
- **The aggregator denylist for `pin: none`.** Unpinned retrieval still returns
  bare `github.com` and `wikipedia.org` homepages alongside real competitors.
- **Feeding the entity pin into Perplexity's `search_domain_filter`.** This is
  the highest-value remaining item and came directly out of the Kestra run: Exa
  found the right company while Perplexity's own search cited Kestra Medical
  Technologies ten times. Pinning only one of the two providers leaves the
  pollution in the output.
- **The standalone Exa `/answer` generation path.** The retrieval registry was
  kept separate from generation providers specifically so this can be added
  without a refactor; nothing else about it is started.
