import type { App, Editor } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';
import type { LMStudioService, LMStudioOptions } from '../services/lmStudioService';
import type { PromptsService } from '../services/promptsService';

const LMSTUDIO_MODELS: Array<{ value: string; label: string; tagline: string }> = [
    { value: 'ibm/granite-3.2-8b',                label: 'IBM Granite 3.2 8B',          tagline: 'IBM Granite — strong on code and structured reasoning.' },
    { value: 'microsoft/phi-4-reasoning-plus',    label: 'Phi-4 Reasoning Plus',        tagline: 'Microsoft Phi-4 — small, fast model tuned for chain-of-thought reasoning.' },
    { value: 'google/gemma-3-12b',                label: 'Gemma 3 12B',                 tagline: 'Google Gemma 3 — solid all-rounder open model.' },
    { value: 'meta-llama/llama-3.2-3b-instruct',  label: 'Llama 3.2 3B Instruct',       tagline: 'Meta Llama 3.2 — small instruction-tuned model, fastest of the bundled choices.' },
    { value: 'custom-model',                      label: 'custom-model',                tagline: 'Generic placeholder — LM Studio will route this to whichever model is currently loaded.' },
];

const DEFAULT_MODEL = 'ibm/granite-3.2-8b';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.7;

export class LMStudioModal extends Modal {
    private editor: Editor;
    private lmStudioService: LMStudioService;
    private promptsService: PromptsService;

    private query = '';
    private model: string = DEFAULT_MODEL;
    private systemPrompt = '';
    private maxTokens: number = DEFAULT_MAX_TOKENS;
    private temperature: number = DEFAULT_TEMPERATURE;
    private images = false;
    private stream = true;

    private modelDescEl: HTMLElement | null = null;

