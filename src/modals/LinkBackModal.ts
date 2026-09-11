import { Modal, Setting, type App } from 'obsidian';
import type { LinkCandidate } from '../services/linkBackService';
import { buildWikilink } from '../services/linkBackService';

/**
 * Review table for proposed wikilinks. Nothing is written until the human
 * clicks through — short, common words ("Hex", "Layer", "Element", "Go") are
 * real vault notes AND ordinary English, so bulk auto-linking would quietly
 * corrupt prose.
 */
export class LinkBackModal extends Modal {
    private readonly candidates: LinkCandidate[];
    private readonly accepted: Set<number>;
    private readonly onApply: (accepted: LinkCandidate[]) => void;

    constructor(
        app: App,
        candidates: LinkCandidate[],
        onApply: (accepted: LinkCandidate[]) => void,
    ) {
        super(app);
        this.candidates = candidates;
        this.onApply = onApply;
        // High-confidence matches start checked; low-confidence start unchecked
        // so accepting everything blindly still can't do damage.
        this.accepted = new Set(
            candidates
                .map((c, i) => (c.confidence === 'high' ? i : -1))
                .filter((i) => i >= 0),
        );
    }

    onOpen(): void { this.render(); }
    onClose(): void { this.contentEl.empty(); }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('perplexed-linkback-modal');

        const high = this.candidates.filter(c => c.confidence === 'high').length;
        contentEl.createEl('h3', { text: 'Link back to vault notes' });
        contentEl.createEl('p', {
            text: `${this.candidates.length.toString()} unlinked mention(s) found — ${high.toString()} high confidence, pre-checked. Low-confidence matches are short or differ in case; review before accepting.`,
            cls: 'setting-item-description',
        });

        const scroll = contentEl.createDiv({ cls: 'perplexed-linkback-scroll' });
        const table = scroll.createEl('table', { cls: 'perplexed-linkback-table' });
        const head = table.createEl('thead').createEl('tr');
        for (const h of ['', 'Match', 'Links to', 'Context']) head.createEl('th', { text: h });

        const tbody = table.createEl('tbody');
        this.candidates.forEach((c, i) => {
            const row = tbody.createEl('tr');
            if (c.confidence === 'low') row.addClass('is-low-confidence');

            const cbCell = row.createEl('td');
            const cb = cbCell.createEl('input', { type: 'checkbox' });
            cb.checked = this.accepted.has(i);
            cb.addEventListener('change', () => {
                if (cb.checked) this.accepted.add(i);
                else this.accepted.delete(i);
                this.updateCount();
            });

            row.createEl('td').createEl('code', { text: c.matchedText });

            const target = row.createEl('td');
            target.createDiv({ text: c.file.basename });
            target.createDiv({
                text: c.file.path.replace(/\.md$/, ''),
                cls: 'perplexed-linkback-path',
            });
            if (c.via === 'alias') {
                target.createDiv({ text: 'Matched via alias', cls: 'perplexed-linkback-path' });
            }

            row.createEl('td', { text: c.context, cls: 'perplexed-linkback-context' });
        });

        const actions = new Setting(contentEl);
        actions.addButton(b => b.setButtonText('Select all').onClick(() => {
            this.candidates.forEach((_, i) => this.accepted.add(i));
            this.render();
        }));
        actions.addButton(b => b.setButtonText('Select none').onClick(() => {
            this.accepted.clear();
            this.render();
        }));
        actions.addButton(b => b
            .setButtonText(this.applyLabel())
            .setCta()
            .onClick(() => {
                const chosen = this.candidates.filter((_, i) => this.accepted.has(i));
                this.close();
                this.onApply(chosen);
            }));
        actions.addButton(b => b.setButtonText('Cancel').onClick(() => { this.close(); }));
        this.applyButtonEl = actions.controlEl.querySelector('button.mod-cta');

        // Show the exact output shape once, so the absolute-path form is visible
        // before anything is written.
        const first = this.candidates[0];
        if (first) {
            contentEl.createEl('p', {
                text: `Inserted as: ${buildWikilink(first.file, first.matchedText)}`,
                cls: 'setting-item-description',
            });
        }
    }

    private applyButtonEl: HTMLButtonElement | null = null;

    private applyLabel(): string {
        return `Apply ${this.accepted.size.toString()} link(s)`;
    }

    private updateCount(): void {
        if (this.applyButtonEl) this.applyButtonEl.textContent = this.applyLabel();
    }
}
