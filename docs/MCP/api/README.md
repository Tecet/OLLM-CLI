# MCP API Reference

**Developer API Documentation for OLLM CLI MCP System**

This section provides API reference documentation for developers working with the MCP system programmatically.

---

## 📚 API Documentation

### Core APIs
- **[MCP Client API](mcp-client.md)** - MCPClient class and methods ⏳ Coming soon
- **[Hook System API](hook-system.md)** - Hook registry and execution ⏳ Coming soon
- **[Extension Manager API](extension-manager.md)** - Extension management ⏳ Coming soon

### Related Documentation
- **[MCP Architecture](../MCP_architecture.md)** - System architecture and design
- **[MCP Integration](../MCP_integration.md)** - Integration examples
- **[Hooks](../hooks/)** - Hook system documentation
- **[Extensions](../extensions/)** - Extension system documentation
- **[MCP Servers](../servers/)** - MCP server documentation

---

## 🎯 Overview

The MCP system provides several APIs for programmatic access:

### API Categories

| API | Purpose | Use Cases |
|-----|---------|-----------|
| **MCP Client** | Connect to MCP servers | Tool execution, server management |
| **Hook System** | Event-driven automation | Workflow automation, safety gates |
| **Extension Manager** | Extension management | Loading, enabling, disabling extensions |

---

## 🚀 Quick Start

### MCP Client API

```typescript
import { MCPClient } from '@ollm/ollm-cli-core';

// Create client
const client = new MCPClient({
  serverName: 'my-server',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  transport: 'stdio'
});

// Connect
await client.connect();

// List tools
const tools = await client.listTools();

// Call tool
const result = await client.callTool('read-file', {
  path: 'README.md'
});

// Disconnect
await client.disconnect();
```

**See:** [MCP Client API](mcp-client.md)

### Hook System API

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core';

// Get registry
const registry = HookRegistry.getInstance();

// Register hook
await registry.register({
  name: 'my-hook',
  event: 'pre-execution',
  command: './my-hook.sh',
  trustLevel: 'workspace'
});

// Execute hooks
const results = await registry.executeHooks('pre-execution', {
  prompt: 'Hello world'
});

// List hooks
const hooks = registry.listHooks();
```

**See:** [Hook System API](hook-system.md)

### Extension Manager API

```typescript
import { ExtensionManager } from '@ollm/ollm-cli-core';

// Get manager
const manager = ExtensionManager.getInstance();

// Load extensions
await manager.loadExtensions();

// Install extension
await manager.install('https://example.com/extension.tar.gz');

// Enable extension
await manager.enable('my-extension');

// List extensions
const extensions = manager.listExtensions();
```

**See:** [Extension Manager API](extension-manager.md)

---

## 📖 Core Concepts

### MCP Client

The `MCPClient` class manages connections to MCP servers:

**Key Features:**
- Multiple transport types (stdio, SSE, HTTP)
- Tool discovery and execution
- Resource and prompt management
- Health monitoring
- OAuth support

**Lifecycle:**
```
Create Client → Connect → Use Tools → Disconnect
```

### Hook Registry

The `HookRegistry` manages hook registration and execution:

**Key Features:**
- Event-based hook execution
- Trust level management
- Approval workflow
- Debug mode
- Hook lifecycle management

**Lifecycle:**
```
Register Hook → Execute on Event → Process Response
```

### Extension Manager

The `ExtensionManager` handles extension loading and management:

**Key Features:**
- Extension discovery
- Manifest parsing
- Component registration
- Hot-reload support
- Permission management

**Lifecycle:**
```
Discover → Parse → Register → Enable → Use
```

---

## 🔧 TypeScript Types

### Common Types

```typescript
// MCP Server Configuration
interface MCPServerConfig {
  command: string;
  args?: string[];
  transport: 'stdio' | 'sse' | 'http';
  env?: Record<string, string>;
  oauth?: OAuthConfig;
  healthCheck?: HealthCheckConfig;
}

// Hook Configuration
interface HookConfig {
  name: string;
  event: HookEvent;
  command: string;
  args?: string[];
  trustLevel: 'trusted' | 'workspace' | 'downloaded';
  enabled?: boolean;
}

// Extension Manifest
interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  components: {
    skills?: string[];
    settings?: string[];
    servers?: string[];
    hooks?: string[];
  };
  permissions?: ExtensionPermissions;
}

// Tool Definition
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// Tool Call Result
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

---

## 💡 Common Patterns

### Pattern 1: Server Management

```typescript
import { MCPClient, MCPHealthMonitor } from '@ollm/ollm-cli-core';

// Create and connect server
const client = new MCPClient(config);
await client.connect();

// Set up health monitoring
const monitor = new MCPHealthMonitor();
monitor.addServer(client);
monitor.start();

// Handle health events
monitor.on('server-unhealthy', async (server) => {
  console.log(`Server ${server.name} is unhealthy`);
  await server.restart();
});
```

### Pattern 2: Hook Automation

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core';

const registry = HookRegistry.getInstance();

// Register multiple hooks
await Promise.all([
  registry.register({
    name: 'format-on-save',
    event: 'on-file-change',
    command: 'prettier',
    args: ['--write', '{file}']
  }),
  registry.register({
    name: 'test-pre-commit',
    event: 'on-git-commit',
    command: 'npm',
    args: ['test']
  })
]);

