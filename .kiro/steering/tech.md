# Tech Stack

## Runtime & Language
- Node.js 20+
- TypeScript with strict mode
- ES modules (`type: module`)

## Build & Tooling
- npm workspaces monorepo
- esbuild for bundling
- Vitest for testing
- ESLint for linting
- Prettier for formatting

## UI Framework
- React + Ink for terminal UI

## Common Commands
```bash
npm install        # Install dependencies
npm run build      # Bundle CLI to dist/
npm run dev        # Development mode
npm run test       # Run tests with Vitest
npm run lint       # Run ESLint
npm run format     # Run Prettier
```

## TypeScript Configuration
- Target: ES2022
- Module resolution: NodeNext or Node16
- Strict mode enabled
- Each package extends `tsconfig.base.json`

## Key Dependencies

### AI/ML Integration
| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP integration |
| `@xenova/transformers` | Local embeddings for semantic search |
| `better-sqlite3` | Vector storage for codebase index |
| Custom HTTP client | Ollama API communication |

### File System & Search
| Package | Purpose |
|---------|---------|
| `fdir` | Fast directory traversal |
| `glob` | Glob pattern matching |
| `ignore` | .gitignore parsing |
| `picomatch` | Pattern matching |

### Text Processing
| Package | Purpose |
|---------|---------|
| `diff` | Text diffing for file edits |
| `marked` | Markdown parsing |
| `html-to-text` | HTML conversion |
| `js-yaml` | YAML parsing |

### Validation
| Package | Purpose |
|---------|---------|
| `zod` | TypeScript-first schema validation |
| `ajv` | JSON Schema validation |

### Code Execution
| Package | Purpose |
|---------|---------|
| `isolated-vm` | JavaScript sandbox |
| `vm2` | Alternative JavaScript sandbox |

### Vision & Media
| Package | Purpose |
|---------|---------|
| `sharp` | Image processing and resizing |
| `playwright` | Screenshot capture (optional) |

### Terminal & Shell
| Package | Purpose |
|---------|---------|
| `@xterm/headless` | Terminal emulation |
| `shell-quote` | Shell command parsing |

### Git Integration
| Package | Purpose |
|---------|---------|
| `simple-git` | Git operations |

### Cross-Platform Support
| Package | Purpose |
|---------|---------|
| `nvidia-smi` | NVIDIA GPU monitoring (Windows/Linux) |
| `rocm-smi` | AMD GPU monitoring (Linux) |
| Platform-specific APIs | Apple Silicon GPU monitoring (macOS) |

### CLI Utilities
| Package | Purpose |
|---------|---------|
| `yargs` | Argument parsing |
| `prompts` | Interactive prompts |
| `clipboardy` | Clipboard access |
| `dotenv` | Environment variables |

### UI Components
| Package | Purpose |
|---------|---------|
| `react` | React framework |
| `ink` | Terminal React renderer |
| `ink-spinner` | Loading spinners |
| `highlight.js` | Syntax highlighting |
| `lowlight` | Lowlight adapter |

## Development Dependencies

### Build Tools
| Package | Purpose |
|---------|---------|
| `esbuild` | Fast bundler |
| `tsx` | TypeScript execution |
| `typescript` | TypeScript compiler |

### Testing
| Package | Purpose |
|---------|---------|
| `vitest` | Test framework |
| `@vitest/coverage-v8` | Code coverage |
| `fast-check` | Property-based testing |
| `ink-testing-library` | Ink component testing |
| `msw` | Mock Service Worker |
| `mock-fs` | File system mocking |
| `memfs` | In-memory file system |

### Linting & Formatting
| Package | Purpose |
|---------|---------|
| `eslint` | Linting |
| `prettier` | Code formatting |
| `typescript-eslint` | TypeScript ESLint rules |
| `eslint-plugin-react` | React linting rules |
| `eslint-plugin-react-hooks` | React hooks linting |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OLLM_CONFIG_PATH` | Custom config file path |
| `OLLM_LOG_LEVEL` | Logging verbosity (debug, info, warn, error) |
| `OLLAMA_HOST` | Ollama server URL (default: http://localhost:11434) |
| `OLLM_INDEX_PATH` | Custom codebase index location |
| `OLLM_DISABLE_INDEXING` | Disable automatic codebase indexing |
| `OLLM_DISABLE_EXECUTION` | Disable code execution sandbox |
| `VLLM_HOST` | vLLM server URL (default: http://localhost:8000) |
| `VLLM_API_KEY` | vLLM API authentication key |
| `OPENAI_COMPATIBLE_HOST` | OpenAI-compatible server URL (default: http://localhost:1234) |
| `OPENAI_COMPATIBLE_API_KEY` | OpenAI-compatible API key |
| `NVIDIA_SMI_PATH` | Custom path to nvidia-smi executable |
| `XDG_CONFIG_HOME` | Linux config directory (default: ~/.config) |
| `XDG_DATA_HOME` | Linux data directory (default: ~/.local/share) |
| `XDG_CACHE_HOME` | Linux cache directory (default: ~/.cache) |
| `NO_COLOR` | Disable colored output |

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.ollm/config.yaml` | User-level settings |
| `.ollm/config.yaml` | Workspace-level settings |
| `.ollm/ollm.md` | Project context for AI |
| `~/.ollm/templates/` | User prompt templates |
| `.ollm/templates/` | Workspace prompt templates |
| `~/.ollm/snapshots/` | Context snapshots |
| `.ollm/snapshots/` | Workspace context snapshots |
| `tsconfig.base.json` | Shared TypeScript config |
| `eslint.config.js` | ESLint configuration |
| `.prettierrc.json` | Prettier configuration |

## Package Scopes

| Scope | Package |
|-------|---------|
| `@ollm/ollm-cli` | Main CLI entry point |
| `@ollm/ollm-cli-core` | Core runtime and business logic |
| `@ollm/ollm-bridge` | Provider adapters (Ollama) |
| `@ollm/test-utils` | Shared test utilities |
