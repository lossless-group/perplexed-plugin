import type { Editor} from 'obsidian';
import { Notice } from 'obsidian';
import type { PromptsService } from './promptsService';

export interface PerplexicaSettings {
    perplexicaEndpoint: string;
    localLLMPath: string;
    defaultModel: string;
    promptsService?: PromptsService;
    requestTemplate?: string;
}

export interface PerplexicaOptions {
    return_images?: boolean;
}

interface PerplexicaModelRef {
    provider: string;
    name: string;
}

interface PerplexicaHistoryEntry {
    role: string;
    content: string;
}

interface PerplexicaPayload {
    chatModel: PerplexicaModelRef;
    embeddingModel: PerplexicaModelRef;
    optimizationMode: string;
    focusMode: string;
    query: string;
    history: PerplexicaHistoryEntry[];
    systemInstructions: string;
    stream: boolean;
    maxTokens?: number;
    temperature?: number;
}

interface PerplexicaStreamEvent {
    type?: string;
    data?: string;
}

export class PerplexicaService {
    private settings: PerplexicaSettings;
    private promptsService: PromptsService | undefined;

    constructor(settings: PerplexicaSettings) {
        this.settings = settings;
        this.promptsService = settings.promptsService;
    }

    private processContentWithImages(content: string): string {
        // Find image markers like [IMAGE 1: description] or [IMAGE 1: description]
        const imageRegex = /\[IMAGE\s+(\d+):\s*(.*?)\]/gi;
        let match;
        let imageIndex = 0;
        
        while ((match = imageRegex.exec(content)) !== null) {
            const description = match[2]?.trim() || '';
            
            // Create a placeholder image markdown with description
            const imageMarkdown = `\n\n![${description}](https://via.placeholder.com/600x400/cccccc/666666?text=${encodeURIComponent(description)})\n*${description}*\n`;
            
            // Replace the marker with the placeholder image
            content = content.replace(match[0], imageMarkdown);
            imageIndex++;
        }
        
        if (imageIndex > 0) {
            console.debug(`🔄 Processed ${imageIndex} image markers in Perplexica content`);
        }
        
        return content;
    }

    public async queryPerplexica(
        query: string, 
        focusMode: string, 
        optimizationMode: string, 
        stream: boolean, 
        editor: Editor,
        options?: PerplexicaOptions
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Insert query header
        const cursor = editor.getCursor();
        
        // Process query to handle multi-line content in callout
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');
        
        editor.replaceRange(`\n\n***\n> [!info] **Perplexica / Vane Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Focus:** ${focusMode}\n> **Optimization:** ${optimizationMode}\n> \n> ### **Response from Perplexica / Vane**:\n\n`, cursor);
        
        // Get cursor position after header for response content
        const responseCursor = editor.getCursor();
        
        try {
            // Try primary endpoint first, then fallback
            const endpoints = [this.settings.perplexicaEndpoint, this.settings.localLLMPath];
            let lastError;
            
            for (const endpoint of endpoints) {
                try {
                    let payload: PerplexicaPayload;
                    if (this.settings.requestTemplate) {
                        try {
                            const processedTemplate = this.promptsService?.processTemplate(this.settings.requestTemplate) || this.settings.requestTemplate;

                            const cleanedTemplate = processedTemplate
                                .replace(/\/\*[\s\S]*?\*\//g, '')
                                .replace(/\/\/.*$/gm, '')
                                .replace(/^\s*$/gm, '')
                                .trim();

                            JSON.parse(cleanedTemplate);
                            payload = {
                                chatModel: { provider: "ollama", name: this.settings.defaultModel },
                                embeddingModel: { provider: "ollama", name: this.settings.defaultModel },
                                optimizationMode,
                                focusMode,
                                query,
                                history: [{ role: "user", content: query }],
                                systemInstructions: this.promptsService?.getPerplexicaSystemPrompt() || "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
                                stream,
                            };
                        } catch (error) {
                            console.warn('Failed to parse request template, using default payload:', error);
                            payload = {
                                chatModel: {
                                    provider: "ollama",
                                    name: this.settings.defaultModel
                                },
                                embeddingModel: {
                                    provider: "ollama",
                                    name: this.settings.defaultModel
                                },
                                optimizationMode,
                                focusMode,
                                query,
                                history: [
                                    {
                                        role: "user",
                                        content: query
                                    }
                                ],
                                systemInstructions: this.promptsService?.getPerplexicaSystemPrompt() || "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
                                stream,
                                maxTokens: 2048,
                                temperature: 0.7
                            };
                        }
                    } else {
                        payload = {
                            chatModel: {
                                provider: "ollama",
                                name: this.settings.defaultModel
                            },
                            embeddingModel: {
                                provider: "ollama",
                                name: this.settings.defaultModel
                            },
                            optimizationMode,
                            focusMode,
                            query,
                            history: [
                                {
                                    role: "user",
                                    content: query
                                }
                            ],
                            systemInstructions: this.promptsService?.getPerplexicaSystemPrompt() || "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
                            stream,
                            maxTokens: 2048,
                            temperature: 0.7
                        };
                    }

                    // Streaming uses fetch because Obsidian's requestUrl does not
                    // support SSE / chunked bodies. Marketplace `/skip` justification.
                    // eslint-disable-next-line no-restricted-globals
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    if (stream) {
                        await this.handleStreamingResponse(response, editor, responseCursor, options);
                    } else {
                        await this.handleNonStreamingResponse(response, editor, responseCursor, options);
                    }
                    
                    // Add separator
                    editor.replaceRange('\n\n***\n', editor.getCursor());
                    return; // Success, exit the loop
                    
                } catch (error) {
                    lastError = error;
                    console.warn(`Failed to connect to ${endpoint}:`, error);
                }
            }
            
            // If we get here, all endpoints failed
            throw lastError instanceof Error ? lastError : new Error('All endpoints failed');
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Perplexica / Vane Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
        }
    }

    private async handleStreamingResponse(response: Response, editor: Editor, responseCursor: { line: number; ch: number }, options?: PerplexicaOptions): Promise<void> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        
        let currentPos = responseCursor;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line) as PerplexicaStreamEvent;
                    if (parsed.type === 'response' && typeof parsed.data === 'string') {
                        let content: string = parsed.data;

                        if (options?.return_images) {
                            content = this.processContentWithImages(content);
                        }

                        editor.replaceRange(content, currentPos);
                        const splitLines = content.split('\n');
                        if (splitLines.length === 1) {
                            currentPos = { line: currentPos.line, ch: currentPos.ch + content.length };
                        } else {
                            currentPos = {
                                line: currentPos.line + splitLines.length - 1,
                                ch: splitLines[splitLines.length - 1]?.length || 0
                            };
                        }
                        editor.scrollIntoView({ from: currentPos, to: currentPos }, true);
                        await new Promise(resolve => activeWindow.setTimeout(resolve, 10));
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
        }
    }

    private async handleNonStreamingResponse(response: Response, editor: Editor, responseCursor: { line: number; ch: number }, options?: PerplexicaOptions): Promise<void> {
        const text = await response.text();
        
        // Process images if enabled
        let processedText = text;
        if (options?.return_images) {
            processedText = this.processContentWithImages(text);
        }
        
        editor.replaceRange(processedText, responseCursor);
    }
} 
