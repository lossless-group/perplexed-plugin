import { App, Plugin, PluginSettingTab } from 'obsidian';
import { PerplexedSettings, DEFAULT_SETTINGS } from '../settings/PerplexedSettings';
import { PerplexedSettingTab } from '../settings/PerplexedSettingTab';

export default class PerplexedPlugin extends Plugin {
    settings: PerplexedSettings;
    
    async onload() {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
    }
    
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
    
    updateStatusBar(): void {
        // Implementation for status bar updates
        console.log('Status bar updated');
    }
}
