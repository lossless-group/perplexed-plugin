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

/** A line holding only an image embed or an unswapped `[IMAGE N: …]` marker, bulleted or not. */
const IMAGE_SLOT = /^\s*(?:[-*+]|\d+[.)])?\s*(?:!\[[^\]]*\]\([^)\s]+\)|!?\[IMAGE\s+\d+[^\]]*\](?:\([^)]*\))?)(?:\s*\[\^?[\w-]+\])*\s*$/i;

function isHttpUrl(v: unknown): v is string {
    return typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim());
}

/** A book note, by its frontmatter: format: book, or the fields Metafetch's Books profile fills. */
export function isBookNote(fm: Record<string, unknown>): boolean {
    return (typeof fm['format'] === 'string' && fm['format'].trim().toLowerCase() === 'book')
        || 'isbn_13' in fm || 'book_authors' in fm;
}

/**
 * The cover is the top image of a generated entry: the image (or image
 * marker) between the first heading and the first `##` section. A note's own
 * `cover_image` (Metafetch fills it from Open Library) takes that slot,
 * replacing whatever image search put there. A book with no `cover_image`
 * gets no cover at all, rather than a web-search guess. Images further down
 * are untouched.
 */
export function placeCoverImage(content: string, fm: Record<string, unknown>, title: string): string {
    const cover = fm['cover_image'];
    const hasCover = isHttpUrl(cover);
    if (!hasCover && !isBookNote(fm)) return content;
    if (hasCover && content.includes(cover.trim())) return isolateImageEmbeds(content);

    const lines = content.split('\n');
    let end = lines.findIndex((l, i) => i > 0 && /^##\s/.test(l));
    if (end < 0) end = lines.length;
    const slot = lines.findIndex((l, i) => i < end && IMAGE_SLOT.test(l));
    const embed = hasCover ? `![Cover of ${title}](${cover.trim()})` : null;

    if (slot >= 0) {
        if (embed) lines[slot] = embed;
        else lines.splice(slot, 1);
    } else if (embed) {
        const h1 = lines.findIndex(l => /^#\s/.test(l));
        lines.splice(h1 >= 0 ? h1 + 1 : 0, 0, embed);
    }
    return isolateImageEmbeds(lines.join('\n'));
}
