import { App, PluginSettingTab, Setting } from 'obsidian';
import PerplexedPlugin from '../../main';

export interface PerplexedSettings {
    // General Settings
    mySetting: string;
    localLLMPath: string;
    
    // Perplexity Settings
    perplexityApiKey: string;
    perplexityEndpoint: string;
    
    // LM Studio Settings
    lmStudioEndpoint: string;
    defaultLMStudioModel: string;
    
    // Default Models and Modes
    defaultModel: string;
    defaultOptimizationMode: string;
    defaultFocusMode: string;
    
    // Prompts
    prompts: {
        // System Prompts
        perplexitySystemPrompt: string;
        lmStudioDefaultSystemPrompt: string;
        
        // Placeholders
        perplexityQueryPlaceholder: string;
        lmStudioQueryPlaceholder: string;
    };
}

export const DEFAULT_SETTINGS: PerplexedSettings = {
    mySetting: 'default',
    localLLMPath: 'http://host.docker.internal:3030/api/search',
    
    // Perplexity Defaults
    perplexityApiKey: '',
    perplexityEndpoint: 'https://api.perplexity.ai',
    
    // LM Studio Defaults
    lmStudioEndpoint: 'http://localhost:1234',
    defaultLMStudioModel: 'ibm/granite-3.2-8b',
    
    // Default Models and Modes
    defaultModel: 'sonar-medium-online',
    defaultOptimizationMode: 'balanced',
    defaultFocusMode: 'search',
    
    // Default Prompts
    prompts: {
        perplexitySystemPrompt: 'You are a helpful AI assistant that provides accurate and concise responses.',
        lmStudioDefaultSystemPrompt: 'You are a helpful AI assistant running locally.',
        
        perplexityQueryPlaceholder: 'Ask me anything...',
        lmStudioQueryPlaceholder: 'Ask me anything...',
    }
};

export class PerplexedSettingTab extends PluginSettingTab {
    plugin: PerplexedPlugin;

    constructor(app: App, plugin: PerplexedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Perplexed Plugin Settings' });
        
        this.addGeneralSettings(containerEl);
        this.addPerplexitySettings(containerEl);
        this.addLMStudioSettings(containerEl);
    }

    private addGeneralSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'General Settings' });
        
        new Setting(containerEl)
            .setName('Local LLM Path')
            .setDesc('Path to your local LLM API endpoint')
            .addText(text => text
                .setPlaceholder('http://localhost:3030/api/search')
                .setValue(this.plugin.settings.localLLMPath)
                .onChange(async (value) => {
                    this.plugin.settings.localLLMPath = value;
                    await this.plugin.saveSettings();
                }));
    }

    private addPerplexitySettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Perplexity Settings' });
        
        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your Perplexity API key')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.perplexityApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.perplexityApiKey = value;
                    await this.plugin.saveSettings();
                }));
    }

    private addLMStudioSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'LM Studio Settings' });
        
        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('LM Studio API endpoint (e.g., http://localhost:1234)')
            .addText(text => text
                .setValue(this.plugin.settings.lmStudioEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.lmStudioEndpoint = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model to use with LM Studio')
            .addText(text => text
                .setValue(this.plugin.settings.defaultLMStudioModel)
                .onChange(async (value) => {
                    this.plugin.settings.defaultLMStudioModel = value;
                    await this.plugin.saveSettings();
                }));
    }
}
