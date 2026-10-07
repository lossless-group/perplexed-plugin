import type { Editor } from 'obsidian';
import { Notice, Plugin } from 'obsidian';

// Import services
import { PerplexityService } from './src/services/perplexityService';
import { PerplexicaService } from './src/services/perplexicaService';
import { LMStudioService } from './src/services/lmStudioService';
import { ClaudeService } from './src/services/claudeService';
import { GeminiService } from './src/services/geminiService';
import { PromptsService } from './src/services/promptsService';

// Import modals
import { PerplexityModal } from './src/modals/PerplexityModal';
import { PerplexicaModal } from './src/modals/PerplexicaModal';
import { LMStudioModal } from './src/modals/LMStudioModal';
import { ClaudeModal } from './src/modals/ClaudeModal';
import { GeminiModal } from './src/modals/GeminiModal';
import { URLUpdateModal } from './src/modals/URLUpdateModal';
import { ArticleGeneratorModal } from './src/modals/ArticleGeneratorModal';
import { TextEnhancementModal } from './src/modals/TextEnhancementModal';
import { TextEnhancementWithImagesModal } from './src/modals/TextEnhancementWithImagesModal';
import { DirectoryTemplatePickerModal } from './src/modals/DirectoryTemplatePickerModal';
import { DirectoryTemplateRunModal } from './src/modals/DirectoryTemplateRunModal';
import type { TemplateRunChoice } from './src/modals/DirectoryTemplateRunModal';
import { FolderPickerModal } from './src/modals/FolderPickerModal';
import { LinkBackModal } from './src/modals/LinkBackModal';
import { BatchConfirmModal } from './src/modals/BatchConfirmModal';

import {
    applyTemplate as applyDirectoryTemplate,
    applyTemplateBatch as applyDirectoryTemplateBatch,
    listMarkdownFilesInFolder,
    listTemplates as listDirectoryTemplates,
    loadTemplate as loadDirectoryTemplate,
    pathMatchesGlobs,
} from './src/services/directoryTemplateService';
import type { DirectoryTemplateSettings, ParsedTemplate } from './src/services/directoryTemplateService';
import type { TFile } from 'obsidian';
import { applyLinkCandidates, findLinkCandidates } from './src/services/linkBackService';
import { findImagesForSelection } from './src/services/findImagesService';
import type { FindImagesSettings } from './src/services/findImagesService';
import { seedTemplatesIfMissing } from './src/services/templateSeederService';
import { ExaError, probeExa } from './src/services/exaService';
import { DEFAULT_SETTINGS, PerplexedSettingTab } from './src/settings/PerplexedSettings';
import type { PerplexedPluginSettings } from './src/settings/PerplexedSettings';

export default class PerplexedPlugin extends Plugin {
    public settings: PerplexedPluginSettings = structuredClone(DEFAULT_SETTINGS);
    private statusBarItemEl: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    private batchCancelled = false;
    
    // Service instances
    private perplexityService!: PerplexityService | null;
    private perplexicaService!: PerplexicaService | null;
    private lmStudioService!: LMStudioService | null;
    private claudeService!: ClaudeService | null;
    private geminiService!: GeminiService | null;
    private promptsService!: PromptsService | null;

