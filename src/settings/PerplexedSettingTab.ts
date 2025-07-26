import { App, PluginSettingTab, Setting } from 'obsidian';
import { PerplexedPluginCore } from '../core/PerplexedPluginCore';

export class PerplexedSettingTab extends PluginSettingTab {
    plugin: PerplexedPluginCore;

    constructor(app: App, plugin: PerplexedPluginCore) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Perplexed Plugin Settings' });

        // Add general settings section
        this.addGeneralSettings(containerEl);
        
        // Add Perplexity settings section
        this.addPerplexitySettings(containerEl);
        
        // Add LM Studio settings section
        this.addLMStudioSettings(containerEl);
    }

    private addGeneralSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'General Settings' });
        
        new Setting(containerEl)
            .setName('Status Bar Position')
            .setDesc('Position of the status bar item')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('left', 'Left')
                    .addOption('right', 'Right')
                    .setValue(this.plugin.settings.statusBarPosition || 'left')
                    .onChange(async (value: string) => {
                        if (value === 'left' || value === 'right') {
                            this.plugin.settings.statusBarPosition = value;
                            await this.plugin.saveSettings();
                        }
                    });
                return dropdown;
            });
    }

    private addPerplexitySettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Perplexity Settings' });
        
        new Setting(containerEl)
            .setName('Enable Perplexity')
            .setDesc('Enable or disable the Perplexity provider')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePerplexity || false)
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
                    .setValue(this.plugin.settings.perplexitySettings?.apiKey || '')
                    .onChange(async (value) => {
                        if (!this.plugin.settings.perplexitySettings) {
                            this.plugin.settings.perplexitySettings = {} as any;
                        }
                        this.plugin.settings.perplexitySettings.apiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }

    private addLMStudioSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'LM Studio Settings' });
        
        new Setting(containerEl)
            .setName('Enable LM Studio')
            .setDesc('Enable or disable the LM Studio provider')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLMStudio || false)
                .onChange(async (value) => {
                    this.plugin.settings.enableLMStudio = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings view
                }));
                
        if (this.plugin.settings.enableLMStudio) {
            new Setting(containerEl)
                .setName('LM Studio Endpoint')
                .setDesc('The URL of your LM Studio server')
                .addText(text => text
                    .setPlaceholder('http://localhost:1234')
                    .setValue(this.plugin.settings.lmStudioSettings?.endpoint || '')
                    .onChange(async (value) => {
                        this.plugin.settings.lmStudioSettings = this.plugin.settings.lmStudioSettings || {} as any;
                        this.plugin.settings.lmStudioSettings.endpoint = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
