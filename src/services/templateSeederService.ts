import type { App } from 'obsidian';
import { Notice, normalizePath, TFolder } from 'obsidian';

import readmeContent from '../docs/templates/README.md';
import conceptProfile from '../docs/templates/concept-profile.md';
import vocabularyProfile from '../docs/templates/vocabulary-profile.md';
import sourceProfile from '../docs/templates/source-profile.md';
import toolkitProfile from '../docs/templates/toolkit-profile.md';
import marketMapProfile from '../docs/templates/market-map-profile.md';
import standardsAndSpecsProfile from '../docs/templates/standards-and-specs-profile.md';
import marketCategoryProfile from '../docs/templates/market-category-profile.md';

import partialsReadme from '../docs/partials/README.md';
import mermaidDisciplinePartial from '../docs/partials/mermaid-discipline.md';
import latexDisciplinePartial from '../docs/partials/latex-discipline.md';

import preamblesReadme from '../docs/preambles/README.md';
import inlineCitationPreamble from '../docs/preambles/inline-citation.md';
import imagePlacementPreamble from '../docs/preambles/image-placement.md';
import researchFramingPreamble from '../docs/preambles/research-framing.md';

interface SeedFile {
    name: string;
    content: string;
}

// README is treated as docs (always ensure present if missing). Content files
// are user-customizable, so we only seed them when the folder is missing or
// empty — a folder with files already in it is treated as user-managed and we
// don't touch it.
const TEMPLATES_README: SeedFile = { name: 'README.md', content: readmeContent };
const TEMPLATE_FILES: SeedFile[] = [
    { name: 'concept-profile.md', content: conceptProfile },
    { name: 'vocabulary-profile.md', content: vocabularyProfile },
    { name: 'source-profile.md', content: sourceProfile },
    { name: 'toolkit-profile.md', content: toolkitProfile },
    { name: 'market-map-profile.md', content: marketMapProfile },
    { name: 'standards-and-specs-profile.md', content: standardsAndSpecsProfile },
    { name: 'market-category-profile.md', content: marketCategoryProfile },
];

const PARTIALS_README: SeedFile = { name: 'README.md', content: partialsReadme };
const PARTIAL_FILES: SeedFile[] = [
    { name: 'mermaid-discipline.md', content: mermaidDisciplinePartial },
    { name: 'latex-discipline.md', content: latexDisciplinePartial },
];

const PREAMBLES_README: SeedFile = { name: 'README.md', content: preamblesReadme };
const PREAMBLE_FILES: SeedFile[] = [
    { name: 'inline-citation.md', content: inlineCitationPreamble },
    { name: 'image-placement.md', content: imagePlacementPreamble },
    { name: 'research-framing.md', content: researchFramingPreamble },
];

// Bundled preambles are also exposed by name so applyTemplate can fall back
// when a vault preamble file is missing.
export const BUNDLED_PREAMBLES: Record<string, string> = {
    'inline-citation': inlineCitationPreamble,
    'image-placement': imagePlacementPreamble,
    'research-framing': researchFramingPreamble,
};

/**
 * vault.create wrapped to tolerate the same race window ensureFolder handles:
 * getAbstractFileByPath returns null but a concurrent or just-finished write
 * has already produced the file (Obsidian's index lags behind the adapter
 * write). Treat "File already exists" as success — the caller's intent
 * (file exists at path with content) is satisfied either way.
 */
async function safeCreateFile(app: App, path: string, content: string): Promise<void> {
    try {
        await app.vault.create(path, content);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already exists/i.test(msg)) throw err;
    }
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const existing = app.vault.getAbstractFileByPath(normalized);
    if (existing) return;
    // Walk parents and create each missing segment so a nested path like
    // `zz-cf-lib/templates` works on a fresh vault.
    const segments = normalized.split('/').filter(s => s.length > 0);
    let cursor = '';
    for (const seg of segments) {
        cursor = cursor ? `${cursor}/${seg}` : seg;
        if (!app.vault.getAbstractFileByPath(cursor)) {
            try {
                await app.vault.createFolder(cursor);
            } catch (err) {
                // Race / stale cache: getAbstractFileByPath can return null for
                // a folder Obsidian has already begun creating. Treat the
                // "already exists" path as success; rethrow anything else.
                const msg = err instanceof Error ? err.message : String(err);
                if (!/already exists/i.test(msg)) throw err;
            }
        }
    }
}

