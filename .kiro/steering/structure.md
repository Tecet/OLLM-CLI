# Project Structure

```
repo/
├── package.json           # Root workspace config
├── tsconfig.base.json     # Shared TypeScript settings
├── esbuild.config.js      # Build configuration
├── eslint.config.js       # Linting rules
├── .prettierrc.json       # Formatting rules
├── packages/
│   ├── cli/               # CLI entry, UI components, command parsing
│   │   └── src/
│   │       ├── cli.tsx
│   │       ├── nonInteractive.ts
│   │       └── ui/
│   ├── core/              # Core runtime and business logic
│   │   └── src/
│   │       ├── agents/    # Agent delegation and sub-agents
│   │       ├── config/    # Configuration loading
│   │       ├── core/      # Chat runtime, turn handling
│   │       ├── extensions/# Extension loader
│   │       ├── hooks/     # Hook system
│   │       ├── mcp/       # MCP client integration
│   │       ├── provider/  # Provider registry and interfaces
│   │       ├── services/  # Session, compression, context
│   │       ├── tools/     # Tool registry and built-in tools
│   │       └── utils/
│   ├── ollm-bridge/       # Provider adapters and model management
│   │   └── src/
│   │       ├── provider/  # Local provider adapter
│   │       └── adapters/  # Message, tool, stream adapters
│   ├── a2a-server/        # Optional agent-to-agent server
│   └── test-utils/        # Shared test fixtures and helpers
├── schemas/               # JSON schemas
├── scripts/               # Build and utility scripts
└── docs/                  # Documentation
    └── dev/               # Development stage plans
```

## Package Responsibilities
- `cli`: Input handling, UI rendering, command parsing
- `core`: Tools, policy engine, hooks, extensions, MCP, agents, services
- `ollm-bridge`: Provider adapters and model management
- `test-utils`: Shared fixtures and helpers
