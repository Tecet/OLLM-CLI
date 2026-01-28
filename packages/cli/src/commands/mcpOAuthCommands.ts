/**
 * MCP OAuth commands for authentication management
 *
 * Provides commands for:
 * - Authenticating with OAuth-protected MCP servers
 * - Listing OAuth tokens
 * - Revoking OAuth tokens
 * - Checking token status
 */

import type { Command, CommandResult } from './types.js';
import type { MCPOAuthProvider } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';

/**
 * Create MCP OAuth commands with dependency injection
 */
export function createMCPOAuthCommands(oauthProvider: MCPOAuthProvider): Command[] {
  return [
    // Authenticate with an MCP server
    {
      name: 'mcp oauth login',
      aliases: ['mcp login', 'mcp auth'],
      description: 'Authenticate with an OAuth-protected MCP server',
      usage: '/mcp oauth login <server-name>',
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /mcp oauth login <server-name>',
          };
        }

        const serverName = args[0];

        try {
          // Note: This requires OAuth config to be set up in mcp.json
          // The actual authentication flow would need to be triggered here
          // For now, we'll return a helpful message

          return {
            success: false,
            message: [
              `OAuth authentication for "${serverName}" requires configuration in mcp.json:`,
              '',
              '```json',
              '{',
              '  "mcpServers": {',
              `    "${serverName}": {`,
              '      "command": "...",',
              '      "oauth": {',
              '        "enabled": true,',
              '        "clientId": "your-client-id",',
              '        "authorizationUrl": "https://...",',
              '        "tokenUrl": "https://...",',
              '        "scopes": ["scope1", "scope2"]',
              '      }',
              '    }',
              '  }',
              '}',
              '```',
              '',
              'Once configured, the OAuth flow will start automatically when connecting to the server.',
            ].join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // List OAuth tokens
    {
      name: 'mcp oauth list',
      aliases: ['mcp oauth ls', 'mcp tokens'],
      description: 'List OAuth tokens for MCP servers',
      usage: '/mcp oauth list',
      handler: async (): Promise<CommandResult> => {
        try {
          // Note: This would need to access the token storage
          // For now, return a helpful message

          return {
            success: true,
            message: [
              'OAuth tokens are stored securely in your system keychain.',
              '',
              'To view token status for a specific server, use:',
              '  /mcp oauth status <server-name>',
              '',
              'To revoke tokens for a server, use:',
              '  /mcp oauth revoke <server-name>',
            ].join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to list tokens: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Check token status
    {
      name: 'mcp oauth status',
      aliases: ['mcp oauth info'],
      description: 'Check OAuth token status for an MCP server',
      usage: '/mcp oauth status <server-name>',
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /mcp oauth status <server-name>',
          };
        }

        const serverName = args[0];

        try {
          const tokens = await oauthProvider.getValidTokens(serverName);

          if (!tokens) {
            return {
              success: true,
              message: [
                `No valid OAuth tokens found for "${serverName}".`,
                '',
                'To authenticate, use:',
                `  /mcp oauth login ${serverName}`,
              ].join('\n'),
            };
          }

          // Calculate time until expiration
          const now = Date.now();
          const expiresIn = tokens.expiresAt - now;
          const expiresInMinutes = Math.floor(expiresIn / (60 * 1000));
          const expiresInHours = Math.floor(expiresInMinutes / 60);

          let expiryText: string;
          if (expiresInHours > 24) {
            const days = Math.floor(expiresInHours / 24);
            expiryText = `${days} day(s)`;
          } else if (expiresInHours > 0) {
            expiryText = `${expiresInHours} hour(s)`;
          } else {
            expiryText = `${expiresInMinutes} minute(s)`;
          }

          return {
            success: true,
            message: [
              `OAuth token status for "${serverName}":`,
              '',
              `✅ **Status:** Valid`,
              `🔑 **Token Type:** ${tokens.tokenType}`,
              `⏰ **Expires In:** ${expiryText}`,
              `🔄 **Refresh Token:** ${tokens.refreshToken ? 'Available' : 'Not available'}`,
              ...(tokens.scope ? [`📋 **Scopes:** ${tokens.scope}`] : []),
            ].join('\n'),
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to check token status: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // Revoke OAuth tokens
    {
      name: 'mcp oauth revoke',
      aliases: ['mcp oauth logout', 'mcp logout'],
      description: 'Revoke OAuth tokens for an MCP server',
      usage: '/mcp oauth revoke <server-name>',
      handler: async (args: string[]): Promise<CommandResult> => {
        if (args.length === 0) {
          return {
            success: false,
            message: 'Usage: /mcp oauth revoke <server-name>',
          };
        }

        const serverName = args[0];

        try {
          await oauthProvider.revokeTokens(serverName);

          return {
            success: true,
            message: `✅ Revoked OAuth tokens for "${serverName}"`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to revoke tokens: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },

    // OAuth help
    {
      name: 'mcp oauth help',
      aliases: ['mcp oauth'],
      description: 'Show OAuth authentication help',
      usage: '/mcp oauth help',
      handler: async (): Promise<CommandResult> => {
        return {
          success: true,
          message: [
            '**MCP OAuth Authentication**',
            '',
            'OAuth allows secure authentication with remote MCP servers like GitHub, Google Workspace, etc.',
            '',
            '**Available Commands:**',
            '',
            '`/mcp oauth login <server>` - Authenticate with a server',
            '`/mcp oauth status <server>` - Check token status',
            '`/mcp oauth revoke <server>` - Revoke tokens',
            '`/mcp oauth list` - List all tokens',
            '',
            '**Configuration:**',
            '',
            'Add OAuth configuration to your mcp.json file:',
            '',
            '```json',
            '{',
            '  "mcpServers": {',
            '    "github": {',
            '      "command": "npx",',
            '      "args": ["-y", "@modelcontextprotocol/server-github"],',
            '      "oauth": {',
            '        "enabled": true,',
            '        "clientId": "your-github-client-id",',
            '        "authorizationUrl": "https://github.com/login/oauth/authorize",',
            '        "tokenUrl": "https://github.com/login/oauth/access_token",',
            '        "scopes": ["repo", "user"]',
            '      }',
            '    }',
            '  }',
            '}',
            '```',
            '',
            '**Security:**',
            '',
            'Tokens are stored securely in your system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).',
            'If keychain is unavailable, tokens are encrypted and stored in ~/.ollm/oauth-tokens.json.',
          ].join('\n'),
        };
      },
    },
  ];
}
