import { App, Modal, Notice, Editor } from 'obsidian';
import { PerplexityService, PerplexityOptions } from '../services/perplexityService';
import { PromptsService } from '../services/promptsService';

export class PerplexityModal extends Modal {
    protected editor: Editor;
    protected perplexityService: PerplexityService;
    protected promptsService: PromptsService;
    protected queryInput!: HTMLTextAreaElement;
    protected modelSelect!: HTMLSelectElement;
    protected streamToggle!: HTMLInputElement;
    protected citationsToggle!: HTMLInputElement;
    protected imagesToggle!: HTMLInputElement;
    protected relatedQuestionsToggle!: HTMLInputElement;
    protected recencyFilterSelect!: HTMLSelectElement;

    constructor(app: App, editor: Editor, perplexityService: PerplexityService, promptsService: PromptsService) {
        super(app);
        this.editor = editor;
        this.perplexityService = perplexityService;
        this.promptsService = promptsService;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('perplexity-modal');
        contentEl.createEl('h2', {text: 'Ask Perplexity'});
        
        const form = contentEl.createEl('form');
        
        // Query input
        const queryDiv = form.createDiv({cls: 'setting-item'});
        queryDiv.createEl('label', {text: 'Your Question'});
        this.queryInput = queryDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '4',
                placeholder: this.promptsService.getPerplexityQueryPlaceholder()
            }
        });

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
        
        this.modelSelect.onchange = () => {
            if (this.modelSelect.value === 'sonar-deep-research') {
                modelDesc.textContent = this.promptsService.getDeepResearchDescription();
                // Enable streaming for deep research but keep it unchecked by default due to longer processing time
                this.streamToggle.disabled = false;
                if (!this.streamToggle.checked) {
                    this.streamToggle.checked = false; // Keep unchecked by default for deep research
                }
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
        const imagesDesc = imagesDiv.createDiv({cls: 'setting-item-description images-description'});
        imagesDesc.textContent = this.promptsService.getImagesToggleDescription();

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
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        // If images are enabled, add image markers to the query
        let processedQuery = query;
        if (this.imagesToggle.checked) {
            processedQuery = `${query}

${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexityOptions = {
            return_citations: this.citationsToggle.checked,
            return_images: this.imagesToggle.checked,
            return_related_questions: this.relatedQuestionsToggle.checked,
            search_recency_filter: this.recencyFilterSelect.value
        };

        this.close();
        await this.perplexityService.queryPerplexity(
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
