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

const SEED_FILES: SeedFile[] = [
    { name: 'README.md', content: readmeContent },
    { name: 'concept-profile.md', content: conceptProfile },
    { name: 'vocabulary-profile.md', content: vocabularyProfile },
    { name: 'source-profile.md', content: sourceProfile },
    { name: 'toolkit-profile.md', content: toolkitProfile },
];

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

function folderHasMarkdown(app: App, folderPath: string): boolean {
    const normalized = normalizePath(folderPath);
    const folder = app.vault.getAbstractFileByPath(normalized);
    if (!(folder instanceof TFolder)) return false;
    return folder.children.some(child => child.path.endsWith('.md'));
}

/**
 * Seed shipped templates into the configured templates root if the folder is
 * missing or contains no markdown. Idempotent — never overwrites an existing
 * file. Designed for first-run experience: a fresh perplexed install creates
 * `zz-cf-lib/templates/` populated with the four shipped templates and a
 * README so the user has working templates without copy/paste.
 */
export async function seedTemplatesIfMissing(
    app: App,
    templatesRoot: string,
    options: { quiet?: boolean } = {},
): Promise<{ seeded: number; reason: 'missing' | 'empty' | 'skipped' }> {
    const quiet = options.quiet === true;
    const normalized = normalizePath(templatesRoot);
    const existing = app.vault.getAbstractFileByPath(normalized);

    if (existing && folderHasMarkdown(app, normalized)) {
        return { seeded: 0, reason: 'skipped' };
    }

    const reason: 'missing' | 'empty' = existing ? 'empty' : 'missing';
    await ensureFolder(app, normalized);

    let seeded = 0;
    for (const file of SEED_FILES) {
        const path = `${normalized}/${file.name}`;
        if (app.vault.getAbstractFileByPath(path)) continue;
        await app.vault.create(path, file.content);
        seeded++;
    }

    if (!quiet && seeded > 0) {
        new Notice(`Perplexed: seeded ${seeded.toString()} template${seeded === 1 ? '' : 's'} at ${normalized}`);
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
