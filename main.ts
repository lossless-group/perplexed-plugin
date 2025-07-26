import { App, Editor, Notice, PluginSettingTab, Setting } from 'obsidian';
import PerplexedPluginCore from './src/core/PerplexedPluginCore';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: `${process.cwd()}/.env` });

// Services
import { PerplexityService } from './src/services/perplexityService';
import { PerplexicaService } from './src/services/perplexicaService';
import { LMStudioService } from './src/services/lmStudioService';
import { PromptsService } from './src/services/promptsService';

// Modals
import { PerplexityModal } from './src/modals/PerplexityModal';
import { PerplexicaModal } from './src/modals/PerplexicaModal';
import { LMStudioModal } from './src/modals/LMStudioModal';
import { URLUpdateModal } from './src/modals/URLUpdateModal';
import { ArticleGeneratorModal } from './src/modals/ArticleGeneratorModal';

// Settings and types
import { PerplexedSettings } from './src/settings/PerplexedSettings';
import type { PerplexitySettings } from './src/services/perplexityService';
import type { PerplexicaSettings } from './src/services/perplexicaService';
import { LMStudioSettings } from './src/settings/LMStudioSettings';

/**
 * Main plugin class that extends the core functionality
 */
export default class PerplexedPlugin extends PerplexedPluginCore {
    // Service instances with proper types
    public promptsService!: PromptsService;
    public perplexityService!: PerplexityService;
    public perplexicaService!: PerplexicaService;
    public lmStudioService!: LMStudioService;

    // Settings interfaces
    public settings!: PerplexedSettings;

    // Service settings
    public perplexitySettings!: PerplexitySettings;
    public perplexicaSettings!: PerplexicaSettings;
    public lmStudioSettings!: LMStudioSettings;

    // UI Elements
    private statusBarItemEl: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;

    /**
     * Initialize service-specific settings
     */
    private initializeServiceSettings(): void {
        // Initialize Perplexity settings
        this.perplexitySettings = {
            perplexityApiKey: this.settings.perplexityApiKey || '',
            perplexityEndpoint: this.settings.perplexityEndpoint || 'https://api.perplexity.ai',
            promptsService: this.promptsService
        };
        
        // Initialize Perplexica settings
        this.perplexicaSettings = {
            perplexicaEndpoint: this.settings.perplexityEndpoint || 'https://api.perplexity.ai',
            localLLMPath: this.settings.localLLMPath || '',
            defaultModel: this.settings.defaultModel || 'gpt-3.5-turbo',
            promptsService: this.promptsService
        };
        
        // Initialize LM Studio settings
        this.lmStudioSettings = {
            endpoints: {
                baseUrl: this.settings.lmStudioEndpoint || 'http://localhost:1234',
                chatCompletions: '/v1/chat/completions',
                completions: '/v1/completions',
                embeddings: '/v1/embeddings',
                models: '/v1/models'
            },
            defaultModel: this.settings.defaultLMStudioModel || 'ibm/granite-3.2-8b',
            promptsService: this.promptsService
        };
    }
    
    /**
     * Initialize all services with their respective settings
     */
    private initializeServices(): void {
        // Initialize Perplexity service
        this.perplexityService = new PerplexityService(this.perplexitySettings);
        
        // Initialize Perplexica service
        this.perplexicaService = new PerplexicaService(this.perplexicaSettings);
        
        // Initialize LM Studio service
        this.lmStudioService = new LMStudioService(this.lmStudioSettings);
    }
    
    /**
     * Initialize the UI components
     */
    private initializeUI(): void {
        // Add status bar item if enabled
        if (this.settings.showStatusBar) {
            this.statusBarItemEl = this.addStatusBarItem();
            this.statusBarItemEl.setText('Perplexed');
        }
        
        // Add ribbon icon
        this.ribbonIconEl = this.addRibbonIcon(
            'zap',
            'Perplexed',
            () => {
                // Open command palette
                // @ts-ignore - app is available in the Obsidian context
                this.app.commands.executeCommandById('perplexed:open-command-palette');
            }
        );
    }
    
