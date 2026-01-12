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
│   │       │   ├── modelManagementService.ts
│   │       │   ├── promptTemplateService.ts
│   │       │   ├── costTracker.ts
│   │       │   ├── gitService.ts
│   │       │   ├── mentionParser.ts
│   │       │   ├── contextLoader.ts
│   │       │   └── diffReviewer.ts
│   │       ├── index/        # Codebase indexing and RAG
│   │       │   ├── codebaseIndex.ts
│   │       │   ├── embeddingService.ts
│   │       │   └── vectorStore.ts
│   │       ├── output/       # Structured output
│   │       │   ├── structuredOutput.ts
│   │       │   └── jsonValidator.ts
│   │       ├── sandbox/      # Code execution
│   │       │   ├── codeExecutor.ts
│   │       │   ├── jsExecutor.ts
│   │       │   ├── pythonExecutor.ts
│   │       │   └── bashExecutor.ts
│   │       ├── vision/       # Image and vision support
│   │       │   ├── visionService.ts
│   │       │   └── screenshotService.ts
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
│   │       │   ├── mcp-tool.ts
│   │       │   ├── execute.ts
│   │       │   ├── extract.ts
│   │       │   ├── image-analyze.ts
│   │       │   ├── undo.ts
│   │       │   ├── export.ts
│   │       │   ├── copy.ts
│   │       │   └── git.ts
│   │       └── utils/
│   ├── ollm-bridge/          # Provider adapters and model management
│   │   └── src/
│   │       ├── provider/
│   │       │   ├── localProvider.ts      # Ollama adapter (Tier 1)
│   │       │   ├── vllmProvider.ts       # vLLM adapter (Tier 2)
│   │       │   └── openaiCompatibleProvider.ts  # OpenAI-compatible (Tier 3)
│   │       └── adapters/     # Message, tool, stream adapters
│   │           └── sseParser.ts          # Server-Sent Events parser
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
- Codebase indexing and semantic search
- Structured output with schema validation
- Code execution sandbox
- Vision and image analysis
- Productivity tools (undo, export, copy, templates)
- Cost tracking and budget monitoring
- Git integration and version control
- @-mention parsing and context loading
- Diff review and approval workflow

### `packages/ollm-bridge`
- Local provider adapter (Ollama - Tier 1)
- vLLM provider adapter (Tier 2 - high performance)
- OpenAI-compatible provider adapter (Tier 3 - universal)
- Message format translation
- Tool schema mapping
- Stream event handling (NDJSON and SSE)
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
| `packages/core/src/index/codebaseIndex.ts` | Codebase indexing and semantic search |
| `packages/core/src/output/structuredOutput.ts` | JSON schema enforcement |
| `packages/core/src/sandbox/codeExecutor.ts` | Code execution sandbox |
| `packages/core/src/vision/visionService.ts` | Image analysis and vision support |
| `packages/core/src/services/costTracker.ts` | Token usage and cost tracking |
| `packages/core/src/services/gitService.ts` | Git operations and version control |
| `packages/core/src/services/diffReviewer.ts` | Diff review and approval |
| `packages/core/src/context/vramMonitor.ts` | VRAM monitoring and memory management |
| `packages/core/src/context/contextPool.ts` | Dynamic context sizing |
| `packages/ollm-bridge/src/provider/vllmProvider.ts` | vLLM provider adapter |
| `packages/ollm-bridge/src/provider/openaiCompatibleProvider.ts` | OpenAI-compatible provider |
| `packages/cli/src/ui/AppContainer.tsx` | Main UI container |
| `schemas/settings.schema.json` | Configuration validation schema |
