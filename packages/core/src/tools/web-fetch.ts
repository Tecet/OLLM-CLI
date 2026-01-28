/**
 * Web Fetch Tool
 *
 * Fetches content from URLs with optional CSS selector extraction and truncation.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolContext,
  ToolSchema,
} from './types.js';

export interface WebFetchParams {
  url: string;
  selector?: string;
  maxLength?: number;
  timeout?: number;
}

export class WebFetchTool implements DeclarativeTool<WebFetchParams, ToolResult> {
  name = 'web_fetch';
  displayName = 'Fetch Web Content';
  schema: ToolSchema = {
    name: 'web_fetch',
    description:
      'Fetch and read content from a specific URL. ONLY use this when: 1) The user explicitly asks you to read/fetch a specific webpage, OR 2) You need detailed content from a URL. DO NOT use this after web_search - the search results already contain the information you need.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch content from' },
        selector: { type: 'string', description: 'CSS selector to extract specific content' },
        maxLength: { type: 'number', description: 'Maximum content length before truncation' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
      },
      required: ['url'],
    },
  };

  createInvocation(
    params: WebFetchParams,
    _context: ToolContext
  ): ToolInvocation<WebFetchParams, ToolResult> {
    return new WebFetchInvocation(params);
  }
}
export class WebFetchInvocation implements ToolInvocation<WebFetchParams, ToolResult> {
  constructor(public params: WebFetchParams) {}

  getDescription(): string {
    const selectorPart = this.params.selector ? ` (selector: ${this.params.selector})` : '';
    return `Fetch ${this.params.url}${selectorPart}`;
  }

  toolLocations(): string[] {
    return [this.params.url];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    const timeout = this.params.timeout ?? 30000;

    try {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(this.params.url);
      } catch {
        return {
          llmContent: '',
          returnDisplay: '',
          error: { message: `Invalid URL: ${this.params.url}`, type: 'InvalidUrlError' },
        };
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `Unsupported protocol: ${parsedUrl.protocol}`,
            type: 'UnsupportedProtocolError',
          },
        };
      }

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
      const combinedSignal = this.combineAbortSignals(signal, timeoutController.signal);

      try {
        const response = await fetch(this.params.url, {
          signal: combinedSignal,
          headers: {
            'User-Agent': 'OLLM-CLI/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `HTTP ${response.status}: ${response.statusText}`,
              type: 'HttpError',
            },
          };
        }

        let content = await response.text();

        if (this.params.selector) {
          content = this.extractWithSelector(content, this.params.selector);
        }

        const originalLength = content.length;

        if (this.params.maxLength && content.length > this.params.maxLength) {
          content = content.slice(0, this.params.maxLength);
          const omitted = originalLength - this.params.maxLength;
          content += `\n\n[Content truncated: ${omitted} characters omitted]`;
        }

        if (updateOutput) {
          updateOutput(content);
        }

        return {
          llmContent: content,
          returnDisplay: `Fetched ${originalLength} characters from ${this.params.url}`,
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if ((fetchError as Error).name === 'AbortError') {
          if (signal.aborted) {
            return {
              llmContent: '',
              returnDisplay: '',
              error: { message: 'Fetch cancelled', type: 'CancelledError' },
            };
          }
          return {
            llmContent: '',
            returnDisplay: '',
            error: { message: `Request timed out after ${timeout}ms`, type: 'TimeoutError' },
          };
        }

        throw fetchError;
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error';
      return {
        llmContent: '',
        returnDisplay: '',
        error: { message: errorMessage, type: 'FetchError' },
      };
    }
  }

  private extractWithSelector(html: string, selector: string): string {
    const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.push(match[1].replace(/<[^>]*>/g, '').trim());
      }
      if (matches.length > 0) {
        return matches.join('\n\n');
      }
    }
    return html;
  }

  private combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }
}
