# MCP Integration Guide

**Version**: 0.1.0  
**Last Updated**: January 22, 2026

## Overview

This guide provides comprehensive documentation for the Model Context Protocol (MCP) integration in OLLM CLI. MCP enables the CLI to communicate with external servers that provide tools, resources, and prompts.

## Table of Contents

- [Architecture](#architecture)
- [Transport Types](#transport-types)
- [Server Configuration](#server-configuration)
- [OAuth Authentication](#oauth-authentication)
- [Tool Integration](#tool-integration)
- [Connection Management](#connection-management)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         OLLM CLI                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  MCP Client  │◄────►│ Tool Registry│                     │
│  └──────┬───────┘      └──────────────┘                     │
│         │                                                     │
│         │ manages                                            │
│         ▼                                                     │
│  ┌──────────────────────────────────────┐                   │
│  │        Server State Manager          │                   │
│  │  - Connection Status                 │                   │
│  │  - Tool Cache                         │                   │
│  │  - Log Buffer                         │                   │
│  │  - OAuth Tokens                       │                   │
│  └──────┬───────────────────────────────┘                   │
│         │                                                     │
│         │ uses                                               │
│         ▼                                                     │
│  ┌──────────────────────────────────────┐                   │
│  │         Transport Layer              │                   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐  │                   │
│  │  │ Stdio  │ │  SSE   │ │  HTTP  │  │                   │
│  │  └────────┘ └────────┘ └────────┘  │                   │
│  └──────┬───────────────────────────────┘                   │
└─────────┼───────────────────────────────────────────────────┘
          │
          │ JSON-RPC 2.0
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Servers                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Brave   │  │  GitHub  │  │  Custom  │                  │
│  │  Search  │  │  API     │  │  Server  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### MCP Client (`packages/core/src/mcp/mcpClient.ts`)
- Manages server lifecycle (start, stop, restart)
- Handles OAuth authentication
- Routes tool calls to appropriate servers
- Maintains server state and logs
- Provides health monitoring integration

#### Transport Layer (`packages/core/src/mcp/mcpTransport.ts`)
- **Stdio Transport**: Process-based communication via stdin/stdout
- **SSE Transport**: Server-Sent Events for real-time updates
- **HTTP Transport**: Standard HTTP POST requests

#### MCP Context (`packages/cli/src/ui/contexts/MCPContext.tsx`)
- React context for UI state management
- Server configuration watching
- Tool registration/unregistration
- Health monitoring integration
- Marketplace integration

---

## Transport Types

### Stdio Transport

**Best For**: Local MCP servers (Python, Node.js, etc.)

**How It Works**:
1. Spawns server process with stdin/stdout pipes
2. Sends JSON-RPC requests via stdin
3. Receives responses via stdout
4. Captures logs from stderr

**Configuration**:
```json
{
  "command": "uvx",
  "args": ["mcp-server-brave-search"],
  "transport": "stdio",
  "env": {
    "BRAVE_API_KEY": "${BRAVE_API_KEY}"
  }
}
```

**Advantages**:
- Simple setup
- No network configuration
- Automatic process management
- Secure (no network exposure)

**Limitations**:
- Local only
- Process overhead
- No built-in streaming

### SSE Transport

**Best For**: Remote servers with real-time updates

**How It Works**:
1. Opens SSE connection to server URL
2. Sends requests via HTTP POST
3. Receives responses via SSE stream
4. Supports bidirectional communication

**Configuration**:
```json
{
  "url": "https://api.example.com/mcp/sse",
  "transport": "sse",
  "oauth": {
    "enabled": true,
    "clientId": "your-client-id"
  }
}
```

**Advantages**:
- Real-time updates
- Remote access
- Efficient for streaming
- OAuth support

**Limitations**:
- Requires server support
- Network dependency
- More complex setup

### HTTP Transport

**Best For**: Simple remote servers

**How It Works**:
1. Sends JSON-RPC requests via HTTP POST
2. Receives responses in HTTP response body
3. No persistent connection

**Configuration**:
```json
{
  "url": "https://api.example.com/mcp",
  "transport": "http",
  "oauth": {
    "enabled": true,
    "clientId": "your-client-id"
  }
}
```

**Advantages**:
- Simple protocol
- Wide compatibility
- Easy debugging
- OAuth support

**Limitations**:
- No streaming
- Higher latency
- More network overhead

---

## Server Configuration

### Configuration File Location

MCP servers are configured in:
- **User-level**: `~/.ollm/mcp/config.json`
- **Workspace-level**: `.ollm/mcp/config.json`

### Configuration Schema

```typescript
interface MCPServerConfig {
  // Required: Command to execute (stdio only)
  command: string;
  
  // Required: Command arguments (stdio only)
  args: string[];
  
  // Optional: Environment variables
  env?: Record<string, string>;
  
  // Optional: Transport type (default: stdio)
  transport?: 'stdio' | 'sse' | 'http';
  
  // Optional: Connection timeout in ms (default: 30000)
  timeout?: number;
  
  // Optional: OAuth configuration
  oauth?: {
    enabled: boolean;
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
    authorizationUrl?: string;
    tokenUrl?: string;
  };
  
  // Optional: Server URL (required for SSE/HTTP)
  url?: string;
  
  // Optional: Working directory (stdio only)
  cwd?: string;
  
  // Optional: Tools to auto-approve
  autoApprove?: string[];
}
```

### Environment Variable Substitution

Environment variables in configuration are automatically substituted:

```json
{
  "env": {
    "API_KEY": "${BRAVE_API_KEY}",
    "BASE_URL": "${API_BASE_URL:-https://api.example.com}"
  }
}
```

Syntax:
- `${VAR}` - Required variable (error if not set)
- `${VAR:-default}` - Optional with default value

---

## OAuth Authentication

### Overview

OAuth 2.0 authentication is supported for servers requiring API keys or user authentication.

### OAuth Flow

```
1. User enables OAuth in MCP Panel
   ↓
2. CLI opens browser to authorization URL
   ↓
3. User authenticates and grants permissions
   ↓
4. Browser redirects to local callback server
   ↓
5. CLI exchanges code for access token
   ↓
6. Token stored securely in ~/.ollm/mcp/oauth-tokens.json
   ↓
7. Token automatically refreshed before expiration
```

### Configuration

```json
{
  "oauth": {
    "enabled": true,
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "scopes": ["read", "write"],
    "authorizationUrl": "https://api.example.com/oauth/authorize",
    "tokenUrl": "https://api.example.com/oauth/token",
    "redirectPort": 3000,
    "usePKCE": true
  }
}
```

### PKCE (Proof Key for Code Exchange)

PKCE is enabled by default for enhanced security:
- No client secret required
- Protects against authorization code interception
- Recommended for CLI applications

### Token Management

**Storage**:
- Tokens stored in `~/.ollm/mcp/oauth-tokens.json`
- File permissions: 600 (owner read/write only)
- Encrypted at rest

**Refresh**:
- Automatic refresh before expiration
- Fallback to re-authentication if refresh fails
- User notified of authentication issues

**Revocation**:
- Tokens revoked on server disable
- Manual revocation via MCP Panel
- Automatic cleanup on logout

---

## Tool Integration

### Tool Discovery

When a server connects, the CLI automatically:
1. Sends `tools/list` request
2. Receives tool definitions with JSON schemas
3. Registers tools in global tool registry
4. Makes tools available to LLM

### Tool Invocation

```typescript
// Tool call flow
1. LLM requests tool execution
   ↓
2. CLI validates tool exists
   ↓
3. Policy engine checks approval rules
   ↓
4. User confirms (if required)
   ↓
5. CLI sends tools/call request to server
   ↓
6. Server executes tool
   ↓
7. Result returned to LLM
```

### Auto-Approval

Tools can be auto-approved to skip confirmation:

```json
{
  "autoApprove": [
    "search_web",
    "get_weather",
    "read_file"
  ]
}
```

**Security Note**: Only auto-approve trusted, read-only tools.

---

## Connection Management

### Connection Lifecycle

```
disconnected → starting → connected → error
     ↑            ↓           ↓          ↓
     └────────────┴───────────┴──────────┘
              (restart/stop)
```

### Connection Timeout

**Default**: 30 seconds (increased from 10s)

**Rationale**:
- Python servers can take 10-20s to start
- Network latency for remote servers
- OAuth token retrieval

**Configuration**:
```json
{
  "timeout": 45000  // 45 seconds
}
```

### Retry Logic

Failed connections are retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay
- Max attempts: 3 (configurable)

### Health Monitoring

Servers are monitored every 30 seconds:
- Ping request sent
- Response time measured
- Status updated (healthy/degraded/unhealthy)
- Automatic restart on repeated failures

---

## Error Handling

### Error Types

#### Connection Errors
**Cause**: Server not reachable, process failed to start  
**Status**: `error`  
**Recovery**: Restart server, check configuration

#### Timeout Errors
**Cause**: Server not responding within timeout  
**Status**: `error`  
**Recovery**: Increase timeout, check server performance

#### OAuth Errors
**Cause**: Authentication failed, token expired  
**Status**: `error`  
**Recovery**: Re-authenticate via MCP Panel

#### Tool Execution Errors
**Cause**: Tool failed during execution  
**Status**: `connected` (server still healthy)  
**Recovery**: Check tool arguments, server logs

### Error Messages

Error messages include:
- **Context**: What operation failed
- **Cause**: Why it failed
- **Action**: What to do next

Example:
```
OAuth authentication required for brave-search.
To authenticate:
1. Open MCP Panel (Ctrl+M)
2. Select "brave-search" server
3. Press 'O' for OAuth configuration
4. Follow the browser authentication flow
```

---

## Troubleshooting

### Server Won't Start

**Symptoms**:
- Status stuck on "starting"
- Connection timeout error
- Process exits immediately

**Diagnosis**:
1. Check server logs: `Ctrl+M` → Select server → View logs
2. Verify command exists: `which <command>`
3. Test command manually: `<command> <args>`
4. Check environment variables: `echo $VAR`

**Solutions**:
- Install missing dependencies
- Fix command path
- Set required environment variables
- Increase connection timeout

### OAuth Authentication Fails

**Symptoms**:
- "No OAuth token available" error
- Browser doesn't open
- Redirect fails

**Diagnosis**:
1. Check OAuth configuration
2. Verify client ID/secret
3. Check redirect port availability
4. Review browser console for errors

**Solutions**:
- Verify OAuth credentials
- Use different redirect port
- Check firewall settings
- Try PKCE flow (no client secret)

### Tools Not Appearing

**Symptoms**:
- Server connected but no tools
- Tools not in registry
- LLM can't use tools

**Diagnosis**:
1. Check server status: Connected?
2. View server logs for errors
3. Verify tools/list response
4. Check tool registration logs

**Solutions**:
- Restart server
- Check server implementation
- Verify tool schema format
- Review registration errors

### Slow Tool Execution

**Symptoms**:
- Tool calls timeout
- Long response times
- UI freezes

**Diagnosis**:
1. Check tool execution time in logs
2. Monitor server resource usage
3. Test tool directly on server
4. Review network latency

**Solutions**:
- Increase tool timeout
- Optimize server implementation
- Use streaming for long operations
- Consider local server deployment

### Memory/Resource Issues

**Symptoms**:
- Server crashes
- High memory usage
- Process killed

**Diagnosis**:
1. Monitor server process: `top` or `htop`
2. Check log buffer size
3. Review output size limits
4. Analyze memory leaks

**Solutions**:
- Reduce log buffer size
- Implement output streaming
- Fix memory leaks in server
- Add resource limits

---

## Best Practices

### Server Development

1. **Implement Health Checks**: Respond to ping requests
2. **Use Streaming**: For large outputs or long operations
3. **Validate Input**: Check tool arguments before execution
4. **Handle Errors**: Return descriptive error messages
5. **Log Appropriately**: Use stderr for logs, stdout for protocol

### Configuration

1. **Use Environment Variables**: For secrets and API keys
2. **Set Reasonable Timeouts**: Based on server characteristics
3. **Enable OAuth**: For servers requiring authentication
4. **Auto-Approve Carefully**: Only for trusted, read-only tools
5. **Document Requirements**: In server metadata

### Security

1. **Never Commit Secrets**: Use environment variables
2. **Restrict File Permissions**: 600 for token files
3. **Use PKCE**: For OAuth flows
4. **Validate Tool Input**: On both client and server
5. **Monitor Server Logs**: For suspicious activity

---

## API Reference

### MCPClient Interface

```typescript
interface MCPClient {
  // Start a server
  startServer(name: string, config: MCPServerConfig): Promise<void>;
  
  // Stop a server
  stopServer(name: string): Promise<void>;
  
  // Restart a server
  restartServer(name: string): Promise<void>;
  
  // Get server status
  getServerStatus(name: string): MCPServerStatus;
  
  // Get all server statuses
  getAllServerStatuses(): Map<string, MCPServerStatus>;
  
  // Get server logs
  getServerLogs(name: string, lines?: number): Promise<string[]>;
  
  // List all servers
  listServers(): MCPServerInfo[];
  
  // Call a tool
  callTool(serverName: string, toolName: string, args: unknown): Promise<unknown>;
  
  // Call a tool with streaming
  callToolStreaming(
    serverName: string,
    toolName: string,
    args: unknown,
    onChunk: (chunk: MCPStreamChunk) => void
  ): Promise<unknown>;
  
  // Get tools from server
  getTools(serverName: string): Promise<MCPTool[]>;
  
  // Get resources from server
  getResources(serverName: string): Promise<MCPResource[]>;
  
  // Read a resource
  readResource(serverName: string, uri: string): Promise<unknown>;
  
  // Get prompts from server
  getPrompts(serverName: string): Promise<MCPPrompt[]>;
  
  // Get a specific prompt
  getPrompt(
    serverName: string,
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<unknown>;
}
```

---

## Examples

### Example 1: Brave Search Server

```json
{
  "brave-search": {
    "command": "uvx",
    "args": ["mcp-server-brave-search"],
    "env": {
      "BRAVE_API_KEY": "${BRAVE_API_KEY}"
    },
    "transport": "stdio",
    "timeout": 30000,
    "autoApprove": ["search_web"]
  }
}
```

### Example 2: GitHub API Server

```json
{
  "github": {
    "url": "https://api.github.com/mcp",
    "transport": "http",
    "oauth": {
      "enabled": true,
      "clientId": "your-github-client-id",
      "scopes": ["repo", "user"]
    },
    "timeout": 45000
  }
}
```

### Example 3: Custom Local Server

```json
{
  "custom-tools": {
    "command": "node",
    "args": ["./mcp-server.js"],
    "cwd": "/path/to/server",
    "env": {
      "NODE_ENV": "production",
      "PORT": "3000"
    },
    "transport": "stdio",
    "timeout": 20000
  }
}
```

---

## Additional Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP Server Development Guide](./servers/development-guide.md)
- [OAuth Setup Guide](./servers/oauth-setup.md)
- [Marketplace Guide](./Marketplace.md)
- [API Reference](./api/mcp-client.md)

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review server logs in MCP Panel
3. Search existing GitHub issues
4. Open a new issue with logs and configuration

---

**Last Updated**: January 22, 2026  
**Version**: 0.1.0
