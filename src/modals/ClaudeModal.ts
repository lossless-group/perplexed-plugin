import { Modal, Notice, Setting } from 'obsidian';
import type { Editor , App} from 'obsidian';
import type { ClaudeService, ClaudeOptions } from '../services/claudeService';
import type { PromptsService } from '../services/promptsService';

const CLAUDE_MODELS: Array<{ value: string; label: string; tagline: string }> = [
    { value: 'claude-opus-4-7', label: 'Opus 4.7', tagline: 'Most capable — research / agentic / vision' },
    { value: 'claude-opus-4-6', label: 'Opus 4.6', tagline: 'Previous-generation Opus' },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tagline: 'Best speed / intelligence balance' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5', tagline: 'Fastest, lowest cost' },
];

const DEFAULT_MODEL = 'claude-opus-4-7';

const EFFORT_OPTIONS: Array<{ value: NonNullable<ClaudeOptions['effort']>; label: string }> = [
    { value: 'low', label: 'Low — fastest, least thorough' },
    { value: 'medium', label: 'Medium — balanced' },
    { value: 'high', label: 'High — recommended for research' },
    { value: 'xhigh', label: 'xHigh — deep agentic (Opus 4.7)' },
    { value: 'max', label: 'Max — Opus only, highest cost' },
];

export class ClaudeModal extends Modal {
    private editor: Editor;
    private claudeService: ClaudeService;

    private query = '';
    private model: string = DEFAULT_MODEL;
    private effort: NonNullable<ClaudeOptions['effort']> = 'high';
    private webSearch = true;
    private thinking = false;
    private stream = true;

    constructor(
        app: App,
        editor: Editor,
        claudeService: ClaudeService,
        // Accepted for caller-symmetry with PerplexityModal; the Claude flow
        // doesn't pull from PromptsService — prompt content lives in the
        // user's question. Kept in the signature so registerClaudeCommands
        // doesn't need a special call site.
        _promptsService: PromptsService
    ) {
        super(app);
        this.editor = editor;
        this.claudeService = claudeService;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('claude-modal');
        contentEl.empty();

        // Header
        const header = contentEl.createDiv({ cls: 'claude-modal__header' });
        header.createEl('h2', { text: 'Ask Claude', cls: 'claude-modal__title' });
        header.createEl('p', {
            cls: 'claude-modal__subtitle',
            text: 'Server-side web search with native citations. Streams into the active note at the cursor.',
        });

        // Section: Question — full-width textarea
        const querySection = contentEl.createDiv({ cls: 'claude-modal__section' });
        querySection.createEl('label', {
            text: 'Question',
            cls: 'claude-modal__label',
            attr: { for: 'claude-modal-query' },
        });
        const queryTextarea = querySection.createEl('textarea', {
            cls: 'claude-modal__textarea',
            attr: {
                id: 'claude-modal-query',
                rows: '6',
                placeholder: 'What would you like to research? Multi-line ok.',
            },
        });
        queryTextarea.value = this.query;
        queryTextarea.addEventListener('input', () => {
            this.query = queryTextarea.value;
        });

        // Section: Model + Effort, side by side as Obsidian Settings
        const optionsSection = contentEl.createDiv({ cls: 'claude-modal__section' });
        optionsSection.createEl('h3', { text: 'Model', cls: 'claude-modal__section-title' });

        new Setting(optionsSection)
            .setName('Model')
            .setDesc(this.modelTagline(this.model))
            .addDropdown(dd => {
                CLAUDE_MODELS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.model);
                dd.onChange((value) => {
                    this.model = value;
                    // Update the description live
                    const descEl = optionsSection.querySelector(
                        '.setting-item:nth-of-type(1) .setting-item-description'
                    );
                    if (descEl) descEl.textContent = this.modelTagline(value);
                });
            });

        new Setting(optionsSection)
            .setName('Effort')
            .setDesc('Controls thinking depth and overall token spend. Higher = more thorough; more tokens.')
            .addDropdown(dd => {
                EFFORT_OPTIONS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.effort);
                dd.onChange((value) => {
                    this.effort = value as NonNullable<ClaudeOptions['effort']>;
                });
            });

        // Section: Behavior toggles
        const togglesSection = contentEl.createDiv({ cls: 'claude-modal__section' });
        togglesSection.createEl('h3', { text: 'Behavior', cls: 'claude-modal__section-title' });

        new Setting(togglesSection)
            .setName('Enable web search')
            .setDesc('Server-side web_search_20250305 tool. Returns per-claim citations attached to text blocks.')
            .addToggle(t => t
                .setValue(this.webSearch)
                .onChange(v => { this.webSearch = v; }));

        new Setting(togglesSection)
            .setName('Adaptive thinking')
            .setDesc('Lets Claude reason before answering. Higher quality on complex questions; adds latency and tokens.')
            .addToggle(t => t
                .setValue(this.thinking)
                .onChange(v => { this.thinking = v; }));

        new Setting(togglesSection)
            .setName('Stream response')
            .setDesc('Recommended for long answers — avoids HTTP timeouts and writes incrementally to the note.')
            .addToggle(t => t
                .setValue(this.stream)
                .onChange(v => { this.stream = v; }));

        // Footer / actions
        const footer = contentEl.createDiv({ cls: 'claude-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'claude-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        const askBtn = footer.createEl('button', {
            text: 'Ask Claude',
            cls: 'claude-modal__button mod-cta',
        });
        askBtn.addEventListener('click', () => void this.onSubmit());

        // Submit on Cmd/Ctrl+Enter inside the textarea
        queryTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });

        // Focus the question after the DOM has settled
        activeWindow.setTimeout(() => queryTextarea.focus(), 50);
    }

    private modelTagline(value: string): string {
        const found = CLAUDE_MODELS.find(m => m.value === value);
        return found ? found.tagline : '';
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.query.trim();
        if (!trimmed) {
            new Notice('Please enter a question for Claude.');
            return;
        }

        const options: ClaudeOptions = {
            enableWebSearch: this.webSearch,
            enableThinking: this.thinking,
            effort: this.effort,
        };

        this.close();
        await this.claudeService.queryClaude(
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
