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
import { TextEnhancementModal } from './src/modals/TextEnhancementModal';
import { TextEnhancementWithImagesModal } from './src/modals/TextEnhancementWithImagesModal';

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
    
    // Display Settings
    headerPosition: 'top' | 'bottom';
    
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
        
        // Article generator template
        articleGeneratorTemplate: string;
        
        // Deep Research article generator template
        deepResearchArticleTemplate: string;
        
        // Image prompts
        imageReferencesPrompt: string;
        
        // Text enhancement prompt
        enhancePrompt: string;
        
        // Text enhancement with images prompt
        enhanceWithImagesPrompt: string;
    };
}

const DEFAULT_SETTINGS: PerplexedPluginSettings = {
    mySetting: 'default',
    // Use host.docker.internal to connect to the host machine from Docker containers
    localLLMPath: 'http://host.docker.internal:3030/api/search',
    perplexicaEndpoint: 'http://localhost:3030/api/search',
    perplexityEndpoint: 'https://api.perplexity.ai/chat/completions',
    lmStudioEndpoint: 'http://localhost:1234/v1/chat/completions',
    headerPosition: 'top',
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
- Use markdown formatting for structure`,
        
        // Deep Research article generator template
        deepResearchArticleTemplate: `Conduct comprehensive research and write an in-depth article about "{TERM}". 

**Research Requirements:**
- Conduct exhaustive research across hundreds of sources
- Analyze multiple perspectives and viewpoints
- Include academic, industry, and expert sources
- Provide detailed citations and references
- Examine historical context and evolution
- Consider global implications and regional variations

**Article Structure:**

1. **Executive Summary** (1 paragraph)
   - Concise overview of key findings
   - Main conclusions and implications

2. **Introduction and Definition** (2-3 paragraphs)
   - Comprehensive definition and scope
   - Historical context and evolution
   - Current significance and relevance

3. **Comprehensive Analysis** (6-8 paragraphs)
   - Detailed examination of core concepts
   - Multiple perspectives and approaches
   - Industry applications and use cases
   - Technical implementation details
   - Market analysis and competitive landscape
   - Regulatory and ethical considerations

4. **Current State and Market Dynamics** (3-4 paragraphs)
   - Global adoption patterns and trends
   - Key players, technologies, and platforms
   - Regional variations and cultural factors
   - Economic impact and market size
   - Recent developments and breakthroughs

5. **Challenges and Opportunities** (2-3 paragraphs)
   - Technical challenges and limitations
   - Implementation barriers and solutions
   - Future opportunities and potential
   - Risk factors and mitigation strategies

6. **Future Outlook and Predictions** (2-3 paragraphs)
   - Short-term developments (1-2 years)
   - Medium-term trends (3-5 years)
   - Long-term implications (5+ years)
   - Strategic recommendations

7. **Conclusion** (1-2 paragraphs)
   - Synthesis of key findings
   - Strategic implications
   - Call to action or forward-looking statement

**Research Guidelines:**
- Include diverse source types (academic, industry, news, expert opinions)
- Provide detailed citations for all claims
- Analyze conflicting viewpoints and evidence
- Consider global and regional perspectives
- Include quantitative data where available
- Examine both benefits and risks
- Address ethical and societal implications

**Quality Standards:**
- Academic rigor with practical relevance
- Balanced analysis of multiple perspectives
- Evidence-based conclusions
- Clear, professional writing style
- Comprehensive bibliography`,
        
        // Image prompts
        imageReferencesPrompt: "**Image References:**\nPlease include the following image references throughout your response where appropriate:\n- [IMAGE 1: Relevant diagram or illustration related to the topic]\n- [IMAGE 2: Practical example or use case visualization]\n- [IMAGE 3: Additional supporting visual content]",
        
        // Text enhancement prompt
        enhancePrompt: "Please enhance the following text by improving clarity, adding relevant details, expanding on key points, and making it more comprehensive and engaging. Maintain the original meaning and tone while making it more informative and well-structured:\n\n{TEXT}",
        
        // Text enhancement with images prompt
        enhanceWithImagesPrompt: "Please provide 1-3 relevant images for the following text. Return ONLY the image markers in the format [IMAGE 1: description], [IMAGE 2: description], etc. Each image should illustrate a key concept, example, or visual representation related to the text. Do not include any other text or explanation:\n\n{TEXT}"
    }
};

export default class PerplexedPlugin extends Plugin {
    public settings: PerplexedPluginSettings = DEFAULT_SETTINGS;
    private statusBarItemEl: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    
    // Service instances
    private perplexityService!: PerplexityService | null;
    private perplexicaService!: PerplexicaService | null;
    private lmStudioService!: LMStudioService | null;
    private promptsService!: PromptsService | null;

    async onload(): Promise<void> {
        try {
            console.log('Perplexed Plugin: Starting initialization...');
            
            await this.loadSettings();
            console.log('Perplexed Plugin: Settings loaded successfully');
            
            // Initialize prompts service first
            try {
                this.promptsService = new PromptsService(this.settings.prompts);
                console.log('Perplexed Plugin: PromptsService initialized successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to initialize PromptsService:', error);
                new Notice('Failed to initialize PromptsService');
                this.promptsService = null;
            }
            
            // Initialize services with error handling - only if promptsService is available
            if (this.promptsService) {
                try {
                    this.perplexityService = new PerplexityService({
                        perplexityApiKey: this.settings.perplexityApiKey,
                        perplexityEndpoint: this.settings.perplexityEndpoint,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.perplexityRequestTemplate,
                        headerPosition: this.settings.headerPosition
                    });
                    console.log('Perplexed Plugin: PerplexityService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize PerplexityService:', error);
                    new Notice('Failed to initialize PerplexityService');
                    this.perplexityService = null;
                }
                
                try {
                    this.perplexicaService = new PerplexicaService({
                        perplexicaEndpoint: this.settings.perplexicaEndpoint,
                        localLLMPath: this.settings.localLLMPath,
                        defaultModel: this.settings.defaultModel,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.requestBodyTemplate
                    });
                    console.log('Perplexed Plugin: PerplexicaService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize PerplexicaService:', error);
                    new Notice('Failed to initialize PerplexicaService');
                    this.perplexicaService = null;
                }
                
                try {
                    this.lmStudioService = new LMStudioService({
                        lmStudioEndpoint: this.settings.lmStudioEndpoint,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.lmStudioRequestTemplate
                    });
                    console.log('Perplexed Plugin: LMStudioService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize LMStudioService:', error);
                    new Notice('Failed to initialize LMStudioService');
                    this.lmStudioService = null;
                }
            } else {
                // If promptsService failed, set all other services to null
                this.perplexityService = null;
                this.perplexicaService = null;
                this.lmStudioService = null;
                console.log('Perplexed Plugin: Skipping service initialization due to PromptsService failure');
            }
            
            // Debug: Log current settings
            console.log('Perplexed Plugin: Current Perplexica Path:', this.settings.perplexicaEndpoint);
            console.log('Perplexed Plugin: Full settings:', JSON.stringify(this.settings, null, 2));

            // This adds a settings tab so the user can configure various aspects of the plugin
            this.addSettingTab(new PerplexedSettingTab(this.app, this));
            console.log('Perplexed Plugin: Settings tab added successfully');
            
            // Register commands with error handling
            try {
                this.registerPerplexicaCommands();
                console.log('Perplexed Plugin: Perplexica commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Perplexica commands:', error);
            }
            
            try {
                this.registerPerplexityCommands();
                console.log('Perplexed Plugin: Perplexity commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Perplexity commands:', error);
            }
            
            try {
                this.registerLMStudioCommands();
                console.log('Perplexed Plugin: LM Studio commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register LM Studio commands:', error);
            }
            
            try {
                this.registerArticleGeneratorCommands();
                console.log('Perplexed Plugin: Article generator commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register article generator commands:', error);
            }
            
            try {
                this.registerTextEnhancementCommands();
                console.log('Perplexed Plugin: Text enhancement commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register text enhancement commands:', error);
            }
            
            try {
                this.registerTextEnhancementWithImagesCommands();
                console.log('Perplexed Plugin: Get related images commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register get related images commands:', error);
            }
            
            // Add debug command to check command status
            this.addCommand({
                id: 'perplexed-debug-commands',
                name: 'Debug: Check Perplexed Commands',
                callback: () => {
                    this.debugCommands();
                }
            });
            
            // Add command to reset prompts to defaults
            this.addCommand({
                id: 'perplexed-reset-prompts',
                name: 'Reset Prompts to Default',
                callback: async () => {
                    await this.resetPromptsToDefault();
                }
            });
            
            // Add command to reinitialize services
            this.addCommand({
                id: 'perplexed-reinitialize-services',
                name: 'Reinitialize Perplexed Services',
                callback: async () => {
                    await this.reinitializeServices();
                }
            });
            
            console.log('Perplexed Plugin: Initialization completed successfully');
            new Notice('Perplexed Plugin loaded successfully');
            
        } catch (error) {
            console.error('Perplexed Plugin: Critical initialization error:', error);
            new Notice('Perplexed Plugin failed to load properly');
        }
    }

    onunload(): void {
        this.statusBarItemEl?.remove();
        this.ribbonIconEl?.remove();
    }

    private async loadSettings() {
        const savedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
        
        // Ensure new fields are always present (migration for existing users)
        if (!this.settings.prompts.deepResearchArticleTemplate) {
            this.settings.prompts.deepResearchArticleTemplate = DEFAULT_SETTINGS.prompts.deepResearchArticleTemplate;
            await this.saveSettings();
        }
        if (!this.settings.prompts.enhancePrompt) {
            this.settings.prompts.enhancePrompt = DEFAULT_SETTINGS.prompts.enhancePrompt;
            await this.saveSettings();
        }
        if (!this.settings.prompts.enhanceWithImagesPrompt) {
            this.settings.prompts.enhanceWithImagesPrompt = DEFAULT_SETTINGS.prompts.enhanceWithImagesPrompt;
            await this.saveSettings();
        }
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
        if (!this.perplexityService) {
            throw new Error('Perplexity service not initialized');
        }
        await this.perplexityService.queryPerplexity(query, model, stream, editor, options);
    }

    public async queryPerplexica(query: string, focusMode: string, optimizationMode: string, stream: boolean, editor: Editor, options?: {
        return_images?: boolean;
    }): Promise<void> {
        if (!this.perplexicaService) {
            throw new Error('Perplexica service not initialized');
        }
        await this.perplexicaService.queryPerplexica(query, focusMode, optimizationMode, stream, editor, options);
    }

    public async queryLMStudio(query: string, model: string, stream: boolean, editor: Editor, options?: {
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        system_prompt?: string;
        return_images?: boolean;
    }): Promise<void> {
        if (!this.lmStudioService) {
            throw new Error('LM Studio service not initialized');
        }
        await this.lmStudioService.queryLMStudio(query, model, stream, editor, options);
    }

    // Getter for prompts service
    public getPromptsService(): PromptsService | null {
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
                try {
                    if (!this.perplexicaService) {
                        new Notice('Perplexica service not initialized. Please check console for errors and try the debug command.');
                        console.error('Perplexica service is not initialized');
                        return;
                    }
                    if (!this.promptsService) {
                        new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                        console.error('Prompts service is not initialized');
                        return;
                    }
                    const modal = new PerplexicaModal(this.app, editor, this.perplexicaService, this.promptsService);
                    modal.open();
                } catch (error) {
                    console.error('Error opening Perplexica modal:', error);
                    new Notice('Failed to open Perplexica modal. Check console for details.');
                }
            }
        });
    }

    private registerPerplexityCommands(): void {
        try {
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
                    try {
                        if (!this.perplexityService) {
                            new Notice('Perplexity service not initialized. Please check console for errors and try the debug command.');
                            console.error('Perplexity service is not initialized');
                            return;
                        }
                        if (!this.promptsService) {
                            new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                            console.error('Prompts service is not initialized');
                            return;
                        }
                        const modal = new PerplexityModal(this.app, editor, this.perplexityService, this.promptsService);
                        modal.open();
                    } catch (error) {
                        console.error('Error opening Perplexity modal:', error);
                        new Notice('Failed to open Perplexity modal. Check console for details.');
                    }
                }
            });
            
            // Add a fallback command that shows service status
            this.addCommand({
                id: 'perplexity-service-status',
                name: 'Check Perplexity Service Status',
                callback: () => {
                    if (this.perplexityService) {
                        new Notice('Perplexity service is initialized and ready');
                        console.log('Perplexity service status: OK');
                    } else {
                        new Notice('Perplexity service is NOT initialized. Check console for errors.');
                        console.error('Perplexity service status: FAILED');
                    }
                }
            });
            
            console.log('Perplexed Plugin: Perplexity commands registered successfully');
        } catch (error) {
            console.error('Perplexed Plugin: Error registering Perplexity commands:', error);
            throw error;
        }
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
                try {
                    if (!this.lmStudioService) {
                        new Notice('LM Studio service not initialized. Please check console for errors and try the debug command.');
                        console.error('LM Studio service is not initialized');
                        return;
                    }
                    if (!this.promptsService) {
                        new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                        console.error('Prompts service is not initialized');
                        return;
                    }
                    const modal = new LMStudioModal(this.app, editor, this.lmStudioService, this.promptsService);
                    modal.open();
                } catch (error) {
                    console.error('Error opening LM Studio modal:', error);
                    new Notice('Failed to open LM Studio modal. Check console for details.');
                }
            }
        });
    }

    private registerArticleGeneratorCommands(): void {
        // Register Article Generator command
        this.addCommand({
            id: 'generate-article',
            name: 'Generate One-Page Article',
            editorCallback: (editor: Editor) => {
                try {
                    if (!this.perplexityService) {
                        new Notice('Perplexity service not initialized. Please check console for errors and try the debug command.');
                        console.error('Perplexity service is not initialized');
                        return;
                    }
                    if (!this.promptsService) {
                        new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                        console.error('Prompts service is not initialized');
                        return;
                    }
                    new ArticleGeneratorModal(this.app, editor, this.perplexityService, this.promptsService).open();
                } catch (error) {
                    console.error('Error opening Article Generator modal:', error);
                    new Notice('Failed to open Article Generator modal. Check console for details.');
                }
            }
        });
    }

    private registerTextEnhancementCommands(): void {
        // Register Text Enhancement command
        this.addCommand({
            id: 'enhance-text',
            name: 'Enhance Selected Text with Perplexity',
            editorCallback: (editor: Editor) => {
                try {
                    const selectedText = editor.getSelection();
                    if (!selectedText || selectedText.trim() === '') {
                        new Notice('Please select some text to enhance');
                        return;
                    }
                    
                    if (!this.perplexityService) {
                        new Notice('Perplexity service not initialized. Please check console for errors and try the debug command.');
                        console.error('Perplexity service is not initialized');
                        return;
                    }
                    if (!this.promptsService) {
                        new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                        console.error('Prompts service is not initialized');
                        return;
                    }
                    
                    new TextEnhancementModal(this.app, editor, this.perplexityService, this.promptsService, selectedText).open();
                } catch (error) {
                    console.error('Error opening Text Enhancement modal:', error);
                    new Notice('Failed to open Text Enhancement modal. Check console for details.');
                }
            }
        });
    }

    private registerTextEnhancementWithImagesCommands(): void {
        // Register Get Related Images command
        this.addCommand({
            id: 'enhance-text-with-images',
            name: 'Get Related Images for Selected Text',
            editorCallback: (editor: Editor) => {
                try {
                    const selectedText = editor.getSelection();
                    if (!selectedText || selectedText.trim() === '') {
                        new Notice('Please select some text to get related images for');
                        return;
                    }
                    
                    if (!this.perplexityService) {
                        new Notice('Perplexity service not initialized. Please check console for errors and try the debug command.');
                        console.error('Perplexity service is not initialized');
                        return;
                    }
                    if (!this.promptsService) {
                        new Notice('Prompts service not initialized. Please check console for errors and try the debug command.');
                        console.error('Prompts service is not initialized');
                        return;
                    }
                    
                    new TextEnhancementWithImagesModal(this.app, editor, this.perplexityService, this.promptsService, selectedText).open();
                } catch (error) {
                    console.error('Error opening Get Related Images modal:', error);
                    new Notice('Failed to open Get Related Images modal. Check console for details.');
                }
            }
        });
    }

    private debugCommands(): void {
        console.log('=== Perplexed Plugin Debug Information ===');
        console.log('Plugin instance:', this);
        console.log('Settings:', this.settings);
        console.log('Services status:');
        console.log('- PromptsService:', this.promptsService ? 'Initialized' : 'NOT INITIALIZED');
        console.log('- PerplexityService:', this.perplexityService ? 'Initialized' : 'NOT INITIALIZED');
        console.log('- PerplexicaService:', this.perplexicaService ? 'Initialized' : 'NOT INITIALIZED');
        console.log('- LMStudioService:', this.lmStudioService ? 'Initialized' : 'NOT INITIALIZED');
        
        // Check if commands are registered in Obsidian
        const registeredCommands = this.app.commands.commands;
        const perplexedCommands = Object.keys(registeredCommands).filter(cmd => 
            cmd.startsWith('perplexed') || 
            cmd.includes('perplexity') || 
            cmd.includes('perplexica') || 
            cmd.includes('lmstudio') ||
            cmd.includes('generate-article') ||
            cmd.includes('enhance-text')
        );
        
        console.log('Registered Perplexed commands:', perplexedCommands);
        
        if (perplexedCommands.length === 0) {
            new Notice('No Perplexed commands found! Check console for details.');
        } else {
            new Notice(`Found ${perplexedCommands.length} Perplexed commands. Check console for details.`);
        }
        
        console.log('=== End Debug Information ===');
    }

    private async resetPromptsToDefault(): Promise<void> {
        try {
            console.log('Perplexed Plugin: Resetting prompts to default...');
            new Notice('Resetting prompts to default values...');
            
            // Reset all prompt settings to default values
            this.settings.prompts = { ...DEFAULT_SETTINGS.prompts };
            
            // Save the updated settings
            await this.saveSettings();
            
            // Reinitialize the prompts service with new settings
            if (this.promptsService) {
                this.promptsService.updateSettings(this.settings.prompts);
                console.log('Perplexed Plugin: PromptsService updated with default settings');
            }
            
            new Notice('✅ Prompts reset to default values successfully');
            console.log('Perplexed Plugin: Prompts reset to default successfully');
            
        } catch (error) {
            console.error('Perplexed Plugin: Failed to reset prompts to default:', error);
            new Notice('❌ Failed to reset prompts to default. Check console for details.');
        }
    }

    private async reinitializeServices(): Promise<void> {
        try {
            console.log('Perplexed Plugin: Reinitializing services...');
            new Notice('Reinitializing Perplexed services...');
            
            // Reinitialize prompts service first
            try {
                this.promptsService = new PromptsService(this.settings.prompts);
                console.log('Perplexed Plugin: PromptsService reinitialized successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to reinitialize PromptsService:', error);
                this.promptsService = null;
            }
            
            // Reinitialize other services only if promptsService is available
            if (this.promptsService) {
                try {
                    this.perplexityService = new PerplexityService({
                        perplexityApiKey: this.settings.perplexityApiKey,
                        perplexityEndpoint: this.settings.perplexityEndpoint,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.perplexityRequestTemplate,
                        headerPosition: this.settings.headerPosition
                    });
                    console.log('Perplexed Plugin: PerplexityService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize PerplexityService:', error);
                    this.perplexityService = null;
                }
                
                try {
                    this.perplexicaService = new PerplexicaService({
                        perplexicaEndpoint: this.settings.perplexicaEndpoint,
                        localLLMPath: this.settings.localLLMPath,
                        defaultModel: this.settings.defaultModel,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.requestBodyTemplate
                    });
                    console.log('Perplexed Plugin: PerplexicaService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize PerplexicaService:', error);
                    this.perplexicaService = null;
                }
                
                try {
                    this.lmStudioService = new LMStudioService({
                        lmStudioEndpoint: this.settings.lmStudioEndpoint,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.lmStudioRequestTemplate
                    });
                    console.log('Perplexed Plugin: LMStudioService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize LMStudioService:', error);
                    this.lmStudioService = null;
                }
            } else {
                // If promptsService failed, set all other services to null
                this.perplexityService = null;
                this.perplexicaService = null;
                this.lmStudioService = null;
                console.log('Perplexed Plugin: Skipping service reinitialization due to PromptsService failure');
            }
            
            new Notice('Services reinitialization completed. Check console for details.');
            console.log('Perplexed Plugin: Services reinitialization completed');
            
        } catch (error) {
            console.error('Perplexed Plugin: Error during services reinitialization:', error);
            new Notice('Failed to reinitialize services. Check console for details.');
        }
    }
}

class PerplexedSettingTab extends PluginSettingTab {
    plugin: PerplexedPlugin;

    constructor(app: App, plugin: PerplexedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Helper method to safely update prompts service
    private updatePromptsService(): void {
        const promptsService = this.plugin.getPromptsService();
        if (promptsService) {
            promptsService.updateSettings(this.plugin.settings.prompts);
        }
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

        new Setting(containerEl)
            .setName('Header Position')
            .setDesc('Where to place the query header in generated articles')
            .addDropdown(dropdown => dropdown
                .addOption('top', 'Top of article')
                .addOption('bottom', 'Bottom of article')
                .setValue(this.plugin.settings.headerPosition)
                .onChange(async (value: string) => {
                    this.plugin.settings.headerPosition = value as 'top' | 'bottom';
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    const promptsService = this.plugin.getPromptsService();
                    if (promptsService) {
                        promptsService.updateSettings(this.plugin.settings.prompts);
                    }
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
                    this.updatePromptsService();
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
            this.updatePromptsService();
            await this.plugin.saveSettings();
        });
        
        articleTemplateSetting.settingEl.appendChild(articleTemplateTextArea);

        // Deep Research Article Generator Template
        const deepResearchTemplateSetting = new Setting(containerEl)
            .setName('Deep Research Article Generator Template')
            .setDesc('Template for generating articles with Deep Research model. Use {TERM} as placeholder for the term.');
            
        const deepResearchTemplateTextArea = document.createElement('textarea');
        deepResearchTemplateTextArea.rows = 20;
        deepResearchTemplateTextArea.cols = 50;
        deepResearchTemplateTextArea.style.width = '100%';
        deepResearchTemplateTextArea.style.minHeight = '500px';
        deepResearchTemplateTextArea.style.fontFamily = 'monospace';
        deepResearchTemplateTextArea.placeholder = 'Enter Deep Research article generator template...';
        deepResearchTemplateTextArea.value = this.plugin.settings.prompts.deepResearchArticleTemplate;
        
        deepResearchTemplateTextArea.addEventListener('input', async () => {
            this.plugin.settings.prompts.deepResearchArticleTemplate = deepResearchTemplateTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        });
        
        deepResearchTemplateSetting.settingEl.appendChild(deepResearchTemplateTextArea);

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
            this.updatePromptsService();
            await this.plugin.saveSettings();
        });
        
        imagePromptsSetting.settingEl.appendChild(imagePromptsTextArea);

        // Text Enhancement Prompt
        containerEl.createEl('h4', { text: 'Text Enhancement' });
        
        const enhancePromptSetting = new Setting(containerEl)
            .setName('Text Enhancement Prompt')
            .setDesc('Template for enhancing selected text. Use {TEXT} as placeholder for the selected text.');
            
        const enhancePromptTextArea = document.createElement('textarea');
        enhancePromptTextArea.rows = 10;
        enhancePromptTextArea.cols = 50;
        enhancePromptTextArea.style.width = '100%';
        enhancePromptTextArea.style.minHeight = '250px';
        enhancePromptTextArea.style.fontFamily = 'monospace';
        enhancePromptTextArea.placeholder = 'Enter text enhancement prompt template...';
        enhancePromptTextArea.value = this.plugin.settings.prompts.enhancePrompt;
        
        enhancePromptTextArea.addEventListener('input', async () => {
            this.plugin.settings.prompts.enhancePrompt = enhancePromptTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        });
        
        enhancePromptSetting.settingEl.appendChild(enhancePromptTextArea);

        // Text Enhancement with Images Prompt
        const enhanceWithImagesPromptSetting = new Setting(containerEl)
            .setName('Related Images Prompt')
            .setDesc('Template for requesting related images for selected text. Use {TEXT} as placeholder for the selected text.');
            
        const enhanceWithImagesPromptTextArea = document.createElement('textarea');
        enhanceWithImagesPromptTextArea.rows = 10;
        enhanceWithImagesPromptTextArea.cols = 50;
        enhanceWithImagesPromptTextArea.style.width = '100%';
        enhanceWithImagesPromptTextArea.style.minHeight = '250px';
        enhanceWithImagesPromptTextArea.style.fontFamily = 'monospace';
        enhanceWithImagesPromptTextArea.placeholder = 'Enter related images prompt template...';
        enhanceWithImagesPromptTextArea.value = this.plugin.settings.prompts.enhanceWithImagesPrompt;
        
        enhanceWithImagesPromptTextArea.addEventListener('input', async () => {
            this.plugin.settings.prompts.enhanceWithImagesPrompt = enhanceWithImagesPromptTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        });
        
        enhanceWithImagesPromptSetting.settingEl.appendChild(enhanceWithImagesPromptTextArea);
    }
}
