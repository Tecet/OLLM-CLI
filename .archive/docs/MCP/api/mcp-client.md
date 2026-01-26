# MCP Client API Reference

**MCPClient Class API Documentation**

---

## Overview

The `MCPClient` class manages connections to MCP servers and tool execution.

---

## Constructor

```typescript
new MCPClient(config: MCPServerConfig)
```

**Parameters:**
```typescript
interface MCPServerConfig {
  serverName: string;
  command: string;
  args?: string[];
  transport: 'stdio' | 'sse' | 'http';
  env?: Record<string, string>;
  oauth?: OAuthConfig;
  healthCheck?: HealthCheckConfig;
}
```

**Example:**
```typescript
const client = new MCPClient({
  serverName: 'github',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  transport: 'stdio'
});
```

---

## Methods

### connect()

Connect to the MCP server.

```typescript
async connect(): Promise<void>
```

**Example:**
```typescript
await client.connect();
```

### disconnect()

Disconnect from the MCP server.

```typescript
async disconnect(): Promise<void>
```

### listTools()

List available tools.

```typescript
async listTools(): Promise<Tool[]>
```

**Returns:**
```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

**Example:**
```typescript
const tools = await client.listTools();
console.log(tools);
```

### callTool()

Execute a tool.

```typescript
async callTool(name: string, args: any): Promise<ToolResult>
```

**Parameters:**
- `name` - Tool name
- `args` - Tool arguments

**Returns:**
```typescript
interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

**Example:**
```typescript
const result = await client.callTool('read-file', {
  path: 'README.md'
});
console.log(result.content[0].text);
```

### listResources()

List available resources.

```typescript
async listResources(): Promise<Resource[]>
```

### listPrompts()

List available prompts.

```typescript
async listPrompts(): Promise<Prompt[]>
```

### isConnected()

Check if connected.

```typescript
isConnected(): boolean
```

---

## Events

```typescript
client.on('connected', () => {
  console.log('Connected');
});

client.on('disconnected', () => {
  console.log('Disconnected');
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.on('tool-called', (tool, args) => {
  console.log('Tool called:', tool);
});
```

---

## Example Usage

```typescript
import { MCPClient } from '@ollm/ollm-cli-core';

// Create client
const client = new MCPClient({
  serverName: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  transport: 'stdio'
});

// Connect
await client.connect();

// List tools
const tools = await client.listTools();
console.log('Available tools:', tools.map(t => t.name));

// Call tool
const result = await client.callTool('read-file', {
  path: 'README.md'
});
console.log('File contents:', result.content[0].text);

// Disconnect
await client.disconnect();
```

---

## Further Reading

- [API Overview](README.md)
- [Hook System API](hook-system.md)
- [Extension Manager API](extension-manager.md)
- [MCP Architecture](../MCP_architecture.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
