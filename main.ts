import { App, Editor, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as dotenv from 'dotenv';

// Import services
import { PerplexityService } from './src/services/perplexityService';
import { PerplexicaService } from './src/services/perplexicaService';
import { LMStudioService } from './src/services/lmStudioService';
import { PromptsService } from './src/services/promptsService';

// Import modals
import { PerplexityModal } from './src/modals/PerplexityModal';
import { PerplexicaModal } from './src/modals/PerplexicaModal';
import { LMStudioModal } from './src/modals/LMStudioModal';
import { URLUpdateModal } from './src/modals/URLUpdateModal';
import { ArticleGeneratorModal } from './src/modals/ArticleGeneratorModal';

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
    lmStudioEndpoint: string;
    lmStudioRequestTemplate: string;
    defaultModel: string;
    defaultOptimizationMode: string;
    defaultFocusMode: string;
    defaultLMStudioModel: string;
    
    // Prompt Settings
    prompts: {
        // System prompts
        perplexitySystemPrompt: string;
        perplexicaSystemPrompt: string;
        lmStudioDefaultSystemPrompt: string;
        
        // Placeholder text
        perplexityQueryPlaceholder: string;
        perplexicaQueryPlaceholder: string;
        lmStudioQueryPlaceholder: string;
        lmStudioSystemPromptPlaceholder: string;
        articleTermPlaceholder: string;
        
        // Descriptions and labels
        deepResearchDescription: string;
        imagesToggleDescription: string;
        imagesToggleGenericDescription: string;
        articleTermDescription: string;
        
        // Notices and messages
        deepResearchLoadingNotice: string;
        enterQuestionNotice: string;
        enterTermNotice: string;
        
        // Article generator template
        articleGeneratorTemplate: string;
        
        // Image prompts
        imageReferencesPrompt: string;
    };
}

const DEFAULT_SETTINGS: PerplexedPluginSettings = {
    mySetting: 'default',
    // Use host.docker.internal to connect to the host machine from Docker containers
    localLLMPath: 'http://host.docker.internal:3030/api/search',
    perplexicaEndpoint: 'http://localhost:3030/api/search',
    perplexityEndpoint: 'https://api.perplexity.ai/chat/completions',
    lmStudioEndpoint: 'http://localhost:1234/v1/chat/completions',
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
  "systemInstructions": "{{PERPLEXICA_SYSTEM_PROMPT}}",
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
      "content": "{{PERPLEXITY_SYSTEM_PROMPT}}"
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
    lmStudioRequestTemplate: `{
  "model": "ibm/granite-3.2-8b",
  "messages": [
    {
      "role": "user",
      "content": "Hello, can you help me with this question?"
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7,
  "stream": false
}`,
    defaultModel: 'llama3.2:latest',
    defaultOptimizationMode: 'speed',
    defaultFocusMode: 'webSearch',
    defaultLMStudioModel: 'ibm/granite-3.2-8b',
    
    // Prompt Settings
    prompts: {
        // System prompts
        perplexitySystemPrompt: "You are a helpful AI assistant. Provide clear, concise, and accurate information with proper citations.",
        perplexicaSystemPrompt: "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
        lmStudioDefaultSystemPrompt: "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
        
        // Placeholder text
        perplexityQueryPlaceholder: "What would you like to ask Perplexity?",
        perplexicaQueryPlaceholder: "What would you like to ask Perplexica?",
        lmStudioQueryPlaceholder: "What would you like to ask?",
        lmStudioSystemPromptPlaceholder: "You are a helpful AI assistant...",
        articleTermPlaceholder: "e.g., AI Copilots, AI Studios, Machine Learning, etc.",
        
        // Descriptions and labels
        deepResearchDescription: "⚡ Deep Research: Exhaustive research across hundreds of sources with expert-level analysis. Higher cost but comprehensive results. Note: Streaming is disabled for this model.",
        imagesToggleDescription: "Include image results from search - images will be integrated throughout the response where appropriate",
        imagesToggleGenericDescription: "Include image references throughout the response where appropriate",
        articleTermDescription: "Enter a vocabulary term to generate a comprehensive one-page article with images.",
        
        // Notices and messages
        deepResearchLoadingNotice: "🔍 Deep research in progress... This may take up to 60 seconds.",
        enterQuestionNotice: "Please enter a question",
        enterTermNotice: "Please enter a vocabulary term",
        
        // Article generator template
        articleGeneratorTemplate: `Write a comprehensive one-page article about "{TERM}". 

Structure the article as follows:

1. **Introduction** (2-3 sentences)
   - Define the term and its significance
   - Provide context for why it matters

2. **Main Content** (3-4 paragraphs)
   - Explain the concept in detail
   - Include practical examples and use cases
   - Discuss benefits and potential applications
   - Address any challenges or considerations

3. **Current State and Trends** (1-2 paragraphs)
   - Discuss current adoption and market status
   - Mention key players or technologies
   - Highlight recent developments

4. **Future Outlook** (1 paragraph)
   - Predict future developments
   - Discuss potential impact

5. **Conclusion** (1-2 sentences)
   - Summarize key points
   - End with a forward-looking statement

**Important Guidelines:**
- Keep the total length to approximately one page (500-800 words)
- Use clear, accessible language
- Include specific examples and real-world applications
- Make it engaging and informative for a general audience
- Use markdown formatting for structure

**Image References:**
Include [IMAGE 1: {TERM} concept diagram or illustration] after the introduction.
Include [IMAGE 2: {TERM} practical example or use case] after the main content section.
Include [IMAGE 3: {TERM} future trends or technology visualization] before the conclusion.

Replace "{TERM}" with the actual vocabulary term in the prompt.`,
        
        // Image prompts
        imageReferencesPrompt: "**Image References:**\nPlease include the following image references throughout your response where appropriate:\n- [IMAGE 1: Relevant diagram or illustration related to the topic]\n- [IMAGE 2: Practical example or use case visualization]\n- [IMAGE 3: Additional supporting visual content]"
    }
};