    async onload(): Promise<void> {
        try {
            console.debug('Perplexed Plugin: Starting initialization...');
            
            await this.loadSettings();
            console.debug('Perplexed Plugin: Settings loaded successfully');

            // First-run seeding: if the configured templates root is missing
            // or empty, drop in the four shipped templates plus a README so a
            // freshly-installed perplexed has working defaults out of the box.
            // Idempotent — never overwrites existing files.
            try {
                const result = await seedTemplatesIfMissing(
                    this.app,
                    this.settings.directoryTemplatesRoot,
                    this.settings.directoryTemplatesPartialsRoot,
                    this.settings.directoryTemplatesPreamblesRoot,
                );
                if (result.seeded > 0) {
                    console.debug(`Perplexed Plugin: seeded ${result.seeded.toString()} template(s) (${result.reason})`);
                }
            } catch (error) {
                console.error('Perplexed Plugin: template seeding failed:', error);
            }

            // Initialize prompts service first
            try {
                this.promptsService = new PromptsService(this.settings.prompts);
                console.debug('Perplexed Plugin: PromptsService initialized successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to initialize PromptsService:', error);
                new Notice('Failed to initialize promptsservice');
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
                    console.debug('Perplexed Plugin: PerplexityService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize PerplexityService:', error);
                    new Notice('Failed to initialize perplexityservice');
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
                    console.debug('Perplexed Plugin: PerplexicaService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize PerplexicaService:', error);
                    new Notice('Failed to initialize perplexicaservice');
                    this.perplexicaService = null;
                }
                
                try {
                    this.lmStudioService = new LMStudioService({
                        lmStudioEndpoint: this.settings.lmStudioEndpoint,
                        promptsService: this.promptsService,
                        requestTemplate: this.settings.lmStudioRequestTemplate
                    });
                    console.debug('Perplexed Plugin: LMStudioService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize LMStudioService:', error);
                    new Notice('Failed to initialize lmstudioservice');
                    this.lmStudioService = null;
                }

                try {
                    this.claudeService = new ClaudeService({
                        anthropicApiKey: this.settings.anthropicApiKey,
                        promptsService: this.promptsService,
                        headerPosition: this.settings.headerPosition,
                    });
                    console.debug('Perplexed Plugin: ClaudeService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize ClaudeService:', error);
                    new Notice('Failed to initialize claudeservice');
                    this.claudeService = null;
                }

                try {
                    this.geminiService = new GeminiService({
                        geminiApiKey: this.settings.geminiApiKey,
                        promptsService: this.promptsService,
                        headerPosition: this.settings.headerPosition,
                    });
                    console.debug('Perplexed Plugin: GeminiService initialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to initialize GeminiService:', error);
                    new Notice('Failed to initialize geminiservice');
                    this.geminiService = null;
                }
            } else {
                // If promptsService failed, set all other services to null
                this.perplexityService = null;
                this.perplexicaService = null;
                this.lmStudioService = null;
                this.claudeService = null;
                this.geminiService = null;
                console.debug('Perplexed Plugin: Skipping service initialization due to PromptsService failure');
            }
            
            // Debug: Log current settings
            console.debug('Perplexed Plugin: Current Perplexica Path:', this.settings.perplexicaEndpoint);

            // This adds a settings tab so the user can configure various aspects of the plugin
            this.addSettingTab(new PerplexedSettingTab(this.app, this));
            console.debug('Perplexed Plugin: Settings tab added successfully');
            
            // Register commands with error handling
            try {
                this.registerPerplexicaCommands();
                console.debug('Perplexed Plugin: Perplexica commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Perplexica commands:', error);
            }
            
            try {
                this.registerPerplexityCommands();
                console.debug('Perplexed Plugin: Perplexity commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Perplexity commands:', error);
            }
            
            try {
                this.registerLMStudioCommands();
                console.debug('Perplexed Plugin: LM Studio commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register LM Studio commands:', error);
            }

            try {
                this.registerClaudeCommands();
                console.debug('Perplexed Plugin: Claude commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Claude commands:', error);
            }

            try {
                this.registerGeminiCommands();
                console.debug('Perplexed Plugin: Gemini commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register Gemini commands:', error);
            }

            try {
                this.registerArticleGeneratorCommands();
                console.debug('Perplexed Plugin: Article generator commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register article generator commands:', error);
            }
            
            try {
                this.registerTextEnhancementCommands();
                console.debug('Perplexed Plugin: Text enhancement commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register text enhancement commands:', error);
            }
            
            try {
                this.registerTextEnhancementWithImagesCommands();
                console.debug('Perplexed Plugin: Get related images commands registered successfully');
            } catch (error) {
                console.error('Perplexed Plugin: Failed to register get related images commands:', error);
            }
            
            // Diagnostic action: log registered commands to the console.
            this.addCommand({
                id: 'debug-status',
                name: 'Debug: log registered actions',
                callback: () => {
                    this.debugCommands();
                }
            });
            
            // Add command to reset prompts to defaults
            this.addCommand({
                id: 'reset-prompts',
                name: 'Reset prompts to default',
                callback: async () => {
                    await this.resetPromptsToDefault();
                }
            });
            
            // Reinitialize all provider services (Perplexity / Perplexica /
            // LM Studio / Claude). Useful after editing settings.
            this.addCommand({
                id: 'reinitialize-services',
                name: 'Reinitialize provider services',
                callback: () => {
                    this.reinitializeServices();
                }
            });

            // Directory templates (v0.1 spike). See context-v/specs/Per-Directory-Profile-Templates.md
            this.addCommand({
                id: 'apply-directory-template-to-current-file',
                name: 'Apply directory template to current file',
                callback: async () => {
                    await this.runApplyDirectoryTemplate();
                }
            });

            // Batch run a directory template across every file in a folder (v0.2).
            this.addCommand({
                id: 'apply-directory-template-to-folder',
                name: 'Apply directory template to all files in folder',
                callback: () => {
                    this.runApplyDirectoryTemplateBatch();
                }
            });

            // Exa retrieval connectivity probe. Cheapest possible real call
            // (one result, no content extraction) so checking status costs
            // a fraction of a cent rather than nothing-but-a-guess.
            this.addCommand({
                id: 'exa-service-status',
                name: 'Check Exa service status',
                callback: () => {
                    void (async () => {
                        if (!this.settings.exaApiKey) {
                            new Notice('Exa API key is not set. Add it in perplexed settings.');
                            return;
                        }
                        const probing = new Notice('Probing Exa…', 0);
                        try {
                            const n = await probeExa({
                                exaApiKey: this.settings.exaApiKey,
                                exaEndpoint: this.settings.exaEndpoint,
                            });
                            new Notice(`Exa reachable — probe returned ${n.toString()} result(s).`);
                        } catch (error) {
                            if (error instanceof ExaError && error.isAuthFailure) {
                                new Notice('Exa rejected the API key (HTTP 401/403). Check the key in settings.');
                            } else {
                                const msg = error instanceof Error ? error.message : String(error);
                                new Notice(`Exa unreachable: ${msg}`);
                            }
                        } finally {
                            probing.hide();
                        }
                    })();
                }
            });

            // Bulk-convert unlinked mentions of other vault notes into
            // absolute-path wikilinks. Obsidian surfaces these in its
            // "Unlinked mentions" pane but never offers to apply them.
            this.addCommand({
                id: 'link-back-to-vault-notes',
                name: 'Link back to vault notes',
                callback: () => {
                    void (async () => {
                        const file = this.app.workspace.getActiveFile();
                        if (!file) { new Notice('No active file.'); return; }
                        const raw = await this.app.vault.read(file);
                        const fmMatch = /^---\n[\s\S]*?\n---\n/.exec(raw);
                        const offset = fmMatch ? fmMatch[0].length : 0;
                        const body = raw.slice(offset);

                        const candidates = findLinkCandidates(this.app, file, body);
                        if (candidates.length === 0) {
                            new Notice('No unlinked mentions of other vault notes found.');
                            return;
                        }
                        new LinkBackModal(this.app, candidates, (accepted) => {
                            void (async () => {
                                if (accepted.length === 0) { new Notice('No links applied.'); return; }
                                const updated = applyLinkCandidates(body, accepted);
                                await this.app.vault.modify(file, raw.slice(0, offset) + updated);
                                new Notice(`Applied ${accepted.length.toString()} wikilink(s).`);
                            })();
                        }).open();
                    })();
                }
            });

            // Cancel an in-flight batch run.
            this.addCommand({
                id: 'stop-directory-template-batch',
                name: 'Stop directory template batch',
                callback: () => {
                    this.batchCancelled = true;
                    new Notice('Stop requested — finishing current file then halting.');
                }
            });

            // Find images for the current selection — anchors search on the
            // selection's content + the active file's url/site_name frontmatter
            // and distributes returned images between paragraphs.
            this.addCommand({
                id: 'find-images-for-selection',
                name: 'Find images for selection',
                editorCallback: (editor: Editor) => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file) {
                        new Notice('No active file.');
                        return;
                    }
                    const findSettings: FindImagesSettings = {
                        perplexityApiKey: this.settings.perplexityApiKey,
                        perplexityEndpoint: this.settings.perplexityEndpoint,
                        maxImages: this.settings.findImagesMaxImages,
                    };
                    void findImagesForSelection(this.app, findSettings, file, editor);
                }
            });
            
            console.debug('Perplexed Plugin: Initialization completed successfully');
            new Notice('Perplexed plugin loaded successfully');
            
        } catch (error) {
            console.error('Perplexed Plugin: Critical initialization error:', error);
            new Notice('Perplexed plugin failed to load properly');
        }
    }

    onunload(): void {
        this.statusBarItemEl?.remove();
        this.ribbonIconEl?.remove();
    }

    private async loadSettings() {
        const savedData: Partial<PerplexedPluginSettings> = (await this.loadData()) as Partial<PerplexedPluginSettings> ?? {};
        // Clone the defaults: the settings tab edits arrays and the prompts
        // object in place, and must never write through to DEFAULT_SETTINGS
        // (which "Reset prompts to default" reads back).
        const defaults = structuredClone(DEFAULT_SETTINGS);
        this.settings = {
            ...defaults,
            ...savedData,
            prompts: { ...defaults.prompts, ...savedData.prompts },
        };
        
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
            name: 'Update Perplexica / Vane URL',
            callback: () => {
                const modal = new URLUpdateModal(this.app, {
                    title: 'Update Perplexica / Vane API URL',
                    label: 'Perplexica / Vane API URL',
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
            name: 'Show Perplexica / Vane settings',
            callback: () => {
                new Notice(`Current Perplexica / Vane URL: ${this.settings.perplexicaEndpoint}`);
                console.debug('Perplexica Settings:', this.settings);
            }
        });

        // Command to ask Perplexica
        this.addCommand({
            id: 'ask-perplexica',
            name: 'Ask Perplexica / Vane',
            editorCallback: (editor: Editor) => {
                try {
                    if (!this.perplexicaService) {
                        new Notice('Perplexica / Vane service not initialized. Please check console for errors and try the debug command.');
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
                    new Notice('Failed to open Perplexica / Vane modal. Check console for details.');
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
                name: 'Show Perplexity settings',
                callback: () => {
                    new Notice(`Current Perplexity URL: ${this.settings.perplexityEndpoint}`);
                    console.debug('Perplexity Settings:', this.settings);
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
                name: 'Check Perplexity service status',
                callback: () => {
                    if (this.perplexityService) {
                        new Notice('Perplexity service is initialized and ready');
                        console.debug('Perplexity service status: OK');
                    } else {
                        new Notice('Perplexity service is not initialized. Check console for errors.');
                        console.error('Perplexity service status: FAILED');
                    }
                }
            });
            
            console.debug('Perplexed Plugin: Perplexity commands registered successfully');
        } catch (error) {
            console.error('Perplexed Plugin: Error registering Perplexity commands:', error);
            throw error;
        }
    }

    private registerGeminiCommands(): void {
        this.addCommand({
            id: 'ask-gemini',
            name: 'Ask Gemini',
            editorCallback: (editor: Editor) => {
                if (!this.geminiService) {
                    new Notice('Gemini service not initialized. Add a Gemini API key in settings, then reinitialize provider services.');
                    return;
                }
                if (!this.promptsService) {
                    new Notice('Prompts service not initialized.');
                    return;
                }
                new GeminiModal(
                    this.app,
                    editor,
                    this.geminiService,
                    this.promptsService,
                    {
                        defaultModel: this.settings.geminiDefaultModel,
                        enableGrounding: this.settings.geminiEnableGrounding,
                        includeSearchSuggestions: this.settings.geminiIncludeSearchSuggestions,
                        resolveCitationUrls: this.settings.geminiResolveCitationUrls,
                    }
                ).open();
            },
        });

        this.addCommand({
            id: 'gemini-service-status',
            name: 'Check Gemini service status',
            callback: () => {
                if (this.geminiService && this.settings.geminiApiKey) {
                    new Notice('Gemini service is initialized and an API key is configured.');
                } else if (this.geminiService) {
                    new Notice('Gemini service is initialized but no API key is set.');
                } else {
                    new Notice('Gemini service is not initialized.');
                }
            },
        });
    }

    private registerClaudeCommands(): void {
        this.addCommand({
            id: 'ask-claude',
            name: 'Ask Claude',
            editorCallback: (editor: Editor) => {
                if (!this.claudeService) {
                    new Notice('Claude service not initialized. Add an Anthropic API key in settings, then reinitialize provider services.');
                    return;
                }
                if (!this.promptsService) {
                    new Notice('Prompts service not initialized.');
                    return;
                }
                new ClaudeModal(this.app, editor, this.claudeService, this.promptsService).open();
            },
        });

        this.addCommand({
            id: 'claude-service-status',
            name: 'Check Claude service status',
            callback: () => {
                if (this.claudeService && this.settings.anthropicApiKey) {
                    new Notice('Claude service is initialized and an API key is configured.');
                } else if (this.claudeService) {
                    new Notice('Claude service is initialized but no API key is set.');
                } else {
                    new Notice('Claude service is not initialized.');
                }
            },
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
            name: 'Show LM Studio settings',
            callback: () => {
                new Notice(`Current LM Studio URL: ${this.settings.lmStudioEndpoint}`);
                console.debug('LM Studio Settings:', this.settings);
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
            name: 'Generate one-page article',
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
                    new Notice('Failed to open article generator modal. Check console for details.');
                }
            }
        });
    }

    private registerTextEnhancementCommands(): void {
        // Register Text Enhancement command
        this.addCommand({
            id: 'enhance-text',
            name: 'Enhance selected text with Perplexity',
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
                    new Notice('Failed to open text enhancement modal. Check console for details.');
                }
            }
        });
    }

    private registerTextEnhancementWithImagesCommands(): void {
        // Register Get Related Images command
        this.addCommand({
            id: 'enhance-text-with-images',
            name: 'Get related images for selected text',
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
                    new Notice('Failed to open get related images modal. Check console for details.');
                }
            }
        });
    }

    private debugCommands(): void {
        console.debug('=== Perplexed Plugin Debug Information ===');
        console.debug('Plugin instance:', this);
        console.debug('Settings:', this.settings);
        console.debug('Services status:');
        console.debug('- PromptsService:', this.promptsService ? 'Initialized' : 'NOT INITIALIZED');
        console.debug('- PerplexityService:', this.perplexityService ? 'Initialized' : 'NOT INITIALIZED');
        console.debug('- PerplexicaService:', this.perplexicaService ? 'Initialized' : 'NOT INITIALIZED');
        console.debug('- LMStudioService:', this.lmStudioService ? 'Initialized' : 'NOT INITIALIZED');
        
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
        
        console.debug('Registered Perplexed commands:', perplexedCommands);
        
        if (perplexedCommands.length === 0) {
            new Notice('No perplexed commands found! Check console for details.');
        } else {
            new Notice(`Found ${perplexedCommands.length} Perplexed commands. Check console for details.`);
        }
        
        console.debug('=== End Debug Information ===');
    }

    private async resetPromptsToDefault(): Promise<void> {
        try {
            console.debug('Perplexed Plugin: Resetting prompts to default...');
            new Notice('Resetting prompts to default values...');
            
            // Reset all prompt settings to default values
            this.settings.prompts = { ...DEFAULT_SETTINGS.prompts };
            
            // Save the updated settings
            await this.saveSettings();
            
            // Reinitialize the prompts service with new settings
            if (this.promptsService) {
                this.promptsService.updateSettings(this.settings.prompts);
                console.debug('Perplexed Plugin: PromptsService updated with default settings');
            }
            
            new Notice('✅ Prompts reset to default values successfully');
            console.debug('Perplexed Plugin: Prompts reset to default successfully');
            
        } catch (error) {
            console.error('Perplexed Plugin: Failed to reset prompts to default:', error);
            new Notice('❌ Failed to reset prompts to default. Check console for details.');
        }
    }

    private reinitializeServices(): void {
        try {
            console.debug('Perplexed Plugin: Reinitializing services...');
            new Notice('Reinitializing perplexed services...');
            
            // Reinitialize prompts service first
            try {
                this.promptsService = new PromptsService(this.settings.prompts);
                console.debug('Perplexed Plugin: PromptsService reinitialized successfully');
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
                    console.debug('Perplexed Plugin: PerplexityService reinitialized successfully');
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
                    console.debug('Perplexed Plugin: PerplexicaService reinitialized successfully');
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
                    console.debug('Perplexed Plugin: LMStudioService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize LMStudioService:', error);
                    this.lmStudioService = null;
                }

                try {
                    this.claudeService = new ClaudeService({
                        anthropicApiKey: this.settings.anthropicApiKey,
                        promptsService: this.promptsService,
                        headerPosition: this.settings.headerPosition,
                    });
                    console.debug('Perplexed Plugin: ClaudeService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize ClaudeService:', error);
                    this.claudeService = null;
                }

                try {
                    this.geminiService = new GeminiService({
                        geminiApiKey: this.settings.geminiApiKey,
                        promptsService: this.promptsService,
                        headerPosition: this.settings.headerPosition,
                    });
                    console.debug('Perplexed Plugin: GeminiService reinitialized successfully');
                } catch (error) {
                    console.error('Perplexed Plugin: Failed to reinitialize GeminiService:', error);
                    this.geminiService = null;
                }
            } else {
                // If promptsService failed, set all other services to null
                this.perplexityService = null;
                this.perplexicaService = null;
                this.lmStudioService = null;
                this.claudeService = null;
                this.geminiService = null;
                console.debug('Perplexed Plugin: Skipping service reinitialization due to PromptsService failure');
            }
            
            new Notice('Services reinitialization completed. Check console for details.');
            console.debug('Perplexed Plugin: Services reinitialization completed');
            
        } catch (error) {
            console.error('Perplexed Plugin: Error during services reinitialization:', error);
            new Notice('Failed to reinitialize services. Check console for details.');
        }
    }

    private buildDirectoryTemplateSettings(): DirectoryTemplateSettings {
        return {
            perplexityApiKey: this.settings.perplexityApiKey,
            perplexityEndpoint: this.settings.perplexityEndpoint,
            templatesRoot: this.settings.directoryTemplatesRoot,
            partialsRoot: this.settings.directoryTemplatesPartialsRoot,
            preamblesRoot: this.settings.directoryTemplatesPreamblesRoot,
            // The settings lists can hold a just-added, still-empty entry.
            systemPreambles: this.settings.directoryTemplatesSystemPreambles.filter(n => n.trim()),
            userPreambles: this.settings.directoryTemplatesUserPreambles.filter(p => p.name.trim()),
            frontmatterWhitelist: this.settings.directoryTemplatesFrontmatterWhitelist.filter(k => k.trim()),
            requestTimeoutMs: this.settings.directoryTemplatesRequestTimeoutMs,
            historyRoot: this.settings.directoryTemplatesHistoryRoot,
            exaEnabled: this.settings.exaEnabled,
            exaApiKey: this.settings.exaApiKey,
            exaEndpoint: this.settings.exaEndpoint,
            exaSplicedContextMaxChars: this.settings.exaSplicedContextMaxChars,
        };
    }

    private async runApplyDirectoryTemplate(): Promise<void> {
        const target = this.app.workspace.getActiveFile();
        if (!target) {
            new Notice('No active file.');
            return;
        }
        if (!this.settings.perplexityApiKey) {
            new Notice('Perplexity API key is not set. Configure it in perplexed settings.');
            return;
        }

        const root = this.settings.directoryTemplatesRoot;
        const all = listDirectoryTemplates(this.app, root);
        if (all.length === 0) {
            new Notice(`No templates found under "${root}".`);
            return;
        }

        const matching = all.filter(t => pathMatchesGlobs(target.path, t.appliesToPaths));
        if (matching.length === 0) {
            new Notice("No template's applies-to-paths matches this file.");
            return;
        }

        const dirSettings: DirectoryTemplateSettings = this.buildDirectoryTemplateSettings();

        // Load every matching template up front so the run modal can show
        // each one's cft model as the default in the model selector.
        const choices: TemplateRunChoice[] = [];
        for (const tf of matching) {
            const parsed = await loadDirectoryTemplate(this.app, tf.file);
            if (parsed) choices.push({ template: parsed, title: tf.title });
        }
        if (choices.length === 0) {
            new Notice('Template parse error: missing or malformed cft block.');
            return;
        }

        // Does the target already have a body? Decides whether the run dialog
        // offers the append/remake/replace choice at all.
        const targetRaw = await this.app.vault.read(target);
        const targetBody = targetRaw.replace(/^---\n[\s\S]*?\n---\n/, '');
        const bodyIsPopulated = targetBody.trim().length > 0;

        new DirectoryTemplateRunModal(this.app, choices, (template, model, useRetrieval, mode) => {
            void applyDirectoryTemplate(this.app, dirSettings, target, template, {
                modelOverride: model,
                useRetrieval,
                modeOverride: mode,
            });
        }, this.settings.exaEnabled, bodyIsPopulated).open();
    }

    private runApplyDirectoryTemplateBatch(): void {
        if (!this.settings.perplexityApiKey) {
            new Notice('Perplexity API key is not set. Configure it in perplexed settings.');
            return;
        }

        new FolderPickerModal(this.app, (folder) => {
            void (async () => {
                const folderPath = folder.path;
                const filesInFolder = listMarkdownFilesInFolder(this.app, folderPath);
                if (filesInFolder.length === 0) {
                    new Notice(`No markdown files in "${folderPath || '/'}".`);
                    return;
                }

                const all = listDirectoryTemplates(this.app, this.settings.directoryTemplatesRoot);
                const matchingTemplates = all.filter(t =>
                    filesInFolder.some(f => pathMatchesGlobs(f.path, t.appliesToPaths))
                );
                if (matchingTemplates.length === 0) {
                    new Notice('No template matches any file in this folder.');
                    return;
                }

                new DirectoryTemplatePickerModal(this.app, matchingTemplates, (chosen) => {
                    void (async () => {
                        const parsed = await loadDirectoryTemplate(this.app, chosen.file);
                        if (!parsed) {
                            new Notice('Template parse error: missing or malformed cft block.');
                            return;
                        }

                        const filesForThisTemplate = filesInFolder.filter(f =>
                            pathMatchesGlobs(f.path, chosen.appliesToPaths)
                        );

                        let fillCount = 0;
                        let appendCount = 0;
                        for (const f of filesForThisTemplate) {
                            const content = await this.app.vault.cachedRead(f);
                            const afterFm = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
                            if (afterFm.trim().length === 0) fillCount++;
                            else appendCount++;
                        }

                        const dirSettings: DirectoryTemplateSettings = this.buildDirectoryTemplateSettings();

                        new BatchConfirmModal(this.app, {
                            folderPath,
                            templateTitle: chosen.title,
                            fileCount: filesForThisTemplate.length,
                            fillCount,
                            appendCount,
                        }, () => {
                            void this.executeBatch(dirSettings, parsed, filesForThisTemplate);
                        }).open();
                    })();
                }).open();
            })();
        }).open();
    }

    private async executeBatch(
        dirSettings: DirectoryTemplateSettings,
        parsed: ParsedTemplate,
        files: TFile[],
    ): Promise<void> {
        this.batchCancelled = false;
        const progressNotice = new Notice(`Batch starting on ${files.length.toString()} files…`, 0);

        try {
            const result = await applyDirectoryTemplateBatch(
                this.app,
                dirSettings,
                files,
                parsed,
                (p) => {
                    progressNotice.setMessage(
                        `Applying ${p.current.toString()}/${p.total.toString()}: ${p.file.basename}`
                    );
                },
                () => this.batchCancelled,
            );

            const summary = [
                `Batch ${result.cancelled ? 'cancelled' : 'complete'}.`,
                `Filled: ${result.appliedFill.toString()}`,
                `Appended: ${result.appliedAppend.toString()}`,
                `Errored: ${result.errored.toString()}`,
            ].join(' ');
            new Notice(summary, 8000);

            if (result.errors.length > 0) {
                console.warn('Directory-template batch errors:', result.errors);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`Batch failed: ${msg}`);
        } finally {
            progressNotice.hide();
            this.batchCancelled = false;
        }
    }
}
