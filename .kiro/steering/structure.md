# Project Structure

```
ollm-cli/
├── package.json              # Root workspace config
├── tsconfig.base.json        # Shared TypeScript settings
├── esbuild.config.js         # Build configuration
├── eslint.config.js          # Linting rules
├── .prettierrc.json          # Formatting rules
├── packages/
│   ├── cli/                  # CLI entry, UI components, command parsing
│   │   └── src/
│   │       ├── cli.tsx           # Main entry point
│   │       ├── nonInteractive.ts # Headless mode execution
│   │       ├── config/           # CLI-specific configuration
│   │       ├── commands/         # Slash command implementations
│   │       └── ui/
│   │           ├── AppContainer.tsx
│   │           ├── contexts/     # React contexts
│   │           ├── components/   # UI components
│   │           │   ├── chat/     # Chat message components
│   │           │   ├── input/    # Input field components
│   │           │   ├── tools/    # Tool execution UI
│   │           │   └── model/    # Model picker, status
│   │           ├── hooks/        # Custom React hooks
│   │           └── themes/       # Theme definitions
│   ├── core/                 # Core runtime and business logic
│   │   └── src/
│   │       ├── agents/       # Agent delegation and sub-agents
│   │       ├── config/       # Configuration management
│   │       ├── context/      # Context management, VRAM monitoring
│   │       │   ├── vramMonitor.ts
│   │       │   ├── tokenCounter.ts
│   │       │   ├── contextPool.ts
│   │       │   ├── snapshotManager.ts
│   │       │   ├── compressionService.ts
│   │       │   └── memoryGuard.ts
│   │       ├── core/         # Chat runtime, turn handling
│   │       │   ├── chatClient.ts
│   │       │   ├── turn.ts
│   │       │   ├── reactToolHandler.ts
│   │       │   └── tokenLimits.ts
│   │       ├── extensions/   # Extension loader
│   │       ├── hooks/        # Hook system
│   │       │   ├── hookRegistry.ts
│   │       │   ├── hookPlanner.ts
│   │       │   ├── hookRunner.ts
│   │       │   └── trustedHooks.ts
│   │       ├── mcp/          # MCP client integration
│   │       │   ├── mcpClient.ts
│   │       │   ├── mcpTransport.ts
│   │       │   └── mcpSchemaConverter.ts
│   │       ├── policy/       # Approval policies
│   │       │   ├── policyEngine.ts
│   │       │   └── policyRules.ts
│   │       ├── provider/     # Provider registry and interfaces
│   │       │   ├── types.ts
│   │       │   └── registry.ts
│   │       ├── routing/      # Model routing
│   │       │   ├── modelRouter.ts
│   │       │   └── routingProfiles.ts
│   │       ├── services/     # Business logic services
│   │       │   ├── chatRecordingService.ts
│   │       │   ├── chatCompressionService.ts
│   │       │   ├── loopDetectionService.ts
│   │       │   ├── contextManager.ts
│   │       │   ├── fileDiscoveryService.ts
│   │       │   ├── environmentSanitization.ts
│   │       │   ├── shellExecutionService.ts
│   │       │   └── modelManagementService.ts
│   │       ├── tools/        # Tool registry and built-in tools
│   │       │   ├── tool-registry.ts
│   │       │   ├── read-file.ts
│   │       │   ├── write-file.ts
│   │       │   ├── edit-file.ts
│   │       │   ├── glob.ts
│   │       │   ├── grep.ts
│   │       │   ├── ls.ts
│   │       │   ├── shell.ts
│   │       │   ├── web-fetch.ts
│   │       │   ├── web-search.ts
│   │       │   ├── memory.ts
│   │       │   └── mcp-tool.ts
│   │       └── utils/
│   ├── ollm-bridge/          # Provider adapters and model management
│   │   └── src/
│   │       ├── provider/
│   │       │   └── localProvider.ts  # Ollama adapter
│   │       └── adapters/     # Message, tool, stream adapters
│   └── test-utils/           # Shared test fixtures and helpers
├── schemas/                  # JSON schemas
│   └── settings.schema.json
├── scripts/                  # Build and utility scripts
│   └── build.js
├── integration-tests/        # E2E tests
├── docs/                     # Documentation
│   ├── architecture.md
│   ├── context-management-plan.md
│   └── dev-draft/            # Development reference docs
└── .dev/                     # Development plan
    ├── development-plan.md
    └── stages/               # Stage-by-stage task breakdowns
```

## Package Responsibilities

### `packages/cli`
- Command-line argument parsing
- Terminal UI rendering (React + Ink)
- User input handling
- Display formatting and theming
- Session management UI
- Slash command implementations

### `packages/core`
- Provider-agnostic chat runtime
- Tool registration and execution
- Policy engine for tool confirmation
- Hook system for customization
- Extension loading and management
- MCP client integration
- Session recording and compression
- Context management and VRAM monitoring
- Agent delegation system

### `packages/ollm-bridge`
- Local provider adapter (Ollama)
- Message format translation
- Tool schema mapping
- Stream event handling
- Model management operations

### `packages/test-utils`
- Shared test fixtures
- Mock providers
- Test helpers

## Key File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/provider/types.ts` | Core interfaces (Message, ProviderAdapter, etc.) |
| `packages/core/src/tools/tool-registry.ts` | Tool registration and discovery |
| `packages/core/src/policy/policyEngine.ts` | Tool confirmation logic |
| `packages/core/src/hooks/hookRegistry.ts` | Hook registration and execution |
| `packages/cli/src/ui/AppContainer.tsx` | Main UI container |
| `schemas/settings.schema.json` | Configuration validation schema |