// Execute hooks with error handling
try {
  const results = await registry.executeHooks('on-file-change', {
    file: 'src/main.ts'
  });
  
  for (const result of results) {
    if (!result.allow) {
      console.log(`Hook ${result.hook} blocked: ${result.message}`);
    }
  }
} catch (error) {
  console.error('Hook execution failed:', error);
}
```

### Pattern 3: Extension Loading

```typescript
import { ExtensionManager } from '@ollm/ollm-cli-core';

const manager = ExtensionManager.getInstance();

// Load all extensions
await manager.loadExtensions();

// Filter enabled extensions
const enabled = manager.listExtensions()
  .filter(ext => ext.enabled);

// Access extension components
for (const ext of enabled) {
  const skills = ext.getSkills();
  const servers = ext.getServers();
  const hooks = ext.getHooks();
  
  // Register components
  for (const server of servers) {
    await mcpClient.addServer(server);
  }
  
  for (const hook of hooks) {
    await hookRegistry.register(hook);
  }
}
```

---

## 🔍 Error Handling

### MCP Client Errors

```typescript
try {
  await client.callTool('read-file', { path: 'missing.txt' });
} catch (error) {
  if (error instanceof MCPError) {
    console.error('MCP Error:', error.code, error.message);
  } else if (error instanceof TransportError) {
    console.error('Transport Error:', error.message);
  } else {
    console.error('Unknown Error:', error);
  }
}
```

### Hook Execution Errors

```typescript
try {
  const results = await registry.executeHooks('pre-execution', context);
} catch (error) {
  if (error instanceof HookExecutionError) {
    console.error('Hook failed:', error.hookName, error.message);
  } else if (error instanceof HookTimeoutError) {
    console.error('Hook timed out:', error.hookName);
  }
}
```

### Extension Loading Errors

```typescript
try {
  await manager.install(url);
} catch (error) {
  if (error instanceof ManifestError) {
    console.error('Invalid manifest:', error.message);
  } else if (error instanceof PermissionError) {
    console.error('Permission denied:', error.permission);
  } else if (error instanceof DownloadError) {
    console.error('Download failed:', error.message);
  }
}
```

---

## 📊 Events

### MCP Client Events

```typescript
client.on('connected', () => {
  console.log('Server connected');
});

client.on('disconnected', () => {
  console.log('Server disconnected');
});

client.on('tool-called', (tool, args) => {
  console.log('Tool called:', tool, args);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});
```

### Hook Registry Events

```typescript
registry.on('hook-registered', (hook) => {
  console.log('Hook registered:', hook.name);
});

registry.on('hook-executed', (hook, result) => {
  console.log('Hook executed:', hook.name, result);
});

registry.on('hook-failed', (hook, error) => {
  console.error('Hook failed:', hook.name, error);
});
```

### Extension Manager Events

```typescript
manager.on('extension-loaded', (extension) => {
  console.log('Extension loaded:', extension.name);
});

manager.on('extension-enabled', (extension) => {
  console.log('Extension enabled:', extension.name);
});

manager.on('extension-reloaded', (extension) => {
  console.log('Extension reloaded:', extension.name);
});
```

---

## 🛠️ Testing

### Testing with MCP Client

```typescript
import { MCPClient } from '@ollm/ollm-cli-core';
import { describe, it, expect } from 'vitest';

describe('MCPClient', () => {
  it('should connect to server', async () => {
    const client = new MCPClient({
      command: 'echo',
      args: ['test'],
      transport: 'stdio'
    });
    
    await client.connect();
    expect(client.isConnected()).toBe(true);
    
    await client.disconnect();
  });
  
  it('should call tool', async () => {
    const client = new MCPClient(config);
    await client.connect();
    
    const result = await client.callTool('test-tool', {
      input: 'test'
    });
    
    expect(result.content).toBeDefined();
    
    await client.disconnect();
  });
});
```

### Testing with Hooks

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core';
import { describe, it, expect } from 'vitest';

describe('HookRegistry', () => {
  it('should register hook', async () => {
    const registry = new HookRegistry();
    
    await registry.register({
      name: 'test-hook',
      event: 'pre-execution',
      command: 'echo',
      args: ['test']
    });
    
    const hooks = registry.listHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].name).toBe('test-hook');
  });
  
  it('should execute hook', async () => {
    const registry = new HookRegistry();
    await registry.register({
      name: 'test-hook',
      event: 'pre-execution',
      command: 'echo',
      args: ['{"allow":true}']
    });
    
    const results = await registry.executeHooks('pre-execution', {});
    expect(results[0].allow).toBe(true);
  });
});
```

---

## 📚 Further Reading

### API Documentation
- [MCP Client API](mcp-client.md) - Complete MCP client reference
- [Hook System API](hook-system.md) - Complete hook system reference
- [Extension Manager API](extension-manager.md) - Complete extension API

### Related Documentation
- [MCP Architecture](../MCP_architecture.md) - System architecture
- [MCP Integration](../MCP_integration.md) - Integration guide
- [Development Guides](../) - User and developer guides

### External Resources
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

## 🤝 Contributing

Want to contribute to the API?

1. Read [Contributing Guide](../../../CONTRIBUTING.md)
2. Check [Development Documentation](../../../.dev/MCP/)
3. Submit pull requests
4. Update API documentation

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Active Development
