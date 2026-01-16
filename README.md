# OLLM CLI

> A local-first command-line interface for open-source LLMs with intelligent context management, tools, hooks, and MCP integration.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

OLLM CLI brings the power of open-source large language models to your terminal with a focus on local-first operation, intelligent resource management, and extensibility. Built with TypeScript and React, it provides a modern terminal UI while maintaining compatibility with automation workflows.

---

## ✨ Features

### 🎨 Interactive Terminal UI
- **React + Ink powered interface** with streaming responses and real-time updates
- **Syntax highlighting** for code blocks with language detection
- **Status bar** showing model, context usage, and VRAM metrics
- **Tool execution preview** with diff visualization for file changes

### 🧠 Smart Context Management
- **Adaptive context sizing** based on available VRAM
- **Automatic compression** when approaching context limits
- **Snapshot and rollover** support for long conversations
- **Real-time monitoring** of token usage and memory consumption

### 🛠️ Powerful Tool System
- **Built-in tools**: File operations, shell execution, web fetch, search, memory
- **Policy-based confirmation**: ASK, AUTO, and YOLO approval modes
- **Diff preview** for file edits before applying changes
- **Output truncation** and streaming for long-running operations

### 🔌 Extensibility
- **Hook system** for event-driven automation and safety gates
- **Extension system** with manifest-based configuration
- **MCP integration** (Model Context Protocol) for external tools
- **Provider-agnostic** architecture supporting multiple LLM backends

### 💾 Session Management
- **Record and resume** conversations with full context
- **Automatic compression** to manage context limits
- **Loop detection** to prevent runaway tool calls
- **Session history** with searchable archives

### 🌐 Offline First
- **Works without internet** when models are installed locally
- **No telemetry** - all data stays on your machine
- **Local model management** - pull, list, and remove models

---

## 🚀 Quick Start

### Prerequisites

Before installing OLLM CLI, ensure you have:

