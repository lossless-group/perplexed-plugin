import { requestUrl } from 'obsidian';

/**
 * Image search through Perplexity's Agent API.
 *
 * Sonar Chat Completions ended on 2026-09-27. Sonar requests still run, but
 * Perplexity reformulates them as Agent API requests and `return_images` has
 * no equivalent there, so the `images` array silently stopped arriving. Images
 * now come from the `image_search` tool; this makes one forced call to it and
 * returns results in the shape the existing [IMAGE N: …] code already reads.
 */

export const PERPLEXITY_AGENT_ENDPOINT = 'https://api.perplexity.ai/v1/agent';

export interface SearchedImage {
    image_url?: string;
    origin_url?: string;
    width?: number;
    height?: number;
}

/** Long enough for a forced tool call; short enough that a stall never holds up a note. */
export const IMAGE_SEARCH_TIMEOUT_MS = 30_000;

export interface ImageSearchOptions {
    maxResults?: number;
    timeoutMs?: number;
    /** Hostnames only, e.g. `matroid.com`. */
    domainFilter?: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Images from the response's `image_search_results` items. Empty when there are none. */
export function imagesFromAgentResponse(parsed: unknown): SearchedImage[] {
    if (!isRecord(parsed) || !Array.isArray(parsed['output'])) return [];
    const images: SearchedImage[] = [];
    for (const item of parsed['output']) {
        if (!isRecord(item) || item['type'] !== 'image_search_results') continue;
        const results = item['results'];
        if (!Array.isArray(results)) continue;
        for (const r of results) {
            if (!isRecord(r) || typeof r['image_url'] !== 'string') continue;
            const image: SearchedImage = { image_url: r['image_url'] };
            if (typeof r['origin_url'] === 'string') image.origin_url = r['origin_url'];
            if (typeof r['width'] === 'number') image.width = r['width'];
            if (typeof r['height'] === 'number') image.height = r['height'];
            images.push(image);
        }
    }
    return images;
}

/**
 * Images for `query`, or an empty list on any failure or after the timeout.
 * Never throws: a missing image must not cost the user the text it was meant
 * to illustrate.
 */
export async function searchImages(
    apiKey: string,
    query: string,
    options: ImageSearchOptions = {},
): Promise<SearchedImage[]> {
    if (!apiKey || !query.trim()) return [];
    const timeoutMs = options.timeoutMs ?? IMAGE_SEARCH_TIMEOUT_MS;
    // requestUrl can't be aborted, so a stalled request is abandoned, not cancelled.
    let timer: number | undefined;
    const timeout = new Promise<SearchedImage[]>((resolve) => {
        timer = window.setTimeout(() => {
            console.warn(`[imageSearchService] no response after ${timeoutMs.toString()}ms; continuing without images`);
            resolve([]);
        }, timeoutMs);
    });
    try {
        return await Promise.race([requestImages(apiKey, query, options), timeout]);
    } finally {
        window.clearTimeout(timer);
    }
}

async function requestImages(
    apiKey: string,
    query: string,
    options: ImageSearchOptions,
): Promise<SearchedImage[]> {
    const tool: Record<string, unknown> = {
        type: 'image_search',
        max_results: Math.min(Math.max(options.maxResults ?? 6, 1), 30),
    };
    if (options.domainFilter && options.domainFilter.length > 0) {
        tool['filters'] = { domain_filter: options.domainFilter };
    }

    try {
        const res = await requestUrl({
            url: PERPLEXITY_AGENT_ENDPOINT,
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                effort: 'fast',
                // Short and focused: image search matches the query text, and a
                // whole prompt or note body returns unrelated pictures.
                input: query.slice(0, 400),
                tools: [tool],
                tool_choice: { type: 'image_search' },
                max_output_tokens: 200,
            }),
            throw: false,
        });
        if (res.status >= 400) {
            console.warn(`[imageSearchService] HTTP ${res.status.toString()}: ${(res.text ?? '').slice(0, 200)}`);
            return [];
        }
        return imagesFromAgentResponse(JSON.parse(res.text));
    } catch (err) {
        console.warn('[imageSearchService] image search failed:', err);
        return [];
    }
}

/** Narrower than this is a thumbnail or an icon, not a screenshot. */
export const MIN_SCREENSHOT_WIDTH = 800;

/**
 * The largest images, dropping known-small ones. Images without a stated width
 * are kept, after every image that has one.
 */
export function pickScreenshots(images: SearchedImage[], count: number): SearchedImage[] {
    const seen = new Set<string>();
    return images
        .filter((img) => {
            if (!img.image_url || seen.has(img.image_url)) return false;
            seen.add(img.image_url);
            return img.width === undefined || img.width >= MIN_SCREENSHOT_WIDTH;
        })
        .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
        .slice(0, count);
}

/** The bare hostname of `url`, or null when it isn't a web URL. */
export function siteDomain(url: string | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.hostname.replace(/^www\./, '').toLowerCase() || null;
    } catch {
        return null;
    }
}

/**
 * Product screenshots the company publishes on its own site: an image search
 * limited to the site's domain, keeping the largest results.
 */
export async function findSiteScreenshots(
    apiKey: string,
    name: string,
    url: string,
    count = 3,
): Promise<SearchedImage[]> {
    const domain = siteDomain(url);
    if (!domain) return [];
    // Ask for more than we keep: some results are thumbnails or logos.
    const found = await searchImages(apiKey, `${name} product interface screenshot`, {
        maxResults: Math.max(count * 3, 8),
        domainFilter: [domain],
    });
    return pickScreenshots(found, count);
}
