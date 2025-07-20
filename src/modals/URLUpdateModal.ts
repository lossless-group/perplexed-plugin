import { App, Modal, Notice } from 'obsidian';

export interface URLUpdateModalConfig {
    title: string;
    label: string;
    placeholder: string;
    currentValue: string;
    onSave: (newUrl: string) => Promise<void>;
}

export class URLUpdateModal extends Modal {
    private config: URLUpdateModalConfig;
    private urlInput!: HTMLInputElement;

    constructor(app: App, config: URLUpdateModalConfig) {
        super(app);
        this.config = config;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.addClass('url-update-modal');
        contentEl.createEl('h2', {text: this.config.title});
        const form = contentEl.createEl('form');
        const div = form.createDiv({cls: 'setting-item'});

        div.createEl('label', {
            text: this.config.label,
            attr: {for: 'url-input'}
        });

        this.urlInput = div.createEl('input', {
            type: 'text',
            value: this.config.currentValue,
            cls: 'text-input',
            attr: {id: 'url-input', placeholder: this.config.placeholder}
        });

        const buttonDiv = contentEl.createDiv({cls: 'setting-item'});
        const saveButton = buttonDiv.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            this.onSubmit();
        };

        saveButton.onclick = () => this.onSubmit();
    }

    async onSubmit() {
        const newUrl = this.urlInput.value.trim();
        if (newUrl) {
            try {
                await this.config.onSave(newUrl);
                new Notice(`URL updated to: ${newUrl}`);
                this.close();
            } catch (error) {
                new Notice(`Failed to save URL: ${error}`);
            }
        }
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
} 