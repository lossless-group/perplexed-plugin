import type { App } from 'obsidian';
import { Notice, normalizePath, TFolder } from 'obsidian';

import readmeContent from '../docs/templates/README.md';
import conceptProfile from '../docs/templates/concept-profile.md';
import vocabularyProfile from '../docs/templates/vocabulary-profile.md';
import sourceProfile from '../docs/templates/source-profile.md';
import toolkitProfile from '../docs/templates/toolkit-profile.md';

interface SeedFile {
    name: string;
    content: string;
}

// README is treated as docs (always ensure present if missing). The four
// templates are user-customizable content, so we only seed them when the
// folder is missing or empty — a folder with templates already in it is
// treated as user-managed and we don't touch it.
const README_FILE: SeedFile = { name: 'README.md', content: readmeContent };

const TEMPLATE_FILES: SeedFile[] = [
    { name: 'concept-profile.md', content: conceptProfile },
    { name: 'vocabulary-profile.md', content: vocabularyProfile },
    { name: 'source-profile.md', content: sourceProfile },
    { name: 'toolkit-profile.md', content: toolkitProfile },
];

const SEED_FILES: SeedFile[] = [README_FILE, ...TEMPLATE_FILES];

async function ensureFolder(app: App, folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const existing = app.vault.getAbstractFileByPath(normalized);
    if (existing) return;
    // Walk parents and create each missing segment so a nested templatesRoot
    // like `zz-cf-lib/templates` works on a fresh vault.
    const segments = normalized.split('/').filter(s => s.length > 0);
    let cursor = '';
    for (const seg of segments) {
        cursor = cursor ? `${cursor}/${seg}` : seg;
        if (!app.vault.getAbstractFileByPath(cursor)) {
            await app.vault.createFolder(cursor);
        }
    }
}

function folderHasTemplate(app: App, folderPath: string): boolean {
    const normalized = normalizePath(folderPath);
    const folder = app.vault.getAbstractFileByPath(normalized);
    if (!(folder instanceof TFolder)) return false;
    // Treat the README as docs and ignore it when deciding whether the
    // folder is "user-populated" — a folder that contains only the
    // shipped README still counts as empty for template-seeding purposes.
    return folder.children.some(child =>
        child.path.endsWith('.md') && !child.path.endsWith('/README.md'),
    );
}

/**
 * Seed shipped templates into the configured templates root.
 *
 * Two-tier behavior:
 *   - README is docs and is always written if missing, regardless of whether
 *     the folder contains user templates. This means a user who's edited
 *     their templates still gets the README on first install or after a
 *     plugin update.
 *   - The four shipped templates are user-customizable content and are only
 *     seeded when the folder is missing or contains no non-README markdown.
 *     A folder with templates already in it is treated as user-managed and
 *     left alone (so a user who deleted concept-profile intentionally won't
 *     have it resurrected on every load).
 *
 * Idempotent — never overwrites an existing file.
 */
export async function seedTemplatesIfMissing(
    app: App,
    templatesRoot: string,
    options: { quiet?: boolean } = {},
): Promise<{ seeded: number; reason: 'missing' | 'empty' | 'readme-only' | 'skipped' }> {
    const quiet = options.quiet === true;
    const normalized = normalizePath(templatesRoot);
    const existing = app.vault.getAbstractFileByPath(normalized);
    const userPopulated = existing ? folderHasTemplate(app, normalized) : false;

    await ensureFolder(app, normalized);

    // Always ensure the README exists.
    const readmePath = `${normalized}/${README_FILE.name}`;
    let seeded = 0;
    if (!app.vault.getAbstractFileByPath(readmePath)) {
        await app.vault.create(readmePath, README_FILE.content);
        seeded++;
    }

    // Seed the four templates only when the folder is missing or empty of
    // non-README markdown. If the user already has any template files,
    // assume they're managing the folder and don't add new ones.
    if (!userPopulated) {
        for (const file of TEMPLATE_FILES) {
            const path = `${normalized}/${file.name}`;
            if (app.vault.getAbstractFileByPath(path)) continue;
            await app.vault.create(path, file.content);
            seeded++;
        }
    }

    let reason: 'missing' | 'empty' | 'readme-only' | 'skipped';
    if (!existing) reason = 'missing';
    else if (userPopulated && seeded === 0) reason = 'skipped';
    else if (userPopulated) reason = 'readme-only';
    else reason = 'empty';

    if (!quiet && seeded > 0) {
        new Notice(`Perplexed: seeded ${seeded.toString()} file${seeded === 1 ? '' : 's'} at ${normalized}`);
    }
    return { seeded, reason };
}

/**
 * Force-seed: write every shipped file whose filename doesn't already exist.
 * For users who want to pull in a newly-added shipped template after a plugin
 * update without losing edits to existing templates. Bound to the "Re-seed
 * templates" settings button.
 */
export async function reSeedMissingFiles(
    app: App,
    templatesRoot: string,
): Promise<{ seeded: number; skipped: number }> {
    const normalized = normalizePath(templatesRoot);
    await ensureFolder(app, normalized);

    let seeded = 0;
    let skipped = 0;
    for (const file of SEED_FILES) {
        const path = `${normalized}/${file.name}`;
        if (app.vault.getAbstractFileByPath(path)) {
            skipped++;
            continue;
        }
        await app.vault.create(path, file.content);
        seeded++;
    }
    new Notice(
        `Perplexed: seeded ${seeded.toString()}, skipped ${skipped.toString()} (already present) at ${normalized}`,
    );
    return { seeded, skipped };
}
