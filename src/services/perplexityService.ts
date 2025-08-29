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
        
        console.log(`🖼️ Processing ${images.length} images for content replacement`);
        
        let processedContent = content;
        const imageRegex = /\[IMAGE\s+(\d+):\s*(.*?)\]/gi;
        const matches: Array<{fullMatch: string, number: string, description: string, index: number}> = [];
        
        // First, collect all matches
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            const [fullMatch, number, description] = match;
            console.log(`🔍 Regex match found: "${fullMatch}" with number="${number}" description="${description}"`);
            if (number && description) {
                matches.push({
                    fullMatch,
                    number: number.trim(),
                    description: description.trim(),
                    index: match.index
                });
            } else {
                console.log(`⚠️ Invalid match - number: "${number}", description: "${description}"`);
            }
        }
        
        if (matches.length === 0) {
            console.log('🔍 No image markers found in content');
            return content;
        }
        
        console.log(`🔍 Found ${matches.length} image markers in content`);
        
        // Sort matches by their position in the content (descending) to avoid index shifting issues
        matches.sort((a, b) => b.index - a.index);
        
        let replacedCount = 0;
        
        // Replace matches from end to beginning to avoid index shifting
        matches.forEach((matchInfo) => {
            console.log(`🔍 Processing image reference: "${matchInfo.fullMatch}" at index ${matchInfo.index}`);
            
            const imageIndex = parseInt(matchInfo.number) - 1; // Convert 1-based to 0-based
            const image = images[imageIndex];
            
            if (image && image.image_url) {
                const imageMarkdown = `![${matchInfo.description || 'Image'}](${image.image_url})`;
                processedContent = processedContent.replace(matchInfo.fullMatch, imageMarkdown);
                replacedCount++;
                console.log(`🔄 Replaced "${matchInfo.fullMatch}" with image markdown`);
            } else {
                console.log(`⚠️ No image found for index ${imageIndex} or no image_url`);
            }
        });
        
        console.log(`✅ Replaced ${replacedCount} image markers with actual images`);
        return processedContent;
    }



    private findQueryHeaderEnd(content: string): number {
        // Find where the query header ends (after the callout block)
        // Look for patterns that indicate the end of a query header
        
        const lines = content.split('\n');
        let inCallout = false;
        let calloutEndIndex = -1;
        let currentIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!; // Non-null assertion since we're iterating within bounds
            const lineStartIndex = currentIndex;
            
            // Check if this line starts a callout
            if (line.match(/^\s*>\s*\[!.*?\]/)) {
                inCallout = true;
            }
            
            // If we're in a callout and find a blank line, that's the end
            if (inCallout && line.trim() === '') {
                calloutEndIndex = currentIndex;
                break;
            }
            
            // If we're in a callout and find a line that doesn't start with '>', that's the end
            if (inCallout && !line.match(/^\s*>/)) {
                calloutEndIndex = lineStartIndex;
                break;
            }
            
            currentIndex += line.length + 1; // +1 for newline
        }
        
        // If we found a callout end, return it
        if (calloutEndIndex > 0) {
            console.log(`🔍 Query header ends at position ${calloutEndIndex}`);
            return calloutEndIndex;
        }
        
        // If no callout found, look for other patterns that might indicate header end
        const headerEndPatterns = [
            /\*\*\*/, // Horizontal rule
            /^#\s/, // Heading
            /^##\s/, // Subheading
            /^###\s/ // Sub-subheading
        ];
        
        for (const pattern of headerEndPatterns) {
            const match = content.match(pattern);
            if (match) {
                const endIndex = match.index || 0;
                console.log(`🔍 Found header end pattern at position ${endIndex}`);
                return endIndex;
            }
        }
        
        return -1; // No header end found
    }

    private processThinkBlocks(content: string): string {
        if (!content.includes('<think>')) return content;
        
        console.log('🧠 Processing think blocks in content');
        
        // Replace <think> blocks with markdown callouts
        let processedContent = content;
        
        // Match <think>...</think> blocks, including nested content
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        
        processedContent = processedContent.replace(thinkRegex, (_match, thinkContent) => {
            // Clean up the think content - remove extra whitespace and format
            const cleanedContent = thinkContent
                .trim()
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)
                .join('\n');
            
            // Create a markdown callout for the think block
            const callout = `> [!brain] **AI Reasoning Process**
> 
> ${cleanedContent}
> 
> ---
> *This shows the AI's internal reasoning before generating the response.*`;
            
            console.log('🧠 Converted think block to callout');
            return callout;
        });
        
        return processedContent;
    }

    private clearLoadingText(editor: Editor): void {
        // Look for loading text in the document and remove it
        const content = editor.getValue();
        const loadingPattern = /🔍 Deep Research Loading\.*$/gm;
        
        if (loadingPattern.test(content)) {
            // Find and remove loading text
            const lines = content.split('\n');
            const updatedLines = lines.filter(line => !line.includes('🔍 Deep Research Loading'));
            
            if (updatedLines.length !== lines.length) {
                editor.setValue(updatedLines.join('\n'));
                console.log('🧹 Cleared loading text from document');
            }
        }
    }

    private clearLoadingAnimation(): void {
        // Clear the animation interval if it exists
        if ((this as any).loadingInterval) {
            console.log('🛑 Clearing loading animation interval');
            clearInterval((this as any).loadingInterval);
            (this as any).loadingInterval = null;
        }
    }

    private addCitations(editor: Editor, sources: any[]): void {
        if (!sources || sources.length === 0) return;

        console.log(`📚 Processing ${sources.length} sources for citations`);

        // Check if there's already a citations section
        const content = editor.getValue();
        const existingCitationsMatch = content.match(/### Citations\n\n([\s\S]*?)(?=\n\n\*\*\*|\n\n### |\n\n## |\n\n# |$)/);
        
        let existingCitations = '';
        
        if (existingCitationsMatch && existingCitationsMatch[1]) {
            // Found existing citations section
            existingCitations = existingCitationsMatch[1];
            console.log('📚 Found existing citations section, will append to it');
        }

        // Generate new citations
        let newCitationsText = '';
        let citationNumber = 1;
        
        // If there are existing citations, find the next available number
        if (existingCitations) {
            // Check for both numbered citations [1]: and footnote citations [^abc123]:
            const numberedCitations = existingCitations.match(/\[(\d+)\]:/g);
            const footnoteCitations = existingCitations.match(/\[\^[a-zA-Z0-9]+\]:/g);
            
            if (numberedCitations && numberedCitations.length > 0) {
                // Use numbered format and continue from highest number
                const maxNumber = Math.max(...numberedCitations.map(n => {
                    const match = n.match(/\d+/);
                    return match ? parseInt(match[0]) : 0;
                }));
                citationNumber = maxNumber + 1;
            } else if (footnoteCitations && footnoteCitations.length > 0) {
                // Convert to numbered format starting from 1
                citationNumber = 1;
            } else {
                // No existing citations found, start from 1
                citationNumber = 1;
            }
        }
        
        sources.forEach((source, index) => {
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
            
            // Format: [1]: 2024, Dec 13. [Title](URL). Published: date | Updated: date
            newCitationsText += `[${citationNumber + index}]: ${formattedDate ? formattedDate + '. ' : ''}[${title}](${url}).${publicationInfo ? ' ' + publicationInfo : ''}\n\n`;
        });

        if (existingCitationsMatch) {
            // Append to existing citations section
            const updatedCitations = existingCitations + newCitationsText;
            const citationsStartIndex = content.indexOf('### Citations');
            const citationsEndIndex = citationsStartIndex + '### Citations\n\n'.length + existingCitations.length;
            
            // Replace the existing citations section with the updated one
            const beforeCitations = content.substring(0, citationsStartIndex + '### Citations\n\n'.length);
            const afterCitations = content.substring(citationsEndIndex);
            const updatedContent = beforeCitations + updatedCitations + afterCitations;
            
            editor.setValue(updatedContent);
            console.log('✅ Citations appended to existing section');
        } else {
            // Create new citations section at the end
            const citationsText = '\n\n### Citations\n\n' + newCitationsText;
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange(citationsText, endPos);
            console.log('✅ New citations section created');
        }
    }

    public async queryPerplexity(
        query: string, 
        model: string, 
        stream: boolean, 
        editor: Editor, 
        options?: PerplexityOptions
    ): Promise<void> {
        console.log('🚀 PerplexityService.queryPerplexity called');
        console.log('📊 Parameters:', { model, stream, options, queryLength: query.length });
        
        const timestamp = new Date().toISOString();
        
        // Check if using deep research model
        const isDeepResearch = model === 'sonar-deep-research';
        const useStreaming = stream; // Allow streaming for all models including deep research
        
        console.log('🔍 Model analysis:', { isDeepResearch, useStreaming });
        
        // Insert query header based on headerPosition setting
        const cursor = editor.getCursor();
        console.log('Initial cursor position:', cursor);
        
        // Process query to handle multi-line content in callout
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');
        
        const headerText = isDeepResearch 
            ? `\n\n***\n> [!info] **Perplexity Deep Research Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> **Model:** ${model}\n> \n> 🔍 **Conducting exhaustive research across hundreds of sources...**\n> *This may take 30-60 seconds for comprehensive analysis.*\n> \n>`
            : `\n\n***\n> [!info] **Perplexity Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> \n> **Model:** ${model}\n> \n>`;
        
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
                    console.log('🔄 Making streaming API request...');
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

                    console.log('✅ Streaming response received, starting to handle...');
                    await this.handleStreamingResponse(response, editor, responseCursor, requestId, headerText);
                } else {
                    console.log('🔄 Making non-streaming API request...');
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

                    console.log('✅ Non-streaming response received');
                    // Parse the response
                    const data = JSON.parse(response);

                    console.log('📊 Response data structure:', Object.keys(data));
                    // Process the response
                    if (data.choices && data.choices.length > 0) {
                        let content = data.choices[0].message.content;
                        
                        // Process think blocks first
                        content = this.processThinkBlocks(content);
                        
                        // Process images if available
                        if (options?.return_images && data.images && data.images.length > 0) {
                            console.log('🖼️ Processing images in non-streaming response:', data.images.length, 'images found');
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
                
                // Clear loading text and animation before showing error
                this.clearLoadingText(editor);
                this.clearLoadingAnimation();
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
            
            // Clear loading text and animation before showing error
            this.clearLoadingText(editor);
            this.clearLoadingAnimation();
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
        console.log('🔄 handleStreamingResponse called');
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
                                    // console.log('🎉 First content received! Clearing loading text...');
                                    // Clear any loading text before inserting content
                                    this.clearLoadingText(editor);
                                    
                                    // Clear the animation interval if it exists
                                    this.clearLoadingAnimation();
                                    
                                    // console.log(`📝 Inserting content at position:`, currentPos, `Content:`, content.substring(0, 50) + '...');
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
            
            // Add final separator at the very end of the document
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange('\n\n***\n', endPos);
            
            // Clear any remaining loading animation
            this.clearLoadingAnimation();
            
        } catch (error) {
            console.error('Error in streaming response:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error during streaming';
            new Notice(`Streaming error: ${errorMsg}`);
            
            // Clear loading text and animation before showing error
            this.clearLoadingText(editor);
            this.clearLoadingAnimation();
            editor.replaceRange(`\n**Streaming Error:** ${errorMsg}\n\n`, currentPos);
        }
    }

    private async processStreamingMetadata(
        finalResponseData: any, 
        editor: Editor,
        headerText?: string
    ): Promise<void> {
        console.log('🔍 Processing streaming metadata');
        console.log('📊 Response data keys:', Object.keys(finalResponseData || {}));
        if (finalResponseData.images) {
            console.log(`🖼️ Images array length: ${finalResponseData.images.length}`);
        }
        if (finalResponseData.search_results) {
            console.log(`📚 Search results array length: ${finalResponseData.search_results.length}`);
        }
        
        // Get current content for processing
        let content = editor.getValue();
        let contentUpdated = false;
        
        // Process think blocks first
        const processedThinkContent = this.processThinkBlocks(content);
        if (processedThinkContent !== content) {
            content = processedThinkContent;
            contentUpdated = true;
            console.log('🧠 Think blocks processed in streaming response');
        }
        
        // Process images with intelligent placement
        if (finalResponseData.images && finalResponseData.images.length > 0) {
            console.log('🖼️ Processing images in streaming response:', finalResponseData.images.length, 'images found');
            
                    // Debug: Let's see what image references are in the content
            const imageRegex = /\[IMAGE\s+(\d+):\s*(.*?)\]/gi;
            const allMatches = content.match(imageRegex);
            console.log('🔍 All image references found in content:', allMatches);
            
            // Also log a sample of the content to see the format
            const sampleContent = content.substring(0, Math.min(500, content.length));
            console.log('🔍 Sample content:', sampleContent);
            
            const processedContent = this.processContentWithImages(content, finalResponseData.images);
            
            if (processedContent !== content) {
                content = processedContent;
                contentUpdated = true;
                console.log('🔄 Content updated with inline images (streaming)');
            } else {
                console.log('⚠️ No image markers were replaced, falling back to Images section');
                
                // Try to find where the response content starts (after the query header)
                const queryHeaderEnd = this.findQueryHeaderEnd(content);
                if (queryHeaderEnd > 0) {
                    console.log(`📍 Found query header end at position ${queryHeaderEnd}, inserting images inline`);
                    
                    // Insert images inline after the query header
                    let imagesSection = '\n\n';
                    finalResponseData.images.forEach((image: any, index: number) => {
                        if (image.image_url) {
                            imagesSection += `![Image ${index + 1}](${image.image_url})\n\n`;
                        }
                    });
                    
                    // Insert images after the query header
                    const beforeHeader = content.substring(0, queryHeaderEnd);
                    const afterHeader = content.substring(queryHeaderEnd);
                    const newContent = beforeHeader + imagesSection + afterHeader;
                    editor.setValue(newContent);
                    contentUpdated = true;
                    console.log('🔄 Images inserted inline after query header');
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
        } else {
            console.log('🖼️ No images found in streaming response data');
            console.log('💡 Note: Deep Research with streaming may not support images. Consider using non-streaming mode for image support.');
        }
        
        // Update editor with processed content if any changes were made
        if (contentUpdated) {
            editor.setValue(content);
            console.log('🔄 Editor updated with processed content (think blocks and/or images)');
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
