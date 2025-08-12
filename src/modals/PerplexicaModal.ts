import { App, Modal, Notice, Editor } from 'obsidian';
import { PerplexicaService, PerplexicaOptions } from '../services/perplexicaService';
import { PromptsService } from '../services/promptsService';

export class PerplexicaModal extends Modal {
    private editor: Editor;
    private perplexicaService: PerplexicaService;
    private promptsService: PromptsService;
    private queryInput!: HTMLTextAreaElement;
    private focusModeSelect!: HTMLSelectElement;
    private optimizationSelect!: HTMLSelectElement;
    private streamToggle!: HTMLInputElement;
    private imagesToggle!: HTMLInputElement;

    constructor(app: App, editor: Editor, perplexicaService: PerplexicaService, promptsService: PromptsService) {
        super(app);
        this.editor = editor;
        this.perplexicaService = perplexicaService;
        this.promptsService = promptsService;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('perplexica-modal');
        contentEl.createEl('h2', {text: 'Ask Perplexica'});
        
        const form = contentEl.createEl('form');
        
        // Query input
        const queryDiv = form.createDiv({cls: 'setting-item'});
        queryDiv.createEl('label', {text: 'Your Question'});
        this.queryInput = queryDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '4',
                placeholder: this.promptsService.getPerplexicaQueryPlaceholder()
            }
        });

        // Focus mode selection
        const focusDiv = form.createDiv({cls: 'setting-item'});
        focusDiv.createEl('label', {text: 'Focus Mode'});
        this.focusModeSelect = focusDiv.createEl('select', {cls: 'dropdown'});
        ['webSearch', 'academicSearch', 'writingAssistant', 'wolframAlpha', 'youtubeSearch', 'redditSearch'].forEach(mode => {
            const option = this.focusModeSelect.createEl('option', {value: mode, text: mode});
            if (mode === 'webSearch') option.selected = true;
        });

        // Optimization mode selection
        const optimizationDiv = form.createDiv({cls: 'setting-item'});
        optimizationDiv.createEl('label', {text: 'Optimization'});
        this.optimizationSelect = optimizationDiv.createEl('select', {cls: 'dropdown'});
        ['speed', 'balanced', 'quality'].forEach(mode => {
            const option = this.optimizationSelect.createEl('option', {value: mode, text: mode});
            if (mode === 'balanced') option.selected = true;
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
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        // If images are enabled, add image markers to the query
        let processedQuery = query;
        if (this.imagesToggle.checked) {
            processedQuery = `${query}

${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexicaOptions = {
            return_images: this.imagesToggle.checked
        };

        this.close();
        await this.perplexicaService.queryPerplexica(
            processedQuery, 
            this.focusModeSelect.value, 
            this.optimizationSelect.value, 
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
