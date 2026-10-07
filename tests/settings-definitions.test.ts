// Acceptance tests for the 0.4.0 settings tab, which moves to Obsidian
// 1.13's declarative getSettingDefinitions() API (the same migration as
// Image Gin 0.3.0 and Cite Wide 0.3.0). They walk the definition tree that
// Obsidian renders and indexes for settings search, so a missing or
// mis-bound setting fails here instead of silently vanishing from the
// screen or from search.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Setting } from 'obsidian';
import { PerplexedSettingTab, DEFAULT_SETTINGS } from '../src/settings/PerplexedSettings';
import type { PerplexedPluginSettings } from '../src/settings/PerplexedSettings';
import type PerplexedPlugin from '../main';
import type { App } from 'obsidian';
import { liveShapedData } from './fixtures/live-data-shape';

// Loose structural view of the definition tree; the real types come from
// obsidian 1.13, but the tests stay decoupled from them.
interface Def {
    type?: string;
    name?: string;
    heading?: string;
    desc?: unknown;
    aliases?: string[];
    control?: {
        type: string;
        key: string;
        options?: Record<string, string>;
        validate?: (v: unknown) => unknown;
        disabled?: boolean | (() => boolean);
    };
    render?: (setting: unknown, group: unknown) => unknown;
    action?: unknown;
    items?: Def[];
    visible?: boolean | (() => boolean);
    addItem?: { name: string; action: (el: unknown) => void };
    onDelete?: (index: number) => void;
    onReorder?: (oldIndex: number, newIndex: number) => void;
}

