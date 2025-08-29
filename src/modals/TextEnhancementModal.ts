import { App, Modal, Notice, Editor } from 'obsidian';
import { PerplexityService } from '../services/perplexityService';
import { PromptsService } from '../services/promptsService';

export class TextEnhancementModal extends Modal {
    protected editor: Editor;
    protected perplexityService: PerplexityService;
    protected promptsService: PromptsService;
    protected selectedText: string;
    protected promptTextArea!: HTMLTextAreaElement;
    protected enhanceButton!: HTMLButtonElement;

    constructor(app: App, editor: Editor, perplexityService: PerplexityService, promptsService: PromptsService, selectedText: string) {
        super(app);
        this.editor = editor;
        this.perplexityService = perplexityService;
        this.promptsService = promptsService;
        this.selectedText = selectedText;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('text-enhancement-modal');
        contentEl.createEl('h2', {text: 'Enhance Text with Perplexity'});
        
        const form = contentEl.createEl('form');
        
        // Original text display
        const originalTextDiv = form.createDiv({cls: 'setting-item'});
        originalTextDiv.createEl('label', {text: 'Selected Text'});
        const originalTextArea = originalTextDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '8',
                readonly: 'readonly'
            }
        });
        originalTextArea.value = this.selectedText;
        originalTextArea.style.backgroundColor = 'var(--background-secondary)';
        originalTextArea.style.color = 'var(--text-muted)';

        // Editable prompt
        const promptDiv = form.createDiv({cls: 'setting-item'});
        promptDiv.createEl('label', {text: 'Enhancement Prompt'});
        this.promptTextArea = promptDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '8',
                placeholder: 'Enter your enhancement prompt...'
            }
        });
        // Pre-populate with the enhancement prompt template
        const enhancementPrompt = this.promptsService.getEnhanceTemplate(this.selectedText);
        this.promptTextArea.value = enhancementPrompt;

        // Buttons container
        const buttonsDiv = form.createDiv({cls: 'setting-item'});
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '10px';
        buttonsDiv.style.flexWrap = 'wrap';
        
        // Enhance button
        this.enhanceButton = buttonsDiv.createEl('button', {
            text: 'Enhance Text',
            cls: 'mod-cta'
        });
        this.enhanceButton.onclick = async (e) => {
            e.preventDefault();
            await this.enhanceText();
        };
        
        // Close button
        const closeButton = buttonsDiv.createEl('button', {
            text: 'Cancel',
            cls: 'mod-cta'
        });
        closeButton.onclick = (e) => {
            e.preventDefault();
            this.close();
        };
    }

    private async enhanceText(): Promise<void> {
        try {
            this.enhanceButton.disabled = true;
            this.enhanceButton.textContent = 'Enhancing...';
            
            // Use the editable prompt from the textarea
            const enhancementPrompt = this.promptTextArea.value;
            
            // Close the modal immediately so user can see the streaming content
            this.close();
            
            // Insert a new line before the enhanced text to make it clear what's new
            const currentPosition = this.editor.getCursor();
            this.editor.replaceRange('\n\n', currentPosition);
            
            // Call Perplexity service directly with the real editor, always streaming
            await this.perplexityService.queryPerplexity(
                enhancementPrompt,
                'sonar-pro', // Use default model
                true, // Always stream
                this.editor,
                {
                    return_citations: true,
                    return_images: false,
                    return_related_questions: false
                }
            );
            
            new Notice('Text enhancement completed!');
            
        } catch (error) {
            console.error('Error enhancing text:', error);
            new Notice('Failed to enhance text. Check console for details.');
        } finally {
            this.enhanceButton.disabled = false;
            this.enhanceButton.textContent = 'Enhance Text';
        }
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
