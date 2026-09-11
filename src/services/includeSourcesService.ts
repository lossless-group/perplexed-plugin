import { Notice, stringifyYaml } from 'obsidian';

import { entityProperties, parseSummary, searchExa } from './exaService';
import type { ExaCategory, ExaResult, ExaSearchRequest } from './exaService';

/**
 * Resolution of the `include-sources:` cft key — the retrieval stage that runs
 * BEFORE the generation call and splices named, citeable source material into
 * the prompt.
 *
 * See context-v/plans/2026-09-10_Exa-Retrieval-Stage-and-Include-Sources.md.
 * Exa is the only provider implemented; vault globs and Chroma are planned for
 * the same slot, which is why ResolvedSource is deliberately provider-neutral.
 */

export interface IncludeSourcesSettings {
    exaApiKey: string;
    exaEndpoint: string;
    exaSplicedContextMaxChars: number;
}

/**
 * Pinning mode — the precision knob. Verified 2026-09-10 that this is the
 * difference between profiling an entity and enumerating its competitors:
 *
 * - `entity` — restrict search to the target's own domain(s). A NATS run pinned
 *   to nats.io/synadia.com returned 1 of 1 correct. Use for single-entity
 *   profiles (Tooling/).
 * - `none` — unpinned similarity search across the category. The same NATS query
 *   returned Nstream, Element and Mio — competitors, which is exactly what a
 *   market map wants.
 *
 * Do NOT pin to broad domains (github.com, cncf.io): they are large enough that
 * similarity search always surfaces something on them, which is how Apache
 * APISIX rode into a NATS query during the spike.
 */
export type PinMode = 'entity' | 'none';

export interface ExaSourceSpec {
    provider: 'exa';
    query: string;
    category?: ExaCategory;
    numResults: number;
    pin: PinMode;
    /** Explicit allowlist; when absent and pin==='entity', derived from the target URL. */
    includeDomains?: string[];
    summaryQuery?: string;
    summarySchema?: Record<string, unknown>;
    /** Opt-in full page text. Off by default — see the context-budget hazard. */
    includeText: boolean;
    textMaxCharacters?: number;
}

export type SourceSpec = ExaSourceSpec;

/**
 * Provider-neutral normalized source. Consumed by the prompt renderer, the
 * sources footer, and the retrieval cache — so an Exa result, a vault file and
 * a Chroma chunk must all flatten into this shape.
 */
export interface ResolvedSource {
    /** Namespaced citation marker: 'E1' for Exa, 'V1'/'C1' for future providers. */
    marker: string;
    title: string;
    url?: string;
    publishedDate?: string;
    /** Prose body — parsed summary, file content, or chunk text. */
    body: string;
    /** Structured facts kept structured; models read key-value pairs more reliably than prose. */
    facts?: Record<string, unknown>;
    providerId: string;
}

export interface ResolveOutcome {
    sources: ResolvedSource[];
    /** Number dropped by the context budget, surfaced as a visible marker. */
    truncatedCount: number;
    /** Non-fatal problems worth telling the user about without aborting the run. */
    warnings: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asStringList(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return [];
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
    'company', 'publication', 'news', 'personal site', 'financial report', 'people',
]);

/**
 * Parse the cft `include-sources:` value into typed specs. Unknown providers are
 * reported as warnings rather than throwing — a typo in a template should not
 * kill a generation run.
 */