function folderHasContent(app: App, folderPath: string): boolean {
    const normalized = normalizePath(folderPath);
    const folder = app.vault.getAbstractFileByPath(normalized);
    if (!(folder instanceof TFolder)) return false;
    // README is docs and is ignored when deciding whether the folder is
    // "user-populated" — a folder that contains only the shipped README still
    // counts as empty for seeding purposes.
    return folder.children.some(child =>
        child.path.endsWith('.md') && !child.path.endsWith('/README.md'),
    );
}

export type SeedReason = 'missing' | 'empty' | 'readme-only' | 'skipped';

async function seedFolder(
    app: App,
    root: string,
    readme: SeedFile,
    contentFiles: SeedFile[],
): Promise<{ seeded: number; reason: SeedReason }> {
    const normalized = normalizePath(root);
    const existing = app.vault.getAbstractFileByPath(normalized);
    const userPopulated = existing ? folderHasContent(app, normalized) : false;

    await ensureFolder(app, normalized);

    let seeded = 0;
    const readmePath = `${normalized}/${readme.name}`;
    if (!app.vault.getAbstractFileByPath(readmePath)) {
        await safeCreateFile(app, readmePath, readme.content);
        seeded++;
    }

    if (!userPopulated) {
        for (const file of contentFiles) {
            const path = `${normalized}/${file.name}`;
            if (app.vault.getAbstractFileByPath(path)) continue;
            await safeCreateFile(app, path, file.content);
            seeded++;
        }
    }

    let reason: SeedReason;
    if (!existing) reason = 'missing';
    else if (userPopulated && seeded === 0) reason = 'skipped';
    else if (userPopulated) reason = 'readme-only';
    else reason = 'empty';

    return { seeded, reason };
}

/**
 * Seed shipped templates, partials, and preambles into their configured roots.
 *
 * Idempotent — never overwrites an existing file. README is treated as docs
 * and is always written if missing; content files are only seeded when the
 * target folder is missing or empty.
 */
export async function seedTemplatesIfMissing(
    app: App,
    templatesRoot: string,
    partialsRoot?: string,
    preamblesRoot?: string,
    options: { quiet?: boolean } = {},
): Promise<{ seeded: number; reason: SeedReason }> {
    const quiet = options.quiet === true;

    const templates = await seedFolder(app, templatesRoot, TEMPLATES_README, TEMPLATE_FILES);
    let totalSeeded = templates.seeded;

    if (partialsRoot && partialsRoot.trim().length > 0) {
        const partials = await seedFolder(app, partialsRoot, PARTIALS_README, PARTIAL_FILES);
        totalSeeded += partials.seeded;
    }
    if (preamblesRoot && preamblesRoot.trim().length > 0) {
        const preambles = await seedFolder(app, preamblesRoot, PREAMBLES_README, PREAMBLE_FILES);
        totalSeeded += preambles.seeded;
    }

    if (!quiet && totalSeeded > 0) {
        new Notice(`Perplexed: seeded ${totalSeeded.toString()} file${totalSeeded === 1 ? '' : 's'}`);
    }
    return { seeded: totalSeeded, reason: templates.reason };
}

/**
 * Force-seed: write every shipped file whose filename doesn't already exist.
 * For users who want to pull in a newly-added shipped file after a plugin
 * update without losing edits to existing files. Bound to the "Re-seed"
 * settings button.
 */
export async function reSeedMissingFiles(
    app: App,
    templatesRoot: string,
    partialsRoot?: string,
    preamblesRoot?: string,
): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    const groups: { root: string; files: SeedFile[] }[] = [
        { root: templatesRoot, files: [TEMPLATES_README, ...TEMPLATE_FILES] },
    ];
    if (partialsRoot && partialsRoot.trim().length > 0) {
        groups.push({ root: partialsRoot, files: [PARTIALS_README, ...PARTIAL_FILES] });
    }
    if (preamblesRoot && preamblesRoot.trim().length > 0) {
        groups.push({ root: preamblesRoot, files: [PREAMBLES_README, ...PREAMBLE_FILES] });
    }

    for (const { root, files } of groups) {
        const normalized = normalizePath(root);
        await ensureFolder(app, normalized);
        for (const file of files) {
            const path = `${normalized}/${file.name}`;
            if (app.vault.getAbstractFileByPath(path)) {
                skipped++;
                continue;
            }
            await safeCreateFile(app, path, file.content);
            seeded++;
        }
    }

    new Notice(
        `Perplexed: seeded ${seeded.toString()}, skipped ${skipped.toString()} (already present)`,
    );
    return { seeded, skipped };
}
