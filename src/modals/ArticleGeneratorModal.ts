import { App, Editor, Notice } from 'obsidian';
import { PerplexityService, PerplexityOptions } from '../services/perplexityService';
import { PerplexityModal } from './PerplexityModal';
import { PromptsService } from '../services/promptsService';

export class ArticleGeneratorModal extends PerplexityModal {
    private termInput!: HTMLInputElement;

    constructor(app: App, editor: Editor, perplexityService: PerplexityService, promptsService: PromptsService) {
        super(app, editor, perplexityService, promptsService);
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('article-generator-modal');
        contentEl.createEl('h2', {text: 'Generate One-Page Article'});
        
        const form = contentEl.createEl('form');
        
        // Term input
        const termDiv = form.createDiv({cls: 'setting-item'});
        termDiv.createEl('label', {text: 'Vocabulary Term'});
        this.termInput = termDiv.createEl('input', {
            cls: 'text-input',
            attr: {
                placeholder: this.promptsService.getArticleTermPlaceholder()
            }
        });
        
        // Add description for term input below the input
        const termDesc = termDiv.createDiv({cls: 'setting-item-description term-description'});
        termDesc.textContent = this.promptsService.getArticleTermDescription();
        
        // Call parent onOpen to add the rest of the form elements
        super.onOpen();
        
        // Override the query input to be hidden since we'll generate it from the term
        if (this.queryInput) {
            this.queryInput.addClass('hidden-input');
            const queryLabel = this.queryInput.previousElementSibling as HTMLElement;
            if (queryLabel) {
                queryLabel.addClass('hidden-input');
            }
        }
        
        // Update the submit button text
        const submitButton = contentEl.querySelector('button.mod-cta') as HTMLButtonElement;
        if (submitButton) {
            submitButton.textContent = 'Generate Article';
        }
        
        // Focus on the term input instead of query input
        setTimeout(() => this.termInput.focus(), 100);
    }
    
    async onSubmit() {
        const term = this.termInput.value.trim();
        if (!term) {
            new Notice(this.promptsService.getEnterTermNotice());
            return;
        }

        // Generate the query using the prompt template from settings
        const query = this.promptsService.getArticleGeneratorTemplate(term);

        const options: PerplexityOptions = {
            return_citations: this.citationsToggle.checked,
            return_images: this.imagesToggle.checked,
            return_related_questions: this.relatedQuestionsToggle.checked,
            search_recency_filter: this.recencyFilterSelect.value
        };

        this.close();
        await this.perplexityService.queryPerplexity(
            query, 
            this.modelSelect.value, 
            this.streamToggle.checked, 
            this.editor, 
            options
        );
    }
} 