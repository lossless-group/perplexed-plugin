import type { App } from 'obsidian';
import { FuzzySuggestModal } from 'obsidian';
import type { TemplateFile } from '../services/directoryTemplateService';

export class DirectoryTemplatePickerModal extends FuzzySuggestModal<TemplateFile> {
    private items: TemplateFile[];
    private callback: (chosen: TemplateFile) => void;

    constructor(
        app: App,
        items: TemplateFile[],
        callback: (chosen: TemplateFile) => void,
    ) {
        super(app);
        this.items = items;
        this.callback = callback;
        this.setPlaceholder('Pick a directory template…');
    }

    getItems(): TemplateFile[] {
        return this.items;
    }

    getItemText(item: TemplateFile): string {
        const desc = item.description ? ` — ${item.description}` : '';
        return `${item.title}${desc}`;
    }

    onChooseItem(item: TemplateFile): void {
        this.callback(item);
    }
}
