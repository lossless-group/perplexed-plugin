import type { App, Editor } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';
import type { PerplexicaService, PerplexicaOptions } from '../services/perplexicaService';
import type { PromptsService } from '../services/promptsService';

const FOCUS_MODES: Array<{ value: string; label: string; tagline: string }> = [
    { value: 'webSearch',        label: 'Web Search',        tagline: 'General web search via SearXNG — broad coverage, default choice.' },
    { value: 'academicSearch',   label: 'Academic Search',   tagline: 'Scholarly papers from arXiv, Google Scholar, PubMed-style sources.' },
    { value: 'writingAssistant', label: 'Writing Assistant', tagline: 'No web search — pure writing help (drafting, rewriting, summarizing).' },
    { value: 'wolframAlpha',     label: 'Wolfram Alpha',     tagline: 'Computational / factual queries — math, units, structured data.' },
    { value: 'youtubeSearch',    label: 'YouTube Search',    tagline: 'Video results with transcripts when available.' },
    { value: 'redditSearch',     label: 'Reddit Search',     tagline: 'Discussion threads — opinions, anecdotes, community knowledge.' },
];

const DEFAULT_FOCUS = 'webSearch';

const OPTIMIZATION_MODES: Array<{ value: string; label: string; tagline: string }> = [
    { value: 'speed',    label: 'Speed',    tagline: 'Fewest sources, quickest answer. Good for simple questions.' },
    { value: 'balanced', label: 'Balanced', tagline: 'Default — reasonable depth without long waits.' },
    { value: 'quality', label: 'Quality',  tagline: 'More sources and deeper synthesis. Slower but more thorough.' },
];

const DEFAULT_OPTIMIZATION = 'balanced';

export class PerplexicaModal extends Modal {
    private editor: Editor;
    private perplexicaService: PerplexicaService;
    private promptsService: PromptsService;

    private query = '';
    private focusMode: string = DEFAULT_FOCUS;
    private optimization: string = DEFAULT_OPTIMIZATION;
    private images = false;
    private stream = false;

    // Live-updating description elements below the dropdowns
    private focusDescEl: HTMLElement | null = null;
    private optimizationDescEl: HTMLElement | null = null;

    constructor(
        app: App,
        editor: Editor,
        perplexicaService: PerplexicaService,
        promptsService: PromptsService
    ) {
        super(app);
        this.editor = editor;
        this.perplexicaService = perplexicaService;
        this.promptsService = promptsService;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        // Attach to modalEl so width rules widen the popup itself.
        modalEl.addClass('perplexica-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'perplexica-modal__header' });
        header.createEl('h2', { text: 'Ask Perplexica', cls: 'perplexica-modal__title' });
        header.createEl('p', {
            cls: 'perplexica-modal__subtitle',
            text: 'Self-hosted, source-grounded answers via your local Perplexica instance. Streams into the active note at the cursor.',
        });

        // ----- Question -----
        const querySection = contentEl.createDiv({ cls: 'perplexica-modal__section' });
        querySection.createEl('label', {
            text: 'Question',
            cls: 'perplexica-modal__label',
            attr: { for: 'perplexica-modal-query' },
        });
        const queryTextarea = querySection.createEl('textarea', {
            cls: 'perplexica-modal__textarea',
            attr: {
                id: 'perplexica-modal-query',
                rows: '6',
                placeholder: this.promptsService.getPerplexicaQueryPlaceholder(),
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

        // ----- Search -----
        const searchSection = contentEl.createDiv({ cls: 'perplexica-modal__section' });
        searchSection.createEl('h3', { text: 'Search', cls: 'perplexica-modal__section-title' });

        const focusSetting = new Setting(searchSection)
            .setName('Focus Mode')
            .setDesc(this.focusTagline(this.focusMode))
            .addDropdown(dd => {
                FOCUS_MODES.forEach(({ value, label }) => dd.addOption(value, label));
                dd.setValue(this.focusMode);
                dd.onChange((value) => {
                    this.focusMode = value;
                    if (this.focusDescEl) this.focusDescEl.textContent = this.focusTagline(value);
                });
            });
        this.focusDescEl = focusSetting.descEl;

        const optimizationSetting = new Setting(searchSection)
            .setName('Optimization')
            .setDesc(this.optimizationTagline(this.optimization))
            .addDropdown(dd => {
                OPTIMIZATION_MODES.forEach(({ value, label }) => dd.addOption(value, label));
                dd.setValue(this.optimization);
                dd.onChange((value) => {
                    this.optimization = value;
                    if (this.optimizationDescEl) this.optimizationDescEl.textContent = this.optimizationTagline(value);
                });
            });
        this.optimizationDescEl = optimizationSetting.descEl;

        // ----- Returns -----
        const returnsSection = contentEl.createDiv({ cls: 'perplexica-modal__section' });
        returnsSection.createEl('h3', { text: 'Include in response', cls: 'perplexica-modal__section-title' });

        new Setting(returnsSection)
            .setName('Images')
            .setDesc(this.promptsService.getImagesToggleGenericDescription())
            .addToggle(t => t
                .setValue(this.images)
                .onChange(v => { this.images = v; }));

        // ----- Behavior -----
        const behaviorSection = contentEl.createDiv({ cls: 'perplexica-modal__section' });
        behaviorSection.createEl('h3', { text: 'Behavior', cls: 'perplexica-modal__section-title' });

        new Setting(behaviorSection)
            .setName('Stream Response')
            .setDesc('Write tokens into the note as they arrive — useful for long answers and slow local models.')
            .addToggle(t => t
                .setValue(this.stream)
                .onChange(v => { this.stream = v; }));

        // ----- Footer -----
        const footer = contentEl.createDiv({ cls: 'perplexica-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'perplexica-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        const askBtn = footer.createEl('button', {
            text: 'Ask Perplexica',
            cls: 'perplexica-modal__button mod-cta',
        });
        askBtn.addEventListener('click', () => void this.onSubmit());

        // Focus the question after the DOM has settled
        setTimeout(() => queryTextarea.focus(), 50);
    }

    private focusTagline(value: string): string {
        return FOCUS_MODES.find(m => m.value === value)?.tagline ?? '';
    }

    private optimizationTagline(value: string): string {
        return OPTIMIZATION_MODES.find(m => m.value === value)?.tagline ?? '';
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.query.trim();
        if (!trimmed) {
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        // If images are enabled, append the image-references prompt so the model
        // is instructed to embed image markers throughout the response.
        let processedQuery = trimmed;
        if (this.images) {
            processedQuery = `${trimmed}\n\n${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: PerplexicaOptions = {
            return_images: this.images,
        };

        this.close();
        await this.perplexicaService.queryPerplexica(
            processedQuery,
            this.focusMode,
            this.optimization,
            this.stream,
            this.editor,
            options
        );
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
