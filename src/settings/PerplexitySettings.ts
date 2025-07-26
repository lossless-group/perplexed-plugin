export interface PerplexitySettings {
    // API Configuration
    apiKey: string;
    endpoint: string;
    defaultModel: string;
    
    // Generation Parameters
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    
    // UI Settings
    showStatusBar: boolean;
    autoSuggest: boolean;
    autoSuggestDelay: number;
    showContextMenu: boolean;
    
    // Debugging & Performance
    debugMode: boolean;
    requestTimeout: number;
    maxRetries: number;
    retryDelay: number;
    
    // Prompts
    defaultSystemPrompt: string;
    defaultUserPrompt: string;
    
    // Service-specific properties
    perplexityApiKey: string;
    perplexityEndpoint: string;
    promptsService?: any; // Will be PromptsService type
    requestTemplate?: string;
}

export const DEFAULT_PERPLEXITY_SETTINGS: PerplexitySettings = {
    // API Configuration
    apiKey: '',
    endpoint: 'https://api.perplexity.ai',
    defaultModel: 'pplx-7b-chat',
    perplexityApiKey: '',
    perplexityEndpoint: 'https://api.perplexity.ai',
    
    // Generation Parameters
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5,
    
    // UI Settings
    showStatusBar: true,
    autoSuggest: false,
    autoSuggestDelay: 1000,
    showContextMenu: true,
    
    // Debugging & Performance
    debugMode: false,
    requestTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    
    // Prompts
    defaultSystemPrompt: 'You are a helpful AI assistant.',
    defaultUserPrompt: 'How can I help you today?',
    
    // Service-specific properties
    requestTemplate: ''
};
