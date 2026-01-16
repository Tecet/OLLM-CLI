# MCP Servers Documentation

**External Tools and Services for OLLM CLI**

MCP servers provide tools, resources, and prompts that LLMs can use through the Model Context Protocol.

---

## 📚 Documentation

### User Documentation
- **[OAuth Setup](oauth-setup.md)** - Configuring OAuth authentication ⏳ Coming soon
- **[Health Monitoring](health-monitoring.md)** - Monitoring server health ⏳ Coming soon

### Developer Documentation
- **[Development Guide](development-guide.md)** - Creating MCP servers ⏳ Coming soon

### Related Documentation
- **[Getting Started](../getting-started.md)** - Quick start with MCP servers
- **[MCP Commands](../MCP_commands.md)** - Server commands reference
- **[MCP Integration](../MCP_integration.md)** - Server configuration guide
- **[MCP Architecture](../MCP_architecture.md)** - MCP client architecture
- **[Extensions](../extensions/)** - Extensions (can include servers)
- **[API Reference](../api/mcp-client.md)** - MCP Client API ⏳ Coming soon

---

## 🎯 What are MCP Servers?

MCP servers are external processes that provide functionality to LLMs through the Model Context Protocol. They can provide:

### Server Capabilities

| Capability | Description | Examples |
|------------|-------------|----------|
| **Tools** | Executable functions | File operations, API calls, database queries |
| **Resources** | Data sources | Files, URLs, database records |
| **Prompts** | Prompt templates | Code review, documentation, analysis |

### Transport Types

| Transport | Description | Use Case |
|-----------|-------------|----------|
| **stdio** | Standard input/output | Local processes |
| **SSE** | Server-Sent Events | HTTP streaming |
| **HTTP** | HTTP requests | REST APIs |

---

## 🚀 Quick Start

### List Servers

```bash
# List all configured servers
/mcp list

# Check server health
/mcp health

# Check specific server
/mcp health check <server>
```

### Manage Servers

```bash
# Start a server
/mcp start <server>

# Stop a server
/mcp stop <server>

# Restart a server
/mcp restart <server>

# Show server status
/mcp status <server>
```

### Use Server Tools

Once a server is running, its tools are automatically available:

```bash
# Example: File operations
Can you read the contents of README.md?

# Example: GitHub operations
Show me the latest issues in my repository

# Example: Database queries
Query the users table and show me active users
```

---

## ⚙️ Configuration

### Server Configuration

MCP servers are configured in your OLLM config file:

**Location:** `~/.ollm/config.yaml` or `.ollm/config.yaml`

**Example:**
```yaml
mcp:
  servers:
    # Filesystem server
    filesystem:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
      transport: "stdio"
      enabled: true
      
    # GitHub server with OAuth
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      transport: "stdio"
      enabled: true
      oauth:
        provider: "github"
        clientId: "${GITHUB_CLIENT_ID}"
        clientSecret: "${GITHUB_CLIENT_SECRET}"
        scopes: ["repo", "user"]
        
    # Database server
    postgres:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-postgres"]
      transport: "stdio"
      enabled: true
      env:
        DATABASE_URL: "${POSTGRES_URL}"
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `command` | Yes | Executable command |
| `args` | No | Command arguments |
| `transport` | Yes | Transport type (stdio, sse, http) |
| `enabled` | No | Enable/disable server (default: true) |
| `env` | No | Environment variables |
| `oauth` | No | OAuth configuration |
| `healthCheck` | No | Health check settings |

**See:** [MCP Integration Guide](../MCP_integration.md) for detailed configuration

---

## 🔐 OAuth Authentication

Many MCP servers require OAuth for authentication:

### Configure OAuth

```bash
# Login to OAuth provider
/mcp oauth login <provider>

# Check OAuth status
/mcp oauth status

# List OAuth tokens
/mcp oauth list

# Revoke OAuth token
/mcp oauth revoke <provider>
```

### OAuth Configuration

**In config.yaml:**
```yaml
mcp:
  servers:
    github:
      oauth:
        provider: "github"
        clientId: "${GITHUB_CLIENT_ID}"
        clientSecret: "${GITHUB_CLIENT_SECRET}"
        scopes: ["repo", "user", "gist"]
        redirectUri: "http://localhost:3000/callback"
```

### Supported Providers

- GitHub
- Google
- Microsoft
- GitLab
- Bitbucket
- Custom OAuth 2.0 providers

**See:** [OAuth Setup Guide](oauth-setup.md) for detailed instructions

---

## 🏥 Health Monitoring

OLLM CLI monitors MCP server health automatically:

### Health Checks

```bash
# Check all servers
/mcp health

# Check specific server
/mcp health check <server>

# Show monitoring status
/mcp health status

