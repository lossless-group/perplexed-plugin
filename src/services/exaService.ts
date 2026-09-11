import { requestUrl } from 'obsidian';

/**
 * Thin client for Exa's search API (https://api.exa.ai/search).
 *
 * Exa is used as a RETRIEVAL provider, not a generation provider: it finds and
 * extracts high-quality source material — especially structured company data,
 * where it materially outperforms Perplexity's grounded search — and that
 * material is spliced into the prompt of whichever model actually writes the
 * document. See context-v/plans/2026-09-10_Exa-Retrieval-Stage-and-Include-Sources.md
 *
 * TRANSPORT NOTE — this service deliberately uses Obsidian's `requestUrl()`
 * while perplexityService.ts and directoryTemplateService.ts use `node:https`.
 * That asymmetry is intentional. The Node path exists in those files solely to
 * stream past Perplexity's CORS policy from the app://obsidian.md origin. Exa
 * retrieval is a single non-streaming JSON POST, where `requestUrl` bypasses
 * CORS on its own and is the documented Obsidian API for the job.
 */

export const EXA_SEARCH_ENDPOINT = 'https://api.exa.ai/search';

/** Exa's `category` filter. Narrows the index to one entity class. */
export type ExaCategory =
    | 'company'
    | 'publication'
    | 'news'
    | 'personal site'
    | 'financial report'
    | 'people';

/**
 * Exa's search `type`. `auto` is the default and right for almost everything;
 * the `deep*` variants cost more and take 4-40s. See the pricing findings in
 * the plan — none of these are expensive enough to design around.
 */
export type ExaSearchType =
    | 'instant'
    | 'fast'
    | 'auto'
    | 'deep-lite'
    | 'deep'
    | 'deep-reasoning';

export interface ExaTextOptions {
    maxCharacters?: number;
    verbosity?: 'compact' | 'standard' | 'full';
    includeHtmlTags?: boolean;
}

export interface ExaSummaryOptions {
    /** What the summary should answer. Steers extraction toward the facts we need. */
    query?: string;
    /** JSON Schema — makes Exa return structured fields rather than prose. */
    schema?: Record<string, unknown>;
}

export interface ExaContentsOptions {
    text?: boolean | ExaTextOptions;
    summary?: ExaSummaryOptions;
    highlights?: boolean;
    /** Content freshness, -1 to 720 hours. */
    maxAgeHours?: number;
}

export interface ExaSearchRequest {
    query: string;
    type?: ExaSearchType;
    category?: ExaCategory;
    numResults?: number;
    /** Up to 1200 entries — vastly more generous than Perplexity's 10-domain cap. */
    includeDomains?: string[];
    excludeDomains?: string[];
    startPublishedDate?: string;
    endPublishedDate?: string;
    contents?: ExaContentsOptions;
}

/**
 * One record from Exa's curated entity library (exa.ai/library/organization/...).
 * Verified shape 2026-09-10: an ARRAY on each result, not an object, and the
 * useful payload is nested under `properties`.
 */
export interface ExaEntity {
    id?: string;
    type?: string;
    version?: number;
    /**
     * Observed keys for `type: "company"`: name, description, foundedYear,
     * headquarters, workforce, financials, webTraffic, research. Left loose
     * because the set varies by entity type and Exa adds to it.
     */
    properties?: Record<string, unknown>;
}

export interface ExaResult {
    id?: string;
    title?: string;
    url?: string;
    publishedDate?: string;
    author?: string;
    text?: string;
    /**
     * NOTE: when `contents.summary.schema` is supplied, Exa returns the
     * structured object SERIALIZED AS A JSON STRING, not as an object. Callers
     * wanting the fields must JSON.parse this — see parseSummary().
     */
    summary?: string;
    highlights?: string[];
    favicon?: string;
    image?: string;
    /** Curated structured data. An array; usually length 1 when present. */
    entities?: ExaEntity[];
}

export interface ExaSearchResponse {
    results: ExaResult[];
    requestId?: string;
    searchTime?: number;
    costDollars?: Record<string, unknown>;
}

export interface ExaServiceSettings {
    exaApiKey: string;
    exaEndpoint: string;
}

/**
 * Distinguishes "Exa itself said no" from "the network broke". Callers degrade
 * to a source-less run either way, but the Notice text differs and an auth
 * failure is worth surfacing more loudly than a transient 5xx.
 */
export class ExaError extends Error {
    readonly status: number | null;
    readonly isAuthFailure: boolean;

