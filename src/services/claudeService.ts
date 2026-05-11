import Anthropic from '@anthropic-ai/sdk';
import { Notice } from 'obsidian';
import type { Editor } from 'obsidian';
import type { PromptsService } from './promptsService';

export interface ClaudeOptions {
    enableThinking?: boolean;
    enableWebSearch?: boolean;
    effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    maxTokens?: number;
}

export interface ClaudeSettings {
    anthropicApiKey: string;
    promptsService?: PromptsService | null;
    headerPosition?: 'top' | 'bottom';
}

interface ClaudeWebCitation {
    url: string;
    title: string;
    citedText: string;
}

const DEFAULT_MAX_TOKENS = 32000;

export class ClaudeService {
    private settings: ClaudeSettings;
    private client: Anthropic | null;

    constructor(settings: ClaudeSettings) {
        this.settings = settings;
        this.client = settings.anthropicApiKey
            ? new Anthropic({
                apiKey: settings.anthropicApiKey,
                dangerouslyAllowBrowser: true,
            })
            : null;
    }

    public updateApiKey(apiKey: string): void {
        this.settings.anthropicApiKey = apiKey;
        this.client = apiKey
            ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
            : null;
    }

    public async queryClaude(
        query: string,
        model: string,
        stream: boolean,
        editor: Editor,
        options?: ClaudeOptions
    ): Promise<void> {
        if (!this.client) {
            new Notice('Claude API key not configured. Set ANTHROPIC_API_KEY in .env or in plugin settings.');
            return;
        }

        const timestamp = new Date().toISOString();
        const cursor = editor.getCursor();
        const processedQuery = query.split('\n').map(line => `> ${line}`).join('\n');

        const headerText = `\n\n***\n> [!info] **Claude Query** (${timestamp})\n> **Question:**\n${processedQuery}\n> \n> **Model:** ${model}\n> \n>`;

        let responseCursor: { line: number; ch: number };
        if (this.settings.headerPosition === 'bottom') {
            responseCursor = { ...cursor };
        } else {
            editor.replaceRange(headerText, cursor, cursor);
            const headerLines = headerText.split('\n');
            const lastLine = headerLines[headerLines.length - 1] ?? '';
            responseCursor = {
                line: cursor.line + headerLines.length - 1,
                ch: lastLine.length,
            };
        }

        const tools: Anthropic.Messages.ToolUnion[] = [];
        if (options?.enableWebSearch !== false) {
            // Use web_search_20250305 (older tool, no dynamic filtering) instead of
            // web_search_20260209. The newer tool's dynamic-filtering pass post-processes
            // search results in a code-execution sandbox, and per-claim
            // web_search_result_location citations don't survive that round-trip — text
            // blocks come back with citations: null. The 20250305 tool reliably attaches
            // per-claim citations to text blocks, which is what gives us inline [N] markers
            // in the rendered prose. Trade-off: more tokens consumed (no result filtering),
            // but traceable per-claim citations are the whole point of this plugin.
            tools.push({ type: 'web_search_20250305', name: 'web_search' });
        }

        const requestParams: Anthropic.Messages.MessageStreamParams = {
            model,
            max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages: [{ role: 'user', content: query }],
            tools,
        };

        if (options?.enableThinking) {
            requestParams.thinking = { type: 'adaptive' };
        }

        if (options?.effort) {
            requestParams.output_config = { effort: options.effort };
        }

        try {
            if (stream) {
                await this.handleStreamingResponse(requestParams, editor, responseCursor, headerText);
            } else {
                await this.handleNonStreamingResponse(requestParams, editor, responseCursor, headerText);
            }
        } catch (error) {
            this.handleError(error, editor);
        }
    }

    private async handleStreamingResponse(
        params: Anthropic.Messages.MessageStreamParams,
        editor: Editor,
        responseCursor: { line: number; ch: number },
        headerText: string
    ): Promise<void> {
        if (!this.client) throw new Error('Claude client not initialized');

        const stream = this.client.messages.stream(params);
        const currentPos = { ...responseCursor };

        stream.on('text', (delta: string) => {
            if (!delta) return;
            editor.replaceRange(delta, currentPos);
            const contentLines = delta.split('\n');
            if (contentLines.length === 1) {
                currentPos.ch += delta.length;
            } else {
                currentPos.line += contentLines.length - 1;
                const last = contentLines[contentLines.length - 1] ?? '';
                currentPos.ch = last.length;
            }
            editor.scrollIntoView({ from: currentPos, to: currentPos }, true);
        });

        const finalMessage = await stream.finalMessage();
        this.afterMessage(finalMessage, editor, headerText);
    }

    private async handleNonStreamingResponse(
        params: Anthropic.Messages.MessageStreamParams,
        editor: Editor,
        responseCursor: { line: number; ch: number },
        headerText: string
    ): Promise<void> {
        if (!this.client) throw new Error('Claude client not initialized');

        // Use stream + finalMessage even for non-streaming UX to avoid SDK HTTP timeouts on long outputs
        const stream = this.client.messages.stream(params);
        const finalMessage = await stream.finalMessage();

        const text = finalMessage.content
            .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
            .map(b => b.text)
            .join('');

        if (text) {
            editor.replaceRange(text, responseCursor);
        }

        this.afterMessage(finalMessage, editor, headerText);
    }

    private afterMessage(
        message: Anthropic.Messages.Message,
        editor: Editor,
        headerText: string
    ): void {
        const citations = this.extractWebCitations(message);
        if (citations.length > 0) {
            this.addCitations(editor, citations);
        }

        if (this.settings.headerPosition === 'bottom' && headerText) {
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange('\n\n' + headerText, endPos);
        }

        const endOfDoc = editor.lastLine();
        const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
        editor.replaceRange('\n\n***\n', endPos);
    }

