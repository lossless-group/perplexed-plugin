// Perplexed settings: the stored shape, its defaults, and the settings tab.
import type { App, SettingDefinitionItem, SettingGroupItem } from 'obsidian';
import { Notice, PluginSettingTab } from 'obsidian';
import type PerplexedPlugin from '../../main';
import { EXA_SEARCH_ENDPOINT } from '../services/exaService';
import { reSeedMissingFiles } from '../services/templateSeederService';

export interface PerplexedPluginSettings {
    mySetting: string;
    localLLMPath: string;
    requestBodyTemplate: string;
    perplexityRequestTemplate: string;
    perplexityApiKey: string;
    perplexicaEndpoint: string;
    perplexityEndpoint: string;
    lmStudioEndpoint: string;
    lmStudioRequestTemplate: string;
    anthropicApiKey: string;
    claudeDefaultModel: string;
    geminiApiKey: string;
    geminiDefaultModel: string;
    geminiEnableGrounding: boolean;
    geminiIncludeSearchSuggestions: boolean;
    geminiResolveCitationUrls: boolean;
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

    // Directory templates (v0.1 spike — see context-v/specs/Per-Directory-Profile-Templates.md)
    directoryTemplatesRoot: string;
    directoryTemplatesPartialsRoot: string;
    directoryTemplatesPreamblesRoot: string;
    directoryTemplatesSystemPreambles: string[];
    directoryTemplatesUserPreambles: { name: string; when: 'always' | 'return-images' }[];
    directoryTemplatesFrontmatterWhitelist: string[];
    directoryTemplatesRequestTimeoutMs: number;

    // Exa retrieval stage — see context-v/plans/2026-09-10_Exa-Retrieval-Stage-and-Include-Sources.md
    directoryTemplatesHistoryRoot: string;
    exaEnabled: boolean;
    exaApiKey: string;
    exaEndpoint: string;
    exaSplicedContextMaxChars: number;

    // Find images for selection
    findImagesMaxImages: number;
}

export const DEFAULT_SETTINGS: PerplexedPluginSettings = {
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
    perplexityApiKey: '',
    anthropicApiKey: '',
    claudeDefaultModel: 'claude-opus-4-7',
    geminiApiKey: '',
    geminiDefaultModel: 'gemini-flash-latest',
    geminiEnableGrounding: true,
    geminiIncludeSearchSuggestions: true,
    geminiResolveCitationUrls: true,
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
        perplexicaQueryPlaceholder: "What would you like to ask Perplexica / Vane?",
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
    },

    // Directory templates (v0.1 spike defaults)
    directoryTemplatesRoot: 'zz-cf-lib/templates',
    directoryTemplatesPartialsRoot: 'zz-cf-lib/partials',
    directoryTemplatesPreamblesRoot: 'zz-cf-lib/preambles',
    directoryTemplatesSystemPreambles: ['inline-citation'],
    directoryTemplatesUserPreambles: [
        { name: 'research-framing', when: 'always' },
        { name: 'image-placement', when: 'return-images' },
    ],
    directoryTemplatesFrontmatterWhitelist: ['title', 'og_description', 'tags', 'og_image'],
    directoryTemplatesRequestTimeoutMs: 1800000,

    // Exa retrieval stage defaults
    directoryTemplatesHistoryRoot: 'zz-cf-lib/history',
    exaEnabled: true,
    exaApiKey: '',
    exaEndpoint: EXA_SEARCH_ENDPOINT,
    exaSplicedContextMaxChars: 12000,

    // Find images for selection
    findImagesMaxImages: 3
};

// ─── Settings tab (Obsidian ≥ 1.13 declarative API) ─────────────────────
//
// Obsidian renders these definitions and indexes them for settings search,
// so a row that fails can no longer take every later section down with it,
// and there is no display() override. Controls bind to dot-path keys into
// plugin.settings (e.g. "prompts.enhancePrompt") through getControlValue /
// setControlValue below.

type UserPreamble = PerplexedPluginSettings['directoryTemplatesUserPreambles'][number];