export function parseIncludeSources(
    raw: unknown,
    interpolate: (text: string) => string,
): { specs: SourceSpec[]; warnings: string[] } {
    const warnings: string[] = [];
    if (raw === undefined || raw === null) return { specs: [], warnings };
    if (!Array.isArray(raw)) {
        warnings.push('include-sources: must be a list; ignoring it.');
        return { specs: [], warnings };
    }

    const specs: SourceSpec[] = [];
    for (const entry of raw) {
        if (!isRecord(entry)) {
            warnings.push('include-sources: entry is not a mapping; skipped.');
            continue;
        }
        const provider = asString(entry['provider']) ?? 'exa';
        if (provider !== 'exa') {
            warnings.push(`include-sources: unknown provider "${provider}"; skipped.`);
            continue;
        }

        const query = asString(entry['query']);
        if (query === undefined) {
            warnings.push('include-sources: exa entry has no query:; skipped.');
            continue;
        }

        const rawCategory = asString(entry['category']);
        if (rawCategory !== undefined && !VALID_CATEGORIES.has(rawCategory)) {
            warnings.push(`include-sources: unknown category "${rawCategory}"; ignoring the category filter.`);
        }

        const rawPin = asString(entry['pin']) ?? 'entity';
        if (rawPin !== 'entity' && rawPin !== 'none') {
            warnings.push(`include-sources: unknown pin "${rawPin}"; defaulting to entity.`);
        }
        const pin: PinMode = rawPin === 'none' ? 'none' : 'entity';

        const numRaw = entry['num-results'];
        const parsedNum = typeof numRaw === 'number'
            ? numRaw
            : typeof numRaw === 'string' ? parseInt(numRaw, 10) : NaN;
        const numResults = Number.isFinite(parsedNum) && parsedNum > 0
            ? Math.min(parsedNum, 100)
            : 8;

        const spec: ExaSourceSpec = {
            provider: 'exa',
            query: interpolate(query),
            numResults,
            pin,
            includeText: false,
        };
        if (rawCategory !== undefined && VALID_CATEGORIES.has(rawCategory)) {
            spec.category = rawCategory as ExaCategory;
        }
        const domains = asStringList(entry['include-domains']).map(d => interpolate(d));
        if (domains.length > 0) spec.includeDomains = domains;

        const contents = entry['contents'];
        if (isRecord(contents)) {
            const summary = contents['summary'];
            if (isRecord(summary)) {
                const sq = asString(summary['query']);
                if (sq !== undefined) spec.summaryQuery = interpolate(sq);
                if (isRecord(summary['schema'])) spec.summarySchema = summary['schema'];
            }
            const text = contents['text'];
            if (text === true) spec.includeText = true;
            else if (isRecord(text)) {
                spec.includeText = true;
                const mc = text['maxCharacters'];
                if (typeof mc === 'number' && mc > 0) spec.textMaxCharacters = mc;
            }
        }

        specs.push(spec);
    }
    return { specs, warnings };
}

/**
 * Derive a narrow allowlist from the target's own URL. Narrow is the whole
 * point — see the PinMode note on why broad domains defeat the purpose.
 */
export function domainsFromTargetUrl(url: string | undefined): string[] {
    if (url === undefined || url.trim().length === 0) return [];
    try {
        const host = new URL(url.trim()).hostname.replace(/^www\./, '');
        if (host.length === 0) return [];
        // The bare host plus its docs subdomain covers the overwhelming majority
        // of product sites without widening into aggregator territory.
        return [host, `docs.${host}`];
    } catch {
        return [];
    }
}

/**
 * True when `hostname` is the pinned host itself or a true subdomain of it.
 *
 * REQUIRED because Exa's `includeDomains` matches by SUBSTRING, not by host.
 * Verified 2026-09-11: pinning to "cresta.com" returned alcresta.com,
 * codecresta.com, ridgecresta.com, cresta.com.au and grupocresta.com.gt — five
 * unrelated companies that merely end with the pinned string. Entity pinning is
 * therefore not enforceable API-side and must be re-checked on the results.
 */
export function hostMatchesPin(hostname: string, pinnedHosts: string[]): boolean {
    const host = hostname.replace(/^www\./, '').toLowerCase();
    return pinnedHosts.some((raw) => {
        const pin = raw.replace(/^www\./, '').toLowerCase();
        return host === pin || host.endsWith(`.${pin}`);
    });
}

