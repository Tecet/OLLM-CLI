/**
 * MCP (Model Context Protocol) management commands
 * 
 * Provides CLI commands for MCP server management, OAuth authentication,
 * and tool/resource/prompt discovery.
 */

import type { CommandHandler, CommandContext } from './types.js';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp';

/**
 * MCP list command
 * 
 * Usage: /mcp list [--tools|--resources|--prompts]
 */
export const mcpListCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const mcpClient = context.mcpClient as MCPClient;

  if (!mcpClient) {
    return {
      success: false,
      message: 'MCP client not available',
    };
  }

  const showTools = context.flags?.tools || !context.flags?.resources && !context.flags?.prompts;
  const showResources = context.flags?.resources;
  const showPrompts = context.flags?.prompts;

  try {
    const servers = mcpClient.listServers();

    if (servers.length === 0) {
      return {
        success: true,
        message: 'No MCP servers configured',
      };
    }

    const output: string[] = [`${servers.length} MCP server(s):\n`];

    for (const server of servers) {
      const status = server.status.status;
      const statusIcon = status === 'connected' ? '✓' : status === 'error' ? '✗' : '○';
      
      output.push(`[${statusIcon}] ${server.name} (${status})`);

      if (server.status.error) {
        output.push(`    Error: ${server.status.error}`);
      }

      if (status === 'connected') {
        if (showTools) {
          const tools = await mcpClient.getTools(server.name);
          output.push(`    Tools: ${tools.length}`);
            tools.forEach((tool: any) => {
              output.push(`      - ${tool.name}: ${tool.description}`);
            });
        }

        if (showResources && mcpClient.getResources) {
          const resources = await mcpClient.getResources(server.name);
          output.push(`    Resources: ${resources.length}`);
            resources.forEach((resource: any) => {
              output.push(`      - ${resource.name} (${resource.uri})`);
            });
        }

        if (showPrompts && mcpClient.getPrompts) {
          const prompts = await mcpClient.getPrompts(server.name);
          output.push(`    Prompts: ${prompts.length}`);
            prompts.forEach((prompt: any) => {
              output.push(`      - ${prompt.name}: ${prompt.description || 'No description'}`);
            });
        }
      }

      output.push('');
    }

    return {
      success: true,
      message: output.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list MCP servers: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * MCP auth status command
 * 
 * Usage: /mcp auth status <server>
 */
export const mcpAuthStatusCommand: CommandHandler = async (
  args: string[],
  _context: CommandContext
) => {
  const serverName = args[0];

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp auth status <server>',
    };
  }

  // TODO: Implement OAuth status checking
  // This requires storing OAuth providers in context
  
  return {
    success: false,
    message: 'OAuth status checking not yet implemented',
  };
};

/**
 * MCP auth revoke command
 * 
 * Usage: /mcp auth revoke <server>
 */
export const mcpAuthRevokeCommand: CommandHandler = async (
  args: string[],
  _context: CommandContext
) => {
  const serverName = args[0];

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp auth revoke <server>',
    };
  }

  // TODO: Implement OAuth token revocation
  // This requires storing OAuth providers in context
  
  return {
    success: false,
    message: 'OAuth token revocation not yet implemented',
  };
};

/**
 * MCP auth refresh command
 * 
 * Usage: /mcp auth refresh <server>
 */
export const mcpAuthRefreshCommand: CommandHandler = async (
  args: string[],
  _context: CommandContext
) => {
  const serverName = args[0];

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp auth refresh <server>',
    };
  }

  // TODO: Implement OAuth token refresh
  // This requires storing OAuth providers in context
  
  return {
    success: false,
    message: 'OAuth token refresh not yet implemented',
  };
};

/**
 * MCP tools command
 * 
 * Usage: /mcp tools <server>
 */
