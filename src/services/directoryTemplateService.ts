import type { App, TFile } from 'obsidian';
import { Notice, parseYaml, stringifyYaml } from 'obsidian';

export interface DirectoryTemplateSettings {
    perplexityApiKey: string;
    perplexityEndpoint: string;
    templatesRoot: string;
    frontmatterWhitelist: string[];
    requestTimeoutMs: number;
}

export interface TemplateFile {
    file: TFile;
    frontmatter: Record<string, unknown>;
    title: string;
    description: string;
    appliesToPaths: string[];
}

export interface ParsedTemplate {
    file: TFile;
    cftConfig: Record<string, unknown>;
    cftSystem: string;
    userSkeleton: string;
}

interface PerplexityPayload {
    model: string;
    messages: { role: string; content: string }[];
    stream: boolean;
    return_citations: boolean;
    return_images: boolean;
    return_related_questions: boolean;
    search_recency_filter?: string;
}

export interface PerplexitySource {
    title?: string;
    url?: string;
    date?: string;
    last_updated?: string;
}

const INLINE_CITATION_DIRECTIVE = "When you make any factual claim that comes from a web search result, append a numeric citation marker like [1], [2], etc. immediately after the claim. The numbers MUST correspond 1:1 to the order of the search results returned by the search tool (first result = [1], second = [2], and so on). You may cite the same source multiple times. Do not list the sources at the end — only inline markers. Do not invent sources; only cite results actually used.";

function buildResearchFraming(title: string, fmYaml: string): string {
    return `Research the entity "${title}" using web search. Use the metadata below as context, then produce a structured profile that follows the markdown skeleton at the end of this prompt. Every factual claim in your output must be immediately followed by an inline [N] citation marker corresponding to a returned search result. Quote phrasing from sources where useful.

Metadata for "${title}":
${fmYaml}

Skeleton (follow this structure; bullets under each heading describe what the section requires):

`;
}

function wrapThinkBlocks(text: string): string {
    return text.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
        const trimmed = inner.replace(/^\s+/, '').replace(/\s+$/, '');
        return '```think-output\n' + trimmed + '\n```';
    });
}

function buildSourcesFooter(sources: PerplexitySource[]): string {
    if (!sources.length) return '';
    // Canonical Lossless reference-section format per
    // cite-wide/context-v/reminders/Lossless-Citation-Spec.md:
    //   "always use a `: ` after the citation identifier".
    // cite-wide's parser (REFDEF_NUM_RE, line 91 of llmCitationParserService.ts)
    // accepts both `[N]` and `[N]:` thanks to the `(:?)` group, but the colon
    // form matches the spec, so emit it.
    //
    // Footer shape: blank line before the `***` separator, blank line between
    // the separator and the `# Sources` h1, blank line before the references.
    const lines = sources.map((s, i) => {
        const n = i + 1;
        const title = (typeof s.title === 'string' && s.title) ? s.title : (s.url ?? 'Source');
        const url = s.url ?? '';
        return url ? `[${n.toString()}]: [${title}](${url})` : `[${n.toString()}]: ${title}`;
    });
    return '\n\n***\n\n# Sources\n\n' + lines.join('\n') + '\n';
}

const FRONTMATTER_FENCE = '---';
const CFT_OPEN_RE = /^```cft\b\s*$/;
const FENCE_CLOSE_RE = /^```\s*$/;
const SCRATCH_TERMINATOR_RE = /^\*\*\*\s*$/;

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    if (lines[0] !== FRONTMATTER_FENCE) {
        return { frontmatter: '', body: normalized };
    }
    let i = 1;
    while (i < lines.length && lines[i] !== FRONTMATTER_FENCE) i++;
    if (i >= lines.length) return { frontmatter: '', body: normalized };
    const fm = lines.slice(1, i).join('\n');
    const body = lines.slice(i + 1).join('\n');
    return { frontmatter: fm, body };
}

function safeParseYaml(yaml: string): Record<string, unknown> {
    if (!yaml.trim()) return {};
    try {
        const parsed: unknown = parseYaml(yaml);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return {};
    } catch {
        return {};
    }
}

