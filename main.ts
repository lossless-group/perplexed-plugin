import { Notice } from 'obsidian';
import { PerplexedPluginCore } from './src/core/PerplexedPluginCore';
import { PerplexedSettingTab } from './src/settings/PerplexedSettingTab';

export default class PerplexedPlugin extends PerplexedPluginCore {
    private statusBarItemEl?: HTMLElement;
    private ribbonIconEl?: HTMLElement;

    async onload(): Promise<void> {
        await super.onload();
        this.registerCommands();
        this.setupUI();
    }
    
    protected registerCommands(): void {
        this.addCommand({
            id: 'show-perplexed-settings',
            name: 'Show Settings',
            callback: () => {
                new PerplexedSettingTab(this.app, this).display();
            }
        });
    }
    
    protected setupUI(): void {
        if (this.settings.showStatusBar) {
            this.statusBarItemEl = this.addStatusBarItem();
            this.statusBarItemEl.setText('Perplexed');
        }
        
        this.ribbonIconEl = this.addRibbonIcon(
            'zap',
            'Perplexed',
            () => new Notice('Perplexed plugin is ready')
        );
    }
    
    onunload() {
        this.statusBarItemEl?.remove();
        this.ribbonIconEl?.remove();
        console.log('Perplexed plugin unloaded');
    }
}