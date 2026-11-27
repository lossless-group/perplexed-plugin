// An image embed that stands on a line of its own is a block, not a list
// item: no bullet in front, a blank line above and below. Models are asked to
// put the image marker "on its own line", but templates that list the
// skeleton as bullets get `- [IMAGE 1: …]` back, which became
// `- ![cover](url)` squeezed against the lede.

/** A line that is only an image embed, perhaps bulleted, perhaps followed by footnote markers. */
const IMAGE_LINE = /^\s*(?:[-*+]|\d+[.)])?\s*(!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)(?:\s*\[\^?[\w-]+\])*)\s*$/;

/**
 * Turns every line that holds nothing but an image embed into its own block:
 * the bullet is dropped and a blank line is kept above and below. Images
 * inside prose, and everything inside fenced code, are left alone.
 */
export function isolateImageEmbeds(content: string): string {
    const lines = content.split('\n');
    const out: string[] = [];
    let fenced = false;
    let afterImage = false;
    for (const line of lines) {
        const fence = /^\s*(```|~~~)/.test(line);
        const m = fenced || fence ? null : IMAGE_LINE.exec(line);
        if (fence) fenced = !fenced;
        if (!m) {
            // The line right after an image block gets its blank line.
            if (afterImage && line.trim() !== '') out.push('');
            afterImage = false;
            out.push(line);
            continue;
        }
        if (out.length > 0 && (out[out.length - 1] ?? '').trim() !== '') out.push('');
        out.push(m[1] ?? line);
        afterImage = true;
    }
    return out.join('\n');
}
