// The Fireround retrieval provider: the request, which rounds are kept, when it
// declines to run, the sources the model cites, and the raw JSON written into
// the note. No network: requestUrl is the stub.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { homepageDomain, roundsForDomain, searchRounds } from '../src/services/fireroundService';
import { parseIncludeSources, renderSourcesBlock, resolveIncludeSources } from '../src/services/includeSourcesService';
import type { SourceSpec } from '../src/services/includeSourcesService';
import { buildRetrievedFooter, buildSourcesFooter, insertJsonUnderHeading, stripEchoedSources, stripGeneratedFooters } from '../src/services/directoryTemplateService';
import { formatCitationDate } from '../src/utils/formatDate';

interface Sent { url: string; headers?: Record<string, string>; body?: string }

function serve(status: number, json: unknown): Sent[] {
    const sent: Sent[] = [];
    (globalThis as { __requestUrl?: unknown }).__requestUrl = (req: Sent) => {
        sent.push(req);
        return { status, headers: {}, text: JSON.stringify(json), json, arrayBuffer: new ArrayBuffer(0) };
    };
    return sent;
}

const SERIES_B = {
    id: 'firecrawl:series_b:2026-09-22',
    url: 'https://fireround.dev/companies/firecrawl.dev',
    company: { name: 'Firecrawl', domain: 'firecrawl.dev' },
    stage: 'series_b',
    stage_as_written: 'Series B',
    amount: { usd_millions: 75, as_written: '$75M' },
    valuation: null,
    valuation_disclosed: false,
    total_as_written: 'approximately $90 million',
    announced_on: '2026-09-22',
    lead_investors: ['Smash Capital'],
    other_investors: ['Y Combinator'],
    evidence: 'Firecrawl raised a $75M Series B.',
    primary_source: { url: 'https://www.firecrawl.dev/blog/series-b', kind: 'company' },
    previous_rounds: [
        { id: 'firecrawl:series_a:2025-08-19', stage_as_written: 'Series A', amount: { as_written: '$14.5M' }, announced_on: '2025-08-19', lead_investors: ['Nexus'], url: 'https://www.firecrawl.dev/blog/series-a' },
        { id: 'firecrawl:seed:2024-01-01', stage_as_written: 'Seed', announced_on: '2024-01-01', url: 'https://www.firecrawl.dev/blog/seed' },
    ],
};
const SERIES_A = { ...SERIES_B, id: 'firecrawl:series_a:2025-08-19', stage_as_written: 'Series A', amount: { as_written: '$14.5M' }, announced_on: '2025-08-19', previous_rounds: [] };
const NAMESAKE = { ...SERIES_B, id: 'other', company: { name: 'Firecrawl Fire Safety', domain: 'firecrawl.com' } };
const reply = (records: unknown[]) => ({ success: true, data: { alexandria: [{ provider: 'fireround', data: { data: records } }] } });

const SETTINGS = { exaApiKey: '', exaEndpoint: '', exaSplicedContextMaxChars: 12000, firecrawlApiKey: 'fc-test' };
const SPEC: SourceSpec = { provider: 'fireround', numResults: 20, writeJsonUnder: 'Fundraising History' };
const resolve = (url: string | undefined, settings = SETTINGS, spec = SPEC) => resolveIncludeSources(settings, [spec], url, { quiet: true });

afterEach(() => { delete (globalThis as { __requestUrl?: unknown }).__requestUrl; });

describe('which notes get a lookup', () => {
    test('a homepage gives its domain; a page on a site gives nothing', () => {
        assert.equal(homepageDomain('https://www.Firecrawl.dev/'), 'firecrawl.dev');
        assert.equal(homepageDomain('https://firecrawl.dev'), 'firecrawl.dev');
        assert.equal(homepageDomain('https://openai.com/sora'), null);
        assert.equal(homepageDomain('https://huggingface.co/org/model'), null);
        assert.equal(homepageDomain('not a url'), null);
        assert.equal(homepageDomain(undefined), null);
    });

    test('a page on a site: no request, and the warning says why', async () => {
        const sent = serve(200, reply([SERIES_B]));
        const out = await resolve('https://openai.com/sora');
        assert.equal(sent.length, 0);
        assert.deepEqual(out.sources, []);
        assert.match(out.warnings.join(), /not a company homepage/);
    });

    test('no Firecrawl key: no request, and the run continues with a reason', async () => {
        const sent = serve(200, reply([SERIES_B]));
        const out = await resolve('https://firecrawl.dev/', { ...SETTINGS, firecrawlApiKey: '' });
        assert.equal(sent.length, 0);
        assert.match(out.warnings.join(), /needs a Firecrawl API key/);
    });
});