    /**
     * Walk the message content and collect web-search citations.
     *
     * Two sources, in priority order:
     *   1. `web_search_result_location` citations attached to text blocks — preferred
     *      because they carry `cited_text` (the verbatim quote per Lossless spec).
     *   2. `WebSearchResultBlock` entries inside `web_search_tool_result` blocks —
     *      fallback when Claude returned search results but didn't attach formal
     *      per-claim citations. Gives URL + title only, no cited_text.
     *
     * Dedupe by URL, text-block citations win (they carry the quote).
     */
    private extractWebCitations(message: Anthropic.Messages.Message): ClaudeWebCitation[] {
        const byUrl = new Map<string, ClaudeWebCitation>();

        // Pass 1: collect raw search results as fallback — URL + title only
        for (const block of message.content) {
            if (block.type !== 'web_search_tool_result') continue;
            const content = block.content;
            if (!Array.isArray(content)) continue; // error case
            for (const result of content) {
                if (result.type !== 'web_search_result') continue;
                if (byUrl.has(result.url)) continue;
                byUrl.set(result.url, {
                    url: result.url,
                    title: result.title || 'Source',
                    citedText: '',
                });
            }
        }

        // Pass 2: overwrite with text-block citations (they carry cited_text)
        for (const block of message.content) {
            if (block.type !== 'text') continue;
            const blockCitations = block.citations;
            if (!blockCitations) continue;
            for (const citation of blockCitations) {
                if (citation.type !== 'web_search_result_location') continue;
                byUrl.set(citation.url, {
                    url: citation.url,
                    title: citation.title ?? 'Source',
                    citedText: citation.cited_text ?? '',
                });
            }
        }

        const out = Array.from(byUrl.values());
        const blockTypes = message.content.map(b => b.type);
        const textBlocksWithCitations = message.content
            .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
            .filter(b => b.citations && b.citations.length > 0).length;
        console.debug(
            `[ClaudeService] extractWebCitations — block types: ${JSON.stringify(blockTypes)}; ` +
            `text blocks with citations: ${textBlocksWithCitations}; ` +
            `extracted: ${out.length}`
        );
        return out;
    }

    /**
     * Emit a Citations section per the Lossless Citation Spec — Claude extension.
     * Web-search shape (current focus): standard URL refdef + trailing `> {cited_text}` blockquote.
     * Numeric identifiers used here for consistency with PerplexityService; cite-wide can
     * later promote to hex codes via its hex-substitution pass.
     */
    private addCitations(editor: Editor, citations: ClaudeWebCitation[]): void {
        if (citations.length === 0) return;

        const content = editor.getValue();
        const existingCitationsMatch = content.match(
            /### Citations\n\n([\s\S]*?)(?=\n\n\*\*\*|\n\n### |\n\n## |\n\n# |$)/
        );

        let existingCitations = '';
        let citationNumber = 1;
        if (existingCitationsMatch && existingCitationsMatch[1]) {
            existingCitations = existingCitationsMatch[1];
            const numberedCitations = existingCitations.match(/\[(\d+)\]:/g);
            if (numberedCitations && numberedCitations.length > 0) {
                const maxNumber = Math.max(...numberedCitations.map(n => {
                    const match = n.match(/\d+/);
                    return match ? parseInt(match[0]) : 0;
                }));
                citationNumber = maxNumber + 1;
            }
        }

        let newCitationsText = '';
        citations.forEach((c, index) => {
            // Collapse internal newlines per Lossless spec — refdefs stay single-line for parsers
            const collapsedCitedText = c.citedText.replace(/\s*\n\s*/g, ' ').trim();
            const citedTextSuffix = collapsedCitedText ? ` > ${collapsedCitedText}` : '';
            const safeTitle = c.title.replace(/\]/g, '\\]');
            newCitationsText += `[${citationNumber + index}]: [${safeTitle}](${c.url}).${citedTextSuffix}\n\n`;
        });

        if (existingCitationsMatch) {
            const updatedCitations = existingCitations + newCitationsText;
            const citationsStartIndex = content.indexOf('### Citations');
            const citationsEndIndex =
                citationsStartIndex + '### Citations\n\n'.length + existingCitations.length;
            const beforeCitations = content.substring(
                0,
                citationsStartIndex + '### Citations\n\n'.length
            );
            const afterCitations = content.substring(citationsEndIndex);
            editor.setValue(beforeCitations + updatedCitations + afterCitations);
        } else {
            const citationsText = '\n\n### Citations\n\n' + newCitationsText;
            const endOfDoc = editor.lastLine();
            const endPos = { line: endOfDoc, ch: editor.getLine(endOfDoc).length };
            editor.replaceRange(citationsText, endPos);
        }
    }

    private handleError(error: unknown, editor: Editor): void {
        let userMessage: string;
        if (error instanceof Anthropic.AuthenticationError) {
            userMessage = 'Invalid Anthropic API key';
        } else if (error instanceof Anthropic.RateLimitError) {
            userMessage = 'Claude rate limit exceeded — wait and retry';
        } else if (error instanceof Anthropic.BadRequestError) {
            userMessage = `Claude request invalid: ${error.message}`;
        } else if (error instanceof Anthropic.APIError) {
            userMessage = `Claude API error ${error.status}: ${error.message}`;
        } else if (error instanceof Error) {
            userMessage = `Claude error: ${error.message}`;
        } else {
            userMessage = `Claude error: ${String(error)}`;
        }

        console.error('Claude error:', error);
        new Notice(userMessage);
        editor.replaceRange(
            `\n**Error:** ${userMessage}\n\n***\n`,
            editor.getCursor()
        );
    }
}
