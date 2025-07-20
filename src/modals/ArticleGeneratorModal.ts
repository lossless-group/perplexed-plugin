import { App, Editor, Notice } from 'obsidian';
import { PerplexityService, PerplexityOptions } from '../services/perplexityService';
import { PerplexityModal } from './PerplexityModal';

export class ArticleGeneratorModal extends PerplexityModal {
    private termInput!: HTMLInputElement;
    private predefinedPrompt: string;

    constructor(app: App, editor: Editor, perplexityService: PerplexityService) {
        super(app, editor, perplexityService);
        
        // Predefined prompt for generating one-page articles with image references
        this.predefinedPrompt = `Write a comprehensive one-page article about "{TERM}". 

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
- Use markdown formatting for structure

**Image References:**
Include [IMAGE 1: {TERM} concept diagram or illustration] after the introduction.
Include [IMAGE 2: {TERM} practical example or use case] after the main content section.
Include [IMAGE 3: {TERM} future trends or technology visualization] before the conclusion.

Replace "{TERM}" with the actual vocabulary term in the prompt.`;
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
                placeholder: 'e.g., AI Copilots, AI Studios, Machine Learning, etc.'
            }
        });
        
        // Add description for term input below the input
        const termDesc = termDiv.createDiv({cls: 'setting-item-description term-description'});
        termDesc.textContent = 'Enter a vocabulary term to generate a comprehensive one-page article with images.';
        
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
            new Notice('Please enter a vocabulary term');
            return;
        }

        // Generate the query by replacing {TERM} in the predefined prompt
        const query = this.predefinedPrompt.replace(/{TERM}/g, term);

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