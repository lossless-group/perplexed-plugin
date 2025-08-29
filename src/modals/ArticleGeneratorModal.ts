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
        
        // Set default value to the current file name (without extension)
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile) {
            const fileName = currentFile.basename; // This gets the filename without extension
            this.termInput.value = fileName;
        }
        
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
        
        // Set default model to sonar-deep-research for article generation
        if (this.modelSelect) {
            this.modelSelect.value = 'sonar-deep-research';
            // Trigger the onchange event to update the description
            this.modelSelect.dispatchEvent(new Event('change'));
        }
        
        // Ensure streaming is enabled for article generation
        if (this.streamToggle) {
            this.streamToggle.checked = true;
            // Add a description to explain why streaming is recommended for articles
            const streamDiv = this.streamToggle.closest('.setting-item');
            if (streamDiv) {
                const streamDesc = streamDiv.createDiv({cls: 'setting-item-description'});
                streamDesc.textContent = 'Streaming is recommended for article generation to see content as it\'s being created. Note: Deep Research with streaming may not support images.';
            }
        }
        
        // Add warning if images and Deep Research are enabled together
        if (this.imagesToggle && this.modelSelect) {
            const checkCompatibility = () => {
                if (this.imagesToggle.checked && this.modelSelect.value === 'sonar-deep-research') {
                    // Show a notice about the limitation
                    const imagesDiv = this.imagesToggle.closest('.setting-item');
                    if (imagesDiv) {
                        // Remove any existing warning
                        const existingWarning = imagesDiv.querySelector('.compatibility-warning');
                        if (existingWarning) {
                            existingWarning.remove();
                        }
                        
                        // Add new warning
                        const warning = imagesDiv.createDiv({cls: 'setting-item-description compatibility-warning'});
                        warning.style.color = '#ff6b6b';
                        warning.style.fontWeight = 'bold';
                        warning.textContent = '⚠️ Warning: Images are very unstable in Deep Research mode. Consider using a different model for reliable image support.';
                    }
                } else {
                    // Remove warning if conditions are not met
                    const imagesDiv = this.imagesToggle.closest('.setting-item');
                    if (imagesDiv) {
                        const existingWarning = imagesDiv.querySelector('.compatibility-warning');
                        if (existingWarning) {
                            existingWarning.remove();
                        }
                    }
                }
            };
            
            // Check on initial load
            checkCompatibility();
            
            // Add event listeners to check when settings change
            this.imagesToggle.addEventListener('change', checkCompatibility);
            this.modelSelect.addEventListener('change', checkCompatibility);
        }
        
        // Update the submit button text
        const submitButton = contentEl.querySelector('button.mod-cta') as HTMLButtonElement;
        if (submitButton) {
            submitButton.textContent = 'Generate Article';
        }
        
        // Focus on the term input instead of query input
        setTimeout(() => this.termInput.focus(), 100);
    }
    
    private async showDeepResearchLoading(): Promise<void> {
        console.log('🎬 Initializing Deep Research loading animation...');
        const loadingText = "🔍 Deep Research Loading...";
        const cursor = this.editor.getCursor();
        
        console.log('📍 Inserting loading text at cursor position:', cursor);
        // Insert loading text at cursor position
        this.editor.replaceRange(loadingText, cursor);
        
        // Animate the loading text with dots
        let dots = 0;
        const maxDots = 3;
        let animationCount = 0;
        
        console.log('🔄 Starting loading animation interval...');
        const animationInterval = setInterval(() => {
            animationCount++;
            dots = (dots + 1) % (maxDots + 1);
            const animatedText = "🔍 Deep Research Loading" + ".".repeat(dots);
            
            console.log(`🎬 Animation frame ${animationCount}: ${animatedText}`);
            
            // Update the loading text
            const currentPos = this.editor.getCursor();
            const loadingLine = currentPos.line;
            const lineContent = this.editor.getLine(loadingLine);
            
            if (lineContent.includes("🔍 Deep Research Loading")) {
                const startCh = lineContent.indexOf("🔍 Deep Research Loading");
                const endCh = lineContent.length;
                this.editor.replaceRange(
                    animatedText,
                    { line: loadingLine, ch: startCh },
                    { line: loadingLine, ch: endCh }
                );
            }
        }, 500); // Update every 500ms
        
        // Store the interval ID so we can clear it when streaming starts
        (this as any).loadingInterval = animationInterval;
        
        console.log('⏳ Setting up loading promise...');
        // Return a promise that resolves when streaming starts
        return new Promise((resolve) => {
            console.log('✅ Loading promise setup complete, resolving immediately');
            // Store the resolve function so we can call it when streaming starts
            (this as any).loadingResolve = resolve;
            
            // For now, resolve immediately to avoid blocking the request
            // We'll let the PerplexityService handle clearing the loading text
            setTimeout(() => {
                console.log('🚀 Resolving loading promise to continue with API request');
                resolve();
            }, 100); // Small delay to show the loading text briefly
        });
    }
    
    async onSubmit() {
        const term = this.termInput.value.trim();
        if (!term) {
            new Notice(this.promptsService.getEnterTermNotice());
            return;
        }

        // Generate the query using the appropriate prompt template based on the selected model
        const isDeepResearch = this.modelSelect.value === 'sonar-deep-research';
        let query = isDeepResearch 
            ? this.promptsService.getDeepResearchArticleTemplate(term)
            : this.promptsService.getArticleGeneratorTemplate(term);

        // If images are enabled, add the configurable image references prompt
        if (this.imagesToggle.checked) {
            query = `${query}\n\n${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexityOptions = {
            return_citations: this.citationsToggle.checked,
            return_images: this.imagesToggle.checked,
            return_related_questions: this.relatedQuestionsToggle.checked,
            search_recency_filter: this.recencyFilterSelect.value
        };

        this.close();
        
        // Show loading animation for Deep Research
        if (this.modelSelect.value === 'sonar-deep-research') {
            console.log('🚀 Starting Deep Research loading animation...');
            await this.showDeepResearchLoading();
            console.log('✅ Deep Research loading animation completed');
        }
        
        console.log('🚀 Making Perplexity API request...');
        console.log('📊 Request details:', {
            model: this.modelSelect.value,
            stream: this.streamToggle.checked,
            options: options,
            queryLength: query.length
        });
        
        try {
            await this.perplexityService.queryPerplexity(
                query, 
                this.modelSelect.value, 
                this.streamToggle.checked, 
                this.editor, 
                options
            );
            
            console.log('✅ Perplexity API request completed');
        } finally {
            // Clear the loading animation interval if it exists
            if ((this as any).loadingInterval) {
                console.log('🛑 Clearing loading animation interval from modal');
                clearInterval((this as any).loadingInterval);
                (this as any).loadingInterval = null;
            }
        }
    }
} 