- **Node.js 20 or higher** ([Download](https://nodejs.org/))
- **Ollama** running locally ([Install Ollama](https://ollama.com/))
- **4GB+ VRAM recommended** (CPU-only mode available but slower)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ollm-cli.git
cd ollm-cli

# Install dependencies
npm install

# Build the CLI
npm run build

# Run OLLM CLI
npm start
```

### Basic Usage

```bash
# Interactive mode with full TUI
ollm

# One-shot prompt (non-interactive)
ollm -p "Explain async/await in JavaScript"

# Select a specific model
ollm --model llama3.1:8b

# Use a different provider endpoint
ollm --host http://localhost:11434

# JSON output for automation
ollm -p "List 5 programming languages" --output json
```

---

## 📖 Usage Examples

### Example 1: Interactive Chat with Context Management

```bash
# Start interactive mode
ollm

# Inside the TUI, use slash commands:
/model use llama3.1:8b
/context auto
/context size 16384

# Chat with the model
> Explain how React hooks work

# Check context usage
/context

# Create a snapshot before a long operation
/context snapshot
```

### Example 2: File Operations with Tool Confirmation

```bash
# Start with a prompt that requires file operations
ollm -p "Read package.json and summarize the dependencies"

# The tool system will:
# 1. Show you what file will be read
# 2. Ask for confirmation (in ASK mode)
# 3. Execute and show results
# 4. Continue the conversation
```

### Example 3: Automation with JSON Output

```bash
# Get structured output for scripting
ollm -p "List the top 3 JavaScript frameworks" --output json

# Output:
# {
#   "response": "1. React\n2. Vue.js\n3. Angular",
#   "model": "llama3.1:8b",
#   "tokens": 156
# }
```

---

## ⚙️ System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 20.0.0 | 22.x LTS |
| **RAM** | 8GB | 16GB+ |
| **VRAM** | 4GB | 8GB+ |
| **Storage** | 10GB | 50GB+ (for models) |
| **OS** | Windows 10, macOS 11, Linux | Latest versions |

### Recommended Models by VRAM

| VRAM | Recommended Models | Context Sweet Spot |
|------|-------------------|-------------------|
| 4GB | Llama 3.2 3B, Qwen3 4B | 4K-8K tokens |
| 8GB | Llama 3.1 8B, Mistral 7B | 8K-16K tokens |
| 12GB | Gemma 3 12B, Phi-4 14B | 16K-32K tokens |
| 24GB+ | Qwen3 32B, Mixtral 8x7B | 32K-64K tokens |

---

## 📚 Documentation

### Core Documentation
- **[Configuration Guide](docs/configuration.md)** - Complete settings reference
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions

### Feature Documentation
- **[MCP Integration](docs/MCP/)** - Model Context Protocol integration
- **[Context Management](docs/Context/)** - Intelligent context and VRAM management
- **[Model Management](docs/Models/)** - Model routing, profiles, and templates
- **[Model Compatibility](docs/Models/model-compatibility.md)** - Tested models and compatibility matrix

### Development Documentation
- **[Development Setup](#development-setup)** - Contributing guide
- **[Project Structure](docs/structure.md)** - Codebase organization
- **[Tech Stack](docs/tech.md)** - Dependencies and tools

### Roadmap & Future Features
- **[Development Roadmap](docs/Development-Roadmap/)** - Complete roadmap documentation
- **[Roadmap Overview](docs/Development-Roadmap/roadmap.md)** - Completed and planned features
- **[Future Features](docs/Development-Roadmap/future-features.md)** - Quick reference for planned features
- **[Visual Roadmap](docs/Development-Roadmap/road_map_visual.md)** - Timeline and dependencies

---

## 🎯 Context Management

OLLM CLI features intelligent context management that adapts to your hardware:

### Slash Commands

```bash
# Check context status
/context

# Set context size manually
/context size 16384

# Enable auto-sizing based on VRAM
/context auto

# Create a snapshot before long operations
/context snapshot

# Restore from snapshot
/context restore <id>
```

### How It Works

1. **VRAM Monitoring**: Continuously monitors GPU memory usage
2. **Adaptive Sizing**: Adjusts context window based on available resources
3. **Compression**: Automatically compresses old messages when approaching limits
4. **Snapshots**: Save conversation state for rollover or recovery

---

## 🔧 Commands

### CLI Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-p, --prompt <text>` | One-shot prompt (non-interactive) | `ollm -p "Hello"` |
| `--model <name>` | Select specific model | `ollm --model llama3.1:8b` |
| `--provider <name>` | Select provider (ollama, openai) | `ollm --provider ollama` |
| `--host <url>` | Set provider endpoint | `ollm --host http://localhost:11434` |
| `--list-models` | List available models | `ollm --list-models` |
| `--pull-model <name>` | Download a model | `ollm --pull-model llama3.1:8b` |
| `--output <format>` | Output format (text, json, stream-json) | `ollm --output json` |
| `--debug` | Enable debug logging | `ollm --debug` |
| `--version` | Show version | `ollm --version` |
| `--help` | Show help | `ollm --help` |

### Interactive Slash Commands

| Command | Description |
|---------|-------------|
| `/model list` | List available models |
| `/model use <name>` | Switch to a different model |
| `/context` | Show context status and usage |
| `/context size <n>` | Set context size in tokens |
| `/context auto` | Enable automatic context sizing |
| `/session list` | List saved sessions |
| `/session resume <id>` | Resume a previous session |
| `/extensions list` | List installed extensions |
| `/help` | Show available commands |
| `/exit` | Exit the application |

---

## ⚙️ Configuration

OLLM CLI loads settings from multiple sources with the following precedence:

1. **CLI flags** (highest priority)
2. **Environment variables**
3. **Workspace settings** (`.ollm/settings.yaml`)
4. **User settings** (`~/.ollm/settings.yaml`)
5. **System defaults** (lowest priority)

### Configuration File Example

Create `~/.ollm/settings.yaml` or `.ollm/settings.yaml`:

```yaml
# Provider configuration
provider: ollama
providerConfig:
  ollama:
    host: http://localhost:11434
    timeout: 300000

# Model settings
model:
  name: llama3.1:8b
  options:
    temperature: 0.2
    num_ctx: 16384
    top_p: 0.9

# Context management
context:
  autoSize: true
  vramBuffer: 512
  kvQuantization: q8_0
  compression:
    enabled: true
    threshold: 0.8
    strategy: sliding-window

# Tool policy
tools:
  policy: ask  # ask, auto, yolo
  timeout: 30000

# UI preferences
ui:
  theme: dark
  syntaxHighlight: true
```

### Environment Variables

```bash
# Provider settings
export OLLM_PROVIDER=ollama
export OLLM_HOST=http://localhost:11434

# Model settings
export OLLM_MODEL=llama3.1:8b
export OLLM_CONTEXT_SIZE=16384

# Context optimization
export OLLM_KV_CACHE_TYPE=q8_0
export OLLM_AUTO_SIZE=true

# Logging
export OLLM_LOG_LEVEL=info  # debug, info, warn, error
export OLLM_DEBUG=false
```

---

## 🏗️ Project Structure

```
ollm-cli/
├── packages/
│   ├── cli/              # CLI entry point and UI components
│   │   ├── src/
│   │   │   ├── cli.tsx           # Main entry
│   │   │   ├── commands/         # Slash commands
│   │   │   └── ui/               # React components
│   │   └── package.json
│   │
│   ├── core/             # Core runtime and business logic
│   │   ├── src/
│   │   │   ├── context/          # Context management
│   │   │   ├── tools/            # Tool system
│   │   │   ├── hooks/            # Hook system
│   │   │   ├── services/         # Business logic
│   │   │   └── mcp/              # MCP integration
│   │   └── package.json
│   │
│   ├── ollm-bridge/      # Provider adapters
│   │   ├── src/
│   │   │   └── provider/         # Ollama, vLLM, OpenAI adapters
│   │   └── package.json
│   │
│   └── test-utils/       # Shared test utilities
│       └── package.json
│
├── docs/                 # Documentation
├── scripts/              # Build and utility scripts
├── schemas/              # JSON schemas
└── package.json          # Root workspace config
```

---

## 🛠️ Development Setup

### Prerequisites for Development

- Node.js 20+ and npm
- Git
- A code editor (VS Code recommended)
- Ollama installed and running

### Setup Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ollm-cli.git
cd ollm-cli

# 2. Install dependencies
npm install

# 3. Build all packages
npm run build

# 4. Run tests
npm test

# 5. Lint code
npm run lint

# 6. Format code
npm run format

# 7. Run the CLI in development
npm start
```

### Development Commands

```bash
# Build all packages
npm run build

# Run tests with coverage
npm test

# Run tests in watch mode
npm test -- --watch

# Lint all code
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format all code
npm run format

# Check formatting
npm run format -- --check
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages with esbuild |
| `npm run dev` | Development mode (not yet implemented) |
| `npm start` | Run the built CLI |
| `npm test` | Run all tests with Vitest |
| `npm run lint` | Lint code with ESLint |
| `npm run format` | Format code with Prettier |

### Testing

OLLM CLI uses Vitest for testing with property-based testing via fast-check:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- packages/core/src/context/vramMonitor.test.ts

# Run tests in watch mode
npm test -- --watch
```

---

## 🗺️ Roadmap

OLLM CLI is under active development. We have a clear roadmap for future features:

### ✅ Completed (v0.1.0)
- Interactive TUI with React + Ink
- Context management with VRAM monitoring
- Tool system with policy engine
- Session recording and compression
- Hook system for automation
- MCP integration
- Testing infrastructure

### 🔮 Planned Future Features

All future features are clearly marked as **"Planned for future development"** in the documentation. These stages are not yet scheduled and will be prioritized based on community feedback and resource availability:

- **🦑 Kraken Integration** - External LLM providers (OpenAI, Anthropic, Google AI) with cost tracking and auto-escalation
- **🛠️ Developer Productivity** - Git integration, @-mentions for context loading, and diff review workflows
- **🖥️ Cross-Platform Support** - Enhanced Windows, macOS, and Linux compatibility with platform-specific optimizations
- **🔌 Multi-Provider Support** - vLLM and OpenAI-compatible backends for expanded deployment options
- **📁 File Upload System** - Share images, code, and documents with the LLM through multiple upload methods
- **🧠 Intelligence Layer** - Semantic codebase search, structured output, sandboxed code execution, and vision support

**📋 [View Full Roadmap](docs/Development-Roadmap/)** - Detailed specifications, timelines, and contribution opportunities for each planned stage.

---

## 🧰 Tech Stack

### Runtime & Language
- **Node.js 20+** - JavaScript runtime
- **TypeScript 5.9** - Type-safe development
- **ES Modules** - Modern module system

### Build & Tooling
- **npm workspaces** - Monorepo management
- **esbuild** - Fast bundling
- **Vitest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting

### UI Framework
- **React 19** - UI library
- **Ink 6** - Terminal rendering

### Key Dependencies
- **yargs** - CLI argument parsing
- **yaml** - Configuration parsing
- **ajv** - JSON schema validation
- **fast-check** - Property-based testing

---

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

```
Copyright 2026 OLLM CLI Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

1. **Report Bugs** - Open an issue with details and reproduction steps
2. **Suggest Features** - Share your ideas in the discussions
3. **Submit Pull Requests** - Fix bugs or implement features
4. **Improve Documentation** - Help make the docs clearer
5. **Write Tests** - Increase test coverage

### Contribution Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow the code style** - Run `npm run lint` and `npm run format`
3. **Write tests** for new features
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description

### Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/yourusername/ollm-cli.git
cd ollm-cli

# 2. Create a feature branch
git checkout -b feature/my-feature

# 3. Make changes and test
npm install
npm run build
npm test

# 4. Commit with clear messages
git commit -m "feat: add new feature"

# 5. Push and create PR
git push origin feature/my-feature
```

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a welcoming environment

---

## 🙏 Acknowledgments

OLLM CLI is built on the shoulders of giants:

- **[Ollama](https://ollama.com/)** - Local LLM runtime
- **[React](https://react.dev/)** & **[Ink](https://github.com/vadimdemedes/ink)** - Terminal UI
- **[Vitest](https://vitest.dev/)** - Testing framework
- **[fast-check](https://fast-check.dev/)** - Property-based testing
- All our [contributors](https://github.com/yourusername/ollm-cli/graphs/contributors)

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ollm-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ollm-cli/discussions)

---

<div align="center">

**[⬆ Back to Top](#ollm-cli)**

Made with ❤️ by the OLLM CLI team

</div>
