import type { App, Editor } from 'obsidian';
import { Modal, Notice } from 'obsidian';
import type { PerplexityService } from '../services/perplexityService';
import type { PromptsService } from '../services/promptsService';

export class TextEnhancementModal extends Modal {
    protected editor: Editor;
    protected perplexityService: PerplexityService;
    protected promptsService: PromptsService;
    protected selectedText: string;

    private prompt: string;
    private enhanceBtn!: HTMLButtonElement;

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
        this.prompt = this.promptsService.getEnhanceTemplate(this.selectedText);
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('text-enhancement-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'text-enhancement-modal__header' });
        header.createEl('h2', { text: 'Enhance text with Perplexity', cls: 'text-enhancement-modal__title' });
        header.createEl('p', {
            cls: 'text-enhancement-modal__subtitle',
            text: 'Rewrite or expand selected text via Perplexity (Sonar-pro). Streams into the active note at the cursor with citations.',
        });

        // ----- Selected Text (read-only) -----
        const selectedSection = contentEl.createDiv({ cls: 'text-enhancement-modal__section' });
        selectedSection.createEl('label', {
            text: 'Selected text',
            cls: 'text-enhancement-modal__label',
        });
        const selectedTextarea = selectedSection.createEl('textarea', {
            cls: 'text-enhancement-modal__textarea text-enhancement-modal__textarea--readonly',
            attr: {
                rows: '6',
                readonly: 'readonly',
            },
        });
        selectedTextarea.value = this.selectedText;

        // ----- Enhancement Prompt (editable) -----
        const promptSection = contentEl.createDiv({ cls: 'text-enhancement-modal__section' });
        promptSection.createEl('label', {
            text: 'Enhancement prompt',
            cls: 'text-enhancement-modal__label',
            attr: { for: 'text-enhancement-modal-prompt' },
        });
        promptSection.createEl('p', {
            cls: 'text-enhancement-modal__hint',
            text: 'Pre-filled from the plugin template — edit to refine the rewrite instructions before submitting.',
        });
        const promptTextarea = promptSection.createEl('textarea', {
            cls: 'text-enhancement-modal__textarea',
            attr: {
                id: 'text-enhancement-modal-prompt',
                rows: '8',
                placeholder: 'Enter your enhancement prompt…',
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
        const footer = contentEl.createDiv({ cls: 'text-enhancement-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'text-enhancement-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        this.enhanceBtn = footer.createEl('button', {
            text: 'Enhance text',
            cls: 'text-enhancement-modal__button mod-cta',
        });
        this.enhanceBtn.addEventListener('click', () => void this.onSubmit());

        activeWindow.setTimeout(() => promptTextarea.focus(), 50);
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.prompt.trim();
        if (!trimmed) {
            new Notice('Please enter an enhancement prompt.');
            return;
        }

        try {
            this.enhanceBtn.disabled = true;
            this.enhanceBtn.textContent = 'Enhancing…';

            this.close();

            const cursor = this.editor.getCursor();
            this.editor.replaceRange('\n\n', cursor);

            await this.perplexityService.queryPerplexity(
                trimmed,
                'sonar-pro',
                true,
                this.editor,
                {
                    return_citations: true,
                    return_images: false,
                    return_related_questions: false,
                }
            );

            new Notice('Text enhancement completed.');
        } catch (error) {
            console.error('Error enhancing text:', error);
            new Notice('Failed to enhance text. Check console for details.');
        } finally {
            if (this.enhanceBtn) {
                this.enhanceBtn.disabled = false;
                this.enhanceBtn.textContent = 'Enhance text';
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
