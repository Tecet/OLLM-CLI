# Extension System Documentation

**Modular Functionality for OLLM CLI**

The extension system enables modular packaging and distribution of functionality, including skills, settings, MCP servers, and hooks.

---

## 📚 Documentation

### User Documentation
- **[User Guide](user-guide.md)** - Using and managing extensions ⏳ Coming soon
- **[Marketplace Guide](marketplace.md)** - Finding and installing extensions ⏳ Coming soon

### Developer Documentation
- **[Development Guide](development-guide.md)** - Creating extensions ⏳ Coming soon
- **[Manifest Reference](manifest-reference.md)** - Manifest schema and options ⏳ Coming soon

### Related Documentation
- **[Getting Started](../getting-started.md)** - Quick start with extensions
- **[MCP Commands](../MCP_commands.md)** - Extension commands reference
- **[MCP Architecture](../MCP_architecture.md)** - Extension system architecture
- **[Hooks](../hooks/)** - Hook system (can be included in extensions)
- **[MCP Servers](../servers/)** - MCP servers (can be included in extensions)
- **[API Reference](../api/extension-manager.md)** - Extension Manager API ⏳ Coming soon

---

## 🎯 What are Extensions?

Extensions are modular packages that add functionality to OLLM CLI. They can include:

### Extension Components

| Component | Description | Examples |
|-----------|-------------|----------|
| **Skills** | Prompt templates | Code review, documentation, testing |
| **Settings** | Configuration | API keys, preferences, defaults |
| **Servers** | MCP servers | GitHub, databases, file systems |
| **Hooks** | Automation | Pre-commit, on-save, validation |

### Extension Benefits

- **Modularity** - Package related functionality together
- **Distribution** - Easy sharing and installation
- **Hot-reload** - Update without restart
- **Sandboxing** - Isolated execution
- **Permissions** - Fine-grained control

---

## 🚀 Quick Start

### Finding Extensions

```bash
# Search for extensions
/extensions search <keyword>

# Example: Search for GitHub extensions
/extensions search github

# Example: Search for database tools
/extensions search database
```

### Installing Extensions

```bash
# Install from URL
/extensions install https://example.com/extension.tar.gz

# Install from file
/extensions install ./my-extension.tar.gz

# Install from registry (when available)
/extensions install github-integration
```

### Managing Extensions

```bash
# List installed extensions
/extensions list

# Show extension details
/extensions info <name>

# Enable/disable
/extensions enable <name>
/extensions disable <name>

# Reload after changes
/extensions reload
```

---

## 📦 Extension Structure

### Basic Structure

```
my-extension/
├── manifest.json          # Required: Extension metadata
├── README.md             # Optional: Documentation
├── skills/               # Optional: Prompt templates
│   ├── code-review.md
│   └── documentation.md
├── settings/             # Optional: Configuration
│   └── defaults.json
├── servers/              # Optional: MCP servers
│   └── my-server.js
└── hooks/                # Optional: Automation
    ├── pre-commit.sh
    └── on-save.js
```

### Manifest File

**manifest.json:**
```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My awesome extension",
  "author": "Your Name",
  "license": "MIT",
  "components": {
    "skills": ["skills/*.md"],
    "settings": ["settings/*.json"],
    "servers": ["servers/*.js"],
    "hooks": ["hooks/*"]
  },
  "permissions": {
    "filesystem": ["read", "write"],
    "network": ["https://api.example.com"],
    "tools": ["read-file", "write-file"]
  }
}
```

**See:** [Manifest Reference](manifest-reference.md) for complete schema

---

## 💡 Common Use Cases

### Development Tools

**Example: Code Quality Extension**
```
code-quality/
├── manifest.json
├── hooks/
│   ├── format-on-save.sh    # Auto-format code
│   ├── lint-on-save.sh      # Run linter
│   └── test-pre-commit.sh   # Run tests
└── skills/
    ├── code-review.md       # Code review template
    └── refactor.md          # Refactoring template
```

### Integration Extensions

**Example: GitHub Extension**
```
github-integration/
├── manifest.json
├── servers/
│   └── github-server.js     # GitHub MCP server
├── hooks/
│   ├── auto-commit.sh       # Auto-commit changes
│   └── create-pr.sh         # Create pull requests
├── skills/
│   ├── pr-review.md         # PR review template
│   └── issue-triage.md      # Issue triage template
└── settings/
    └── github-config.json   # GitHub configuration
```

### Workflow Extensions

