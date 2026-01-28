# MCP Integration

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**

- `dev_ToolExecution.md` - Tool system integration
- `dev_HookSystem.md` - Hook system (MCP OAuth pre-authentication)
- `dev_ProviderSystem.md` - Provider architecture

---

## Overview

MCP (Model Context Protocol) integration allows OLLM CLI to connect to external tool servers using the MCP protocol. MCP servers can provide tools, resources, and prompts that extend the capabilities of the LLM.

**Key Features:**

- Multiple transport types (stdio, SSE, HTTP)
- Automatic tool discovery and schema conversion
- OAuth 2.0 authentication support
- Health monitoring and auto-recovery
- Secure token storage

---

## Core Architecture

### MCP Client Lifecycle

```
Initialization
  ↓
MCPClient.connect(serverConfig)
  ↓
MCPTransport.start()
  ├─ stdio: spawn process, pipe stdin/stdout
  ├─ SSE: HTTP connection with event stream
  └─ HTTP: REST API calls
  ↓
Protocol Handshake
  ├─ Send initialize request
  ├─ Receive server capabilities
  └─ Send initialized notification
  ↓
Tool Discovery
  ├─ Request tools/list
  ├─ Receive tool schemas
  └─ Convert to internal format
  ↓
Ready for Tool Calls
  ↓
Tool Execution
  ├─ Validate parameters
  ├─ Send tools/call request
  ├─ Receive result
  └─ Return to LLM
  ↓
Health Monitoring (continuous)
  ├─ Periodic health checks
  ├─ Detect failures
  └─ Auto-restart if needed
  ↓
Shutdown
  ├─ Send shutdown notification
  ├─ Close transport
  └─ Cleanup resources
```

## Tool Discovery Flow

### Schema Conversion

```
MCP Server Tool Schema
  ↓
MCPClient.listTools()
  ↓
MCPSchemaConverter.convertToolSchema()
  ├─ Extract tool name
  ├─ Extract description
  ├─ Convert input schema (JSON Schema → Internal)
  │  ├─ Map types (string, number, boolean, object, array)
  │  ├─ Handle required fields
  │  ├─ Handle optional fields
  │  └─ Handle nested objects
  └─ Create ToolDefinition
  ↓
ToolRegistry.registerTool()
  ├─ Store tool definition
  ├─ Create wrapper function
  └─ Make available to LLM
  ↓
LLM sees tool in available tools list
```

**Key Conversion Rules:**

- MCP `string` → Internal `string`
- MCP `number`/`integer` → Internal `number`
- MCP `boolean` → Internal `boolean`
- MCP `object` → Internal `object` (with properties)
- MCP `array` → Internal `array` (with items)
- MCP `required` array → Internal required flags
- MCP `description` → Internal description

## Tool Execution Flow

### Call Chain

```
LLM requests tool call
  ↓
ToolRegistry.executeTool(toolName, args)
  ↓
MCPToolWrapper.execute()
  ├─ Validate tool exists
  ├─ Validate parameters against schema
  └─ Check permissions
  ↓
MCPClient.callTool(toolName, args)
  ↓
MCPTransport.send()
  ├─ Serialize request (JSON-RPC 2.0)
  ├─ Send via transport (stdio/SSE/HTTP)
  └─ Wait for response
  ↓
MCP Server processes request
  ↓
MCPTransport.receive()
  ├─ Deserialize response
  ├─ Check for errors
  └─ Extract result
  ↓
MCPToolWrapper.formatResult()
  ├─ Convert to internal format
  ├─ Handle errors gracefully
  └─ Add metadata
  ↓
Return result to LLM
```

**Error Handling:**

- Transport errors → Retry with backoff
- Server errors → Return error to LLM
- Timeout → Cancel and report
- Invalid response → Log and return error

## OAuth Flow

### OAuth 2.0 Integration

```
User initiates OAuth-required tool
  ↓
MCPClient detects missing auth
  ↓
MCPOAuthProvider.startFlow(serverName)
  ├─ Generate state token
  ├─ Build authorization URL
  └─ Open browser
  ↓
User authorizes in browser
  ↓
OAuth callback received
  ├─ Validate state token
  ├─ Exchange code for tokens
  └─ Store tokens securely
  ↓
MCPClient.setAuth(tokens)
  ├─ Update client configuration
  └─ Retry original request
  ↓
Tool call succeeds with auth
```

