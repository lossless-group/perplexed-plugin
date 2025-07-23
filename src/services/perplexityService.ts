import { Editor, Notice } from 'obsidian';

export interface PerplexityOptions {
    return_citations?: boolean;
    return_images?: boolean;
    return_related_questions?: boolean;
    search_recency_filter?: string;
}

export interface PerplexitySettings {
    perplexityApiKey: string;
    perplexityEndpoint: string;
    promptsService?: any; // Will be PromptsService type
    requestTemplate?: string;
}

export class PerplexityService {
    private settings: PerplexitySettings;
    private promptsService: any;

    constructor(settings: PerplexitySettings) {
        this.settings = settings;
        this.promptsService = settings.promptsService;
    }

    private convertRecencyFilter(filter: string): string | undefined {
        // Handle empty string (no filter)
        if (!filter || filter === '') {
            return undefined; // Don't include the parameter at all for no filter
        }
        
        // API only supports: day, week, month, year
        // Custom multi-year options should fall back to "year" as the closest valid option
        const validFilters = ['day', 'week', 'month', 'year'];
        
        if (validFilters.includes(filter)) {
            return filter;
        }
        
        // For any custom multi-year options, fallback to 'year' since API doesn't support them
        if (filter.includes('year')) {
            return 'year';
        }
        
        // Default fallback
        return 'month';
    }

    private processContentWithImages(content: string, images: any[]): string {
        let processedContent = content;
        let imageIndex = 0;
        
        // Find image markers like [IMAGE 1: description] or [IMAGE 1: description]
        const imageRegex = /\[IMAGE\s+(\d+):\s*(.*?)\]/gi;
        let match;
        
        while ((match = imageRegex.exec(content)) !== null && imageIndex < images.length) {
            const imageNumber = parseInt(match[1] || '0');
            const description = match[2]?.trim() || '';
            const image = images[imageIndex];
            
            if (image && image.image_url) {
                // Create the image markdown with description and source
                let imageMarkdown = `\n\n![${description}](${image.image_url})\n`;
                if (image.origin_url) {
                    imageMarkdown += `*Source: ${image.origin_url}*\n`;
                }
                imageMarkdown += '\n';
                
                // Replace the marker with the actual image
                processedContent = processedContent.replace(match[0], imageMarkdown);
                console.log(`🖼️ Replaced [IMAGE ${imageNumber}] with actual image: ${image.image_url}`);
            }
            
            imageIndex++;
        }
        
        // If we found and replaced any markers, return the processed content
        if (imageIndex > 0) {
            console.log(`🔄 Processed ${imageIndex} image markers in content`);
            return processedContent;
        }
        
        // If no markers were found, return original content
        return content;
    }

