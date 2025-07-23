export interface PromptSettings {
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
}

export class PromptsService {
    private settings: PromptSettings;

    constructor(settings: PromptSettings) {
        this.settings = settings;
    }

    // System prompts
    getPerplexitySystemPrompt(): string {
        return this.settings.perplexitySystemPrompt;
    }

    getPerplexicaSystemPrompt(): string {
        return this.settings.perplexicaSystemPrompt;
    }

    getLMStudioDefaultSystemPrompt(): string {
        return this.settings.lmStudioDefaultSystemPrompt;
    }

    // Placeholder text
    getPerplexityQueryPlaceholder(): string {
        return this.settings.perplexityQueryPlaceholder;
    }

    getPerplexicaQueryPlaceholder(): string {
        return this.settings.perplexicaQueryPlaceholder;
    }

    getLMStudioQueryPlaceholder(): string {
        return this.settings.lmStudioQueryPlaceholder;
    }

    getLMStudioSystemPromptPlaceholder(): string {
        return this.settings.lmStudioSystemPromptPlaceholder;
    }

    getArticleTermPlaceholder(): string {
        return this.settings.articleTermPlaceholder;
    }

    // Descriptions and labels
    getDeepResearchDescription(): string {
        return this.settings.deepResearchDescription;
    }

    getImagesToggleDescription(): string {
        return this.settings.imagesToggleDescription;
    }

    getImagesToggleGenericDescription(): string {
        return this.settings.imagesToggleGenericDescription;
    }

    getArticleTermDescription(): string {
        return this.settings.articleTermDescription;
    }

    // Notices and messages
    getDeepResearchLoadingNotice(): string {
        return this.settings.deepResearchLoadingNotice;
    }

    getEnterQuestionNotice(): string {
        return this.settings.enterQuestionNotice;
    }

    getEnterTermNotice(): string {
        return this.settings.enterTermNotice;
    }

    // Article generator template
    getArticleGeneratorTemplate(term: string): string {
        return this.settings.articleGeneratorTemplate.replace(/{TERM}/g, term);
    }

    // Image prompts
    getImageReferencesPrompt(): string {
        return this.settings.imageReferencesPrompt;
    }

    // Template processing for request bodies
    processTemplate(template: string): string {
        return template
            .replace(/{{PERPLEXITY_SYSTEM_PROMPT}}/g, this.settings.perplexitySystemPrompt)
            .replace(/{{PERPLEXICA_SYSTEM_PROMPT}}/g, this.settings.perplexicaSystemPrompt)
            .replace(/{{LMSTUDIO_SYSTEM_PROMPT}}/g, this.settings.lmStudioDefaultSystemPrompt);
    }

    // Update settings
    updateSettings(newSettings: PromptSettings): void {
        this.settings = newSettings;
    }
} 