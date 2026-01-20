/**
 * Tests for Web Fetch Tool
 *
 * Property 29: Web Fetch Content Retrieval
 * *For any* valid URL, web_fetch should return the page content as text.
 * **Validates: Requirements 6.1**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { WebFetchTool } from '../web-fetch.js';
import type { MessageBus, ToolContext } from '../types.js';

/**
 * Create a mock message bus for testing
 */
function createMockMessageBus(): MessageBus {
  return {
    requestConfirmation: async () => true,
  } as MessageBus;
}

/**
 * Create a ToolContext from a MessageBus for testing
 */
function createToolContext(messageBus: MessageBus): ToolContext {
  return { messageBus };
}

/**
 * Generate valid URL paths for testing
 */
const validPathArbitrary = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '_', '/'
  ),
  { minLength: 1, maxLength: 20 }
);

/**
 * Generate valid domain names for testing
 */
const validDomainArbitrary = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ),
  { minLength: 3, maxLength: 15 }
).map(s => s.toLowerCase());

describe('Web Fetch Tool', () => {
  let webFetchTool: WebFetchTool;
  let messageBus: MessageBus;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    messageBus = createMockMessageBus();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Property 29: Web Fetch Content Retrieval', () => {
    it('should return page content as text for any valid URL', async () => {
      // Feature: stage-03-tools-policy, Property 29: Web Fetch Content Retrieval
      // **Validates: Requirements 6.1**
      await fc.assert(
        fc.asyncProperty(
          // Generate random content that will be returned by the mock fetch
          fc.string({ minLength: 1, maxLength: 1000 }),
          // Generate valid domain names
          validDomainArbitrary,
          // Generate valid paths
          validPathArbitrary,
          async (content, domain, path) => {
            // Mock fetch to return the generated content
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const url = `https://${domain}.example.com/${path}`;
            const invocation = webFetchTool.createInvocation(
              { url },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify ToolResult structure
            expect(result).toBeDefined();
            expect(result).toHaveProperty('llmContent');
            expect(result).toHaveProperty('returnDisplay');

            // For successful fetches, llmContent should contain the content
            expect(result.error).toBeUndefined();
            expect(result.llmContent).toBe(content);
            expect(typeof result.returnDisplay).toBe('string');

            // Verify fetch was called with the correct URL
            expect(global.fetch).toHaveBeenCalledWith(
              url,
              expect.objectContaining({
                signal: expect.any(AbortSignal),
              })
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return content as string type for all valid responses', async () => {
      // Feature: stage-03-tools-policy, Property 29: Web Fetch Content Retrieval
      // **Validates: Requirements 6.1**
      await fc.assert(
        fc.asyncProperty(
          // Generate various types of content
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 500 }),
            fc.constant('<html><body>Hello World</body></html>'),
            fc.constant('{"key": "value"}'),
            fc.constant('plain text content'),
            fc.constant('')
          ),
          async (content) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Content should always be a string
            expect(typeof result.llmContent).toBe('string');
            expect(result.llmContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various HTTP success status codes', async () => {
      // Feature: stage-03-tools-policy, Property 29: Web Fetch Content Retrieval
      // **Validates: Requirements 6.1**
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(200, 201, 202, 203, 204),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (statusCode, content) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: statusCode,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should return content without error for success status codes
            expect(result.error).toBeUndefined();
            expect(result.llmContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve content exactly as received', async () => {
      // Feature: stage-03-tools-policy, Property 29: Web Fetch Content Retrieval
      // **Validates: Requirements 6.1**
      await fc.assert(
        fc.asyncProperty(
          // Generate content with special characters
          fc.string({ minLength: 1, maxLength: 500 }),
          async (content) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Content should be preserved exactly
            expect(result.llmContent).toBe(content);
            expect(result.llmContent.length).toBe(content.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include character count in returnDisplay', async () => {
      // Feature: stage-03-tools-policy, Property 29: Web Fetch Content Retrieval
      // **Validates: Requirements 6.1**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (content) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // returnDisplay should mention the character count
            expect(result.returnDisplay).toContain(String(content.length));
            expect(result.returnDisplay).toContain('characters');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Web Fetch Tool Invocation Interface', () => {
    it('should provide a description of the fetch operation', () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'https://example.com/test' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();

      expect(description).toBeDefined();
      expect(description).toContain('https://example.com/test');
    });

    it('should include selector in description when provided', () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'https://example.com/test', selector: 'div.content' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();

      expect(description).toContain('https://example.com/test');
      expect(description).toContain('div.content');
    });

    it('should return URL as tool location', () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'https://example.com/test' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();

      expect(locations).toBeDefined();
      expect(locations).toContain('https://example.com/test');
    });

    it('should not require confirmation by default', async () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'https://example.com/test' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const confirmationDetails = await invocation.shouldConfirmExecute(
        abortController.signal
      );

      expect(confirmationDetails).toBe(false);
    });
  });

  describe('Property 30: Web Fetch CSS Selector', () => {
    /**
     * Property 30: Web Fetch CSS Selector
     * *For any* URL and CSS selector, web_fetch with the selector should return only content matching that selector.
     * **Validates: Requirements 6.2**
     */

    /**
     * Generate valid HTML tag names for testing
     */
    const validTagArbitrary = fc.constantFrom(
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'article', 'section', 'main', 'header', 'footer'
    );

    /**
     * Generate simple text content (no HTML special chars)
     */
    const simpleTextArbitrary = fc.stringOf(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        ' ', '.', ',', '!', '?'
      ),
      { minLength: 1, maxLength: 50 }
    );

    it('should extract content from matching tags when selector is a tag name', async () => {
      // Feature: stage-03-tools-policy, Property 30: Web Fetch CSS Selector
      // **Validates: Requirements 6.2**
      await fc.assert(
        fc.asyncProperty(
          validTagArbitrary,
          simpleTextArbitrary,
          async (tag, innerContent) => {
            // Create HTML with the target tag containing the content
            const html = `<html><body><${tag}>${innerContent}</${tag}></body></html>`;

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => html,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', selector: tag },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // The extracted content should contain the inner text (trimmed)
            const trimmedContent = innerContent.trim();
            if (trimmedContent.length > 0) {
              expect(result.llmContent).toContain(trimmedContent);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract multiple matching elements and join them', async () => {
      // Feature: stage-03-tools-policy, Property 30: Web Fetch CSS Selector
      // **Validates: Requirements 6.2**
      await fc.assert(
        fc.asyncProperty(
          validTagArbitrary,
          fc.array(simpleTextArbitrary, { minLength: 2, maxLength: 5 }),
          async (tag, contents) => {
            // Create HTML with multiple instances of the target tag
            const tagElements = contents.map(c => `<${tag}>${c}</${tag}>`).join('');
            const html = `<html><body>${tagElements}</body></html>`;

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => html,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', selector: tag },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Each content piece (trimmed) should appear in the result
            for (const content of contents) {
              const trimmed = content.trim();
              if (trimmed.length > 0) {
                expect(result.llmContent).toContain(trimmed);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return original HTML when selector does not match any elements', async () => {
      // Feature: stage-03-tools-policy, Property 30: Web Fetch CSS Selector
      // **Validates: Requirements 6.2**
      await fc.assert(
        fc.asyncProperty(
          simpleTextArbitrary,
          async (content) => {
            // Create HTML without the target tag
            const html = `<html><body><span>${content}</span></body></html>`;

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => html,
            });

            // Use a tag that doesn't exist in the HTML
            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', selector: 'article' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // When no match, should return original HTML
            expect(result.llmContent).toBe(html);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should strip nested HTML tags from extracted content', async () => {
      // Feature: stage-03-tools-policy, Property 30: Web Fetch CSS Selector
      // **Validates: Requirements 6.2**
      await fc.assert(
        fc.asyncProperty(
          validTagArbitrary,
          simpleTextArbitrary,
          async (outerTag, textContent) => {
            // Create HTML with nested tags inside the target
            const html = `<html><body><${outerTag}><span><b>${textContent}</b></span></${outerTag}></body></html>`;

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => html,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', selector: outerTag },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // The result should contain the text content without HTML tags
            const trimmed = textContent.trim();
            if (trimmed.length > 0) {
              expect(result.llmContent).toContain(trimmed);
            }

            // The result should NOT contain HTML tag markers
            expect(result.llmContent).not.toContain('<span>');
            expect(result.llmContent).not.toContain('<b>');
            expect(result.llmContent).not.toContain('</span>');
            expect(result.llmContent).not.toContain('</b>');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include selector in description when provided', () => {
      // Feature: stage-03-tools-policy, Property 30: Web Fetch CSS Selector
      // **Validates: Requirements 6.2**
      const invocation = webFetchTool.createInvocation(
        { url: 'https://example.com/test', selector: 'div.content' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();

      expect(description).toContain('https://example.com/test');
      expect(description).toContain('div.content');
    });
  });

  describe('Property 31: Web Fetch Truncation', () => {
    /**
     * Property 31: Web Fetch Truncation
     * *For any* web content exceeding maxLength, web_fetch should truncate the output at maxLength and append a truncation indicator.
     * **Validates: Requirements 6.3**
     */

    it('should truncate content exceeding maxLength and append truncation indicator', async () => {
      // Feature: stage-03-tools-policy, Property 31: Web Fetch Truncation
      // **Validates: Requirements 6.3**
      await fc.assert(
        fc.asyncProperty(
          // Generate content length that will exceed maxLength
          fc.integer({ min: 100, max: 5000 }),
          // Generate maxLength that is less than content length
          fc.integer({ min: 50, max: 99 }),
          async (contentLength, maxLength) => {
            // Generate content of the specified length
            const content = 'x'.repeat(contentLength);

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', maxLength },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should be truncated
            // The truncated content starts with maxLength characters
            expect(result.llmContent.startsWith(content.slice(0, maxLength))).toBe(true);

            // Should contain truncation indicator
            expect(result.llmContent).toContain('[Content truncated:');
            expect(result.llmContent).toContain('characters omitted]');

            // The omitted count should be correct
            const omitted = contentLength - maxLength;
            expect(result.llmContent).toContain(`${omitted} characters omitted`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not truncate content within maxLength', async () => {
      // Feature: stage-03-tools-policy, Property 31: Web Fetch Truncation
      // **Validates: Requirements 6.3**
      await fc.assert(
        fc.asyncProperty(
          // Generate content length
          fc.integer({ min: 1, max: 100 }),
          // Generate maxLength that is greater than or equal to content length
          fc.integer({ min: 100, max: 500 }),
          async (contentLength, maxLength) => {
            const content = 'y'.repeat(contentLength);

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', maxLength },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should NOT be truncated
            expect(result.llmContent).toBe(content);

            // Should NOT contain truncation indicator
            expect(result.llmContent).not.toContain('[Content truncated:');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate at exact maxLength boundary', async () => {
      // Feature: stage-03-tools-policy, Property 31: Web Fetch Truncation
      // **Validates: Requirements 6.3**
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 1000 }),
          async (maxLength) => {
            // Content is exactly maxLength + some extra
            const extraChars = 50;
            const content = 'z'.repeat(maxLength + extraChars);

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', maxLength },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // The first maxLength characters should be preserved exactly
            const truncatedPart = result.llmContent.split('\n\n[Content truncated:')[0];
            expect(truncatedPart).toBe(content.slice(0, maxLength));

            // Should indicate exactly extraChars were omitted
            expect(result.llmContent).toContain(`${extraChars} characters omitted`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle content exactly at maxLength without truncation', async () => {
      // Feature: stage-03-tools-policy, Property 31: Web Fetch Truncation
      // **Validates: Requirements 6.3**
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 500 }),
          async (length) => {
            // Content is exactly maxLength
            const content = 'a'.repeat(length);

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test', maxLength: length },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should be exactly the same (no truncation needed)
            expect(result.llmContent).toBe(content);

            // Should NOT contain truncation indicator
            expect(result.llmContent).not.toContain('[Content truncated:');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not truncate when maxLength is not specified', async () => {
      // Feature: stage-03-tools-policy, Property 31: Web Fetch Truncation
      // **Validates: Requirements 6.3**
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }),
          async (contentLength) => {
            const content = 'b'.repeat(contentLength);

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => content,
            });

            // No maxLength specified
            const invocation = webFetchTool.createInvocation(
              { url: 'https://example.com/test' },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should be returned in full
            expect(result.llmContent).toBe(content);

            // Should NOT contain truncation indicator
            expect(result.llmContent).not.toContain('[Content truncated:');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL Validation', () => {
    it('should return error for invalid URLs', async () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'not-a-valid-url' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('InvalidUrlError');
    });

    it('should return error for unsupported protocols', async () => {
      const invocation = webFetchTool.createInvocation(
        { url: 'ftp://example.com/file' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('UnsupportedProtocolError');
    });

    it('should accept http and https protocols', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('http', 'https'),
          async (protocol) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              statusText: 'OK',
              text: async () => 'content',
            });

            const invocation = webFetchTool.createInvocation(
              { url: `${protocol}://example.com/test` },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have protocol error
            expect(result.error?.type).not.toBe('UnsupportedProtocolError');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Web Error Handling', () => {
    /**
     * Unit tests for web error handling
     * **Validates: Requirements 6.4, 6.5, 6.8**
     */

    describe('404 Errors (Requirement 6.4)', () => {
      it('should return HttpError with 404 status for non-existent URLs', async () => {
        // Mock fetch to return 404
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Page not found',
        });

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/nonexistent-page' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('HttpError');
        expect(result.error?.message).toContain('404');
        expect(result.error?.message).toContain('Not Found');
        expect(result.llmContent).toBe('');
        expect(result.returnDisplay).toBe('');
      });

      it('should handle various 4xx client error status codes', async () => {
        const clientErrors = [
          { status: 400, statusText: 'Bad Request' },
          { status: 401, statusText: 'Unauthorized' },
          { status: 403, statusText: 'Forbidden' },
          { status: 404, statusText: 'Not Found' },
          { status: 405, statusText: 'Method Not Allowed' },
          { status: 410, statusText: 'Gone' },
          { status: 429, statusText: 'Too Many Requests' },
        ];

        for (const { status, statusText } of clientErrors) {
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status,
            statusText,
            text: async () => 'Error page content',
          });

          const invocation = webFetchTool.createInvocation(
            { url: 'https://example.com/test' },
            createToolContext(messageBus)
          );

          const abortController = new AbortController();
          const result = await invocation.execute(abortController.signal);

          expect(result.error).toBeDefined();
          expect(result.error?.type).toBe('HttpError');
          expect(result.error?.message).toContain(String(status));
          expect(result.error?.message).toContain(statusText);
        }
      });

      it('should handle 5xx server error status codes', async () => {
        const serverErrors = [
          { status: 500, statusText: 'Internal Server Error' },
          { status: 502, statusText: 'Bad Gateway' },
          { status: 503, statusText: 'Service Unavailable' },
          { status: 504, statusText: 'Gateway Timeout' },
        ];

        for (const { status, statusText } of serverErrors) {
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status,
            statusText,
            text: async () => 'Server error',
          });

          const invocation = webFetchTool.createInvocation(
            { url: 'https://example.com/test' },
            createToolContext(messageBus)
          );

          const abortController = new AbortController();
          const result = await invocation.execute(abortController.signal);

          expect(result.error).toBeDefined();
          expect(result.error?.type).toBe('HttpError');
          expect(result.error?.message).toContain(String(status));
        }
      });
    });

    describe('Timeout Errors (Requirement 6.5)', () => {
      it('should return TimeoutError when request exceeds timeout', async () => {
        // Mock fetch to simulate timeout by throwing AbortError
        global.fetch = vi.fn().mockImplementation(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/slow-page', timeout: 100 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('TimeoutError');
        expect(result.error?.message).toContain('timed out');
        expect(result.error?.message).toContain('100ms');
        expect(result.llmContent).toBe('');
        expect(result.returnDisplay).toBe('');
      });

      it('should use default timeout of 30000ms when not specified', async () => {
        // Mock fetch to simulate timeout
        global.fetch = vi.fn().mockImplementation(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/slow-page' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('TimeoutError');
        expect(result.error?.message).toContain('30000ms');
      });

      it('should return CancelledError when user aborts the request', async () => {
        // Create an already-aborted signal
        const abortController = new AbortController();
        abortController.abort();

        // Mock fetch to throw AbortError
        global.fetch = vi.fn().mockImplementation(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('CancelledError');
        expect(result.error?.message).toContain('cancelled');
      });

      it('should distinguish between user cancellation and timeout', async () => {
        // Test 1: User cancellation (signal already aborted)
        const userAbortController = new AbortController();
        userAbortController.abort();

        global.fetch = vi.fn().mockImplementation(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

        const invocation1 = webFetchTool.createInvocation(
          { url: 'https://example.com/test', timeout: 5000 },
          createToolContext(messageBus)
        );

        const result1 = await invocation1.execute(userAbortController.signal);
        expect(result1.error?.type).toBe('CancelledError');

        // Test 2: Timeout (signal not aborted, but fetch times out)
        const timeoutController = new AbortController();

        const invocation2 = webFetchTool.createInvocation(
          { url: 'https://example.com/test', timeout: 100 },
          createToolContext(messageBus)
        );

        const result2 = await invocation2.execute(timeoutController.signal);
        expect(result2.error?.type).toBe('TimeoutError');
      });
    });

    describe('Network Errors (Requirement 6.8)', () => {
      it('should handle DNS resolution failures gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('getaddrinfo ENOTFOUND nonexistent.invalid')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://nonexistent.invalid/page' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toContain('ENOTFOUND');
        expect(result.llmContent).toBe('');
        expect(result.returnDisplay).toBe('');
      });

      it('should handle connection refused errors gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('connect ECONNREFUSED 127.0.0.1:8080')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://localhost:8080/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toContain('ECONNREFUSED');
      });

      it('should handle connection reset errors gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('read ECONNRESET')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toContain('ECONNRESET');
      });

      it('should handle SSL/TLS certificate errors gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('unable to verify the first certificate')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://self-signed.example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toContain('certificate');
      });

      it('should handle network unreachable errors gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('Network is unreachable')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toContain('unreachable');
      });

      it('should handle unknown errors gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(
          new Error('Some unexpected error occurred')
        );

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        expect(result.error?.message).toBe('Some unexpected error occurred');
      });

      it('should handle errors without message gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error());

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
        // Should have some message even if original error had none
        expect(typeof result.error?.message).toBe('string');
      });

      it('should handle non-Error objects thrown gracefully', async () => {
        global.fetch = vi.fn().mockRejectedValue('string error');

        const invocation = webFetchTool.createInvocation(
          { url: 'https://example.com/test' },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('FetchError');
      });
    });
  });
});