**Token Storage:**

- Encrypted storage in user config
- Automatic refresh when expired
- Secure deletion on logout

**Supported Flows:**

- Authorization Code (with PKCE)
- Client Credentials
- Device Code (for CLI)

## Health Monitoring

### Health Check System

```
MCPHealthMonitor.start()
  ↓
Periodic Health Checks (every 30s)
  ↓
For each connected server:
  ├─ Send health check request
  ├─ Measure response time
  └─ Check capabilities
  ↓
Evaluate Health Status
  ├─ Healthy: Response < 1s, all capabilities present
  ├─ Degraded: Response 1-5s, some capabilities missing
  └─ Unhealthy: No response or error
  ↓
Update Server Status
  ├─ Store in health registry
  ├─ Emit health event
  └─ Trigger actions if needed
  ↓
Auto-Recovery Actions
  ├─ Unhealthy → Attempt restart
  ├─ Degraded → Log warning
  └─ Healthy → Continue monitoring
```

**Health Metrics:**

- Response time (ms)
- Success rate (%)
- Error count
- Last successful check
- Uptime

**Recovery Strategies:**

- Immediate restart (1 attempt)
- Exponential backoff (2-5 attempts)
- Manual intervention required (> 5 failures)

## Transport Types

### stdio Transport

**Use Case:** Local MCP servers (Python, Node.js)

```
Configuration:
{
  "command": "python",
  "args": ["-m", "mcp_server"],
  "env": { "API_KEY": "..." }
}

Lifecycle:
1. Spawn child process
2. Pipe stdin/stdout
3. Send/receive JSON-RPC messages
4. Monitor process health
5. Kill process on shutdown
```

**Advantages:**

- Simple setup
- No network configuration
- Secure (local only)

**Disadvantages:**

- Process management overhead
- No remote access

### SSE Transport

**Use Case:** Remote MCP servers with streaming

```
Configuration:
{
  "url": "https://api.example.com/mcp",
  "headers": { "Authorization": "Bearer ..." }
}

Lifecycle:
1. Open SSE connection
2. Listen for events
3. Send requests via POST
4. Receive responses via SSE
5. Close connection on shutdown
```

**Advantages:**

- Real-time updates
- Server-sent events
- Works over HTTP

**Disadvantages:**

- Requires server support
- More complex error handling

### HTTP Transport

**Use Case:** Simple REST API MCP servers

```
Configuration:
{
  "url": "https://api.example.com/mcp",
  "method": "POST",
  "headers": { "Content-Type": "application/json" }
}

Lifecycle:
1. Send HTTP POST request
2. Wait for response
3. Parse JSON response
4. Return result
```

**Advantages:**

- Simple and universal
- Easy to debug
- Works everywhere

**Disadvantages:**

- No streaming
- Higher latency
- Polling required for updates

## Key Interconnections

### MCP Client → Tool Registry

- `MCPClient.listTools()` discovers tools
- `MCPSchemaConverter` converts schemas
- `ToolRegistry.registerTool()` makes tools available
- LLM sees tools in available tools list

### Tool Registry → MCP Client

- `ToolRegistry.executeTool()` routes to MCP
- `MCPToolWrapper` wraps MCP calls
- `MCPClient.callTool()` executes on server
- Result returned to LLM

### MCP Client → Health Monitor

- `MCPHealthMonitor` tracks all clients
- Periodic health checks via `MCPClient.healthCheck()`
- Status updates trigger events
- Auto-recovery via `MCPClient.restart()`

### OAuth Provider → MCP Client

- `MCPOAuthProvider` manages auth flows
- Tokens stored in `MCPClient` configuration
- Automatic token refresh
- Secure token storage

### Transport → MCP Client

- `MCPTransport` abstracts communication
- `MCPClient` uses transport for all requests
- Transport handles serialization/deserialization
- Error handling at transport level

---

## Integration with Other Systems

### Tool Registry Integration

- MCP tools are automatically registered in the Tool Registry
- Schema conversion happens during tool discovery
- MCP tools appear alongside built-in tools for the LLM
- Tool execution is routed through MCPClient

### Hook System Integration