/** Build the Exa request for one spec. */
function buildExaRequest(spec: ExaSourceSpec, targetUrl: string | undefined): ExaSearchRequest {
    const req: ExaSearchRequest = {
        query: spec.query,
        numResults: spec.numResults,
    };
    if (spec.category !== undefined) req.category = spec.category;

    const domains = spec.includeDomains ?? (spec.pin === 'entity' ? domainsFromTargetUrl(targetUrl) : []);
    if (domains.length > 0) req.includeDomains = domains;

    const contents: NonNullable<ExaSearchRequest['contents']> = {};
    if (spec.summaryQuery !== undefined || spec.summarySchema !== undefined) {
        const summary: NonNullable<typeof contents.summary> = {};
        if (spec.summaryQuery !== undefined) summary.query = spec.summaryQuery;
        if (spec.summarySchema !== undefined) summary.schema = spec.summarySchema;
        contents.summary = summary;
    } else {
        contents.summary = { query: 'Summarize what this page says about the subject.' };
    }
    if (spec.includeText) {
        contents.text = spec.textMaxCharacters !== undefined
            ? { maxCharacters: spec.textMaxCharacters }
            : true;
    }
    req.contents = contents;
    return req;
}

/** Fields on an Exa entity record worth putting in front of the model. */
const FACT_KEYS = ['name', 'foundedYear', 'headquarters', 'workforce', 'financials'] as const;

/**
 * Recursively drop null / undefined / empty values.
 *
 * Exa's entity records carry explicit nulls for unknown fields
 * (`postalCode: null`, `fundingLatestRound: null`). Rendered into the prompt
 * those read as asserted absences and waste the context budget, so they are
 * stripped at every depth rather than only at the top level.
 */
/**
 * Strings that mean "no data" and must be treated as absent.
 *
 * A schema field declared `type: string` cannot hold JSON null, so when Exa has
 * no value the model writes the WORD instead — `"funding": "null"`. Observed
 * non-deterministically on the same query: one call returned a real JSON null,
 * the next returned the string. Rendered into a prompt, `funding: null` reads as
 * an asserted fact about the company.
 *
 * "Undisclosed" and "Bootstrapped" are deliberately NOT here — those are real
 * statements about funding, not missing data.
 */
const NULL_SENTINELS: ReadonlySet<string> = new Set([
    'null', 'none', 'n/a', 'na', 'nil', 'unknown', 'undefined',
    'not specified', 'not found', 'not available', 'no data', 'not applicable',
]);

function stripEmpty(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string' && NULL_SENTINELS.has(value.trim().toLowerCase())) {
        return undefined;
    }
    if (Array.isArray(value)) {
        const items = value.map(stripEmpty).filter((v) => v !== undefined);
        return items.length > 0 ? items : undefined;
    }
    if (isRecord(value)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            const cleaned = stripEmpty(v);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return Object.keys(out).length > 0 ? out : undefined;
    }
    return value;
}

/**
 * Collapse key spellings so the same fact can't appear twice. The schema
 * summary returns snake_case (`founded_year`) while the curated entity record
 * returns camelCase (`foundedYear`); without this both land in the YAML and the
 * model sees the fact asserted twice.
 */
