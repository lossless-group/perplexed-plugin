import { Modal, Setting, type App } from 'obsidian';
import type { ParsedTemplate } from '../services/directoryTemplateService';

export interface TemplateRunChoice {
    template: ParsedTemplate;
    title: string;
}

// Perplexity models offered in the run modal, in recommendation order.
const MODEL_CHOICES: { id: string; label: string }[] = [
    { id: 'sonar-pro', label: 'Sonar Pro — grounded search + citations, fast' },
    { id: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro — adds chain-of-thought' },
    { id: 'sonar', label: 'Sonar — lightweight, fastest' },
    { id: 'sonar-reasoning', label: 'Sonar Reasoning — lightweight + reasoning' },
    { id: 'sonar-deep-research', label: 'Sonar Deep Research — exhaustive, minutes-long' },
];

function cftModel(choice: TemplateRunChoice): string {
    const m = choice.template.cftConfig['model'];
    return typeof m === 'string' && m.length > 0 ? m : 'sonar-pro';
}

/**
 * Run dialog for "Apply directory template to current file": pick which
 * template to apply (when more than one matches) and which Perplexity model
 * to run it with. The model defaults to the template's cft `model:` but the
 * selection here overrides it for this run only.
 */
export class DirectoryTemplateRunModal extends Modal {
    private readonly choices: TemplateRunChoice[];
    private readonly onRun: (template: ParsedTemplate, model: string) => void;
    private selectedIndex = 0;
    private selectedModel: string;

    constructor(
        app: App,
        choices: TemplateRunChoice[],
        onRun: (template: ParsedTemplate, model: string) => void,
    ) {
        super(app);
        if (choices.length === 0) {
            throw new Error('DirectoryTemplateRunModal requires at least one template choice');
        }
        this.choices = choices;
        this.onRun = onRun;
        this.selectedModel = cftModel(this.selected());
    }

    /** The currently selected choice. choices is non-empty (checked in ctor). */
    private selected(): TemplateRunChoice {
        const c = this.choices[this.selectedIndex];
        if (c) return c;
        const first = this.choices[0];
        if (first) return first;
        throw new Error('DirectoryTemplateRunModal: choices unexpectedly empty');
    }

    onOpen(): void {
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Apply directory template' });

        if (this.choices.length > 1) {
            new Setting(contentEl)
                .setName('Template')
                .setDesc('Which template to apply to this file.')
                .addDropdown((dd) => {
                    this.choices.forEach((c, i) => {
                        dd.addOption(String(i), c.title);
                    });
                    dd.setValue(String(this.selectedIndex));
                    dd.onChange((v) => {
                        this.selectedIndex = Number(v);
                        // Reset the model to the newly chosen template's default.
                        this.selectedModel = cftModel(this.selected());
                        this.render();
                    });
                });
        } else {
            new Setting(contentEl)
                .setName('Template')
                .setDesc(this.selected().title);
        }

        const cftDefault = cftModel(this.selected());
        new Setting(contentEl)
            .setName('Model')
            .setDesc(`Perplexity model for this run. Template default: ${cftDefault}.`)
            .addDropdown((dd) => {
                for (const m of MODEL_CHOICES) dd.addOption(m.id, m.label);
                // Keep an unlisted cft model selectable if the template names one.
                if (!MODEL_CHOICES.some((m) => m.id === this.selectedModel)) {
                    dd.addOption(this.selectedModel, this.selectedModel);
                }
                dd.setValue(this.selectedModel);
                dd.onChange((v) => {
                    this.selectedModel = v;
                });
            });

        new Setting(contentEl)
            .addButton((b) => b
                .setButtonText('Run')
                .setCta()
                .onClick(() => {
                    const chosen = this.selected();
                    const model = this.selectedModel;
                    this.close();
                    this.onRun(chosen.template, model);
                }))
            .addButton((b) => b
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }));
    }
}
