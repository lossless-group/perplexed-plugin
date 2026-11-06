import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickScreenshots, siteDomain } from '../src/services/imageSearchService';
import { renderScreenshots, upsertSection } from '../src/utils/screenshotsSection';

test('pickScreenshots keeps the largest, drops thumbnails and repeats', () => {
    const picked = pickScreenshots([
        { image_url: 'a', width: 640, height: 400 },
        { image_url: 'b', width: 2560, height: 1600 },
        { image_url: 'c' },
        { image_url: 'd', width: 1400, height: 900 },
        { image_url: 'b', width: 2560, height: 1600 },
    ], 3);
    assert.deepEqual(picked.map((p) => p.image_url), ['b', 'd', 'c']);
});

test('siteDomain strips www and rejects non-web URLs', () => {
    assert.equal(siteDomain('https://www.Linear.app/features'), 'linear.app');
    assert.equal(siteDomain('mailto:x@y.com'), null);
    assert.equal(siteDomain('not a url'), null);
});

test('upsertSection replaces only the Screenshots section', () => {
    const body = '## Features\n- a\n\n## Screenshots\nNone publicly available.\n\n## Roadmap\n- b\n';
    const out = upsertSection(body, 'Screenshots', '![x](u)');
    assert.equal(out, '## Features\n- a\n\n## Screenshots\n\n![x](u)\n\n## Roadmap\n- b\n');
});

test('upsertSection appends the section when missing, ignoring fenced headings', () => {
    const body = 'Intro\n\n```md\n## Screenshots\n```\n';
    assert.equal(upsertSection(body, 'Screenshots', 'X'), 'Intro\n\n```md\n## Screenshots\n```\n\n## Screenshots\n\nX\n');
});

test('upsertSection handles a Screenshots section at the end of the note', () => {
    assert.equal(upsertSection('## Screenshots\nold\n', 'Screenshots', 'new'), '## Screenshots\n\nnew\n');
});

test('renderScreenshots links each image to its source page', () => {
    assert.equal(
        renderScreenshots('Linear', [{ imageUrl: 'https://cdn/x.png', sourceUrl: 'https://www.linear.app/p' }, { imageUrl: 'https://cdn/y.png' }]),
        '![Linear screenshot 1](https://cdn/x.png)\n*Source: [linear.app](https://www.linear.app/p)*\n\n![Linear screenshot 2](https://cdn/y.png)',
    );
});

test('upsertSection keeps images already in the section and adds after them', () => {
    const body = '## Screenshots\n\n![[linear-screenshot.png]]\n\n## Roadmap\n';
    assert.equal(
        upsertSection(body, 'Screenshots', '![x](u)'),
        '## Screenshots\n\n![[linear-screenshot.png]]\n\n![x](u)\n\n## Roadmap\n',
    );
});