function factKeyId(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractFacts(result: ExaResult): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const seen = new Set<string>();

    const put = (key: string, value: unknown): void => {
        const cleaned = stripEmpty(value);
        if (cleaned === undefined) return;
        const id = factKeyId(key);
        if (seen.has(id)) return;
        seen.add(id);
        out[key] = cleaned;
    };

    // Schema-shaped summaries come back as a JSON *string*; the parsed fields
    // are the ones the template actually asked for, so they claim their key id
    // first and the curated record fills only what they left empty.
    const parsed = parseSummary(result);
    if (parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
            if (k === 'what_it_does') continue; // prose — belongs in body
            put(k, v);
        }
    }

    const props = entityProperties(result);
    if (props !== null) {
        for (const k of FACT_KEYS) put(k, props[k]);
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function extractBody(result: ExaResult): string {
    const parsed = parseSummary(result);
    if (parsed !== null) {
        const prose = parsed['what_it_does'];
        if (typeof prose === 'string' && prose.length > 0) return prose;
    }
    if (typeof result.summary === 'string' && result.summary.length > 0) {
        // Unparsed summary — either no schema was used (plain prose) or the
        // JSON was malformed. Either way the raw string is the best we have.
        return result.summary;
    }
    return result.text ?? '';
}

/** Rough character cost of one rendered source, for budget accounting. */
function sourceCost(s: ResolvedSource): number {
    const factsLen = s.facts ? stringifyYaml(s.facts).length : 0;
    return s.title.length + (s.url?.length ?? 0) + s.body.length + factsLen + 40;
}

/**
 * Resolve every `include-sources:` spec into normalized sources.
 *
 * NEVER throws. A retrieval failure degrades to fewer (or zero) sources plus a
 * warning — a generation run that costs minutes and real money must not be
 * aborted because a retrieval provider was unreachable.
 */
export async function resolveIncludeSources(
    settings: IncludeSourcesSettings,
    specs: SourceSpec[],
    targetUrl: string | undefined,
    options: { quiet?: boolean } = {},
): Promise<ResolveOutcome> {
    const sources: ResolvedSource[] = [];
    const warnings: string[] = [];
    if (specs.length === 0) return { sources, truncatedCount: 0, warnings };

    let counter = 0;
    for (const spec of specs) {
        // Only one provider today. A second case lands here when vault globs or
        // Chroma are built; ResolvedSource is already shaped to absorb them.
        switch (spec.provider) {
            case 'exa': {
                if (settings.exaApiKey.trim().length === 0) {
                    warnings.push('Exa API key is not set — continuing without retrieved sources.');
                    break;
                }
                try {
                    const res = await searchExa(
                        { exaApiKey: settings.exaApiKey, exaEndpoint: settings.exaEndpoint },
                        buildExaRequest(spec, targetUrl),
                    );
                    // Exa's includeDomains is a substring match, so an entity
                    // pin has to be enforced here rather than trusted from the
                    // API. See hostMatchesPin.
                    const pinnedHosts = spec.includeDomains
                        ?? (spec.pin === 'entity' ? domainsFromTargetUrl(targetUrl) : []);
                    const accepted = pinnedHosts.length > 0
                        ? res.results.filter((r) => {
                            if (r.url === undefined) return false;
                            try {
                                return hostMatchesPin(new URL(r.url).hostname, pinnedHosts);
                            } catch {
                                return false;
                            }
                        })
                        : res.results;
                    const rejected = res.results.length - accepted.length;
                    if (rejected > 0) {
                        console.debug(
                            `[includeSources] dropped ${rejected.toString()} off-entity result(s) — Exa's includeDomains is a substring match`,
                            res.results.filter((r) => !accepted.includes(r)).map((r) => r.url),
                        );
                    }
                    for (const r of accepted) {
                        counter += 1;
                        const src: ResolvedSource = {
                            marker: `E${counter.toString()}`,
                            title: r.title ?? r.url ?? `Source ${counter.toString()}`,
                            body: extractBody(r),
                            providerId: 'exa',
                        };
                        if (r.url !== undefined) src.url = r.url;
                        if (r.publishedDate !== undefined) src.publishedDate = r.publishedDate;
                        const facts = extractFacts(r);
                        if (facts !== undefined) src.facts = facts;
                        sources.push(src);
                    }
                    if (accepted.length === 0) {
                        warnings.push(res.results.length > 0
                            ? `Exa returned ${res.results.length.toString()} result(s) but none were on the pinned domain — continuing without retrieved sources.`
                            : `Exa returned no results for "${spec.query.slice(0, 60)}".`);
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    warnings.push(`Exa retrieval failed (${msg}) — continuing without retrieved sources.`);
                }
                break;
            }
        }
    }

    // Context budget. This is an ATTENTION budget, not a cost one: past roughly
    // this much pasted text the writing model starts following the sources
    // instead of the section skeleton. Drop from the end (least-ranked first)
    // and report the count so the splice can mark it visibly.
    const budget = settings.exaSplicedContextMaxChars;
    let truncatedCount = 0;
    if (budget > 0) {
        let running = 0;
        const kept: ResolvedSource[] = [];
        for (const s of sources) {
            const cost = sourceCost(s);
            if (running + cost > budget && kept.length > 0) {
                truncatedCount += 1;
                continue;
            }
            running += cost;
            kept.push(s);
        }
        if (truncatedCount > 0) {
            sources.length = 0;
            sources.push(...kept);
        }
    }

    // Renumber AFTER the budget pass so markers are always contiguous.
    //
    // The budget fill is greedy — it keeps packing smaller sources in after a
    // large one has been skipped — so numbering assigned during retrieval can
    // come out as E1, E3, E4 with a hole where E2 was dropped. A hole is not
    // cosmetic: the prompt instructs the model to cite [E2], nothing matches
    // it, and a model that "helpfully" renumbers E3 down to E2 silently
    // repoints every citation at the wrong source. Contiguity is part of the
    // citation contract, not tidiness.
    const perProvider = new Map<string, number>();
    for (const s of sources) {
        const prefix = s.marker.replace(/[0-9]+$/, '');
        const next = (perProvider.get(prefix) ?? 0) + 1;
        perProvider.set(prefix, next);
        s.marker = `${prefix}${next.toString()}`;
    }

    console.debug(
        `[includeSources] resolved ${sources.length.toString()} source(s), truncated ${truncatedCount.toString()}`,
        sources.map((s) => ({ marker: s.marker, title: s.title, url: s.url, facts: s.facts, body: s.body })),
    );

    if (options.quiet !== true) {
        for (const w of warnings) new Notice(`perplexed: ${w}`);
    }
    for (const w of warnings) console.warn(`[includeSources] ${w}`);

    return { sources, truncatedCount, warnings };
}

/**
 * Render resolved sources as the prompt block spliced above the section
 * skeleton. The `[E1]` marker namespace is load-bearing: the writing model
 * numbers its OWN web-search citations as bare [1], [2], so spliced sources
 * must live in a separate namespace or a claim gets footnoted to the wrong
 * document. See the citation-contract hazard in the plan.
 */
export function renderSourcesBlock(outcome: ResolveOutcome): string {
    const { sources, truncatedCount } = outcome;
    if (sources.length === 0) return '';

    const lines: string[] = [];
    lines.push('## Retrieved sources');
    lines.push('');
    lines.push(
        'The sources below were retrieved for you and are already verified as on-topic. '
        + 'Treat them as primary material. When you use one, cite it with its footnote '
        + 'marker EXACTLY as written, caret included — `[^E1]`, `[^E2]` — and never '
        + 'renumber them into the plain `[1]`, `[2]` sequence you use for your own '
        + 'web-search results. The two numbering systems are separate and must not be '
        + 'merged. Always put a space between the preceding text and the marker.',
    );
    lines.push('');

    for (const s of sources) {
        const head = s.url !== undefined
            ? `### [^${s.marker}] ${s.title} — ${s.url}`
            : `### [^${s.marker}] ${s.title}`;
        lines.push(s.publishedDate !== undefined ? `${head}  (published ${s.publishedDate})` : head);
        if (s.facts !== undefined) {
            lines.push('');
            lines.push('```yaml');
            lines.push(stringifyYaml(s.facts).trimEnd());
            lines.push('```');
        }
        if (s.body.length > 0) {
            lines.push('');
            lines.push(s.body);
        }
        lines.push('');
    }

    if (truncatedCount > 0) {
        lines.push(
            `<!-- perplexed: ${truncatedCount.toString()} further retrieved source(s) omitted to fit the context budget -->`,
        );
        lines.push('');
    }
    return lines.join('\n');
}
