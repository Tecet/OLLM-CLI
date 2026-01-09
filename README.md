# OLLM CLI

A local-first command-line interface for open-source LLMs with intelligent context management, tools, hooks, and MCP integration.

## Features

- **Interactive TUI** - React + Ink powered terminal interface with streaming responses
- **Smart Context Management** - Adaptive context sizing based on available VRAM with snapshot/rollover support
- **Tool System** - Built-in file, shell, and web tools with policy-based confirmation
- **Provider Agnostic** - Works with Ollama and OpenAI-compatible endpoints
- **Hook System** - Event-driven automation and safety gates
- **MCP Integration** - Model Context Protocol support for external tools
- **Session Recording** - Save and resume conversations
- **Offline First** - Works without internet when models are installed locally

## Quick Start

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Run interactive mode
ollm

# One-shot prompt
ollm -p "Explain async/await in JavaScript"

# Select a specific model
ollm --model llama3.1:8b
```

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) running locally (default provider)
- GPU with 4GB+ VRAM recommended (CPU-only mode available)

## Context Management

OLLM CLI features intelligent context management that adapts to your hardware:

```bash
# Check context status
/context

# Set context size
/context size 16384

# Enable auto-sizing based on VRAM
/context auto

# Create a snapshot before long operations
/context snapshot

# Restore from snapshot
/context restore <id>
```

### VRAM Guidelines

| VRAM | Recommended Models | Context Sweet Spot |
|------|-------------------|-------------------|
| 4GB | Llama 3.2 3B, Qwen3 4B | 4K-8K tokens |
| 8GB | Llama 3.1 8B, Mistral 7B | 8K-16K tokens |
| 12GB | Gemma 3 12B, Phi-4 14B | 16K-32K tokens |
| 24GB | Qwen3 32B, Mixtral 8x7B | 32K-64K tokens |

## Commands

### CLI Flags

```bash
ollm                          # Interactive mode
ollm -p "prompt"              # One-shot prompt
ollm --model <name>           # Select model
ollm --provider <name>        # Select provider
ollm --host <url>             # Set provider endpoint
ollm --list-models            # List available models
ollm --pull-model <name>      # Download model
ollm --output json            # JSON output for automation
```

### Slash Commands (Interactive)

```
/model list                   # List models
/model use <name>             # Switch model
/context                      # Context status
/context size <n>             # Set context size
/session list                 # List sessions
/session resume <id>          # Resume session
/extensions list              # List extensions
```

## Configuration

Settings are loaded from multiple sources (in order of precedence):
1. CLI flags
2. Environment variables
3. Workspace settings (`.ollm/settings.yaml`)
4. User settings (`~/.ollm/settings.yaml`)
5. System defaults

### Example Configuration

```yaml
provider: ollama
providerConfig:
  ollama:
    host: http://localhost:11434
    timeout: 300000

model:
  name: llama3.1:8b
  options:
    temperature: 0.2
    num_ctx: 16384

context:
  autoSize: true
  vramBuffer: 512
  kvQuantization: q8_0
  compression:
    enabled: true
    threshold: 0.8
```

### Environment Variables

```bash
OLLM_PROVIDER=ollama
OLLM_HOST=http://localhost:11434
OLLM_MODEL=llama3.1:8b
OLLM_CONTEXT_SIZE=16384
OLLM_KV_CACHE_TYPE=q8_0
```

## Project Structure

```
packages/
├── cli/           # CLI entry, UI components
├── core/          # Runtime, tools, hooks, services
├── ollm-bridge/   # Provider adapters
└── test-utils/    # Test helpers
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## Documentation

- [Architecture](docs/draft/architecture.md)
- [CLI Interface](docs/draft/cli-interface.md)
- [Configuration](docs/draft/configuration.md)
- [Tools System](docs/draft/tools.md)
- [Ollama Models Reference](docs/ollama_models.md)
- [Context Management Plan](docs/dev/context-management-plan.md)
- [Development Plan](docs/dev/olllm-master-plan.md)

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript, ES modules
- **Build**: esbuild
- **Test**: Vitest
- **UI**: React + Ink
- **Lint/Format**: ESLint, Prettier

## License

MIT

## Contributing

Contributions welcome! Please read the development documentation before submitting PRs.