describe('searchRounds', () => {
    test('sends the domain to Firecrawl with the Firecrawl key', async () => {
        const sent = serve(200, reply([SERIES_B]));
        await searchRounds('fc-test', 'firecrawl.dev', 20);
        assert.equal(sent[0]?.url, 'https://api.firecrawl.dev/v2/scrape');
        assert.equal(sent[0]?.headers?.['authorization'], 'Bearer fc-test');
        assert.deepEqual(JSON.parse(sent[0]?.body ?? '{}'), {
            alexandria: { provider: 'fireround', capability: 'rounds/search', options: { q: 'firecrawl.dev', limit: 20 } },
        });
    });

    test('a similarly named company is never kept', () => {
        assert.deepEqual(roundsForDomain([NAMESAKE, SERIES_B], 'firecrawl.dev'), [SERIES_B]);
        assert.deepEqual(roundsForDomain('nope', 'firecrawl.dev'), []);
    });

    test('an error inside a 200 and an HTTP error both throw, without the key', async () => {
        serve(200, { data: { alexandria: [{ error: { message: 'accept the terms' } }] } });
        await assert.rejects(searchRounds('fc-test', 'a.dev', 5), /accept the terms/);
        serve(402, { error: 'out of credits' });
        await assert.rejects(searchRounds('fc-test', 'a.dev', 5), (e: Error) => /HTTP 402/.test(e.message) && !e.message.includes('fc-test'));
    });
});

describe('sources and raw data', () => {
    test('one citeable source per round, including one known only from previous_rounds', async () => {
        serve(200, reply([SERIES_B, SERIES_A, NAMESAKE]));
        const out = await resolve('https://www.firecrawl.dev/');
        assert.deepEqual(out.sources.map(s => [s.marker, s.title]), [
            ['F1', 'Firecrawl Series B'], ['F2', 'Firecrawl Series A'], ['F3', 'Firecrawl Seed'],
        ]);
        const b = out.sources[0]!;
        assert.equal(b.url, 'https://www.firecrawl.dev/blog/series-b', 'cites the announcement, not the feed');
        assert.equal(b.publishedDate, '2026-09-22');
        assert.equal(b.body, 'Firecrawl raised a $75M Series B.');
        assert.equal(b.facts?.['amount'], '$75M');
        assert.deepEqual(b.facts?.['lead_investors'], ['Smash Capital']);
        assert.equal('valuation' in (b.facts ?? {}), false, 'an undisclosed valuation is not asserted');
        assert.match(renderSourcesBlock(out), /\[\^F1\] Firecrawl Series B/);
    });

    test('the raw rounds are kept for the note, namesakes excluded', async () => {
        serve(200, reply([SERIES_B, NAMESAKE]));
        const out = await resolve('https://firecrawl.dev/');
        assert.deepEqual(out.jsonBlocks, [{ heading: 'Fundraising History', value: { rounds: [SERIES_B] } }]);
    });

    test('no rounds: nothing to write, and a note saying so', async () => {
        serve(200, reply([]));
        const out = await resolve('https://firecrawl.dev/');
        assert.deepEqual(out.jsonBlocks, []);
        assert.match(out.warnings.join(), /no funding rounds for firecrawl\.dev/);
    });

    test('without write-json-under, the rounds are sources only', async () => {
        serve(200, reply([SERIES_B]));
        const out = await resolve('https://firecrawl.dev/', SETTINGS, { provider: 'fireround', numResults: 20 });
        assert.deepEqual(out.jsonBlocks, []);
        assert.equal(out.sources.length, 3);
    });

    test('a failed lookup never aborts the run', async () => {
        serve(500, { error: 'boom' });
        const out = await resolve('https://firecrawl.dev/');
        assert.deepEqual(out.sources, []);
        assert.match(out.warnings.join(), /Fireround retrieval failed/);
    });
});

