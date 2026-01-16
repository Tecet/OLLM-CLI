/**
 * Extension management commands
 * 
 * Provides CLI commands for extension marketplace, installation,
 * and permission management.
 */

import type { Command, CommandHandler, CommandContext, CommandResult } from './types.js';
import type {
  ExtensionRegistry,
  ExtensionManager,
  ExtensionWatcher,
  ExtensionSandbox,
} from '@ollm/ollm-cli-core/extensions';

/**
 * Extension search command
 * 
 * Usage: /extensions search <query> [--tags tag1,tag2] [--sort relevance|downloads|updated]
 */
export const extensionSearchCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const registry = context.extensionRegistry as ExtensionRegistry;
  if (!registry) {
    return {
      success: false,
      message: 'Extension registry not available',
    };
  }

  // Parse arguments
  const query = args[0] || '';
  const tags = context.flags?.tags?.split(',') || undefined;
  const sortBy = (context.flags?.sort as 'relevance' | 'downloads' | 'updated') || 'relevance';
  const limit = parseInt(context.flags?.limit as string) || 20;

  if (!query) {
    return {
      success: false,
      message: 'Usage: /extensions search <query> [--tags tag1,tag2] [--sort relevance|downloads|updated] [--limit 20]',
    };
  }

  try {
    const results = await registry.search(query, { tags, sortBy, limit });

    if (results.length === 0) {
      return {
        success: true,
        message: `No extensions found matching "${query}"`,
      };
    }

    // Format results
    const output = [
      `Found ${results.length} extension(s) matching "${query}":\n`,
      ...results.map((result, index) => {
        const { metadata, score } = result;
        return [
          `${index + 1}. ${metadata.name} v${metadata.version}`,
          `   ${metadata.description}`,
          `   Author: ${metadata.author}`,
          `   Tags: ${metadata.tags.join(', ')}`,
          `   Downloads: ${metadata.downloads}`,
          `   Score: ${(score * 100).toFixed(0)}%`,
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
      message: `Failed to search extensions: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension install command
 * 
 * Usage: /extensions install <name> [version]
 */
export const extensionInstallCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const registry = context.extensionRegistry as ExtensionRegistry;
  const manager = context.extensionManager as ExtensionManager;

  if (!registry || !manager) {
    return {
      success: false,
      message: 'Extension system not available',
    };
  }

  const name = args[0];
  const version = args[1];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions install <name> [version]',
    };
  }

  try {
    // Install extension
    const result = await registry.install(name, version);

    if (!result.success) {
      return {
        success: false,
        message: `Failed to install extension: ${result.error}`,
      };
    }

    // Reload extensions to pick up the new one
    await manager.loadExtensions();

    // Enable the extension
    await manager.enableExtension(name);

    return {
      success: true,
      message: `Successfully installed and enabled extension '${name}' v${result.version}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install extension: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension uninstall command
 * 
 * Usage: /extensions uninstall <name>
 */
export const extensionUninstallCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const registry = context.extensionRegistry as ExtensionRegistry;
  const manager = context.extensionManager as ExtensionManager;

  if (!registry || !manager) {
    return {
      success: false,
      message: 'Extension system not available',
    };
  }

  const name = args[0];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions uninstall <name>',
    };
  }

  try {
    // Disable extension first
    await manager.disableExtension(name);

    // Uninstall extension
    await registry.uninstall(name);

    // Reload extensions
    await manager.loadExtensions();

    return {
      success: true,
      message: `Successfully uninstalled extension '${name}'`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to uninstall extension: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension list command
 * 
 * Usage: /extensions list [--enabled|--disabled|--all]
 */
export const extensionListCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const manager = context.extensionManager as ExtensionManager;

  if (!manager) {
    return {
      success: false,
      message: 'Extension manager not available',
    };
  }

  const filter = context.flags?.enabled ? 'enabled' 
    : context.flags?.disabled ? 'disabled' 
    : 'all';

  try {
    const extensions = manager.getAllExtensions();

    // Filter extensions
    const filtered = extensions.filter((ext) => {
      if (filter === 'enabled') return ext.enabled;
      if (filter === 'disabled') return !ext.enabled;
      return true;
    });

    if (filtered.length === 0) {
      return {
        success: true,
        message: `No ${filter === 'all' ? '' : filter + ' '}extensions found`,
      };
    }

    // Format output
    const output = [
      `${filtered.length} ${filter === 'all' ? '' : filter + ' '}extension(s):\n`,
      ...filtered.map((ext, index) => {
        const status = ext.enabled ? '✓' : '✗';
        return [
          `${index + 1}. [${status}] ${ext.name} v${ext.version}`,
          `   ${ext.description}`,
          `   Path: ${ext.path}`,
          `   Hooks: ${ext.hooks.length}`,
          `   MCP Servers: ${ext.mcpServers.length}`,
          `   Skills: ${ext.skills.length}`,
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
      message: `Failed to list extensions: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension update command
 * 
 * Usage: /extensions update [name]
 */
export const extensionUpdateCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const registry = context.extensionRegistry as ExtensionRegistry;
  const manager = context.extensionManager as ExtensionManager;

  if (!registry || !manager) {
    return {
      success: false,
      message: 'Extension system not available',
    };
  }

  const name = args[0];

  try {
    if (name) {
      // Update specific extension
      const extension = manager.getExtension(name);
      if (!extension) {
        return {
          success: false,
          message: `Extension '${name}' not found`,
        };
      }

      const newVersion = await registry.checkUpdate(name, extension.version);
      if (!newVersion) {
        return {
          success: true,
          message: `Extension '${name}' is up to date (v${extension.version})`,
        };
      }

      return {
        success: true,
        message: `Update available for '${name}': v${extension.version} → v${newVersion}\nRun: /extensions install ${name} ${newVersion}`,
      };
    } else {
      // Check all extensions for updates
      const extensions = manager.getAllExtensions();
      const updates: string[] = [];

      for (const ext of extensions) {
        const newVersion = await registry.checkUpdate(ext.name, ext.version);
        if (newVersion) {
          updates.push(`${ext.name}: v${ext.version} → v${newVersion}`);
        }
      }

      if (updates.length === 0) {
        return {
          success: true,
          message: 'All extensions are up to date',
        };
      }

      const output = [
        `${updates.length} update(s) available:\n`,
        ...updates.map((update, index) => `${index + 1}. ${update}`),
        '\nRun /extensions install <name> to update',
      ].join('\n');

      return {
        success: true,
        message: output,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension watch command
 * 
 * Usage: /extensions watch [on|off|status]
 */
export const extensionWatchCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const watcher = context.extensionWatcher as ExtensionWatcher;

  if (!watcher) {
    return {
      success: false,
      message: 'Extension watcher not available',
    };
  }

  const action = args[0] || 'status';

  try {
    switch (action) {
      case 'on':
        if (watcher.isEnabled()) {
          return {
            success: true,
            message: 'Extension watcher is already enabled',
          };
        }
        watcher.start();
        return {
          success: true,
          message: 'Extension watcher enabled - extensions will auto-reload on changes',
        };

      case 'off':
        if (!watcher.isEnabled()) {
          return {
            success: true,
            message: 'Extension watcher is already disabled',
          };
        }
        watcher.stop();
        return {
          success: true,
          message: 'Extension watcher disabled',
        };

      case 'status':
        const enabled = watcher.isEnabled();
        const watched = watcher.getWatchedExtensions();
        return {
          success: true,
          message: [
            `Extension watcher: ${enabled ? 'enabled' : 'disabled'}`,
            enabled ? `Watching ${watched.length} extension(s): ${watched.join(', ')}` : '',
          ].filter(Boolean).join('\n'),
        };

      default:
        return {
          success: false,
          message: 'Usage: /extensions watch [on|off|status]',
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to manage watcher: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension permissions command
 * 
 * Usage: /extensions permissions <name> [--grant|--revoke type:scope]
 */
export const extensionPermissionsCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const sandbox = context.extensionSandbox as ExtensionSandbox;

  if (!sandbox) {
    return {
      success: false,
      message: 'Extension sandbox not available',
    };
  }

  const name = args[0];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions permissions <name> [--grant|--revoke type:scope]',
    };
  }

  try {
    const permissions = sandbox.getPermissions(name);
    if (!permissions) {
      return {
        success: false,
        message: `No permissions found for extension '${name}'`,
      };
    }

    // Handle grant/revoke
    if (context.flags?.grant) {
      const [type, ...scopeParts] = (context.flags.grant as string).split(':');
      const scope = scopeParts.join(':');
      
      sandbox.grantPermission(name, {
        type: type as any,
        scope: [scope],
        granted: true,
      });

      return {
        success: true,
        message: `Granted ${type} permission to '${name}': ${scope}`,
      };
    }

    if (context.flags?.revoke) {
      const [type, ...scopeParts] = (context.flags.revoke as string).split(':');
      const scope = scopeParts.join(':');
      
      sandbox.revokePermission(name, {
        type: type as any,
        scope: [scope],
        granted: false,
      });

      return {
        success: true,
        message: `Revoked ${type} permission from '${name}': ${scope}`,
      };
    }

    // Display permissions
    const output = [
      `Permissions for '${name}':\n`,
      `Filesystem: ${permissions.filesystem.length > 0 ? permissions.filesystem.join(', ') : 'none'}`,
      `Network: ${permissions.network.length > 0 ? permissions.network.join(', ') : 'none'}`,
      `Environment: ${permissions.env.length > 0 ? permissions.env.join(', ') : 'none'}`,
      `Shell: ${permissions.shell ? 'granted' : 'denied'}`,
      `MCP: ${permissions.mcp ? 'granted' : 'denied'}`,
    ].join('\n');

    return {
      success: true,
      message: output,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to manage permissions: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension enable command
 * 
 * Usage: /extensions enable <name>
 */
export const extensionEnableCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const manager = context.extensionManager as ExtensionManager;

  if (!manager) {
    return {
      success: false,
      message: 'Extension manager not available',
    };
  }

  const name = args[0];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions enable <name>',
    };
  }

  try {
    await manager.enableExtension(name);
    return {
      success: true,
      message: `Enabled extension '${name}'`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to enable extension: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension disable command
 * 
 * Usage: /extensions disable <name>
 */
export const extensionDisableCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const manager = context.extensionManager as ExtensionManager;

  if (!manager) {
    return {
      success: false,
      message: 'Extension manager not available',
    };
  }

  const name = args[0];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions disable <name>',
    };
  }

  try {
    await manager.disableExtension(name);
    return {
      success: true,
      message: `Disabled extension '${name}'`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to disable extension: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extension info command
 * 
 * Usage: /extensions info <name>
 */
export const extensionInfoCommand: CommandHandler = async (
  args: string[],
  context: CommandContext
) => {
  const manager = context.extensionManager as ExtensionManager;
  const sandbox = context.extensionSandbox as ExtensionSandbox;

  if (!manager) {
    return {
      success: false,
      message: 'Extension manager not available',
    };
  }

  const name = args[0];

  if (!name) {
    return {
      success: false,
      message: 'Usage: /extensions info <name>',
    };
  }

  try {
    const extension = manager.getExtension(name);
    if (!extension) {
      return {
        success: false,
        message: `Extension '${name}' not found`,
      };
    }

    const permissions = sandbox?.getPermissions(name);

    const output = [
      `Extension: ${extension.name} v${extension.version}`,
      `Status: ${extension.enabled ? 'enabled' : 'disabled'}`,
      `Description: ${extension.description}`,
      `Path: ${extension.path}`,
      '',
      `Hooks: ${extension.hooks.length}`,
      ...extension.hooks.map((hook) => `  - ${hook.name} (${hook.source})`),
      '',
      `MCP Servers: ${extension.mcpServers.length}`,
      ...Object.keys(extension.manifest.mcpServers || {}).map((server) => `  - ${server}`),
      '',
      `Skills: ${extension.skills.length}`,
      ...extension.skills.map((skill) => `  - ${skill.name}: ${skill.description}`),
      '',
      `Settings: ${extension.settings.length}`,
      ...extension.settings.map((setting) => `  - ${setting.name}: ${setting.description}`),
    ];

    if (permissions) {
      output.push('');
      output.push('Permissions:');
      output.push(`  Filesystem: ${permissions.filesystem.length > 0 ? permissions.filesystem.join(', ') : 'none'}`);
      output.push(`  Network: ${permissions.network.length > 0 ? permissions.network.join(', ') : 'none'}`);
      output.push(`  Environment: ${permissions.env.length > 0 ? permissions.env.join(', ') : 'none'}`);
      output.push(`  Shell: ${permissions.shell ? 'granted' : 'denied'}`);
      output.push(`  MCP: ${permissions.mcp ? 'granted' : 'denied'}`);
    }

    return {
      success: true,
      message: output.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get extension info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
/**
 * Extension command dispatcher
 */
export const extensionCommand: Command = {
  name: '/extensions',
  aliases: ['/ext'],
  description: 'Manage extensions, plugins, and MCP servers',
  usage: '/extensions <search|install|uninstall|list|update|watch|permissions|enable|disable|info> [args]',
  handler: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /extensions <search|install|uninstall|list|update|watch|permissions|enable|disable|info> [args]\n\n' +
          'Subcommands:\n' +
          '  search <query>      - Search for extensions in the registry\n' +
          '  install <name>      - Install an extension\n' +
          '  uninstall <name>    - Uninstall an extension\n' +
          '  list                - List installed extensions\n' +
          '  update [name]       - Check for or install updates\n' +
          '  watch [on|off]      - Manage auto-reload watcher\n' +
          '  permissions <name>  - Manage extension permissions\n' +
          '  enable <name>       - Enable an extension\n' +
          '  disable <name>      - Disable an extension\n' +
          '  info <name>         - Show detailed information about an extension',
      };
    }

    const action = args[0];
    const actionArgs = args.slice(1);

    switch (action) {
      case 'search': return extensionSearchCommand(actionArgs, context);
      case 'install': return extensionInstallCommand(actionArgs, context);
      case 'uninstall': return extensionUninstallCommand(actionArgs, context);
      case 'list': return extensionListCommand(actionArgs, context);
      case 'update': return extensionUpdateCommand(actionArgs, context);
      case 'watch': return extensionWatchCommand(actionArgs, context);
      case 'permissions': return extensionPermissionsCommand(actionArgs, context);
      case 'enable': return extensionEnableCommand(actionArgs, context);
      case 'disable': return extensionDisableCommand(actionArgs, context);
      case 'info': return extensionInfoCommand(actionArgs, context);
      default:
        return {
          success: false,
          message: `Unknown extension action: ${action}\n\n` +
            'Available actions: search, install, uninstall, list, update, watch, permissions, enable, disable, info',
        };
    }
  },
};

/**
 * All extension-related commands
 */
export const extensionCommands: Command[] = [
  extensionCommand,
];
