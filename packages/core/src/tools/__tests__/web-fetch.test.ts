/**
 * Web Fetch Tool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { WebFetchTool } from '../web-fetch.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('WebFetchTool', () => {
  let tool: WebFetchTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;
  
  beforeEach(() => {
    tool = new WebFetchTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();
    mockFetch.mockClear();
  });
  
  describe('Tool Schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_fetch');
    });
    
    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Fetch Web Content');
    });
    
    it('should have url as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('url');
    });
    
    it('should have optional parameters', () => {
      expect(tool.schema.parameters.properties.selector).toBeDefined();
      expect(tool.schema.parameters.properties.maxLength).toBeDefined();
      expect(tool.schema.parameters.properties.timeout).toBeDefined();
    });
    
    it('should warn against using after web_search', () => {
      expect(tool.schema.description).toContain('DO NOT use this after web_search');
    });
  });
  
  describe('execute', () => {
    it('should fetch URL content', async () => {
      const mockContent = '<html><body>Test Content</body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => mockContent,
      });
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe(mockContent);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('OLLM-CLI'),
          }),
        })
      );
    });
    
    it('should handle invalid URL', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'not-a-url' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('InvalidUrlError');
    });
    
    it('should reject non-HTTP protocols', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'ftp://example.com' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('UnsupportedProtocolError');
    });
    
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com/missing' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('HttpError');
      expect(result.error?.message).toContain('404');
    });
    
    it('should truncate content when maxLength specified', async () => {
      const longContent = 'A'.repeat(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => longContent,
      });
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com', maxLength: 100 },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent?.length).toBeLessThan(longContent.length);
      expect(result.llmContent).toContain('[Content truncated');
    });
    
    it('should handle timeout', async () => {
      // Mock fetch to delay longer than timeout and respect abort signal
      mockFetch.mockImplementation((url, options: any) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              text: async () => 'content',
            });
          }, 100);
          
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            });
          }
        });
      });
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com', timeout: 10 },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('TimeoutError');
    });
    
    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      
      mockFetch.mockRejectedValue(
        Object.assign(new Error('Aborted'), { name: 'AbortError' })
      );
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com' },
        context
      );
      const result = await invocation.execute(controller.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });
    
    it('should extract content with CSS selector', async () => {
      const mockHtml = '<html><body><p>Paragraph 1</p><p>Paragraph 2</p></body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      });
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com', selector: 'p' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Paragraph');
    });
    
    it('should not require confirmation', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com' },
        context
      );
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);
      
      expect(confirmation).toBe(false);
    });
    
    it('should call updateOutput callback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'Test content',
      });
      
      const updateOutput = vi.fn();
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { url: 'https://example.com' },
        context
      );
      
      await invocation.execute(abortSignal, updateOutput);
      
      expect(updateOutput).toHaveBeenCalledWith('Test content');
    });
  });
});
