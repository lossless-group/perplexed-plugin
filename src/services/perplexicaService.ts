import { Editor, Notice } from 'obsidian';

export interface PerplexicaSettings {
    perplexicaEndpoint: string;
    localLLMPath: string;
    defaultModel: string;
    promptsService?: any; // Will be PromptsService type
    requestTemplate?: string;
}

export interface PerplexicaOptions {
    return_images?: boolean;
}

export class PerplexicaService {
    private settings: PerplexicaSettings;
    private promptsService: any;

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
            console.log(`🔄 Processed ${imageIndex} image markers in Perplexica content`);
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
        
        editor.replaceRange(`\n\n***\n> [!info] **Perplexica Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Focus:** ${focusMode}\n> **Optimization:** ${optimizationMode}\n> \n> ### **Response from Perplexica**:\n\n`, cursor);
        
        // Get cursor position after header for response content
        const responseCursor = editor.getCursor();
        
        try {
            // Try primary endpoint first, then fallback
            const endpoints = [this.settings.perplexicaEndpoint, this.settings.localLLMPath];
            let lastError;
            
            for (const endpoint of endpoints) {
                try {
                    // Use template if available, otherwise construct payload manually
                    let payload: any;
                    if (this.settings.requestTemplate) {
                        try {
                            const processedTemplate = this.promptsService?.processTemplate(this.settings.requestTemplate) || this.settings.requestTemplate;
                            
                            // Strip JavaScript-style comments that would break JSON parsing
                            const cleanedTemplate = processedTemplate
                                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
                                .replace(/\/\/.*$/gm, '') // Remove // comments
                                .replace(/^\s*$/gm, '') // Remove empty lines
                                .trim();
                            
                            payload = JSON.parse(cleanedTemplate);
                            // Override with current parameters
                            payload.chatModel = {
                                provider: "ollama",
                                name: this.settings.defaultModel
                            };
                            payload.embeddingModel = {
                                provider: "ollama",
                                name: this.settings.defaultModel
                            };
                            payload.optimizationMode = optimizationMode;
                            payload.focusMode = focusMode;
                            payload.query = query;
                            payload.history = [
                                {
                                    role: "user",
                                    content: query
                                }
                            ];
                            payload.systemInstructions = this.promptsService?.getPerplexicaSystemPrompt() || "You are a helpful AI assistant. Provide clear, concise, and accurate information.";
                            payload.stream = stream;
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
            throw lastError || new Error('All endpoints failed');
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Perplexica Error: ${errorMsg}`);
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
                    const parsed = JSON.parse(line);
                                            if (parsed.type === 'response' && parsed.data) {
                            let content = parsed.data;
                            
                            // Process images if enabled
                            if (options?.return_images) {
                                content = this.processContentWithImages(content);
                            }
                            
                            editor.replaceRange(content, currentPos);
                            // Update cursor position
                            const lines = content.split('\n');
                            if (lines.length === 1) {
                                currentPos = { line: currentPos.line, ch: currentPos.ch + content.length };
                            } else {
                                currentPos = { 
                                    line: currentPos.line + lines.length - 1, 
                                    ch: lines[lines.length - 1]?.length || 0
                                };
                            }
                            // Scroll to follow the new content
                            editor.scrollIntoView({ from: currentPos, to: currentPos }, true);
                            // Small delay to make scrolling smoother
                            await new Promise(resolve => setTimeout(resolve, 10));
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
