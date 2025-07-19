import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: `${process.cwd()}/.env` });

interface PerplexedPluginSettings {
    mySetting: string;
    localLLMPath: string;
    requestBodyTemplate: string;
    perplexityRequestTemplate: string;
    perplexityApiKey: string;
    perplexicaEndpoint: string;
    perplexityEndpoint: string;
    defaultModel: string;
    defaultOptimizationMode: string;
    defaultFocusMode: string;
}

const DEFAULT_SETTINGS: PerplexedPluginSettings = {
    mySetting: 'default',
    // Use host.docker.internal to connect to the host machine from Docker containers
    localLLMPath: 'http://host.docker.internal:3030/api/search',
    perplexicaEndpoint: 'http://localhost:3030/api/search',
    perplexityEndpoint: 'https://api.perplexity.ai/chat/completions',
    requestBodyTemplate: `{
  "chatModel": {
    "provider": "ollama",
    "name": "llama3.2:latest"
  },
  "embeddingModel": {
    "provider": "ollama",
    "name": "llama3.2:latest"
  },
  "optimizationMode": "speed",
  "focusMode": "webSearch",
  "query": "What is Perplexica's architecture?",
  "history": [
    {
      "role": "user",
      "content": "What is Perplexica's architecture?"
    }
  ],
  "systemInstructions": "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
  "stream": false,
  "maxTokens": 2048,
  "temperature": 0.7
}`,
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
    perplexityRequestTemplate: `{
  "model": "llama-3.1-sonar-small-128k-online",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI assistant. Provide clear, concise, and accurate information with proper citations."
    },
    {
      "role": "user",
      "content": "What is Perplexity AI's approach to search?"
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7,
  "top_p": 0.9,
  "return_citations": true,
  "search_domain_filter": [],
  "return_images": false,
  "return_related_questions": false,
  "search_recency_filter": "month",
  "top_k": 0,
  "stream": false,
  "presence_penalty": 0,
  "frequency_penalty": 1
}`,
    defaultModel: 'llama3.2:latest',
    defaultOptimizationMode: 'speed',
    defaultFocusMode: 'webSearch'
};

export default class PerplexedPlugin extends Plugin {
    public settings: PerplexedPluginSettings = DEFAULT_SETTINGS;
    private statusBarItemEl: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();
        
        // Debug: Log current settings
        console.log('Current Perplexica Path:', this.settings.perplexicaEndpoint);
        console.log('Full settings:', JSON.stringify(this.settings, null, 2));

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
        