    constructor(message: string, status: number | null) {
        super(message);
        this.name = 'ExaError';
        this.status = status;
        this.isAuthFailure = status === 401 || status === 403;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrow one raw result object into ExaResult, dropping anything malformed. */
function coerceResult(raw: unknown): ExaResult | null {
    if (!isRecord(raw)) return null;
    const out: ExaResult = {};
    if (typeof raw['id'] === 'string') out.id = raw['id'];
    if (typeof raw['title'] === 'string') out.title = raw['title'];
    if (typeof raw['url'] === 'string') out.url = raw['url'];
    if (typeof raw['publishedDate'] === 'string') out.publishedDate = raw['publishedDate'];
    if (typeof raw['author'] === 'string') out.author = raw['author'];
    if (typeof raw['text'] === 'string') out.text = raw['text'];
    if (typeof raw['summary'] === 'string') out.summary = raw['summary'];
    if (typeof raw['favicon'] === 'string') out.favicon = raw['favicon'];
    if (typeof raw['image'] === 'string') out.image = raw['image'];
    const highlights = raw['highlights'];
    if (Array.isArray(highlights)) {
        out.highlights = highlights.filter((h): h is string => typeof h === 'string');
    }
    const entities = raw['entities'];
    if (Array.isArray(entities)) {
        const coerced = entities.filter(isRecord).map((e): ExaEntity => {
            const ent: ExaEntity = {};
            if (typeof e['id'] === 'string') ent.id = e['id'];
            if (typeof e['type'] === 'string') ent.type = e['type'];
            if (typeof e['version'] === 'number') ent.version = e['version'];
            if (isRecord(e['properties'])) ent.properties = e['properties'];
            return ent;
        });
        if (coerced.length > 0) out.entities = coerced;
    }
    // A result with neither a URL nor a title is not usable as a citable source.
    if (out.url === undefined && out.title === undefined) return null;
    return out;
}

/**
 * POST one search to Exa and return its parsed results.
 *
 * Throws ExaError on any non-2xx, missing key, or unparseable body. Callers in
 * the template pipeline MUST catch and degrade — a retrieval failure should
 * never abort a generation run that costs minutes and real money.
 */
export async function searchExa(
    settings: ExaServiceSettings,
    request: ExaSearchRequest,
): Promise<ExaSearchResponse> {
    const apiKey = settings.exaApiKey.trim();
    if (apiKey.length === 0) {
        throw new ExaError('Exa API key is not set.', null);
    }
    if (request.query.trim().length === 0) {
        throw new ExaError('Exa query is empty — nothing to retrieve.', null);
    }

    const endpoint = settings.exaEndpoint.trim().length > 0
        ? settings.exaEndpoint.trim()
        : EXA_SEARCH_ENDPOINT;

    let response;
    try {
        response = await requestUrl({
            url: endpoint,
            method: 'POST',
            headers: {
                // Exa's documented scheme is Bearer, not x-api-key — some SDK
                // wrappers still show the latter. Verified against the live
                // docs 2026-09-10.
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            // Handle non-2xx ourselves so the body's error text survives.
            throw: false,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new ExaError(`Exa request failed: ${msg}`, null);
    }

    if (response.status < 200 || response.status >= 300) {
        const detail = typeof response.text === 'string' && response.text.length > 0
            ? response.text.slice(0, 500)
            : '(no response body)';
        throw new ExaError(`Exa HTTP ${response.status.toString()} — ${detail}`, response.status);
    }

    const parsed: unknown = response.json;
    if (!isRecord(parsed)) {
        throw new ExaError('Exa returned a response that was not a JSON object.', response.status);
    }

    const rawResults = parsed['results'];
    const results = Array.isArray(rawResults)
        ? rawResults.map(coerceResult).filter((r): r is ExaResult => r !== null)
        : [];

    const out: ExaSearchResponse = { results };
    if (typeof parsed['requestId'] === 'string') out.requestId = parsed['requestId'];
    if (typeof parsed['searchTime'] === 'number') out.searchTime = parsed['searchTime'];
    if (isRecord(parsed['costDollars'])) out.costDollars = parsed['costDollars'];

    // Cost is logged, never guarded. A typical retrieval is ~$0.02 and the free
    // tier grants $10/month; building budget machinery would cost more than it
    // could ever save. See the pricing findings in the plan.
    console.debug(
        `[exaService] ${results.length.toString()} results in ${(out.searchTime ?? 0).toString()}ms`,
        out.costDollars ?? '(no cost reported)',
    );

    return out;
}

/**
 * Connectivity probe for the "Check Exa service status" command. Cheapest
 * possible real call: one result, no content extraction.
 */
export async function probeExa(settings: ExaServiceSettings): Promise<number> {
    const res = await searchExa(settings, {
        query: 'Exa AI search API',
        type: 'fast',
        numResults: 1,
    });
    return res.results.length;
}

/**
 * Parse a result's `summary` into its structured fields.
 *
 * Exa returns a schema-shaped summary as a JSON *string*, so this is the only
 * way to reach the fields a template asked for. Returns null when no schema was
 * used (the summary is then plain prose) or when the string doesn't parse —
 * callers fall back to rendering `summary` verbatim.
 *
 * Empty fields are a GOOD signal, not a failure: verified 2026-09-10 that Exa
 * omits schema fields it has no data for rather than fabricating them, so a
 * blank `funding` means "unknown", not "free".
 */
export function parseSummary(result: ExaResult): Record<string, unknown> | null {
    const raw = result.summary;
    if (raw === undefined || raw.trim().length === 0) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Convenience accessor for the curated company record, when present. */
export function entityProperties(result: ExaResult): Record<string, unknown> | null {
    const first = result.entities?.[0];
    return first?.properties ?? null;
}
