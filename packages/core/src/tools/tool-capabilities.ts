import type { Tool } from './types.js';

/**
 * Tool capabilities that MCP servers can provide
 */
export enum ToolCapability {
  WEB_SEARCH = 'web_search',
  DOCUMENTATION_SEARCH = 'documentation_search',
  CODE_SEARCH = 'code_search',
  FILE_OPERATIONS = 'file_operations',
  API_CALLS = 'api_calls',
  DATABASE_QUERY = 'database_query',
}

/**
 * Mapping of MCP servers to their capabilities
 */
export interface MCPCapabilityMap {
  [serverName: string]: ToolCapability[];
}

/**
 * Detect capabilities from MCP server tools
 */
export function detectServerCapabilities(
  serverName: string,
  tools: Tool[]
): ToolCapability[] {
  const capabilities: ToolCapability[] = [];
  
  // Analyze tool names/descriptions to infer capabilities
  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    const desc = tool.schema.description?.toLowerCase() || '';
    
    // Web Search detection
    if (
      (name.includes('search') || name.includes('query')) &&
      (name.includes('web') || name.includes('google') || name.includes('bing') || name.includes('brave') || desc.includes('web search'))
    ) {
      capabilities.push(ToolCapability.WEB_SEARCH);
    }
    
    // Documentation Search detection
    if (
      (name.includes('search') || name.includes('query') || name.includes('doc')) &&
      (name.includes('doc') || desc.includes('documentation') || desc.includes('api reference'))
    ) {
      capabilities.push(ToolCapability.DOCUMENTATION_SEARCH);
    }
    
    // Code Search detection
    if (
      name.includes('code') && (name.includes('search') || desc.includes('search code'))
    ) {
      capabilities.push(ToolCapability.CODE_SEARCH);
    }

    // File Operations detection
    if (
      (name.includes('file') || name.includes('fs')) &&
      (name.includes('read') || name.includes('write') || name.includes('list') || desc.includes('file system'))
    ) {
      capabilities.push(ToolCapability.FILE_OPERATIONS);
    }
  }
  
  return [...new Set(capabilities)]; // Remove duplicates
}
