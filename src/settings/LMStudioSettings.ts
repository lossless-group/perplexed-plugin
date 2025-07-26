import { App, Notice, Setting } from 'obsidian';

export interface LMStudioEndpointConfig {
    baseUrl: string;
    chatCompletions: string;
    completions: string;
    embeddings: string;
    models: string;
}

export interface LMStudioSettings {
    endpoints: LMStudioEndpointConfig;
    defaultModel: string;
    requestTemplate?: string;
}

export const DEFAULT_LMSTUDIO_SETTINGS: LMStudioSettings = {
    endpoints: {
        baseUrl: 'http://localhost:1234',
        chatCompletions: '/v1/chat/completions',
        completions: '/v1/completions',
        embeddings: '/v1/embeddings',
        models: '/v1/models'
    },
    defaultModel: 'ibm/granite-3.2-8b',
    requestTemplate: ''
};

export class LMStudioSettingSection {
    constructor(
        private readonly app: App, 
        private readonly containerEl: HTMLElement, 
        private settings: LMStudioSettings, 
        private readonly onSettingsChange: () => Promise<void>
    ) {}

    public display(): void {
        this.containerEl.createEl('h3', { text: 'LM Studio Settings' });
        
        this.addBaseUrlSetting();
        this.addDefaultModelSetting();
        this.addEndpointsInfo();
        this.addTestConnectionButton();
    }

    private addBaseUrlSetting(): void {
        new Setting(this.containerEl)
            .setName('Base URL')
            .setDesc('The base URL of your LM Studio server (e.g., http://localhost:1234)')
            .addText(text => text
                .setValue(this.settings.endpoints.baseUrl)
                .onChange(async (value: string) => {
                    this.settings.endpoints.baseUrl = value.trim();
                    await this.onSettingsChange();
                }));
    }

    private addDefaultModelSetting(): void {
        new Setting(this.containerEl)
            .setName('Default Model')
            .setDesc('The default model to use for completions')
            .addText(text => text
                .setValue(this.settings.defaultModel)
                .onChange(async (value: string) => {
                    this.settings.defaultModel = value;
                    await this.onSettingsChange();
                }));
    }

    private addEndpointsInfo(): void {
        const endpointsContainer = this.containerEl.createDiv('setting-item');
        endpointsContainer.createDiv({ text: 'API Endpoints', cls: 'setting-item-name' });
        const endpointsDesc = endpointsContainer.createDiv('setting-item-description');
        
        const { endpoints } = this.settings;
        const endpointList = [
            `Chat Completions: ${endpoints.chatCompletions}`,
            `Completions: ${endpoints.completions}`,
            `Embeddings: ${endpoints.embeddings}`,
            `Models: ${endpoints.models}`
        ];
        
        endpointList.forEach(endpoint => {
            endpointsDesc.createEl('div', { text: endpoint });
        });
    }

    private addTestConnectionButton(): void {
        new Setting(this.containerEl)
            .setName('Test Connection')
            .setDesc('Test the connection to your LM Studio server')
            .addButton(button => button
                .setButtonText('Test')
                .onClick(async () => {
                    try {
                        const url = `${this.settings.endpoints.baseUrl}${this.settings.endpoints.models}`;
                        const response = await fetch(url, { method: 'HEAD' });
                        
                        if (response.ok) {
                            new Notice('✅ Successfully connected to LM Studio server');
                        } else {
                            new Notice(`❌ Failed to connect: ${response.status} ${response.statusText}`);
                        }
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        new Notice(`❌ Connection error: ${message}`);
                    }
                }));
    }
}

export default LMStudioSettingSection;

