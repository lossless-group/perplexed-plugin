import { Plugin } from 'obsidian';
import { PerplexedSettings, DEFAULT_SETTINGS } from '../settings/PerplexedSettings';
import { PerplexedSettingTab } from '../settings/PerplexedSettingTab';
import { LMStudioSettings, DEFAULT_LMSTUDIO_SETTINGS } from '../settings/LMStudioSettings';

export class PerplexedPluginCore extends Plugin {
    settings: PerplexedSettings = { ...DEFAULT_SETTINGS };
    lmStudioSettings: LMStudioSettings = { ...DEFAULT_LMSTUDIO_SETTINGS };

    async onload(): Promise<void> {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
        
        // Register commands and other plugin initialization
        this.registerCommands();
    }

    async loadSettings(): Promise<void> {
        try {
            // Load main settings
            const loadedSettings = await this.loadData();
            if (loadedSettings) {
                this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
            }
            
            // Load LM Studio settings
            const loadedLMStudioSettings = await this.loadData('lmstudio-settings');
            if (loadedLMStudioSettings) {
                this.lmStudioSettings = { 
                    ...DEFAULT_LMSTUDIO_SETTINGS, 
                    ...loadedLMStudioSettings 
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings(): Promise<void> {
        try {
            // Save main settings
            await this.saveData(this.settings);
            
            // Save LM Studio settings with a separate key
            await this.saveData(this.lmStudioSettings, 'lmstudio-settings');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    protected registerCommands(): void {
        // Base implementation - can be overridden by child classes
    }
    
    protected setupUI(): void {
        // Base implementation - can be overridden by child classes
    }    private registerCommands() {
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
