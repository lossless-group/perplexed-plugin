import type { App, TFile } from 'obsidian';
import { Notice, parseYaml, request, stringifyYaml } from 'obsidian';

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

interface PerplexityChoice {
    message?: { content?: string };
}

interface PerplexityResponseShape {
    choices?: PerplexityChoice[];
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

export function interpolate(text: string, ctx: { title: string; frontmatter: string }): string {
    return text.replace(/\{\{\s*(title|frontmatter)\s*\}\}/g, (_, key: string) => {
        if (key === 'title') return ctx.title;
        return ctx.frontmatter;
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

async function callPerplexity(
    apiKey: string,
    endpoint: string,
    payload: PerplexityPayload,
    timeoutMs: number,
): Promise<string> {
    const requestPromise = request({
        url: endpoint,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
        activeWindow.setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const response = await Promise.race([requestPromise, timeoutPromise]);
    const data = JSON.parse(response) as PerplexityResponseShape;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Perplexity returned no content.');
    return content;
}

export async function applyTemplate(
    app: App,
    settings: DirectoryTemplateSettings,
    target: TFile,
    template: ParsedTemplate,
): Promise<void> {
    if (!settings.perplexityApiKey) {
        new Notice('Perplexity API key is not set.');
        return;
    }
    if (!template.userSkeleton) {
        new Notice('Template has no skeleton (no content below the cft block).');
        return;
    }

    const targetContent = await app.vault.read(target);
    const { frontmatter: fmRaw, body } = splitFrontmatter(targetContent);
    if (body.trim().length > 0) {
        new Notice('File has existing body. Edit manually or delete body to re-run.');
        return;
    }

    const fm = safeParseYaml(fmRaw);
    const title = typeof fm.title === 'string' ? fm.title : target.basename;
    const fmYaml = buildFrontmatterPayload(fm, settings.frontmatterWhitelist);

    const ctx = { title, frontmatter: fmYaml };
    const systemPrompt = interpolate(template.cftSystem, ctx);
    const userPrompt = interpolate(template.userSkeleton, ctx);

    const payload = buildPayload(template, systemPrompt, userPrompt);

    const loadingNotice = new Notice('Applying template via Perplexity deep research…', 0);
    try {
        const content = await callPerplexity(
            settings.perplexityApiKey,
            settings.perplexityEndpoint,
            payload,
            settings.requestTimeoutMs,
        );
        const trimmedContent = content.replace(/^\s+/, '').replace(/\s+$/, '');
        const fmBlock = fmRaw.length > 0 ? `---\n${fmRaw}\n---\n` : '';
        const newFile = `${fmBlock}\n${trimmedContent}\n`;
        await app.vault.modify(target, newFile);
        new Notice(`Applied "${template.file.basename}" to ${target.basename}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(`Perplexity error: ${msg}`);
    } finally {
        loadingNotice.hide();
    }
}
