import { App, Modal, Notice, Editor } from 'obsidian';
import { LMStudioService, LMStudioOptions } from '../services/lmStudioService';
import { PromptsService } from '../services/promptsService';

export class LMStudioModal extends Modal {
    private editor: Editor;
    private lmStudioService: LMStudioService;
    private promptsService: PromptsService;
    private queryInput!: HTMLTextAreaElement;
    private modelSelect!: HTMLSelectElement;
    private streamToggle!: HTMLInputElement;
    private maxTokensInput!: HTMLInputElement;
    private temperatureInput!: HTMLInputElement;
    private systemPromptInput!: HTMLTextAreaElement;
    private imagesToggle!: HTMLInputElement;

    constructor(app: App, editor: Editor, lmStudioService: LMStudioService, promptsService: PromptsService) {
        super(app);
        this.editor = editor;
        this.lmStudioService = lmStudioService;
        this.promptsService = promptsService;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('lmstudio-modal');
        contentEl.createEl('h2', {text: 'Ask LM Studio'});
        
        const form = contentEl.createEl('form');
        
        // Query input
        const queryDiv = form.createDiv({cls: 'setting-item'});
        queryDiv.createEl('label', {text: 'Your Question'});
        this.queryInput = queryDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '4',
                placeholder: this.promptsService.getLMStudioQueryPlaceholder()
            }
        });

        // Model selection
        const modelDiv = form.createDiv({cls: 'setting-item'});
        modelDiv.createEl('label', {text: 'Model'});
        this.modelSelect = modelDiv.createEl('select', {cls: 'dropdown'});
        // Use common LM Studio models - these would be dynamically loaded ideally
        ['ibm/granite-3.2-8b', 'microsoft/phi-4-reasoning-plus', 'google/gemma-3-12b', 'meta-llama/llama-3.2-3b-instruct', 'custom-model'].forEach(model => {
            const option = this.modelSelect.createEl('option', {value: model, text: model});
            if (model === 'ibm/granite-3.2-8b') option.selected = true;
        });

        // System prompt
        const systemDiv = form.createDiv({cls: 'setting-item'});
        systemDiv.createEl('label', {text: 'System Prompt (Optional)'});
        this.systemPromptInput = systemDiv.createEl('textarea', {
            cls: 'text-input system-prompt-input',
            attr: {
                rows: '2',
                placeholder: this.promptsService.getLMStudioSystemPromptPlaceholder()
            }
        });

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

        // Images toggle
        const imagesDiv = form.createDiv({cls: 'setting-item'});
        const imagesLabel = imagesDiv.createEl('label');
        this.imagesToggle = imagesLabel.createEl('input', {type: 'checkbox'});
        this.imagesToggle.checked = false;
        imagesLabel.createSpan({text: ' Include Images'});
        
        // Add description for images toggle
        const imagesDesc = imagesDiv.createDiv({cls: 'setting-item-description images-description'});
        imagesDesc.textContent = this.promptsService.getImagesToggleGenericDescription();

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
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        // If images are enabled, add image markers to the query
        let processedQuery = query;
        if (this.imagesToggle.checked) {
            processedQuery = `${query}

${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: LMStudioOptions = {
            max_tokens: parseInt(this.maxTokensInput.value) || 2048,
            temperature: parseFloat(this.temperatureInput.value) || 0.7,
            return_images: this.imagesToggle.checked
        };
        
        const systemPrompt = this.systemPromptInput.value.trim();
        if (systemPrompt) {
            options.system_prompt = systemPrompt;
        }

        this.close();
        await this.lmStudioService.queryLMStudio(
            processedQuery, 
            this.modelSelect.value, 
            this.streamToggle.checked, 
            this.editor, 
            options
        );
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
} 
