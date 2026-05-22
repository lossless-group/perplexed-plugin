import type { App } from 'obsidian';
import { normalizePath, Notice, parseYaml, stringifyYaml, TFile } from 'obsidian';

import { BUNDLED_PREAMBLES } from './templateSeederService';

export interface UserPreambleSpec {
    name: string;
    when: 'always' | 'return-images';
}

export interface DirectoryTemplateSettings {
    perplexityApiKey: string;
    perplexityEndpoint: string;
    templatesRoot: string;
    partialsRoot: string;
    preamblesRoot: string;
    systemPreambles: string[];
    userPreambles: UserPreambleSpec[];
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
    search_domain_filter?: string[];
}

export interface PerplexitySource {
    title?: string;
    url?: string;
    date?: string;
    last_updated?: string;
}

export interface PerplexityImage {
    image_url?: string;
    origin_url?: string;
}

/**
 * Strip frontmatter from a partial/preamble body before splicing into a prompt.
 * Partials and preambles are pure snippets; any frontmatter is editorial metadata
 * for the human, not content meant for Perplexity.
 */
function stripFrontmatter(text: string): string {
    const { body } = splitFrontmatter(text);
    return body.trimStart();
}

/**
 * Read a partial or preamble file from the vault. Returns null when the file
 * is absent or not a TFile — callers decide whether that's an error.
 */
async function readVaultMarkdown(app: App, root: string, name: string): Promise<string | null> {
    const filename = name.endsWith('.md') ? name : `${name}.md`;
    const path = normalizePath(`${root.replace(/\/$/, '')}/${filename}`);
    const f = app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return null;
    return await app.vault.read(f);
}

const INCLUDE_RE = /\{\{\s*include:\s*([\w.-]+)\s*\}\}/g;
const INCLUDE_MAX_DEPTH = 5;

/**
 * Recursively expand {{include: <name>}} directives by splicing the named
 * partial's body in place. Frontmatter on the partial is stripped. Depth and
 * cycle guards prevent runaway expansion. Missing partials are surfaced as an
 * inline `[[include: <name> — file not found]]` marker so the user can see
 * the typo in the generated output.
 */
async function expandIncludes(
    app: App,
    text: string,
    partialsRoot: string,
    seen: Set<string> = new Set(),
    depth = 0,
): Promise<string> {
    if (depth > INCLUDE_MAX_DEPTH) {
        return text.replace(INCLUDE_RE, (_full, name: string) =>
            `[[include: ${name} — max depth ${INCLUDE_MAX_DEPTH.toString()} exceeded]]`);
    }
    // Collect unique include names in this pass before doing async reads.
    const names = new Set<string>();
    text.replace(INCLUDE_RE, (_full, name: string) => {
        names.add(name);
        return '';
    });
    if (names.size === 0) return text;

    const resolved = new Map<string, string>();
    for (const name of names) {
        if (seen.has(name)) {
            resolved.set(name, `[[include: ${name} — cycle detected]]`);
            continue;
        }
        const raw = partialsRoot ? await readVaultMarkdown(app, partialsRoot, name) : null;
        if (raw === null) {
            resolved.set(name, `[[include: ${name} — file not found]]`);
            continue;
        }
        const body = stripFrontmatter(raw);
        const nextSeen = new Set(seen);
        nextSeen.add(name);
        const expanded = await expandIncludes(app, body, partialsRoot, nextSeen, depth + 1);
        resolved.set(name, expanded);
    }
    return text.replace(INCLUDE_RE, (_full, name: string) =>
        resolved.get(name) ?? `[[include: ${name} — unresolved]]`);
}

/**
 * Load a preamble by name. Tries the vault first (so user edits win), then
 * the bundled default. Returns null if the name is unknown and the vault has
 * no file by that name. Logs a console.warn when falling back to bundled.
 */
async function loadPreamble(
    app: App,
    preamblesRoot: string,
    name: string,
): Promise<string | null> {
    if (preamblesRoot) {
        const raw = await readVaultMarkdown(app, preamblesRoot, name);
        if (raw !== null) return stripFrontmatter(raw);
    }
    const bundled = BUNDLED_PREAMBLES[name];
    if (bundled !== undefined) {
        console.warn(`[perplexed] preamble "${name}" missing from ${preamblesRoot || '(no preamblesRoot)'}; using bundled default`);
        return stripFrontmatter(bundled);
    }
    console.warn(`[perplexed] preamble "${name}" not found in vault and no bundled default exists`);
    return null;
}