        // Register commands
        this.registerPerplexicaCommands();
        this.registerPerplexityCommands();
    }

    onunload(): void {
        this.statusBarItemEl?.remove();
        this.ribbonIconEl?.remove();
    }

    private async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveSettings(): Promise<void> {
        try {
            await this.saveData(this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
            new Notice('Failed to save settings');
        }
    }

    private registerPerplexicaCommands(): void {
        // Command to update Perplexica URL
        this.addCommand({
            id: 'update-perplexica-url',
            name: 'Update Perplexica URL',
            callback: () => {
                const modal = new (class extends Modal {
                    private urlInput!: HTMLInputElement;

                    constructor(app: App, private plugin: PerplexedPlugin) {
                        super(app);
                    }
                    
                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Update Perplexica API URL'});
                        
                        const form = contentEl.createEl('form');
                        const div = form.createDiv({cls: 'setting-item'});
                        
                        div.createEl('label', {
                            text: 'Perplexica API URL',
                            attr: {for: 'perplexica-url-input'}
                        });
                        
                        this.urlInput = div.createEl('input', {
                            type: 'text',
                            value: this.plugin.settings.perplexicaEndpoint,
                            cls: 'text-input',
                            attr: {id: 'perplexica-url-input'}
                        });
                        
                        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
                        const saveButton = buttonDiv.createEl('button', {
                            text: 'Save',
                            cls: 'mod-cta'
                        });
                        
                        form.onsubmit = (e) => {
                            e.preventDefault();
                            this.onSubmit();
                        };
                        
                        saveButton.onclick = () => this.onSubmit();
                    }
                    
                    onSubmit() {
                        const newUrl = this.urlInput.value.trim();
                        if (newUrl) {
                            this.plugin.settings.perplexicaEndpoint = newUrl;
                            this.plugin.saveSettings();
                            new Notice(`Perplexica URL updated to: ${newUrl}`);
                            this.close();
                        }
                    }
                    
                    onClose() {
                        const {contentEl} = this;
                        contentEl.empty();
                    }
                })(this.app, this);
                
                modal.open();
            }
        });
        
        // Command to show current settings
        this.addCommand({
            id: 'show-perplexica-settings',
            name: 'Show Perplexica Settings',
            callback: () => {
                new Notice(`Current Perplexica URL: ${this.settings.perplexicaEndpoint}`);
                console.log('Perplexica Settings:', this.settings);
            }
        });

        // Command to insert Perplexica request template
        this.addCommand({
            id: 'insert-perplexica-template',
            name: 'Insert Perplexica Request Template',
            editorCallback: (editor: Editor) => {
                const template = this.settings.requestBodyTemplate;
                editor.replaceSelection(
                    '```json\n' + 
                    template + '\n' +
                    '```'
                );
            }
        });
    }

    private registerPerplexityCommands(): void {
        // Command to update Perplexity URL
        this.addCommand({
            id: 'update-perplexity-url',
            name: 'Update Perplexity URL',
            callback: () => {
                const modal = new (class extends Modal {
                    private urlInput!: HTMLInputElement;

                    constructor(app: App, private plugin: PerplexedPlugin) {
                        super(app);
                    }

                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Update Perplexity API URL'});
                        const form = contentEl.createEl('form');
                        const div = form.createDiv({cls: 'setting-item'});

                        div.createEl('label', {
                            text: 'Perplexity API URL',
                            attr: {for: 'perplexity-url-input'}
                        });

                        this.urlInput = div.createEl('input', {
                            type: 'text',
                            value: this.plugin.settings.perplexityEndpoint,
                            cls: 'text-input',
                            attr: {id: 'perplexity-url-input'}
                        });

                        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
                        const saveButton = buttonDiv.createEl('button', {
                            text: 'Save',
                            cls: 'mod-cta'
                        });

                        form.onsubmit = (e) => {
                            e.preventDefault();
                            this.onSubmit();
                        };

                        saveButton.onclick = () => this.onSubmit();
                    }

                    onSubmit() {
                        const newUrl = this.urlInput.value.trim();
                        if (newUrl) {
                            this.plugin.settings.perplexityEndpoint = newUrl;
                            this.plugin.saveSettings();
                            new Notice(`Perplexity URL updated to: ${newUrl}`);
                            this.close();
                        }
                    }

                    onClose() {
                        const {contentEl} = this;
                        contentEl.empty();
                    }
                })(this.app, this);

                modal.open();
            }
        });

        // Command to show current Perplexity settings
        this.addCommand({
            id: 'show-perplexity-settings',
            name: 'Show Perplexity Settings',
            callback: () => {
                new Notice(`Current Perplexity URL: ${this.settings.perplexityEndpoint}`);
                console.log('Perplexity Settings:', this.settings);
            }
        });

        // Command to insert Perplexity request template
        this.addCommand({
            id: 'insert-perplexity-template',
            name: 'Insert Perplexity Request Template',
            editorCallback: (editor: Editor) => {
                const template = this.settings.perplexityRequestTemplate;
                editor.replaceSelection(
                    '```json\n' +
                    template + '\n' +
                    '```'
                );
            }
        });
    }
}

class PerplexedSettingTab extends PluginSettingTab {
    plugin: PerplexedPlugin;

