import { requestUrl } from 'obsidian';

/**
 * Thin client for Fireround's funding feed, which is served through Firecrawl's
 * Alexandria catalogue (POST /v2/scrape with an `alexandria` body) and billed to
 * the Firecrawl key.
 *
 * Like Exa, Fireround is a RETRIEVAL provider: its rounds are spliced into the
 * prompt as citeable sources, and can also be written verbatim into the note
 * (see `write-json-under` in includeSourcesService.ts).
 */

export const FIREROUND_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';

export type FireroundRecord = Record<string, unknown>;

export class FireroundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FireroundError';
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * The domain to look a company up by, or null when the note's URL isn't a
 * company homepage.
 *
 * A deep URL means the note is about something hosted ON that domain: a product
 * of a larger company (openai.com/sora) or a project on a platform
 * (huggingface.co/some-org/some-model). Fireround's rounds for that domain belong
 * to the host, and attributing them to the note's subject would be wrong in a
 * way that reads as verified fact.
 */
export function homepageDomain(url: string | undefined): string | null {
    if (url === undefined) return null;
    try {
        const parsed = new URL(url.trim());
        if (parsed.pathname.replace(/\/+$/, '') !== '') return null;
        return parsed.hostname.replace(/^www\./, '').toLowerCase() || null;
    } catch {
        return null;
    }
}

/**
 * Rounds whose company is exactly this domain, as Fireround returned them. `q`
 * is a fuzzy search, so a similarly named company can come back too; its rounds
 * are never kept.
 */
export function roundsForDomain(records: unknown, domain: string): FireroundRecord[] {
    if (!Array.isArray(records)) return [];
    return records.filter((r): r is FireroundRecord => {
        if (!isRecord(r) || !isRecord(r['company'])) return false;
        const d = r['company']['domain'];
        return typeof d === 'string' && d.trim().toLowerCase() === domain;
    });
}

/** Every round Fireround has for this company's domain. Empty when it has none. */
export async function searchRounds(apiKey: string, domain: string, limit: number): Promise<FireroundRecord[]> {
    let res;
    try {
        res = await requestUrl({
            url: FIREROUND_ENDPOINT,
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                alexandria: { provider: 'fireround', capability: 'rounds/search', options: { q: domain, limit } },
            }),
            throw: false,
        });
    } catch (err) {
        throw new FireroundError(`network error (${err instanceof Error ? err.message : 'unknown'})`);
    }
    if (res.status >= 400) {
        throw new FireroundError(`HTTP ${res.status.toString()} (${(res.text ?? '').slice(0, 200).replace(/\s+/g, ' ')})`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(res.text);
    } catch {
        throw new FireroundError('the response was not JSON');
    }
    const data = isRecord(parsed) ? parsed['data'] : undefined;
    const list = isRecord(data) ? data['alexandria'] : undefined;
    const entry: unknown = Array.isArray(list) ? list[0] : undefined;
    if (!isRecord(entry)) throw new FireroundError('the response had no Fireround result');

    // A capability can fail, for example on unaccepted terms, inside a 200.
    const error = entry['error'];
    if (error !== undefined && error !== null && error !== '') {
        const message = isRecord(error) && typeof error['message'] === 'string' ? error['message'] : JSON.stringify(error);
        throw new FireroundError(message.slice(0, 200));
    }
    const payload = entry['data'];
    return roundsForDomain(isRecord(payload) ? payload['data'] : undefined, domain);
}
