import type { App} from 'obsidian';
import { Modal, Notice } from 'obsidian';

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
        const {contentEl, modalEl} = this;
        modalEl.addClass('url-update-modal');
        contentEl.empty();

        // Header
        const header = contentEl.createDiv({cls: 'url-update-modal__header'});
        header.createEl('h2', {text: this.config.title, cls: 'url-update-modal__title'});

        const form = contentEl.createEl('form');
        
        // Body section
        const section = form.createDiv({cls: 'url-update-modal__section'});
        
        section.createEl('label', {
            text: this.config.label,
            cls: 'url-update-modal__label',
            attr: {for: 'url-input'}
        });

        this.urlInput = section.createEl('input', {
            type: 'text',
            value: this.config.currentValue,
            cls: 'url-update-modal__input',
            attr: {id: 'url-input', placeholder: this.config.placeholder}
        });

        // Footer
        const footer = contentEl.createDiv({cls: 'url-update-modal__footer'});
        const cancelBtn = footer.createEl('button', {
            type: 'button',
            text: 'Cancel',
            cls: 'url-update-modal__button'
        });
        const saveButton = footer.createEl('button', {
            type: 'submit',
            text: 'Save',
            cls: 'url-update-modal__button mod-cta'
        });

        cancelBtn.onclick = () => this.close();

        form.onsubmit = (e) => {
            e.preventDefault();
            void this.onSubmit();
        };

        saveButton.onclick = (e) => {
            e.preventDefault();
            void this.onSubmit();
        };
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