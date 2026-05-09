import { Modal, Notice, Setting } from 'obsidian';
import type { Editor , App} from 'obsidian';
import type { PerplexityService, PerplexityOptions } from '../services/perplexityService';
import type { PromptsService } from '../services/promptsService';

const PERPLEXITY_MODELS: Array<{ value: string; label: string; tagline?: string }> = [
    { value: 'sonar-deep-research', label: 'sonar-deep-research', tagline: 'Recommended — exhaustive multi-source article research; takes 30–60 seconds' },
    { value: 'sonar-pro', label: 'sonar-pro', tagline: 'Faster, less detail' },
    { value: 'sonar-small', label: 'sonar-small', tagline: 'Cheapest, briefest' },
    { value: 'llama-3.1-sonar-small-128k-online', label: 'llama-3.1-sonar-small-128k-online', tagline: 'Llama 3.1 small, 128k context, online' },
    { value: 'llama-3.1-sonar-large-128k-online', label: 'llama-3.1-sonar-large-128k-online', tagline: 'Llama 3.1 large, 128k context, online' },
];

const DEFAULT_MODEL = 'sonar-deep-research';

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

export class ArticleGeneratorModal extends Modal {
    private editor: Editor;
    private perplexityService: PerplexityService;
    private promptsService: PromptsService;

    private term = '';
    private model: string = DEFAULT_MODEL;
    private recencyFilter = '';
    private citations = true;
    private images = true;
    private relatedQuestions = false;
    private stream = true;

    // Live-updated DOM bits
    private modelDescEl: HTMLElement | null = null;
    private compatibilityWarningEl: HTMLElement | null = null;
    private loadingInterval: number | null = null;

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

