/**
 * Writes a note's `## Screenshots` section. Metafetch writes to the same
 * section, so neither plugin may wipe the other's images: a section that holds
 * no image yet (a template's "none publicly available") is replaced, and one
 * that does gets the new images added after what's there. A note without the
 * section gets it appended. Headings inside code fences are ignored.
 */

export const SCREENSHOTS_HEADING = 'Screenshots';

export interface ScreenshotEntry {
    imageUrl: string;
    /** The page the image was found on, when known. */
    sourceUrl?: string;
}

export function renderScreenshots(name: string, shots: ScreenshotEntry[]): string {
    return shots
        .map((shot, i) => {
            const alt = `${name} screenshot ${(i + 1).toString()}`.replace(/[[\]]/g, '');
            const image = `![${alt}](${shot.imageUrl})`;
            return shot.sourceUrl ? `${image}\n*Source: [${hostOf(shot.sourceUrl)}](${shot.sourceUrl})*` : image;
        })
        .join('\n\n');
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

export function upsertSection(body: string, heading: string, content: string): string {
    const lines = body.split('\n');
    const wanted = heading.trim().toLowerCase();
    let inFence = false;
    let at = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        const m = inFence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        if (m && (m[2] ?? '').trim().toLowerCase() === wanted) {
            at = i;
            level = (m[1] ?? '').length;
            break;
        }
    }
    if (at < 0) return `${body.replace(/\s+$/, '')}\n\n## ${heading}\n\n${content}\n`;

    let end = lines.length;
    inFence = false;
    for (let i = at + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        const m = inFence ? null : /^(#{1,6})\s/.exec(line);
        if (m && (m[1] ?? '').length <= level) {
            end = i;
            break;
        }
    }
    const existing = lines.slice(at + 1, end).join('\n').trim();
    const kept = /!\[[^\]]*\]\(|!\[\[/.test(existing) ? `${existing}\n\n` : '';
    const tail = lines.slice(end);
    return [...lines.slice(0, at + 1), '', kept + content, ...(tail.length > 0 ? ['', ...tail] : [''])].join('\n');
}
