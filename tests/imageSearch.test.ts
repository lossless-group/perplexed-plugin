import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagesFromAgentResponse, searchImages } from '../src/services/imageSearchService';

test('imagesFromAgentResponse reads image_search_results items', () => {
    const images = imagesFromAgentResponse({
        output: [
            { type: 'search_results', results: [{ id: 1, url: 'https://a.com' }] },
            {
                type: 'image_search_results',
                results: [
                    { image_url: 'https://cdn.x/1.png', origin_url: 'https://x.com/p', width: 10, height: 10 },
                    { image_url: 'https://cdn.x/2.png' },
                    { origin_url: 'https://x.com/no-image' },
                ],
            },
            { type: 'message', content: [] },
        ],
    });
    assert.deepEqual(images, [
        { image_url: 'https://cdn.x/1.png', origin_url: 'https://x.com/p', width: 10, height: 10 },
        { image_url: 'https://cdn.x/2.png' },
    ]);
});

test('imagesFromAgentResponse is empty for failures and odd shapes', () => {
    assert.deepEqual(imagesFromAgentResponse({ output: [{ type: 'image_search_results', error: 'image_search_failed', results: [] }] }), []);
    assert.deepEqual(imagesFromAgentResponse({}), []);
    assert.deepEqual(imagesFromAgentResponse(null), []);
});

test('searchImages gives up on a stalled request and returns no images', async () => {
    const g = globalThis as { __requestUrl?: unknown };
    const previous = g.__requestUrl;
    g.__requestUrl = () => new Promise(() => { /* never settles */ });
    try {
        const started = Date.now();
        const images = await searchImages('key', 'anything', { timeoutMs: 50 });
        assert.deepEqual(images, []);
        assert.ok(Date.now() - started < 2000);
    } finally {
        g.__requestUrl = previous;
    }
});