- **IMPORTANT:** MCP OAuth authentication must happen BEFORE hook execution
- Hooks cannot trigger OAuth flows (no user interaction in hooks)
- Use MCP Panel UI to pre-authenticate OAuth-required servers
- Hooks can use MCP tools after authentication is complete

### Provider Integration

- MCP tools are passed to the provider alongside built-in tools
- Provider sees unified tool list (no distinction between MCP and built-in)
- Tool results are formatted consistently

---

## Configuration

### MCP Server Configuration

MCP servers are configured in `~/.ollm/mcp.json` (user-level) or `.ollm/mcp.json` (workspace-level):

```json
{
  "mcpServers": {
    "server-name": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "env": {
        "API_KEY": "your-api-key"
      },
      "transport": "stdio"
    }
  }
}
```

**Configuration Options:**

- `command` - Command to execute (for stdio transport)
- `args` - Command arguments
- `env` - Environment variables (supports substitution)
- `transport` - Transport type (stdio, sse, http)
- `url` - Server URL (for SSE/HTTP transports)
- `headers` - HTTP headers (for SSE/HTTP transports)

### Environment Variable Substitution

Environment variables can be used in configuration:

```json
{
  "env": {
    "API_KEY": "${GITHUB_TOKEN}"
  }
}
```

Substitution happens at runtime via `envSubstitution.ts`.

---

## Best Practices

### Server Configuration

- Use stdio transport for local servers (simplest and most secure)
- Use SSE transport for remote servers with streaming support
- Use HTTP transport for simple REST API servers
- Store sensitive data in environment variables, not in config files

### OAuth Authentication

- Pre-authenticate OAuth-required servers via MCP Panel UI
- Don't rely on hooks to trigger OAuth flows
- Store tokens securely (encrypted in user config)
- Implement automatic token refresh

### Health Monitoring

- Enable health monitoring for production servers
- Set appropriate health check intervals (default: 30s)
- Implement auto-recovery for critical servers
- Monitor health metrics in MCP Panel UI

### Error Handling

- Handle transport errors gracefully (retry with backoff)
- Return meaningful error messages to LLM
- Log errors for debugging
- Implement timeout handling

---

## Troubleshooting

### MCP Server Not Connecting

- Check server command and arguments
- Verify environment variables are set
- Check server logs for errors
- Test server manually outside OLLM CLI

### OAuth Flow Not Working

- Ensure OAuth is pre-authenticated via MCP Panel UI
- Check token storage location and permissions
- Verify OAuth configuration (client ID, secret, redirect URI)
- Check browser for authorization errors

### Tools Not Appearing

- Verify server is connected (check health status)
- Check tool discovery logs
- Verify schema conversion is working
- Check Tool Registry for registered tools

### Tool Execution Failing

- Verify tool parameters match schema
- Check server logs for errors
- Verify authentication is valid
- Check network connectivity (for remote servers)

---

## File Locations

| File                                             | Purpose                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `packages/core/src/mcp/mcpClient.ts`             | Main MCP client implementation           |
| `packages/core/src/mcp/mcpTransport.ts`          | Transport abstraction (stdio, SSE, HTTP) |
| `packages/core/src/mcp/mcpSchemaConverter.ts`    | Schema conversion (MCP → Internal)       |
| `packages/core/src/mcp/mcpToolWrapper.ts`        | Tool wrapper for MCP tools               |
| `packages/core/src/mcp/mcpHealthMonitor.ts`      | Health monitoring system                 |
| `packages/core/src/mcp/mcpOAuth.ts`              | OAuth 2.0 provider                       |
| `packages/core/src/mcp/config.ts`                | MCP configuration management             |
| `packages/core/src/mcp/envSubstitution.ts`       | Environment variable substitution        |
| `packages/core/src/mcp/types.ts`                 | Type definitions                         |
| `packages/cli/src/commands/mcpCommands.ts`       | MCP management CLI commands              |
| `packages/cli/src/commands/mcpHealthCommands.ts` | Health monitoring CLI commands           |
| `packages/cli/src/commands/mcpOAuthCommands.ts`  | OAuth CLI commands                       |
| `~/.ollm/mcp.json`                               | User-level MCP server configuration      |
| `.ollm/mcp.json`                                 | Workspace-level MCP server configuration |
