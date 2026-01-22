# Model Context Protocol (MCP) Documentation

**OLLM CLI - MCP Integration**

Welcome to the MCP documentation for OLLM CLI. This guide covers the Model Context Protocol integration, including hooks, extensions, and MCP servers.

---

## 📚 Documentation Overview

### Quick Access
- **[📑 Complete Documentation Index](MCP_index.md)** - Comprehensive index with summaries
- **[🔧 Integration Guide](MCP-INTEGRATION-GUIDE.md)** - Complete MCP integration documentation
- **[🔍 Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions

### Getting Started
- **[Getting Started Guide](getting-started.md)** - Quick start guide for MCP, hooks, and extensions

### Core Documentation
- **[MCP Architecture](MCP_architecture.md)** - Complete system architecture and design (4,500+ lines)
- **[MCP Integration Guide](MCP_integration.md)** - Practical integration guide (1,200+ lines)
- **[MCP Commands Reference](MCP_commands.md)** - Complete CLI command reference (1,000+ lines)

### Feature Guides
- **[Hooks Guide](hooks/)** - Hook system documentation
- **[Extensions Guide](extensions/)** - Extension system documentation
- **[MCP Servers Guide](servers/)** - MCP server documentation

---

## 🚀 Quick Links

### For Users
- [Getting Started](getting-started.md) - Start here
- [Using Hooks](hooks/user-guide.md) - Automate workflows
- [Using Extensions](extensions/user-guide.md) - Extend functionality
- [CLI Commands](MCP_commands.md) - Command reference

### For Developers
- [Creating Hooks](hooks/development-guide.md) - Build custom hooks
- [Creating Extensions](extensions/development-guide.md) - Build extensions
- [Creating MCP Servers](servers/development-guide.md) - Build MCP servers
- [API Reference](api/) - API documentation

### For Administrators
- [OAuth Setup](servers/oauth-setup.md) - Configure OAuth
- [Health Monitoring](servers/health-monitoring.md) - Monitor MCP servers
- [Extension Marketplace](extensions/marketplace.md) - Manage extensions

---

## 🎯 What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that standardizes how applications provide context to LLMs. OLLM CLI implements MCP to enable:

### 1. **MCP Servers**
External tools and services that LLMs can use:
- File system operations
- Database queries
- API integrations
- Web searches
- Custom tools

### 2. **Hooks**
Event-driven automation for workflows:
- Pre/post-execution hooks
- File change hooks
- Custom event hooks
- Safety gates
- Workflow automation

### 3. **Extensions**
Modular functionality packages:
- Skills (prompt templates)
- Settings (configuration)
- MCP servers (tools)
- Hooks (automation)
- Hot-reload support

---

## 📖 Documentation Structure

```
docs/MCP/
├── README.md                    ← You are here
├── getting-started.md           Quick start guide
├── MCP_architecture.md          System architecture
├── MCP_integration.md           Integration guide
├── MCP_commands.md              CLI commands
├── hooks/                       Hook system docs
│   ├── README.md
│   ├── user-guide.md
│   ├── development-guide.md
│   └── protocol.md
├── extensions/                  Extension system docs
│   ├── README.md
│   ├── user-guide.md
│   ├── development-guide.md
│   ├── manifest-reference.md
│   └── marketplace.md
├── servers/                     MCP server docs
│   ├── README.md
│   ├── development-guide.md
│   ├── oauth-setup.md
│   └── health-monitoring.md
└── api/                         API reference
    ├── README.md
    ├── mcp-client.md
    ├── hook-system.md
    └── extension-manager.md
```

---

## 🎓 Learning Path

### Beginner
1. Read [Getting Started](getting-started.md)
2. Try [MCP Commands](MCP_commands.md)
3. Explore [Using Hooks](hooks/user-guide.md)
4. Install [Extensions](extensions/user-guide.md)

### Intermediate
1. Understand [MCP Architecture](MCP_architecture.md)
2. Follow [Integration Guide](MCP_integration.md)
3. Create [Custom Hooks](hooks/development-guide.md)
4. Build [Extensions](extensions/development-guide.md)

### Advanced
1. Develop [MCP Servers](servers/development-guide.md)
2. Configure [OAuth](servers/oauth-setup.md)
3. Set up [Health Monitoring](servers/health-monitoring.md)
4. Study [API Reference](api/)

---

## 🔑 Key Concepts

### MCP Client
The core component that connects to MCP servers and manages tool execution.

**Features:**
- Multiple transport types (stdio, SSE, HTTP)
- Tool discovery and execution
- Schema conversion
- Health monitoring
- OAuth support

**See:** [MCP Architecture](MCP_architecture.md#mcp-client)

### Hook System
Event-driven automation system for workflows and safety gates.

**Features:**
- 12 event types
- JSON protocol (stdin/stdout)
- Trust model (trusted/workspace/downloaded)
- Approval UI
- Debugging mode

**See:** [Hooks Guide](hooks/)

### Extension System
Modular packaging system for distributing functionality.

**Features:**
- Manifest-based configuration
- Skills, settings, servers, hooks
- Hot-reload support
- Sandboxing and permissions
- Marketplace integration

**See:** [Extensions Guide](extensions/)

---

## 💡 Common Use Cases

### Automate Workflows with Hooks
```bash
# Create a hook that runs tests before commits
/hooks create pre-commit "npm test"

# Create a hook that formats code on save
/hooks create on-save "prettier --write {file}"
```

**Learn more:** [Using Hooks](hooks/user-guide.md)

### Extend Functionality with Extensions
```bash
# Search for extensions
/extensions search github

# Install an extension
/extensions install github-integration

# List installed extensions
/extensions list
```

**Learn more:** [Using Extensions](extensions/user-guide.md)

### Connect to MCP Servers
```bash
# List available servers
/mcp list

# Check server health
/mcp health

# Configure OAuth
/mcp oauth login github
```

**Learn more:** [MCP Commands](MCP_commands.md)

---

## 🛠️ Development

### Creating Hooks
Hooks are simple executables that receive JSON on stdin and output JSON on stdout.

**Example:**
```json
{
  "event": "pre-execution",
  "context": { "prompt": "Hello world" }
}
```

**Learn more:** [Creating Hooks](hooks/development-guide.md)

### Creating Extensions
Extensions are directories with a manifest file and optional components.

**Structure:**
```
my-extension/
├── manifest.json
├── skills/
├── settings/
├── servers/
└── hooks/
```

**Learn more:** [Creating Extensions](extensions/development-guide.md)

### Creating MCP Servers
MCP servers implement the Model Context Protocol to provide tools to LLMs.

**Features:**
- Tool definitions
- Resource definitions
- Prompt definitions
- OAuth support
- Health checks

**Learn more:** [Creating MCP Servers](servers/development-guide.md)

---

## 🔍 Troubleshooting

### Common Issues

**MCP server won't start:**
- Check server configuration
- Verify dependencies installed
- Check logs: `/mcp health check <server>`

**Hook not executing:**
- Verify hook is trusted: `/hooks list`
- Check hook permissions
- Enable debug mode: `/hooks debug on`

**Extension not loading:**
- Check manifest syntax
- Verify extension enabled: `/extensions list`
- Check logs: `/extensions info <name>`

**OAuth not working:**
- Check OAuth configuration
- Verify redirect URI
- Check token status: `/mcp oauth status`

**See:** [Troubleshooting Guide](../troubleshooting.md)

---

## 📊 Status & Roadmap

### Implementation Status
- ✅ MCP Client (Weeks 1-4 complete)
- ✅ Hook System (Weeks 1-4 complete)
- ✅ Extension System (Weeks 1-4 complete)
- ⏳ Integration Testing (Week 5 pending)
- ⏳ UI Components (Week 5 pending)

**Overall:** 45% complete

### Roadmap
See MCP Roadmap (../../.dev/MCP/MCP_roadmap.md) for:
- Critical issues (3)
- High priority work (4)
- Testing gaps
- Documentation gaps
- Time estimates (260 hours remaining)

---

## 🤝 Contributing

### Documentation
- Report issues or suggest improvements
- Submit pull requests
- Add examples and tutorials

### Development
- See Development Documentation (../../.dev/MCP/)
- Follow Contributing Guide (../../CONTRIBUTING.md)
- Check Roadmap (../../.dev/MCP/MCP_roadmap.md)

---

## 📞 Support

### Resources
- [Main Documentation](../)
- [Troubleshooting](../troubleshooting.md)
- GitHub Issues (https://github.com/ollm/ollm-cli/issues)

### Community
- Discord: [Join our server](#)
- Forum: [Community forum](#)
- Twitter: [@ollm_cli](#)

---

## 📄 License

OLLM CLI is open source software. See [LICENSE](../../LICENSE) for details.

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Active Development
