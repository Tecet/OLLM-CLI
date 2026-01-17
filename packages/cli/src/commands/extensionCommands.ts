/**
 * Extension commands for marketplace functionality
 * 
 * Provides commands for:
 * - Searching extensions
 * - Installing extensions
 * - Listing installed extensions
 * - Removing extensions
 * - Updating extensions
 */

import type { Command, CommandResult } from './types.js';
import type { ExtensionManager } from '@ollm/ollm-cli-core/extensions/extensionManager.js';
import type { ExtensionRegistry } from '@ollm/ollm-cli-core/extensions/extensionRegistry.js';

/**
 * Create extension commands with dependency injection
 */
export function createExtensionCommands(
  extensionManager: ExtensionManager,
  extensionRegistry: ExtensionRegistry
): Command[] {
  return [
    // Search for extensions
    {
      name: 'extensions search',
      aliases: ['ext search', 'ext find'],
      description: 'Search for extensions in the marketplace',
      usage: '/extensions search <query> [--limit <n>]',
      examples: [
        '/extensions search github',
        '/extensions search mcp --limit 10',
        '/ext search hooks',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /extensions search <query> [--limit <n>]',
          };
        }

        // Parse arguments
        const query = args.filter(arg => !arg.startsWith('--')).join(' ');
        const limitIndex = args.indexOf('--limit');
        const limit = limitIndex !== -1 && args[limitIndex + 1] 
          ? parseInt(args[limitIndex + 1], 10) 
          : 10;

        try {
          const results = await extensionRegistry.search(query, { limit });

          if (results.length === 0) {
            return {
              success: true,
              message: `No extensions found matching "${query}"`,
            };
          }

          // Format results
          const formatted = results.map((result, index) => {
            const { metadata, score } = result;
            return [
              `${index + 1}. **${metadata.name}** v${metadata.version}`,
              `   ${metadata.description}`,
              `   Author: ${metadata.author}`,
              `   Tags: ${metadata.tags.join(', ')}`,
              `   Downloads: ${metadata.downloads}`,
              `   Match: ${(score * 100).toFixed(0)}%`,
              '',
            ].join('\n');
          }).join('\n');

          return {
            success: true,
            message: `Found ${results.length} extension(s) matching "${query}":\n\n${formatted}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to search extensions: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Install an extension
    {
      name: 'extensions install',
      aliases: ['ext install', 'ext add'],
      description: 'Install an extension from the marketplace',
      usage: '/extensions install <name> [version]',
      examples: [
        '/extensions install github-integration',
        '/extensions install mcp-server 1.2.0',
        '/ext install hooks-debugger',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /extensions install <name> [version]',
          };
        }

        const name = args[0];
        const version = args[1];

        try {
          const result = await extensionRegistry.install(name, version);

          if (!result.success) {
            return {
              success: false,
              message: `Failed to install extension "${name}": ${result.error || 'Unknown error'}`,
            };
          }

          // Reload extensions to pick up the new one
          await extensionManager.loadExtensions();

          return {
            success: true,
            message: [
              `✅ Successfully installed **${result.name}** v${result.version}`,
              `   Installed to: ${result.path}`,
              '',
              'Extension is now active. Use `/extensions list` to see all installed extensions.',
            ].join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to install extension: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // List installed extensions
    {
      name: 'extensions list',
      aliases: ['ext list', 'ext ls'],
      description: 'List all installed extensions',
      usage: '/extensions list [--all]',
      examples: [
        '/extensions list',
        '/extensions list --all',
        '/ext ls',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        const showAll = args.includes('--all');

        try {
          const extensions = extensionManager.getExtensions();

          if (extensions.length === 0) {
            return {
              success: true,
              message: 'No extensions installed. Use `/extensions search` to find extensions.',
            };
          }

          // Filter by enabled status if not showing all
          const filtered = showAll 
            ? extensions 
            : extensions.filter(ext => ext.enabled);

          if (filtered.length === 0) {
            return {
              success: true,
              message: 'No enabled extensions. Use `/extensions list --all` to see all extensions.',
            };
          }

          // Format extensions
          const formatted = filtered.map((ext, index) => {
            const status = ext.enabled ? '✅' : '❌';
            const hooks = ext.hooks?.length || 0;
            const mcpServers = Object.keys(ext.mcpServers || {}).length;
            const skills = ext.skills?.length || 0;

            return [
              `${index + 1}. ${status} **${ext.name}** v${ext.version}`,
              `   ${ext.description}`,
              `   Author: ${ext.author}`,
              `   Hooks: ${hooks}, MCP Servers: ${mcpServers}, Skills: ${skills}`,
              `   Path: ${ext.path}`,
              '',
            ].join('\n');
          }).join('\n');

          return {
            success: true,
            message: `Installed extensions (${filtered.length}):\n\n${formatted}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to list extensions: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Enable an extension
    {
      name: 'extensions enable',
      aliases: ['ext enable', 'ext on'],
      description: 'Enable a disabled extension',
      usage: '/extensions enable <name>',
      examples: [
        '/extensions enable github-integration',
        '/ext enable mcp-server',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /extensions enable <name>',
          };
        }

        const name = args[0];

        try {
          await extensionManager.enableExtension(name);

          return {
            success: true,
            message: `✅ Enabled extension "${name}"`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to enable extension: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Disable an extension
    {
      name: 'extensions disable',
      aliases: ['ext disable', 'ext off'],
      description: 'Disable an enabled extension',
      usage: '/extensions disable <name>',
      examples: [
        '/extensions disable github-integration',
        '/ext disable mcp-server',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /extensions disable <name>',
          };
        }

        const name = args[0];

        try {
          await extensionManager.disableExtension(name);

          return {
            success: true,
            message: `❌ Disabled extension "${name}"`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to disable extension: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Show extension info
    {
      name: 'extensions info',
      aliases: ['ext info', 'ext show'],
      description: 'Show detailed information about an extension',
      usage: '/extensions info <name>',
      examples: [
        '/extensions info github-integration',
        '/ext info mcp-server',
      ],
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /extensions info <name>',
          };
        }

        const name = args[0];

        try {
          const extension = extensionManager.getExtension(name);

          if (!extension) {
            return {
              success: false,
              message: `Extension "${name}" not found`,
            };
          }

          // Format extension info
          const hooks = extension.hooks?.length || 0;
          const mcpServers = Object.keys(extension.mcpServers || {}).length;
          const skills = extension.skills?.length || 0;
          const status = extension.enabled ? '✅ Enabled' : '❌ Disabled';

          const info = [
            `**${extension.name}** v${extension.version}`,
            `Status: ${status}`,
            '',
            `**Description:**`,
            extension.description,
            '',
            `**Author:** ${extension.author}`,
            `**Repository:** ${extension.repository || 'N/A'}`,
            `**License:** ${extension.license || 'N/A'}`,
            '',
            `**Components:**`,
            `- Hooks: ${hooks}`,
            `- MCP Servers: ${mcpServers}`,
            `- Skills: ${skills}`,
            '',
            `**Installation Path:**`,
            extension.path,
          ];

          // Add hooks info if available
          if (extension.hooks && extension.hooks.length > 0) {
            info.push('', '**Hooks:**');
            extension.hooks.forEach(hook => {
              info.push(`- ${hook.name} (${hook.event})`);
            });
          }

          // Add MCP servers info if available
          if (extension.mcpServers && Object.keys(extension.mcpServers).length > 0) {
            info.push('', '**MCP Servers:**');
            Object.entries(extension.mcpServers).forEach(([name, config]) => {
              info.push(`- ${name}: ${config.command} ${(config.args || []).join(' ')}`);
            });
          }

          return {
            success: true,
            message: info.join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get extension info: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Reload extensions
    {
      name: 'extensions reload',
      aliases: ['ext reload', 'ext refresh'],
      description: 'Reload all extensions',
      usage: '/extensions reload',
      examples: [
        '/extensions reload',
        '/ext reload',
      ],
      handler: async (): Promise<CommandResult> => {
        try {
          await extensionManager.loadExtensions();

          const extensions = extensionManager.getExtensions();
          const enabled = extensions.filter(ext => ext.enabled).length;

          return {
            success: true,
            message: `✅ Reloaded ${extensions.length} extension(s) (${enabled} enabled)`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to reload extensions: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
  ];
}
