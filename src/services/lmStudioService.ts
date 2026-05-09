import type { Editor} from 'obsidian';
import { Notice } from 'obsidian';
import type { PromptsService } from './promptsService';

export interface LMStudioOptions {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    system_prompt?: string;
    return_images?: boolean;
}

export interface LMStudioSettings {
    lmStudioEndpoint: string;
    promptsService?: PromptsService;
    requestTemplate?: string;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface LMStudioPayload {
    model: string;
    messages: ChatMessage[];
    stream: boolean;
    max_tokens: number;
    temperature: number;
    top_p: number;
}

interface LMStudioStreamChunk {
    choices?: Array<{ delta?: { content?: string } }>;
}

interface LMStudioResponse {
    choices?: Array<{ message?: { content?: string } }>;
}

export class LMStudioService {
    private settings: LMStudioSettings;
    private promptsService: PromptsService | undefined;

    constructor(settings: LMStudioSettings) {
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
            console.debug(`🔄 Processed ${imageIndex} image markers in LM Studio content`);
        }
        
        return content;
    }

    public async queryLMStudio(
        query: string, 
        model: string, 
        stream: boolean, 
        editor: Editor, 
        options?: LMStudioOptions
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Insert query header at the current cursor position
        const cursor = editor.getCursor();
        console.debug('Initial cursor position:', cursor);
        
        // Process query to handle multi-line content in callout
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');
        
        const headerText = `\n\n***\n> [!info] **LM Studio Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> ### **Response from ${model}**:\n\n`;
        
        // Insert the header at the cursor position
        editor.replaceRange(headerText, cursor, cursor);
        
        // Calculate where the response content should start
        const headerLines = headerText.split('\n');
        const lastLine = headerLines[headerLines.length - 1] || '';
        const responseCursor = {
            line: cursor.line + headerLines.length - 1,
            ch: lastLine.length
        };
        
        console.debug('Response cursor position:', responseCursor);
        
        try {
            const messages: ChatMessage[] = [];

            if (options?.system_prompt) {
                messages.push({ role: 'system', content: options.system_prompt });
            }

            messages.push({ role: 'user', content: query });

            let payload: LMStudioPayload;
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
                        model,
                        messages,
                        stream,
                        max_tokens: options?.max_tokens ?? 2048,
                        temperature: options?.temperature ?? 0.7,
                        top_p: options?.top_p ?? 0.9,
                    };
                } catch (error) {
                    console.warn('Failed to parse request template, using default payload:', error);
                    payload = {
                        model,
                        messages,
                        stream,
                        max_tokens: options?.max_tokens ?? 2048,
                        temperature: options?.temperature ?? 0.7,
                        top_p: options?.top_p ?? 0.9,
                    };
                }
            } else {
                payload = {
                    model,
                    messages,
                    stream,
                    max_tokens: options?.max_tokens ?? 2048,
                    temperature: options?.temperature ?? 0.7,
                    top_p: options?.top_p ?? 0.9,
                };
            }
            
            // Streaming uses fetch because Obsidian's requestUrl does not
            // support SSE / chunked bodies. Marketplace `/skip` justification.
            // eslint-disable-next-line no-restricted-globals
            const response = await fetch(this.settings.lmStudioEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // LM Studio doesn't require API key for local access
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const finalCursor = responseCursor;
            
            if (stream) {
                await this.handleStreamingResponse(response, editor, responseCursor, options);
            } else {
                await this.handleNonStreamingResponse(response, editor, responseCursor, options);
            }
            
            // Add separator at the final cursor position
            editor.replaceRange('\n\n***\n', finalCursor);
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`LM Studio Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
        }
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
        let currentPos = responseCursor;
        
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
                        const parsed = JSON.parse(data) as LMStudioStreamChunk;
                        if (parsed.choices?.[0]?.delta?.content) {
                            let content: string = parsed.choices[0].delta.content;
                            
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
                            await new Promise(resolve => activeWindow.setTimeout(resolve, 10));
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        }
    }

    private async handleNonStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number },
        options?: LMStudioOptions
    ): Promise<void> {
        const data = (await response.json()) as LMStudioResponse;
        const content: string = data.choices?.[0]?.message?.content || 'No response received';
        
        // Process images if enabled
        let processedContent = content;
        if (options?.return_images) {
            processedContent = this.processContentWithImages(content);
        }
        
        editor.replaceRange(processedContent, responseCursor);
    }
} 