function globToRegExp(glob: string): RegExp {
    let re = '^';
    let i = 0;
    while (i < glob.length) {
        const c = glob[i] ?? '';
        if (c === '*' && glob[i + 1] === '*') {
            if (glob[i + 2] === '/') {
                re += '(?:.*/)?';
                i += 3;
            } else {
                re += '.*';
                i += 2;
            }
        } else if (c === '*') {
            re += '[^/]*';
            i++;
        } else if (c === '?') {
            re += '[^/]';
            i++;
        } else if ('.+^$|(){}[]\\'.includes(c)) {
            re += '\\' + c;
            i++;
        } else {
            re += c;
            i++;
        }
    }
    re += '$';
    return new RegExp(re);
}

export function pathMatchesGlobs(path: string, globs: string[]): boolean {
    if (!globs.length) return false;
    return globs.some(g => globToRegExp(g).test(path));
}

export async function listTemplates(app: App, root: string): Promise<TemplateFile[]> {
    const normalizedRoot = root.replace(/\/$/, '');
    if (!normalizedRoot) return [];
    const all = app.vault.getMarkdownFiles();
    const results: TemplateFile[] = [];
    for (const file of all) {
        if (!file.path.startsWith(normalizedRoot + '/')) continue;
        const cache = app.metadataCache.getFileCache(file);
        const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
        const appliesToRaw = fm['applies-to-paths'];
        const appliesToPaths = Array.isArray(appliesToRaw)
            ? appliesToRaw.filter((g): g is string => typeof g === 'string')
            : typeof appliesToRaw === 'string' ? [appliesToRaw] : [];
        results.push({
            file,
            frontmatter: fm,
            title: typeof fm.title === 'string' ? fm.title : file.basename,
            description: typeof fm.description === 'string' ? fm.description : '',
            appliesToPaths,
        });
    }
    return results;
}

export async function loadTemplate(app: App, file: TFile): Promise<ParsedTemplate | null> {
    const content = await app.vault.read(file);
    const { body } = splitFrontmatter(content);
    const lines = body.split('\n');

    let cftStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (CFT_OPEN_RE.test(lines[i] ?? '')) { cftStart = i; break; }
    }
    if (cftStart < 0) return null;

    let cftEnd = -1;
    for (let i = cftStart + 1; i < lines.length; i++) {
        if (FENCE_CLOSE_RE.test(lines[i] ?? '')) { cftEnd = i; break; }
    }
    if (cftEnd < 0) return null;

    const cftYaml = lines.slice(cftStart + 1, cftEnd).join('\n');
    const cftParsed = safeParseYaml(cftYaml);
    const systemPrompt = typeof cftParsed.system === 'string' ? cftParsed.system : '';
    const cftConfig = { ...cftParsed };
    delete cftConfig.system;

    let skeletonEnd = lines.length;
    for (let i = cftEnd + 1; i < lines.length; i++) {
        if (SCRATCH_TERMINATOR_RE.test(lines[i] ?? '')) { skeletonEnd = i; break; }
    }
    const userSkeleton = lines.slice(cftEnd + 1, skeletonEnd).join('\n').trim();

    return { file, cftConfig, cftSystem: systemPrompt, userSkeleton };
}

export function buildFrontmatterPayload(
    fm: Record<string, unknown>,
    whitelist: string[],
): string {
    const filtered: Record<string, unknown> = {};
    for (const key of whitelist) {
        if (key in fm) filtered[key] = fm[key];
    }
    if (Object.keys(filtered).length === 0) return '(none)';
    return stringifyYaml(filtered).trim();
}

function frontmatterValueToString(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(v => frontmatterValueToString(v)).join(', ');
    return stringifyYaml(value).trim();
}

export interface InterpolationContext {
    title: string;
    frontmatter: string;
    frontmatterObj: Record<string, unknown>;
}

export function interpolate(text: string, ctx: InterpolationContext): string {
    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (full, key: string) => {
        if (key === 'title') return ctx.title;
        if (key === 'frontmatter') return ctx.frontmatter;
        if (key === 'today') return new Date().toISOString().slice(0, 10);
        const fmKey = key.startsWith('frontmatter.') ? key.slice('frontmatter.'.length) : key;
        if (fmKey in ctx.frontmatterObj) {
            return frontmatterValueToString(ctx.frontmatterObj[fmKey]);
        }
        return full;
    });
}