/**
 * Extract per-template preamble overrides from the cft config. Supports:
 *   preambles:
 *     system: ["inline-citation", "house-rules"]   # replace defaults
 *     skip-user: ["research-framing"]              # opt out of user preambles
 *     skip-all: true                                # bypass all global preambles
 */
interface TemplatePreambleOverrides {
    systemOverride?: string[];
    skipUser: Set<string>;
    skipAll: boolean;
}

function parsePreambleOverrides(cfg: Record<string, unknown>): TemplatePreambleOverrides {
    const out: TemplatePreambleOverrides = { skipUser: new Set(), skipAll: false };
    const raw = cfg['preambles'];
    if (!raw || typeof raw !== 'object') return out;
    const obj = raw as Record<string, unknown>;
    if (obj['skip-all'] === true) {
        out.skipAll = true;
        return out;
    }
    const sys = obj['system'];
    if (Array.isArray(sys)) {
        out.systemOverride = sys.filter((s): s is string => typeof s === 'string');
    }
    const skipUser = obj['skip-user'];
    if (Array.isArray(skipUser)) {
        for (const s of skipUser) if (typeof s === 'string') out.skipUser.add(s);
    }
    return out;
}

function wrapThinkBlocks(text: string): string {
    return text.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
        const trimmed = inner.replace(/^\s+/, '').replace(/\s+$/, '');
        return '```think-output\n' + trimmed + '\n```';
    });
}

function processContentWithImages(
    content: string,
    images: PerplexityImage[],
): { content: string; replaced: number } {
    if (!images || images.length === 0) return { content, replaced: 0 };
    // Permissive regex: matches `[IMAGE N: desc]`, `[Image N: desc]`, also
    // tolerates the markdown-image-shaped `![IMAGE N](...)` and `[IMAGE N](...)`
    // forms some models emit when they try to anticipate the embed.
    const imageRegex = /!?\[IMAGE\s+(\d+)(?::\s*([^\]]*?))?\](?:\([^)]*\))?/gi;
    let replaced = 0;
    const next = content.replace(imageRegex, (match, numStr: string, desc?: string): string => {
        const idx = parseInt(numStr, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= images.length) return match;
        const img = images[idx];
        if (!img?.image_url) return match;
        const cleanDesc = (desc ?? '').trim() || `Image ${(idx + 1).toString()}`;
        replaced++;
        return `![${cleanDesc}](${img.image_url})`;
    });
    return { content: next, replaced };
}

function buildFallbackImagesSection(images: PerplexityImage[]): string {
    if (!images || images.length === 0) return '';
    const lines = ['', '# Images', ''];
    images.forEach((img, i) => {
        if (!img.image_url) return;
        lines.push(`![Image ${(i + 1).toString()}](${img.image_url})`);
        if (img.origin_url) lines.push(`_Source: ${img.origin_url}_`);
        lines.push('');
    });
    return lines.join('\n');
}

function stripUnreplacedImagePlaceholders(content: string): string {
    return content.replace(/^.*Image embed placeholder.*$\n?/gim, '');
}

function buildSourcesFooter(sources: PerplexitySource[]): string {
    // Canonical Lossless reference-section format per
    // cite-wide/context-v/reminders/Lossless-Citation-Spec.md: "always use a
    // `: ` after the citation identifier". cite-wide's REFDEF_NUM_RE accepts
    // both `[N]` and `[N]:` but the colon form matches the spec.
    //
    // Run provenance lives in frontmatter (cf_last_run, cf_last_run_model);
    // not duplicated in body.
    const sourceLines = sources.map((s, i) => {
        const n = i + 1;
        const title = (typeof s.title === 'string' && s.title) ? s.title : (s.url ?? 'Source');
        const url = s.url ?? '';
        return url ? `[${n.toString()}]: [${title}](${url})` : `[${n.toString()}]: ${title}`;
    });
    const body = sourceLines.length > 0 ? sourceLines.join('\n') : '_No sources returned._';
    return '\n\n***\n\n# Sources\n\n' + body + '\n';
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

export function listTemplates(app: App, root: string): TemplateFile[] {
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
    basename: string;
}

export function interpolate(text: string, ctx: InterpolationContext): string {
    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (full, key: string) => {
        if (key === 'title') return ctx.title;
        if (key === 'frontmatter') return ctx.frontmatter;
        if (key === 'today') return new Date().toISOString().slice(0, 10);
        if (key === 'basename') return ctx.basename;
        const fmKey = key.startsWith('frontmatter.') ? key.slice('frontmatter.'.length) : key;
        if (fmKey in ctx.frontmatterObj) {
            return frontmatterValueToString(ctx.frontmatterObj[fmKey]);
        }
        return full;
    });
}

