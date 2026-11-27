import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';
import { PERPLEXITY_MODEL_CHOICES } from './perplexityModelChoices';

export interface BatchConfirmInfo {
    folderPath: string;
    templateTitle: string;
    fileCount: number;
    fillCount: number;
    appendCount: number;
    /** The template's cft `model:`; preselected in the model dropdown. */
    defaultModel: string;
}

export class BatchConfirmModal extends Modal {
    private info: BatchConfirmInfo;
    private onConfirm: (model: string) => void;
    private selectedModel: string;

    constructor(app: App, info: BatchConfirmInfo, onConfirm: (model: string) => void) {
        super(app);
        this.info = info;
        this.onConfirm = onConfirm;
        this.selectedModel = info.defaultModel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Confirm batch run' });

        const ul = contentEl.createEl('ul');
        ul.createEl('li', { text: `Template: ${this.info.templateTitle}` });
        ul.createEl('li', { text: `Folder: ${this.info.folderPath || '/'}` });
        ul.createEl('li', { text: `Total matching files: ${this.info.fileCount}` });
        ul.createEl('li', { text: `Empty bodies (fill): ${this.info.fillCount}` });
        ul.createEl('li', { text: `Existing bodies (append below): ${this.info.appendCount}` });

        new Setting(contentEl)
            .setName('Model')
            .setDesc(`Perplexity model for every file in this batch. Template default: ${this.info.defaultModel}.`)
            .addDropdown((dd) => {
                for (const m of PERPLEXITY_MODEL_CHOICES) dd.addOption(m.id, m.label);
                // Keep an unlisted cft model selectable if the template names one.
                if (!PERPLEXITY_MODEL_CHOICES.some((m) => m.id === this.selectedModel)) {
                    dd.addOption(this.selectedModel, this.selectedModel);
                }
                dd.setValue(this.selectedModel);
                dd.onChange((v) => { this.selectedModel = v; });
            });

        contentEl.createEl('p', {
            text: 'Each file makes one Perplexity call with the model above. Cancel any time via "stop directory template batch" command.',
            cls: 'setting-item-description',
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText(`Run on ${this.info.fileCount} files`)
                .setCta()
                .onClick(() => {
                    const model = this.selectedModel;
                    this.close();
                    this.onConfirm(model);
                }));
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
