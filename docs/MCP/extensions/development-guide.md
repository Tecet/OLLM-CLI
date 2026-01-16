# Extension Development Guide

**Creating Extensions for OLLM CLI**

Learn how to create, package, and distribute extensions.

---

## Quick Start

### Create Extension

```bash
mkdir my-extension
cd my-extension
```

### Create Manifest

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

### Add Components

```bash
# Add skills
mkdir skills
echo "# Code Review Template" > skills/code-review.md

# Add hooks
mkdir hooks
echo "#!/bin/bash" > hooks/pre-commit.sh
chmod +x hooks/pre-commit.sh

# Add settings
mkdir settings
echo '{"key": "value"}' > settings/defaults.json
```

### Package Extension

```bash
tar -czf my-extension.tar.gz .
```

### Test Extension

```bash
/extensions install ./my-extension.tar.gz
/extensions list
```

---

## Extension Structure

```
my-extension/
├── manifest.json          # Required
├── README.md             # Recommended
├── LICENSE               # Recommended
├── skills/               # Optional
│   ├── code-review.md
│   └── documentation.md
├── settings/             # Optional
│   └── defaults.json
├── servers/              # Optional
│   └── my-server.js
└── hooks/                # Optional
    ├── pre-commit.sh
    └── on-save.js
```

---

## Manifest Reference

See [Manifest Reference](manifest-reference.md) for complete schema.

**Required Fields:**
- `name` - Extension name (kebab-case)
- `version` - Semantic version (1.0.0)
- `description` - Short description
- `author` - Author name

**Optional Fields:**
- `license` - License (MIT, Apache-2.0, etc.)
- `homepage` - Project URL
- `repository` - Git repository URL
- `keywords` - Search keywords
- `components` - Component paths
- `permissions` - Required permissions
- `dependencies` - Extension dependencies

---

## Components

### Skills

Prompt templates in Markdown:

```markdown
# Code Review Template

Please review this code for:
- Code quality
- Best practices
- Security issues
- Performance concerns

Provide specific feedback and suggestions.
```

### Settings

Configuration in JSON:

```json
{
  "github": {
    "token": "${GITHUB_TOKEN}",
    "defaultRepo": "user/repo"
  }
}
```

### Servers

MCP servers (see [Server Development](../servers/development-guide.md)):

```javascript
#!/usr/bin/env node
// MCP server implementation
```

### Hooks

Automation scripts (see [Hook Development](../hooks/development-guide.md)):

```bash
#!/bin/bash
# Hook implementation
```

---

## Testing

### Local Testing

```bash
# Install locally
/extensions install ./my-extension.tar.gz

# Test components
/extensions info my-extension
/extensions enable my-extension

# Test functionality
# Use skills, hooks, servers, etc.
```

### Hot-Reload Development

```bash
# Install in dev mode
/extensions install ./my-extension --dev

# Enable hot-reload
/extensions watch my-extension

# Make changes - automatically reloaded
```

---

## Publishing

### Package Extension

```bash
# Create archive
tar -czf my-extension-1.0.0.tar.gz .

# Verify archive
tar -tzf my-extension-1.0.0.tar.gz
```

### GitHub Release

```bash
# Create release on GitHub
gh release create v1.0.0 my-extension-1.0.0.tar.gz

# Users can install:
# /extensions install https://github.com/user/repo/releases/download/v1.0.0/my-extension-1.0.0.tar.gz
```

### Extension Registry

Submit to official registry (when available):
1. Create GitHub repository
2. Add extension manifest
3. Submit pull request to registry
4. Users can install by name

---

## Best Practices

**Do:**
- ✅ Use semantic versioning
- ✅ Document all components
- ✅ Request minimal permissions
- ✅ Test thoroughly
- ✅ Provide examples

**Don't:**
- ❌ Request unnecessary permissions
- ❌ Include sensitive data
- ❌ Use absolute paths
- ❌ Depend on external services without documentation

---

## Further Reading

- [Extension System Overview](README.md)
- [Extension User Guide](user-guide.md)
- [Manifest Reference](manifest-reference.md)
- [Marketplace Guide](marketplace.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
