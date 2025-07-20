import { Editor, Notice } from 'obsidian';

export interface PerplexicaSettings {
    perplexicaEndpoint: string;
    localLLMPath: string;
    defaultModel: string;
}

export class PerplexicaService {
    private settings: PerplexicaSettings;

    constructor(settings: PerplexicaSettings) {
        this.settings = settings;
    }

    public async queryPerplexica(
        query: string, 
        focusMode: string, 
        optimizationMode: string, 
        stream: boolean, 
        editor: Editor
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
                    const payload = {
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
                        systemInstructions: "You are a helpful AI assistant. Provide clear, concise, and accurate information.",
                        stream,
                        maxTokens: 2048,
                        temperature: 0.7
                    };

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
                        await this.handleStreamingResponse(response, editor, responseCursor);
                    } else {
                        await this.handleNonStreamingResponse(response, editor, responseCursor);
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

    private async handleStreamingResponse(response: Response, editor: Editor, responseCursor: { line: number; ch: number }): Promise<void> {
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
                        editor.replaceRange(parsed.data, currentPos);
                        // Update cursor position
                        const lines = parsed.data.split('\n');
                        if (lines.length === 1) {
                            currentPos = { line: currentPos.line, ch: currentPos.ch + parsed.data.length };
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

    private async handleNonStreamingResponse(response: Response, editor: Editor, responseCursor: { line: number; ch: number }): Promise<void> {
        const text = await response.text();
        editor.replaceRange(text, responseCursor);
    }
} 