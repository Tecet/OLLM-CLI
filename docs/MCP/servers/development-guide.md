# MCP Server Development Guide

**Creating MCP Servers for OLLM CLI**

Learn how to create MCP servers that provide tools to LLMs.

---

## Quick Start

### Using Official SDK

```javascript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-server',
  version: '1.0.0',
});

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'my-tool',
    description: 'My custom tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input text' }
      },
      required: ['input']
    }
  }]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'my-tool') {
    return {
      content: [{
        type: 'text',
        text: `Processed: ${args.input}`
      }]
    };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Server Capabilities

### Tools

Executable functions:

```javascript
{
  name: 'read-file',
  description: 'Read file contents',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' }
    },
    required: ['path']
  }
}
```

### Resources

Data sources:

```javascript
server.setRequestHandler('resources/list', async () => ({
  resources: [{
    uri: 'file:///path/to/file',
    name: 'My File',
    mimeType: 'text/plain'
  }]
}));
```

### Prompts

Prompt templates:

```javascript
server.setRequestHandler('prompts/list', async () => ({
  prompts: [{
    name: 'code-review',
    description: 'Code review template'
  }]
}));
```

---

## Transport Types

### stdio (Standard Input/Output)

```javascript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Configuration:**
```yaml
mcp:
  servers:
    my-server:
      command: "node"
      args: ["./server.js"]
      transport: "stdio"
```

### SSE (Server-Sent Events)

```javascript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const transport = new SSEServerTransport('/mcp', response);
await server.connect(transport);
```

**Configuration:**
```yaml
mcp:
  servers:
    my-server:
      url: "http://localhost:3000/mcp"
      transport: "sse"
```

### HTTP

```javascript
// HTTP transport implementation
```

**Configuration:**
```yaml
mcp:
  servers:
    my-server:
      url: "http://localhost:3000"
      transport: "http"
```

---

## Testing

### Manual Testing

```bash
# Test with echo
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node server.js

# Test with file
cat test-request.json | node server.js
```

### Automated Testing

```javascript
import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('My Server', () => {
  it('lists tools', async () => {
    const server = new Server({ name: 'test', version: '1.0.0' });
    // Setup handlers
    const result = await server.request({ method: 'tools/list' });
    expect(result.tools).toHaveLength(1);
  });
});
```

---

## Best Practices

**Do:**
- ✅ Validate all inputs
- ✅ Handle errors gracefully
- ✅ Use JSON Schema for validation
- ✅ Implement health checks
- ✅ Log errors appropriately

**Don't:**
- ❌ Execute arbitrary code
- ❌ Access sensitive files
- ❌ Make blocking operations
- ❌ Ignore security

---

## Further Reading

- MCP Specification (https://modelcontextprotocol.io)
- MCP SDK (https://github.com/modelcontextprotocol/sdk)
- [MCP Servers Overview](README.md)
- [OAuth Setup](oauth-setup.md)
- [Health Monitoring](health-monitoring.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
