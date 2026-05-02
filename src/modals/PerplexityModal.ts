import { App, Modal, Notice, Setting } from 'obsidian';
import type { Editor } from 'obsidian';
import type { PerplexityService, PerplexityOptions } from '../services/perplexityService';
import type { PromptsService } from '../services/promptsService';

const PERPLEXITY_MODELS: Array<{ value: string; label: string; tagline?: string }> = [
    { value: 'sonar-pro', label: 'sonar-pro', tagline: 'Default — fast web-grounded answers' },
    { value: 'sonar-small', label: 'sonar-small', tagline: 'Cheaper, faster, less detail' },
    { value: 'sonar-deep-research', label: 'sonar-deep-research', tagline: 'Exhaustive multi-source research; takes 30–60 seconds' },
    { value: 'llama-3.1-sonar-small-128k-online', label: 'llama-3.1-sonar-small-128k-online', tagline: 'Llama 3.1 small, 128k context, online' },
    { value: 'llama-3.1-sonar-large-128k-online', label: 'llama-3.1-sonar-large-128k-online', tagline: 'Llama 3.1 large, 128k context, online' },
];

const DEFAULT_MODEL = 'sonar-pro';

const RECENCY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: 'No filter — search all content' },
    { value: 'day', label: 'Past day' },
    { value: 'week', label: 'Past week' },
    { value: 'month', label: 'Past month' },
    { value: 'year', label: 'Past year' },
    { value: '2years', label: 'Past 2+ years (falls back to "year")' },
    { value: '3years', label: 'Past 3+ years (falls back to "year")' },
    { value: '5years', label: 'Past 5+ years (falls back to "year")' },
];

export class PerplexityModal extends Modal {
    private editor: Editor;
    private perplexityService: PerplexityService;
    private promptsService: PromptsService;

    private query = '';
    private model: string = DEFAULT_MODEL;
    private recencyFilter = '';
    private citations = true;
    private images = true;
    private relatedQuestions = false;
    private stream = true;

    // Live-updating description below the model dropdown
    private modelDescEl: HTMLElement | null = null;

    constructor(
        app: App,
        editor: Editor,
        perplexityService: PerplexityService,
        promptsService: PromptsService
    ) {
        super(app);
        this.editor = editor;
        this.perplexityService = perplexityService;
        this.promptsService = promptsService;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        // Attach to modalEl (outer .modal element) so the width rule actually widens the popup.
        // Setting width on contentEl (the inner .modal-content) only sizes the inner area —
        // see context-v/issue-resolutions/Widen-Modals-in-Obsidian-using-CSS.md
        modalEl.addClass('perplexity-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'perplexity-modal__header' });
        header.createEl('h2', { text: 'Ask Perplexity', cls: 'perplexity-modal__title' });
        header.createEl('p', {
            cls: 'perplexity-modal__subtitle',
            text: 'Web-grounded research with native citations. Streams into the active note at the cursor.',
        });

        // ----- Question -----
        const querySection = contentEl.createDiv({ cls: 'perplexity-modal__section' });
        querySection.createEl('label', {
            text: 'Question',
            cls: 'perplexity-modal__label',
            attr: { for: 'perplexity-modal-query' },
        });
        const queryTextarea = querySection.createEl('textarea', {
            cls: 'perplexity-modal__textarea',
            attr: {
                id: 'perplexity-modal-query',
                rows: '6',
                placeholder: this.promptsService.getPerplexityQueryPlaceholder(),
            },
        });
        queryTextarea.value = this.query;
        queryTextarea.addEventListener('input', () => {
            this.query = queryTextarea.value;
        });
        // Cmd/Ctrl+Enter submits
        queryTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });

        // ----- Model -----
        const modelSection = contentEl.createDiv({ cls: 'perplexity-modal__section' });
        modelSection.createEl('h3', { text: 'Model', cls: 'perplexity-modal__section-title' });

        new Setting(modelSection)
            .setName('Model')
            .setDesc(this.modelTagline(this.model))
            .addDropdown(dd => {
                PERPLEXITY_MODELS.forEach(({ value, label }) => dd.addOption(value, label));
                dd.setValue(this.model);
                dd.onChange((value) => {
                    this.model = value;
                    this.applyModelChange(value);
                });
            });

