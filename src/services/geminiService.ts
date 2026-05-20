import { Notice, request } from 'obsidian';
import type { Editor } from 'obsidian';
import type { PromptsService } from './promptsService';

export interface GeminiOptions {
    enableGrounding?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemInstruction?: string;
    includeSearchSuggestions?: boolean;
    /**
     * Resolve vertexaisearch.cloud.google.com grounding redirects to the real
     * source URL before writing citations. The redirect URLs expire ~30 days
     * after the response, so without this the Citations footer rots on a clock.
     * Costs one HEAD-like fetch per unique source (parallelized, 3s timeout each).
     */
    resolveCitationUrls?: boolean;
}

export interface GeminiSettings {
    geminiApiKey: string;
    promptsService?: PromptsService | null;
    headerPosition?: 'top' | 'bottom';
}

interface GroundingChunk {
    web?: { uri: string; title?: string };
}

interface GroundingSupport {
    segment?: { startIndex?: number; endIndex?: number; text?: string };
    groundingChunkIndices?: number[];
    confidenceScores?: number[];
}

interface GroundingMetadata {
    webSearchQueries?: string[];
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
    searchEntryPoint?: { renderedContent?: string };
}

interface GeminiCandidate {
    content?: { parts?: Array<{ text?: string }>; role?: string };
    groundingMetadata?: GroundingMetadata;
    finishReason?: string;
}

interface GeminiResponseChunk {
    candidates?: GeminiCandidate[];
    promptFeedback?: { blockReason?: string };
}

interface GeminiCitation {
    url: string;
    title: string;
    citedText: string;
}