**Example: Documentation Extension**
```
documentation/
├── manifest.json
├── skills/
│   ├── api-docs.md          # API documentation template
│   ├── readme.md            # README template
│   └── changelog.md         # Changelog template
├── hooks/
│   └── update-docs.sh       # Auto-update docs
└── settings/
    └── doc-config.json      # Documentation settings
```

---

## 🔒 Permissions

Extensions request permissions in their manifest:

### Permission Types

| Permission | Description | Example |
|------------|-------------|---------|
| `filesystem` | File operations | `["read", "write"]` |
| `network` | Network access | `["https://api.github.com"]` |
| `tools` | Tool execution | `["read-file", "shell"]` |
| `hooks` | Hook events | `["pre-execution", "on-save"]` |
| `settings` | Settings access | `["read", "write"]` |

### Permission Approval

```bash
# Extensions request permissions on install
/extensions install my-extension
# Prompt: "my-extension requests filesystem:read,write. Allow? (y/n)"

# Review permissions
/extensions info my-extension

# Revoke permissions
/extensions revoke my-extension filesystem
```

---

## 🔄 Hot-Reload

Extensions support hot-reload for development:

### Enable Hot-Reload

```bash
# Enable hot-reload for an extension
/extensions watch <name>

# Disable hot-reload
/extensions unwatch <name>
```

### What Gets Reloaded

- ✅ Skills (prompt templates)
- ✅ Settings (configuration)
- ✅ Hooks (automation scripts)
- ⚠️ Servers (require restart)

### Development Workflow

```bash
# 1. Install extension in development mode
/extensions install ./my-extension --dev

# 2. Enable hot-reload
/extensions watch my-extension

# 3. Make changes to extension files

# 4. Changes are automatically reloaded

# 5. Test changes immediately
```

---

## 🛠️ Development

### Creating Extensions

**Step 1: Create Directory**
```bash
mkdir my-extension
cd my-extension
```

**Step 2: Create Manifest**
```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My extension",
  "author": "Your Name",
  "components": {}
}
```

**Step 3: Add Components**
```bash
# Add skills
mkdir skills
echo "# Code Review Template" > skills/code-review.md

# Add hooks
mkdir hooks
echo "#!/bin/bash" > hooks/pre-commit.sh
chmod +x hooks/pre-commit.sh
```

**Step 4: Package**
```bash
tar -czf my-extension.tar.gz .
```

**Step 5: Install**
```bash
/extensions install ./my-extension.tar.gz
```

**See:** [Development Guide](development-guide.md) for detailed instructions

---

## 📊 Extension Lifecycle

```
Install Extension
    ↓
Parse Manifest
    ↓
Request Permissions
    ↓
Extract Components
    ↓
Register Components
    ↓
Enable Extension
    ↓
Components Available
```

---

## 🔍 Debugging

### Check Extension Status

```bash
# List all extensions
/extensions list

# Show extension details
/extensions info <name>

# Check extension logs
/extensions logs <name>
```

### Common Issues

**Extension not loading:**
- Check manifest syntax
- Verify file paths
- Check permissions
- Enable extension

**Components not working:**
- Check component paths in manifest
- Verify file permissions
- Check logs
- Reload extension

**Hot-reload not working:**
- Verify watch is enabled
- Check file system events
- Restart extension
- Check logs

---

## 📚 Further Reading

### User Documentation
- [User Guide](user-guide.md) - Complete user guide
- [Marketplace Guide](marketplace.md) - Finding extensions

### Developer Documentation
- [Development Guide](development-guide.md) - Creating extensions
- [Manifest Reference](manifest-reference.md) - Manifest schema
- [API Reference](../api/extension-manager.md) - Extension API

### Related Documentation
- [Hooks](../hooks/) - Hook system
- [MCP Servers](../servers/) - MCP servers
- [MCP Architecture](../MCP_architecture.md) - System architecture

---

## 🌟 Featured Extensions

### Official Extensions

- **ollm-dev-tools** - Development tools and workflows
- **ollm-github** - GitHub integration
- **ollm-database** - Database tools
- **ollm-docs** - Documentation templates

### Community Extensions

- **code-quality** - Linting and formatting
- **test-automation** - Testing workflows
- **deployment** - Deployment automation
- **monitoring** - System monitoring

**See:** [Marketplace Guide](marketplace.md) for more extensions

---

## 🤝 Contributing

Want to create or contribute extensions?

1. Read [Development Guide](development-guide.md)
2. Check [Manifest Reference](manifest-reference.md)
3. See Contributing Guide (../../../CONTRIBUTING.md)
4. Submit to marketplace

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Active Development
