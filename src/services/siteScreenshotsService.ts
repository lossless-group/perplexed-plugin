import { Notice } from 'obsidian';
import type { App, TFile } from 'obsidian';
import { findSiteScreenshots } from './imageSearchService';
import { renderScreenshots, SCREENSHOTS_HEADING, upsertSection } from '../utils/screenshotsSection';
import type { ScreenshotEntry } from '../utils/screenshotsSection';

/**
 * "Fetch screenshots from website": the product screenshots a company
 * publishes on its own site, found by Perplexity's image search limited to the
 * note's `url` domain, written under `## Screenshots`. Falls back to the
 * note's `og_image` when the site has none.
 */
export async function fetchScreenshotsIntoNote(app: App, apiKey: string, file: TFile): Promise<void> {
    if (!apiKey) {
        new Notice('Perplexity API key is not set. Configure it in perplexed settings.');
        return;
    }
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const url = typeof fm['url'] === 'string' ? fm['url'] : undefined;
    if (!url) {
        new Notice('This note has no URL in its frontmatter, so there is no website to search.');
        return;
    }
    const name = [fm['title'], fm['site_name'], file.basename].find(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
    ) ?? file.basename;

    const notice = new Notice(`Searching ${url} for screenshots…`, 0);
    let shots: ScreenshotEntry[];
    try {
        shots = (await findSiteScreenshots(apiKey, name, url)).flatMap((img) =>
            img.image_url ? [{ imageUrl: img.image_url, ...(img.origin_url ? { sourceUrl: img.origin_url } : {}) }] : [],
        );
    } finally {
        notice.hide();
    }

    let usedOgImage = false;
    if (shots.length === 0 && typeof fm['og_image'] === 'string' && /^https?:\/\//.test(fm['og_image'])) {
        shots = [{ imageUrl: fm['og_image'], sourceUrl: url }];
        usedOgImage = true;
    }
    if (shots.length === 0) {
        new Notice(`No screenshots found on ${url}.`);
        return;
    }

    // Leave out images the note already shows, from an earlier run or Metafetch.
    const current = await app.vault.read(file);
    shots = shots.filter((shot) => !current.includes(shot.imageUrl));
    if (shots.length === 0) {
        new Notice('The screenshots found are already in this note.');
        return;
    }

    const section = renderScreenshots(name, shots);
    await app.vault.process(file, (raw) => {
        const fmMatch = /^---\n[\s\S]*?\n---\n/.exec(raw);
        const head = fmMatch ? fmMatch[0] : '';
        return head + upsertSection(raw.slice(head.length), SCREENSHOTS_HEADING, section);
    });
    new Notice(
        usedOgImage
            ? `No product screenshots on ${url}; used the og_image instead.`
            : `Added ${shots.length.toString()} screenshot${shots.length === 1 ? '' : 's'} under ## ${SCREENSHOTS_HEADING}.`,
    );
}
