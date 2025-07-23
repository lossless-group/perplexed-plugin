import { App, Modal, Notice, Editor } from 'obsidian';
import { LMStudioService, LMStudioOptions } from '../services/lmStudioService';

export class LMStudioModal extends Modal {
    protected editor: Editor;
    protected lmStudioService: LMStudioService;
    protected queryInput!: HTMLTextAreaElement;
    protected modelSelect!: HTMLSelectElement;
    protected streamToggle!: HTMLInputElement;
    protected maxTokensInput!: HTMLInputElement;
    protected temperatureInput!: HTMLInputElement;
    protected systemPromptInput!: HTMLTextAreaElement;
    protected modelPathInput!: HTMLInputElement;

    constructor(app: App, editor: Editor, lmStudioService: LMStudioService) {
        super(app);
        this.editor = editor;
        this.lmStudioService = lmStudioService;
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
                placeholder: 'What would you like to ask?'
            }
        });

        // Model selection
        const modelDiv = form.createDiv({cls: 'setting-item'});
        modelDiv.createEl('label', {text: 'Model'});
        this.modelSelect = modelDiv.createEl('select', {cls: 'dropdown'});
        
        // Default models including the Kimi model you downloaded
        const models = [
            'Kimi-K2-Instruct-UD-TQ1_0-00001-of-00005.gguf',
            'ibm/granite-3.2-8b', 
            'microsoft/phi-4-reasoning-plus', 
            'google/gemma-3-12b', 
            'meta-llama/llama-3.2-3b-instruct'
        ];
        
        models.forEach(model => {
            const option = this.modelSelect.createEl('option', {value: model, text: model});
            if (model === 'Kimi-K2-Instruct-UD-TQ1_0-00001-of-00005.gguf') option.selected = true;
        });
        
        // Model path input for custom models
        const modelPathDiv = form.createDiv({cls: 'setting-item'});
        modelPathDiv.createEl('label', {text: 'Custom Model Path (optional)'});
        this.modelPathInput = modelPathDiv.createEl('input', {
            cls: 'text-input',
            attr: {
                placeholder: '/path/to/your/model.gguf',
                value: '/Users/mpstaton/.lmstudio/models/unsloth/Kimi-K2-Instruct-GGUF/Kimi-K2-Instruct-UD-TQ1_0-00001-of-00005.gguf'
            }
        });

        // System prompt
        const systemDiv = form.createDiv({cls: 'setting-item'});
        systemDiv.createEl('label', {text: 'System Prompt (Optional)'});
        this.systemPromptInput = systemDiv.createEl('textarea', {
            cls: 'text-input system-prompt-input',
            attr: {
                rows: '2',
                placeholder: 'You are a helpful AI assistant...'
            }
        });

        // Advanced settings container
        const advancedDiv = form.createDiv({cls: 'setting-item'});
        const advancedToggle = advancedDiv.createEl('a', {text: '▼ Advanced Settings', cls: 'advanced-toggle'});
        const advancedContent = form.createDiv({cls: 'advanced-content', attr: {style: 'display: none;'}});
        
        advancedToggle.onclick = (e) => {
            e.preventDefault();
            const isHidden = advancedContent.getAttribute('style')?.includes('none');
            advancedContent.setAttribute('style', isHidden ? '' : 'display: none;');
            advancedToggle.textContent = isHidden ? '▲ Advanced Settings' : '▼ Advanced Settings';
        };

        // Max tokens
        const maxTokensDiv = advancedContent.createDiv({cls: 'setting-item'});
        maxTokensDiv.createEl('label', {text: 'Max Tokens'});
        this.maxTokensInput = maxTokensDiv.createEl('input', {
            type: 'number',
            value: '2048',
            cls: 'text-input'
        });

        // Temperature
        const tempDiv = advancedContent.createDiv({cls: 'setting-item'});
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
        const streamDiv = advancedContent.createDiv({cls: 'setting-item'});
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

        const options: LMStudioOptions = {
            max_tokens: parseInt(this.maxTokensInput.value) || 2048,
            temperature: parseFloat(this.temperatureInput.value) || 0.7
        };
        
        const systemPrompt = this.systemPromptInput.value.trim();
        if (systemPrompt) {
            options.system_prompt = systemPrompt;
        }
        
        // Use custom model path if provided, otherwise use the selected model
        const modelPath = this.modelPathInput.value.trim() || this.modelSelect.value;
        
        // If it's a local file path, ensure it exists
        if (modelPath.endsWith('.gguf') || modelPath.includes('/') || modelPath.includes('\\')) {
            try {
                const fs = require('fs');
                if (!fs.existsSync(modelPath)) {
                    new Notice(`Model file not found: ${modelPath}`);
                    return;
                }
            } catch (error) {
                console.error('Error checking model file:', error);
                new Notice('Error checking model file. See console for details.');
                return;
            }
        }

        this.close();
        await this.lmStudioService.queryLMStudio(
            query, 
            modelPath, 
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