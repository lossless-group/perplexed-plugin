// Loads main.ts's plugin class against the obsidian stub, whose
// addSettingTab() calls getSettingDefinitions() as Obsidian 1.13+ does, and
// asserts onload() completes and registers every command. A settings tab
// that throws while building its definitions would abort onload() here,
// the way it would inside Obsidian.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PerplexedPlugin from '../main';
import { DEFAULT_SETTINGS } from '../src/settings/PerplexedSettings';
import { liveShapedData } from './fixtures/live-data-shape';

interface StubPlugin {
    commands: { id: string; name: string }[];
    settingTabs: { settingItems: unknown[] }[];
    storedData: unknown;
    settings: Record<string, unknown>;
    onload(): Promise<void>;
}

// Every command ID main.ts registers as of 0.3.1. IDs are what user
// hotkeys bind to, so they must not change.
const COMMAND_IDS = [
    // Perplexica / Vane
    'update-perplexica-url',
    'show-perplexica-settings',
    'ask-perplexica',
    // Perplexity
    'update-perplexity-url',
    'show-perplexity-settings',
    'ask-perplexity',
    'perplexity-service-status',
    // LM Studio
    'update-lmstudio-url',
    'show-lmstudio-settings',
    'ask-lmstudio',
    // Claude, Gemini
    'ask-claude',
    'claude-service-status',
    'ask-gemini',
    'gemini-service-status',
    // Article generator, text enhancement
    'generate-article',
    'enhance-text',
    'enhance-text-with-images',
    // Maintenance
    'debug-status',
    'reset-prompts',
    'reinitialize-services',
    // Directory templates, Exa, vault linking, images
    'apply-directory-template-to-current-file',
    'apply-directory-template-to-folder',
    'stop-directory-template-batch',
    'exa-service-status',
    'link-back-to-vault-notes',
    'find-images-for-selection',
];

function makePlugin(storedData: unknown = null): StubPlugin {
    const app = { workspace: {}, vault: {}, metadataCache: {}, fileManager: {} };
    const manifest = { id: 'perplexed', name: 'Perplexed', version: '0.0.0' };
    const Ctor = PerplexedPlugin as unknown as new (app: unknown, manifest: unknown) => StubPlugin;
    const plugin = new Ctor(app, manifest);
    plugin.storedData = storedData;
    return plugin;
}

// onload() logs progress with console.debug and reports the (expected)
// template-seeding failure against the stub vault with console.error.
// Silence both so test output stays readable; nothing asserted relies on them.
const quiet = { debug: console.debug, error: console.error };
before(() => { console.debug = () => {}; console.error = () => {}; });
after(() => { console.debug = quiet.debug; console.error = quiet.error; });

describe('plugin onload()', () => {
    test('registers every command, with no duplicates', async () => {
        const plugin = makePlugin();
        await plugin.onload();
        const ids = plugin.commands.map(c => c.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate command IDs');
        assert.deepEqual([...ids].sort(), [...COMMAND_IDS].sort());
        for (const c of plugin.commands) assert.ok(c.name.trim(), `command ${c.id} has no name`);
    });

    test('adds the settings tab, and its definitions build during addSettingTab()', async () => {
        const plugin = makePlugin();
        await plugin.onload();
        assert.equal(plugin.settingTabs.length, 1);
        assert.ok(plugin.settingTabs[0]!.settingItems.length > 0, 'settings tab produced no definitions');
    });

    test('loads with no data.json: settings equal the defaults', async () => {
        const plugin = makePlugin(null);
        await plugin.onload();
        assert.deepEqual(plugin.settings, DEFAULT_SETTINGS);
    });

    test('loads a data.json shaped like the live vault and keeps every stored key', async () => {
        const stored = liveShapedData();
        const plugin = makePlugin(stored);
        await plugin.onload();
        assert.equal(plugin.commands.length, COMMAND_IDS.length);
        for (const [key, value] of Object.entries(stored)) {
            assert.deepEqual(plugin.settings[key], value, `stored key ${key} was not kept`);
        }
        // Keys the live file predates come from the defaults.
        assert.equal(plugin.settings.exaEnabled, DEFAULT_SETTINGS.exaEnabled);
        assert.equal(plugin.settings.directoryTemplatesHistoryRoot, DEFAULT_SETTINGS.directoryTemplatesHistoryRoot);
    });
});