// Job boards and recruiting sites are never a credible source for a product
// profile, yet they rank highly for company names — especially names that
// collide with a large employer (e.g. "NATS" also = National Air Traffic
// Services). Denied on every run UNLESS the run declares an explicit
// allowlist: an allowlist already restricts results, and Perplexity caps
// search_domain_filter at 10 entries, so deny entries would only burn slots.
const JOB_BOARD_DENYLIST = [
    '-indeed.com',
    '-glassdoor.com',
    '-ziprecruiter.com',
    '-usajobs.gov',
];

// Perplexity's hard cap on search_domain_filter length.
const SEARCH_DOMAIN_CAP = 10;

/**
 * Normalize a cft `search-domains:` value or a target file's
 * `cf_search_domains:` frontmatter value into a clean string list. Accepts a
 * YAML array or a comma-separated string. A leading `-` marks a denylist
 * entry; everything else is an allowlist entry.
 */
function parseDomainList(raw: unknown): string[] {
    const items = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
            ? raw.split(',')
            : [];
    return items
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function buildPayload(
    template: ParsedTemplate,
    systemPrompt: string,
    userPrompt: string,
    targetDomains: string[] = [],
    modelOverride?: string,
): PerplexityPayload {
    const cfg = template.cftConfig;
    const model = (modelOverride && modelOverride.length > 0)
        ? modelOverride
        : (typeof cfg.model === 'string' ? cfg.model : 'sonar-pro');
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

    // search_domain_filter: template-level `search-domains:` (generic) + the
    // target file's `cf_search_domains:` frontmatter (entity-specific) + the
    // built-in job-board denylist. Declared entries win over the denylist on
    // truncation to the 10-domain cap.
    const declared = [
        ...parseDomainList(cfg['search-domains']),
        ...targetDomains,
    ];
    const hasAllowlist = declared.some((d) => !d.startsWith('-'));
    const merged = hasAllowlist ? declared : [...declared, ...JOB_BOARD_DENYLIST];
    const domainFilter = [...new Set(merged)].slice(0, SEARCH_DOMAIN_CAP);
    if (domainFilter.length > 0) {
        payload.search_domain_filter = domainFilter;
    }

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
): Promise<{ streamed: string; sources: PerplexitySource[]; images: PerplexityImage[]; truncated: boolean }> {
    payload.stream = true;
    const controller = new AbortController();
    const timer = activeWindow.setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await activeWindow.fetch(endpoint, {
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
    let images: PerplexityImage[] = [];
    let truncated = false;
    let lastFlush = 0;
    const FLUSH_MS = 500;

    try {
        while (true) {
            if (isCancelled()) {
                controller.abort();
                break;
            }
            let value: Uint8Array | undefined;
            let done = false;
            try {
                ({ value, done } = await reader.read());
            } catch {
                // Timeout (AbortController fired), user cancel, or a dropped
                // socket. Don't throw away what already arrived —
                // sonar-deep-research delivers the whole document plus its
                // citations in the FIRST SSE event, so a later disconnect
                // should still leave a usable, cited file. Mark the run
                // truncated and fall through to the final flush + return.
                truncated = true;
                break;
            }
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
                        const message = first?.['message'] as Record<string, unknown> | undefined;
                        const delta = first?.['delta'] as Record<string, unknown> | undefined;
                        const snapshot = message?.['content'];
                        const fragment = delta?.['content'];
                        // Perplexity streams a *cumulative* message.content
                        // snapshot on every SSE event. sonar-deep-research does
                        // all its research server-side and dumps the ENTIRE
                        // document into the first event's message.content, while
                        // delta.content only ever carries a short tail fragment
                        // — so reading delta alone silently loses ~99% of the
                        // response. Prefer the snapshot; fall back to delta.
                        if (typeof snapshot === 'string'
                            && snapshot.length > streamed.length
                            && snapshot.startsWith(streamed)) {
                            streamed = snapshot;
                        } else if (typeof fragment === 'string') {
                            streamed += fragment;
                        }
                    }
                    const sr = obj['search_results'];
                    if (Array.isArray(sr)) {
                        sources = sr.filter((x): x is PerplexitySource =>
                            typeof x === 'object' && x !== null);
                    }
                    const imgs = obj['images'];
                    if (Array.isArray(imgs)) {
                        images = imgs.filter((x): x is PerplexityImage =>
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

    return { streamed, sources, images, truncated };
}

export type ApplyOutcome =
    | { status: 'applied'; mode: 'fill' | 'append'; sourceCount: number }
    | { status: 'skipped'; reason: string }
    | { status: 'error'; error: string };

export interface ApplyOptions {
    quiet?: boolean;
    isCancelled?: () => boolean;
    /** Per-run Perplexity model; overrides the template's cft `model:`. */
    modelOverride?: string;
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

    const ctx: InterpolationContext = {
        title,
        frontmatter: fmYaml,
        frontmatterObj: fm,
        basename: target.basename,
    };

    // Expand {{include: …}} directives against the partials root, then run token
    // interpolation. Expansion must happen first so partials can themselves use
    // {{basename}}/{{title}}/etc.
    const expandedSystem = await expandIncludes(app, template.cftSystem, settings.partialsRoot);
    const expandedSkeleton = await expandIncludes(app, template.userSkeleton, settings.partialsRoot);
    const templateSystem = interpolate(expandedSystem, ctx);
    const interpolatedSkeleton = interpolate(expandedSkeleton, ctx);

    // Assemble preambles. Per-template `preambles:` config in the cft fence
    // may override the global lists or skip them entirely.
    const overrides = parsePreambleOverrides(template.cftConfig);
    const wantsImages = template.cftConfig['return-images'] === true;

    async function resolvePreamble(name: string): Promise<string | null> {
        const raw = await loadPreamble(app, settings.preamblesRoot, name);
        if (raw === null) return null;
        const expanded = await expandIncludes(app, raw, settings.partialsRoot);
        return interpolate(expanded, ctx);
    }

    let systemPreambleText = '';
    let userFramingText = '';
    let userTrailingText = '';

    if (!overrides.skipAll) {
        const systemNames = overrides.systemOverride ?? settings.systemPreambles;
        const systemChunks: string[] = [];
        for (const name of systemNames) {
            const text = await resolvePreamble(name);
            if (text) systemChunks.push(text.trim());
        }
        systemPreambleText = systemChunks.join('\n\n');

        const framingChunks: string[] = [];
        const trailingChunks: string[] = [];
        for (const spec of settings.userPreambles) {
            if (overrides.skipUser.has(spec.name)) continue;
            if (spec.when === 'return-images' && !wantsImages) continue;
            const text = await resolvePreamble(spec.name);
            if (!text) continue;
            // `research-framing` (and any other preamble that wraps the
            // skeleton) goes before; everything else trails. Convention: a
            // preamble whose name is `research-framing` goes in front.
            if (spec.name === 'research-framing') framingChunks.push(text);
            else trailingChunks.push(text);
        }
        userFramingText = framingChunks.join('\n\n');
        userTrailingText = trailingChunks.length > 0 ? '\n\n' + trailingChunks.join('\n\n') : '';
    }

    const systemPrompt = systemPreambleText && templateSystem
        ? `${systemPreambleText}\n\n${templateSystem}`
        : systemPreambleText || templateSystem;

    const userPrompt = userFramingText
        ? `${userFramingText}${interpolatedSkeleton}${userTrailingText}`
        : `${interpolatedSkeleton}${userTrailingText}`;

    // Initial file content the stream will append to.
    const fmBlock = fmRaw.length > 0 ? `---\n${fmRaw}\n---\n` : '';
    const initialContent = mode === 'fill'
        ? `${fmBlock}\n`
        : `${fmBlock}\n${existingBody}\n\n`;

    // Effective model: an explicit per-run override (from the run modal) wins
    // over the template's cft `model:`. Used for the payload, the loading
    // notice, and the cf_last_run_model frontmatter stamp.
    const cftModel = typeof template.cftConfig['model'] === 'string'
        ? template.cftConfig['model']
        : '';
    const effectiveModel = (options.modelOverride && options.modelOverride.length > 0)
        ? options.modelOverride
        : (cftModel || 'sonar-pro');

    // Entity-specific domain hints live in the target file's frontmatter so a
    // collision-heavy name (e.g. NATS) can be pinned per-file without editing
    // the shared template.
    const targetDomains = parseDomainList(fm['cf_search_domains']);
    const payload = buildPayload(template, systemPrompt, userPrompt, targetDomains, effectiveModel);

    let loadingNotice: Notice | null = null;
    if (!quiet) {
        loadingNotice = new Notice(`Streaming Perplexity · ${effectiveModel}…`, 0);
    }
    try {
        // Set initial state before streaming begins.
        await app.vault.modify(target, initialContent);

        const { streamed, sources, images, truncated } = await streamPerplexityToFile(
            app,
            settings.perplexityApiKey,
            settings.perplexityEndpoint,
            payload,
            settings.requestTimeoutMs,
            target,
            initialContent,
            isCancelled,
        );

        // Compute run metadata for the frontmatter stamp.
        const provider = typeof template.cftConfig['provider'] === 'string'
            ? template.cftConfig['provider']
            : 'unknown';
        const modelName = effectiveModel;
        const providerLabel = provider.length > 0
            ? provider.charAt(0).toUpperCase() + provider.slice(1)
            : provider;
        const runTimestamp = new Date().toISOString();
        const runModelLabel = `${providerLabel} ${modelName}`.trim();

        // Post-write cleanup: wrap <think> blocks, swap [IMAGE N: …] markers for
        // real embeds (fall back to an Images section when markers don't match
        // but images came back), strip any unreplaced placeholder bullets,
        // append sources footer.
        const trimmedStreamed = streamed.replace(/^\s+/, '').replace(/\s+$/, '');
        let cleanedStreamed = wrapThinkBlocks(trimmedStreamed);
        let fallbackImagesSection = '';
        if (wantsImages) {
            const result = processContentWithImages(cleanedStreamed, images);
            cleanedStreamed = result.content;
            cleanedStreamed = stripUnreplacedImagePlaceholders(cleanedStreamed);
            console.debug(
                `[directoryTemplateService] images.length=${images.length.toString()}, markers replaced=${result.replaced.toString()}, model=${modelName}`,
            );
            // Mirror the article-generator fallback: if Perplexity returned
            // images but no [IMAGE N: …] markers were replaced (model didn't
            // emit them, or emitted them in a shape the regex missed), still
            // surface the images as a section so they don't vanish silently.
            if (result.replaced === 0 && images.length > 0) {
                fallbackImagesSection = buildFallbackImagesSection(images);
                if (!quiet) {
                    new Notice(
                        `Inserted ${images.length.toString()} image${images.length === 1 ? '' : 's'} as a fallback section — model didn't emit [IMAGE N: …] markers.`,
                    );
                }
            } else if (result.replaced === 0 && images.length === 0) {
                console.warn(
                    `[directoryTemplateService] return-images is true but Perplexity returned no images. model=${modelName}. Likely an API limitation for this model on this query.`,
                );
            }
        }
        const sourcesFooter = buildSourcesFooter(sources);
        const finalContent = `${initialContent}${cleanedStreamed}\n${fallbackImagesSection}${sourcesFooter}`;
        await app.vault.modify(target, finalContent);

        // Harvest a Google Books URL from generated body if the model surfaced
        // one — books are the only source type with a universal canonical-URL
        // system worth stamping back into frontmatter. First match wins; we
        // only stamp when frontmatter doesn't already carry the field so a
        // user-curated URL is never overwritten.
        const googleBooksRe = /https:\/\/(?:www\.)?(?:books\.google\.com\/books\?id=[\w-]+|google\.com\/books\/edition\/[^\s)]+)/;
        const googleBooksMatch = cleanedStreamed.match(googleBooksRe);
        const harvestedGoogleBooksUrl = googleBooksMatch?.[0];

        // Stamp run metadata in the target's frontmatter so files can be
        // queried for staleness ("which Tooling/ entries were last refreshed
        // before <date>?"). Uses fileManager.processFrontMatter so other
        // frontmatter keys remain byte-identical apart from these stamps.
        await app.fileManager.processFrontMatter(target, (fm: Record<string, unknown>) => {
            fm['cf_last_run'] = runTimestamp;
            fm['cf_last_run_model'] = runModelLabel;
            if (harvestedGoogleBooksUrl && !fm['google_books_url']) {
                fm['google_books_url'] = harvestedGoogleBooksUrl;
            }
        });

        if (!quiet) {
            if (truncated) {
                new Notice(
                    `"${target.basename}": stream cut off (timeout or lost connection) — saved partial content with ${sources.length.toString()} sources. Re-run to complete.`,
                );
            }
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