describe('parseIncludeSources', () => {
    test('reads a fireround entry beside an exa one, with no query needed', () => {
        const { specs, warnings } = parseIncludeSources(
            [{ provider: 'fireround', 'write-json-under': 'Fundraising History' }, { provider: 'exa', query: 'q' }],
            t => t,
        );
        assert.deepEqual(warnings, []);
        assert.deepEqual(specs[0], { provider: 'fireround', numResults: 20, writeJsonUnder: 'Fundraising History' });
        assert.equal(specs[1]?.provider, 'exa');
    });
});

describe('insertJsonUnderHeading', () => {
    const FENCE = '```json\n{\n  "a": 1\n}\n```';
    const BODY = '# History\n\nStory.\n\n## Fundraising History\n\n| Round |\n|---|\n\n## Team\n\nPeople.';

    test('goes directly under the heading, above what the model wrote', () => {
        assert.equal(
            insertJsonUnderHeading(BODY, 'Fundraising History', { a: 1 }),
            `# History\n\nStory.\n\n## Fundraising History\n\n${FENCE}\n\n| Round |\n|---|\n\n## Team\n\nPeople.`,
        );
    });

    test('a second run replaces the fence rather than stacking one', () => {
        const once = insertJsonUnderHeading(BODY, 'Fundraising History', { a: 0 });
        assert.equal(insertJsonUnderHeading(once, 'Fundraising History', { a: 1 }), insertJsonUnderHeading(BODY, 'Fundraising History', { a: 1 }));
    });

    test('a model that dropped the heading: added at the end, so the data survives', () => {
        assert.equal(insertJsonUnderHeading('# Only\n\nText.\n', 'Fundraising History', { a: 1 }), `# Only\n\nText.\n\n## Fundraising History\n\n${FENCE}\n`);
    });

    test('heading text inside a code block is not the heading', () => {
        const body = '```\n## Fundraising History\n```\n\n## Fundraising History\n\nReal.';
        assert.equal(insertJsonUnderHeading(body, 'fundraising history', { a: 1 }), `\`\`\`\n## Fundraising History\n\`\`\`\n\n## Fundraising History\n\n${FENCE}\n\nReal.`);
    });

    test('fetched text holding a fence cannot break out of the block', () => {
        const out = insertJsonUnderHeading('## H', 'H', { evidence: 'x ``` y' });
        assert.match(out, /^## H\n\n````json\n/);
        assert.match(out, /\n````$/);
    });
});

describe('alongside Exa', () => {
    test('a template with both runs both, in order, and each keeps its own citation markers', async () => {
        const sent: Sent[] = [];
        (globalThis as { __requestUrl?: unknown }).__requestUrl = (req: Sent) => {
            sent.push(req);
            const json = req.url.includes('firecrawl')
                ? reply([SERIES_B])
                : { results: [{ title: 'Firecrawl', url: 'https://firecrawl.dev/about', summary: 'A web data API.' }] };
            return { status: 200, headers: {}, text: JSON.stringify(json), json, arrayBuffer: new ArrayBuffer(0) };
        };
        const { specs } = parseIncludeSources(
            [{ provider: 'fireround', 'write-json-under': 'Fundraising History' }, { provider: 'exa', query: 'firecrawl', pin: 'entity' }],
            t => t,
        );
        const out = await resolveIncludeSources(
            { ...SETTINGS, exaApiKey: 'exa-test', exaEndpoint: 'https://api.exa.ai/search' }, specs, 'https://firecrawl.dev/', { quiet: true },
        );
        assert.equal(sent.length, 2);
        assert.deepEqual(out.sources.map(s => s.marker), ['F1', 'F2', 'F3', 'E1']);
        assert.deepEqual(out.warnings, []);
    });
});

describe('citations in the Sources (retrieved) footer', () => {
    const HEADLINE = 'Samsara raises $300 million in new growth capital to increase the efficiency, safety, and sustainability of the operations that power our economy';
    const WIRE_URL = 'https://www.prnewswire.com/news-releases/samsara-raises-300-million-300915131.html';
    const BLOG_URL = 'https://www.samsara.com/blog/entering-2019';
    const round = (id: string, on: string, url: string, title: string, publisher: string) => ({
        id,
        company: { name: 'Samsara', domain: 'samsara.com' },
        stage_as_written: 'growth capital',
        announced_on: on,
        primary_source: { url, kind: 'wire' },
        sources: [{ url, title, publisher, published: on }],
    });
    const SAMSARA = [
        round('a', '2019-09-10', WIRE_URL, HEADLINE, 'prnewswire.com'),
        round('b', '2018-12-28', BLOG_URL, "A new investment for 2019: Samsara's Future", 'samsara.com'),
    ];
    const samsara = async () => {
        serve(200, reply(SAMSARA));
        return (await resolve('https://www.samsara.com/')).sources;
    };

    test('a round cites its date, publisher, real headline and provider', async () => {
        const [first] = await samsara();
        assert.equal(
            buildRetrievedFooter([first!]),
            `\n## Sources (retrieved)\n\n[^F1]: 2019, Sep 10. [PR Newswire](https://www.prnewswire.com/). [${HEADLINE}](${WIRE_URL}). [Fireround](https://fireround.dev) API response.\n`,
        );
    });

    test("a company's own site is published by the company", async () => {
        const [, second] = await samsara();
        assert.match(buildRetrievedFooter([second!]), /\[\^F2\]: 2018, Dec 28\. \[Samsara\]\(https:\/\/www\.samsara\.com\/\)\. \[A new investment/);
    });

    test('an unlisted publisher stays as its domain', () => {
        const footer = buildRetrievedFooter([{ marker: 'E1', title: 'Post', url: 'https://www.example.org/a', body: '', providerId: 'exa' }]);
        assert.match(footer, /\[\^E1\]: \[example\.org\]\(https:\/\/www\.example\.org\/\)\. \[Post\]\(https:\/\/www\.example\.org\/a\)\. \[Exa\.ai\]\(https:\/\/exa\.ai\) API response\.\n$/);
    });

    test('a round with no matching page falls back to its label and leaves nothing invented', async () => {
        serve(200, reply([SERIES_B]));
        const seed = (await resolve('https://www.firecrawl.dev/')).sources[2]!;
        const footer = buildRetrievedFooter([seed]);
        assert.match(footer, /\[Firecrawl Seed\]\(https:\/\/www\.firecrawl\.dev\/blog\/seed\)/);
        assert.equal(seed.pageTitle, undefined);
    });

    test('brackets in a headline cannot break the link', () => {
        const footer = buildRetrievedFooter([{ marker: 'E1', title: 'A [new] day', url: 'https://a.dev/x', body: '', providerId: 'exa' }]);
        assert.match(footer, /\[A \\\[new\\\] day\]\(https:\/\/a\.dev\/x\)/);
    });

    test('a stated date stays that date in every time zone', () => {
        const zone = process.env['TZ'];
        process.env['TZ'] = 'America/Chicago';
        try {
            assert.equal(formatCitationDate('2019-09-10'), '2019, Sep 10');
            assert.equal(formatCitationDate('2019-09-05T00:00:00.000Z'), '2019, Sep 05');
            assert.equal(formatCitationDate('2019-13-45'), '');
        } finally {
            if (zone === undefined) delete process.env['TZ'];
            else process.env['TZ'] = zone;
        }
    });
});

describe('the prompt list stays out of the note', () => {
    const ECHO = [
        '# Samsara', '', '## Retrieved sources', '',
        '### [^F1] Samsara growth — https://a.dev  (published 2019-09-10)', '', 'Samsara announced $300 million.', '',
        '### [^E1] Samsara — https://samsara.com', '', '```yaml', 'founded_year: 2015', '```', '', 'A summary.', '',
        '## Overview', '', 'Real text [^F1].',
    ].join('\n');

    test('the prompt tells the model not to repeat it', async () => {
        serve(200, reply([SERIES_B]));
        assert.match(renderSourcesBlock(await resolve('https://www.firecrawl.dev/')), /never reproduce this heading/);
    });

    test('an echoed list goes, and what follows stays', () => {
        assert.equal(stripEchoedSources(ECHO), '# Samsara\n\n## Overview\n\nReal text [^F1].');
    });

    test('our own block round-trips to nothing', async () => {
        serve(200, reply([SERIES_B]));
        const block = renderSourcesBlock(await resolve('https://www.firecrawl.dev/'));
        assert.equal(stripEchoedSources(`${block}\n## Overview\n\nText.`), '## Overview\n\nText.');
    });

    test('prose a model wrote under the heading is kept', () => {
        const body = '# Asetek\n\n## Retrieved sources\n\nAsetek makes liquid coolers [^E1].\n\n## Features\n\nMore.';
        assert.equal(stripEchoedSources(body), '# Asetek\n\nAsetek makes liquid coolers [^E1].\n\n## Features\n\nMore.');
    });

    test('a note with no echo is untouched, spacing included', () => {
        const body = '# A\n\n\n\nText [^F1].\n\n## Retrieval\n';
        assert.equal(stripEchoedSources(body), body);
    });

    test('the same words in a code block stay', () => {
        const body = '```\n## Retrieved sources\n### [^F1] x\n```\n\nText.';
        assert.equal(stripEchoedSources(body), body);
    });

    test('a remake does not feed an old echo back to the model', () => {
        assert.equal(stripGeneratedFooters(`${ECHO}\n\n## Sources (retrieved)\n\n[^F1]: x`), '# Samsara\n\n## Overview\n\nReal text [^F1].');
    });
});

describe('citations in the Sources footer', () => {
    const URL_4 = 'https://www.thetrucker.com/trucking-news/samsara';
    const TITLE_4 = 'Samsara expands AI fleet management tools';

    test('date, publisher, title, updated, generated, then the provider last', () => {
        assert.equal(
            buildSourcesFooter([{ title: TITLE_4, url: URL_4, date: '2026-10-28', last_updated: '2026-10-30' }], '2026-11-01'),
            `\n\n***\n\n# Sources\n\n[1]: 2026, Oct 28. [thetrucker.com](https://www.thetrucker.com/). [${TITLE_4}](${URL_4}). Updated: 2026, Oct 30. Generated: 2026, Nov 01. [Perplexity](https://www.perplexity.ai/) API response.\n`,
        );
    });

    test('an update on the published date is not repeated', () => {
        const footer = buildSourcesFooter([{ title: 'T', url: URL_4, date: '2026-10-28', last_updated: '2026-10-28' }]);
        assert.doesNotMatch(footer, /Updated/);
    });

    test('a source with no dates leaves them out, and numbers follow the list', () => {
        const footer = buildSourcesFooter([{ title: 'A', url: 'https://a.dev/1' }, { title: 'B', url: 'https://b.dev/2' }]);
        assert.match(footer, /\n\[1\]: \[a\.dev\]\(https:\/\/a\.dev\/\)\. \[A\]\(https:\/\/a\.dev\/1\)\. \[Perplexity\]/);
        assert.match(footer, /\n\[2\]: \[b\.dev\]/);
    });

    test('a source with only a URL, and none at all, still gets a line', () => {
        assert.match(buildSourcesFooter([{ url: 'https://a.dev/1' }]), /\[https:\/\/a\.dev\/1\]\(https:\/\/a\.dev\/1\)/);
        assert.match(buildSourcesFooter([{ title: 'Only' }]), /\[1\]: Only\. \[Perplexity\]/);
        assert.match(buildSourcesFooter([]), /_No sources returned\._/);
    });

    test('tracking parameters are removed, and real ones stay', () => {
        const footer = buildSourcesFooter([{ title: 'S', url: 'https://www.samsara.com/?utm_ext_ad_id=kwd-1&gclid=x&page=2' }]);
        assert.match(footer, /\[S\]\(https:\/\/www\.samsara\.com\/\?page=2\)/);
        assert.doesNotMatch(footer, /utm_|gclid/);
    });

    test('a retrieved source takes the generated date too', () => {
        const footer = buildRetrievedFooter([{ marker: 'E1', title: 'P', url: 'https://a.dev/x', body: '', providerId: 'exa' }], '2026-11-01');
        assert.match(footer, /\[\^E1\]: .*\[P\]\(https:\/\/a\.dev\/x\)\. Generated: 2026, Nov 01\. \[Exa\.ai\]/);
    });
});