function buildPayload(
    template: ParsedTemplate,
    systemPrompt: string,
    userPrompt: string,
): PerplexityPayload {
    const cfg = template.cftConfig;
    const model = typeof cfg.model === 'string' ? cfg.model : 'sonar-deep-research';
    const recency = typeof cfg['search-recency'] === 'string'
        ? cfg['search-recency']
        : undefined;
    const returnCitations = cfg['return-citations'] !== false;
    const returnImages = cfg['return-images'] === true;

    const payload: PerplexityPayload = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        stream: false,
        return_citations: returnCitations,
        return_images: returnImages,
        return_related_questions: false,
    };
    if (recency) payload.search_recency_filter = recency;
    return payload;
}

async function streamPerplexityToFile(
    app: App,
    apiKey: string,
    endpoint: string,
    payload: PerplexityPayload,
    timeoutMs: number,
    file: TFile,
    initialContent: string,
    isCancelled: () => boolean,
): Promise<{ streamed: string; sources: PerplexitySource[] }> {
    payload.stream = true;
    const controller = new AbortController();
    const timer = activeWindow.setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        // eslint-disable-next-line no-restricted-globals
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: 'no-store',
        });
    } catch (err) {
        activeWindow.clearTimeout(timer);
        throw err;
    }

    if (!response.ok) {
        activeWindow.clearTimeout(timer);
        throw new Error(`Perplexity HTTP ${response.status.toString()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        activeWindow.clearTimeout(timer);
        throw new Error('Perplexity returned no response body');
    }

    const decoder = new TextDecoder();
    let sseBuffer = '';
    let streamed = '';
    let sources: PerplexitySource[] = [];
    let lastFlush = 0;
    const FLUSH_MS = 500;

    try {
        while (true) {
            if (isCancelled()) {
                controller.abort();
                break;
            }
            const { value, done } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                    const parsed: unknown = JSON.parse(data);
                    if (typeof parsed !== 'object' || parsed === null) continue;
                    const obj = parsed as Record<string, unknown>;
                    const choices = obj['choices'];
                    if (Array.isArray(choices) && choices.length > 0) {
                        const first = choices[0] as Record<string, unknown> | undefined;
                        const delta = first?.['delta'] as Record<string, unknown> | undefined;
                        const content = delta?.['content'];
                        if (typeof content === 'string') {
                            streamed += content;
                        }
                    }
                    const sr = obj['search_results'];
                    if (Array.isArray(sr)) {
                        sources = sr.filter((x): x is PerplexitySource =>
                            typeof x === 'object' && x !== null);
                    }
                } catch {
                    // partial JSON; skip
                }
            }

            const now = Date.now();
            if (now - lastFlush >= FLUSH_MS) {
                await app.vault.modify(file, initialContent + streamed);
                lastFlush = now;
            }
        }
    } finally {
        activeWindow.clearTimeout(timer);
        try {
            reader.releaseLock();
        } catch {
            // already released
        }
    }

    // Final flush of raw stream content before post-processing
    await app.vault.modify(file, initialContent + streamed);

    return { streamed, sources };
}

export type ApplyOutcome =
    | { status: 'applied'; mode: 'fill' | 'append'; sourceCount: number }
    | { status: 'skipped'; reason: string }
    | { status: 'error'; error: string };

export interface ApplyOptions {
    quiet?: boolean;
    isCancelled?: () => boolean;
}

export async function applyTemplate(
    app: App,
    settings: DirectoryTemplateSettings,
    target: TFile,
    template: ParsedTemplate,
    options: ApplyOptions = {},
): Promise<ApplyOutcome> {
    const quiet = options.quiet === true;
    const isCancelled = options.isCancelled ?? (() => false);

    if (!settings.perplexityApiKey) {
        if (!quiet) new Notice('Perplexity API key is not set.');
        return { status: 'error', error: 'Perplexity API key not set' };
    }
    if (!template.userSkeleton) {
        if (!quiet) new Notice('Template has no skeleton (no content below the cft block).');
        return { status: 'error', error: 'Template has no skeleton' };
    }

    const targetContent = await app.vault.read(target);
    const { frontmatter: fmRaw, body } = splitFrontmatter(targetContent);
    const existingBody = body.replace(/\s+$/, '');
    const mode: 'fill' | 'append' = existingBody.trim().length === 0 ? 'fill' : 'append';

    const fm = safeParseYaml(fmRaw);
    const title = typeof fm.title === 'string' ? fm.title : target.basename;
    const fmYaml = buildFrontmatterPayload(fm, settings.frontmatterWhitelist);

    const ctx: InterpolationContext = { title, frontmatter: fmYaml, frontmatterObj: fm };
    const templateSystem = interpolate(template.cftSystem, ctx);
    const interpolatedSkeleton = interpolate(template.userSkeleton, ctx);

    // Combined system prompt: citation-enforcement directive first, then template's role framing.
    const systemPrompt = templateSystem
        ? `${INLINE_CITATION_DIRECTIVE}\n\n${templateSystem}`
        : INLINE_CITATION_DIRECTIVE;

    // User prompt: research framing prepended to the skeleton so the model treats this as a
    // research task, not a writing brief.
    const userPrompt = buildResearchFraming(title, fmYaml) + interpolatedSkeleton;

    // Initial file content the stream will append to.
    const fmBlock = fmRaw.length > 0 ? `---\n${fmRaw}\n---\n` : '';
    const initialContent = mode === 'fill'
        ? `${fmBlock}\n`
        : `${fmBlock}\n${existingBody}\n\n`;

    const payload = buildPayload(template, systemPrompt, userPrompt);

    let loadingNotice: Notice | null = null;
    if (!quiet) {
        loadingNotice = new Notice('Streaming Perplexity deep research…', 0);
    }
    try {
        // Set initial state before streaming begins.
        await app.vault.modify(target, initialContent);

        const { streamed, sources } = await streamPerplexityToFile(
            app,
            settings.perplexityApiKey,
            settings.perplexityEndpoint,
            payload,
            settings.requestTimeoutMs,
            target,
            initialContent,
            isCancelled,
        );

        // Post-write cleanup: wrap <think> blocks, append sources footer.
        const trimmedStreamed = streamed.replace(/^\s+/, '').replace(/\s+$/, '');
        const cleanedStreamed = wrapThinkBlocks(trimmedStreamed);
        const sourcesFooter = buildSourcesFooter(sources);
        const finalContent = `${initialContent}${cleanedStreamed}\n${sourcesFooter}`;
        await app.vault.modify(target, finalContent);

        if (!quiet) {
            const verb = mode === 'fill' ? 'Filled' : 'Appended to';
            new Notice(`${verb} "${target.basename}" using ${template.file.basename} (${sources.length.toString()} sources)`);
        }
        return { status: 'applied', mode, sourceCount: sources.length };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!quiet) new Notice(`Perplexity error: ${msg}`);
        return { status: 'error', error: msg };
    } finally {
        if (loadingNotice) loadingNotice.hide();
    }
}

export interface BatchProgress {
    current: number;
    total: number;
    file: TFile;
}

export interface BatchResult {
    appliedFill: number;
    appliedAppend: number;
    errored: number;
    cancelled: boolean;
    errors: { path: string; error: string }[];
}

export async function applyTemplateBatch(
    app: App,
    settings: DirectoryTemplateSettings,
    files: TFile[],
    template: ParsedTemplate,
    onProgress: (p: BatchProgress) => void,
    isCancelled: () => boolean,
): Promise<BatchResult> {
    const result: BatchResult = {
        appliedFill: 0,
        appliedAppend: 0,
        errored: 0,
        cancelled: false,
        errors: [],
    };
    for (let i = 0; i < files.length; i++) {
        if (isCancelled()) {
            result.cancelled = true;
            return result;
        }
        const file = files[i];
        if (!file) continue;
        onProgress({ current: i + 1, total: files.length, file });
        const outcome = await applyTemplate(app, settings, file, template, { quiet: true });
        if (outcome.status === 'applied') {
            if (outcome.mode === 'fill') result.appliedFill++;
            else result.appliedAppend++;
        } else if (outcome.status === 'error') {
            result.errored++;
            result.errors.push({ path: file.path, error: outcome.error });
        }
    }
    return result;
}

export function listMarkdownFilesInFolder(app: App, folderPath: string): TFile[] {
    const normalized = folderPath.replace(/\/$/, '');
    return app.vault.getMarkdownFiles().filter(f => {
        if (normalized === '') return true;
        return f.path === normalized || f.path.startsWith(normalized + '/');
    });
}