export const mcpToolsCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const mcpClient = context.mcpClient as MCPClient;
  const serverName = args[0];

  if (!mcpClient) {
    return {
      success: false,
      message: 'MCP client not available',
    };
  }

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp tools <server>',
    };
  }

  try {
    const tools = await mcpClient.getTools(serverName);

    if (tools.length === 0) {
      return {
        success: true,
        message: `No tools available from server '${serverName}'`,
      };
    }

    const output = [
      `${tools.length} tool(s) from '${serverName}':\n`,
      ...tools.map((tool: any, index: number) => {
        return [
          `${index + 1}. ${tool.name}`,
          `   ${tool.description}`,
          `   Input schema: ${JSON.stringify(tool.inputSchema, null, 2).split('\n').join('\n   ')}`,
          '',
        ].join('\n');
      }),
    ].join('\n');
    return {
      success: true,
      message: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get tools: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * MCP resources command
 * 
 * Usage: /mcp resources <server>
 */
export const mcpResourcesCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const mcpClient = context.mcpClient as MCPClient;
  const serverName = args[0];

  if (!mcpClient || !mcpClient.getResources) {
    return {
      success: false,
      message: 'MCP resources not available',
    };
  }

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp resources <server>',
    };
  }

  try {
    const resources = await mcpClient.getResources(serverName);

    if (resources.length === 0) {
      return {
        success: true,
        message: `No resources available from server '${serverName}'`,
      };
    }

    const output = [
      `${resources.length} resource(s) from '${serverName}':\n`,
      ...resources.map((resource: any, index: number) => {
        return [
          `${index + 1}. ${resource.name}`,
          `   URI: ${resource.uri}`,
          `   ${resource.description || 'No description'}`,
          resource.mimeType ? `   Type: ${resource.mimeType}` : '',
          '',
        ].filter(Boolean).join('\n');
      }),
    ].join('\n');

    return {
      success: true,
      message: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get resources: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * MCP prompts command
 * 
 * Usage: /mcp prompts <server>
 */
export const mcpPromptsCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const mcpClient = context.mcpClient as MCPClient;
  const serverName = args[0];

  if (!mcpClient || !mcpClient.getPrompts) {
    return {
      success: false,
      message: 'MCP prompts not available',
    };
  }

  if (!serverName) {
    return {
      success: false,
      message: 'Usage: /mcp prompts <server>',
    };
  }

  try {
    const prompts = await mcpClient.getPrompts(serverName);

    if (prompts.length === 0) {
      return {
        success: true,
        message: `No prompts available from server '${serverName}'`,
      };
    }

    const output = [
      `${prompts.length} prompt(s) from '${serverName}':\n`,
      ...prompts.map((prompt: any, index: number) => {
        const args = prompt.arguments || [];
        return [
          `${index + 1}. ${prompt.name}`,
          `   ${prompt.description || 'No description'}`,
          args.length > 0 ? `   Arguments:` : '',
          ...args.map((arg: any) => `     - ${arg.name}${arg.required ? ' (required)' : ''}: ${arg.description || 'No description'}`),
          '',
        ].filter(Boolean).join('\n');
      }),
    ].join('\n');

    return {
      success: true,
      message: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get prompts: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * MCP status command
 * 
 * Usage: /mcp status [server]
 */
export const mcpStatusCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const mcpClient = context.mcpClient as MCPClient;

  if (!mcpClient) {
    return {
      success: false,
      message: 'MCP client not available',
    };
  }

  const serverName = args[0];

  try {
    if (serverName) {
      // Show status for specific server
      const status = mcpClient.getServerStatus(serverName);
      
      const output = [
        `Server: ${status.name}`,
        `Status: ${status.status}`,
        status.error ? `Error: ${status.error}` : '',
        `Tools: ${status.tools}`,
      ].filter(Boolean).join('\n');

      return {
        success: true,
        message: output,
      };
    } else {
      // Show status for all servers
      const servers = mcpClient.listServers();

      if (servers.length === 0) {
        return {
          success: true,
          message: 'No MCP servers configured',
        };
      }

      const output = [
        `${servers.length} MCP server(s):\n`,
        ...servers.map((server: any) => {
          const statusIcon = server.status.status === 'connected' ? '✓' 
            : server.status.status === 'error' ? '✗' 
            : '○';
          return `[${statusIcon}] ${server.name}: ${server.status.status} (${server.status.tools} tools)`;
        }),
      ].join('\n');

      return {
        success: true,
        message: output,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
