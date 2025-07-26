import { App, PluginSettingTab, Setting } from 'obsidian';
import PerplexedPlugin from '../../main';
import { PerplexitySettings, DEFAULT_PERPLEXITY_SETTINGS } from './PerplexitySettings';

export interface PerplexedSettings {
    // General settings
    enablePerplexity: boolean;
    enablePerplexica: boolean;
    enableLMStudio: boolean;
    defaultProvider: 'perplexity' | 'perplexica' | 'lmstudio';
    
    // UI Settings
    showStatusBar: boolean;
    statusBarPosition: 'left' | 'right';
    statusBarPriority: number;
    
    // Prompt settings
    defaultSystemPrompt: string;
    customPrompts: Record<string, string>;
    
    // Service-specific settings
    perplexitySettings: PerplexitySettings;
    
    // LM Studio specific settings
    lmStudioSettings: {
        endpoint: string;
        model: string;
        temperature: number;
        maxTokens: number;
    };
    
    // Perplexica specific settings
    perplexicaSettings: {
        endpoint: string;
        apiKey: string;
        model: string;
    };
}

export const DEFAULT_SETTINGS: PerplexedSettings = {
    // General settings
    enablePerplexity: true,
    enablePerplexica: false,
    enableLMStudio: false,
    defaultProvider: 'perplexity',
    
    // UI Settings
    showStatusBar: true,
    statusBarPosition: 'left',
    statusBarPriority: 100,
    
    // Prompt settings
    defaultSystemPrompt: 'You are a helpful AI assistant.',
    customPrompts: {},
    
    // Perplexity settings
    perplexitySettings: {
        ...DEFAULT_PERPLEXITY_SETTINGS
    },
    
    // LM Studio settings
    lmStudioSettings: {
        endpoint: 'http://localhost:1234',
        model: 'lm-studio',
        temperature: 0.7,
        maxTokens: 2000
    },
    
    // Perplexica settings
    perplexicaSettings: {
        endpoint: 'https://api.perplexica.com',
        apiKey: '',
        model: 'perplexica'
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
            .setName('Default Provider')
            .setDesc('Select the default AI provider to use')
            .addDropdown(dropdown => dropdown
                .addOption('perplexity', 'Perplexity')
                .addOption('perplexica', 'Perplexica')
                .addOption('lmstudio', 'LM Studio')
                .setValue(this.plugin.settings.defaultProvider)
                .onChange(async (value: 'perplexity' | 'perplexica' | 'lmstudio') => {
                    this.plugin.settings.defaultProvider = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Show Status Bar')
            .setDesc('Toggle the status bar visibility')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.showStatusBar = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStatusBar();
                }));
                
        new Setting(containerEl)
            .setName('Status Bar Position')
            .setDesc('Position of the status bar item')
            .addDropdown(dropdown => dropdown
                .addOption('left', 'Left')
                .addOption('right', 'Right')
                .setValue(this.plugin.settings.statusBarPosition)
                .onChange(async (value: 'left' | 'right') => {
                    this.plugin.settings.statusBarPosition = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStatusBar();
                }));
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
            .setName('Enable Perplexity')
            .setDesc('Enable or disable the Perplexity provider')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePerplexity)
                .onChange(async (value) => {
                    this.plugin.settings.enablePerplexity = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings view
                }));
                
        if (this.plugin.settings.enablePerplexity) {
            new Setting(containerEl)
                .setName('API Key')
                .setDesc('Your Perplexity API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.plugin.settings.perplexitySettings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.apiKey = value;
                        await this.plugin.saveSettings();
                    }));
                    
            new Setting(containerEl)
                .setName('Default Model')
                .setDesc('Default model to use for Perplexity')
                .addText(text => text
                    .setPlaceholder('pplx-7b-chat')
                    .setValue(this.plugin.settings.perplexitySettings.defaultModel)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.defaultModel = value;
                        await this.plugin.saveSettings();
                    }));
                    
            new Setting(containerEl)
                .setName('Endpoint')
                .setDesc('API endpoint for Perplexity')
                .addText(text => text
                    .setPlaceholder('https://api.perplexity.ai')
                    .setValue(this.plugin.settings.perplexitySettings.endpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.endpoint = value;
                        await this.plugin.saveSettings();
                    }));
                    
            new Setting(containerEl)
                .setName('Temperature')
                .setDesc('Controls randomness (0.0 to 2.0)')
                .addSlider(slider => slider
                    .setLimits(0, 2, 0.1)
                    .setValue(this.plugin.settings.perplexitySettings.temperature)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.temperature = value;
                        await this.plugin.saveSettings();
                    })
                    .setDynamicTooltip()
                );
                
            new Setting(containerEl)
                .setName('Max Tokens')
                .setDesc('Maximum number of tokens to generate')
                .addText(text => text
                    .setPlaceholder('2048')
                    .setValue(this.plugin.settings.perplexitySettings.maxTokens?.toString() || '2048')
                    .onChange(async (value) => {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                            this.plugin.settings.perplexitySettings.maxTokens = numValue;
                            await this.plugin.saveSettings();
                        }
                    }));
                    
            new Setting(containerEl)
                .setName('Top P')
                .setDesc('Controls diversity via nucleus sampling (0.0 to 1.0)')
                .addSlider(slider => slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.perplexitySettings.topP)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.topP = value;
                        await this.plugin.saveSettings();
                    })
                    .setDynamicTooltip()
                );
                
            new Setting(containerEl)
                .setName('Frequency Penalty')
                .setDesc('Penalize new tokens based on their frequency (-2.0 to 2.0)')
                .addSlider(slider => slider
                    .setLimits(-2, 2, 0.1)
                    .setValue(this.plugin.settings.perplexitySettings.frequencyPenalty)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.frequencyPenalty = value;
                        await this.plugin.saveSettings();
                    })
                    .setDynamicTooltip()
                );
                
            new Setting(containerEl)
                .setName('Presence Penalty')
                .setDesc('Penalize new tokens based on their presence (-2.0 to 2.0)')
                .addSlider(slider => slider
                    .setLimits(-2, 2, 0.1)
                    .setValue(this.plugin.settings.perplexitySettings.presencePenalty)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexitySettings.presencePenalty = value;
                        await this.plugin.saveSettings();
                    })
                    .setDynamicTooltip()
                );
        }
    }

    private addLMStudioSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'LM Studio Settings' });
        
        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('LM Studio API endpoint (e.g., http://localhost:1234)')
            .addText(text => text
                .setValue(this.plugin.settings.lmStudioSettings.endpoint)
                .onChange(async (value) => {
                    this.plugin.settings.lmStudioSettings.endpoint = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model to use with LM Studio')
            .addText(text => text
                .setValue(this.plugin.settings.lmStudioSettings.model)
                .onChange(async (value) => {
                    this.plugin.settings.lmStudioSettings.model = value;
                    await this.plugin.saveSettings();
                }));
    }
}
