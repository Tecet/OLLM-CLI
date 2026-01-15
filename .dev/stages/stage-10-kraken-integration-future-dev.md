# 🦑 Release Kraken - External LLM Integration for OLLM CLI

> **Purpose**: This document provides a complete, self-contained integration guide for adding "Release Kraken" functionality to OLLM CLI. It enables access to top-tier LLM coding agents (Codex CLI, Claude Code, Gemini CLI) and API-based models when local LLMs need assistance.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Components](#3-core-components)
4. [Integration Points](#4-integration-points)
5. [Implementation Tasks](#5-implementation-tasks)
6. [Code Specifications](#6-code-specifications)
7. [Configuration Schema](#7-configuration-schema)
8. [UI/UX Requirements](#8-uiux-requirements)
9. [Testing Strategy](#9-testing-strategy)
10. [Rollout Checklist](#10-rollout-checklist)

---

## 1. Executive Summary

### What is "Release Kraken"?

"Release Kraken" is an escape hatch feature for OLLM CLI that enables users to invoke powerful external LLM coding agents when their local open-source models struggle with complex tasks. It provides:

1. **CLI Bridge Access**: Execute terminal-based coding agents (Gemini CLI, Claude Code, Codex CLI) via subprocess or proxy
2. **API Provider Access**: Connect to mainstream LLM APIs (OpenAI, Anthropic, Google) for cloud-based reasoning
3. **Seamless Fallback**: Automatic or manual escalation from local models to Kraken providers
4. **Unified Interface**: Same tool/message format regardless of provider type

### Why "Kraken"?

The metaphor represents "unleashing" powerful external resources when needed - like releasing a mythical beast to handle challenges too great for normal means.

### Key Use Cases

| Scenario                | Kraken Response                             |
| ----------------------- | ------------------------------------------- |
| Complex refactoring     | Escalate to Claude Code or Codex            |
| Multi-file analysis     | Use Gemini's large context                  |
| Architectural decisions | Consult API-based o1/o3 models              |
| Debugging edge cases    | Combine local speed with external precision |

---

## 2. Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OLLM CLI Runtime                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      Provider Registry                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │ Local Bridge │  │ Kraken CLI   │  │ Kraken API Providers     │  │ │
│  │  │   (Ollama)   │  │   Bridge     │  │ (OpenAI, Anthropic, etc) │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                │                  │                    │
                ▼                  ▼                    ▼
        ┌───────────┐      ┌─────────────────┐    ┌──────────────┐
        │  Ollama   │      │ CLI Subprocess  │    │  HTTPS API   │
        │  Server   │      │ or HTTP Proxy   │    │   Endpoints  │
        └───────────┘      └─────────────────┘    └──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             ┌──────────┐  ┌─────────────┐  ┌──────────┐
             │ gemini   │  │ claude      │  │ codex    │
             │   CLI    │  │   CLI       │  │   CLI    │
             └──────────┘  └─────────────┘  └──────────┘
```

### Provider Types

| Provider Type | Transport         | Use Case                                      |
| ------------- | ----------------- | --------------------------------------------- |
| `local`       | HTTP (Ollama API) | Default local LLM                             |
| `kraken_cli`  | Subprocess/Proxy  | Terminal-based agents (Gemini, Claude, Codex) |
| `kraken_api`  | HTTPS             | Cloud LLM APIs (OpenAI, Anthropic, Google AI) |

---

## 3. Core Components

### 3.1 Kraken Provider Adapter

A new provider adapter type that implements the existing `ProviderAdapter` interface:

```typescript
// packages/core/src/provider/kraken-adapter.ts

interface KrakenProviderConfig {
    type: "kraken_cli" | "kraken_api";

    // CLI Bridge settings (for kraken_cli)
    cli?: {
        tool: "gemini" | "claude" | "codex";
        executablePath?: string;
        proxyUrl?: string; // e.g., http://host.docker.internal:9999
        proxyApiKey?: string;
        timeout?: number; // default: 120s
    };

    // API settings (for kraken_api)
    api?: {
        provider: "openai" | "anthropic" | "google";
        apiKey: string; // or env var reference: ${OPENAI_API_KEY}
        baseUrl?: string; // custom endpoint override
        model: string; // e.g., 'gpt-4o', 'claude-sonnet-4-20250514'
        maxTokens?: number;
    };
}
```

### 3.2 CLI Bridge Executor

Handles subprocess execution of terminal-based coding agents:

```typescript
// packages/core/src/kraken/cli-bridge.ts

interface CLIBridgeExecutor {
    /** Check if the CLI tool is available */
    healthCheck(): Promise<CLIHealthResult>;

    /** Execute prompt through CLI tool */
    execute(request: CLIBridgeRequest): AsyncIterable<ProviderEvent>;

    /** List available models for CLI tool */
    listModels(): Promise<ModelInfo[]>;
}

interface CLIBridgeRequest {
    prompt: string;
    model?: string;
    timeout?: number;
}

interface CLIHealthResult {
    available: boolean;
    version?: string;
    executablePath?: string;
    authRequired?: boolean;
    error?: string;
}
```

### 3.3 API Provider Executor

Handles HTTPS API calls to cloud LLM providers:

```typescript
// packages/core/src/kraken/api-provider.ts

interface APIProviderExecutor {
    /** Validate API key and connectivity */
    healthCheck(): Promise<APIHealthResult>;

    /** Execute chat completion */
    chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;

    /** List available models */
    listModels(): Promise<ModelInfo[]>;

    /** Count tokens in request */
    countTokens(request: ProviderRequest): Promise<number>;
}
```

### 3.4 Kraken Manager

Orchestrates Kraken provider selection and escalation:

```typescript
// packages/core/src/kraken/manager.ts

interface KrakenManager {
    /** Get all configured Kraken providers */
    listProviders(): KrakenProviderInfo[];

    /** Select best Kraken provider for task */
    selectProvider(task: KrakenTaskHint): KrakenProviderAdapter;

    /** Check availability of all Kraken providers */
    healthCheckAll(): Promise<Map<string, boolean>>;

    /** Release the Kraken - escalate to external provider */
    release(options: KrakenReleaseOptions): Promise<KrakenSession>;
}

interface KrakenTaskHint {
    complexity: "simple" | "medium" | "complex" | "expert";
    domain: "code" | "analysis" | "creative" | "general";
    contextSize: number; // tokens needed
    preferCLI?: boolean; // prefer CLI agents over API
}

interface KrakenReleaseOptions {
    provider?: string; // specific provider name, or auto-select
    inheritContext: boolean; // pass current conversation context
    returnToLocal: boolean; // return control to local model after
    maxTurns?: number; // limit Kraken interaction turns
}
```

---

## 4. Integration Points

### 4.1 Provider Registry Extension

Extend the existing provider registry to support Kraken providers:

```typescript
// packages/core/src/provider/registry.ts

// Add to ProviderType enum
type ProviderType = "local" | "kraken_cli" | "kraken_api";

// Extend registry methods
interface ProviderRegistry {
    // ... existing methods ...

    registerKrakenProvider(config: KrakenProviderConfig): void;
    getKrakenProviders(): KrakenProviderAdapter[];
    isKrakenAvailable(): boolean;
}
```

### 4.2 Slash Command Integration

Add `/kraken` slash command to CLI:

```typescript
// packages/cli/src/commands/kraken.ts

interface KrakenSlashCommand {
    name: "/kraken";
    aliases: ["/k", "/release"];
    description: "Release the Kraken - escalate to external LLM provider";

    subcommands: {
        "/kraken"; // Interactive provider selection
        "/kraken <prompt>"; // Direct query to default Kraken
        "/kraken status"; // Show Kraken provider status
        "/kraken config"; // Configure Kraken providers
        "/kraken history"; // Show Kraken usage history
    };
}
```

### 4.3 Hook System Integration

Add Kraken-specific hooks:

| Hook Event        | Trigger                   | Payload                                |
| ----------------- | ------------------------- | -------------------------------------- |
| `before_kraken`   | Before Kraken invocation  | `{ provider, prompt, context }`        |
| `after_kraken`    | After Kraken response     | `{ provider, response, tokens, cost }` |
| `kraken_escalate` | Auto-escalation triggered | `{ reason, from_model, to_provider }`  |

### 4.4 Policy Engine Extension

Add Kraken-specific policies:

```yaml
# ~/.ollm/config.yaml
policies:
    kraken:
        autoEscalate: false # Auto-escalate on local model failure
        confirmBeforeRelease: true # Ask before using Kraken
        maxCostPerSession: 5.00 # USD limit per session
        preferredProvider: "claude" # Default Kraken provider
        allowedProviders: # Whitelist
            - gemini-cli
            - claude-cli
            - openai-api
```

### 4.5 Context Management Integration

Handle context transfer between local and Kraken:

```typescript
interface KrakenContextTransfer {
    // Export current context for Kraken
    exportForKraken(options: ExportOptions): KrakenContext;

    // Import Kraken response back to local context
    importFromKraken(response: KrakenResponse): void;

    // Merge Kraken insights with local session
    mergeKrakenSession(session: KrakenSession): void;
}

interface KrakenContext {
    summary: string; // Compressed context summary
    recentMessages: Message[]; // Last N messages
    activeFiles: string[]; // Files being worked on
    currentTask: string; // Task description
    toolResults: ToolResult[]; // Recent tool outputs
}
```

---

## 5. Implementation Tasks

### Phase 1: Foundation (1-2 days)

| #   | Task                            | Deliverables                          |
| --- | ------------------------------- | ------------------------------------- |
| 1.1 | Create Kraken package structure | `packages/core/src/kraken/` directory |
| 1.2 | Define TypeScript interfaces    | All interfaces in `types.ts`          |
| 1.3 | Add Kraken config schema        | JSON schema in `schemas/`             |
| 1.4 | Update config loader            | Support `kraken` section in config    |

### Phase 2: CLI Bridge Executor (2-3 days)

| #   | Task                           | Deliverables                      |
| --- | ------------------------------ | --------------------------------- |
| 2.1 | Implement executable discovery | Find gemini/claude/codex on PATH  |
| 2.2 | Implement subprocess executor  | STDIN-based prompt execution      |
| 2.3 | Implement proxy mode           | HTTP POST to proxy server         |
| 2.4 | Add health check logic         | Version detection, auth status    |
| 2.5 | Implement stream parsing       | Parse CLI output to ProviderEvent |
| 2.6 | Handle Windows compatibility   | Use thread pool for subprocess    |

### Phase 3: API Provider Executor (2-3 days)

| #   | Task                        | Deliverables                  |
| --- | --------------------------- | ----------------------------- |
| 3.1 | Implement OpenAI adapter    | GPT-4o, o1, o3 support        |
| 3.2 | Implement Anthropic adapter | Claude 4 support              |
| 3.3 | Implement Google AI adapter | Gemini API support            |
| 3.4 | Add streaming support       | SSE parsing for each provider |
| 3.5 | Implement token counting    | Per-provider token estimation |
| 3.6 | Add cost tracking           | Track API usage costs         |

### Phase 4: Kraken Manager (1-2 days)

| #   | Task                         | Deliverables                   |
| --- | ---------------------------- | ------------------------------ |
| 4.1 | Implement provider selection | Task-based routing logic       |
| 4.2 | Implement auto-escalation    | Failure detection + escalation |
| 4.3 | Add session management       | Track Kraken sessions          |
| 4.4 | Implement cost limits        | Budget enforcement             |

### Phase 5: Provider Registry Integration (1 day)

| #   | Task                    | Deliverables                     |
| --- | ----------------------- | -------------------------------- |
| 5.1 | Extend ProviderRegistry | Add Kraken provider types        |
| 5.2 | Update provider loader  | Load Kraken config on startup    |
| 5.3 | Add provider hot-reload | Config changes apply immediately |

### Phase 6: CLI Integration (2-3 days)

| #   | Task                        | Deliverables               |
| --- | --------------------------- | -------------------------- |
| 6.1 | Implement `/kraken` command | All subcommands            |
| 6.2 | Add Kraken status UI        | Show in status bar         |
| 6.3 | Implement provider picker   | Interactive selection UI   |
| 6.4 | Add confirmation dialogs    | Policy-based confirmations |
| 6.5 | Implement cost display      | Show cost warnings         |

### Phase 7: Hook & Policy Integration (1-2 days)

| #   | Task                      | Deliverables             |
| --- | ------------------------- | ------------------------ |
| 7.1 | Add Kraken hook events    | All hook types           |
| 7.2 | Extend policy engine      | Kraken-specific policies |
| 7.3 | Implement budget tracking | Per-session cost limits  |

### Phase 8: Context Transfer (1-2 days)

| #   | Task                      | Deliverables                 |
| --- | ------------------------- | ---------------------------- |
| 8.1 | Implement context export  | Compress for Kraken handoff  |
| 8.2 | Implement response import | Parse and integrate response |
| 8.3 | Add session merging       | Merge Kraken insights        |

### Phase 9: Testing & Documentation (2-3 days)

| #   | Task                | Deliverables              |
| --- | ------------------- | ------------------------- |
| 9.1 | Unit tests          | All components covered    |
| 9.2 | Integration tests   | E2E Kraken flows          |
| 9.3 | Mock providers      | Test without real CLI/API |
| 9.4 | Write documentation | User guide, API docs      |

---

## 6. Code Specifications

### 6.1 CLI Execution Details

#### Command Shapes

```bash
# Gemini CLI - prompt via STDIN
echo "Your prompt here" | gemini --model gemini-2.5-flash

# Claude CLI - prompt via -p flag or STDIN
echo "Your prompt here" | claude -p --model claude-sonnet-4-20250514

# Codex CLI - exec mode
echo "Your prompt here" | codex exec --model gpt-5.2-codex
```

#### STDIN Protocol

**CRITICAL**: Always send prompt via STDIN to avoid Windows 8191 character limit.

```typescript
// Always include trailing newline to prevent Gemini hang
const input = `System: ${systemPrompt}
User: ${userPrompt}
`;

const result = await execWithStdin(executable, args, input + "\n");
```

#### Prompt Format

Build prompts as role-labeled text:

```
System: You are a helpful coding assistant. Focus on TypeScript and React.

User: How do I implement a custom hook for fetching data?
```

### 6.2 Executable Discovery

Search order for CLI tools:

```typescript
// packages/core/src/kraken/discovery.ts

const SEARCH_PATHS = {
    windows: [
        // PATH first
        "PATH",
        // npm global
        "%APPDATA%\\npm\\gemini.cmd",
        "%APPDATA%\\npm\\claude.cmd",
        "%APPDATA%\\npm\\codex.cmd",
        // Local installs
        "%LOCALAPPDATA%\\Programs\\*\\gemini.exe",
    ],
    unix: ["PATH", "~/.local/bin/", "/usr/local/bin/", "~/.npm-global/bin/"],
};

async function discoverExecutable(tool: CliTool): Promise<string | null> {
    // 1. Check PATH first using shutil.which equivalent
    const fromPath = await which(tool);
    if (fromPath) return fromPath;

    // 2. Check common install locations
    for (const path of SEARCH_PATHS[platform]) {
        if (await exists(expandPath(path))) {
            return expandPath(path);
        }
    }

    // 3. Return null with actionable error
    return null;
}
```

### 6.3 Output Parsing

Parse CLI output into structured events:

````typescript
// packages/core/src/kraken/parser.ts

interface ParsedOutput {
    text: string;
    codeBlocks: CodeBlock[];
    json?: unknown;
}

function parseCliOutput(raw: string): ParsedOutput {
    const codeBlocks: CodeBlock[] = [];
    let json: unknown = undefined;

    // Extract fenced code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(raw)) !== null) {
        const [, lang, content] = match;
        codeBlocks.push({ language: lang || "text", content });

        // If JSON block, parse it
        if (lang === "json") {
            try {
                json = JSON.parse(content);
            } catch {}
        }
    }

    return { text: raw, codeBlocks, json };
}
````

### 6.4 Health Check Implementation

```typescript
// packages/core/src/kraken/health.ts

async function checkCliHealth(tool: CliTool): Promise<CLIHealthResult> {
    const executable = await discoverExecutable(tool);

    if (!executable) {
        return {
            available: false,
            error: `${tool} CLI not found. Install with: npm install -g @${tool}/cli`,
        };
    }

    try {
        // Run version check with 5s timeout
        const { stdout } = await execWithTimeout(
            executable,
            ["--version"],
            5000
        );

        const version = parseVersion(stdout);

        // Check if auth is required
        const authRequired = await checkAuthRequired(tool, executable);

        return {
            available: true,
            version,
            executablePath: executable,
            authRequired,
        };
    } catch (error) {
        return {
            available: false,
            executablePath: executable,
            error: `Health check failed: ${error.message}`,
        };
    }
}

async function checkProxyHealth(
    proxyUrl: string,
    apiKey?: string
): Promise<ProxyHealthResult> {
    try {
        const response = await fetch(`${proxyUrl}/health`, {
            headers: apiKey ? { "X-API-Key": apiKey } : {},
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return {
            available: true,
            geminiAvailable: data.gemini_available,
            claudeAvailable: data.claude_available,
            codexAvailable: data.codex_available,
        };
    } catch (error) {
        return {
            available: false,
            error: `Proxy health check failed: ${error.message}`,
        };
    }
}
```

---

## 7. Configuration Schema

### 7.1 User Configuration (`~/.ollm/config.yaml`)

```yaml
# Kraken Configuration
kraken:
    # Enable/disable Kraken feature
    enabled: true

    # Default provider when /kraken is called without args
    defaultProvider: claude-cli

    # Session budget limit (USD)
    maxCostPerSession: 10.00

    # Auto-escalation settings
    autoEscalate:
        enabled: false
        triggerOn:
            - modelFailure # When local model returns error
            - contextOverflow # When context limit exceeded
            - userRequest # When user says "I need help"

    # CLI Bridge Providers
    cliProviders:
        gemini-cli:
            enabled: true
            tool: gemini
            executablePath: null # auto-discover
            proxyUrl: null # direct execution
            timeout: 120
            defaultModel: gemini-2.5-flash

        claude-cli:
            enabled: true
            tool: claude
            executablePath: null
            timeout: 180
            defaultModel: claude-sonnet-4-20250514

        codex-cli:
            enabled: true
            tool: codex
            timeout: 300
            defaultModel: gpt-5.2-codex

    # API Providers
    apiProviders:
        openai-api:
            enabled: true
            provider: openai
            apiKey: ${OPENAI_API_KEY}
            model: gpt-4o
            maxTokens: 8192

        anthropic-api:
            enabled: true
            provider: anthropic
            apiKey: ${ANTHROPIC_API_KEY}
            model: claude-sonnet-4-20250514
            maxTokens: 8192

        google-api:
            enabled: false
            provider: google
            apiKey: ${GOOGLE_API_KEY}
            model: gemini-2.0-flash
            maxTokens: 8192

    # Policy settings
    policies:
        confirmBeforeRelease: true
        showCostWarnings: true
        logKrakenUsage: true
        allowedProviders: null # null = allow all, or list specific
```

### 7.2 JSON Schema (`schemas/kraken-config.json`)

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "ollm-kraken-config",
    "title": "OLLM Kraken Configuration",
    "type": "object",
    "properties": {
        "kraken": {
            "type": "object",
            "properties": {
                "enabled": { "type": "boolean", "default": true },
                "defaultProvider": { "type": "string" },
                "maxCostPerSession": { "type": "number", "minimum": 0 },
                "autoEscalate": {
                    "type": "object",
                    "properties": {
                        "enabled": { "type": "boolean", "default": false },
                        "triggerOn": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "modelFailure",
                                    "contextOverflow",
                                    "userRequest"
                                ]
                            }
                        }
                    }
                },
                "cliProviders": {
                    "type": "object",
                    "additionalProperties": {
                        "$ref": "#/definitions/cliProvider"
                    }
                },
                "apiProviders": {
                    "type": "object",
                    "additionalProperties": {
                        "$ref": "#/definitions/apiProvider"
                    }
                }
            }
        }
    },
    "definitions": {
        "cliProvider": {
            "type": "object",
            "properties": {
                "enabled": { "type": "boolean" },
                "tool": {
                    "type": "string",
                    "enum": ["gemini", "claude", "codex"]
                },
                "executablePath": { "type": ["string", "null"] },
                "proxyUrl": { "type": ["string", "null"] },
                "proxyApiKey": { "type": ["string", "null"] },
                "timeout": { "type": "integer", "minimum": 1, "default": 120 },
                "defaultModel": { "type": "string" }
            },
            "required": ["tool"]
        },
        "apiProvider": {
            "type": "object",
            "properties": {
                "enabled": { "type": "boolean" },
                "provider": {
                    "type": "string",
                    "enum": ["openai", "anthropic", "google"]
                },
                "apiKey": { "type": "string" },
                "baseUrl": { "type": ["string", "null"] },
                "model": { "type": "string" },
                "maxTokens": { "type": "integer", "minimum": 1 }
            },
            "required": ["provider", "apiKey", "model"]
        }
    }
}
```

---

## 8. UI/UX Requirements

### 8.1 Slash Command Interface

#### `/kraken` - Interactive Mode

```
┌─────────────────────────────────────────────────────────┐
│ 🦑 Release Kraken - Select Provider                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CLI-Based Agents:                                      │
│  ● claude-cli     Claude Code (authenticated)     ✓    │
│  ○ gemini-cli     Gemini CLI (authenticated)      ✓    │
│  ○ codex-cli      OpenAI Codex (not found)        ✗    │
│                                                         │
│  API Providers:                                         │
│  ○ openai-api     GPT-4o                          ✓    │
│  ○ anthropic-api  Claude Sonnet                   ✓    │
│  ○ google-api     Gemini 2.0 Flash               ✓    │
│                                                         │
│  [Enter] Select  [Tab] Switch  [Esc] Cancel            │
└─────────────────────────────────────────────────────────┘
```

#### `/kraken status`

```
┌─────────────────────────────────────────────────────────┐
│ 🦑 Kraken Status                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Provider         Status    Model              Cost     │
│  ─────────────────────────────────────────────────────  │
│  claude-cli       ✓ Ready   sonnet             -        │
│  gemini-cli       ✓ Ready   gemini-2.5-flash   -        │
│  codex-cli        ✗ Not found                           │
│  openai-api       ✓ Ready   gpt-4o             $0.00    │
│  anthropic-api    ✓ Ready   claude-sonnet      $0.00    │
│                                                         │
│  Session Budget: $10.00 remaining                       │
│  Last Used: claude-cli (2 mins ago)                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Confirmation Dialog

When `confirmBeforeRelease: true`:

```
┌─────────────────────────────────────────────────────────┐
│ 🦑 Release Kraken?                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Provider: claude-cli                                   │
│  Model:    claude-sonnet-4-20250514                               │
│                                                         │
│  Context will be shared:                                │
│  • Current conversation (1,234 tokens)                  │
│  • Active files: 3 files                                │
│  • Recent tool outputs: 2 results                       │
│                                                         │
│  Estimated cost: ~$0.02 - $0.10                        │
│                                                         │
│  [Y] Yes, release  [N] Cancel  [A] Always allow        │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Status Bar Integration

Add Kraken indicator to the main CLI status bar:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ollm v1.0.0 │ Model: qwen2.5-coder:7b │ Context: 2.1K/8K │ 🦑 Ready  │
└────────────────────────────────────────────────────────────────────────┘
```

Status indicator states:

-   `🦑 Ready` - Kraken providers available
-   `🦑 Active` - Currently using Kraken
-   `🦑 ---` - No Kraken providers configured
-   `🦑 ⚠️` - Kraken budget exceeded

### 8.4 Kraken Response Display

When Kraken responds, visually differentiate from local model:

````
┌─────────────────────────────────────────────────────────┐
│ 🦑 Claude Code (claude-cli)                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Here's how to implement the custom hook...             │
│                                                         │
│  ```typescript                                          │
│  export function useFetch<T>(url: string) {             │
│    const [data, setData] = useState<T | null>(null);    │
│    // ...                                               │
│  }                                                      │
│  ```                                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Tokens: 847 in, 1,203 out │ Cost: $0.03 │ Time: 4.2s  │
└─────────────────────────────────────────────────────────┘
````

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Component             | Test Coverage                                   |
| --------------------- | ----------------------------------------------- |
| CLI Bridge Executor   | Subprocess spawning, STDIN handling, timeout    |
| API Provider Executor | Request formatting, SSE parsing, error handling |
| Kraken Manager        | Provider selection, escalation logic            |
| Discovery             | Executable search, PATH handling                |
| Parser                | Code block extraction, JSON parsing             |
| Health Check          | Version parsing, auth detection                 |

### 9.2 Integration Tests

```typescript
// integration-tests/kraken/

describe("Kraken CLI Bridge", () => {
    it("should execute gemini CLI with prompt", async () => {
        // Uses mock gemini executable
        const result = await krakenManager.release({
            provider: "gemini-cli",
            prompt: "Hello world",
        });
        expect(result.success).toBe(true);
    });

    it("should handle CLI timeout gracefully", async () => {
        const result = await krakenManager.release({
            provider: "slow-cli",
            timeout: 100,
        });
        expect(result.error).toContain("timeout");
    });

    it("should transfer context correctly", async () => {
        // Setup local session with context
        await localSession.addMessage({ role: "user", content: "Help me" });

        // Release Kraken with context
        const result = await krakenManager.release({
            inheritContext: true,
        });

        expect(result.contextTransferred).toBe(true);
    });
});

describe("Kraken API Provider", () => {
    it("should stream OpenAI response", async () => {
        const events: ProviderEvent[] = [];
        for await (const event of openaiAdapter.chatStream(request)) {
            events.push(event);
        }
        expect(events.some((e) => e.type === "text")).toBe(true);
        expect(events.some((e) => e.type === "finish")).toBe(true);
    });

    it("should respect cost limits", async () => {
        // Set low budget
        config.kraken.maxCostPerSession = 0.01;

        await expect(
            krakenManager.release({ provider: "openai-api" })
        ).rejects.toThrow("Budget exceeded");
    });
});
```

### 9.3 Mock Providers

Create mock CLI executables for testing:

```typescript
// packages/test-utils/src/kraken-mocks.ts

export function createMockCli(tool: string): MockCli {
    return {
        executable: path.join(FIXTURES_DIR, `mock-${tool}`),
        responses: new Map<string, string>(),

        setResponse(prompt: string, response: string) {
            this.responses.set(prompt, response);
        },

        async install() {
            // Create mock executable script
            await writeFile(
                this.executable,
                `
                #!/usr/bin/env node
                const input = await readStdin();
                const response = RESPONSES[input] || 'Default response';
                console.log(response);
            `
            );
        },
    };
}

export function createMockApiServer(): MockApiServer {
    return {
        server: null,
        port: 0,

        async start() {
            this.server = http.createServer((req, res) => {
                // Mock streaming response
                res.setHeader("Content-Type", "text/event-stream");
                res.write('data: {"type":"text","value":"Hello"}\n\n');
                res.write('data: {"type":"finish","reason":"stop"}\n\n');
                res.end();
            });
            await new Promise((resolve) => this.server.listen(0, resolve));
            this.port = this.server.address().port;
        },

        async stop() {
            await new Promise((resolve) => this.server.close(resolve));
        },
    };
}
```

---

## 10. Rollout Checklist

### Pre-Implementation

-   [ ] Review OLLM CLI architecture documentation
-   [ ] Identify all integration points in existing codebase
-   [ ] Set up development environment with test credentials
-   [ ] Install CLI tools for testing (gemini, claude, codex)

### Phase 1: Foundation

-   [ ] Create `packages/core/src/kraken/` directory structure
-   [ ] Define all TypeScript interfaces in `types.ts`
-   [ ] Create JSON schema for configuration
-   [ ] Update config loader to support `kraken` section
-   [ ] Add kraken section to default config template

### Phase 2: CLI Bridge

-   [ ] Implement executable discovery for all platforms
-   [ ] Implement subprocess execution with STDIN
-   [ ] Add Windows compatibility (thread pool)
-   [ ] Implement output parsing (text, code blocks, JSON)
-   [ ] Add health check for each CLI tool
-   [ ] Implement proxy mode for Docker scenarios
-   [ ] Write unit tests for CLI bridge

### Phase 3: API Providers

-   [ ] Implement OpenAI adapter (streaming)
-   [ ] Implement Anthropic adapter (streaming)
-   [ ] Implement Google AI adapter (streaming)
-   [ ] Add token counting for each provider
-   [ ] Implement cost tracking
-   [ ] Add API key validation
-   [ ] Write unit tests for API providers

### Phase 4: Kraken Manager

-   [ ] Implement provider registry extension
-   [ ] Implement provider selection logic
-   [ ] Add auto-escalation detection
-   [ ] Implement session management
-   [ ] Add cost limit enforcement
-   [ ] Write unit tests for manager

### Phase 5: CLI Integration

-   [ ] Implement `/kraken` slash command
-   [ ] Add interactive provider picker
-   [ ] Implement `/kraken status` subcommand
-   [ ] Add confirmation dialogs
-   [ ] Update status bar with Kraken indicator
-   [ ] Style Kraken responses differently
-   [ ] Write integration tests

### Phase 6: Hooks & Policies

-   [ ] Add `before_kraken` hook
-   [ ] Add `after_kraken` hook
-   [ ] Add `kraken_escalate` hook
-   [ ] Extend policy engine for Kraken
-   [ ] Implement budget tracking
-   [ ] Write policy tests

### Phase 7: Context Transfer

-   [ ] Implement context export
-   [ ] Implement context compression
-   [ ] Implement response import
-   [ ] Add session merging
-   [ ] Write context transfer tests

### Phase 8: Documentation & Polish

-   [ ] Write user documentation
-   [ ] Add configuration examples
-   [ ] Document troubleshooting guide
-   [ ] Add error messages for common issues
-   [ ] Performance optimization
-   [ ] Security review

### Post-Implementation

-   [ ] E2E testing with real providers
-   [ ] Beta testing with users
-   [ ] Collect feedback
-   [ ] Address issues
-   [ ] Release notes

---

## Appendix A: Error Messages

| Error             | Message                                                                                        | Resolution           |
| ----------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| CLI not found     | `gemini CLI not found. Install with: npm install -g @google/gemini-cli`                        | Install the CLI tool |
| Auth required     | `Claude CLI requires authentication. Run: claude login`                                        | Authenticate CLI     |
| Proxy unreachable | `Cannot connect to CLI proxy at http://host.docker.internal:9999`                              | Start proxy server   |
| Budget exceeded   | `Kraken budget exceeded ($10.00 limit). Increase maxCostPerSession or wait for session reset.` | Adjust budget        |
| Model not found   | `Model 'gpt-5' not found for openai-api. Available: gpt-4o, gpt-4-turbo`                       | Use valid model      |
| Timeout           | `Kraken request timed out after 120s. Increase timeout or try different provider.`             | Adjust timeout       |

---

## Appendix B: Cost Reference

| Provider  | Model               | Input (per 1M tokens)  | Output (per 1M tokens) |
| --------- | ------------------- | ---------------------- | ---------------------- |
| OpenAI    | gpt-4o              | $2.50                  | $10.00                 |
| OpenAI    | gpt-4-turbo         | $10.00                 | $30.00                 |
| Anthropic | claude-sonnet       | $3.00                  | $15.00                 |
| Anthropic | claude-opus         | $15.00                 | $75.00                 |
| Google    | gemini-2.0-flash    | $0.075                 | $0.30                  |
| CLI       | gemini/claude/codex | Free (uses local auth) | Free                   |

---

## Appendix C: Security Considerations

1. **API Key Storage**: Use environment variables or secure credential storage, never commit keys
2. **Context Sharing**: Warn users when sensitive context is being shared with external providers
3. **Cost Controls**: Enforce budget limits to prevent runaway costs
4. **Audit Logging**: Log all Kraken invocations for accountability
5. **Data Residency**: Document which providers send data to which regions

---

_Document Version: 1.0.0_
_Last Updated: January 2026_
_Target: OLLM CLI v1.x_