    /**
     * Initialize the plugin
     */
    async onload() {
        await super.onload();
        
        // Initialize prompts service first as it's used by other services
        this.promptsService = new PromptsService(this.settings.prompts);
        
        // Initialize service settings
        this.initializeServiceSettings();
        
        // Initialize services with their respective settings
        this.initializeServices();
        
        // Register commands and UI elements
        this.registerCommands();
        this.initializeUI();
        
        // Add settings tab
        this.addSettingTab(new PerplexedSettingTab(this.app, this));
        
        // Register service-specific commands
        this.registerPerplexicaCommands();
        this.registerPerplexityCommands();
        this.registerLMStudioCommands();
        this.registerArticleGeneratorCommands();
        
        console.log('Perplexed plugin loaded');
    }
    
    onunload() {
        this.statusBarItemEl?.remove();
        this.ribbonIconEl?.remove();
        console.log('Perplexed plugin unloaded');
    }
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


        editor: Editor, 
        options?: {
            max_tokens?: number;
            temperature?: number;
            top_p?: number;
            system_prompt?: string;
            return_images?: boolean;
        }
    ): Promise<void> {
        // Use the provided model or fall back to the default from settings
        const modelToUse = model || this.settings.defaultLMStudioModel;
        
        // Log the model being used for debugging
        console.log('Using model:', modelToUse);
        
        await this.lmStudioService.queryLMStudio(
            query, 
            modelToUse, 
            stream, 
            editor, 
            options
        );
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
                const modal = new LMStudioModal(this.app, editor, this, this.lmStudioService, this.promptsService);
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
        const lmStudioHeader = containerEl.createEl('h3', { text: 'LM Studio (Local LLM)' });
        lmStudioHeader.style.color = 'var(--text-accent)';
        containerEl.createEl('p', {
            text: 'Configure settings for LM Studio local LLM service',
            cls: 'setting-item-description'
        });

        // Base URL setting
        new Setting(containerEl)
            .setName('Base URL')
            .setDesc('Base URL for LM Studio API (e.g., http://localhost:1234)')
            .addText(text => text
                .setPlaceholder('http://localhost:1234')
                .setValue(this.plugin.settings.lmStudioEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.lmStudioEndpoint = value.trim();
                    await this.plugin.saveSettings();
                }));

        // Endpoints configuration
        containerEl.createEl('h4', { text: 'API Endpoints' }).style.marginTop = '20px';
        
        // Chat Completions Endpoint
        new Setting(containerEl)
            .setName('Chat Completions')
            .setDesc('Endpoint for chat completions')
            .addText(text => text
                .setValue('/v1/chat/completions')
                .setDisabled(true));
        
        // Completions Endpoint
        new Setting(containerEl)
            .setName('Completions')
            .setDesc('Endpoint for completions')
            .addText(text => text
                .setValue('/v1/completions')
                .setDisabled(true));
        
        // Embeddings Endpoint
        new Setting(containerEl)
            .setName('Embeddings')
            .setDesc('Endpoint for embeddings')
            .addText(text => text
                .setValue('/v1/embeddings')
                .setDisabled(true));
        
        // Models Endpoint
        new Setting(containerEl)
            .setName('Models')
            .setDesc('Endpoint for listing available models')
            .addText(text => text
                .setValue('/v1/models')
                .setDisabled(true));

        // Default Model
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model to use with LM Studio')
            .addText(text => text
                .setPlaceholder('ibm/granite-3.2-8b')
                .setValue(this.plugin.settings.defaultLMStudioModel)
                .onChange(async (value) => {
                    this.plugin.settings.defaultLMStudioModel = value.trim();
                    await this.plugin.saveSettings();
                }));
                
        // Test Connection Button
        const testConnectionSetting = new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Verify connection to LM Studio API');
            
        testConnectionSetting.addButton(button => {
            button.setButtonText('Test Connection')
                .onClick(async () => {
                    try {
                        const response = await fetch(`${this.plugin.settings.lmStudioEndpoint}/v1/models`);
                        if (response.ok) {
                            new Notice('✅ Successfully connected to LM Studio API');
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (error: unknown) {
                        console.error('LM Studio connection test failed:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        new Notice(`❌ Failed to connect to LM Studio: ${errorMessage}`);
                    }
                });
        });

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
