import { Editor, Notice } from 'obsidian';
import { LMStudioSettings } from '../settings/LMStudioSettings';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LMStudioResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LMStudioOptions {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    system_prompt?: string;
    return_images?: boolean;
}

export interface LMStudioEndpointConfig {
    baseUrl: string;
    chatCompletions: string;
    completions: string;
    embeddings: string;
    models: string;
}

// LMStudioSettings is now imported from LMStudioSettings.ts

export class LMStudioService {

    private readonly settings: LMStudioSettings;
    private promptsService: any;

    constructor(settings: LMStudioSettings) {
        this.settings = settings;
        this.initializePromptsService();
    }

    private initializePromptsService() {
        // Initialize prompts service if needed
        // This can be implemented based on your specific requirements
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
            console.log(` Processed ${imageIndex} image markers in LM Studio content`);
        }
        
        return content;
    }

    private async handleStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number },
        options?: LMStudioOptions
    ): Promise<void> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        
        let buffer = '';
        let currentPos = { ...responseCursor };
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value);
                buffer += chunk;
                
                // Process complete lines from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        const data = line.replace('data: ', '').trim();
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices?.[0]?.delta?.content) {
                                let content = parsed.choices[0].delta.content;
                                
                                // Process images if enabled
                                if (options?.return_images) {
                                    content = this.processContentWithImages(content);
                                }
                                
                                editor.replaceRange(content, currentPos);
                                // Update cursor position after insertion
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
                            // Ignore JSON parse errors for partial chunks
                            console.error('Error parsing streaming chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private async handleNonStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number },
        options?: LMStudioOptions
    ): Promise<void> {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response received';
        
        // Process images if enabled
        let processedContent = content;
        if (options?.return_images) {
            processedContent = this.processContentWithImages(content);
        }
        
        editor.replaceRange(processedContent, responseCursor);
    }

    private async makeRequest(
        endpoint: string, 
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
        data?: unknown
    ): Promise<Response> {
        const url = `${this.settings.endpoints.baseUrl}${endpoint}`;
        
        const headers: HeadersInit = new Headers({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        });

        const options: RequestInit = {
            method,
            headers,
        };

        if (data !== undefined) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Request failed: ${errorMessage}`);
            throw error;
        }
    }

    async listModels(): Promise<{data: Array<{id: string}>, error?: string}> {
        try {
            const response = await this.makeRequest(this.settings.endpoints.models, 'GET');
            return await response.json();
        } catch (error) {
            console.error('Error listing models:', error);
            throw error;
        }
    }

    public async queryLMStudio(
        editor: Editor, 
        model?: string, 
        messages: ChatMessage[] = [],
        stream = true,
        options: LMStudioOptions = {}
    ): Promise<void> {
        if (!editor) {
            throw new Error('Editor instance is required');
        }

        const cursor = editor.getCursor();
        const timestamp = new Date().toLocaleString();
        const modelToUse = model || this.settings.defaultModel || 'unknown-model';

        // Process query for display
        const processedQuery = messages.length > 0 
            ? messages.map(message => `> ${message.content}`).join('\n') 
            : '';
            
        const headerText = `\n\n***\n> [!info] **LM Studio Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${modelToUse}\n> \n> ### **Response from ${modelToUse}**:\n\n`;
        
        // Insert header and get response position
        editor.replaceRange(headerText, cursor);
        const headerLines = headerText.split('\n');
        const lastLine = headerLines[headerLines.length - 1] || '';
        const responseCursor = {
            line: cursor.line + headerLines.length - 1,
            ch: lastLine.length
        };
        
        try {
            // Prepare messages array with system prompt if provided
            const messagesToSend = [...messages];
            
            if (options.system_prompt) {
                messagesToSend.unshift({
                    role: 'system',
                    content: options.system_prompt
                });
            }
            
            // Build the request payload
            let payload: Record<string, unknown> = {
                model: modelToUse,
                messages: messagesToSend,
                stream,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 2048,
                top_p: options.top_p ?? 0.9
            };
            
            // Apply request template if available
            if (this.settings.requestTemplate) {
                try {
                    const processedTemplate = this.promptsService?.processTemplate?.(this.settings.requestTemplate) || 
                                            this.settings.requestTemplate;
                    const templatePayload = JSON.parse(processedTemplate);
                    // Merge with template, allowing template to be overridden
                    Object.assign(payload, templatePayload);
                } catch (error) {
                    console.warn('Failed to parse request template, using default payload:', error);
                }
            }
            
            // Make the API request
            const response = await this.makeRequest(
                this.settings.endpoints.chatCompletions,
                'POST',
                payload
            );
            
            // Handle the response based on streaming preference
            if (stream) {
                await this.handleStreamingResponse(response, editor, responseCursor, options);
            } else {
                await this.handleNonStreamingResponse(response, editor, responseCursor, options);
            }
            
            // Add a separator after the response
            editor.replaceRange('\n\n---\n\n', editor.getCursor());
        } catch (error) {
            console.error('Error querying LM Studio:', error);
            // Show error to the user
            const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
            editor.replaceRange(`\n\n${errorMessage}\n\n`, editor.getCursor());
        }
    }


} 