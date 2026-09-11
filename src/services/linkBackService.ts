import type { App, TFile } from 'obsidian';

/**
 * Finds unlinked mentions of other vault notes in a document and proposes
 * wikilinks for them — the bulk-convert that Obsidian's "Unlinked mentions"
 * pane shows but never offers to apply.
 *
 * Every proposal is reviewed by a human before anything is written; nothing
 * here mutates a file.
 */

export interface LinkCandidate {
    /** The exact text found in the prose. */
    matchedText: string;
    /** Character offset into the body (not the whole file). */
    start: number;
    end: number;
    /** Target note. */
    file: TFile;
    /** Why this note matched — its own name, or one of its frontmatter aliases. */
    via: 'title' | 'alias';
    /**
     * 'high' — multi-word or long exact-case match; safe to accept in bulk.
     * 'low'  — short or case-insensitive match, where the word is plausibly
     *          just an English word ("Hex", "Layer", "Element", "Go").
     */
    confidence: 'high' | 'low';
    /** One line of surrounding prose, for the review table. */
    context: string;
}

/** Regions of a document that must never be linkified. */
interface Span { start: number; end: number }

function maskedSpans(body: string): Span[] {
    const spans: Span[] = [];
    const push = (re: RegExp): void => {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            spans.push({ start: m.index, end: m.index + m[0].length });
            if (m[0].length === 0) re.lastIndex += 1;
        }
    };
    push(/```[\s\S]*?```/g);          // fenced code
    push(/`[^`\n]*`/g);                // inline code
    push(/\[\[[^\]]*\]\]/g);           // existing wikilinks
    push(/\[[^\]]*\]\([^)]*\)/g);      // markdown links
    push(/^\[\^?[^\]]+\]:.*$/gm);      // reference / footnote definitions
    push(/https?:\/\/\S+/g);           // bare URLs
    push(/^#{1,6} .*$/gm);             // headings — linking these breaks TOCs
    // Generated footers: everything from the Sources heading onward.
    const src = /\n#{1,2}\s+Sources\b/.exec(body);
    if (src !== null) spans.push({ start: src.index, end: body.length });
    return spans;
}

function inMasked(start: number, end: number, spans: Span[]): boolean {
    return spans.some((s) => start < s.end && end > s.start);
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Frontmatter aliases for a file, if any. */
function aliasesFor(app: App, file: TFile): string[] {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) return [];
    const raw: unknown = fm['aliases'] ?? fm['alias'];
    if (typeof raw === 'string') return [raw];
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
    return [];
}

/**
 * Wikilink in the vault-root-absolute form with a display alias:
 *
 *   [[Tooling/Software Development/Programming Languages/Go|Go]]
 *
 * Built explicitly rather than via `fileManager.generateMarkdownLink()`, which
 * honours the vault's "New link format" setting. This output feeds published
 * web renderings where the absolute path is load-bearing, so it must not change
 * if that setting does.
 */
export function buildWikilink(file: TFile, displayText: string): string {
    const path = file.path.replace(/\.md$/, '');
    return path === displayText ? `[[${path}]]` : `[[${path}|${displayText}]]`;
}

function contextAround(body: string, start: number, end: number): string {
    const from = Math.max(0, start - 60);
    const to = Math.min(body.length, end + 60);
    const prefix = from > 0 ? '…' : '';
    const suffix = to < body.length ? '…' : '';
    return (prefix + body.slice(from, to) + suffix).replace(/\s+/g, ' ').trim();
}

export interface ScanOptions {
    /** Folders whose notes are never link targets (library, history, templates). */
    excludeRoots: string[];
    /** Minimum candidate length; below this, matches are noise. */
    minLength: number;
    /** Include case-insensitive matches as low-confidence proposals. */
    includeLowConfidence: boolean;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
    excludeRoots: ['zz-cf-lib'],
    minLength: 4,
    includeLowConfidence: true,
};

/**
 * Scan `body` for unlinked mentions of other vault notes.
 *
 * Longest candidates win: "Agentic Analytics" is matched before "Analytics", so
 * the broader term can't shadow the more specific note. Overlapping matches are
 * dropped rather than nested.
 */
export function findLinkCandidates(
    app: App,
    target: TFile,
    body: string,
    options: ScanOptions = DEFAULT_SCAN_OPTIONS,
): LinkCandidate[] {
    const masked = maskedSpans(body);
    const claimed: Span[] = [];

    // Build (searchText -> file) pairs, longest first.
    const pairs: { text: string; file: TFile; via: 'title' | 'alias' }[] = [];
    for (const file of app.vault.getMarkdownFiles()) {
        if (file.path === target.path) continue;
        if (options.excludeRoots.some((r) => file.path.startsWith(`${r}/`))) continue;
        if (file.basename.length >= options.minLength) {
            pairs.push({ text: file.basename, file, via: 'title' });
        }
        for (const a of aliasesFor(app, file)) {
            if (a.length >= options.minLength) pairs.push({ text: a, file, via: 'alias' });
        }
    }
    pairs.sort((a, b) => b.text.length - a.text.length);

    const out: LinkCandidate[] = [];
    for (const { text, file, via } of pairs) {
        // \b fails on candidates ending in punctuation (e.g. "Fabi.ai"), so
        // the boundaries are asserted with lookarounds on word characters.
        const re = new RegExp(`(?<![\\w-])${escapeRe(text)}(?![\\w-])`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            if (inMasked(start, end, masked)) continue;
            if (inMasked(start, end, claimed)) continue;

            const exactCase = m[0] === text;
            const multiWord = /\s/.test(text);
            const confidence: 'high' | 'low' =
                exactCase && (multiWord || text.length >= 6) ? 'high' : 'low';
            if (confidence === 'low' && !options.includeLowConfidence) continue;

            claimed.push({ start, end });
            out.push({
                matchedText: m[0],
                start,
                end,
                file,
                via,
                confidence,
                context: contextAround(body, start, end),
            });
        }
    }
    return out.sort((a, b) => a.start - b.start);
}

/**
 * Apply accepted candidates to the body. Splices from the end backwards so
 * earlier offsets stay valid.
 */
export function applyLinkCandidates(body: string, accepted: LinkCandidate[]): string {
    const ordered = [...accepted].sort((a, b) => b.start - a.start);
    let out = body;
    for (const c of ordered) {
        out = out.slice(0, c.start) + buildWikilink(c.file, c.matchedText) + out.slice(c.end);
    }
    return out;
}


/* ------------------------------------------------------------------------ *
 * Inbound direction — the "Linked mentions" pane.
 *
 * Distinct from findLinkCandidates above, which scans THIS note's prose for
 * titles of OTHER notes (outbound). These are notes that already link TO this
 * one, and they usually do NOT appear as text here — so they cannot be
 * linkified in place. Their value is as generation context: handing the model
 * the real vault paths of notes that already reference the subject is what
 * lets a draft link back without inventing paths.
 * ------------------------------------------------------------------------ */

export interface Backlink {
    file: TFile;
    /** How many times that note links here. */
    count: number;
    /** The sentence around the first reference, for prompt context. */
    excerpt: string;
}

/**
 * Notes that link to `target`, newest-modified first.
 *
 * Derived by inverting `metadataCache.resolvedLinks` — the documented API —
 * rather than `getBacklinksForFile()`, which is what the Linked-mentions pane
 * uses but is absent from obsidian.d.ts. Community-plugin review flags
 * undocumented API use, and the inversion is O(files) on a map already in
 * memory.
 */
export async function findBacklinks(
    app: App,
    target: TFile,
    limit = 12,
): Promise<Backlink[]> {
    const resolved = app.metadataCache.resolvedLinks;
    const out: Backlink[] = [];

    for (const [sourcePath, targets] of Object.entries(resolved)) {
        if (sourcePath === target.path) continue;
        const count = targets[target.path];
        if (count === undefined || count <= 0) continue;
        const file = app.vault.getFileByPath(sourcePath);
        if (file === null) continue;
        out.push({ file, count, excerpt: '' });
    }

    out.sort((a, b) => b.count - a.count || b.file.stat.mtime - a.file.stat.mtime);
    const top = out.slice(0, limit);

    // Only read the files we're actually going to use.
    for (const bl of top) {
        try {
            const raw = await app.vault.read(bl.file);
            bl.excerpt = excerptAroundLink(raw, target);
        } catch {
            bl.excerpt = '';
        }
    }
    return top;
}

/** One line of context around the first link to `target` in `raw`. */
function excerptAroundLink(raw: string, target: TFile): string {
    const stem = target.path.replace(/\.md$/, '');
    const re = new RegExp(`\\[\\[${escapeRe(stem)}(\\|[^\\]]*)?\\]\\]|\\[\\[${escapeRe(target.basename)}(\\|[^\\]]*)?\\]\\]`);
    const m = re.exec(raw);
    if (m === null) return '';
    const from = Math.max(0, m.index - 140);
    const to = Math.min(raw.length, m.index + m[0].length + 140);
    return raw.slice(from, to).replace(/\s+/g, ' ').trim();
}

/**
 * Render backlinks as a prompt block.
 *
 * The paths are given verbatim and the model is told to reuse them exactly.
 * This is the fix for the standing "do NOT invent [[wikilink]] syntax" rule in
 * the market-map and toolkit templates: that rule exists because a model
 * guessing vault paths produces broken links. Given the real paths, it can
 * link correctly instead of being forbidden from linking at all.
 */
export function renderBacklinksBlock(backlinks: Backlink[], subject: string): string {
    if (backlinks.length === 0) return '';
    const lines: string[] = [];
    lines.push(`## Vault notes that already reference ${subject}`);
    lines.push('');
    lines.push(
        'These notes in the author\'s vault already reference this subject. Work '
        + 'ONE OR TWO of them into your prose where they genuinely fit — inline, as '
        + 'part of a sentence you were going to write anyway. For example: "…pairs '
        + 'naturally with [[path|Name]] for downstream reporting."\n\n'
        + 'Rules:\n'
        + '- Copy the wikilink EXACTLY as given below, full path and pipe alias '
        + 'included. Never invent, shorten, or guess a path.\n'
        + '- One or two links total, not one per note. Relevance beats coverage.\n'
        + '- Weave them into sentences. Do NOT add a "Related notes" section, a '
        + 'bulleted list of links, or a See-also block.\n'
        + '- Skip any note that does not genuinely serve the sentence. Linking '
        + 'nothing is better than linking something irrelevant.',
    )
    lines.push('');
    for (const bl of backlinks) {
        const stem = bl.file.path.replace(/\.md$/, '');
        lines.push(`- \`[[${stem}|${bl.file.basename}]]\``);
        if (bl.excerpt.length > 0) lines.push(`  - context: ${bl.excerpt}`);
    }
    lines.push('');
    return lines.join('\n');
}
