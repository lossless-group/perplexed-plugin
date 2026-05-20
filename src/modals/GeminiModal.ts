import { Modal, Notice, Setting } from 'obsidian';
import type { Editor, App } from 'obsidian';
import type { GeminiService, GeminiOptions } from '../services/geminiService';
import type { PromptsService } from '../services/promptsService';

const GEMINI_MODELS: Array<{ value: string; label: string; tagline: string }> = [
    { value: 'gemini-flash-latest', label: 'Gemini Flash (latest)', tagline: 'Always-current flash alias — free-tier friendly' },
    { value: 'gemini-pro-latest', label: 'Gemini Pro (latest)', tagline: 'Always-current pro alias — deepest reasoning' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tagline: 'Pinned 2.5 Pro — deepest reasoning + grounding' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tagline: 'Pinned 2.5 Flash — faster, lower cost' },
];

const DEFAULT_MODEL = 'gemini-flash-latest';

export interface GeminiModalDefaults {
    defaultModel?: string;
    enableGrounding?: boolean;
    includeSearchSuggestions?: boolean;
    resolveCitationUrls?: boolean;
}

export class GeminiModal extends Modal {
    private editor: Editor;
    private geminiService: GeminiService;

    private query = '';
    private model: string = DEFAULT_MODEL;
    private grounding = true;
    private suggestions = true;
    private resolveUrls = true;
    private stream = true;

    constructor(
        app: App,
        editor: Editor,
        geminiService: GeminiService,
        // Accepted for caller-symmetry with PerplexityModal; the Gemini flow
        // doesn't pull from PromptsService — prompt content lives in the
        // user's question.
        _promptsService: PromptsService,
        defaults?: GeminiModalDefaults
    ) {
        super(app);
        this.editor = editor;
        this.geminiService = geminiService;
        if (defaults?.defaultModel) this.model = defaults.defaultModel;
        if (defaults?.enableGrounding !== undefined) this.grounding = defaults.enableGrounding;
        if (defaults?.includeSearchSuggestions !== undefined) this.suggestions = defaults.includeSearchSuggestions;
        if (defaults?.resolveCitationUrls !== undefined) this.resolveUrls = defaults.resolveCitationUrls;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('gemini-modal');
        contentEl.empty();

        const header = contentEl.createDiv({ cls: 'gemini-modal__header' });
        header.createEl('h2', { text: 'Ask Gemini', cls: 'gemini-modal__title' });
        header.createEl('p', {
            cls: 'gemini-modal__subtitle',
            text: 'Google search grounding with per-segment citations. Streams into the active note at the cursor.',
        });

        const querySection = contentEl.createDiv({ cls: 'gemini-modal__section' });
        querySection.createEl('label', {
            text: 'Question',
            cls: 'gemini-modal__label',
            attr: { for: 'gemini-modal-query' },
        });
        const queryTextarea = querySection.createEl('textarea', {
            cls: 'gemini-modal__textarea',
            attr: {
                id: 'gemini-modal-query',
                rows: '6',
                placeholder: 'What would you like to research? Multi-line OK.',
            },
        });
        queryTextarea.value = this.query;
        queryTextarea.addEventListener('input', () => { this.query = queryTextarea.value; });

        const optionsSection = contentEl.createDiv({ cls: 'gemini-modal__section' });
        optionsSection.createEl('h3', { text: 'Model', cls: 'gemini-modal__section-title' });

        new Setting(optionsSection)
            .setName('Model')
            .setDesc(this.modelTagline(this.model))
            .addDropdown(dd => {
                GEMINI_MODELS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.model);
                dd.onChange((value) => {
                    this.model = value;
                    const descEl = optionsSection.querySelector(
                        '.setting-item:nth-of-type(1) .setting-item-description'
                    );
                    if (descEl) descEl.textContent = this.modelTagline(value);
                });
            });

        const togglesSection = contentEl.createDiv({ cls: 'gemini-modal__section' });
        togglesSection.createEl('h3', { text: 'Behavior', cls: 'gemini-modal__section-title' });

        new Setting(togglesSection)
            .setName('Enable Google search grounding')
            .setDesc('Server-side Google_search tool. Emits per-segment grounding supports that survive into citations.')
            .addToggle(t => t.setValue(this.grounding).onChange(v => { this.grounding = v; }));

        new Setting(togglesSection)
            .setName('Append Google searches list')
            .setDesc('Markdown bullet list of the queries Gemini ran, each linked to Google search.')
            .addToggle(t => t.setValue(this.suggestions).onChange(v => { this.suggestions = v; }));

        new Setting(togglesSection)
            .setName('Resolve citation urls')
            .setDesc('Resolve Google grounding redirects to durable source urls. Off = fast but citations expire in ~30 days.')
            .addToggle(t => t.setValue(this.resolveUrls).onChange(v => { this.resolveUrls = v; }));

        new Setting(togglesSection)
            .setName('Stream response')
            .setDesc('Recommended for long answers — avoids HTTP timeouts and writes incrementally to the note.')
            .addToggle(t => t.setValue(this.stream).onChange(v => { this.stream = v; }));

        const footer = contentEl.createDiv({ cls: 'gemini-modal__footer' });
        const cancelBtn = footer.createEl('button', { text: 'Cancel', cls: 'gemini-modal__button' });
        cancelBtn.addEventListener('click', () => this.close());

        const askBtn = footer.createEl('button', { text: 'Ask Gemini', cls: 'gemini-modal__button mod-cta' });
        askBtn.addEventListener('click', () => void this.onSubmit());

        queryTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });

        activeWindow.setTimeout(() => queryTextarea.focus(), 50);
    }

    private modelTagline(value: string): string {
        const found = GEMINI_MODELS.find(m => m.value === value);
        return found ? found.tagline : '';
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.query.trim();
        if (!trimmed) {
            new Notice('Please enter a question for Gemini.');
            return;
        }

        const options: GeminiOptions = {
            enableGrounding: this.grounding,
            includeSearchSuggestions: this.suggestions,
            resolveCitationUrls: this.resolveUrls,
        };

        this.close();
        await this.geminiService.queryGemini(
            trimmed,
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
