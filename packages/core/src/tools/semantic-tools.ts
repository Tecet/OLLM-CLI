import type { Tool, ToolInvocation, ToolResult, ToolCallConfirmationDetails, ToolContext, ToolSchema, DeclarativeTool } from './types.js';
import type { ToolRouter } from './toolRouter.js';
import { ToolCapability } from './tool-capabilities.js';
import { WebSearchTool, type SearchProvider, type SearchResult } from './web-search.js';

export class MCPSearchProvider implements SearchProvider {
  constructor(private router: ToolRouter, private capability: ToolCapability.WEB_SEARCH | ToolCapability.DOCUMENTATION_SEARCH) {}

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    const serverName = this.router.findServerForCapability(this.capability);
    
    if (!serverName) {
      // If fallback is disabled or no server found, return empty or throw?
      // For web search, maybe empty is safer, but for explicit doc search, throwing might be better.
      // Let's throw to indicate missing capability.
      throw new Error(`No MCP server available for ${this.capability}. Please enable a compatible extension.`);
    }

    // Get client from router (we need access to client, but router has it private)
    // We might need to expose client from Router or pass it to Provider.
    // Router should probably facilitate the call to avoid exposing client details.
    
    // REFACTOR: ToolRouter should probably have a method `callCapabilityTool`?
    // Or we modify ToolRouter to expose client. 
    // Let's assume we can access mcpClient from the context passed to execute? 
    // But SearchProvider.search doesn't take context.
    
    // We need to access mcpClient. 
    // Let's assume ToolRouter exposes mcpClient or a method to get it.
    // For now, I will cast to unknown or fix ToolRouter to expose it.
    // Better: update ToolRouter to have a public getter or execution method.
    
    // Let's fix ToolRouter in next step if needed. 
    // Assuming we can get client from router property (making it public or using getter).
    const client = (this.router as unknown as { mcpClient: unknown }).mcpClient; 
    
    const tools = await (client as { getTools: (serverName: string) => Promise<Array<{ name: string }>> }).getTools(serverName);
    const searchTool = tools.find((t: { name: string }) => 
      t.name.toLowerCase().includes('search') || 
      t.name.toLowerCase().includes('query')
    );

    if (!searchTool) {
      throw new Error(`Server ${serverName} does not have a search tool`);
    }

    try {
      const result = await (client as { callTool: (serverName: string, toolName: string, params: Record<string, unknown>) => Promise<unknown> }).callTool(
        serverName,
        searchTool.name,
        { query, numResults, max_results: numResults, limit: numResults } // Try common parameter names
      );

      // Adapt result to SearchResult[]
      // MCP result is unknown. It might be string or object.
      // We need flexible parsing.
      return this.parseResults(result);
    } catch (error) {
      console.error('MCP Search failed:', error);
      throw error;
    }
  }

  private parseResults(result: unknown): SearchResult[] {
    // If result is string (e.g. from Brave), try to parse if JSON, or wrap as single result
    // If result is object with content array (MCP standard result)
    
    let content: unknown = result;
    if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
       // Extract text content
       content = result.content.map((c: { text?: string }) => c.text).join('\n\n');
    } else if (result && typeof result === 'object' && 'result' in result) {
        // Some tools wrapper result in { result: ... }
        content = (result as { result: unknown }).result;
    }

    if (Array.isArray(content)) {
        // Already array? map to SearchResult
        return content.map((item: unknown) => ({
            title: (item as { title?: string }).title || 'Result',
            url: (item as { url?: string }).url || '',
            snippet: (item as { snippet?: string; description?: string }).snippet || (item as { snippet?: string; description?: string }).description || JSON.stringify(item)
        }));
    }

    if (typeof content === 'string') {
        try {
            const parsed: unknown = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.map((item: unknown) => ({
                    title: (item as { title?: string }).title || 'Result',
                    url: (item as { url?: string }).url || '',
                    snippet: (item as { snippet?: string; description?: string }).snippet || (item as { snippet?: string; description?: string }).description || JSON.stringify(item)
                }));
            }
        } catch {
            // Not JSON, return as single snippet
            return [{
                title: 'Search Result',
                url: '',
                snippet: content
            }];
        }
    }
    
    return [{
        title: 'Unknown Result',
        url: '',
        snippet: JSON.stringify(result)
    }];
  }
}

export interface DocumentationSearchParams {
  query: string;
}

export class DocumentationSearchTool implements DeclarativeTool<DocumentationSearchParams, ToolResult> {
  name = 'search_documentation';
  displayName = 'Search Documentation';
  schema: ToolSchema = {
    name: 'search_documentation',
    description: 'Search technical documentation and API references',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Documentation query' },
      },
      required: ['query'],
    },
  };

  constructor(private router: ToolRouter) {}

  createInvocation(
    params: DocumentationSearchParams,
    _context: ToolContext
  ): ToolInvocation<DocumentationSearchParams, ToolResult> {
    return new DocSearchInvocation(params, this.router);
  }
}

class DocSearchInvocation implements ToolInvocation<DocumentationSearchParams, ToolResult> {
  constructor(public params: DocumentationSearchParams, private router: ToolRouter) {}

  getDescription(): string {
    return `Searching documentation for: ${this.params.query}`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    if (signal.aborted) {
      return { llmContent: '', returnDisplay: '', error: { message: 'Cancelled', type: 'CancelledError' } };
    }

    const provider = new MCPSearchProvider(this.router, ToolCapability.DOCUMENTATION_SEARCH);
    try {
      const results = await provider.search(this.params.query, 5);
      
      const formatted = results.map(r => `### ${r.title}\n${r.url ? `Source: ${r.url}\n` : ''}${r.snippet}`).join('\n\n');
      
      return {
        llmContent: formatted,
        returnDisplay: `Found ${results.length} documentation results`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: { message: (error as Error).message, type: 'MCPError' }
      };
    }
  }
}

export function createSemanticTools(router: ToolRouter): Tool[] {
    // 1. Web Search
    const webSearchProvider = new MCPSearchProvider(router, ToolCapability.WEB_SEARCH);
    const webSearchTool = new WebSearchTool(webSearchProvider);

    // 2. Documentation Search
    const docSearchTool = new DocumentationSearchTool(router);

    // Return as array of tools (DeclarativeTool implements Tool interface via properties)
    // But Typescript might be strict about interface matching.
    // DeclarativeTool is slightly different from Tool interface? 
    // Tool interface in types.ts usually has execute() method directly?
    // Let's check types.ts.
    
    // Existing tools use `DeclarativeTool`.
    // If the system expects `Tool` objects, we might need to wrap them?
    // Or does the system support DeclarativeTool?
    // extensionManager.ts registers wrapped tools. 
    
    // Let's assume we return DeclarativeTool instances and the consumer (Mode/Context) handles them.
    return [webSearchTool as Tool, docSearchTool as Tool];
}
