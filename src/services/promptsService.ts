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
        return "⚡ Deep Research: Exhaustive research across hundreds of sources with expert-level analysis. Higher cost but comprehensive results. Supports streaming for real-time updates.";
    }

    getImagesToggleDescription(): string {
        return "Include image results from search - images will be integrated throughout the response where appropriate";
    }

    getImagesToggleGenericDescription(): string {
        return "Include image references throughout the response where appropriate";
    }

    getArticleTermDescription(): string {
        return "Enter a vocabulary term to generate a comprehensive one-page article with images.";
    }

    // Notices and messages
    getDeepResearchLoadingNotice(): string {
        return "🔍 Deep research in progress... This may take up to 60 seconds.";
    }

    getEnterQuestionNotice(): string {
        return "Please enter a question";
    }

    getEnterTermNotice(): string {
        return "Please enter a vocabulary term";
    }

    // Article generator template
    getArticleGeneratorTemplate(term: string): string {
        return this.settings.articleGeneratorTemplate.replace(/{TERM}/g, term);
    }
    
    // Text enhancement template
    getEnhanceTemplate(text: string): string {
        return this.settings.enhancePrompt.replace(/{TEXT}/g, text);
    }
    
    // Text enhancement with images template
    getEnhanceWithImagesTemplate(text: string): string {
        return this.settings.enhanceWithImagesPrompt.replace(/{TEXT}/g, text);
    }
    
    // Get enhance prompt
    getEnhancePrompt(): string {
        return this.settings.enhancePrompt;
    }
    
    // Get enhance with images prompt
    getEnhanceWithImagesPrompt(): string {
        return this.settings.enhanceWithImagesPrompt;
    }

    // Deep Research article generator template
    getDeepResearchArticleTemplate(term: string): string {
        return this.settings.deepResearchArticleTemplate.replace(/{TERM}/g, term);
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