/** Request templates shown pretty-printed when they parse as JSON, as in 0.3.x. */
const JSON_TEMPLATE_KEYS = new Set(['perplexityRequestTemplate', 'requestBodyTemplate', 'lmStudioRequestTemplate']);

/** Keys whose values are trimmed before saving, as in 0.3.x. */
const TRIMMED_KEYS = new Set([
    'exaApiKey',
    'exaEndpoint',
    'directoryTemplatesRoot',
    'directoryTemplatesPartialsRoot',
    'directoryTemplatesPreamblesRoot',
]);

/** Toggles that other rows' `visible` predicates depend on. */
const VISIBILITY_KEYS = new Set(['exaEnabled']);

const CLAUDE_MODELS: Record<string, string> = {
    'claude-opus-4-7': 'claude-opus-4-7 (recommended)',
    'claude-opus-4-6': 'claude-opus-4-6',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
    'claude-haiku-4-5': 'claude-haiku-4-5',
};

const GEMINI_MODELS: Record<string, string> = {
    'gemini-flash-latest': 'Gemini flash (latest), recommended',
    'gemini-pro-latest': 'Gemini pro (latest)',
    'gemini-2.5-pro': 'Gemini 2.5 pro (pinned)',
    'gemini-2.5-flash': 'Gemini 2.5 flash (pinned)',
};

