// An image on a line of its own is a block: no bullet, a blank line above and
// below. "Apply folder template" put a book cover in as `- ![cover](url)`,
// jammed between the heading and the lede.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isolateImageEmbeds } from '../src/utils/imageBlocks';

const IMG = '![Cover of 7 Powers](https://covers.openlibrary.org/b/id/1-L.jpg)';

test('a bulleted cover under the heading becomes its own block', () => {
    const before = `# 7 Powers\n- ${IMG}\n- _A seminal book on competitive advantage._\n- More.`;
    assert.equal(isolateImageEmbeds(before), `# 7 Powers\n\n${IMG}\n\n- _A seminal book on competitive advantage._\n- More.`);
});

test('every bullet shape, and a trailing footnote marker, keep the image and its citation', () => {
    for (const bullet of ['- ', '* ', '+ ', '1. ', '2) ', '  - ']) {
        assert.equal(isolateImageEmbeds(`Intro\n${bullet}${IMG}[^ab12cd]\nNext`), `Intro\n\n${IMG}[^ab12cd]\n\nNext`);
    }
});

test('blank lines already there are not doubled', () => {
    const ok = `# T\n\n${IMG}\n\n_Lede._`;
    assert.equal(isolateImageEmbeds(ok), ok);
    assert.equal(isolateImageEmbeds(isolateImageEmbeds(`# T\n- ${IMG}\n_Lede._`)), ok);
});

test('an image inside prose, a link, and code fences are left alone', () => {
    const prose = `See ${IMG} for the cover.\n- [Homepage](https://7powers.com)`;
    assert.equal(isolateImageEmbeds(prose), prose);
    const fenced = '```md\n- ![x](https://x.com/a.png)\n```';
    assert.equal(isolateImageEmbeds(fenced), fenced);
});

import { placeCoverImage } from '../src/utils/imageBlocks';

const OL = 'https://covers.openlibrary.org/b/id/12968901-L.jpg';
const WEB = '![Cover of Chip War](https://i2.wp.com/someblog.com/chip.jpg)';

test('a book with cover_image: its own cover replaces the web-search one, under the heading', () => {
    const out = placeCoverImage(`# Chip War\n- ${WEB}\n- _A book._\n\n## Author\n![Miller](https://x.com/m.jpg)`, { format: 'book', cover_image: OL }, 'Chip War');
    assert.equal(out, `# Chip War\n\n![Cover of Chip War](${OL})\n\n- _A book._\n\n## Author\n\n![Miller](https://x.com/m.jpg)`);
});

test('a book with cover_image and no image in the output: the cover goes under the heading', () => {
    assert.equal(placeCoverImage('# Chip War\n_A book._', { cover_image: OL, book_authors: ['Chris Miller'] }, 'Chip War'),
        `# Chip War\n\n![Cover of Chip War](${OL})\n\n_A book._`);
});

test('an unswapped [IMAGE 1: …] marker in the cover slot is the slot too', () => {
    assert.equal(placeCoverImage('# Chip War\n- [IMAGE 1: book cover]\n_A book._', { cover_image: OL }, 'Chip War'),
        `# Chip War\n\n![Cover of Chip War](${OL})\n\n_A book._`);
});

test('a book without cover_image gets no guessed cover; body images stay', () => {
    assert.equal(placeCoverImage(`# Chip War\n${WEB}\n_A book._\n\n## More\n![Fab](https://x.com/f.jpg)`, { format: 'book' }, 'Chip War'),
        '# Chip War\n_A book._\n\n## More\n\n![Fab](https://x.com/f.jpg)');
});

test('a note that is not a book and has no cover_image is left as it was', () => {
    const org = `# Acme\n- ${WEB}\n_A company._`;
    assert.equal(placeCoverImage(org, { format: 'organization' }, 'Acme'), org);
});
