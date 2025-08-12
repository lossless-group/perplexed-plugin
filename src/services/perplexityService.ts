import { Editor, Notice, request } from 'obsidian';
import { formatCitationDate, getMostRecentDate, formatPublicationInfo } from '../utils/formatDate';

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
    headerPosition?: 'top' | 'bottom';
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
        if (!images || images.length === 0) return content;
        
        console.log('🖼️ Processing images:', JSON.stringify(images, null, 2));
        console.log('📝 Original content length:', content.length);
        
        let processedContent = content;
        const imageRegex = /\[IMAGE\s+(\d+):\s*(.*?)\]/gi;
        const matches: Array<{fullMatch: string, number: string, description: string, index: number}> = [];
        
        // First, collect all matches
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            const [fullMatch, number, description] = match;
            if (number && description) {
                matches.push({
                    fullMatch,
                    number: number.trim(),
                    description: description.trim(),
                    index: match.index
                });
            }
        }
        
        console.log('🔍 Found image markers:', matches);
        
        // Sort matches by their position in the content (descending) to avoid index shifting issues
        matches.sort((a, b) => b.index - a.index);
        
        // Replace matches from end to beginning to avoid index shifting
        matches.forEach((matchInfo) => {
            const imageIndex = parseInt(matchInfo.number) - 1; // Convert 1-based to 0-based
            const image = images[imageIndex];
            
            if (image && image.image_url) {
                const imageMarkdown = `![${matchInfo.description || 'Image'}](${image.image_url})`;
                processedContent = processedContent.replace(matchInfo.fullMatch, imageMarkdown);
                console.log(`✅ Replaced IMAGE ${matchInfo.number} with: ${image.image_url}`);
            } else {
                console.log(`❌ No image found for IMAGE ${matchInfo.number} (index ${imageIndex})`);
            }
        });
        
        console.log('📝 Processed content length:', processedContent.length);
        return processedContent;
    }

    private addCitations(editor: Editor, sources: any[]): void {
        if (!sources || sources.length === 0) return;

        console.log('📚 Processing sources:', JSON.stringify(sources, null, 2));

        // Add a section for citations
        let citationsText = '\n\n### Citations\n\n';
        
        sources.forEach((source, index) => {
            console.log(`📖 Source ${index + 1}:`, source);
            
            // Handle different formats:
            // 1. search_results format: {title, url, date, last_updated}
            // 2. citations format: just URL strings
            let title: string;
            let url: string;
            let formattedDate = '';
            let publicationInfo = '';
            
            if (typeof source === 'string') {
                // citations array format - just URLs
                url = source;
                title = 'Source';
            } else if (source && typeof source === 'object') {
                // search_results format - detailed objects
                title = source.title || 'Source';
                url = source.url || '#';
                
                // Format the most recent date for the footnote
                const mostRecentDate = getMostRecentDate(source);
                if (mostRecentDate) {
                    formattedDate = formatCitationDate(mostRecentDate);
                }
                
                // Create publication info string
                publicationInfo = formatPublicationInfo(source);
            } else {
                // Fallback
                title = 'Source';
                url = '#';
            }
            
            console.log(`📝 Extracted - Title: "${title}", URL: "${url}", Date: "${formattedDate}", Info: "${publicationInfo}"`);
            
            // Format: [1]: 2024, Dec 13. [Title](URL). Published: date | Updated: date
            citationsText += `[${index + 1}]: ${formattedDate ? formattedDate + '. ' : ''}[${title}](${url}).${publicationInfo ? ' ' + publicationInfo : ''}\n\n`;
        });

        console.log('📄 Final citations text:', citationsText);

        // Insert citations at the end of the editor content
        const endOfDoc = editor.lastLine();
        const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
        editor.replaceRange(citationsText, endPos);
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
        
        // Insert query header based on headerPosition setting
        const cursor = editor.getCursor();
        console.log('Initial cursor position:', cursor);
        
        // Process query to handle multi-line content in callout
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');
        
        const headerText = isDeepResearch 
            ? `\n\n***\n> [!info] **Perplexity Deep Research Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> 🔍 **Conducting exhaustive research across hundreds of sources...**\n> *This may take 30-60 seconds for comprehensive analysis.*\n> \n> ### **Deep Research Analysis**:\n\n`
            : `\n\n***\n> [!info] **Perplexity Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> ### **Response from ${model}**:\n\n`;
        
        let responseCursor;
        
        // Handle header position setting
        if (this.settings.headerPosition === 'bottom') {
            // For bottom placement, don't insert header now - we'll add it later
            // Start streaming content directly at the cursor position
            responseCursor = cursor;
        } else {
            // Default to top placement (including when headerPosition is undefined)
            editor.replaceRange(headerText, cursor, cursor);
            
            // Calculate where the response content should start
            const headerLines = headerText.split('\n');
            const lastLine = headerLines[headerLines.length - 1] || '';
            responseCursor = {
                line: cursor.line + headerLines.length - 1,
                ch: lastLine.length
            };
        }
        
        console.log('Response cursor position:', responseCursor);
        console.log('Header position setting:', this.settings.headerPosition);
        console.log('Header text preview:', headerText ? headerText.substring(0, 100) + '...' : 'No header text');
        
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
                    
                    // Strip JavaScript-style comments that would break JSON parsing
                    let cleanedTemplate = processedTemplate
                        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
                        .replace(/\/\/.*$/gm, '') // Remove // comments
                        .replace(/^\s*$/gm, '') // Remove empty lines
                        .trim();
                    
                    // Check if template contains JavaScript code instead of JSON
                    if (cleanedTemplate.includes('const ') || cleanedTemplate.includes('fetch(') || cleanedTemplate.includes('await ')) {
                        console.warn('⚠️ Template contains JavaScript code, not JSON. Extracting payload object...');
                        
                        // Try to extract JSON payload from JavaScript code
                        const payloadMatch = cleanedTemplate.match(/payload\s*=\s*({[\s\S]*?});/);
                        if (payloadMatch) {
                            let jsObject = payloadMatch[1];
                            console.log('🔍 Extracted payload from JavaScript:', jsObject);
                            
                            // Convert JavaScript object syntax to valid JSON
                            // Replace unquoted property names with quoted ones
                            jsObject = jsObject.replace(/(\w+):/g, '"$1":');
                            // Fix single quotes to double quotes
                            jsObject = jsObject.replace(/'/g, '"');
                            
                            cleanedTemplate = jsObject;
                        } else {
                            throw new Error('Template contains JavaScript code but no valid payload object found. Please use JSON format only.');
                        }
                    }
                    
                    console.log('🧹 Final cleaned template:', cleanedTemplate);
                    payload = JSON.parse(cleanedTemplate);
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

            // Add cache busting to prevent request/response caching
            const requestId = Date.now() + Math.random();
            
            // Debug: Log the API payload being sent
            console.log(`🚀 Perplexity API Payload [${requestId}]:`, JSON.stringify(payload, null, 2));

            try {
                if (useStreaming) {
                    // Use fetch for streaming responses with cache busting headers
                    const response = await fetch(this.settings.perplexityEndpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'text/event-stream'
                        },
                        body: JSON.stringify(payload),
                        cache: 'no-store'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    if (!response.body) {
                        throw new Error('No response body');
                    }

                    await this.handleStreamingResponse(response, editor, responseCursor, requestId, headerText);
                } else {
                    // Use Obsidian's request method for non-streaming with cache busting
                    const response = await request({
                        url: this.settings.perplexityEndpoint,
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    // Parse the response
                    const data = JSON.parse(response);

                    // Process the response
                    if (data.choices && data.choices.length > 0) {
                        let content = data.choices[0].message.content;
                        
                        // Process images if available
                        if (options?.return_images && data.images) {
                            console.log('🖼️ Processing images in non-streaming response:', data.images.length, 'images found');
                            console.log('📝 Content before image processing:', content.substring(0, 500) + '...');
                            content = this.processContentWithImages(content, data.images);
                        }
                        
                        // Insert the response at the cursor position
                        editor.replaceRange(content, responseCursor);
                        
                        // Add citations if available
                        if (options?.return_citations) {
                            if (data.search_results && data.search_results.length > 0) {
                                // Use search_results for detailed info (preferred for Perplexity)
                                this.addCitations(editor, data.search_results);
                            } else if (data.citations && data.citations.length > 0) {
                                // Fallback to citations array (could be URLs or other format)
                                this.addCitations(editor, data.citations);
                            }
                        }
                        
                        // Add header at bottom if that setting is enabled
                        if (this.settings.headerPosition === 'bottom') {
                            const endOfDoc = editor.lastLine();
                            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
                            editor.replaceRange('\n\n' + headerText, endPos);
                        }
                    }
                    
                    // Add separator at the final cursor position
                    editor.replaceRange('\n\n***\n', responseCursor);
                }
                
            } catch (error) {
                console.error('Error making request to Perplexity API:', error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                new Notice(`Perplexity Error: ${errorMsg}`);
                editor.replaceRange(`\n**Error:** ${errorMsg}\n\n***\n`, editor.getCursor());
            } finally {
                // Close loading notice if it exists
                if (loadingNotice) {
                    loadingNotice.hide();
                }
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
        responseCursor: { line: number; ch: number },
        requestId?: number,
        headerText?: string
    ): Promise<void> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        
        console.log(`🔄 Starting streaming response handler [${requestId || 'unknown'}]`);
        
        let buffer = '';
        let currentPos = { ...responseCursor };
        let finalResponseData: any = null;
        
        console.log(`📍 Initial currentPos:`, currentPos);
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value, { stream: true });
                buffer += chunk;
                
                // Process complete lines from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    try {
                        if (line.startsWith('data: ')) {
                            const data = line.replace('data: ', '').trim();
                            if (data === '[DONE]') continue;
                            
                            const parsed = JSON.parse(data);
                            
                            // Store the final response data for processing citations and images
                            // Always update finalResponseData to ensure we have the latest metadata
                            if (parsed.citations || parsed.images || parsed.search_results) {
                                finalResponseData = parsed;
                            }
                            
                            // Also clear any stale data if this chunk doesn't have metadata
                            // This prevents using old metadata from previous requests
                            if (parsed.choices?.[0]?.finish_reason === 'stop' && !parsed.citations && !parsed.images && !parsed.search_results) {
                                // This is the final chunk but has no metadata, ensure we don't use stale data
                                if (finalResponseData && !finalResponseData.choices?.[0]?.finish_reason) {
                                    // Only clear if the stored data doesn't have finish_reason (meaning it's incomplete)
                                    console.log('🧹 Clearing potentially stale finalResponseData');
                                    finalResponseData = null;
                                }
                            }
                            
                            if (parsed.choices?.[0]?.delta?.content) {
                                const content = parsed.choices[0].delta.content;
                                if (content) {
                                    console.log(`📝 Inserting content at position:`, currentPos, `Content:`, content.substring(0, 50) + '...');
                                    editor.replaceRange(content, currentPos);
                                    // Update cursor position after insertion
                                    const contentLines = content.split('\n');
                                    if (contentLines.length === 1) {
                                        currentPos.ch += content.length;
                                    } else {
                                        currentPos.line += contentLines.length - 1;
                                        currentPos.ch = contentLines[contentLines.length - 1].length;
                                    }
                                    // Scroll to follow the new content
                                    editor.scrollIntoView({ from: currentPos, to: currentPos }, true);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Error processing streaming chunk:', e);
                        // Continue processing other lines even if one fails
                    }
                }
                
                // Small delay to prevent UI blocking
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Process final metadata (citations, images) after streaming is complete
            if (finalResponseData) {
                console.log(`📝 Processing final response data [${requestId || 'unknown'}]:`, finalResponseData);
                await this.processStreamingMetadata(finalResponseData, editor, headerText);
            }
            
            // Add final separator
            const endPos = { ...currentPos };
            editor.replaceRange('\n\n***\n', endPos);
            
        } catch (error) {
            console.error('Error in streaming response:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error during streaming';
            new Notice(`Streaming error: ${errorMsg}`);
            editor.replaceRange(`\n**Streaming Error:** ${errorMsg}\n\n`, currentPos);
        }
    }

    private async processStreamingMetadata(
        finalResponseData: any, 
        editor: Editor,
        headerText?: string
    ): Promise<void> {
        console.log('🔍 Perplexity Streaming Response Data:', JSON.stringify(finalResponseData, null, 2));
        
        // Process images with intelligent placement
        if (finalResponseData.images && finalResponseData.images.length > 0) {
            console.log('🖼️ Processing images in streaming response:', finalResponseData.images.length, 'images found');
            const content = editor.getValue();
            console.log('📝 Content before image processing:', content.substring(0, 500) + '...');
            const processedContent = this.processContentWithImages(content, finalResponseData.images);
            
            if (processedContent !== content) {
                // Update the editor with the processed content
                editor.setValue(processedContent);
                console.log('🔄 Content updated with inline images (streaming)');
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
                
                // Append images section to the end of the document
                const endOfDoc = editor.lastLine();
                const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
                editor.replaceRange(imagesSection, endPos);
            }
        }
        
        // Process sources/citations if available
        if (finalResponseData.search_results && finalResponseData.search_results.length > 0) {
            // Use search_results for detailed info (preferred for Perplexity streaming)
            this.addCitations(editor, finalResponseData.search_results);
        } else if (finalResponseData.citations && finalResponseData.citations.length > 0) {
            // Fallback to citations array (could be URLs or other format)
            this.addCitations(editor, finalResponseData.citations);
        } else {
            console.log('📚 No sources/citations found in Perplexity streaming response');
        }
        
        // Add header at bottom if that setting is enabled
        if (this.settings.headerPosition === 'bottom' && headerText) {
            console.log('📄 Adding header at bottom of document');
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            console.log('📍 End position for header:', endPos);
            editor.replaceRange('\n\n' + headerText, endPos);
            console.log('✅ Header added at bottom');
        } else {
            console.log('📄 Header position setting:', this.settings.headerPosition, 'Header text available:', !!headerText);
        }
    }
}