# Start/stop monitoring
/mcp health start
/mcp health stop
```

### Health Check Configuration

**In config.yaml:**
```yaml
mcp:
  healthCheck:
    enabled: true
    interval: 30000        # Check every 30 seconds
    timeout: 5000          # 5 second timeout
    retries: 3             # Retry 3 times
    autoRestart: true      # Auto-restart on failure
```

### Health Events

The health monitor emits events:
- `server-healthy` - Server is healthy
- `server-unhealthy` - Server is unhealthy
- `server-restarted` - Server was restarted
- `server-failed` - Server failed to restart

**See:** [Health Monitoring Guide](health-monitoring.md) for detailed information

---

## 🛠️ Available Servers

### Official MCP Servers

| Server | Description | Package |
|--------|-------------|---------|
| **Filesystem** | File operations | `@modelcontextprotocol/server-filesystem` |
| **GitHub** | GitHub API | `@modelcontextprotocol/server-github` |
| **GitLab** | GitLab API | `@modelcontextprotocol/server-gitlab` |
| **PostgreSQL** | PostgreSQL database | `@modelcontextprotocol/server-postgres` |
| **MySQL** | MySQL database | `@modelcontextprotocol/server-mysql` |
| **SQLite** | SQLite database | `@modelcontextprotocol/server-sqlite` |
| **Brave Search** | Web search | `@modelcontextprotocol/server-brave-search` |
| **Google Drive** | Google Drive | `@modelcontextprotocol/server-gdrive` |
| **Slack** | Slack integration | `@modelcontextprotocol/server-slack` |

### Community Servers

- **AWS** - AWS services integration
- **Azure** - Azure services integration
- **Docker** - Docker container management
- **Kubernetes** - Kubernetes cluster management
- **Jira** - Jira issue tracking
- **Confluence** - Confluence documentation

**See:** [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for more servers

---

## 💡 Common Use Cases

### Development Workflow

```yaml
mcp:
  servers:
    filesystem:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
      
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      oauth:
        provider: "github"
        scopes: ["repo"]
        
    git:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-git"]
```

**Usage:**
```bash
# Read files
Show me the contents of src/main.ts

# Create PR
Create a pull request for the feature branch

# Check git status
What's the current git status?
```

### Data Analysis

```yaml
mcp:
  servers:
    postgres:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-postgres"]
      env:
        DATABASE_URL: "${POSTGRES_URL}"
        
    sqlite:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-sqlite", "./data.db"]
```

**Usage:**
```bash
# Query database
Show me the top 10 users by activity

# Analyze data
What's the average order value this month?

# Generate report
Create a sales report for Q4
```

### Content Creation

```yaml
mcp:
  servers:
    brave-search:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-brave-search"]
      env:
        BRAVE_API_KEY: "${BRAVE_API_KEY}"
        
    gdrive:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-gdrive"]
      oauth:
        provider: "google"
        scopes: ["drive.readonly"]
```

**Usage:**
```bash
# Research topic
Search for recent articles about AI

# Access documents
Read the document from Google Drive

# Create content
Write a blog post about the topic
```

---

## 🔧 Development

### Creating MCP Servers

MCP servers can be written in any language that supports JSON-RPC:

**Node.js Example:**
```javascript
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
        input: { type: 'string' }
      }
    }
  }]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  // Execute tool
  return { result: 'Tool executed' };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**See:** [Development Guide](development-guide.md) for detailed instructions

---

## 🔍 Debugging

### Check Server Status

```bash
# List servers with status
/mcp list

# Check server health
/mcp health check <server>

# Show server logs
/mcp logs <server>
```

### Common Issues

**Server won't start:**
- Check command and args
- Verify dependencies installed
- Check environment variables
- Review logs

**Server unhealthy:**
- Check health check settings
- Verify server is responding
- Check network connectivity
- Review error logs

**OAuth not working:**
- Verify OAuth configuration
- Check client ID and secret
- Verify redirect URI
- Check token status

**Tools not available:**
- Verify server is running
- Check tool registration
- Review server logs
- Restart server

---

## 📚 Further Reading

### User Documentation
- [OAuth Setup](oauth-setup.md) - OAuth configuration
- [Health Monitoring](health-monitoring.md) - Health monitoring

### Developer Documentation
- [Development Guide](development-guide.md) - Creating servers
- [API Reference](../api/mcp-client.md) - MCP client API

### Related Documentation
- [MCP Architecture](../MCP_architecture.md) - System architecture
- [MCP Integration](../MCP_integration.md) - Integration guide
- [MCP Commands](../MCP_commands.md) - Command reference

### External Resources
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

---

## 🤝 Contributing

Want to create or contribute MCP servers?

1. Read [Development Guide](development-guide.md)
2. Check [MCP Specification](https://modelcontextprotocol.io)
3. See [Contributing Guide](../../../CONTRIBUTING.md)
4. Submit to server registry

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Active Development
