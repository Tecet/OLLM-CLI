# MCP (Model Context Protocol) Integration

This module provides integration with MCP servers, enabling external tools to be used seamlessly within OLLM CLI.

## Overview

The MCP integration consists of several components:

- **MCPClient**: Manages MCP server lifecycle (start, stop, status)
- **MCPTransport**: Handles communication with MCP servers (stdio, SSE, HTTP)
- **MCPSchemaConverter**: Converts between MCP and internal tool schemas
- **MCPToolWrapper**: Wraps MCP tools as internal tools

## Architecture

```
┌─────────────────┐
│ Extension       │
│ Manager         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ MCP Client      │─────►│ MCP Transport   │
└────────┬────────┘      └────────┬────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ Tool Wrapper    │      │ MCP Server      │
└────────┬────────┘      │ (External)      │
         │               └─────────────────┘
         ▼
┌─────────────────┐
│ Tool Registry   │
└─────────────────┘
```

## Usage

### Starting an MCP Server

```typescript
import { DefaultMCPClient } from './mcp';

const client = new DefaultMCPClient();

await client.startServer('github', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
  transport: 'stdio',
  timeout: 10000,
});
```

### Getting Tools from a Server

```typescript
const tools = await client.getTools('github');
console.log('Available tools:', tools.map(t => t.name));
```

### Calling a Tool

```typescript
const result = await client.callTool('github', 'create_issue', {
  repo: 'owner/repo',
  title: 'Bug report',
  body: 'Description of the bug',
});
```

## Transport Types

### Stdio Transport

Communicates with MCP servers via stdin/stdout. This is the primary transport for local MCP servers.

```typescript
{
  command: 'node',
  args: ['server.js'],
  transport: 'stdio'
}
```

### SSE Transport

Communicates with MCP servers via Server-Sent Events over HTTP.

```typescript
{
  command: 'http://localhost:3000/mcp',
  transport: 'sse'
}
```

### HTTP Transport

Communicates with MCP servers via HTTP requests.

```typescript
{
  command: 'http://localhost:3000/mcp',
  transport: 'http'
}
```

## Error Handling

The MCP client handles various error scenarios:

- **Connection failures**: Retry with exponential backoff
- **Server crashes**: Detect and mark server as unavailable
- **Tool call timeouts**: Return timeout error to caller
- **Invalid responses**: Log error and return error result

All errors are isolated to prevent system crashes.

## Implementation Status

- ✅ Task 14: Foundation and interfaces defined
- ⏳ Task 15: MCPTransport implementation
- ⏳ Task 16: MCPClient implementation
- ⏳ Task 17: MCPSchemaConverter implementation
- ⏳ Task 18: MCPToolWrapper implementation
- ⏳ Task 19: Integration with ExtensionManager
- ⏳ Task 20: Environment variable handling
- ⏳ Task 28: Additional transports (SSE, HTTP)

## Requirements

This module implements the following requirements:

- **7.1**: MCP server startup and lifecycle management
- **7.2**: Stdio transport support
- **7.3**: SSE transport support
- **7.4**: HTTP transport support
- **7.5**: Connection timeout handling
- **7.6**: Server failure handling
- **7.7**: Tool discovery
- **7.8**: Server disconnection and cleanup
- **7.9**: Multi-server management
- **7.10**: Graceful shutdown

See [requirements.md](../../.kiro/specs/stage-05-hooks-extensions-mcp/requirements.md) for full details.
