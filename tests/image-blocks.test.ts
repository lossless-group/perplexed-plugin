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