        // Default the term to the active file's basename (preserves prior UX)
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile) {
            this.term = currentFile.basename;
        }
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('article-generator-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'article-generator-modal__header' });
        header.createEl('h2', { text: 'Generate one-page article', cls: 'article-generator-modal__title' });
        header.createEl('p', {
            cls: 'article-generator-modal__subtitle',
            text: 'Generates a structured article from a single vocabulary term. Streams into the active note.',
        });

        // ----- Term -----
        const termSection = contentEl.createDiv({ cls: 'article-generator-modal__section' });
        termSection.createEl('label', {
            text: 'Vocabulary term',
            cls: 'article-generator-modal__label',
            attr: { for: 'article-generator-modal-term' },
        });
        const termInput = termSection.createEl('input', {
            cls: 'article-generator-modal__input',
            attr: {
                id: 'article-generator-modal-term',
                type: 'text',
                placeholder: this.promptsService.getArticleTermPlaceholder(),
            },
        });
        termInput.value = this.term;
        termInput.addEventListener('input', () => {
            this.term = termInput.value;
        });
        termInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });
        termSection.createEl('p', {
            cls: 'article-generator-modal__hint',
            text: this.promptsService.getArticleTermDescription(),
        });

        // ----- Model -----
        const modelSection = contentEl.createDiv({ cls: 'article-generator-modal__section' });
        modelSection.createEl('h3', { text: 'Model', cls: 'article-generator-modal__section-title' });

        new Setting(modelSection)
            .setName('Model')
            .setDesc(this.modelTagline(this.model))
            .addDropdown(dd => {
                PERPLEXITY_MODELS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.model);
                dd.onChange((value) => {
                    this.model = value;
                    this.applyModelChange(value);
                    this.updateCompatibilityWarning();
                });
            });
        this.modelDescEl = modelSection.querySelector('.setting-item-description');
        // Apply initial deep-research description if default is sonar-deep-research
        this.applyModelChange(this.model);

        new Setting(modelSection)
            .setName('Recency filter')
            .setDesc('Restrict search to recent content. Multi-year options fall back to "year" (the API ceiling).')
            .addDropdown(dd => {
                RECENCY_OPTIONS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.recencyFilter);
                dd.onChange((value) => {
                    this.recencyFilter = value;
                });
            });

        // ----- Returns -----
        const returnsSection = contentEl.createDiv({ cls: 'article-generator-modal__section' });
        returnsSection.createEl('h3', { text: 'Include in response', cls: 'article-generator-modal__section-title' });

        new Setting(returnsSection)
            .setName('Citations')
            .setDesc('Append a citations section with source links — recommended for research articles.')
            .addToggle(t => t
                .setValue(this.citations)
                .onChange(v => { this.citations = v; }));

        const imagesSetting = new Setting(returnsSection)
            .setName('Images')
            .setDesc(this.promptsService.getImagesToggleDescription())
            .addToggle(t => t
                .setValue(this.images)
                .onChange(v => {
                    this.images = v;
                    this.updateCompatibilityWarning();
                }));
        // Slot for the live compatibility warning under the Images row
        this.compatibilityWarningEl = imagesSetting.settingEl.createDiv({
            cls: 'article-generator-modal__warning',
        });
        this.updateCompatibilityWarning();

        new Setting(returnsSection)
            .setName('Related questions')
            .setDesc('Surface follow-up questions Perplexity suggests at the end of the response.')
            .addToggle(t => t
                .setValue(this.relatedQuestions)
                .onChange(v => { this.relatedQuestions = v; }));

        // ----- Behavior -----
        const behaviorSection = contentEl.createDiv({ cls: 'article-generator-modal__section' });
        behaviorSection.createEl('h3', { text: 'Behavior', cls: 'article-generator-modal__section-title' });

        new Setting(behaviorSection)
            .setName('Stream response')
            .setDesc('Recommended for articles — see content as it generates. Note: Deep research with streaming may not support images.')
            .addToggle(t => t
                .setValue(this.stream)
                .onChange(v => { this.stream = v; }));

        // ----- Footer -----
        const footer = contentEl.createDiv({ cls: 'article-generator-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'article-generator-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        const generateBtn = footer.createEl('button', {
            text: 'Generate article',
            cls: 'article-generator-modal__button mod-cta',
        });
        generateBtn.addEventListener('click', () => void this.onSubmit());

        activeWindow.setTimeout(() => termInput.focus(), 50);
    }

    private modelTagline(value: string): string {
        const found = PERPLEXITY_MODELS.find(m => m.value === value);
        return found?.tagline ?? '';
    }

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

    /**
     * Show a warning when both Images and sonar-deep-research are on — they don't
     * combine reliably (preserves the prior modal's compatibility check).
     */
    private updateCompatibilityWarning(): void {
        if (!this.compatibilityWarningEl) return;
        const incompatible = this.images && this.model === 'sonar-deep-research';
        if (incompatible) {
            this.compatibilityWarningEl.textContent =
                '⚠ Images are unstable in deep research mode. Consider a different model for reliable image support.';
            this.compatibilityWarningEl.addClass('is-active');
        } else {
            this.compatibilityWarningEl.textContent = '';
            this.compatibilityWarningEl.removeClass('is-active');
        }
    }

    /**
     * Insert an animated "🔍 Deep Research Loading..." line at the cursor and
     * keep it ticking until PerplexityService clears it. Preserves the prior UX.
     */
    private async showDeepResearchLoading(): Promise<void> {
        const loadingText = '🔍 Deep Research Loading...';
        const cursor = this.editor.getCursor();
        this.editor.replaceRange(loadingText, cursor);

        let dots = 0;
        const maxDots = 3;
        this.loadingInterval = window.setInterval(() => {
            dots = (dots + 1) % (maxDots + 1);
            const animatedText = '🔍 Deep Research Loading' + '.'.repeat(dots);
            const currentPos = this.editor.getCursor();
            const loadingLine = currentPos.line;
            const lineContent = this.editor.getLine(loadingLine);
            if (lineContent.includes('🔍 Deep Research Loading')) {
                const startCh = lineContent.indexOf('🔍 Deep Research Loading');
                const endCh = lineContent.length;
                this.editor.replaceRange(
                    animatedText,
                    { line: loadingLine, ch: startCh },
                    { line: loadingLine, ch: endCh }
                );
            }
        }, 500);

        // Resolve quickly so the API request can start; PerplexityService clears
        // the text + interval when the first content chunk arrives.
        return new Promise((resolve) => {
            activeWindow.setTimeout(() => resolve(), 100);
        });
    }

    async onSubmit(): Promise<void> {
        const trimmedTerm = this.term.trim();
        if (!trimmedTerm) {
            new Notice(this.promptsService.getEnterTermNotice());
            return;
        }

        const isDeepResearch = this.model === 'sonar-deep-research';
        let query = isDeepResearch
            ? this.promptsService.getDeepResearchArticleTemplate(trimmedTerm)
            : this.promptsService.getArticleGeneratorTemplate(trimmedTerm);

        if (this.images) {
            query = `${query}\n\n${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexityOptions = {
            return_citations: this.citations,
            return_images: this.images,
            return_related_questions: this.relatedQuestions,
            search_recency_filter: this.recencyFilter,
        };

        this.close();

        if (isDeepResearch) {
            await this.showDeepResearchLoading();
        }

        try {
            await this.perplexityService.queryPerplexity(
                query,
                this.model,
                this.stream,
                this.editor,
                options
            );
        } finally {
            if (this.loadingInterval !== null) {
                window.clearInterval(this.loadingInterval);
                this.loadingInterval = null;
            }
        }
    }

    onClose(): void {
        if (this.loadingInterval !== null) {
            window.clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
        this.contentEl.empty();
    }
}