export default class PerplexedPlugin extends Plugin {
    public settings: PerplexedPluginSettings = DEFAULT_SETTINGS;
    private statusBarItemEl: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    
    // Service instances
    private perplexityService!: PerplexityService;
    private perplexicaService!: PerplexicaService;
    private lmStudioService!: LMStudioService;
    private promptsService!: PromptsService;

    async onload(): Promise<void> {
        await this.loadSettings();
        
        // Initialize prompts service
        this.promptsService = new PromptsService(this.settings.prompts);
        
        // Initialize services
        this.perplexityService = new PerplexityService({
            perplexityApiKey: this.settings.perplexityApiKey,
            perplexityEndpoint: this.settings.perplexityEndpoint,
            promptsService: this.promptsService,
            requestTemplate: this.settings.perplexityRequestTemplate
        });
        
        this.perplexicaService = new PerplexicaService({
            perplexicaEndpoint: this.settings.perplexicaEndpoint,
            localLLMPath: this.settings.localLLMPath,
            defaultModel: this.settings.defaultModel,
            promptsService: this.promptsService,
            requestTemplate: this.settings.requestBodyTemplate
        });
        
        this.lmStudioService = new LMStudioService({
            lmStudioEndpoint: this.settings.lmStudioEndpoint,
            promptsService: this.promptsService,
            requestTemplate: this.settings.lmStudioRequestTemplate
        });
        
        // Debug: Log current settings
        console.log('Current Perplexica Path:', this.settings.perplexicaEndpoint);
        console.log('Full settings:', JSON.stringify(this.settings, null, 2));

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
        
        // Register commands
        this.registerPerplexicaCommands();
        this.registerPerplexityCommands();
        this.registerLMStudioCommands();
        this.registerArticleGeneratorCommands();
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

    // Delegate methods to services
    public async queryPerplexity(query: string, model: string, stream: boolean, editor: Editor, options?: {
        return_citations?: boolean;
        return_images?: boolean;
        return_related_questions?: boolean;
        search_recency_filter?: string;
    }): Promise<void> {
        await this.perplexityService.queryPerplexity(query, model, stream, editor, options);
    }

    public async queryPerplexica(query: string, focusMode: string, optimizationMode: string, stream: boolean, editor: Editor, options?: {
        return_images?: boolean;
    }): Promise<void> {
        await this.perplexicaService.queryPerplexica(query, focusMode, optimizationMode, stream, editor, options);
    }

    public async queryLMStudio(query: string, model: string, stream: boolean, editor: Editor, options?: {
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        system_prompt?: string;
        return_images?: boolean;
    }): Promise<void> {
        await this.lmStudioService.queryLMStudio(query, model, stream, editor, options);
    }

    // Getter for prompts service
    public getPromptsService(): PromptsService {
        return this.promptsService;
    }

    private registerPerplexicaCommands(): void {
        // Command to update Perplexica URL
        this.addCommand({
            id: 'update-perplexica-url',
            name: 'Update Perplexica URL',
            callback: () => {
                const modal = new URLUpdateModal(this.app, {
                    title: 'Update Perplexica API URL',
                    label: 'Perplexica API URL',
                    placeholder: 'http://localhost:3030/api/search',
                    currentValue: this.settings.perplexicaEndpoint,
                    onSave: async (newUrl: string) => {
                        this.settings.perplexicaEndpoint = newUrl;
                        await this.saveSettings();
                    }
                });
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

        // Command to ask Perplexica
        this.addCommand({
            id: 'ask-perplexica',
            name: 'Ask Perplexica',
            editorCallback: (editor: Editor) => {
                const modal = new PerplexicaModal(this.app, editor, this.perplexicaService, this.promptsService);
                modal.open();
            }
        });
    }

    private registerPerplexityCommands(): void {
        // Command to update Perplexity URL
        this.addCommand({
            id: 'update-perplexity-url',
            name: 'Update Perplexity URL',
            callback: () => {
                const modal = new URLUpdateModal(this.app, {
                    title: 'Update Perplexity API URL',
                    label: 'Perplexity API URL',
                    placeholder: 'https://api.perplexity.ai/chat/completions',
                    currentValue: this.settings.perplexityEndpoint,
                    onSave: async (newUrl: string) => {
                        this.settings.perplexityEndpoint = newUrl;
                        await this.saveSettings();
                    }
                });
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

        // Command to ask Perplexity
        this.addCommand({
            id: 'ask-perplexity',
            name: 'Ask Perplexity',
            editorCallback: (editor: Editor) => {
                const modal = new PerplexityModal(this.app, editor, this.perplexityService, this.promptsService);
                modal.open();
            }
        });
    }

    private registerLMStudioCommands(): void {
        // Command to update LM Studio URL
        this.addCommand({
            id: 'update-lmstudio-url',
            name: 'Update LM Studio URL',
            callback: () => {
                const modal = new URLUpdateModal(this.app, {
                    title: 'Update LM Studio API URL',
                    label: 'LM Studio API URL',
                    placeholder: 'http://localhost:1234/v1/chat/completions',
                    currentValue: this.settings.lmStudioEndpoint,
                    onSave: async (newUrl: string) => {
                        this.settings.lmStudioEndpoint = newUrl;
                        await this.saveSettings();
                    }
                });
                modal.open();
            }
        });

        // Command to show current LM Studio settings
        this.addCommand({
            id: 'show-lmstudio-settings',
            name: 'Show LM Studio Settings',
            callback: () => {
                new Notice(`Current LM Studio URL: ${this.settings.lmStudioEndpoint}`);
                console.log('LM Studio Settings:', this.settings);
            }
        });

        // Command to ask LM Studio
        this.addCommand({
            id: 'ask-lmstudio',
            name: 'Ask LM Studio',
            editorCallback: (editor: Editor) => {
                const modal = new LMStudioModal(this.app, editor, this.lmStudioService, this.promptsService);
                modal.open();
            }
        });
    }

    private registerArticleGeneratorCommands(): void {
        // Register Article Generator command
        this.addCommand({
            id: 'generate-article',
            name: 'Generate One-Page Article',
            editorCallback: (editor: Editor) => {
                new ArticleGeneratorModal(this.app, editor, this.perplexityService, this.promptsService).open();
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
        const perplexityHeader = containerEl.createEl('h3', { text: 'Perplexity (Remote Service)' });
        perplexityHeader.style.color = 'var(--text-accent)';
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

        // Perplexica Section
        const perplexicaHeader = containerEl.createEl('h3', { text: 'Perplexica (Self-Hosted)' });
        perplexicaHeader.style.color = 'var(--text-accent)';
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

        // LM Studio Section
        const lmStudioHeader = containerEl.createEl('h3', { text: 'LM Studio (Local Models)' });
        lmStudioHeader.style.color = 'var(--text-accent)';
        containerEl.createEl('p', {
            text: 'Configure settings for your local LM Studio installation with loaded models',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('API endpoint for your local LM Studio instance')
            .addText(text => text
                .setPlaceholder('http://localhost:1234/v1/chat/completions')
                .setValue(this.plugin.settings.lmStudioEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.lmStudioEndpoint = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model name for LM Studio to use')
            .addText(text => text
                .setPlaceholder('ibm/granite-3.2-8b')
                .setValue(this.plugin.settings.defaultLMStudioModel)
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultLMStudioModel = value;
                    await this.plugin.saveSettings();
                })
            );

        // LM Studio Request Template
        const lmStudioJsonSetting = new Setting(containerEl)
            .setName('Request Body Template')
            .setDesc('JSON template for LM Studio API requests');
            
        // Create a textarea element for LM Studio
        const lmStudioTextArea = document.createElement('textarea');
        lmStudioTextArea.rows = 10;
        lmStudioTextArea.cols = 50;
        lmStudioTextArea.style.width = '100%';
        lmStudioTextArea.style.minHeight = '300px';
        lmStudioTextArea.style.fontFamily = 'monospace';
        lmStudioTextArea.placeholder = 'Enter LM Studio JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.lmStudioRequestTemplate) {
            try {
                const config = JSON.parse(this.plugin.settings.lmStudioRequestTemplate);
                lmStudioTextArea.value = JSON.stringify(config, null, 2);
            } catch (e) {
                // If not valid JSON, use as is
                lmStudioTextArea.value = this.plugin.settings.lmStudioRequestTemplate;
            }
        }
        
        // Add input event listener for LM Studio
        lmStudioTextArea.addEventListener('input', async () => {
            this.plugin.settings.lmStudioRequestTemplate = lmStudioTextArea.value;
            await this.plugin.saveSettings();
        });
        
        // Add the textarea to the setting
        lmStudioJsonSetting.settingEl.appendChild(lmStudioTextArea);

        // Prompts Section
        const promptsHeader = containerEl.createEl('h3', { text: 'Prompts & Text Configuration' });
        promptsHeader.style.color = 'var(--text-accent)';
        containerEl.createEl('p', {
            text: 'Customize all prompts, placeholders, descriptions, and messages used throughout the plugin',
            cls: 'setting-item-description'
        });

        // System Prompts
        containerEl.createEl('h4', { text: 'System Prompts' });
        
        new Setting(containerEl)
            .setName('Perplexity System Prompt')
            .setDesc('System prompt used for Perplexity AI requests')
            .addTextArea(text => text
                .setPlaceholder('Enter system prompt for Perplexity...')
                .setValue(this.plugin.settings.prompts.perplexitySystemPrompt)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.perplexitySystemPrompt = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Perplexica System Prompt')
            .setDesc('System prompt used for Perplexica requests')
            .addTextArea(text => text
                .setPlaceholder('Enter system prompt for Perplexica...')
                .setValue(this.plugin.settings.prompts.perplexicaSystemPrompt)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.perplexicaSystemPrompt = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('LM Studio Default System Prompt')
            .setDesc('Default system prompt used for LM Studio requests')
            .addTextArea(text => text
                .setPlaceholder('Enter default system prompt for LM Studio...')
                .setValue(this.plugin.settings.prompts.lmStudioDefaultSystemPrompt)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.lmStudioDefaultSystemPrompt = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        // Placeholder Text
        containerEl.createEl('h4', { text: 'Placeholder Text' });
        
        new Setting(containerEl)
            .setName('Perplexity Query Placeholder')
            .setDesc('Placeholder text for Perplexity query input')
            .addText(text => text
                .setPlaceholder('Enter placeholder text...')
                .setValue(this.plugin.settings.prompts.perplexityQueryPlaceholder)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.perplexityQueryPlaceholder = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Perplexica Query Placeholder')
            .setDesc('Placeholder text for Perplexica query input')
            .addText(text => text
                .setPlaceholder('Enter placeholder text...')
                .setValue(this.plugin.settings.prompts.perplexicaQueryPlaceholder)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.perplexicaQueryPlaceholder = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('LM Studio Query Placeholder')
            .setDesc('Placeholder text for LM Studio query input')
            .addText(text => text
                .setPlaceholder('Enter placeholder text...')
                .setValue(this.plugin.settings.prompts.lmStudioQueryPlaceholder)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.lmStudioQueryPlaceholder = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('LM Studio System Prompt Placeholder')
            .setDesc('Placeholder text for LM Studio system prompt input')
            .addText(text => text
                .setPlaceholder('Enter placeholder text...')
                .setValue(this.plugin.settings.prompts.lmStudioSystemPromptPlaceholder)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.lmStudioSystemPromptPlaceholder = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Article Term Placeholder')
            .setDesc('Placeholder text for article generator term input')
            .addText(text => text
                .setPlaceholder('Enter placeholder text...')
                .setValue(this.plugin.settings.prompts.articleTermPlaceholder)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.articleTermPlaceholder = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        // Descriptions and Labels
        containerEl.createEl('h4', { text: 'Descriptions & Labels' });
        
        new Setting(containerEl)
            .setName('Deep Research Description')
            .setDesc('Description shown for deep research model')
            .addTextArea(text => text
                .setPlaceholder('Enter description...')
                .setValue(this.plugin.settings.prompts.deepResearchDescription)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.deepResearchDescription = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Images Toggle Description')
            .setDesc('Description for images toggle in Perplexity modal')
            .addTextArea(text => text
                .setPlaceholder('Enter description...')
                .setValue(this.plugin.settings.prompts.imagesToggleDescription)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.imagesToggleDescription = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Images Toggle Generic Description')
            .setDesc('Generic description for images toggle in other modals')
            .addTextArea(text => text
                .setPlaceholder('Enter description...')
                .setValue(this.plugin.settings.prompts.imagesToggleGenericDescription)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.imagesToggleGenericDescription = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Article Term Description')
            .setDesc('Description for article generator term input')
            .addTextArea(text => text
                .setPlaceholder('Enter description...')
                .setValue(this.plugin.settings.prompts.articleTermDescription)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.articleTermDescription = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        // Notices and Messages
        containerEl.createEl('h4', { text: 'Notices & Messages' });
        
        new Setting(containerEl)
            .setName('Deep Research Loading Notice')
            .setDesc('Notice shown when deep research is in progress')
            .addText(text => text
                .setPlaceholder('Enter notice text...')
                .setValue(this.plugin.settings.prompts.deepResearchLoadingNotice)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.deepResearchLoadingNotice = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Enter Question Notice')
            .setDesc('Notice shown when no question is entered')
            .addText(text => text
                .setPlaceholder('Enter notice text...')
                .setValue(this.plugin.settings.prompts.enterQuestionNotice)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.enterQuestionNotice = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Enter Term Notice')
            .setDesc('Notice shown when no term is entered for article generator')
            .addText(text => text
                .setPlaceholder('Enter notice text...')
                .setValue(this.plugin.settings.prompts.enterTermNotice)
                .onChange(async (value: string) => {
                    this.plugin.settings.prompts.enterTermNotice = value;
                    this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
                    await this.plugin.saveSettings();
                })
            );

        // Article Generator Template
        containerEl.createEl('h4', { text: 'Article Generator Template' });
        
        const articleTemplateSetting = new Setting(containerEl)
            .setName('Article Generator Template')
            .setDesc('Template for generating articles. Use {TERM} as placeholder for the term.');
            
        const articleTemplateTextArea = document.createElement('textarea');
        articleTemplateTextArea.rows = 15;
        articleTemplateTextArea.cols = 50;
        articleTemplateTextArea.style.width = '100%';
        articleTemplateTextArea.style.minHeight = '400px';
        articleTemplateTextArea.style.fontFamily = 'monospace';
        articleTemplateTextArea.placeholder = 'Enter article generator template...';
        articleTemplateTextArea.value = this.plugin.settings.prompts.articleGeneratorTemplate;
        
        articleTemplateTextArea.addEventListener('input', async () => {
            this.plugin.settings.prompts.articleGeneratorTemplate = articleTemplateTextArea.value;
            this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
            await this.plugin.saveSettings();
        });
        
        articleTemplateSetting.settingEl.appendChild(articleTemplateTextArea);

        // Image Prompts
        containerEl.createEl('h4', { text: 'Image Prompts' });
        
        const imagePromptsSetting = new Setting(containerEl)
            .setName('Image References Prompt')
            .setDesc('Prompt added to queries when images are enabled');
            
        const imagePromptsTextArea = document.createElement('textarea');
        imagePromptsTextArea.rows = 8;
        imagePromptsTextArea.cols = 50;
        imagePromptsTextArea.style.width = '100%';
        imagePromptsTextArea.style.minHeight = '200px';
        imagePromptsTextArea.style.fontFamily = 'monospace';
        imagePromptsTextArea.placeholder = 'Enter image references prompt...';
        imagePromptsTextArea.value = this.plugin.settings.prompts.imageReferencesPrompt;
        
        imagePromptsTextArea.addEventListener('input', async () => {
            this.plugin.settings.prompts.imageReferencesPrompt = imagePromptsTextArea.value;
            this.plugin.getPromptsService().updateSettings(this.plugin.settings.prompts);
            await this.plugin.saveSettings();
        });
        
        imagePromptsSetting.settingEl.appendChild(imagePromptsTextArea);
    }
}
