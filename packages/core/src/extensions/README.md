# Extension System

The extension system provides a manifest-based approach to packaging and distributing custom functionality for OLLM CLI.

## Overview

Extensions are directories containing a `manifest.json` file that declares:

- **Hooks**: Event-driven scripts that run at specific lifecycle points
- **MCP Servers**: External processes that provide tools via Model Context Protocol
- **Settings**: Configuration options that integrate with the CLI config system
- **Skills**: Pre-defined prompt templates for common tasks

## Extension Structure

```
my-extension/
├── manifest.json          # Extension manifest (required)
├── hooks/                 # Hook scripts (optional)
│   ├── init.js
│   └── validate.js
├── servers/               # MCP server implementations (optional)
│   └── custom-server.js
└── skills/                # Skill prompt templates (optional)
    └── create-pr.md
```

## Manifest Format

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My custom extension",
  "mcpServers": {
    "custom": {
      "command": "node",
      "args": ["servers/custom-server.js"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  },
  "hooks": {
    "session_start": [
      {
        "name": "init",
        "command": "node",
        "args": ["hooks/init.js"]
      }
    ]
  },
  "settings": [
    {
      "name": "apiKey",
      "envVar": "MY_API_KEY",
      "sensitive": true,
      "description": "API key for custom service"
    }
  ],
  "skills": [
    {
      "name": "create-pr",
      "description": "Create a pull request",
      "prompt": "Create a pull request with the following changes..."
    }
  ]
}
```

## Extension Discovery

Extensions are discovered from:

1. User directory: `~/.ollm/extensions/`
2. Workspace directory: `.ollm/extensions/`

Each subdirectory containing a `manifest.json` is treated as an extension.

## Extension Lifecycle

1. **Discovery**: Scan configured directories for manifest files
2. **Loading**: Parse and validate manifests
3. **Registration**: Register hooks, start MCP servers, merge settings
4. **Execution**: Hooks execute on events, tools available to agent
5. **Cleanup**: On disable, unregister hooks and stop MCP servers

## Security Model

Extensions inherit the hook trust model:

- User extensions (`~/.ollm/extensions/`) are trusted by default
- Workspace extensions (`.ollm/extensions/`) require approval
- Downloaded extensions require approval

## Components

- **ExtensionManager**: Manages extension lifecycle (load, enable, disable)
- **ManifestParser**: Parses and validates manifest.json files
- **Extension Types**: TypeScript interfaces for all extension components

## Future Enhancements

- Extension marketplace for discovery and installation
- Extension dependencies and version constraints
- Extension sandboxing for enhanced security
- Extension hot-reloading during development