const DEFAULT_MAX_TOKENS = 32000;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiService {
    private settings: GeminiSettings;

    constructor(settings: GeminiSettings) {
        this.settings = settings;
    }

    public updateApiKey(apiKey: string): void {
        this.settings.geminiApiKey = apiKey;
    }

    public async queryGemini(
        query: string,
        model: string,
        stream: boolean,
        editor: Editor,
        options?: GeminiOptions
    ): Promise<void> {
        if (!this.settings.geminiApiKey) {
            new Notice('Gemini API key not configured. Set GEMINI_API_KEY in .env or in plugin settings.');
            return;
        }

        const timestamp = new Date().toISOString();
        const cursor = editor.getCursor();
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');

        const headerText = `\n\n***\n> [!info] **Gemini Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> \n> **Model:** ${model}\n> \n>`;

        let responseCursor: { line: number; ch: number };
        if (this.settings.headerPosition === 'bottom') {
            responseCursor = { ...cursor };
        } else {
            editor.replaceRange(headerText, cursor, cursor);
            const headerLines = headerText.split('\n');
            const lastLine = headerLines[headerLines.length - 1] ?? '';
            responseCursor = {
                line: cursor.line + headerLines.length - 1,
                ch: lastLine.length,
            };
        }

        const body: Record<string, unknown> = {
            contents: [{ role: 'user', parts: [{ text: query }] }],
            generationConfig: {
                maxOutputTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
                temperature: options?.temperature ?? 0.7,
            },
        };

        if (options?.systemInstruction) {
            body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
        }

        if (options?.enableGrounding !== false) {
            // The google_search tool is the per-segment-grounding successor to
            // google_search_retrieval. Gemini 2.x emits groundingSupports[] that
            // map text spans → groundingChunks[] indices — the per-claim attribution
            // that Claude's web_search_20260209 dynamic-filter pass loses.
            body.tools = [{ google_search: {} }];
        }

        try {
            if (stream) {
                await this.handleStreamingResponse(model, body, editor, responseCursor, headerText, options);
            } else {
                await this.handleNonStreamingResponse(model, body, editor, responseCursor, headerText, options);
            }
        } catch (error) {
            this.handleError(error, editor);
        }
    }

    private async handleStreamingResponse(
        model: string,
        body: Record<string, unknown>,
        editor: Editor,
        responseCursor: { line: number; ch: number },
        headerText: string,
        options?: GeminiOptions
    ): Promise<void> {
        const url = `${API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
        // activeWindow.fetch because requestUrl buffers SSE bodies.
        const response = await activeWindow.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                'X-goog-api-key': this.settings.geminiApiKey,
            },
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini HTTP ${response.status}: ${errText}`);
        }
        if (!response.body) throw new Error('Gemini: no response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const currentPos = { ...responseCursor };
        let finalGrounding: GroundingMetadata | null = null;
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data) continue;
                let parsed: GeminiResponseChunk;
                try {
                    parsed = JSON.parse(data) as GeminiResponseChunk;
                } catch {
                    continue;
                }
                const cand = parsed.candidates?.[0];
                if (!cand) continue;

                const deltaText = (cand.content?.parts ?? [])
                    .map(p => p.text ?? '')
                    .join('');
                if (deltaText) {
                    fullText += deltaText;
                    editor.replaceRange(deltaText, currentPos);
                    const contentLines = deltaText.split('\n');
                    if (contentLines.length === 1) {
                        currentPos.ch += deltaText.length;
                    } else {
                        currentPos.line += contentLines.length - 1;
                        currentPos.ch = contentLines[contentLines.length - 1]?.length ?? 0;
                    }
                    editor.scrollIntoView({ from: currentPos, to: currentPos }, true);
                }

                if (cand.groundingMetadata) {
                    finalGrounding = this.mergeGrounding(finalGrounding, cand.groundingMetadata);
                }
            }
        }

        await this.afterResponse(editor, headerText, finalGrounding, fullText, options);
    }

    private async handleNonStreamingResponse(
        model: string,
        body: Record<string, unknown>,
        editor: Editor,
        responseCursor: { line: number; ch: number },
        headerText: string,
        options?: GeminiOptions
    ): Promise<void> {
        const url = `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
        const raw = await request({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-goog-api-key': this.settings.geminiApiKey,
            },
            body: JSON.stringify(body),
        });
        const parsed = JSON.parse(raw) as GeminiResponseChunk;
        const cand = parsed.candidates?.[0];
        const text = (cand?.content?.parts ?? []).map(p => p.text ?? '').join('');
        if (text) editor.replaceRange(text, responseCursor);

        await this.afterResponse(editor, headerText, cand?.groundingMetadata ?? null, text, options);
    }

    private mergeGrounding(prev: GroundingMetadata | null, next: GroundingMetadata): GroundingMetadata {
        if (!prev) return next;
        const merged: GroundingMetadata = {};
        const queries = [...new Set([...(prev.webSearchQueries ?? []), ...(next.webSearchQueries ?? [])])];
        if (queries.length > 0) merged.webSearchQueries = queries;
        const chunks = next.groundingChunks ?? prev.groundingChunks;
        if (chunks) merged.groundingChunks = chunks;
        const supports = next.groundingSupports ?? prev.groundingSupports;
        if (supports) merged.groundingSupports = supports;
        const entry = next.searchEntryPoint ?? prev.searchEntryPoint;
        if (entry) merged.searchEntryPoint = entry;
        return merged;
    }

    private async afterResponse(
        editor: Editor,
        headerText: string,
        grounding: GroundingMetadata | null,
        _fullText: string,
        options?: GeminiOptions
    ): Promise<void> {
        if (grounding) {
            const queries = grounding.webSearchQueries ?? [];
            // Surface the queries Google ran. This is also the markdown-native
            // satisfaction of Google's grounding-attribution requirement: the
            // chip Google ships in searchEntryPoint.renderedContent is 5KB of
            // inline-styled HTML that Obsidian's markdown renderer can't display
            // cleanly (the <style> tag is stripped, leaving orphan <div> chips).
            // A bullet list of queries — each linked to google.com/search?q=…
            // — surfaces the same suggested searches in a form Obsidian renders
            // and the user can actually click.
            if (queries.length > 0 && options?.includeSearchSuggestions !== false) {
                this.appendSearchSuggestions(editor, queries);
            }

            const citations = this.extractCitations(grounding);
            if (citations.length > 0) {
                const resolved = options?.resolveCitationUrls === false
                    ? citations
                    : await this.resolveCitationUrls(citations);
                this.addCitations(editor, resolved);
            }
        }

        if (this.settings.headerPosition === 'bottom' && headerText) {
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange('\n\n' + headerText, endPos);
        }

        const endOfDoc = editor.lastLine();
        const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
        editor.replaceRange('\n\n***\n', endPos);
    }

    /**
     * Walk groundingMetadata and produce Lossless-spec citations.
     *
     * Gemini's google_search tool emits groundingChunks[] (URL+title per page)
     * AND groundingSupports[] (text span → which chunks). Where Claude's
     * web_search_20260209 loses per-claim attachment in the dynamic-filter
     * sandbox round-trip, Gemini's groundingSupports[] survives intact —
     * so cited_text comes from the segment.text and we keep per-segment
     * attribution.
     *
     * Note: support.segment.startIndex/endIndex are UTF-8 BYTE offsets into
     * the response text, not character offsets — fine for ASCII, but anyone
     * wiring inline [N] markers later by slicing the response text will need
     * a Buffer-style indexer, not a JS string indexer.
     *
     * Note: chunk.web.title is the source DOMAIN (e.g. "nobelprize.org"), not
     * the page title. chunk.web.uri is a vertexaisearch.cloud.google.com
     * grounding redirect that expires ~30 days after the response —
     * resolveCitationUrls() resolves to the durable URL before writing.
     */
    private extractCitations(g: GroundingMetadata): GeminiCitation[] {
        const chunks = g.groundingChunks ?? [];
        const byUrl = new Map<string, GeminiCitation>();

        // Pass 1: raw chunks as URL + title only (fallback when no support refs)
        for (const chunk of chunks) {
            const web = chunk.web;
            if (!web?.uri) continue;
            if (byUrl.has(web.uri)) continue;
            byUrl.set(web.uri, { url: web.uri, title: web.title || 'Source', citedText: '' });
        }

        // Pass 2: enrich with per-segment cited_text from groundingSupports
        const supports = g.groundingSupports ?? [];
        for (const support of supports) {
            const segmentText = support.segment?.text ?? '';
            if (!segmentText) continue;
            for (const idx of support.groundingChunkIndices ?? []) {
                const chunk = chunks[idx];
                const uri = chunk?.web?.uri;
                if (!uri) continue;
                const existing = byUrl.get(uri);
                if (existing) {
                    // First per-segment quote wins (closest to source of truth).
                    if (!existing.citedText) existing.citedText = segmentText;
                } else {
                    byUrl.set(uri, {
                        url: uri,
                        title: chunk.web?.title || 'Source',
                        citedText: segmentText,
                    });
                }
            }
        }

        const out = Array.from(byUrl.values());
        console.debug(
            `[GeminiService] extractCitations — chunks: ${chunks.length}; ` +
            `supports: ${supports.length}; extracted: ${out.length}`
        );
        return out;
    }

    /**
     * Emit a Citations section per the Lossless Citation Spec — Gemini extension.
     * Same shape as ClaudeService.addCitations so cite-wide hex-substitution
     * passes are provider-agnostic.
     */
    private addCitations(editor: Editor, citations: GeminiCitation[]): void {
        if (citations.length === 0) return;

        const content = editor.getValue();
        const existingMatch = content.match(
            /### Citations\n\n([\s\S]*?)(?=\n\n\*\*\*|\n\n### |\n\n## |\n\n# |$)/
        );

        let existing = '';
        let n = 1;
        if (existingMatch && existingMatch[1]) {
            existing = existingMatch[1];
            const numbered = existing.match(/\[(\d+)\]:/g);
            if (numbered && numbered.length > 0) {
                const max = Math.max(...numbered.map(s => {
                    const m = s.match(/\d+/);
                    return m ? parseInt(m[0]) : 0;
                }));
                n = max + 1;
            }
        }

        let added = '';
        citations.forEach((c, i) => {
            const collapsed = c.citedText.replace(/\s*\n\s*/g, ' ').trim();
            const suffix = collapsed ? ` > ${collapsed}` : '';
            const safeTitle = c.title.replace(/\]/g, '\\]');
            added += `[${n + i}]: [${safeTitle}](${c.url}).${suffix}\n\n`;
        });

        if (existingMatch) {
            const updated = existing + added;
            const startIdx = content.indexOf('### Citations');
            const endIdx = startIdx + '### Citations\n\n'.length + existing.length;
            const before = content.substring(0, startIdx + '### Citations\n\n'.length);
            const after = content.substring(endIdx);
            editor.setValue(before + updated + after);
        } else {
            const text = '\n\n### Citations\n\n' + added;
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange(text, endPos);
        }
    }

    /**
     * Markdown-native rendering of the Google Search queries Gemini ran. Doubles
     * as the markdown-friendly substitute for searchEntryPoint.renderedContent —
     * each query is linked to google.com/search?q=… so the user can re-run the
     * search, which is the spirit of Google's grounding-attribution requirement.
     */
    private appendSearchSuggestions(editor: Editor, queries: string[]): void {
        const lines = queries.map(q => {
            const safe = q.replace(/`/g, '\\`');
            const href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            return `- [\`${safe}\`](${href})`;
        }).join('\n');
        const block = `\n\n### Google Searches\n\n${lines}\n`;
        const endOfDoc = editor.lastLine();
        const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
        editor.replaceRange(block, endPos);
    }

    /**
     * Resolve vertexaisearch.cloud.google.com grounding redirects to the real
     * source URL + a real page title.
     *
     * Why not fetch(): browser-context fetch from app://obsidian.md to
     * vertexaisearch.cloud.google.com is blocked by CORS (no
     * Access-Control-Allow-Origin), and even when `redirect: 'manual'` would
     * theoretically expose the Location header, cross-origin opaqueredirect
     * responses hide it. Obsidian's `requestUrl` runs Node-side, ignores CORS,
     * follows redirects, and returns the final HTML — so we both bypass the
     * block AND get a page we can scrape for og:url + <title>.
     *
     * Parallel with 5s timeout per request. On any failure (timeout, network,
     * parse error) we keep the original redirect URL so the citation is at
     * least navigable today even if it rots in 30 days.
     */
    private async resolveCitationUrls(citations: GeminiCitation[]): Promise<GeminiCitation[]> {
        const REDIRECT_HOST = 'vertexaisearch.cloud.google.com';
        const TIMEOUT_MS = 5000;

        const fetchWithTimeout = async (url: string): Promise<string | null> => {
            try {
                const result = await Promise.race([
                    request({ url, method: 'GET' }),
                    new Promise<never>((_, reject) =>
                        activeWindow.setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
                    ),
                ]);
                return result;
            } catch {
                return null;
            }
        };

        const extractCanonicalUrl = (html: string): string | null => {
            // <link rel="canonical" href="..."> — most authoritative
            const linkMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
                ?? html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']canonical["']/i);
            if (linkMatch && linkMatch[1]) return linkMatch[1];
            // <meta property="og:url" content="..."> — second best
            const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:url["'][^>]+content\s*=\s*["']([^"']+)["']/i)
                ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:url["']/i);
            if (ogMatch && ogMatch[1]) return ogMatch[1];
            return null;
        };

        const extractTitle = (html: string): string | null => {
            // Prefer og:title, fall back to <title>
            const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i)
                ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:title["']/i);
            if (ogMatch && ogMatch[1]) return this.decodeHtmlEntities(ogMatch[1]).trim();
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) return this.decodeHtmlEntities(titleMatch[1]).trim();
            return null;
        };

        const resolveOne = async (c: GeminiCitation): Promise<GeminiCitation> => {
            if (!c.url.includes(REDIRECT_HOST)) return c;
            const html = await fetchWithTimeout(c.url);
            if (!html) {
                console.debug('[GeminiService] resolveCitationUrls — fetch failed; keeping redirect', c.url);
                return c;
            }
            const canonical = extractCanonicalUrl(html);
            const pageTitle = extractTitle(html);
            return {
                ...c,
                url: canonical ?? c.url,
                title: pageTitle ?? c.title,
            };
        };

        return Promise.all(citations.map(resolveOne));
    }

    private decodeHtmlEntities(s: string): string {
        return s
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 10)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 16)));
    }

    private handleError(error: unknown, editor: Editor): void {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Gemini error:', error);
        new Notice(`Gemini error: ${msg}`);
        editor.replaceRange(`\n**Error:** ${msg}\n\n***\n`, editor.getCursor());
    }
}