        // Stash the description element so we can live-update it on model changes
        this.modelDescEl = modelSection.querySelector('.setting-item-description');

        new Setting(modelSection)
            .setName('Recency Filter')
            .setDesc('Restrict search to recent content. Multi-year options fall back to "year" (the API ceiling).')
            .addDropdown(dd => {
                RECENCY_OPTIONS.forEach(({ value, label }) => dd.addOption(value, label));
                dd.setValue(this.recencyFilter);
                dd.onChange((value) => {
                    this.recencyFilter = value;
                });
            });

        // ----- Returns -----
        const returnsSection = contentEl.createDiv({ cls: 'perplexity-modal__section' });
        returnsSection.createEl('h3', { text: 'Include in response', cls: 'perplexity-modal__section-title' });

        new Setting(returnsSection)
            .setName('Citations')
            .setDesc('Append a Citations section with source links — recommended for research notes.')
            .addToggle(t => t
                .setValue(this.citations)
                .onChange(v => { this.citations = v; }));

        new Setting(returnsSection)
            .setName('Images')
            .setDesc(this.promptsService.getImagesToggleDescription())
            .addToggle(t => t
                .setValue(this.images)
                .onChange(v => { this.images = v; }));

        new Setting(returnsSection)
            .setName('Related Questions')
            .setDesc('Surface follow-up questions Perplexity suggests at the end of the response.')
            .addToggle(t => t
                .setValue(this.relatedQuestions)
                .onChange(v => { this.relatedQuestions = v; }));

        // ----- Behavior -----
        const behaviorSection = contentEl.createDiv({ cls: 'perplexity-modal__section' });
        behaviorSection.createEl('h3', { text: 'Behavior', cls: 'perplexity-modal__section-title' });

        new Setting(behaviorSection)
            .setName('Stream Response')
            .setDesc('Recommended for long answers. Deep Research model can take 30–60s — streaming makes progress visible.')
            .addToggle(t => t
                .setValue(this.stream)
                .onChange(v => { this.stream = v; }));

        // ----- Footer -----
        const footer = contentEl.createDiv({ cls: 'perplexity-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'perplexity-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        const askBtn = footer.createEl('button', {
            text: 'Ask Perplexity',
            cls: 'perplexity-modal__button mod-cta',
        });
        askBtn.addEventListener('click', () => void this.onSubmit());

        // Focus the question after the DOM has settled
        setTimeout(() => queryTextarea.focus(), 50);
    }

    private modelTagline(value: string): string {
        const found = PERPLEXITY_MODELS.find(m => m.value === value);
        return found?.tagline ?? '';
    }

    /**
     * When the model changes:
     *   - Update the description below the dropdown
     *   - For sonar-deep-research, append the long-form description from promptsService
     *     (preserving the previous modal's behavior of showing extra deep-research guidance)
     */
    private applyModelChange(value: string): void {
        if (!this.modelDescEl) return;

        if (value === 'sonar-deep-research') {
            const baseTagline = this.modelTagline(value);
            const deepDesc = this.promptsService.getDeepResearchDescription();
            this.modelDescEl.textContent = deepDesc
                ? `${baseTagline} — ${deepDesc}`
                : baseTagline;
        } else {
            this.modelDescEl.textContent = this.modelTagline(value);
        }
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.query.trim();
        if (!trimmed) {
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        // If images are enabled, append the image-references prompt so Perplexity is
        // instructed to embed image markers throughout the response (preserves the
        // previous modal's submit-time behavior).
        let processedQuery = trimmed;
        if (this.images) {
            processedQuery = `${trimmed}\n\n${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexityOptions = {
            return_citations: this.citations,
            return_images: this.images,
            return_related_questions: this.relatedQuestions,
            search_recency_filter: this.recencyFilter,
        };

        this.close();
        await this.perplexityService.queryPerplexity(
            processedQuery,
            this.model,
            this.stream,
            this.editor,
            options
        );
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
