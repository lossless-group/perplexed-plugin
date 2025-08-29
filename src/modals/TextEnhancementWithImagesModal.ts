import { App, Modal, Notice, Editor } from 'obsidian';
import { PerplexityService } from '../services/perplexityService';
import { PromptsService } from '../services/promptsService';

export class TextEnhancementWithImagesModal extends Modal {
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
        contentEl.addClass('get-related-images-modal');
        contentEl.createEl('h2', {text: 'Get Related Images'});
        
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
        promptDiv.createEl('label', {text: 'Image Request Prompt'});
        this.promptTextArea = promptDiv.createEl('textarea', {
            cls: 'text-input',
            attr: {
                rows: '8',
                placeholder: 'Enter your image request prompt...'
            }
        });
        // Pre-populate with the image request prompt template
        const imageRequestPrompt = this.promptsService.getEnhanceWithImagesTemplate(this.selectedText);
        this.promptTextArea.value = imageRequestPrompt;

        // Buttons container
        const buttonsDiv = form.createDiv({cls: 'setting-item'});
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '10px';
        buttonsDiv.style.flexWrap = 'wrap';
        
        // Enhance button
        this.enhanceButton = buttonsDiv.createEl('button', {
            text: 'Get Related Images',
            cls: 'mod-cta'
        });
        this.enhanceButton.onclick = async (e) => {
            e.preventDefault();
            await this.enhanceTextWithImages();
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

    private async enhanceTextWithImages(): Promise<void> {
        try {
            this.enhanceButton.disabled = true;
            this.enhanceButton.textContent = 'Getting Related Images...';
            
            // Use the editable prompt from the textarea
            const imagePrompt = this.promptTextArea.value;
            
            // Close the modal immediately so user can see the streaming content
            this.close();
            
            // Insert a new line before the images to make it clear what's new
            const currentPosition = this.editor.getCursor();
            this.editor.replaceRange('\n\n', currentPosition);
            
            // Call Perplexity service directly with the real editor, always streaming and with images enabled
            await this.perplexityService.queryPerplexity(
                imagePrompt,
                'sonar-pro', // Use default model
                true, // Always stream
                this.editor,
                {
                    return_citations: false, // No citations needed for image-only response
                    return_images: true, // Enable images for this enhancement
                    return_related_questions: false
                }
            );
            
            new Notice('Related images added successfully!');
            
        } catch (error) {
            console.error('Error getting related images:', error);
            new Notice('Failed to get related images. Check console for details.');
        } finally {
            this.enhanceButton.disabled = false;
            this.enhanceButton.textContent = 'Get Related Images';
        }
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
