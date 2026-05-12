import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

export interface BatchConfirmInfo {
    folderPath: string;
    templateTitle: string;
    fileCount: number;
    fillCount: number;
    appendCount: number;
}

export class BatchConfirmModal extends Modal {
    private info: BatchConfirmInfo;
    private onConfirm: () => void;

    constructor(app: App, info: BatchConfirmInfo, onConfirm: () => void) {
        super(app);
        this.info = info;
        this.onConfirm = onConfirm;
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

        contentEl.createEl('p', {
            text: 'Each file will hit perplexity deep research once. Cancel any time via "stop directory template batch" command.',
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
                    this.close();
                    this.onConfirm();
                }));
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