    constructor(
        app: App,
        editor: Editor,
        lmStudioService: LMStudioService,
        promptsService: PromptsService
    ) {
        super(app);
        this.editor = editor;
        this.lmStudioService = lmStudioService;
        this.promptsService = promptsService;
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass('lmstudio-modal');
        contentEl.empty();

        // ----- Header -----
        const header = contentEl.createDiv({ cls: 'lmstudio-modal__header' });
        header.createEl('h2', { text: 'Ask LM Studio', cls: 'lmstudio-modal__title' });
        header.createEl('p', {
            cls: 'lmstudio-modal__subtitle',
            text: 'Run queries against your local LM Studio server. Streams into the active note at the cursor.',
        });

        // ----- Question -----
        const querySection = contentEl.createDiv({ cls: 'lmstudio-modal__section' });
        querySection.createEl('label', {
            text: 'Question',
            cls: 'lmstudio-modal__label',
            attr: { for: 'lmstudio-modal-query' },
        });
        const queryTextarea = querySection.createEl('textarea', {
            cls: 'lmstudio-modal__textarea',
            attr: {
                id: 'lmstudio-modal-query',
                rows: '6',
                placeholder: this.promptsService.getLMStudioQueryPlaceholder(),
            },
        });
        queryTextarea.value = this.query;
        queryTextarea.addEventListener('input', () => {
            this.query = queryTextarea.value;
        });
        queryTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.onSubmit();
            }
        });

        // ----- Model -----
        const modelSection = contentEl.createDiv({ cls: 'lmstudio-modal__section' });
        modelSection.createEl('h3', { text: 'Model', cls: 'lmstudio-modal__section-title' });

        const modelSetting = new Setting(modelSection)
            .setName('Model')
            .setDesc(this.modelTagline(this.model))
            .addDropdown(dd => {
                LMSTUDIO_MODELS.forEach(({ value, label }) => { dd.addOption(value, label); });
                dd.setValue(this.model);
                dd.onChange((value) => {
                    this.model = value;
                    if (this.modelDescEl) this.modelDescEl.textContent = this.modelTagline(value);
                });
            });
        this.modelDescEl = modelSetting.descEl;

        new Setting(modelSection)
            .setName('Max tokens')
            .setDesc('Upper bound on response length. Local models cap lower than cloud — 2048 is a safe default.')
            .addText(t => t
                .setValue(String(this.maxTokens))
                .onChange(v => {
                    const parsed = parseInt(v, 10);
                    this.maxTokens = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOKENS;
                }));

        new Setting(modelSection)
            .setName('Temperature')
            .setDesc('Higher = more creative / varied. 0.7 is the conventional default. Slide to 0 for deterministic output.')
            .addSlider(s => s
                .setLimits(0, 2, 0.1)
                .setValue(this.temperature)
                .setDynamicTooltip()
                .onChange(v => { this.temperature = v; }));

        // ----- System Prompt (multi-line, doesn't fit a Setting row) -----
        const systemSection = contentEl.createDiv({ cls: 'lmstudio-modal__section' });
        systemSection.createEl('h3', { text: 'System prompt (optional)', cls: 'lmstudio-modal__section-title' });
        systemSection.createEl('p', {
            cls: 'lmstudio-modal__hint',
            text: 'Override the default system prompt for this request. Leave blank to use the plugin default.',
        });
        const systemTextarea = systemSection.createEl('textarea', {
            cls: 'lmstudio-modal__textarea lmstudio-modal__textarea--system',
            attr: {
                rows: '3',
                placeholder: this.promptsService.getLMStudioSystemPromptPlaceholder(),
            },
        });
        systemTextarea.value = this.systemPrompt;
        systemTextarea.addEventListener('input', () => {
            this.systemPrompt = systemTextarea.value;
        });

        // ----- Returns -----
        const returnsSection = contentEl.createDiv({ cls: 'lmstudio-modal__section' });
        returnsSection.createEl('h3', { text: 'Include in response', cls: 'lmstudio-modal__section-title' });

        new Setting(returnsSection)
            .setName('Images')
            .setDesc(this.promptsService.getImagesToggleGenericDescription())
            .addToggle(t => t
                .setValue(this.images)
                .onChange(v => { this.images = v; }));

        // ----- Behavior -----
        const behaviorSection = contentEl.createDiv({ cls: 'lmstudio-modal__section' });
        behaviorSection.createEl('h3', { text: 'Behavior', cls: 'lmstudio-modal__section-title' });

        new Setting(behaviorSection)
            .setName('Stream response')
            .setDesc('Write tokens into the note as they arrive — recommended for long answers and slow local models.')
            .addToggle(t => t
                .setValue(this.stream)
                .onChange(v => { this.stream = v; }));

        // ----- Footer -----
        const footer = contentEl.createDiv({ cls: 'lmstudio-modal__footer' });
        const cancelBtn = footer.createEl('button', {
            text: 'Cancel',
            cls: 'lmstudio-modal__button',
        });
        cancelBtn.addEventListener('click', () => this.close());

        const askBtn = footer.createEl('button', {
            text: 'Ask LM Studio',
            cls: 'lmstudio-modal__button mod-cta',
        });
        askBtn.addEventListener('click', () => void this.onSubmit());

        activeWindow.setTimeout(() => queryTextarea.focus(), 50);
    }

    private modelTagline(value: string): string {
        return LMSTUDIO_MODELS.find(m => m.value === value)?.tagline ?? '';
    }

    private async onSubmit(): Promise<void> {
        const trimmed = this.query.trim();
        if (!trimmed) {
            new Notice(this.promptsService.getEnterQuestionNotice());
            return;
        }

        let processedQuery = trimmed;
        if (this.images) {
            processedQuery = `${trimmed}\n\n${this.promptsService.getImageReferencesPrompt()}`;
        }

        const options: LMStudioOptions = {
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            return_images: this.images,
        };
        const trimmedSystemPrompt = this.systemPrompt.trim();
        if (trimmedSystemPrompt) {
            options.system_prompt = trimmedSystemPrompt;
        }

        this.close();
        await this.lmStudioService.queryLMStudio(
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