    public async queryPerplexity(
        query: string, 
        model: string, 
        stream: boolean, 
        editor: Editor, 
        options?: PerplexityOptions
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        
        // Force non-streaming for sonar-deep-research
        const isDeepResearch = model === 'sonar-deep-research';
        const useStreaming = stream && !isDeepResearch;
        
        // Insert query header at the current cursor position
        const cursor = editor.getCursor();
        console.log('Initial cursor position:', cursor);
        
        // Process query to handle multi-line content in callout
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');
        
        const headerText = isDeepResearch 
            ? `\n\n***\n> [!info] **Perplexity Deep Research Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> 🔍 **Conducting exhaustive research across hundreds of sources...**\n> *This may take 30-60 seconds for comprehensive analysis.*\n> \n> ### **Deep Research Analysis**:\n\n`
            : `\n\n***\n> [!info] **Perplexity Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> ### **Response from ${model}**:\n\n`;
        
        // Insert the header at the cursor position
        editor.replaceRange(headerText, cursor, cursor);
        
        // Calculate where the response content should start
        const headerLines = headerText.split('\n');
        const lastLine = headerLines[headerLines.length - 1] || '';
        const responseCursor = {
            line: cursor.line + headerLines.length - 1,
            ch: lastLine.length
        };
        
        console.log('Response cursor position:', responseCursor);
        
        // Show loading notice for deep research
        let loadingNotice: Notice | null = null;
        if (isDeepResearch) {
            loadingNotice = new Notice(this.promptsService?.getDeepResearchLoadingNotice() || '🔍 Deep research in progress... This may take up to 60 seconds.', 0); // 0 = persistent
        }
        
        try {
            const convertedFilter = this.convertRecencyFilter(options?.search_recency_filter ?? "month");
            
            // Use template if available, otherwise construct payload manually
            let payload: any;
            if (this.settings.requestTemplate) {
                try {
                    const processedTemplate = this.promptsService?.processTemplate(this.settings.requestTemplate) || this.settings.requestTemplate;
                    payload = JSON.parse(processedTemplate);
                    // Override with current query and options
                    payload.model = model;
                    payload.messages = [
                        { role: 'user', content: query }
                    ];
                    payload.stream = useStreaming;
                    payload.return_citations = options?.return_citations ?? true;
                    payload.return_images = options?.return_images ?? true;
                    payload.return_related_questions = options?.return_related_questions ?? false;
                } catch (error) {
                    console.warn('Failed to parse request template, using default payload:', error);
                    payload = {
                        model,
                        messages: [
                            { role: 'user', content: query }
                        ],
                        stream: useStreaming,
                        return_citations: options?.return_citations ?? true,
                        return_images: options?.return_images ?? true,
                        return_related_questions: options?.return_related_questions ?? false
                    };
                }
            } else {
                payload = {
                    model,
                    messages: [
                        { role: 'user', content: query }
                    ],
                    stream: useStreaming,
                    return_citations: options?.return_citations ?? true,
                    return_images: options?.return_images ?? true,
                    return_related_questions: options?.return_related_questions ?? false
                };
            }
            
            // Only include search_recency_filter if we have a filter value
            if (convertedFilter !== undefined) {
                payload.search_recency_filter = convertedFilter;
            }

            // Debug: Log the API payload being sent
            console.log('🚀 Perplexity API Payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(this.settings.perplexityEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Debug: Log the response status
            console.log('📡 Perplexity API Response Status:', response.status);
            console.log('📡 Perplexity API Response Headers:', {
                'content-type': response.headers.get('content-type'),
                'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
                'x-ratelimit-reset': response.headers.get('x-ratelimit-reset')
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let finalCursor = responseCursor;
            
            if (useStreaming) {
                await this.handleStreamingResponse(response, editor, responseCursor);
            } else {
                await this.handleNonStreamingResponse(response, editor, responseCursor);
            }
            
            // Add separator at the final cursor position
            editor.replaceRange('\n\n***\n', finalCursor);
            
            // Close loading notice if it exists
            if (loadingNotice) {
                loadingNotice.hide();
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Perplexity Error: ${errorMsg}`);
            editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
            
            // Close loading notice if it exists
            if (loadingNotice) {
                loadingNotice.hide();
            }
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
        let finalResponseData: any = null;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            buffer += chunk;
            
            // Debug: Log streaming chunks (verbose - uncomment if needed)
            // console.log('📦 Perplexity Streaming chunk received:', chunk);
            
            // Process complete lines from buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    const data = line.replace('data: ', '').trim();
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        // Store the final response data for processing citations and images
                        if (parsed.citations || parsed.images || parsed.search_results) {
                            finalResponseData = parsed;
                        }
                        
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
        
        // After streaming is complete, add citations and images if available
        if (finalResponseData) {
            await this.processStreamingMetadata(finalResponseData, editor);
        }
    }

    private async handleNonStreamingResponse(
        response: Response, 
        editor: Editor, 
        responseCursor: { line: number; ch: number }
    ): Promise<void> {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response received';
        
        // Extract citations/sources if available
        let fullResponse = content;
        console.log('🔍 Perplexity Response Data:', JSON.stringify(data, null, 2));
        
        // Process images with intelligent placement
        if (data.images && data.images.length > 0) {
            console.log('📸 Perplexity Images Found:', data.images.length);
            console.log('📸 Images Data:', JSON.stringify(data.images, null, 2));
            
            // Process the content for image markers
            const processedContent = this.processContentWithImages(content, data.images);
            
            if (processedContent !== content) {
                // Use the processed content with inline images
                fullResponse = processedContent;
                console.log('🔄 Content updated with inline images (non-streaming)');
            } else {
                // Fallback: add images at the end if no markers found
                fullResponse += '\n\n## Images\n\n';
                data.images.forEach((image: any, index: number) => {
                    if (image.image_url) {
                        fullResponse += `![Image ${index + 1}](${image.image_url})\n`;
                        if (image.origin_url) {
                            fullResponse += `*Source: ${image.origin_url}*\n\n`;
                        } else {
                            fullResponse += '\n';
                        }
                    }
                });
            }
        } else {
            console.log('📸 No images found in Perplexity response');
        }
        
        editor.replaceRange(fullResponse, responseCursor);
        
        // Add sources after the last non-empty line if available
        if (data.citations && data.citations.length > 0) {
            console.log('📚 Perplexity Sources Found:', data.citations.length);
            console.log('📚 Sources Data:', JSON.stringify(data.citations, null, 2));
            
            // Find the last non-empty line
            let lastNonEmptyLine = editor.lastLine();
            while (lastNonEmptyLine >= 0) {
                const lineContent = editor.getLine(lastNonEmptyLine);
                if (lineContent.trim() !== '') {
                    break;
                }
                lastNonEmptyLine--;
            }
            
            // If we found a non-empty line, insert sources after it
            if (lastNonEmptyLine >= 0) {
                const lastLineContent = editor.getLine(lastNonEmptyLine);
                const insertPosition = { line: lastNonEmptyLine, ch: lastLineContent.length };
                
                let sourcesSection = '\n\n## Sources\n\n';
                data.citations.forEach((citation: any, index: number) => {
                    sourcesSection += `[${index + 1}] ${citation.url || citation.title || citation}\n`;
                });
                
                editor.replaceRange(sourcesSection, insertPosition);
            }
        } else {
            console.log('📚 No sources/citations found in Perplexity response');
        }
    }

    private async processStreamingMetadata(
        finalResponseData: any, 
        editor: Editor
    ): Promise<void> {
        console.log('🔍 Perplexity Streaming Response Data:', JSON.stringify(finalResponseData, null, 2));
        
        // Process images with intelligent placement
        if (finalResponseData.images && finalResponseData.images.length > 0) {
            console.log('📸 Perplexity Images Found (Streaming):', finalResponseData.images.length);
            console.log('📸 Images Data (Streaming):', JSON.stringify(finalResponseData.images, null, 2));
            
            // Get the current content to process for image markers
            const currentContent = editor.getValue();
            const processedContent = this.processContentWithImages(currentContent, finalResponseData.images);
            
            if (processedContent !== currentContent) {
                // Replace the entire content with processed version
                editor.setValue(processedContent);
                console.log('🔄 Content updated with inline images');
            } else {
                // Fallback: add images at the end if no markers found
                let imagesSection = '\n\n## Images\n\n';
                finalResponseData.images.forEach((image: any, index: number) => {
                    if (image.image_url) {
                        imagesSection += `![Image ${index + 1}](${image.image_url})\n`;
                        if (image.origin_url) {
                            imagesSection += `*Source: ${image.origin_url}*\n\n`;
                        } else {
                            imagesSection += '\n';
                        }
                    }
                });
                
                editor.replaceRange(imagesSection, editor.getCursor());
            }
        } else {
            console.log('📸 No images found in Perplexity streaming response');
        }
        
        // Add citations/sources after the last non-empty line if available
        if (finalResponseData.citations && finalResponseData.citations.length > 0) {
            console.log('📚 Perplexity Sources Found (Streaming):', finalResponseData.citations.length);
            console.log('📚 Sources Data (Streaming):', JSON.stringify(finalResponseData.citations, null, 2));
            
            // Find the last non-empty line
            let lastNonEmptyLine = editor.lastLine();
            while (lastNonEmptyLine >= 0) {
                const lineContent = editor.getLine(lastNonEmptyLine);
                if (lineContent.trim() !== '') {
                    break;
                }
                lastNonEmptyLine--;
            }
            
            // If we found a non-empty line, insert sources after it
            if (lastNonEmptyLine >= 0) {
                const lastLineContent = editor.getLine(lastNonEmptyLine);
                const insertPosition = { line: lastNonEmptyLine, ch: lastLineContent.length };
                
                let sourcesSection = '\n\n## Sources\n\n';
                finalResponseData.citations.forEach((citation: any, index: number) => {
                    sourcesSection += `[${index + 1}] ${citation}\n`;
                });
                
                editor.replaceRange(sourcesSection, insertPosition);
            }
        } else {
            console.log('📚 No sources/citations found in Perplexity streaming response');
        }
    }
} 