import { App, Plugin } from 'obsidian';
import { PerplexedSettings, DEFAULT_SETTINGS } from '../settings/PerplexedSettings';
import { PerplexedSettingTab } from '../settings/PerplexedSettings';
import { LMStudioSettings, DEFAULT_LMSTUDIO_SETTINGS } from '../settings/LMStudioSettings';

export default class PerplexedPluginCore extends Plugin {
    settings: PerplexedSettings;
    lmStudioSettings: LMStudioSettings;

    async onload() {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
        
        // Register commands and other plugin initialization
        this.registerCommands();
    }

    async loadSettings() {
        // Load main settings
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // Load LM Studio settings
        this.lmStudioSettings = Object.assign(
            {}, 
            DEFAULT_LMSTUDIO_SETTINGS, 
            await this.loadData()
        );
        
        // Save any defaults that were missing
        await this.saveSettings();
    }

    async saveSettings() {
        // Save main settings
        await this.saveData(this.settings);
        
        // Save LM Studio settings
        await this.saveData(this.lmStudioSettings);
    }

    private registerCommands() {
        // Register your commands here
        // Example:
        this.addCommand({
            id: 'perplexed-query',
            name: 'Query Perplexed',
            callback: () => {
                // Command implementation
            }
        });
    }
}