type Tab = {
    getSettingDefinitions(): Def[];
    getControlValue(key: string): unknown;
    setControlValue(key: string, value: unknown): void | Promise<void>;
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function makeTab(settingsIn?: Record<string, unknown>) {
    const settings = (settingsIn ?? clone(DEFAULT_SETTINGS)) as unknown as PerplexedPluginSettings;
    let saves = 0;
    const promptUpdates: unknown[] = [];
    const plugin = {
        settings,
        app: {},
        saveSettings: () => { saves++; return Promise.resolve(); },
        getPromptsService: () => ({ updateSettings: (p: unknown) => { promptUpdates.push(p); } }),
    } as unknown as PerplexedPlugin;
    const app = { vault: {} } as unknown as App;
    const tab = new PerplexedSettingTab(app, plugin) as unknown as Tab;
    return { tab, settings, saves: () => saves, promptUpdates };
}

/** Depth-first walk over groups, lists, and pages; records each item's parent heading. */
function walk(defs: Def[], parent = '', out: { def: Def; parent: string }[] = []) {
    for (const d of defs) {
        out.push({ def: d, parent });
        if (d.items) walk(d.items, d.heading ?? d.name ?? parent, out);
    }
    return out;
}
const all = (tab: Tab) => walk(tab.getSettingDefinitions());
const norm = (s: string) => s.trim().toLowerCase();
const shown = (d: Def) => d.visible === undefined || (typeof d.visible === 'function' ? d.visible() : d.visible);

function getPath(root: unknown, path: string): unknown {
    let cur: unknown = root;
    for (const part of path.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
}

// Every row in the 0.3.1 display() tab, by name. Compared case-insensitively
// because 0.4.0 fixes sentence case (e.g. "Lm studio" -> "LM Studio"),
// which is a wording fix, not a missing setting. A row may survive as a
// setting name or as a list heading (the comma-separated preamble and
// whitelist fields become editable lists).
const REQUIRED_NAMES = [
    // Perplexity
    'Endpoint', 'API key', 'Header position', 'Request body template',
    // Claude
    'Anthropic API key', 'Default Claude model',
    // Gemini
    'Gemini API key', 'Default Gemini model', 'Enable Google search grounding by default',
    'Include Google searches list in notes', 'Resolve citation URLs (durable, slower)',
    // Perplexica / Vane
    'Fallback container path', 'Default model',
    // Exa
    'Use Exa retrieval', 'Exa API key', 'Exa endpoint', 'Spliced context budget (characters)',
    // System prompts
    'Perplexity system prompt', 'Perplexica / Vane system prompt', 'LM Studio default system prompt',
    // Placeholder text
    'Perplexity query placeholder', 'Perplexica / Vane query placeholder', 'LM Studio query placeholder',
    'LM Studio system prompt placeholder', 'Article term placeholder',
    // Article generator, images, text enhancement
    'Article generator template', 'Deep research article generator template', 'Image references prompt',
    'Text enhancement prompt', 'Related images prompt',
    // Directory templates
    'Templates root', 'Partials root', 'Preambles root', 'System preambles', 'User preambles',
    'Frontmatter whitelist', 'Request timeout (ms)', 'Re-seed templates',
    // Find images
    'Max images',
];

// The 0.3.1 section headings. "Prompts & text configuration" was an umbrella
// over the five prompt sections below it; 0.4.0 keeps the five sections.
const REQUIRED_HEADINGS = [
    'Perplexity (remote service)', 'Claude (Anthropic)', 'Gemini (Google)',
    'Perplexica / Vane (self-hosted)', 'LM Studio (local models)', 'Exa retrieval',
    'System prompts', 'Placeholder text', 'Article generator template', 'Image prompts',
    'Text enhancement', 'Directory templates', 'Find images for selection',
];

// Rows whose names repeat across providers must each sit under their own
// provider's heading.
const PROVIDER_ROWS: [string, string][] = [
    ['Perplexity (remote service)', 'Endpoint'],
    ['Perplexity (remote service)', 'API key'],
    ['Perplexity (remote service)', 'Request body template'],
    ['Perplexica / Vane (self-hosted)', 'Endpoint'],
    ['Perplexica / Vane (self-hosted)', 'Default model'],
    ['Perplexica / Vane (self-hosted)', 'Request body template'],
    ['LM Studio (local models)', 'Endpoint'],
    ['LM Studio (local models)', 'Default model'],
    ['LM Studio (local models)', 'Request body template'],
];

// Every stored key the 0.3.1 tab let a user edit. Each must still be bound,
// either to a control or to an editable list.
const EDITABLE_KEYS = [
    'perplexityEndpoint', 'perplexityApiKey', 'headerPosition', 'perplexityRequestTemplate',
    'anthropicApiKey', 'claudeDefaultModel',
    'geminiApiKey', 'geminiDefaultModel', 'geminiEnableGrounding', 'geminiIncludeSearchSuggestions',
    'geminiResolveCitationUrls',
    'perplexicaEndpoint', 'localLLMPath', 'defaultModel', 'requestBodyTemplate',
    'lmStudioEndpoint', 'defaultLMStudioModel', 'lmStudioRequestTemplate',
    'exaEnabled', 'exaApiKey', 'exaEndpoint', 'exaSplicedContextMaxChars',
    ...Object.keys(DEFAULT_SETTINGS.prompts).map(k => `prompts.${k}`),
    'directoryTemplatesRoot', 'directoryTemplatesPartialsRoot', 'directoryTemplatesPreamblesRoot',
    'directoryTemplatesRequestTimeoutMs', 'findImagesMaxImages',
];
const LIST_HEADINGS = ['System preambles', 'User preambles', 'Frontmatter whitelist'];

const JSON_TEMPLATE_KEYS = ['perplexityRequestTemplate', 'requestBodyTemplate', 'lmStudioRequestTemplate'];

describe('declarative settings tab (Obsidian >= 1.13)', () => {
    test('implements getSettingDefinitions() and does not override display()', () => {
        assert.ok(
            Object.prototype.hasOwnProperty.call(PerplexedSettingTab.prototype, 'getSettingDefinitions'),
            'PerplexedSettingTab must implement getSettingDefinitions()',
        );
        assert.ok(
            !Object.prototype.hasOwnProperty.call(PerplexedSettingTab.prototype, 'display'),
            'display() must not be overridden; Obsidian renders the definitions',
        );
    });

    test('every 0.3.1 setting row is still present (searchable by name)', () => {
        const found = new Set<string>();
        for (const { def } of all(makeTab().tab)) {
            if (def.name) found.add(norm(def.name));
            if (def.heading) found.add(norm(def.heading));
        }
        const missing = REQUIRED_NAMES.filter(n => !found.has(norm(n)));
        assert.deepEqual(missing, []);
    });

    test('every 0.3.1 section survives as a heading', () => {
        const headings = all(makeTab().tab).map(x => norm(x.def.heading ?? ''));
        const missing = REQUIRED_HEADINGS.filter(h => !headings.some(x => x.includes(norm(h))));
        assert.deepEqual(missing, []);
    });

    test('repeated row names sit under their own provider', () => {
        const pairs = new Set(all(makeTab().tab).map(x => `${norm(x.parent)}|${norm(x.def.name ?? '')}`));
        const missing = PROVIDER_ROWS.filter(([h, n]) => !pairs.has(`${norm(h)}|${norm(n)}`));
        assert.deepEqual(missing, []);
    });

    test('every item has a name; groups are not empty', () => {
        const defs = all(makeTab().tab).map(x => x.def);
        assert.ok(defs.length > 0, 'getSettingDefinitions() returned nothing');
        for (const d of defs) {
            if (d.type === 'group' || d.type === 'list') {
                assert.ok(d.heading?.trim(), `group or list without a heading: ${JSON.stringify(d)}`);
                if (d.type === 'group') assert.ok((d.items?.length ?? 0) > 0, `empty group: ${d.heading}`);
                continue;
            }
            assert.ok(d.name?.trim(), `item without a name: ${JSON.stringify(d.control ?? d)}`);
        }
    });

    test('the re-seed templates row has a button', () => {
        const row = all(makeTab().tab).find(x => norm(x.def.name ?? '') === 're-seed templates');
        assert.ok(row, 'no re-seed templates row');
        assert.equal(typeof row.def.render, 'function');
    });
});

describe('control bindings', () => {
    test('every control key exists in DEFAULT_SETTINGS (dot paths included)', () => {
        const keys = all(makeTab().tab).map(x => x.def.control?.key).filter((k): k is string => !!k);
        assert.ok(keys.length > 0);
        const unknown = keys.filter(k => getPath(DEFAULT_SETTINGS, k) === undefined);
        assert.deepEqual(unknown, []);
        assert.equal(new Set(keys).size, keys.length, 'a key is bound to two controls');
    });

    test('every setting the 0.3.1 tab could edit is still editable', () => {
        const defs = all(makeTab().tab).map(x => x.def);
        const keys = new Set(defs.map(d => d.control?.key).filter(Boolean));
        assert.deepEqual(EDITABLE_KEYS.filter(k => !keys.has(k)), []);
        const lists = new Set(defs.filter(d => d.type === 'list').map(d => norm(d.heading ?? '')));
        assert.deepEqual(LIST_HEADINGS.filter(h => !lists.has(norm(h))), []);
    });

    test('getControlValue reads top-level and nested keys', () => {
        const { tab, settings } = makeTab();
        assert.equal(tab.getControlValue('perplexityEndpoint'), settings.perplexityEndpoint);
        assert.equal(tab.getControlValue('exaEnabled'), settings.exaEnabled);
        assert.equal(tab.getControlValue('prompts.enhancePrompt'), settings.prompts.enhancePrompt);
        assert.equal(tab.getControlValue('prompts.nope'), undefined);
        for (const key of all(tab).map(x => x.def.control?.key).filter((k): k is string => !!k)) {
            if (JSON_TEMPLATE_KEYS.includes(key)) continue;
            assert.deepEqual(tab.getControlValue(key), getPath(settings, key), key);
        }
    });

    test('setControlValue writes nested prompt keys, saves, and refreshes the prompts service', async () => {
        const { tab, settings, saves, promptUpdates } = makeTab();
        await tab.setControlValue('prompts.enhancePrompt', 'Enhance: {TEXT}');
        assert.equal(settings.prompts.enhancePrompt, 'Enhance: {TEXT}');
        assert.equal(saves(), 1);
        assert.equal(promptUpdates.length, 1);
        assert.equal(DEFAULT_SETTINGS.prompts.enhancePrompt === 'Enhance: {TEXT}', false, 'DEFAULT_SETTINGS was mutated');
    });

    test('setControlValue writes top-level keys and ignores unknown keys', async () => {
        const { tab, settings, saves } = makeTab();
        await tab.setControlValue('geminiEnableGrounding', false);
        assert.equal(settings.geminiEnableGrounding, false);
        await tab.setControlValue('headerPosition', 'bottom');
        assert.equal(settings.headerPosition, 'bottom');
        assert.equal(saves(), 2);
        await tab.setControlValue('notASetting', 'x');
        await tab.setControlValue('prompts.notAPrompt', 'x');
        assert.equal(saves(), 2);
        assert.equal((settings as unknown as Record<string, unknown>).notASetting, undefined);
        assert.equal((settings.prompts as unknown as Record<string, unknown>).notAPrompt, undefined);
    });

    test('keys and folder paths are trimmed on save, as in 0.3.1', async () => {
        const { tab, settings } = makeTab();
        await tab.setControlValue('exaApiKey', '  exa-test  ');
        await tab.setControlValue('exaEndpoint', ' https://example.invalid/search ');
        await tab.setControlValue('directoryTemplatesRoot', ' lib/templates ');
        assert.equal(settings.exaApiKey, 'exa-test');
        assert.equal(settings.exaEndpoint, 'https://example.invalid/search');
        assert.equal(settings.directoryTemplatesRoot, 'lib/templates');
    });

    test('JSON request templates display pretty-printed when valid, as-is when not', () => {
        const { tab, settings } = makeTab();
        settings.perplexityRequestTemplate = '{"model":"m","stream":false}';
        settings.requestBodyTemplate = '{ not json';
        assert.equal(tab.getControlValue('perplexityRequestTemplate'), '{\n  "model": "m",\n  "stream": false\n}');
        assert.equal(tab.getControlValue('requestBodyTemplate'), '{ not json');
    });

    test('number fields reject non-positive or fractional values', () => {
        const defs = all(makeTab().tab).map(x => x.def);
        for (const key of ['exaSplicedContextMaxChars', 'directoryTemplatesRequestTimeoutMs', 'findImagesMaxImages']) {
            const d = defs.find(x => x.control?.key === key);
            assert.ok(d?.control, `no control for ${key}`);
            assert.equal(d.control.type, 'number', key);
            const validate = d.control.validate;
            assert.ok(validate, `${key} has no validate`);
            assert.ok(validate(0), `${key} accepted 0`);
            assert.ok(validate(-5), `${key} accepted -5`);
            assert.ok(validate(1.5), `${key} accepted 1.5`);
            assert.ok(!validate(3), `${key} rejected 3`);
        }
    });
});

describe('visible dependents', () => {
    test('Exa key, endpoint, and budget show only while Exa retrieval is on', async () => {
        const { tab } = makeTab();
        const exaRows = () => all(tab).map(x => x.def)
            .filter(d => ['exaApiKey', 'exaEndpoint', 'exaSplicedContextMaxChars'].includes(d.control?.key ?? ''));
        assert.equal(exaRows().length, 3);
        assert.ok(exaRows().every(shown));
        await tab.setControlValue('exaEnabled', false);
        assert.ok(exaRows().every(d => !shown(d)));
    });
});

describe('editable lists', () => {
    const list = (tab: Tab, heading: string) => {
        const d = all(tab).map(x => x.def).find(x => x.type === 'list' && norm(x.heading ?? '') === norm(heading));
        assert.ok(d, `no list ${heading}`);
        return d;
    };

    test('each list shows one item per stored entry, named after it', () => {
        const { tab, settings } = makeTab();
        assert.deepEqual(list(tab, 'System preambles').items?.map(i => i.name), settings.directoryTemplatesSystemPreambles);
        assert.deepEqual(list(tab, 'User preambles').items?.map(i => i.name), settings.directoryTemplatesUserPreambles.map(p => p.name));
        assert.deepEqual(list(tab, 'Frontmatter whitelist').items?.map(i => i.name), settings.directoryTemplatesFrontmatterWhitelist);
    });

    test('add, delete, and reorder edit the stored arrays and save, without touching the defaults', () => {
        const defaults = clone(DEFAULT_SETTINGS);
        const { tab, settings, saves } = makeTab();
        const user = list(tab, 'User preambles');
        assert.ok(user.addItem && user.onDelete && user.onReorder);
        user.addItem.action({});
        assert.equal(settings.directoryTemplatesUserPreambles.length, 3);
        user.onReorder(2, 0);
        assert.equal(settings.directoryTemplatesUserPreambles[1]!.name, 'research-framing');
        user.onDelete(0);
        assert.deepEqual(settings.directoryTemplatesUserPreambles.map(p => p.name), ['research-framing', 'image-placement']);

        const wl = list(tab, 'Frontmatter whitelist');
        wl.addItem!.action({});
        wl.onDelete!(0);
        assert.equal(settings.directoryTemplatesFrontmatterWhitelist[0], 'og_description');

        const sys = list(tab, 'System preambles');
        sys.addItem!.action({});
        assert.equal(settings.directoryTemplatesSystemPreambles.length, 2);

        assert.ok(saves() >= 6);
        assert.deepEqual(DEFAULT_SETTINGS, defaults, 'DEFAULT_SETTINGS was mutated');
    });
});

describe('a settings object shaped like the live data.json', () => {
    test('builds, evaluates every predicate, and runs every render row without throwing', () => {
        // Raw stored shape, not merged with defaults: exaEnabled and
        // directoryTemplatesHistoryRoot are absent, as in the live file.
        const { tab } = makeTab(liveShapedData());
        const defs = all(tab).map(x => x.def);
        assert.ok(defs.length > 40, `only ${defs.length} definitions`);
        for (const d of defs) {
            shown(d);
            const disabled = d.control?.disabled;
            if (typeof disabled === 'function') disabled();
            if (d.render) d.render(new Setting(null as never), {});
            if (d.control) tab.getControlValue(d.control.key);
        }
    });

    test('keeps a stored dropdown value that is not one of the built-in options', () => {
        const { tab } = makeTab(liveShapedData());
        const claude = all(tab).map(x => x.def).find(d => d.control?.key === 'claudeDefaultModel');
        assert.ok(claude?.control?.options);
        assert.ok('claude-dummy-model' in claude.control.options);
    });

    test('reads every stored top-level key the tab binds', () => {
        const stored = liveShapedData();
        const { tab } = makeTab(stored);
        for (const key of all(tab).map(x => x.def.control?.key).filter((k): k is string => !!k)) {
            if (JSON_TEMPLATE_KEYS.includes(key)) continue;
            const v = getPath(stored, key);
            if (v !== undefined) assert.deepEqual(tab.getControlValue(key), v, key);
        }
    });
});