function getPath(root: unknown, path: string): unknown {
    let current: unknown = root;
    for (const part of path.split('.')) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/** Writes `value` at an existing dot path. Returns false (and writes nothing) for unknown paths. */
function setPath(root: object, path: string, value: unknown): boolean {
    const parts = path.split('.');
    const last = parts.pop();
    if (last === undefined) return false;
    let current: unknown = root;
    for (const part of parts) {
        if (current === null || typeof current !== 'object') return false;
        current = (current as Record<string, unknown>)[part];
    }
    if (current === null || typeof current !== 'object') return false;
    (current as Record<string, unknown>)[last] = value;
    return true;
}

/** A key is settable when DEFAULT_SETTINGS defines it, so typos never grow data.json. */
function isSettingKey(key: string): boolean {
    return getPath(DEFAULT_SETTINGS, key) !== undefined;
}

function positiveWholeNumber(value: number): string | undefined {
    return Number.isInteger(value) && value > 0 ? undefined : 'Enter a whole number greater than 0.';
}

/** Keeps a stored value selectable even when it is not one of the built-in options. */
function withStoredOption(options: Record<string, string>, stored: unknown): Record<string, string> {
    if (typeof stored !== 'string' || stored === '' || stored in options) return options;
    return { ...options, [stored]: stored };
}

export class PerplexedSettingTab extends PluginSettingTab {
    plugin: PerplexedPlugin;

    constructor(app: App, plugin: PerplexedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getControlValue(key: string): unknown {
        const value = getPath(this.plugin.settings, key);
        if (JSON_TEMPLATE_KEYS.has(key) && typeof value === 'string' && value) {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }
        return value;
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        if (!isSettingKey(key)) return;
        const stored = TRIMMED_KEYS.has(key) && typeof value === 'string' ? value.trim() : value;
        if (!setPath(this.plugin.settings, key, stored)) return;
        if (key.startsWith('prompts.')) {
            this.plugin.getPromptsService()?.updateSettings(this.plugin.settings.prompts);
        }
        await this.plugin.saveSettings();
        // Re-evaluate `visible` predicates in place; keeps focus in the field.
        if (VISIBILITY_KEYS.has(key)) this.refreshDomState();
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            { type: 'group', heading: 'Perplexity (remote service)', cls: 'perplexed-settings-provider', items: this.perplexityItems() },
            { type: 'group', heading: 'Claude (Anthropic)', items: this.claudeItems() },
            { type: 'group', heading: 'Gemini (Google)', items: this.geminiItems() },
            { type: 'group', heading: 'Perplexica / Vane (self-hosted)', cls: 'perplexed-settings-provider', items: this.perplexicaItems() },
            { type: 'group', heading: 'LM Studio (local models)', cls: 'perplexed-settings-provider', items: this.lmStudioItems() },
            { type: 'group', heading: 'Exa retrieval', items: this.exaItems() },
            ...this.promptGroups(),
            { type: 'group', heading: 'Directory templates', items: this.directoryTemplateItems() },
            this.stringList({
                heading: 'System preambles',
                itemNoun: 'preamble',
                emptyState: 'No system preambles. Every system prompt is sent as written.',
                get: () => this.plugin.settings.directoryTemplatesSystemPreambles,
                desc: 'Preamble file name (no .md), prepended to every system prompt, in list order.',
                placeholder: 'inline-citation',
            }),
            this.userPreambleList(),
            this.stringList({
                heading: 'Frontmatter whitelist',
                itemNoun: 'key',
                emptyState: 'No keys. Templates receive an empty {{frontmatter}}.',
                get: () => this.plugin.settings.directoryTemplatesFrontmatterWhitelist,
                desc: 'Frontmatter key passed to templates as {{frontmatter}}. Keys not listed are filtered out.',
                placeholder: 'og_description',
            }),
            { type: 'group', heading: 'Find images for selection', items: this.findImagesItems() },
        ];
    }

    /** Persist, then rebuild the definitions (list add, delete, reorder). */
    private async saveAndRebuild(): Promise<void> {
        await this.plugin.saveSettings();
        this.update();
    }

    private perplexityItems(): SettingGroupItem[] {
        return [
            {
                name: 'Endpoint',
                desc: 'API endpoint for Perplexity service',
                aliases: ['Perplexity endpoint'],
                control: { type: 'text', key: 'perplexityEndpoint', placeholder: 'https://api.perplexity.ai/chat/completions' },
            },
            {
                name: 'API key',
                desc: 'Your Perplexity API key (required for remote service)',
                aliases: ['Perplexity API key'],
                control: { type: 'text', key: 'perplexityApiKey', placeholder: 'pplx-…' },
            },
            {
                name: 'Header position',
                desc: 'Where to place the query header in generated articles',
                control: {
                    type: 'dropdown',
                    key: 'headerPosition',
                    options: { top: 'Top of article', bottom: 'Bottom of article' },
                    defaultValue: 'top',
                },
            },
            {
                name: 'Request body template',
                desc: 'JSON template for Perplexity API requests',
                aliases: ['Perplexity request body template'],
                control: { type: 'textarea', key: 'perplexityRequestTemplate', placeholder: 'Enter Perplexity JSON request template...', rows: 10 },
            },
        ];
    }

    private claudeItems(): SettingGroupItem[] {
        return [
            {
                name: 'About Claude',
                desc: 'Configure Claude API access. Web-search citations are supported; document-grounded citations are not yet.',
            },
            {
                name: 'Anthropic API key',
                desc: 'Your Anthropic API key. After changing it, run "Reinitialize provider services".',
                aliases: ['Claude API key'],
                control: { type: 'text', key: 'anthropicApiKey', placeholder: 'sk-ant-…' },
            },
            {
                name: 'Default Claude model',
                desc: 'Default model used by the ask Claude command.',
                control: {
                    type: 'dropdown',
                    key: 'claudeDefaultModel',
                    options: withStoredOption(CLAUDE_MODELS, this.plugin.settings.claudeDefaultModel),
                },
            },
        ];
    }

    private geminiItems(): SettingGroupItem[] {
        return [
            {
                name: 'About Gemini',
                desc: 'Configure Gemini API access. Gemini\'s Google search tool returns grounding supports that map each span of text to its sources: the per-claim attribution that Claude\'s dynamic-filter pass loses.',
            },
            {
                name: 'Gemini API key',
                desc: 'Your Google AI studio API key. After changing it, run "Reinitialize provider services".',
                control: { type: 'text', key: 'geminiApiKey', placeholder: 'AIza…' },
            },
            {
                name: 'Default Gemini model',
                desc: 'Default model used by the ask Gemini command. Gemini flash (latest) is recommended and free-tier friendly.',
                control: {
                    type: 'dropdown',
                    key: 'geminiDefaultModel',
                    options: withStoredOption(GEMINI_MODELS, this.plugin.settings.geminiDefaultModel),
                },
            },
            {
                name: 'Enable Google search grounding by default',
                desc: 'Sends the Google search tool with every request. Disable to get ungrounded model knowledge only.',
                control: { type: 'toggle', key: 'geminiEnableGrounding' },
            },
            {
                name: 'Include Google searches list in notes',
                desc: 'Appends a Markdown "Google searches" section listing the queries Gemini ran, each linked to Google search. A Markdown-native substitute for the Google grounding chip, which is inline-styled HTML that Obsidian can\'t render cleanly.',
                control: { type: 'toggle', key: 'geminiIncludeSearchSuggestions' },
            },
            {
                name: 'Resolve citation URLs (durable, slower)',
                desc: 'Google\'s grounding redirect URLs expire about 30 days after the response. With this on, each redirect is resolved to the real source URL before the citations footer is written. Costs one HTTP request per cited source (in parallel, 3s timeout each).',
                control: { type: 'toggle', key: 'geminiResolveCitationUrls' },
            },
        ];
    }

    private perplexicaItems(): SettingGroupItem[] {
        return [
            {
                name: 'Endpoint',
                desc: 'API endpoint for your local Perplexica / Vane instance',
                aliases: ['Perplexica endpoint', 'Vane endpoint'],
                control: { type: 'text', key: 'perplexicaEndpoint', placeholder: 'http://localhost:3030/api/search' },
            },
            {
                name: 'Fallback container path',
                desc: 'Alternative endpoint for Docker container setups',
                control: { type: 'text', key: 'localLLMPath', placeholder: 'http://host.docker.internal:3030/api/search' },
            },
            {
                name: 'Default model',
                desc: 'Default AI model for Perplexica / Vane to use',
                aliases: ['Perplexica default model', 'Vane default model'],
                control: { type: 'text', key: 'defaultModel', placeholder: 'llama3.2:latest' },
            },
            {
                name: 'Request body template',
                desc: 'JSON template for Perplexica / Vane API requests',
                aliases: ['Perplexica request body template', 'Vane request body template'],
                control: { type: 'textarea', key: 'requestBodyTemplate', placeholder: 'Enter Perplexica JSON request template...', rows: 10 },
            },
        ];
    }

    private lmStudioItems(): SettingGroupItem[] {
        return [
            {
                name: 'Endpoint',
                desc: 'API endpoint for your local LM Studio instance',
                aliases: ['LM Studio endpoint'],
                control: { type: 'text', key: 'lmStudioEndpoint', placeholder: 'http://localhost:1234/v1/chat/completions' },
            },
            {
                name: 'Default model',
                desc: 'Default model name for LM Studio to use',
                aliases: ['LM Studio default model'],
                control: { type: 'text', key: 'defaultLMStudioModel', placeholder: 'ibm/granite-3.2-8b' },
            },
            {
                name: 'Request body template',
                desc: 'JSON template for LM Studio API requests',
                aliases: ['LM Studio request body template'],
                control: { type: 'textarea', key: 'lmStudioRequestTemplate', placeholder: 'Enter LM Studio JSON request template...', rows: 10 },
            },
        ];
    }

    private exaItems(): SettingGroupItem[] {
        const enabled = () => this.plugin.settings.exaEnabled !== false;
        return [
            {
                name: 'About Exa retrieval',
                desc: 'Exa finds and extracts source material. It is markedly better than grounded web search at identifying the right company and returning structured facts about it. When a template declares include-sources, Exa runs first and its results are spliced into the prompt as named, citeable sources; the writing model still writes. A retrieval failure never aborts a run: the run proceeds without the extra sources.',
            },
            {
                name: 'Use Exa retrieval',
                desc: 'Master switch. When off, templates that declare include-sources run Perplexity-only, exactly as they did before Exa existed. Individual runs can also opt out from the run dialog.',
                control: { type: 'toggle', key: 'exaEnabled', defaultValue: true },
            },
            {
                name: 'Exa API key',
                desc: 'From dashboard.exa.ai. New accounts get $20 in credits plus $10/month free; a typical retrieval costs about $0.02.',
                visible: enabled,
                control: { type: 'text', key: 'exaApiKey', placeholder: 'Enter your Exa API key' },
            },
            {
                name: 'Exa endpoint',
                desc: 'Search endpoint. Only change this if you are proxying Exa.',
                visible: enabled,
                control: { type: 'text', key: 'exaEndpoint', placeholder: EXA_SEARCH_ENDPOINT },
            },
            {
                name: 'Spliced context budget (characters)',
                desc: 'Ceiling on how much retrieved source text is inserted into a prompt. This is an attention budget, not a cost one: past roughly this much pasted text the writing model starts following the sources instead of the section outline, which looks like a healthy run that quietly ignored its instructions. Excess sources are dropped with a visible marker rather than silently. Default 12000.',
                visible: enabled,
                control: {
                    type: 'number',
                    key: 'exaSplicedContextMaxChars',
                    placeholder: '12000',
                    min: 1,
                    step: 1,
                    defaultValue: DEFAULT_SETTINGS.exaSplicedContextMaxChars,
                    validate: positiveWholeNumber,
                },
            },
        ];
    }

    private promptGroups(): SettingDefinitionItem[] {
        const cls = 'perplexed-settings-prompts';
        return [
            {
                type: 'group',
                heading: 'System prompts',
                cls,
                items: [
                    {
                        name: 'Perplexity system prompt',
                        desc: 'System prompt used for Perplexity requests',
                        control: { type: 'textarea', key: 'prompts.perplexitySystemPrompt', placeholder: 'Enter system prompt for Perplexity...', rows: 3 },
                    },
                    {
                        name: 'Perplexica / Vane system prompt',
                        desc: 'System prompt used for Perplexica / Vane requests',
                        control: { type: 'textarea', key: 'prompts.perplexicaSystemPrompt', placeholder: 'Enter system prompt for Perplexica / Vane...', rows: 3 },
                    },
                    {
                        name: 'LM Studio default system prompt',
                        desc: 'Default system prompt used for LM Studio requests',
                        control: { type: 'textarea', key: 'prompts.lmStudioDefaultSystemPrompt', placeholder: 'Enter default system prompt for LM Studio...', rows: 3 },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Placeholder text',
                items: [
                    {
                        name: 'Perplexity query placeholder',
                        desc: 'Placeholder text for Perplexity query input',
                        control: { type: 'text', key: 'prompts.perplexityQueryPlaceholder', placeholder: 'Enter placeholder text...' },
                    },
                    {
                        name: 'Perplexica / Vane query placeholder',
                        desc: 'Placeholder text for Perplexica / Vane query input',
                        control: { type: 'text', key: 'prompts.perplexicaQueryPlaceholder', placeholder: 'Enter placeholder text...' },
                    },
                    {
                        name: 'LM Studio query placeholder',
                        desc: 'Placeholder text for LM Studio query input',
                        control: { type: 'text', key: 'prompts.lmStudioQueryPlaceholder', placeholder: 'Enter placeholder text...' },
                    },
                    {
                        name: 'LM Studio system prompt placeholder',
                        desc: 'Placeholder text for LM Studio system prompt input',
                        control: { type: 'text', key: 'prompts.lmStudioSystemPromptPlaceholder', placeholder: 'Enter placeholder text...' },
                    },
                    {
                        name: 'Article term placeholder',
                        desc: 'Placeholder text for article generator term input',
                        control: { type: 'text', key: 'prompts.articleTermPlaceholder', placeholder: 'Enter placeholder text...' },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Article generator templates',
                cls,
                items: [
                    {
                        name: 'Article generator template',
                        desc: 'Template for generating articles. Use {TERM} as placeholder for the term.',
                        control: { type: 'textarea', key: 'prompts.articleGeneratorTemplate', placeholder: 'Enter article generator template...', rows: 15 },
                    },
                    {
                        name: 'Deep research article generator template',
                        desc: 'Template for generating articles with the deep research model. Use {TERM} as placeholder for the term.',
                        control: { type: 'textarea', key: 'prompts.deepResearchArticleTemplate', placeholder: 'Enter deep research article generator template...', rows: 20 },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Image prompts',
                cls,
                items: [
                    {
                        name: 'Image references prompt',
                        desc: 'Prompt added to queries when images are enabled',
                        control: { type: 'textarea', key: 'prompts.imageReferencesPrompt', placeholder: 'Enter image references prompt...', rows: 8 },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Text enhancement',
                cls,
                items: [
                    {
                        name: 'Text enhancement prompt',
                        desc: 'Template for enhancing selected text. Use {TEXT} as placeholder for the selected text.',
                        control: { type: 'textarea', key: 'prompts.enhancePrompt', placeholder: 'Enter text enhancement prompt template...', rows: 10 },
                    },
                    {
                        name: 'Related images prompt',
                        desc: 'Template for requesting related images for selected text. Use {TEXT} as placeholder for the selected text.',
                        control: { type: 'textarea', key: 'prompts.enhanceWithImagesPrompt', placeholder: 'Enter related images prompt template...', rows: 10 },
                    },
                ],
            },
        ];
    }

    private directoryTemplateItems(): SettingGroupItem[] {
        return [
            {
                name: 'About directory templates',
                desc: 'Apply a template (heading skeleton plus per-section bullets) to fill a file via Perplexity deep research. Templates live in a vault folder and are matched to files by glob. The preamble and frontmatter lists follow this section.',
            },
            {
                name: 'Templates root',
                desc: 'Vault-relative folder where directory templates live.',
                control: { type: 'folder', key: 'directoryTemplatesRoot', placeholder: 'zz-cf-lib/templates' },
            },
            {
                name: 'Partials root',
                desc: 'Vault-relative folder where reusable snippets live. Templates pull them in with {{include: name}}.',
                control: { type: 'folder', key: 'directoryTemplatesPartialsRoot', placeholder: 'zz-cf-lib/partials' },
            },
            {
                name: 'Preambles root',
                desc: 'Vault-relative folder where plugin-wide preambles live. Files here are attached to every Perplexity request per the preamble lists below.',
                control: { type: 'folder', key: 'directoryTemplatesPreamblesRoot', placeholder: 'zz-cf-lib/preambles' },
            },
            {
                name: 'Request timeout (ms)',
                desc: 'Maximum wall-clock time to wait for a Perplexity response. Default 1800000 (30 min): generous, because deep-research runs on long analyst-grade templates routinely take 15-25 min, and the $10-$50 of value per good output is worth waiting for. Individual templates may override this with request-timeout-ms in their cft block.',
                control: {
                    type: 'number',
                    key: 'directoryTemplatesRequestTimeoutMs',
                    placeholder: '1800000',
                    min: 1,
                    step: 1,
                    defaultValue: DEFAULT_SETTINGS.directoryTemplatesRequestTimeoutMs,
                    validate: positiveWholeNumber,
                },
            },
            {
                name: 'Re-seed templates',
                desc: 'Write any shipped template files that are missing from the templates root. Existing files are never overwritten; to reset a template to its shipped default, delete the file first, then re-seed.',
                render: (setting) => {
                    setting.addButton(button => button
                        .setButtonText('Re-seed')
                        .onClick(async () => {
                            button.setDisabled(true);
                            try {
                                await reSeedMissingFiles(
                                    this.plugin.app,
                                    this.plugin.settings.directoryTemplatesRoot,
                                    this.plugin.settings.directoryTemplatesPartialsRoot,
                                    this.plugin.settings.directoryTemplatesPreamblesRoot,
                                );
                            } catch (error) {
                                const msg = error instanceof Error ? error.message : String(error);
                                new Notice(`Re-seed failed: ${msg}`);
                            } finally {
                                button.setDisabled(false);
                            }
                        }));
                },
            },
        ];
    }

    /** An editable list of plain strings stored as a string[] setting. */
    private stringList(opts: {
        heading: string;
        itemNoun: string;
        emptyState: string;
        desc: string;
        placeholder: string;
        get: () => string[];
    }): SettingDefinitionItem {
        const values = opts.get();
        return {
            type: 'list',
            heading: opts.heading,
            emptyState: opts.emptyState,
            items: values.map((value, index): SettingGroupItem => ({
                name: value.trim() || `New ${opts.itemNoun}`,
                desc: opts.desc,
                render: (setting) => {
                    setting.addText(text => text
                        .setPlaceholder(opts.placeholder)
                        .setValue(value)
                        .onChange(async (next) => {
                            opts.get()[index] = next.trim();
                            await this.plugin.saveSettings();
                        }));
                },
            })),
            addItem: {
                name: `Add ${opts.itemNoun}`,
                action: () => {
                    opts.get().push('');
                    void this.saveAndRebuild();
                },
            },
            onDelete: (index) => {
                opts.get().splice(index, 1);
                void this.saveAndRebuild();
            },
            onReorder: (oldIndex, newIndex) => {
                const list = opts.get();
                const [moved] = list.splice(oldIndex, 1);
                if (moved !== undefined) list.splice(newIndex, 0, moved);
                void this.saveAndRebuild();
            },
        };
    }

    private userPreambleList(): SettingDefinitionItem {
        const list = () => this.plugin.settings.directoryTemplatesUserPreambles;
        return {
            type: 'list',
            heading: 'User preambles',
            emptyState: 'No user preambles. User prompts are sent as written.',
            items: list().map((preamble: UserPreamble): SettingGroupItem => ({
                name: preamble.name.trim() || 'New preamble',
                desc: 'Preamble file name (no .md), prepended to the user prompt. Attach it always, or only when a template sets return-images: true.',
                aliases: [preamble.when],
                render: (setting) => {
                    setting.addText(text => text
                        .setPlaceholder('Preamble name')
                        .setValue(preamble.name)
                        .onChange(async (next) => {
                            preamble.name = next.trim();
                            await this.plugin.saveSettings();
                        }));
                    setting.addDropdown(dropdown => dropdown
                        .addOption('always', 'Always')
                        .addOption('return-images', 'Only with return-images')
                        .setValue(preamble.when)
                        .onChange(async (next) => {
                            preamble.when = next === 'return-images' ? 'return-images' : 'always';
                            await this.plugin.saveSettings();
                        }));
                },
            })),
            addItem: {
                name: 'Add preamble',
                action: () => {
                    list().push({ name: '', when: 'always' });
                    void this.saveAndRebuild();
                },
            },
            onDelete: (index) => {
                list().splice(index, 1);
                void this.saveAndRebuild();
            },
            onReorder: (oldIndex, newIndex) => {
                const [moved] = list().splice(oldIndex, 1);
                if (moved) list().splice(newIndex, 0, moved);
                void this.saveAndRebuild();
            },
        };
    }

    private findImagesItems(): SettingGroupItem[] {
        return [
            {
                name: 'About find images',
                desc: 'Highlight a passage and run "Find images for selection". Perplexed asks Perplexity for screenshots that illustrate the passage, prefers images on the entity\'s own domain (the frontmatter URL), and embeds them between paragraphs.',
            },
            {
                name: 'Max images',
                desc: 'Maximum number of images to embed per invocation.',
                control: {
                    type: 'number',
                    key: 'findImagesMaxImages',
                    placeholder: '3',
                    min: 1,
                    step: 1,
                    defaultValue: DEFAULT_SETTINGS.findImagesMaxImages,
                    validate: positiveWholeNumber,
                },
            },
        ];
    }
}
