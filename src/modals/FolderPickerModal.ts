import type { App } from 'obsidian';
import { FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
    private callback: (chosen: TFolder) => void;

    constructor(app: App, callback: (chosen: TFolder) => void) {
        super(app);
        this.callback = callback;
        this.setPlaceholder('Pick a folder…');
    }

    getItems(): TFolder[] {
        const folders: TFolder[] = [];
        const walk = (folder: TFolder) => {
            folders.push(folder);
            for (const child of folder.children) {
                if (child instanceof TFolder) walk(child);
            }
        };
        walk(this.app.vault.getRoot());
        return folders;
    }

    getItemText(folder: TFolder): string {
        return folder.path === '' ? '/' : folder.path;
    }

    onChooseItem(folder: TFolder): void {
        this.callback(folder);
    }
}
