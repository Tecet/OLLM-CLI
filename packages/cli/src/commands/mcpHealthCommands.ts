/**
 * MCP Health Monitoring commands
 * 
 * Provides commands for:
 * - Checking MCP server health
 * - Viewing health history
 * - Manually restarting servers
 * - Configuring health monitoring
 */

import type { Command, CommandResult } from './types.js';
import type { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp/types.js';

/**
 * Create MCP health monitoring commands with dependency injection
 */
export function createMCPHealthCommands(
  healthMonitor: MCPHealthMonitor,
  mcpClient: MCPClient
): Command[] {
  return [
    // Check health of all servers
    {
      name: 'mcp health',
      aliases: ['mcp health check', 'mcp status'],
      description: 'Check health status of all MCP servers',
      usage: '/mcp health',
      handler: async (): Promise<CommandResult> => {
        try {
          const servers = mcpClient.listServers();
          
          if (servers.length === 0) {
            return {
              success: true,
              message: 'No MCP servers configured.',
            };
          }

          const results = await Promise.all(
            servers.map(async (server) => {
              // Prefer monitor-provided health if available, otherwise fall back to client status
              const result = healthMonitor.getServerHealth(server.name) ?? (() => {
                const status = mcpClient.getServerStatus(server.name);
                return {
                  serverName: server.name,
                  healthy: status.status === 'connected',
                  status: status.status,
                  error: status.error,
                  timestamp: Date.now(),
                } as any;
              })();

              return { server, result };
            })
          );

          const output = [
            `**MCP Server Health Status**`,
            '',
            ...results.map(({ server, result }) => {
              const icon = result.healthy ? '✅' : '❌';
              const status = result.status;
              const lines = [
                `${icon} **${server.name}** - ${status}`,
              ];
              
              if (result.error) {
                lines.push(`   Error: ${result.error}`);
              }
              
              if (server.status.tools > 0) {
                lines.push(`   Tools: ${server.status.tools}`);
              }
              
              return lines.join('\n');
            }),
          ];

          return {
            success: true,
            message: output.join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to check health: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Check health of specific server
    {
      name: 'mcp health check',
      aliases: ['mcp check'],
      description: 'Check health of a specific MCP server',
      usage: '/mcp health check <server-name>',
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /mcp health check <server-name>',
          };
        }

        const serverName = args[0];

        try {
          const maybe = healthMonitor.getServerHealth(serverName);
          const result = maybe ?? (() => {
            const status = mcpClient.getServerStatus(serverName);
            return {
              serverName,
              healthy: status.status === 'connected',
              status: status.status,
              error: status.error,
              timestamp: Date.now(),
            } as any;
          })();

          const icon = result.healthy ? '✅' : '❌';
          const output = [
            `**${serverName}** Health Check`,
            '',
            `${icon} **Status:** ${result.status}`,
            `🕐 **Checked:** ${new Date(result.timestamp).toLocaleTimeString()}`,
          ];

          if (result.error) {
            output.push(`❌ **Error:** ${result.error}`);
          }

          if (result.healthy) {
            output.push('', '✅ Server is healthy and responding normally.');
          } else {
            output.push('', '⚠️ Server is unhealthy. Auto-restart may be triggered.');
          }

          return {
            success: true,
            message: output.join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to check health: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Manually restart a server
    {
      name: 'mcp restart',
      aliases: ['mcp health restart'],
      description: 'Manually restart an MCP server',
      usage: '/mcp restart <server-name>',
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /mcp restart <server-name>',
          };
        }

        const serverName = args[0];

        try {
          try {
            await healthMonitor.restartServer(serverName);
            return {
              success: true,
              message: `✅ Successfully restarted server "${serverName}"`,
            };
          } catch (err) {
            return {
              success: false,
              message: `❌ Failed to restart server "${serverName}": ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to restart server: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Start health monitoring
    {
      name: 'mcp health start',
      aliases: ['mcp monitor start'],
      description: 'Start automatic health monitoring',
      usage: '/mcp health start',
      handler: async (): Promise<CommandResult> => {
        try {
          // Monitor was constructed with a client in core; start without args
          healthMonitor.start();

          return {
            success: true,
            message: [
              '✅ Health monitoring started',
              '',
              'MCP servers will be checked periodically.',
              'Failed servers will be automatically restarted.',
            ].join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to start monitoring: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Stop health monitoring
    {
      name: 'mcp health stop',
      aliases: ['mcp monitor stop'],
      description: 'Stop automatic health monitoring',
      usage: '/mcp health stop',
      handler: async (): Promise<CommandResult> => {
        try {
          healthMonitor.stop();

          return {
            success: true,
            message: '⏸️ Health monitoring stopped',
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to stop monitoring: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Show monitoring status
    {
      name: 'mcp health status',
      aliases: ['mcp monitor status'],
      description: 'Show health monitoring status',
      usage: '/mcp health status',
      handler: async (): Promise<CommandResult> => {
        try {
          // There is no public `isRunning()` on the monitor; infer running from monitored servers
          const monitored = healthMonitor.getAllServerHealth();
          const isRunning = monitored.length > 0;
          const servers = mcpClient.listServers();

          const output = [
            '**Health Monitoring Status**',
            '',
            `📊 **Status:** ${isRunning ? '✅ Running' : '⏸️ Stopped'}`,
            `🖥️ **Servers:** ${servers.length}`,
          ];

          if (isRunning) {
            output.push('', '✅ Automatic health checks are active.');
            output.push('Failed servers will be automatically restarted.');
          } else {
            output.push('', '⏸️ Automatic health checks are stopped.');
            output.push('Use `/mcp health start` to enable monitoring.');
          }

          return {
            success: true,
            message: output.join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Help command
    {
      name: 'mcp health help',
      aliases: [],
      description: 'Show MCP health monitoring help',
      usage: '/mcp health help',
      handler: async (): Promise<CommandResult> => {
        return {
          success: true,
          message: [
            '**MCP Health Monitoring**',
            '',
            'Automatically monitors MCP server health and restarts failed servers.',
            '',
            '**Available Commands:**',
            '',
            '`/mcp health` - Check health of all servers',
            '`/mcp health check <server>` - Check specific server',
            '`/mcp restart <server>` - Manually restart a server',
            '`/mcp health start` - Start automatic monitoring',
            '`/mcp health stop` - Stop automatic monitoring',
            '`/mcp health status` - Show monitoring status',
            '',
            '**Features:**',
            '',
            '- Periodic health checks (every 30 seconds)',
            '- Automatic restart on failure (up to 3 attempts)',
            '- Exponential backoff between restart attempts',
            '- Event notifications for health changes',
            '',
            '**Configuration:**',
            '',
            'Health monitoring can be configured in your config file:',
            '',
            '```yaml',
            'mcpHealth:',
            '  enabled: true',
            '  checkInterval: 30000  # 30 seconds',
            '  maxRestartAttempts: 3',
            '  autoRestart: true',
            '```',
          ].join('\n'),
        };
      },
    },
  ];
}
