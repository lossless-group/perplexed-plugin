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
    lmStudioEndpoint: string;
    lmStudioRequestTemplate: string;
    defaultModel: string;
    defaultOptimizationMode: string;
    defaultFocusMode: string;
    defaultLMStudioModel: string;
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
    defaultLMStudioModel: 'ibm/granite-3.2-8b'
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
        this.registerLMStudioCommands();
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

    private convertRecencyFilter(filter: string): string | undefined {
        // Handle empty string (no filter)
        if (!filter || filter === '') {
            return undefined; // Don't include the parameter at all for no filter
        }
        
        // API only supports: day, week, month, year
        // Custom multi-year options should fall back to "year" as the closest valid option
        const validFilters = ['day', 'week', 'month', 'year'];
        
        if (validFilters.includes(filter)) {
            return filter;
        }
        
        // For any custom multi-year options, fallback to 'year' since API doesn't support them
        if (filter.includes('year')) {
            return 'year';
        }
        
        // Default fallback
        return 'month';
    }

    public async queryPerplexity(query: string, model: string, stream: boolean, editor: Editor, options?: {
        return_citations?: boolean;
        return_images?: boolean;
        return_related_questions?: boolean;
        search_recency_filter?: string;
    }): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Force non-streaming for sonar-deep-research
        const isDeepResearch = model === 'sonar-deep-research';
        const useStreaming = stream && !isDeepResearch;
        
        // Insert query header at the current cursor position
        const cursor = editor.getCursor();
        console.log('Initial cursor position:', cursor);
        
        const headerText = isDeepResearch 
            ? `\n\n***\n## Perplexity Deep Research Query (${timestamp})\n**Question:** ${query}\n**Model:** ${model}\n\n🔍 **Conducting exhaustive research across hundreds of sources...**\n*This may take 30-60 seconds for comprehensive analysis.*\n\n### **Deep Research Analysis**:\n\n`
            : `\n\n***\n## Perplexity Query (${timestamp})\n**Question:** ${query}\n**Model:** ${model}\n\n### **Response from ${model}**:\n\n`;
        
        // Insert the header at the cursor position
        editor.replaceRange(headerText, cursor, cursor);
        
        // Calculate where the response content should start
        const headerLines = headerText.split('\n');
        const lastLine = headerLines[headerLines.length - 1] || '';
        const responseCursor = {
            line: cursor.line + headerLines.length - 1,
            ch: lastLine.length
        };
        
        console.log('Response cursor position:', responseCursor);
        
        // Show loading notice for deep research
        let loadingNotice: Notice | null = null;
        if (isDeepResearch) {
            loadingNotice = new Notice('🔍 Deep research in progress... This may take up to 60 seconds.', 0); // 0 = persistent
        }
        
        try {
            const convertedFilter = this.convertRecencyFilter(options?.search_recency_filter ?? "month");
            
            const payload: any = {
                model,
                messages: [
                    { role: 'user', content: query }
                ],
                stream: useStreaming,
                return_citations: options?.return_citations ?? true,
                return_images: options?.return_images ?? true,
                return_related_questions: options?.return_related_questions ?? false
            };
            
            // Only include search_recency_filter if we have a filter value
            if (convertedFilter !== undefined) {
                payload.search_recency_filter = convertedFilter;
            }

            const response = await fetch(this.settings.perplexityEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let finalCursor = responseCursor;
            
            if (useStreaming) {
                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body');
                
                let buffer = '';
                let currentPos = responseCursor;
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = new TextDecoder().decode(value);
                    buffer += chunk;
                    
                    // Process complete lines from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer
                    
                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            const data = line.replace('data: ', '').trim();
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.choices?.[0]?.delta?.content) {
                                    const content = parsed.choices[0].delta.content;
                                    editor.replaceRange(content, currentPos);
                                    // Update cursor position after insertion
                                    const lines = content.split('\n');
                                    if (lines.length === 1) {
                                        currentPos = { line: currentPos.line, ch: currentPos.ch + content.length };
                                    } else {
                                        currentPos = { 
                                            line: currentPos.line + lines.length - 1, 
                                            ch: lines[lines.length - 1].length 
                                        };
                                    }
                                    finalCursor = currentPos; // Track final position
                                }
                            } catch (e) {
                                // Ignore JSON parse errors for partial chunks
                            }
                        }
                    }
                }
            } else {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || 'No response received';
                
                // Extract citations/sources if available
                let fullResponse = content;
                
                // Add images if available
                if (data.images && data.images.length > 0) {
                    fullResponse += '\n\n## Images\n\n';
                    data.images.forEach((image: any, index: number) => {
                        if (image.url) {
                            fullResponse += `![Image ${index + 1}](${image.url})\n`;
                            if (image.description || image.title || image.alt) {
                                fullResponse += `*${image.description || image.title || image.alt}*\n\n`;
                            } else {
                                fullResponse += '\n';
                            }
                        }
                    });
                }
                
                // Add citations/sources
                if (data.citations && data.citations.length > 0) {
                    fullResponse += '\n\n## Sources\n\n';
                    data.citations.forEach((citation: any, index: number) => {
                        fullResponse += `[${index + 1}] ${citation.url || citation.title || citation}\n`;
                    });
                }
                
                editor.replaceRange(fullResponse, responseCursor);
                // Calculate final cursor position for non-streaming
                const lines = fullResponse.split('\n');
                if (lines.length === 1) {
                    finalCursor = { line: responseCursor.line, ch: responseCursor.ch + fullResponse.length };
                } else {
                    finalCursor = { 
                        line: responseCursor.line + lines.length - 1, 
                        ch: lines[lines.length - 1].length 
                    };
                }
            }
            
            // Add separator at the final cursor position
            editor.replaceRange('\n\n***\n', finalCursor);
            
            // Close loading notice if it exists
            if (loadingNotice) {
                loadingNotice.hide();
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Perplexity Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
            
            // Close loading notice if it exists
            if (loadingNotice) {
                loadingNotice.hide();
            }
        }
    }

    public async queryPerplexica(query: string, focusMode: string, optimizationMode: string, stream: boolean, editor: Editor): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Insert query header
        const cursor = editor.getCursor();
        editor.replaceRange(`\n\n***\n## Perplexica Query (${timestamp})\n**Question:** ${query}\n**Focus:** ${focusMode}\n**Optimization:** ${optimizationMode}\n\n### **Response from Perplexica**:\n\n`, cursor);
        
        // Get cursor position after header for response content
        const responseCursor = editor.getCursor();
        
        try {
            // Try primary endpoint first, then fallback
            const endpoints = [this.settings.perplexicaEndpoint, this.settings.localLLMPath];
            let lastError;
            
            for (const endpoint of endpoints) {
                try {
                    const payload = {
                        chatModel: {
                            provider: "ollama",
                            name: this.settings.defaultModel
                        },
                        embeddingModel: {
                            provider: "ollama",
                            name: this.settings.defaultModel
                        },
                        optimizationMode,
                        focusMode,
                        query,
                        history: [
                            {
                                role: "user",
                                content: query
                            }
                        ],
                        systemInstructions: "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
                        stream,
                        maxTokens: 2048,
                        temperature: 0.7
                    };

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    if (stream) {
                        const reader = response.body?.getReader();
                        if (!reader) throw new Error('No response body');
                        
                        let currentPos = responseCursor;
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            
                            const chunk = new TextDecoder().decode(value);
                            const lines = chunk.split('\n').filter(line => line.trim());
                            
                            for (const line of lines) {
                                try {
                                    const parsed = JSON.parse(line);
                                    if (parsed.type === 'response' && parsed.data) {
                                        editor.replaceRange(parsed.data, currentPos);
                                        // Update cursor position
                                        const lines = parsed.data.split('\n');
                                        if (lines.length === 1) {
                                            currentPos = { line: currentPos.line, ch: currentPos.ch + parsed.data.length };
                                        } else {
                                            currentPos = { 
                                                line: currentPos.line + lines.length - 1, 
                                                ch: lines[lines.length - 1].length 
                                            };
                                        }
                                    }
                                } catch (e) {
                                    // Ignore JSON parse errors
                                }
                            }
                        }
                    } else {
                        const text = await response.text();
                        editor.replaceRange(text, responseCursor);
                    }
                    
                    // Add separator
                    editor.replaceRange('\n\n***\n', editor.getCursor());
                    return; // Success, exit the loop
                    
                } catch (error) {
                    lastError = error;
                    console.warn(`Failed to connect to ${endpoint}:`, error);
                }
            }
            
            // If we get here, all endpoints failed
            throw lastError || new Error('All endpoints failed');
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Perplexica Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
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

        // Command to ask Perplexica
        this.addCommand({
            id: 'ask-perplexica',
            name: 'Ask Perplexica',
            editorCallback: (editor: Editor) => {
                const modal = new (class extends Modal {
                    private queryInput!: HTMLTextAreaElement;
                    private focusModeSelect!: HTMLSelectElement;
                    private optimizationSelect!: HTMLSelectElement;
                    private streamToggle!: HTMLInputElement;

                    constructor(app: App, private plugin: PerplexedPlugin, private editor: Editor) {
                        super(app);
                    }
                    
                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Ask Perplexica'});
                        
                        const form = contentEl.createEl('form');
                        
                        // Query input
                        const queryDiv = form.createDiv({cls: 'setting-item'});
                        queryDiv.createEl('label', {text: 'Your Question'});
                        this.queryInput = queryDiv.createEl('textarea', {
                            cls: 'text-input',
                            attr: {
                                rows: '4',
                                placeholder: 'What would you like to ask Perplexica?'
                            }
                        });
                        this.queryInput.style.width = '100%';
                        this.queryInput.style.minHeight = '100px';

                        // Focus mode selection
                        const focusDiv = form.createDiv({cls: 'setting-item'});
                        focusDiv.createEl('label', {text: 'Focus Mode'});
                        this.focusModeSelect = focusDiv.createEl('select', {cls: 'dropdown'});
                        ['webSearch', 'academicSearch', 'writingAssistant', 'wolframAlpha', 'youtubeSearch', 'redditSearch'].forEach(mode => {
                            const option = this.focusModeSelect.createEl('option', {value: mode, text: mode});
                            if (mode === this.plugin.settings.defaultFocusMode) option.selected = true;
                        });

                        // Optimization mode selection
                        const optimizationDiv = form.createDiv({cls: 'setting-item'});
                        optimizationDiv.createEl('label', {text: 'Optimization'});
                        this.optimizationSelect = optimizationDiv.createEl('select', {cls: 'dropdown'});
                        ['speed', 'balanced', 'quality'].forEach(mode => {
                            const option = this.optimizationSelect.createEl('option', {value: mode, text: mode});
                            if (mode === this.plugin.settings.defaultOptimizationMode) option.selected = true;
                        });

                        // Stream toggle
                        const streamDiv = form.createDiv({cls: 'setting-item'});
                        const streamLabel = streamDiv.createEl('label');
                        this.streamToggle = streamLabel.createEl('input', {type: 'checkbox'});
                        this.streamToggle.checked = false;
                        streamLabel.createSpan({text: ' Stream response'});
                        
                        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
                        const askButton = buttonDiv.createEl('button', {
                            text: 'Ask Perplexica',
                            cls: 'mod-cta'
                        });
                        
                        form.onsubmit = (e) => {
                            e.preventDefault();
                            this.onSubmit();
                        };
                        
                        askButton.onclick = () => this.onSubmit();
                        
                        // Focus on the query input
                        setTimeout(() => this.queryInput.focus(), 100);
                    }
                    
                    async onSubmit() {
                        const query = this.queryInput.value.trim();
                        if (!query) {
                            new Notice('Please enter a question');
                            return;
                        }

                        this.close();
                        await this.plugin.queryPerplexica(query, this.focusModeSelect.value, this.optimizationSelect.value, this.streamToggle.checked, this.editor);
                    }
                    
                    onClose() {
                        const {contentEl} = this;
                        contentEl.empty();
                    }
                })(this.app, this, editor);
                
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

        // Command to ask Perplexity
        this.addCommand({
            id: 'ask-perplexity',
            name: 'Ask Perplexity',
            editorCallback: (editor: Editor) => {
                const modal = new (class extends Modal {
                    private queryInput!: HTMLTextAreaElement;
                    private modelSelect!: HTMLSelectElement;
                    private streamToggle!: HTMLInputElement;
                    private citationsToggle!: HTMLInputElement;
                    private imagesToggle!: HTMLInputElement;
                    private relatedQuestionsToggle!: HTMLInputElement;
                    private recencyFilterSelect!: HTMLSelectElement;

                    constructor(app: App, private plugin: PerplexedPlugin, private editor: Editor) {
                        super(app);
                    }
                    
                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Ask Perplexity'});
                        
                        const form = contentEl.createEl('form');
                        
                        // Query input
                        const queryDiv = form.createDiv({cls: 'setting-item'});
                        queryDiv.createEl('label', {text: 'Your Question'});
                        this.queryInput = queryDiv.createEl('textarea', {
                            cls: 'text-input',
                            attr: {
                                rows: '4',
                                placeholder: 'What would you like to ask Perplexity?'
                            }
                        });
                        this.queryInput.style.width = '100%';
                        this.queryInput.style.minHeight = '100px';

                        // Model selection
                        const modelDiv = form.createDiv({cls: 'setting-item'});
                        modelDiv.createEl('label', {text: 'Model'});
                        this.modelSelect = modelDiv.createEl('select', {cls: 'dropdown'});
                        ['sonar-deep-research', 'sonar-pro', 'sonar-small', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'].forEach(model => {
                            const option = this.modelSelect.createEl('option', {value: model, text: model});
                            if (model === 'sonar-pro') option.selected = true;
                        });
                        
                        // Add description for deep research model
                        const modelDesc = modelDiv.createDiv({cls: 'setting-item-description'});
                        modelDesc.style.fontSize = '12px';
                        modelDesc.style.color = 'var(--text-muted)';
                        modelDesc.style.marginTop = '5px';
                        
                        this.modelSelect.onchange = () => {
                            if (this.modelSelect.value === 'sonar-deep-research') {
                                modelDesc.textContent = '⚡ Deep Research: Exhaustive research across hundreds of sources with expert-level analysis. Higher cost but comprehensive results. Note: Streaming is disabled for this model.';
                                this.streamToggle.checked = false;
                                this.streamToggle.disabled = true;
                            } else {
                                modelDesc.textContent = '';
                                this.streamToggle.disabled = false;
                            }
                        };

                        // Citations toggle
                        const citationsDiv = form.createDiv({cls: 'setting-item'});
                        const citationsLabel = citationsDiv.createEl('label');
                        this.citationsToggle = citationsLabel.createEl('input', {type: 'checkbox'});
                        this.citationsToggle.checked = true;
                        citationsLabel.createSpan({text: ' Include Citations'});
                        
                        // Images toggle
                        const imagesDiv = form.createDiv({cls: 'setting-item'});
                        const imagesLabel = imagesDiv.createEl('label');
                        this.imagesToggle = imagesLabel.createEl('input', {type: 'checkbox'});
                        this.imagesToggle.checked = true;
                        imagesLabel.createSpan({text: ' Include Images'});
                        
                        // Add description for images toggle
                        const imagesDesc = imagesDiv.createDiv({cls: 'setting-item-description'});
                        imagesDesc.style.fontSize = '11px';
                        imagesDesc.style.color = 'var(--text-muted)';
                        imagesDesc.style.marginTop = '3px';
                        imagesDesc.textContent = 'Include image results from search - images will appear in an Images section';

                        // Related questions toggle
                        const relatedQuestionsDiv = form.createDiv({cls: 'setting-item'});
                        const relatedQuestionsLabel = relatedQuestionsDiv.createEl('label');
                        this.relatedQuestionsToggle = relatedQuestionsLabel.createEl('input', {type: 'checkbox'});
                        this.relatedQuestionsToggle.checked = false;
                        relatedQuestionsLabel.createSpan({text: ' Include Related Questions'});

                        // Recency filter selection
                        const recencyDiv = form.createDiv({cls: 'setting-item'});
                        recencyDiv.createEl('label', {text: 'Recency Filter'});
                        this.recencyFilterSelect = recencyDiv.createEl('select', {cls: 'dropdown'});
                        [
                            {value: '', text: 'No filter (all time) - Search all content'}, 
                            {value: 'day', text: 'Past day'}, 
                            {value: 'week', text: 'Past week'}, 
                            {value: 'month', text: 'Past month'}, 
                            {value: 'year', text: 'Past year'},
                            {value: '2years', text: 'Past 2+ years (falls back to "year")'},
                            {value: '3years', text: 'Past 3+ years (falls back to "year")'},
                            {value: '5years', text: 'Past 5+ years (falls back to "year")'}
                        ].forEach(option => {
                            const optionEl = this.recencyFilterSelect.createEl('option', {value: option.value, text: option.text});
                            if (option.value === '') optionEl.selected = true; // Default to no filter
                        });

                        // Stream toggle
                        const streamDiv = form.createDiv({cls: 'setting-item'});
                        const streamLabel = streamDiv.createEl('label');
                        this.streamToggle = streamLabel.createEl('input', {type: 'checkbox'});
                        this.streamToggle.checked = true;
                        streamLabel.createSpan({text: ' Stream response'});
                        
                        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
                        const askButton = buttonDiv.createEl('button', {
                            text: 'Ask Perplexity',
                            cls: 'mod-cta'
                        });
                        
                        form.onsubmit = (e) => {
                            e.preventDefault();
                            this.onSubmit();
                        };
                        
                        askButton.onclick = () => this.onSubmit();
                        
                        // Focus on the query input
                        setTimeout(() => this.queryInput.focus(), 100);
                    }
                    
                    async onSubmit() {
                        const query = this.queryInput.value.trim();
                        if (!query) {
                            new Notice('Please enter a question');
                            return;
                        }

                        if (!this.plugin.settings.perplexityApiKey) {
                            new Notice('Please set your Perplexity API key in settings');
                            return;
                        }

                        const options = {
                            return_citations: this.citationsToggle.checked,
                            return_images: this.imagesToggle.checked,
                            return_related_questions: this.relatedQuestionsToggle.checked,
                            search_recency_filter: this.recencyFilterSelect.value
                        };

                        this.close();
                        await this.plugin.queryPerplexity(query, this.modelSelect.value, this.streamToggle.checked, this.editor, options);
                    }
                    
                    onClose() {
                        const {contentEl} = this;
                        contentEl.empty();
                    }
                })(this.app, this, editor);
                
                modal.open();
            }
        });
    }

    public async queryLMStudio(query: string, model: string, stream: boolean, editor: Editor, options?: {
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        system_prompt?: string;
    }): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Insert query header at the current cursor position
        const cursor = editor.getCursor();
        console.log('Initial cursor position:', cursor);
        
        const headerText = `\n\n***\n## LM Studio Query (${timestamp})\n**Question:** ${query}\n**Model:** ${model}\n\n### **Response from ${model}**:\n\n`;
        
        // Insert the header at the cursor position
        editor.replaceRange(headerText, cursor, cursor);
        
        // Calculate where the response content should start
        const headerLines = headerText.split('\n');
        const lastLine = headerLines[headerLines.length - 1] || '';
        const responseCursor = {
            line: cursor.line + headerLines.length - 1,
            ch: lastLine.length
        };
        
        console.log('Response cursor position:', responseCursor);
        
        try {
            const messages: any[] = [];
            
            // Add system message if provided
            if (options?.system_prompt) {
                messages.push({ role: 'system', content: options.system_prompt });
            }
            
            // Add user query
            messages.push({ role: 'user', content: query });
            
            const payload: any = {
                model,
                messages,
                stream,
                max_tokens: options?.max_tokens ?? 2048,
                temperature: options?.temperature ?? 0.7,
                top_p: options?.top_p ?? 0.9
            };
            
            const response = await fetch(this.settings.lmStudioEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // LM Studio doesn't require API key for local access
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let finalCursor = responseCursor;
            
            if (stream) {
                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body');
                
                let buffer = '';
                let currentPos = responseCursor;
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = new TextDecoder().decode(value);
                    buffer += chunk;
                    
                    // Process complete lines from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer
                    
                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            const data = line.replace('data: ', '').trim();
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.choices?.[0]?.delta?.content) {
                                    const content = parsed.choices[0].delta.content;
                                    editor.replaceRange(content, currentPos);
                                    // Update cursor position after insertion
                                    const lines = content.split('\n');
                                    if (lines.length === 1) {
                                        currentPos = { line: currentPos.line, ch: currentPos.ch + content.length };
                                    } else {
                                        currentPos = { 
                                            line: currentPos.line + lines.length - 1, 
                                            ch: lines[lines.length - 1].length 
                                        };
                                    }
                                    finalCursor = currentPos; // Track final position
                                }
                            } catch (e) {
                                // Ignore JSON parse errors for partial chunks
                            }
                        }
                    }
                }
            } else {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || 'No response received';
                
                editor.replaceRange(content, responseCursor);
                // Calculate final cursor position for non-streaming
                const lines = content.split('\n');
                if (lines.length === 1) {
                    finalCursor = { line: responseCursor.line, ch: responseCursor.ch + content.length };
                } else {
                    finalCursor = { 
                        line: responseCursor.line + lines.length - 1, 
                        ch: lines[lines.length - 1].length 
                    };
                }
            }
            
            // Add separator at the final cursor position
            editor.replaceRange('\n\n***\n', finalCursor);
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`LM Studio Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
        }
    }

    private registerLMStudioCommands(): void {
        // Command to update LM Studio URL
        this.addCommand({
            id: 'update-lmstudio-url',
            name: 'Update LM Studio URL',
            callback: () => {
                const modal = new (class extends Modal {
                    private urlInput!: HTMLInputElement;

                    constructor(app: App, private plugin: PerplexedPlugin) {
                        super(app);
                    }

                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Update LM Studio API URL'});
                        const form = contentEl.createEl('form');
                        const div = form.createDiv({cls: 'setting-item'});

                        div.createEl('label', {
                            text: 'LM Studio API URL',
                            attr: {for: 'lmstudio-url-input'}
                        });

                        this.urlInput = div.createEl('input', {
                            type: 'text',
                            value: this.plugin.settings.lmStudioEndpoint,
                            cls: 'text-input',
                            attr: {id: 'lmstudio-url-input'}
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
                            this.plugin.settings.lmStudioEndpoint = newUrl;
                            this.plugin.saveSettings();
                            new Notice(`LM Studio URL updated to: ${newUrl}`);
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
                const modal = new (class extends Modal {
                    private queryInput!: HTMLTextAreaElement;
                    private modelSelect!: HTMLSelectElement;
                    private streamToggle!: HTMLInputElement;
                    private maxTokensInput!: HTMLInputElement;
                    private temperatureInput!: HTMLInputElement;
                    private systemPromptInput!: HTMLTextAreaElement;

                    constructor(app: App, private plugin: PerplexedPlugin, private editor: Editor) {
                        super(app);
                    }
                    
                    onOpen() {
                        const {contentEl} = this;
                        contentEl.createEl('h2', {text: 'Ask LM Studio'});
                        
                        const form = contentEl.createEl('form');
                        
                        // Query input
                        const queryDiv = form.createDiv({cls: 'setting-item'});
                        queryDiv.createEl('label', {text: 'Your Question'});
                        this.queryInput = queryDiv.createEl('textarea', {
                            cls: 'text-input',
                            attr: {
                                rows: '4',
                                placeholder: 'What would you like to ask?'
                            }
                        });
                        this.queryInput.style.width = '100%';
                        this.queryInput.style.minHeight = '100px';

                        // Model selection
                        const modelDiv = form.createDiv({cls: 'setting-item'});
                        modelDiv.createEl('label', {text: 'Model'});
                        this.modelSelect = modelDiv.createEl('select', {cls: 'dropdown'});
                        // Use common LM Studio models - these would be dynamically loaded ideally
                        ['ibm/granite-3.2-8b', 'microsoft/phi-4-reasoning-plus', 'google/gemma-3-12b', 'meta-llama/llama-3.2-3b-instruct', 'custom-model'].forEach(model => {
                            const option = this.modelSelect.createEl('option', {value: model, text: model});
                            if (model === this.plugin.settings.defaultLMStudioModel) option.selected = true;
                        });

                        // System prompt
                        const systemDiv = form.createDiv({cls: 'setting-item'});
                        systemDiv.createEl('label', {text: 'System Prompt (Optional)'});
                        this.systemPromptInput = systemDiv.createEl('textarea', {
                            cls: 'text-input',
                            attr: {
                                rows: '2',
                                placeholder: 'You are a helpful AI assistant...'
                            }
                        });
                        this.systemPromptInput.style.width = '100%';
                        this.systemPromptInput.style.minHeight = '60px';

                        // Max tokens
                        const maxTokensDiv = form.createDiv({cls: 'setting-item'});
                        maxTokensDiv.createEl('label', {text: 'Max Tokens'});
                        this.maxTokensInput = maxTokensDiv.createEl('input', {
                            type: 'number',
                            value: '2048',
                            cls: 'text-input'
                        });

                        // Temperature
                        const tempDiv = form.createDiv({cls: 'setting-item'});
                        tempDiv.createEl('label', {text: 'Temperature (0.0 - 2.0)'});
                        this.temperatureInput = tempDiv.createEl('input', {
                            type: 'number',
                            value: '0.7',
                            attr: {
                                step: '0.1',
                                min: '0',
                                max: '2'
                            },
                            cls: 'text-input'
                        });

                        // Stream toggle
                        const streamDiv = form.createDiv({cls: 'setting-item'});
                        const streamLabel = streamDiv.createEl('label');
                        this.streamToggle = streamLabel.createEl('input', {type: 'checkbox'});
                        this.streamToggle.checked = true;
                        streamLabel.createSpan({text: ' Stream response'});
                        
                        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
                        const askButton = buttonDiv.createEl('button', {
                            text: 'Ask LM Studio',
                            cls: 'mod-cta'
                        });
                        
                        form.onsubmit = (e) => {
                            e.preventDefault();
                            this.onSubmit();
                        };
                        
                        askButton.onclick = () => this.onSubmit();
                        
                        // Focus on the query input
                        setTimeout(() => this.queryInput.focus(), 100);
                    }
                    
                    async onSubmit() {
                        const query = this.queryInput.value.trim();
                        if (!query) {
                            new Notice('Please enter a question');
                            return;
                        }

                        const options: {
                            max_tokens: number;
                            temperature: number;
                            system_prompt?: string;
                        } = {
                            max_tokens: parseInt(this.maxTokensInput.value) || 2048,
                            temperature: parseFloat(this.temperatureInput.value) || 0.7
                        };
                        
                        const systemPrompt = this.systemPromptInput.value.trim();
                        if (systemPrompt) {
                            options.system_prompt = systemPrompt;
                        }

                        this.close();
                        await this.plugin.queryLMStudio(query, this.modelSelect.value, this.streamToggle.checked, this.editor, options);
                    }
                    
                    onClose() {
                        const {contentEl} = this;
                        contentEl.empty();
                    }
                })(this.app, this, editor);
                
                modal.open();
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

    }
}
