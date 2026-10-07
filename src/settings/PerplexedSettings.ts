// Perplexed settings: the stored shape, its defaults, and the settings tab.
import type { App } from 'obsidian';
import { Notice, PluginSettingTab, Setting } from 'obsidian';
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

export class PerplexedSettingTab extends PluginSettingTab {
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

        // Perplexity Section
        new Setting(containerEl).setName("Perplexity (remote service)").setHeading();
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
            .setName('API key')
            .setDesc('Your Perplexity API key (required for remote service)')
            .addText(text => text
                .setPlaceholder('Pplx-xxxxxxxxxxxxxxxxxxxxx')
                .setValue(this.plugin.settings.perplexityApiKey)
                .onChange(async (value: string) => {
                    this.plugin.settings.perplexityApiKey = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Header position')
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
            .setName('Request body template')
            .setDesc('JSON template for Perplexity API requests');
            
        // Create a textarea element for Perplexity
        const perplexityTextArea = containerEl.createEl('textarea');
        perplexityTextArea.rows = 10;
        perplexityTextArea.cols = 50;
        perplexityTextArea.addClass('perplexed-json-textarea');
        perplexityTextArea.placeholder = 'Enter Perplexity JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.perplexityRequestTemplate) {
            try {
                const config: unknown = JSON.parse(this.plugin.settings.perplexityRequestTemplate);
                perplexityTextArea.value = JSON.stringify(config, null, 2);
            } catch {
                // If not valid JSON, use as is
                perplexityTextArea.value = this.plugin.settings.perplexityRequestTemplate;
            }
        }
        
        // Add input event listener for Perplexity
        perplexityTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.perplexityRequestTemplate = perplexityTextArea.value;
            await this.plugin.saveSettings();
        })());
        
        // Add the textarea to the setting
        perplexityJsonSetting.settingEl.appendChild(perplexityTextArea);

        // Claude (Anthropic) Section
        new Setting(containerEl).setName("Claude (Anthropic)").setHeading();
        containerEl.createEl('p', {
            text: 'Configure Claude API access. Web-search citations supported in this iteration; document-grounded citations are deferred.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Anthropic API key')
            .setDesc('Your Anthropic API key. Read from ANTHROPIC_API_KEY in .env if set; can be overridden here.')
            .addText(text => text
                .setPlaceholder('Sk-ant-...')
                .setValue(this.plugin.settings.anthropicApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.anthropicApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Claude model')
            .setDesc('Default model used by the ask Claude command. Recommended: Claude-opus-4-7.')
            .addDropdown(dropdown => dropdown
                .addOption('claude-opus-4-7', 'Claude-opus-4-7 (recommended)')
                .addOption('claude-opus-4-6', 'Claude-opus-4-6')
                .addOption('claude-sonnet-4-6', 'Claude-sonnet-4-6')
                .addOption('claude-haiku-4-5', 'Claude-haiku-4-5')
                .setValue(this.plugin.settings.claudeDefaultModel)
                .onChange(async (value) => {
                    this.plugin.settings.claudeDefaultModel = value;
                    await this.plugin.saveSettings();
                }));

        // Gemini (Google) Section
        new Setting(containerEl).setName("Gemini (Google)").setHeading();
        containerEl.createEl('p', {
            text: 'Configure Gemini API access. The Google_search tool emits per-segment grounding supports that map text spans to source urls — the per-claim attribution Claude\'s dynamic-filter pass loses.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Gemini API key')
            .setDesc('Your Google AI studio API key. Generate one in Google AI studio.')
            .addText(text => text
                .setPlaceholder('Aiza...')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Gemini model')
            .setDesc('Default model used by the ask Gemini command. Recommended: Gemini flash (latest) — free-tier friendly.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-flash-latest', 'Gemini flash (latest) — recommended')
                .addOption('gemini-pro-latest', 'Gemini pro (latest)')
                .addOption('gemini-2.5-pro', 'Gemini 2.5 pro (pinned)')
                .addOption('gemini-2.5-flash', 'Gemini 2.5 flash (pinned)')
                .setValue(this.plugin.settings.geminiDefaultModel)
                .onChange(async (value) => {
                    this.plugin.settings.geminiDefaultModel = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Google search grounding by default')
            .setDesc('Sends the Google_search tool with every request. Disable to get ungrounded model knowledge only.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.geminiEnableGrounding)
                .onChange(async (value) => {
                    this.plugin.settings.geminiEnableGrounding = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Google searches list in notes')
            .setDesc('Appends a Markdown "Google searches" section listing the queries Gemini ran, each linked to Google search. Markdown-native substitute for the Google grounding chip (which is inline-styled HTML that Obsidian can\'t render cleanly).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.geminiIncludeSearchSuggestions)
                .onChange(async (value) => {
                    this.plugin.settings.geminiIncludeSearchSuggestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Resolve citation urls (durable, slower)')
            .setDesc('Google\'s grounding redirect urls expire ~30 days after the response. With this on, the plugin resolves each redirect to the real source URL before writing the citations footer. Costs one HTTP request per cited source (parallelized, 3s timeout each).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.geminiResolveCitationUrls)
                .onChange(async (value) => {
                    this.plugin.settings.geminiResolveCitationUrls = value;
                    await this.plugin.saveSettings();
                }));

        // Perplexica / Vane Section
        new Setting(containerEl).setName("Perplexica / Vane (self-hosted)").setHeading();
        containerEl.createEl('p', {
            text: 'Configure settings for your local Perplexica / Vane installation',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('API endpoint for your local Perplexica / Vane instance')
            .addText(text => text
                .setPlaceholder('HTTP://localhost:3030/API/search')
                .setValue(this.plugin.settings.perplexicaEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.perplexicaEndpoint = value;
                    await this.plugin.saveSettings();
                })
            );
        
        new Setting(containerEl)
            .setName('Fallback container path')
            .setDesc('Alternative endpoint for docker container setups')
            .addText(text => text
                .setPlaceholder('HTTP://host.docker.internal:3030/API/search')
                .setValue(this.plugin.settings.localLLMPath)
                .onChange(async (value: string) => {
                    this.plugin.settings.localLLMPath = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Default AI model for Perplexica / Vane to use')
            .addText(text => text
                .setPlaceholder('Llama3.2:latest')
                .setValue(this.plugin.settings.defaultModel)
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                })
            );

        // Perplexica Request Template
        const perplexicaJsonSetting = new Setting(containerEl)
            .setName('Request body template')
            .setDesc('JSON template for Perplexica / Vane API requests');
            
        // Create a textarea element for Perplexica
        const perplexicaTextArea = containerEl.createEl('textarea');
        perplexicaTextArea.rows = 10;
        perplexicaTextArea.cols = 50;
        perplexicaTextArea.addClass('perplexed-json-textarea');
        perplexicaTextArea.placeholder = 'Enter Perplexica JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.requestBodyTemplate) {
            try {
                const config: unknown = JSON.parse(this.plugin.settings.requestBodyTemplate);
                perplexicaTextArea.value = JSON.stringify(config, null, 2);
            } catch {
                // If not valid JSON, use as is
                perplexicaTextArea.value = this.plugin.settings.requestBodyTemplate;
            }
        }
        
        // Add input event listener for Perplexica
        perplexicaTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.requestBodyTemplate = perplexicaTextArea.value;
            await this.plugin.saveSettings();
        })());
        
        // Add the textarea to the setting
        perplexicaJsonSetting.settingEl.appendChild(perplexicaTextArea);

        // LM Studio Section
        new Setting(containerEl).setName("LM Studio (local models)").setHeading();
        containerEl.createEl('p', {
            text: 'Configure settings for your local LM Studio installation with loaded models',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Endpoint')
            .setDesc('API endpoint for your local LM Studio instance')
            .addText(text => text
                .setPlaceholder('HTTP://localhost:1234/v1/chat/completions')
                .setValue(this.plugin.settings.lmStudioEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.lmStudioEndpoint = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Default model name for LM Studio to use')
            .addText(text => text
                .setPlaceholder('Ibm/granite-3.2-8b')
                .setValue(this.plugin.settings.defaultLMStudioModel)
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultLMStudioModel = value;
                    await this.plugin.saveSettings();
                })
            );

        // LM Studio Request Template
        const lmStudioJsonSetting = new Setting(containerEl)
            .setName('Request body template')
            .setDesc('JSON template for LM Studio API requests');
            
        // Create a textarea element for LM Studio
        const lmStudioTextArea = containerEl.createEl('textarea');
        lmStudioTextArea.rows = 10;
        lmStudioTextArea.cols = 50;
        lmStudioTextArea.addClass('perplexed-json-textarea');
        lmStudioTextArea.placeholder = 'Enter LM Studio JSON request template...';
        
        // Set initial value if it exists
        if (this.plugin.settings.lmStudioRequestTemplate) {
            try {
                const config: unknown = JSON.parse(this.plugin.settings.lmStudioRequestTemplate);
                lmStudioTextArea.value = JSON.stringify(config, null, 2);
            } catch {
                // If not valid JSON, use as is
                lmStudioTextArea.value = this.plugin.settings.lmStudioRequestTemplate;
            }
        }
        
        // Add input event listener for LM Studio
        lmStudioTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.lmStudioRequestTemplate = lmStudioTextArea.value;
            await this.plugin.saveSettings();
        })());
        
        // Add the textarea to the setting
        lmStudioJsonSetting.settingEl.appendChild(lmStudioTextArea);

        // Exa retrieval stage
        new Setting(containerEl).setName('Exa retrieval').setHeading();
        containerEl.createEl('p', {
            text: 'Exa finds and extracts source material — it is markedly better than grounded web search at identifying the right company and returning structured facts about it. When a template declares include-sources, Exa runs first and its results are spliced into the prompt as named, citeable sources; the writing model still writes. A retrieval failure never aborts a run — the run proceeds without the extra sources.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Use Exa retrieval')
            .setDesc('Master switch. When off, templates that declare include-sources: run Perplexity-only, exactly as they did before Exa existed. Individual runs can also opt out from the run dialog.')
            .addToggle(t => t
                .setValue(this.plugin.settings.exaEnabled)
                .onChange(async (v: boolean) => {
                    this.plugin.settings.exaEnabled = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Exa API key')
            .setDesc('From dashboard.Exa.ai. New accounts get $20 in credits plus $10/month free — a typical retrieval costs about $0.02.')
            .addText(text => text
                .setPlaceholder('Enter your Exa API key')
                .setValue(this.plugin.settings.exaApiKey)
                .onChange(async (value: string) => {
                    this.plugin.settings.exaApiKey = value.trim();
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Exa endpoint')
            .setDesc('Search endpoint. Only change this if you are proxying Exa.')
            .addText(text => text
                .setPlaceholder(EXA_SEARCH_ENDPOINT)
                .setValue(this.plugin.settings.exaEndpoint)
                .onChange(async (value: string) => {
                    this.plugin.settings.exaEndpoint = value.trim();
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Spliced context budget (characters)')
            .setDesc('Ceiling on how much retrieved source text is inserted into a prompt. This is an attention budget, not a cost one: past roughly this much pasted text the writing model starts following the sources instead of the section outline, which looks like a healthy run that quietly ignored its instructions. Excess sources are dropped with a visible marker rather than silently. Default 12000.')
            .addText(text => text
                .setPlaceholder('12000')
                .setValue(String(this.plugin.settings.exaSplicedContextMaxChars))
                .onChange(async (value: string) => {
                    const n = parseInt(value, 10);
                    if (!isNaN(n) && n > 0) {
                        this.plugin.settings.exaSplicedContextMaxChars = n;
                        await this.plugin.saveSettings();
                    }
                })
            );

        // Prompts Section
        new Setting(containerEl).setName("Prompts & text configuration").setHeading();
        containerEl.createEl('p', {
            text: 'Customize all prompts, placeholders, descriptions, and messages used throughout the plugin',
            cls: 'setting-item-description'
        });

        // System Prompts
        new Setting(containerEl).setName("System prompts").setHeading();

        // Helper: render a system prompt as a Setting (name+desc only) followed
        // by a sibling full-width textarea. Beats Setting.addTextArea — which
        // crams a multi-line input into a ~200px right-edge slot — for any
        // input where the user actually has to read what they wrote.
        const addPromptRow = (
            name: string,
            desc: string,
            placeholder: string,
            getter: () => string,
            setter: (v: string) => void,
        ): void => {
            new Setting(containerEl).setName(name).setDesc(desc);
            const ta = containerEl.createEl('textarea');
            ta.addClass('perplexed-prose-textarea');
            ta.placeholder = placeholder;
            ta.value = getter();
            ta.rows = 3;
            ta.addEventListener('input', () => void (async () => {
                setter(ta.value);
                const promptsService = this.plugin.getPromptsService();
                if (promptsService) {
                    promptsService.updateSettings(this.plugin.settings.prompts);
                }
                await this.plugin.saveSettings();
            })());
        };

        addPromptRow(
            'Perplexity system prompt',
            'System prompt used for perplexity AI requests',
            'Enter system prompt for perplexity...',
            () => this.plugin.settings.prompts.perplexitySystemPrompt,
            (v) => { this.plugin.settings.prompts.perplexitySystemPrompt = v; },
        );

        addPromptRow(
            'Perplexica / vane system prompt',
            'System prompt used for perplexica / vane requests',
            'Enter system prompt for perplexica / vane...',
            () => this.plugin.settings.prompts.perplexicaSystemPrompt,
            (v) => { this.plugin.settings.prompts.perplexicaSystemPrompt = v; },
        );

        addPromptRow(
            'Lm studio default system prompt',
            'Default system prompt used for lm studio requests',
            'Enter default system prompt for lm studio...',
            () => this.plugin.settings.prompts.lmStudioDefaultSystemPrompt,
            (v) => { this.plugin.settings.prompts.lmStudioDefaultSystemPrompt = v; },
        );

        // Placeholder Text
        new Setting(containerEl).setName("Placeholder text").setHeading();
        
        new Setting(containerEl)
            .setName('Perplexity query placeholder')
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
            .setName('Perplexica / Vane query placeholder')
            .setDesc('Placeholder text for Perplexica / Vane query input')
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
            .setName('LM Studio query placeholder')
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
            .setName('LM Studio system prompt placeholder')
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
            .setName('Article term placeholder')
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
        new Setting(containerEl).setName("Article generator template").setHeading();
        
        const articleTemplateSetting = new Setting(containerEl)
            .setName('Article generator template')
            .setDesc('Template for generating articles. Use {TERM} as placeholder for the term.');
            
        const articleTemplateTextArea = containerEl.createEl('textarea');
        articleTemplateTextArea.rows = 15;
        articleTemplateTextArea.cols = 50;
        articleTemplateTextArea.addClasses(['perplexed-json-textarea', 'is-tall']);
        articleTemplateTextArea.placeholder = 'Enter article generator template...';
        articleTemplateTextArea.value = this.plugin.settings.prompts.articleGeneratorTemplate;
        
        articleTemplateTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.prompts.articleGeneratorTemplate = articleTemplateTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        })());
        
        articleTemplateSetting.settingEl.appendChild(articleTemplateTextArea);

        // Deep Research Article Generator Template
        const deepResearchTemplateSetting = new Setting(containerEl)
            .setName('Deep research article generator template')
            .setDesc('Template for generating articles with Deep Research model. Use {TERM} as placeholder for the term.');
            
        const deepResearchTemplateTextArea = containerEl.createEl('textarea');
        deepResearchTemplateTextArea.rows = 20;
        deepResearchTemplateTextArea.cols = 50;
        deepResearchTemplateTextArea.addClasses(['perplexed-json-textarea', 'is-tall']);
        deepResearchTemplateTextArea.placeholder = 'Enter deep research article generator template...';
        deepResearchTemplateTextArea.value = this.plugin.settings.prompts.deepResearchArticleTemplate;
        
        deepResearchTemplateTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.prompts.deepResearchArticleTemplate = deepResearchTemplateTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        })());
        
        deepResearchTemplateSetting.settingEl.appendChild(deepResearchTemplateTextArea);

        // Image Prompts
        new Setting(containerEl).setName("Image prompts").setHeading();
        
        const imagePromptsSetting = new Setting(containerEl)
            .setName('Image references prompt')
            .setDesc('Prompt added to queries when images are enabled');
            
        const imagePromptsTextArea = containerEl.createEl('textarea');
        imagePromptsTextArea.rows = 8;
        imagePromptsTextArea.cols = 50;
        imagePromptsTextArea.addClass('perplexed-json-textarea');
        imagePromptsTextArea.placeholder = 'Enter image references prompt...';
        imagePromptsTextArea.value = this.plugin.settings.prompts.imageReferencesPrompt;
        
        imagePromptsTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.prompts.imageReferencesPrompt = imagePromptsTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        })());
        
        imagePromptsSetting.settingEl.appendChild(imagePromptsTextArea);

        // Text Enhancement Prompt
        new Setting(containerEl).setName("Text enhancement").setHeading();
        
        const enhancePromptSetting = new Setting(containerEl)
            .setName('Text enhancement prompt')
            .setDesc('Template for enhancing selected text. Use {TEXT} as placeholder for the selected text.');
            
        const enhancePromptTextArea = containerEl.createEl('textarea');
        enhancePromptTextArea.rows = 10;
        enhancePromptTextArea.cols = 50;
        enhancePromptTextArea.addClass('perplexed-json-textarea');
        enhancePromptTextArea.placeholder = 'Enter text enhancement prompt template...';
        enhancePromptTextArea.value = this.plugin.settings.prompts.enhancePrompt;
        
        enhancePromptTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.prompts.enhancePrompt = enhancePromptTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        })());
        
        enhancePromptSetting.settingEl.appendChild(enhancePromptTextArea);

        // Text Enhancement with Images Prompt
        const enhanceWithImagesPromptSetting = new Setting(containerEl)
            .setName('Related images prompt')
            .setDesc('Template for requesting related images for selected text. Use {TEXT} as placeholder for the selected text.');
            
        const enhanceWithImagesPromptTextArea = containerEl.createEl('textarea');
        enhanceWithImagesPromptTextArea.rows = 10;
        enhanceWithImagesPromptTextArea.cols = 50;
        enhanceWithImagesPromptTextArea.addClass('perplexed-json-textarea');
        enhanceWithImagesPromptTextArea.placeholder = 'Enter related images prompt template...';
        enhanceWithImagesPromptTextArea.value = this.plugin.settings.prompts.enhanceWithImagesPrompt;
        
        enhanceWithImagesPromptTextArea.addEventListener('input', () => void (async () => {
            this.plugin.settings.prompts.enhanceWithImagesPrompt = enhanceWithImagesPromptTextArea.value;
            this.updatePromptsService();
            await this.plugin.saveSettings();
        })());
        
        enhanceWithImagesPromptSetting.settingEl.appendChild(enhanceWithImagesPromptTextArea);

        // Directory Templates Section (v0.1 spike)
        new Setting(containerEl).setName('Directory templates').setHeading();
        containerEl.createEl('p', {
            text: 'Apply a template (heading skeleton + per-section bullets) to fill a file via Perplexity deep research. Templates live in a vault folder and are matched to files by glob.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Templates root')
            .setDesc('Vault-relative folder where directory templates live.')
            .addText(text => text
                .setPlaceholder('Zz-cf-lib/templates')
                .setValue(this.plugin.settings.directoryTemplatesRoot)
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesRoot = value.trim();
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Partials root')
            .setDesc('Vault-relative folder where reusable snippets live. Templates pull them in with {{include: name}}.')
            .addText(text => text
                .setPlaceholder('Zz-cf-lib/partials')
                .setValue(this.plugin.settings.directoryTemplatesPartialsRoot)
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesPartialsRoot = value.trim();
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Preambles root')
            .setDesc('Vault-relative folder where plugin-wide preambles live. Files here are auto-attached to every Perplexity request per the lists below.')
            .addText(text => text
                .setPlaceholder('Zz-cf-lib/preambles')
                .setValue(this.plugin.settings.directoryTemplatesPreamblesRoot)
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesPreamblesRoot = value.trim();
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('System preambles')
            .setDesc('Comma-separated preamble names (no .md) prepended to every system prompt, in order. Default: inline-citation.')
            .addText(text => text
                .setPlaceholder('Inline-citation')
                .setValue(this.plugin.settings.directoryTemplatesSystemPreambles.join(', '))
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesSystemPreambles = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('User preambles')
            .setDesc('Comma-separated user-prompt preambles. Append ":return-images" to attach only when a template sets return-images: true. Default: research-framing, image-placement:return-images.')
            .addText(text => text
                .setPlaceholder('Research-framing, image-placement:return-images')
                .setValue(this.plugin.settings.directoryTemplatesUserPreambles
                    .map(p => p.when === 'always' ? p.name : `${p.name}:${p.when}`)
                    .join(', '))
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesUserPreambles = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                        .map(token => {
                            const [name, whenRaw] = token.split(':').map(s => s.trim());
                            const when: 'always' | 'return-images' =
                                whenRaw === 'return-images' ? 'return-images' : 'always';
                            return { name: name ?? '', when };
                        })
                        .filter(p => p.name.length > 0);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Frontmatter whitelist')
            .setDesc('Comma-separated list of frontmatter keys passed to the template as {{frontmatter}}. Other keys are filtered out.')
            .addText(text => text
                .setPlaceholder('Title, og_description, tags, og_image')
                .setValue(this.plugin.settings.directoryTemplatesFrontmatterWhitelist.join(', '))
                .onChange(async (value: string) => {
                    this.plugin.settings.directoryTemplatesFrontmatterWhitelist = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Request timeout (ms)')
            .setDesc('Maximum wall-clock time to wait for a Perplexity response. Default 1800000 (30 min) — generous because deep-research runs on long analyst-grade templates routinely take 15-25 min and the $10-$50 of value per good output is worth waiting for. Individual templates may override this per-template via `request-timeout-ms:` in their cft block.')
            .addText(text => text
                .setPlaceholder('1800000')
                .setValue(String(this.plugin.settings.directoryTemplatesRequestTimeoutMs))
                .onChange(async (value: string) => {
                    const n = parseInt(value, 10);
                    if (!isNaN(n) && n > 0) {
                        this.plugin.settings.directoryTemplatesRequestTimeoutMs = n;
                        await this.plugin.saveSettings();
                    }
                })
            );

        new Setting(containerEl)
            .setName('Re-seed templates')
            .setDesc('Write any shipped template files that are missing from the templates root. Existing files are never overwritten — to reset a template to its shipped default, delete the file first then re-seed.')
            .addButton(btn => btn
                .setButtonText('Re-seed')
                .onClick(async () => {
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
                    }
                })
            );

        // Find images for selection
        new Setting(containerEl).setName('Find images for selection').setHeading();
        containerEl.createEl('p', {
            text: 'Highlight a passage, run "find images for selection". The plugin asks Perplexity for screenshots that visually illustrate the passage, prefers images on the entity\'s domain (frontmatter URL), and embeds them between paragraphs.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Max images')
            .setDesc('Maximum number of images to embed per invocation.')
            .addText(text => text
                .setPlaceholder('3')
                .setValue(String(this.plugin.settings.findImagesMaxImages))
                .onChange(async (value: string) => {
                    const n = parseInt(value, 10);
                    if (!isNaN(n) && n > 0) {
                        this.plugin.settings.findImagesMaxImages = n;
                        await this.plugin.saveSettings();
                    }
                })
            );
    }
}
