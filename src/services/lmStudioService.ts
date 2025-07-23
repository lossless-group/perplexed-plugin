import { Editor } from 'obsidian';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LMStudioOptions {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    system_prompt?: string;
}

export interface LMStudioSettings {
    lmStudioEndpoint: string;
}

export class LMStudioService {
    private readonly baseUrl: string;

    constructor(settings: LMStudioSettings) {
        this.baseUrl = settings.lmStudioEndpoint || 'http://localhost:1234';
    }

    private async queryModel(model: string, messages: ChatMessage[], options: LMStudioOptions = {}): Promise<Response> {
        // Prepare the payload using the provided parameters
        const payload = {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? -1,
            stream: false
        };

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${errorText}`);
            }

            return response;
        } catch (error) {
            console.error('Error querying LM Studio:', error);
            throw new Error(`Failed to query LM Studio: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async queryLMStudio(
        query: string,
        model: string,
        stream: boolean = false,
        editor: Editor,
        options: LMStudioOptions = {}
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        const cursor = editor.getCursor();
        
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
        
        try {
            const messages: ChatMessage[] = [];
            
            // Add system message if provided
            if (options.system_prompt) {
                messages.push({ role: 'system', content: options.system_prompt });
            }
            
            // Add user query
            messages.push({ role: 'user', content: query });
            
            const response = await this.queryModel(model, messages, options);
            
            if (stream) {
                await this.handleStreamingResponse(response, editor, responseCursor);
            } else {
                await this.handleNonStreamingResponse(response, editor, responseCursor);
            }
            
            // Add separator at the final cursor position
            const finalCursor = editor.getCursor();
            editor.replaceRange('\n\n***\n', finalCursor);
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorText = `\n\n> [!error] **Error**\n> ${errorMsg.replace(/\n/g, '\n> ')}`;
            
            // Insert the error message at the cursor position
            editor.replaceRange(errorText, responseCursor, responseCursor);
            
            console.error('Error querying LM Studio:', error);
        }
    }

    private async handleStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number }
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
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.delta?.content) {
                            const content = parsed.choices[0].delta.content;
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
                    }
                }
            }
        }
    }

    private async handleNonStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number }
    ): Promise<void> {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response received';
        
        editor.replaceRange(content, responseCursor);
    }
} 