    constructor(app: App, plugin: PerplexedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Perplexed Plugin Settings' });

        // Perplexity Section
        containerEl.createEl('h3', { text: 'Perplexity (Remote Service)' });
        containerEl.createEl('p', {
            text: 'Configure settings for the hosted Perplexity AI service',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('API endpoint for Perplexity service')
            .addText(text => text
                .setPlaceholder('https://api.perplexity.ai/chat/completions')
                .setValue(this.plugin.settings.perplexityEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.perplexityEndpoint = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your Perplexity API key (required for remote service)')
            .addText(text => text
                .setPlaceholder('pplx-xxxxxxxxxxxxxxxxxxxxx')
                .setValue(this.plugin.settings.perplexityApiKey)
                .onChange(async (value: string) => {
                    this.plugin.settings.perplexityApiKey = value;
                    await this.plugin.saveSettings();
                })
            );

        // Perplexica Section
        containerEl.createEl('h3', { text: 'Perplexica (Self-Hosted)' });
        containerEl.createEl('p', {
            text: 'Configure settings for your local Perplexica installation',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('API endpoint for your local Perplexica instance')
            .addText(text => text
                .setPlaceholder('http://localhost:3030/api/search')
                .setValue(this.plugin.settings.perplexicaEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.perplexicaEndpoint = value;
                    await this.plugin.saveSettings();
                })
            );
        
        new Setting(containerEl)
            .setName('Fallback Container Path')
            .setDesc('Alternative endpoint for Docker container setups')
            .addText(text => text
                .setPlaceholder('http://host.docker.internal:3030/api/search')
                .setValue(this.plugin.settings.localLLMPath)
                .onChange(async (value: string) => {
                    this.plugin.settings.localLLMPath = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default AI model for Perplexica to use')
            .addText(text => text
                .setPlaceholder('llama3.2:latest')
                .setValue(this.plugin.settings.defaultModel)
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                })
            );

        // Perplexity Request Template
        const perplexityJsonSetting = new Setting(containerEl)
            .setName('Request Body Template')
            .setDesc('JSON template for Perplexity API requests');
            
        // Create a textarea element for Perplexity
        const perplexityTextArea = document.createElement('textarea');
        perplexityTextArea.rows = 10;
        perplexityTextArea.cols = 50;
        perplexityTextArea.style.width = '100%';
        perplexityTextArea.style.minHeight = '300px';
        perplexityTextArea.style.fontFamily = 'monospace';
        perplexityTextArea.placeholder = 'Enter Perplexity JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.perplexityRequestTemplate) {
            try {
                const config = JSON.parse(this.plugin.settings.perplexityRequestTemplate);
                perplexityTextArea.value = JSON.stringify(config, null, 2);
            } catch (e) {
                // If not valid JSON, use as is
                perplexityTextArea.value = this.plugin.settings.perplexityRequestTemplate;
            }
        }
        
        // Add input event listener for Perplexity
        perplexityTextArea.addEventListener('input', async () => {
            this.plugin.settings.perplexityRequestTemplate = perplexityTextArea.value;
            await this.plugin.saveSettings();
        });
        
        // Add the textarea to the setting
        perplexityJsonSetting.settingEl.appendChild(perplexityTextArea);

        // Perplexica Request Template
        const perplexicaJsonSetting = new Setting(containerEl)
            .setName('Request Body Template')
            .setDesc('JSON template for Perplexica API requests');
            
        // Create a textarea element for Perplexica
        const perplexicaTextArea = document.createElement('textarea');
        perplexicaTextArea.rows = 10;
        perplexicaTextArea.cols = 50;
        perplexicaTextArea.style.width = '100%';
        perplexicaTextArea.style.minHeight = '300px';
        perplexicaTextArea.style.fontFamily = 'monospace';
        perplexicaTextArea.placeholder = 'Enter Perplexica JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.requestBodyTemplate) {
            try {
                const config = JSON.parse(this.plugin.settings.requestBodyTemplate);
                perplexicaTextArea.value = JSON.stringify(config, null, 2);
            } catch (e) {
                // If not valid JSON, use as is
                perplexicaTextArea.value = this.plugin.settings.requestBodyTemplate;
            }
        }
        
        // Add input event listener for Perplexica
        perplexicaTextArea.addEventListener('input', async () => {
            this.plugin.settings.requestBodyTemplate = perplexicaTextArea.value;
            await this.plugin.saveSettings();
        });
        
        // Add the textarea to the setting
        perplexicaJsonSetting.settingEl.appendChild(perplexicaTextArea);
    }
}
