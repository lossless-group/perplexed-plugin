import type { App, Editor } from 'obsidian';
import { Modal, Notice } from 'obsidian';
import type { PerplexityService } from '../services/perplexityService';
import type { PromptsService } from '../services/promptsService';

export class TextEnhancementWithImagesModal extends Modal {
    protected editor: Editor;
    protected perplexityService: PerplexityService;
    protected promptsService: PromptsService;
    protected selectedText: string;

    private prompt: string;
    private fetchBtn!: HTMLButtonElement;

    constructor(
        app: App,
        editor: Editor,
        perplexityService: PerplexityService,
        promptsService: PromptsService,
        selectedText: string
    ) {
        super(app);
        this.editor = editor;
        this.perplexityService = perplexityService;
        this.promptsService = promptsService;
        this.selectedText = selectedText;
        this.prompt = this.promptsService.getEnhanceWithImagesTemplate(this.selectedText);
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('text-enhancement-with-images-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'text-enhancement-with-images-modal__header' });
        header.createEl('h2', {
            text: 'Get related images',
            cls: 'text-enhancement-with-images-modal__title',
        });
        header.createEl('p', {
            cls: 'text-enhancement-with-images-modal__subtitle',
            text: 'Find images related to selected text via perplexity (sonar-pro). Streams image markers into the active note at the cursor.',
        });

        // ----- Selected Text (read-only) -----
        const selectedSection = contentEl.createDiv({ cls: 'text-enhancement-with-images-modal__section' });
        selectedSection.createEl('label', {
            text: 'Selected text',
            cls: 'text-enhancement-with-images-modal__label',
        });
        const selectedTextarea = selectedSection.createEl('textarea', {
            cls: 'text-enhancement-with-images-modal__textarea text-enhancement-with-images-modal__textarea--readonly',
            attr: {
                rows: '6',
                readonly: 'readonly',
            },
        });
        selectedTextarea.value = this.selectedText;

        // ----- Image Request Prompt (editable) -----
        const promptSection = contentEl.createDiv({ cls: 'text-enhancement-with-images-modal__section' });
        promptSection.createEl('label', {
            text: 'Image request prompt',
            cls: 'text-enhancement-with-images-modal__label',
            attr: { for: 'text-enhancement-with-images-modal-prompt' },
        });
        promptSection.createEl('p', {
            cls: 'text-enhancement-with-images-modal__hint',
            text: 'Pre-filled from the plugin template — edit to refine which kinds of images to surface.',
        });
        const promptTextarea = promptSection.createEl('textarea', {
            cls: 'text-enhancement-with-images-modal__textarea',
            attr: {
                id: 'text-enhancement-with-images-modal-prompt',
                rows: '8',
                placeholder: 'Enter your image request prompt…',
            },
        });
        promptTextarea.value = this.prompt;
        promptTextarea.addEventListener('input', () => {
            this.prompt = promptTextarea.value;
        });
        promptTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });

        // ----- Footer -----
        const footer = contentEl.createDiv({ cls: 'text-enhancement-with-images-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'text-enhancement-with-images-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        this.fetchBtn = footer.createEl('button', {
            text: 'Get related images',
            cls: 'text-enhancement-with-images-modal__button mod-cta',
        });
        this.fetchBtn.addEventListener('click', () => void this.onSubmit());

        activeWindow.setTimeout(() => promptTextarea.focus(), 50);
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.prompt.trim();
        if (!trimmed) {
            new Notice('Please enter an image request prompt.');
            return;
        }

        try {
            this.fetchBtn.disabled = true;
            this.fetchBtn.textContent = 'Getting related images…';

            this.close();

            const cursor = this.editor.getCursor();
            this.editor.replaceRange('\n\n', cursor);

            await this.perplexityService.queryPerplexity(
                trimmed,
                'sonar-pro',
                true,
                this.editor,
                {
                    return_citations: false,
                    return_images: true,
                    return_related_questions: false,
                }
            );

            new Notice('Related images added successfully.');
        } catch (error) {
            console.error('Error getting related images:', error);
            new Notice('Failed to get related images. Check console for details.');
        } finally {
            if (this.fetchBtn) {
                this.fetchBtn.disabled = false;
                this.fetchBtn.textContent = 'Get related images';
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
