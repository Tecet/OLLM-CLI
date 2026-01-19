# Design Document

## Overview

The Kraken Integration feature extends OLLM CLI's provider system to support external LLM providers, enabling users to access powerful cloud-based models and CLI-based coding agents when local models need assistance. This design implements a unified provider adapter pattern that seamlessly integrates with the existing architecture while adding new capabilities for subprocess execution, API communication, context transfer, and cost tracking.

The system introduces two new provider types:
- **CLI Bridge Providers**: Execute terminal-based coding agents (Gemini CLI, Claude Code, Codex CLI) via subprocess
- **API Providers**: Connect to cloud LLM APIs (OpenAI, Anthropic, Google AI) via HTTPS

Both provider types implement the existing `ProviderAdapter` interface, ensuring consistency with the local Ollama provider and enabling transparent switching between local and external models.

### Design Goals

1. **Seamless Integration**: Kraken providers should work identically to local providers from the user's perspective
2. **Cost Awareness**: Users should always know the cost implications before using paid APIs
3. **Security First**: API keys and sensitive data must be protected at all times
4. **Cross-Platform**: Consistent behavior across Windows, macOS, and Linux
5. **Fail Gracefully**: Clear error messages with actionable recovery steps
6. **Performance**: Minimize latency and overhead when using external providers

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      OLLM CLI Runtime                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Provider Registry (Extended)                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │   Local      │  │  Kraken CLI  │  │  Kraken API     │  │ │
│  │  │  Provider    │  │   Provider   │  │   Provider      │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Kraken Manager                            │ │
│  │  • Provider Selection    • Health Checks                    │ │
│  │  • Auto-Escalation       • Session Management               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                Context Transfer Service                     │ │
│  │  • Export Context        • Import Response                  │ │
│  │  • Compression           • Session Merging                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Cost Tracker                              │ │
│  │  • Token Counting        • Budget Enforcement               │ │
│  │  • Usage Logging         • Cost Estimation                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Integration with Existing Systems

The Kraken system integrates with existing OLLM CLI components:

1. **Provider Registry** (`packages/core/src/provider/registry.ts`): Extended to support Kraken provider types
2. **Policy Engine** (`packages/core/src/policy/policyEngine.ts`): Extended with Kraken-specific confirmation policies
3. **Hook System** (`packages/core/src/hooks/hookRegistry.ts`): New hook events for Kraken lifecycle
4. **CLI Commands** (`packages/cli/src/commands/`): New `/kraken` slash command
5. **Status Bar** (`packages/cli/src/ui/components/`): Kraken availability indicator
6. **Configuration** (`~/.ollm/config.yaml`): New `kraken` section in config.yaml
7. **Session Manager** (`packages/core/src/services/`): Integration for context transfer and session tracking
8. **Cost Tracker** (`packages/core/src/services/costTracker.ts`): Token usage and budget monitoring


## Components and Interfaces

### 1. Kraken Provider Adapters

#### KrakenCliProvider

Implements `ProviderAdapter` for CLI-based coding agents.

```typescript
// packages/core/src/kraken/providers/KrakenCliProvider.ts

export interface KrakenCliConfig {
  tool: 'gemini' | 'claude' | 'codex';
  executablePath?: string;
  proxyUrl?: string;
  proxyApiKey?: string;
  timeout: number;
  defaultModel: string;
}

export class KrakenCliProvider implements ProviderAdapter {
  readonly name: string;
  
  constructor(
    name: string,
    private config: KrakenCliConfig,
    private executor: CliExecutor
  ) {
    this.name = name;
  }
  
  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Build prompt from messages
    const prompt = this.buildPrompt(request);
    
    // Execute via subprocess or proxy
    const output = this.config.proxyUrl
      ? await this.executor.executeViaProxy(prompt, this.config)
      : await this.executor.executeDirect(prompt, this.config);
    
    // Parse output and yield events
    yield* this.parseOutput(output);
  }
  
  async countTokens(request: ProviderRequest): Promise<number> {
    // Estimate tokens using character count / 4
    return this.estimateTokens(request);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    // Return configured model
    return [{ name: this.config.defaultModel }];
  }
}
```

#### KrakenApiProvider

Implements `ProviderAdapter` for cloud LLM APIs.

```typescript
// packages/core/src/kraken/providers/KrakenApiProvider.ts

export interface KrakenApiConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
}

export class KrakenApiProvider implements ProviderAdapter {
  readonly name: string;
  
  constructor(
    name: string,
    private config: KrakenApiConfig,
    private client: ApiClient
  ) {
    this.name = name;
  }
  
  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Format request for specific API
    const apiRequest = this.formatRequest(request);
    
    // Stream response
    const stream = await this.client.streamChat(apiRequest, this.config);
    
    // Parse SSE events
    for await (const chunk of stream) {
      yield* this.parseChunk(chunk);
    }
  }
  
  async countTokens(request: ProviderRequest): Promise<number> {
    // Use provider-specific token counting
    return this.client.countTokens(request, this.config);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    // Fetch available models from API
    return this.client.listModels(this.config);
  }
}
```


### 2. CLI Executor

Handles subprocess execution and proxy communication for CLI tools.

```typescript
// packages/core/src/kraken/execution/CliExecutor.ts

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export class CliExecutor {
  /**
   * Execute CLI tool directly via subprocess
   */
  async executeDirect(
    prompt: string,
    config: KrakenCliConfig
  ): Promise<CliExecutionResult> {
    const executable = config.executablePath || await this.discover(config.tool);
    
    if (!executable) {
      throw new Error(`${config.tool} CLI not found`);
    }
    
    // Build command args
    const args = this.buildArgs(config);
    
    // Execute with STDIN (avoid Windows command length limit)
    const result = await this.execWithStdin(
      executable,
      args,
      prompt + '\n', // Trailing newline prevents Gemini hang
      config.timeout
    );
    
    return result;
  }
  
  /**
   * Execute CLI tool via HTTP proxy
   */
  async executeViaProxy(
    prompt: string,
    config: KrakenCliConfig
  ): Promise<CliExecutionResult> {
    const response = await fetch(`${config.proxyUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.proxyApiKey && { 'X-API-Key': config.proxyApiKey })
      },
      body: JSON.stringify({
        tool: config.tool,
        prompt,
        model: config.defaultModel,
        timeout: config.timeout
      }),
      signal: AbortSignal.timeout(config.timeout * 1000)
    });
    
    if (!response.ok) {
      throw new Error(`Proxy error: HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Discover CLI executable on system
   */
  private async discover(tool: string): Promise<string | null> {
    // Check PATH first
    const fromPath = await this.which(tool);
    if (fromPath) return fromPath;
    
    // Check platform-specific locations
    const searchPaths = this.getSearchPaths(tool);
    for (const path of searchPaths) {
      if (await this.exists(path)) {
        return path;
      }
    }
    
    return null;
  }
  
  /**
   * Execute process with STDIN input
   */
  private async execWithStdin(
    executable: string,
    args: string[],
    input: string,
    timeoutSeconds: number
  ): Promise<CliExecutionResult> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const proc = spawn(executable, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Timeout handler
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Execution timeout after ${timeoutSeconds}s`));
      }, timeoutSeconds * 1000);
      
      proc.on('close', (exitCode) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr,
          exitCode: exitCode || 0,
          duration: Date.now() - startTime
        });
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      
      // Write input to STDIN
      proc.stdin.write(input);
      proc.stdin.end();
    });
  }
}
```


### 3. API Client

Handles HTTPS communication with cloud LLM APIs.

```typescript
// packages/core/src/kraken/execution/ApiClient.ts

export class ApiClient {
  /**
   * Stream chat completion from API
   */
  async *streamChat(
    request: any,
    config: KrakenApiConfig
  ): AsyncIterable<any> {
    const url = this.getEndpoint(config);
    const headers = this.getHeaders(config);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`API error: HTTP ${response.status}`);
    }
    
    // Parse SSE stream
    yield* this.parseSSE(response.body!);
  }
  
  /**
   * Parse Server-Sent Events stream
   */
  private async *parseSSE(body: ReadableStream): AsyncIterable<any> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            yield JSON.parse(data);
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }
  
  /**
   * Count tokens using provider-specific API
   */
  async countTokens(
    request: ProviderRequest,
    config: KrakenApiConfig
  ): Promise<number> {
    switch (config.provider) {
      case 'openai':
        return this.countTokensOpenAI(request);
      case 'anthropic':
        return this.countTokensAnthropic(request);
      case 'google':
        return this.countTokensGoogle(request);
    }
  }
  
  /**
   * List available models from API
   */
  async listModels(config: KrakenApiConfig): Promise<ModelInfo[]> {
    const url = this.getModelsEndpoint(config);
    const headers = this.getHeaders(config);
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    return this.parseModels(data, config.provider);
  }
}
```


### 4. Kraken Manager

Orchestrates provider selection, health checks, and escalation.

```typescript
// packages/core/src/kraken/KrakenManager.ts

export interface KrakenTaskHint {
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  domain: 'code' | 'analysis' | 'creative' | 'general';
  contextSize: number;
  preferCLI?: boolean;
}

export interface KrakenReleaseOptions {
  provider?: string;
  inheritContext: boolean;
  returnToLocal: boolean;
  maxTurns?: number;
}

export interface KrakenSession {
  id: string;
  provider: string;
  startTime: number;
  endTime?: number;
  tokenUsage: { input: number; output: number };
  cost: number;
  success: boolean;
}

export class KrakenManager {
  constructor(
    private registry: ProviderRegistry,
    private contextTransfer: ContextTransferService,
    private costTracker: CostTracker,
    private config: KrakenConfig
  ) {}
  
  /**
   * List all configured Kraken providers
   */
  listProviders(): KrakenProviderInfo[] {
    return this.registry.list()
      .filter(name => name.startsWith('kraken-'))
      .map(name => ({
        name,
        type: this.getProviderType(name),
        available: this.healthStatus.get(name) || false
      }));
  }
  
  /**
   * Select best provider for task
   */
  selectProvider(hint: KrakenTaskHint): ProviderAdapter {
    const providers = this.listProviders().filter(p => p.available);
    
    if (providers.length === 0) {
      throw new Error('No Kraken providers available');
    }
    
    // Prefer CLI over API for cost efficiency
    if (hint.preferCLI !== false) {
      const cliProvider = providers.find(p => p.type === 'cli');
      if (cliProvider) {
        return this.registry.get(cliProvider.name)!;
      }
    }
    
    // Select based on complexity and context size
    const suitable = providers.filter(p => 
      this.isSuitable(p, hint)
    );
    
    if (suitable.length === 0) {
      // Fallback to first available
      return this.registry.get(providers[0].name)!;
    }
    
    // Use preferred provider if configured
    if (this.config.defaultProvider) {
      const preferred = suitable.find(p => 
        p.name === this.config.defaultProvider
      );
      if (preferred) {
        return this.registry.get(preferred.name)!;
      }
    }
    
    // Return first suitable
    return this.registry.get(suitable[0].name)!;
  }
  
  /**
   * Perform health checks on all providers
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const providers = this.listProviders();
    
    await Promise.all(
      providers.map(async (info) => {
        try {
          const provider = this.registry.get(info.name);
          if (!provider) {
            results.set(info.name, false);
            return;
          }
          
          const healthy = await this.healthCheck(provider);
          results.set(info.name, healthy);
        } catch {
          results.set(info.name, false);
        }
      })
    );
    
    this.healthStatus = results;
    return results;
  }
  
  /**
   * Release the Kraken - escalate to external provider
   */
  async release(options: KrakenReleaseOptions): Promise<KrakenSession> {
    // Check budget
    if (!this.costTracker.canAfford(this.config.maxCostPerSession)) {
      throw new Error('Session budget exceeded');
    }
    
    // Select provider
    const provider = options.provider
      ? this.registry.get(options.provider)
      : this.selectProvider({ complexity: 'complex', domain: 'code', contextSize: 0 });
    
    if (!provider) {
      throw new Error(`Provider not found: ${options.provider}`);
    }
    
    // Create session
    const session: KrakenSession = {
      id: crypto.randomUUID(),
      provider: provider.name,
      startTime: Date.now(),
      tokenUsage: { input: 0, output: 0 },
      cost: 0,
      success: false
    };
    
    // Export context if requested
    let context: KrakenContext | undefined;
    if (options.inheritContext) {
      context = await this.contextTransfer.exportForKraken();
    }
    
    return session;
  }
  
  /**
   * Check if auto-escalation should trigger
   */
  shouldEscalate(reason: EscalationReason): boolean {
    if (!this.config.autoEscalate.enabled) {
      return false;
    }
    
    return this.config.autoEscalate.triggerOn.includes(reason);
  }
}
```


### 5. Context Transfer Service

Manages context export, compression, and import between local and Kraken providers.

```typescript
// packages/core/src/kraken/ContextTransferService.ts

export interface KrakenContext {
  summary: string;
  recentMessages: Message[];
  activeFiles: string[];
  currentTask: string;
  toolResults: ToolResult[];
}

export class ContextTransferService {
  constructor(
    private compressionService: CompressionService,
    private sessionManager: SessionManager
  ) {}
  
  /**
   * Export current context for Kraken
   */
  async exportForKraken(options?: ExportOptions): Promise<KrakenContext> {
    const session = this.sessionManager.getCurrentSession();
    
    // Get recent messages
    const messages = session.getMessages();
    const recentMessages = messages.slice(-10); // Last 10 messages
    
    // Compress if needed
    const summary = await this.compressionService.summarize(messages);
    
    // Get active files from context
    const activeFiles = this.extractActiveFiles(messages);
    
    // Get current task
    const currentTask = this.extractCurrentTask(messages);
    
    // Get recent tool results
    const toolResults = this.extractToolResults(messages);
    
    return {
      summary,
      recentMessages,
      activeFiles,
      currentTask,
      toolResults
    };
  }
  
  /**
   * Import Kraken response back to local context
   */
  async importFromKraken(response: KrakenResponse): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    
    // Add Kraken response as assistant message
    session.addMessage({
      role: 'assistant',
      parts: [{ type: 'text', text: response.content }],
      metadata: {
        provider: 'kraken',
        krakenProvider: response.providerName,
        cost: response.cost,
        tokens: response.tokenUsage
      }
    });
  }
  
  /**
   * Merge Kraken session insights with local session
   */
  async mergeKrakenSession(krakenSession: KrakenSession): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    
    // Add metadata about Kraken usage
    session.addMetadata({
      krakenUsed: true,
      krakenProvider: krakenSession.provider,
      krakenCost: krakenSession.cost,
      krakenTokens: krakenSession.tokenUsage
    });
  }
  
  /**
   * Extract active files from messages
   */
  private extractActiveFiles(messages: Message[]): string[] {
    const files = new Set<string>();
    
    for (const msg of messages) {
      // Look for file paths in tool results
      if (msg.role === 'tool' && msg.name) {
        const content = msg.parts[0];
        if (content.type === 'text') {
          const matches = content.text.match(/[\w\-./]+\.(ts|js|py|java|go|rs)/g);
          if (matches) {
            matches.forEach(f => files.add(f));
          }
        }
      }
    }
    
    return Array.from(files);
  }
  
  /**
   * Extract current task from messages
   */
  private extractCurrentTask(messages: Message[]): string {
    // Get last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const content = messages[i].parts[0];
        if (content.type === 'text') {
          return content.text.slice(0, 200); // First 200 chars
        }
      }
    }
    
    return 'No current task';
  }
  
  /**
   * Extract recent tool results
   */
  private extractToolResults(messages: Message[]): ToolResult[] {
    const results: ToolResult[] = [];
    
    for (let i = messages.length - 1; i >= 0 && results.length < 5; i--) {
      if (messages[i].role === 'tool') {
        const content = messages[i].parts[0];
        if (content.type === 'text') {
          results.push({
            tool: messages[i].name || 'unknown',
            result: content.text.slice(0, 500) // First 500 chars
          });
        }
      }
    }
    
    return results.reverse();
  }
}
```


### 6. Cost Tracker

Tracks token usage and enforces budget limits for Kraken providers.

```typescript
// packages/core/src/kraken/CostTracker.ts

export interface TokenUsage {
  input: number;
  output: number;
}

export interface CostRecord {
  timestamp: number;
  provider: string;
  model: string;
  tokenUsage: TokenUsage;
  cost: number;
}

export class CostTracker {
  private sessionCost: number = 0;
  private records: CostRecord[] = [];
  
  // Pricing per 1M tokens (USD)
  private pricing = {
    'openai-gpt-4o': { input: 2.50, output: 10.00 },
    'openai-gpt-4-turbo': { input: 10.00, output: 30.00 },
    'anthropic-claude-sonnet': { input: 3.00, output: 15.00 },
    'anthropic-claude-opus': { input: 15.00, output: 75.00 },
    'google-gemini-flash': { input: 0.075, output: 0.30 }
  };
  
  /**
   * Calculate cost for token usage
   */
  calculateCost(
    provider: string,
    model: string,
    tokenUsage: TokenUsage
  ): number {
    const key = `${provider}-${model}`;
    const prices = this.pricing[key];
    
    if (!prices) {
      // Unknown pricing, estimate conservatively
      return (tokenUsage.input + tokenUsage.output) * 0.01 / 1000;
    }
    
    const inputCost = (tokenUsage.input / 1_000_000) * prices.input;
    const outputCost = (tokenUsage.output / 1_000_000) * prices.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Track usage and update session cost
   */
  trackUsage(
    provider: string,
    model: string,
    tokenUsage: TokenUsage
  ): number {
    const cost = this.calculateCost(provider, model, tokenUsage);
    
    this.sessionCost += cost;
    
    this.records.push({
      timestamp: Date.now(),
      provider,
      model,
      tokenUsage,
      cost
    });
    
    return cost;
  }
  
  /**
   * Check if budget allows for estimated cost
   */
  canAfford(maxCost: number): boolean {
    return this.sessionCost < maxCost;
  }
  
  /**
   * Get remaining budget
   */
  getRemainingBudget(maxCost: number): number {
    return Math.max(0, maxCost - this.sessionCost);
  }
  
  /**
   * Reset session cost (called on new session)
   */
  resetSession(): void {
    this.sessionCost = 0;
  }
  
  /**
   * Get usage history
   */
  getHistory(): CostRecord[] {
    return [...this.records];
  }
  
  /**
   * Estimate cost for a request
   */
  estimateCost(
    provider: string,
    model: string,
    estimatedTokens: number
  ): { min: number; max: number } {
    const key = `${provider}-${model}`;
    const prices = this.pricing[key];
    
    if (!prices) {
      return { min: 0, max: estimatedTokens * 0.02 / 1000 };
    }
    
    // Assume 70/30 split input/output for estimation
    const inputTokens = estimatedTokens * 0.7;
    const outputTokens = estimatedTokens * 0.3;
    
    const minCost = (inputTokens / 1_000_000) * prices.input;
    const maxCost = minCost + (outputTokens / 1_000_000) * prices.output;
    
    return { min: minCost, max: maxCost };
  }
}
```



## Data Models

### Configuration Schema

```typescript
// Kraken configuration structure
export interface KrakenConfig {
  enabled: boolean;
  defaultProvider?: string;
  maxCostPerSession: number;
  
  autoEscalate: {
    enabled: boolean;
    triggerOn: EscalationReason[];
  };
  
  cliProviders: Record<string, CliProviderConfig>;
  apiProviders: Record<string, ApiProviderConfig>;
  
  policies: {
    confirmBeforeRelease: boolean;
    showCostWarnings: boolean;
    logKrakenUsage: boolean;
    allowedProviders?: string[];
  };
}

export interface CliProviderConfig {
  enabled: boolean;
  tool: 'gemini' | 'claude' | 'codex';
  executablePath?: string;
  proxyUrl?: string;
  proxyApiKey?: string;
  timeout: number;
  defaultModel: string;
}

export interface ApiProviderConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
}

export type EscalationReason = 
  | 'modelFailure'
  | 'contextOverflow'
  | 'userRequest';
```

### Example Configuration File

```yaml
# ~/.ollm/config.yaml

kraken:
  enabled: true
  defaultProvider: kraken-gemini-cli
  maxCostPerSession: 10.00
  
  autoEscalate:
    enabled: true
    triggerOn:
      - modelFailure
      - contextOverflow
  
  cliProviders:
    gemini-cli:
      enabled: true
      tool: gemini
      executablePath: /usr/local/bin/gemini
      timeout: 120
      defaultModel: gemini-2.0-flash-exp
    
    claude-cli:
      enabled: true
      tool: claude
      timeout: 120
      defaultModel: claude-sonnet-4
    
    # Proxy mode example
    gemini-proxy:
      enabled: true
      tool: gemini
      proxyUrl: https://kraken-proxy.example.com
      proxyApiKey: $KRAKEN_PROXY_KEY
      timeout: 120
      defaultModel: gemini-2.0-flash-exp
  
  apiProviders:
    openai:
      enabled: true
      provider: openai
      apiKey: $OPENAI_API_KEY
      model: gpt-4o
      maxTokens: 4096
    
    anthropic:
      enabled: true
      provider: anthropic
      apiKey: $ANTHROPIC_API_KEY
      model: claude-sonnet-4
      maxTokens: 8192
    
    google:
      enabled: true
      provider: google
      apiKey: $GOOGLE_API_KEY
      baseUrl: https://generativelanguage.googleapis.com
      model: gemini-2.0-flash-exp
      maxTokens: 8192
  
  policies:
    confirmBeforeRelease: true
    showCostWarnings: true
    logKrakenUsage: true
    allowedProviders:
      - kraken-gemini-cli
      - kraken-claude-cli
```

### Configuration Validation

```typescript
// packages/core/src/kraken/config/validator.ts

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export class KrakenConfigValidator {
  private ajv: Ajv;
  
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }
  
  /**
   * Validate Kraken configuration
   */
  validate(config: unknown): ValidationResult {
    const schema = {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean' },
        defaultProvider: { type: 'string' },
        maxCostPerSession: { type: 'number', minimum: 0 },
        
        autoEscalate: {
          type: 'object',
          required: ['enabled', 'triggerOn'],
          properties: {
            enabled: { type: 'boolean' },
            triggerOn: {
              type: 'array',
              items: {
                enum: ['modelFailure', 'contextOverflow', 'userRequest']
              }
            }
          }
        },
        
        cliProviders: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['enabled', 'tool', 'timeout', 'defaultModel'],
            properties: {
              enabled: { type: 'boolean' },
              tool: { enum: ['gemini', 'claude', 'codex'] },
              executablePath: { type: 'string' },
              proxyUrl: { type: 'string', format: 'uri' },
              proxyApiKey: { type: 'string' },
              timeout: { type: 'number', minimum: 1 },
              defaultModel: { type: 'string' }
            }
          }
        },
        
        apiProviders: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['enabled', 'provider', 'apiKey', 'model', 'maxTokens'],
            properties: {
              enabled: { type: 'boolean' },
              provider: { enum: ['openai', 'anthropic', 'google'] },
              apiKey: { type: 'string' },
              baseUrl: { type: 'string', format: 'uri' },
              model: { type: 'string' },
              maxTokens: { type: 'number', minimum: 1 }
            }
          }
        },
        
        policies: {
          type: 'object',
          properties: {
            confirmBeforeRelease: { type: 'boolean' },
            showCostWarnings: { type: 'boolean' },
            logKrakenUsage: { type: 'boolean' },
            allowedProviders: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    };
    
    const valid = this.ajv.validate(schema, config);
    
    if (!valid) {
      return {
        valid: false,
        errors: this.ajv.errors?.map(err => ({
          field: err.instancePath,
          message: err.message || 'Validation error'
        })) || []
      };
    }
    
    return { valid: true, errors: [] };
  }
}
```

### Provider Information

```typescript
export interface KrakenProviderInfo {
  name: string;
  type: 'cli' | 'api';
  available: boolean;
  model?: string;
  cost?: number;
  lastUsed?: number;
}

export interface HealthCheckResult {
  available: boolean;
  version?: string;
  executablePath?: string;
  authRequired?: boolean;
  error?: string;
}
```

### Session and Usage Tracking

```typescript
export interface KrakenSession {
  id: string;
  provider: string;
  model: string;
  startTime: number;
  endTime?: number;
  tokenUsage: TokenUsage;
  cost: number;
  success: boolean;
  error?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface CostRecord {
  timestamp: number;
  provider: string;
  model: string;
  tokenUsage: TokenUsage;
  cost: number;
}
```

### Context Transfer

```typescript
export interface KrakenContext {
  summary: string;
  recentMessages: Message[];
  activeFiles: string[];
  currentTask: string;
  toolResults: ToolResult[];
}

export interface ToolResult {
  tool: string;
  result: string;
}

export interface KrakenResponse {
  providerName: string;
  model: string;
  content: string;
  tokenUsage: TokenUsage;
  cost: number;
  duration: number;
}
```



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### CLI Bridge Properties

Property 1: STDIN Prompt Delivery
*For any* prompt string (regardless of length), the CLI Bridge should send it via STDIN rather than command-line arguments
**Validates: Requirements 1.2**

Property 2: Output Parsing Completeness
*For any* CLI output containing text, code blocks, or JSON, the parser should extract all structured elements into corresponding ProviderEvent objects
**Validates: Requirements 1.3**

Property 3: Timeout Enforcement
*For any* CLI execution that exceeds the configured timeout, the executor should terminate the process and return a timeout error
**Validates: Requirements 1.4**

Property 4: Proxy Routing
*For any* configuration with a proxy URL, requests should be routed through the proxy instead of direct subprocess execution
**Validates: Requirements 1.7**

### API Provider Properties

Property 5: Request Formatting Consistency
*For any* ProviderRequest, the API client should format it according to the target provider's specification without losing information
**Validates: Requirements 2.2**

Property 6: SSE Parsing Completeness
*For any* valid Server-Sent Events stream, the parser should convert all events into ProviderEvent objects
**Validates: Requirements 2.3**

Property 7: Cost Calculation Accuracy
*For any* token usage (input and output tokens), the cost tracker should calculate cost using the correct provider pricing
**Validates: Requirements 2.4, 6.1**

Property 8: Retry with Exponential Backoff
*For any* network failure, the API client should retry up to 3 times with exponentially increasing delays
**Validates: Requirements 2.7**

### Health Check Properties

Property 9: Health Check Execution
*For any* configured provider, the health check should verify availability and return a status result
**Validates: Requirements 3.1, 3.2**

Property 10: Version Detection
*For any* CLI tool that supports `--version`, the health check should extract and return the version string
**Validates: Requirements 3.3**

Property 11: Authentication Detection
*For any* CLI tool, the health check should determine whether authentication is required
**Validates: Requirements 3.4**

Property 12: API Health Check Timeout
*For any* API provider health check, it should complete within 5 seconds or return a timeout error
**Validates: Requirements 3.5**

Property 13: Health Status Tracking
*For any* failed health check, the manager should log the failure reason and mark the provider as unavailable
**Validates: Requirements 3.6**

### Provider Selection Properties

Property 14: Task-Based Selection
*For any* task hint (complexity, domain, context size), the manager should select a provider that meets the requirements
**Validates: Requirements 4.2**

Property 15: CLI Provider Preference
*For any* selection with multiple available providers, CLI providers should be preferred over API providers when cost efficiency is prioritized
**Validates: Requirements 4.3**

Property 16: Preferred Provider Priority
*For any* configuration with a preferred provider, that provider should be selected when available and suitable
**Validates: Requirements 4.4**

Property 17: Unavailable Provider Exclusion
*For any* provider marked as unavailable, it should be excluded from selection options
**Validates: Requirements 4.5**

Property 18: Explicit Provider Selection
*For any* user-specified provider name, that provider should be used if it exists and is available
**Validates: Requirements 4.7**

### Context Transfer Properties

Property 19: Context Export Completeness
*For any* session with context inheritance enabled, the exported context should include summary, recent messages, active files, current task, and tool results
**Validates: Requirements 5.1, 5.2**

Property 20: Context Compression
*For any* context that exceeds the provider's limit, compression should reduce the size while preserving essential information
**Validates: Requirements 5.3**

Property 21: Response Import
*For any* Kraken response, it should be imported into the local session as an assistant message with metadata
**Validates: Requirements 5.4**

Property 22: Session Merging
*For any* Kraken session, insights should be merged with the local session without losing existing conversation history
**Validates: Requirements 5.5**

Property 23: Fallback on Transfer Failure
*For any* context transfer failure, the system should proceed with a minimal context summary rather than failing completely
**Validates: Requirements 5.6**

Property 24: Context Inheritance Toggle
*For any* request with context inheritance disabled, only the current prompt should be sent (no conversation history)
**Validates: Requirements 5.7**

### Cost Tracking Properties

Property 25: Budget Enforcement
*For any* session with a configured budget, requests should be rejected when the budget would be exceeded
**Validates: Requirements 6.2, 6.3**

Property 26: Budget Display
*For any* status request, the remaining budget and total session costs should be displayed accurately
**Validates: Requirements 6.4**

Property 27: Session Reset
*For any* new session, the budget counter should be reset to zero
**Validates: Requirements 6.5**

Property 28: Cost Warning Display
*For any* request with estimated cost above the warning threshold, a warning should be displayed before execution
**Validates: Requirements 6.6**

Property 29: Usage Logging
*For any* Kraken invocation when logging is enabled, a record should be created with timestamp, provider, tokens, and cost
**Validates: Requirements 6.7**

### Auto-Escalation Properties

Property 30: Escalation Trigger Detection
*For any* configured escalation reason (model failure, context overflow, user request), the manager should trigger escalation when that condition occurs
**Validates: Requirements 9.1, 9.2, 9.3**

Property 31: Escalation Provider Selection
*For any* triggered escalation, the manager should select the most appropriate provider based on the failure reason
**Validates: Requirements 9.4**

Property 32: Escalation Hook Emission
*For any* escalation event, a `kraken_escalate` hook should be emitted with the reason and provider details
**Validates: Requirements 9.5**

Property 33: Escalation Disabled Behavior
*For any* system with auto-escalation disabled, Kraken providers should not be invoked automatically
**Validates: Requirements 9.6**

### Hook System Properties

Property 34: Before Kraken Hook
*For any* Kraken invocation, a `before_kraken` hook should be emitted with provider and prompt details
**Validates: Requirements 10.1**

Property 35: After Kraken Hook
*For any* completed Kraken response, an `after_kraken` hook should be emitted with response, tokens, and cost
**Validates: Requirements 10.2**

Property 36: Hook Cancellation
*For any* hook handler that returns false, the Kraken invocation should be cancelled
**Validates: Requirements 10.5**

Property 37: Hook Error Handling
*For any* hook handler that throws an error, the error should be logged and the invocation should continue
**Validates: Requirements 10.6**

### Configuration Properties

Property 38: Configuration Validation
*For any* Kraken configuration, required fields should be validated and errors should be returned for missing or invalid values
**Validates: Requirements 11.2, 11.3**

Property 39: Environment Variable Resolution
*For any* API key referencing an environment variable, it should be resolved at runtime
**Validates: Requirements 11.4**

Property 40: Configuration Hot-Reload
*For any* configuration change, the system should reload without requiring a restart
**Validates: Requirements 11.6**

### Security Properties

Property 41: API Key Redaction
*For any* log entry or error message, API keys should be redacted to prevent exposure
**Validates: Requirements 14.3**

Property 42: HTTPS Encryption
*For any* data transmission to external providers, HTTPS should be used
**Validates: Requirements 14.7**

### Cross-Platform Properties

Property 43: Executable Discovery Cross-Platform
*For any* platform (Windows, macOS, Linux), the discovery service should check platform-appropriate locations and file extensions
**Validates: Requirements 15.1, 15.2**

Property 44: Subprocess Execution Cross-Platform
*For any* platform, subprocess execution should use platform-appropriate mechanisms (thread pool on Windows, fork/exec on Unix)
**Validates: Requirements 15.3, 15.4**

Property 45: Path Resolution Cross-Platform
*For any* file path, the resolver should use platform-specific separators and conventions
**Validates: Requirements 15.5**



## Security and Privacy

### API Key Management

API keys are sensitive credentials that must be protected:

```typescript
// packages/core/src/kraken/security/keyManager.ts

export class ApiKeyManager {
  /**
   * Resolve API key from config or environment
   */
  resolveApiKey(keyOrEnvVar: string): string {
    // Check if it's an environment variable reference
    if (keyOrEnvVar.startsWith('$')) {
      const envVar = keyOrEnvVar.slice(1);
      const value = process.env[envVar];
      
      if (!value) {
        throw new Error(`Environment variable ${envVar} not set`);
      }
      
      return value;
    }
    
    // Direct API key (not recommended for production)
    return keyOrEnvVar;
  }
  
  /**
   * Redact API key for logging
   */
  redactApiKey(key: string): string {
    if (key.length <= 8) {
      return '***';
    }
    
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
  
  /**
   * Validate API key format
   */
  validateApiKey(provider: string, key: string): boolean {
    const patterns = {
      openai: /^sk-[A-Za-z0-9]{48}$/,
      anthropic: /^sk-ant-[A-Za-z0-9-]{95}$/,
      google: /^[A-Za-z0-9_-]{39}$/
    };
    
    const pattern = patterns[provider];
    return pattern ? pattern.test(key) : true;
  }
}
```

### Sensitive Data Detection

Before sharing context with external providers, detect and warn about sensitive information:

```typescript
// packages/core/src/kraken/security/privacyGuard.ts

export class PrivacyGuard {
  private sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
    /\b(?:password|secret|token|key)\s*[:=]\s*['"]?[\w-]+['"]?/gi, // Credentials
    /-----BEGIN [A-Z ]+-----[\s\S]+-----END [A-Z ]+-----/g // Private keys
  ];
  
  /**
   * Detect sensitive information in context
   */
  detectSensitiveData(context: KrakenContext): SensitiveDataWarning[] {
    const warnings: SensitiveDataWarning[] = [];
    
    // Check recent messages
    for (const msg of context.recentMessages) {
      for (const part of msg.parts) {
        if (part.type === 'text') {
          for (const pattern of this.sensitivePatterns) {
            if (pattern.test(part.text)) {
              warnings.push({
                type: this.getPatternType(pattern),
                location: 'message',
                severity: 'high'
              });
            }
          }
        }
      }
    }
    
    return warnings;
  }
  
  /**
   * Sanitize context by removing sensitive data
   */
  sanitizeContext(context: KrakenContext): KrakenContext {
    // Create a deep copy
    const sanitized = JSON.parse(JSON.stringify(context));
    
    // Redact sensitive patterns
    for (const msg of sanitized.recentMessages) {
      for (const part of msg.parts) {
        if (part.type === 'text') {
          part.text = this.redactSensitiveData(part.text);
        }
      }
    }
    
    return sanitized;
  }
  
  private redactSensitiveData(text: string): string {
    let redacted = text;
    
    for (const pattern of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    
    return redacted;
  }
}
```

### Audit Logging

When audit logging is enabled, record all Kraken invocations:

```typescript
// packages/core/src/kraken/security/auditLogger.ts

export interface AuditLogEntry {
  timestamp: number;
  userId?: string;
  sessionId: string;
  provider: string;
  model: string;
  action: 'invoke' | 'escalate' | 'cancel';
  contextShared: boolean;
  tokenUsage: TokenUsage;
  cost: number;
  success: boolean;
  error?: string;
}

export class AuditLogger {
  private logPath: string;
  
  constructor(logPath: string) {
    this.logPath = logPath;
  }
  
  /**
   * Log Kraken invocation
   */
  async logInvocation(entry: AuditLogEntry): Promise<void> {
    // Redact sensitive information
    const sanitized = {
      ...entry,
      // Never log actual prompts or responses
      prompt: undefined,
      response: undefined
    };
    
    // Append to log file
    await fs.appendFile(
      this.logPath,
      JSON.stringify(sanitized) + '\n',
      'utf-8'
    );
  }
  
  /**
   * Query audit log
   */
  async queryLog(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    const content = await fs.readFile(this.logPath, 'utf-8');
    const entries = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    return entries.filter(entry => this.matchesFilter(entry, filter));
  }
}
```

### HTTPS Enforcement

All external API communication must use HTTPS:

```typescript
// packages/core/src/kraken/execution/ApiClient.ts

export class ApiClient {
  /**
   * Validate URL uses HTTPS
   */
  private validateSecureUrl(url: string): void {
    const parsed = new URL(url);
    
    if (parsed.protocol !== 'https:') {
      throw new Error(
        `Insecure protocol ${parsed.protocol} not allowed. ` +
        `All API requests must use HTTPS.`
      );
    }
  }
  
  /**
   * Stream chat completion from API
   */
  async *streamChat(
    request: any,
    config: KrakenApiConfig
  ): AsyncIterable<any> {
    const url = this.getEndpoint(config);
    
    // Enforce HTTPS
    this.validateSecureUrl(url);
    
    // ... rest of implementation
  }
}
```

## Error Handling

### Error Categories

1. **Discovery Errors**: CLI tool not found, executable not accessible
2. **Execution Errors**: Subprocess failure, timeout, crash
3. **Network Errors**: API unreachable, connection timeout, SSL errors
4. **Authentication Errors**: Invalid API key, expired credentials, auth required
5. **Budget Errors**: Session budget exceeded, cost limit reached
6. **Configuration Errors**: Invalid config, missing required fields
7. **Context Errors**: Context too large, compression failure, transfer failure

### Error Messages

All error messages should be actionable and include:
- Clear description of what went wrong
- Specific reason or error code
- Suggested resolution steps
- Relevant documentation links

Examples:

```typescript
// packages/core/src/kraken/errors/errorBuilder.ts

export class KrakenErrorBuilder {
  /**
   * Build error for CLI tool not found
   */
  static cliNotFound(tool: string): KrakenError {
    const installCommands = {
      gemini: 'npm install -g @google/generative-ai-cli',
      claude: 'npm install -g @anthropic-ai/claude-cli',
      codex: 'npm install -g @openai/codex-cli'
    };
    
    return {
      message: `${tool} CLI not found`,
      code: 'CLI_NOT_FOUND',
      resolution: `Install with: ${installCommands[tool]}`,
      docs: `https://ollm.dev/docs/kraken/cli-setup#${tool}`,
      recoverable: true
    };
  }
  
  /**
   * Build error for authentication required
   */
  static authRequired(tool: string): KrakenError {
    const authCommands = {
      gemini: 'gemini auth login',
      claude: 'claude login',
      codex: 'codex auth'
    };
    
    return {
      message: `${tool} CLI requires authentication`,
      code: 'AUTH_REQUIRED',
      resolution: `Run: ${authCommands[tool]}`,
      docs: `https://ollm.dev/docs/kraken/authentication#${tool}`,
      recoverable: true
    };
  }
  
  /**
   * Build error for budget exceeded
   */
  static budgetExceeded(current: number, limit: number): KrakenError {
    return {
      message: `Session budget exceeded ($${limit.toFixed(2)} limit)`,
      code: 'BUDGET_EXCEEDED',
      resolution: 'Increase maxCostPerSession in config or wait for session reset',
      currentCost: current,
      limit: limit,
      recoverable: false
    };
  }
  
  /**
   * Build error for timeout
   */
  static timeout(duration: number): KrakenError {
    return {
      message: `Kraken request timed out after ${duration}s`,
      code: 'TIMEOUT',
      resolution: 'Increase timeout in config or try a different provider',
      timeout: duration,
      recoverable: true
    };
  }
  
  /**
   * Build error for proxy unreachable
   */
  static proxyUnreachable(url: string): KrakenError {
    return {
      message: `Proxy server unreachable: ${url}`,
      code: 'PROXY_UNREACHABLE',
      resolution: 'Check proxy URL and network connectivity',
      proxyUrl: url,
      recoverable: true
    };
  }
  
  /**
   * Build error for model not found
   */
  static modelNotFound(model: string, available: string[]): KrakenError {
    return {
      message: `Model not found: ${model}`,
      code: 'MODEL_NOT_FOUND',
      resolution: `Available models: ${available.join(', ')}`,
      requestedModel: model,
      availableModels: available,
      recoverable: true
    };
  }
  
  /**
   * Build error for invalid API key
   */
  static invalidApiKey(provider: string): KrakenError {
    const envVars = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY'
    };
    
    return {
      message: `Invalid API key for ${provider}`,
      code: 'INVALID_API_KEY',
      resolution: `Set ${envVars[provider]} environment variable or update config`,
      docs: `https://ollm.dev/docs/kraken/api-keys#${provider}`,
      recoverable: true
    };
  }
}
```

### Recovery Strategies

1. **Retry with Backoff**: For transient network errors
2. **Fallback Provider**: Try alternative provider if primary fails
3. **Graceful Degradation**: Continue with local model if Kraken unavailable
4. **Context Compression**: Reduce context size if too large
5. **User Intervention**: Prompt user for action when automatic recovery fails


## UI Components and Commands

### Slash Command Implementation

```typescript
// packages/cli/src/commands/kraken.ts

export interface KrakenCommand {
  execute(args: string[], context: CommandContext): Promise<void>;
}

export class KrakenCommandHandler implements KrakenCommand {
  constructor(
    private manager: KrakenManager,
    private ui: UIRenderer
  ) {}
  
  async execute(args: string[], context: CommandContext): Promise<void> {
    const subcommand = args[0];
    
    switch (subcommand) {
      case undefined:
      case 'select':
        await this.showProviderSelection();
        break;
        
      case 'status':
        await this.showStatus();
        break;
        
      case 'config':
        await this.openConfig();
        break;
        
      case 'history':
        await this.showHistory();
        break;
        
      default:
        // Treat as prompt
        await this.executePrompt(args.join(' '));
    }
  }
  
  /**
   * Show interactive provider selection menu
   */
  private async showProviderSelection(): Promise<void> {
    const providers = this.manager.listProviders();
    
    if (providers.length === 0) {
      this.ui.showError('No Kraken providers configured');
      this.ui.showInfo('Run: /kraken config to set up providers');
      return;
    }
    
    const selected = await this.ui.showMenu({
      title: 'Select Kraken Provider',
      items: providers.map(p => ({
        label: p.name,
        value: p.name,
        description: `${p.type} • ${p.available ? '✓ Available' : '✗ Unavailable'}`,
        disabled: !p.available
      }))
    });
    
    if (selected) {
      context.setProvider(selected);
      this.ui.showSuccess(`Switched to ${selected}`);
    }
  }
  
  /**
   * Show provider status
   */
  private async showStatus(): Promise<void> {
    const providers = this.manager.listProviders();
    const budget = this.manager.costTracker.getRemainingBudget(
      this.manager.config.maxCostPerSession
    );
    
    this.ui.showTable({
      title: 'Kraken Status',
      headers: ['Provider', 'Type', 'Status', 'Model', 'Last Used'],
      rows: providers.map(p => [
        p.name,
        p.type,
        p.available ? '✓ Available' : '✗ Unavailable',
        p.model || 'N/A',
        p.lastUsed ? new Date(p.lastUsed).toLocaleString() : 'Never'
      ])
    });
    
    this.ui.showInfo(`Session Budget: $${budget.toFixed(2)} remaining`);
  }
  
  /**
   * Open Kraken configuration
   */
  private async openConfig(): Promise<void> {
    const configPath = path.join(os.homedir(), '.ollm', 'config.yaml');
    
    this.ui.showInfo(`Opening: ${configPath}`);
    
    // Open in default editor
    const editor = process.env.EDITOR || 'nano';
    await spawn(editor, [configPath], { stdio: 'inherit' });
  }
  
  /**
   * Show usage history
   */
  private async showHistory(): Promise<void> {
    const history = this.manager.costTracker.getHistory();
    
    if (history.length === 0) {
      this.ui.showInfo('No Kraken usage history');
      return;
    }
    
    this.ui.showTable({
      title: 'Kraken Usage History',
      headers: ['Time', 'Provider', 'Model', 'Tokens', 'Cost'],
      rows: history.slice(-10).map(record => [
        new Date(record.timestamp).toLocaleTimeString(),
        record.provider,
        record.model,
        `${record.tokenUsage.input + record.tokenUsage.output}`,
        `$${record.cost.toFixed(4)}`
      ])
    });
    
    const totalCost = history.reduce((sum, r) => sum + r.cost, 0);
    this.ui.showInfo(`Total session cost: $${totalCost.toFixed(2)}`);
  }
  
  /**
   * Execute prompt with default provider
   */
  private async executePrompt(prompt: string): Promise<void> {
    const provider = this.manager.selectProvider({
      complexity: 'complex',
      domain: 'code',
      contextSize: 0
    });
    
    this.ui.showInfo(`Using ${provider.name}`);
    
    // Execute through normal chat flow
    await context.chat.sendMessage(prompt, { provider: provider.name });
  }
}

// Register command aliases
export function registerKrakenCommands(registry: CommandRegistry): void {
  const handler = new KrakenCommandHandler(manager, ui);
  
  registry.register('/kraken', handler);
  registry.register('/k', handler); // Short alias
  registry.register('/release', handler); // Thematic alias
}
```

### Status Bar Component

```typescript
// packages/cli/src/ui/components/KrakenStatusBar.tsx

import React from 'react';
import { Box, Text } from 'ink';

export interface KrakenStatusBarProps {
  available: boolean;
  active: boolean;
  budgetExceeded: boolean;
  currentProvider?: string;
}

export const KrakenStatusBar: React.FC<KrakenStatusBarProps> = ({
  available,
  active,
  budgetExceeded,
  currentProvider
}) => {
  let status: string;
  let color: string;
  
  if (budgetExceeded) {
    status = '🦑 ⚠️';
    color = 'yellow';
  } else if (active) {
    status = '🦑 Active';
    color = 'green';
  } else if (available) {
    status = '🦑 Ready';
    color = 'cyan';
  } else {
    status = '🦑 ---';
    color = 'gray';
  }
  
  return (
    <Box>
      <Text color={color}>{status}</Text>
      {currentProvider && (
        <Text dimColor> ({currentProvider})</Text>
      )}
    </Box>
  );
};
```

### Provider Selection Menu

```typescript
// packages/cli/src/ui/components/ProviderSelectionMenu.tsx

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export interface ProviderMenuItem {
  label: string;
  value: string;
  type: 'cli' | 'api';
  available: boolean;
  model?: string;
  cost?: number;
}

export interface ProviderSelectionMenuProps {
  providers: ProviderMenuItem[];
  onSelect: (provider: string) => void;
  onCancel: () => void;
}

export const ProviderSelectionMenu: React.FC<ProviderSelectionMenuProps> = ({
  providers,
  onSelect,
  onCancel
}) => {
  const cliProviders = providers.filter(p => p.type === 'cli');
  const apiProviders = providers.filter(p => p.type === 'api');
  
  const items = [
    ...cliProviders.map(p => ({
      label: `${p.available ? '✓' : '✗'} ${p.label} (CLI)`,
      value: p.value,
      isDisabled: !p.available
    })),
    ...apiProviders.map(p => ({
      label: `${p.available ? '✓' : '✗'} ${p.label} (API) - ${p.model}`,
      value: p.value,
      isDisabled: !p.available
    }))
  ];
  
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select Kraken Provider:</Text>
      </Box>
      
      <SelectInput
        items={items}
        onSelect={item => onSelect(item.value)}
      />
      
      <Box marginTop={1}>
        <Text dimColor>Press Esc to cancel</Text>
      </Box>
    </Box>
  );
};
```

### Confirmation Dialog

```typescript
// packages/cli/src/ui/components/KrakenConfirmationDialog.tsx

import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface KrakenConfirmationProps {
  provider: string;
  model: string;
  contextSummary: string;
  estimatedCost: { min: number; max: number };
  onConfirm: () => void;
  onReject: () => void;
  onAlwaysAllow: () => void;
}

export const KrakenConfirmationDialog: React.FC<KrakenConfirmationProps> = ({
  provider,
  model,
  contextSummary,
  estimatedCost,
  onConfirm,
  onReject,
  onAlwaysAllow
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">⚠️  Kraken Confirmation Required</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        <Text>Provider: <Text bold>{provider}</Text></Text>
        <Text>Model: <Text bold>{model}</Text></Text>
        <Text>Estimated Cost: <Text bold>${estimatedCost.min.toFixed(4)} - ${estimatedCost.max.toFixed(4)}</Text></Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Context to be shared:</Text>
        <Text dimColor>{contextSummary}</Text>
      </Box>
      
      <Box flexDirection="column">
        <Text>
          <Text bold color="green">[Y]</Text> Approve  
          <Text bold color="red"> [N]</Text> Reject  
          <Text bold color="cyan"> [A]</Text> Always Allow
        </Text>
      </Box>
    </Box>
  );
};
```

### Kraken Response Display

```typescript
// packages/cli/src/ui/components/KrakenResponseMessage.tsx

import React from 'react';
import { Box, Text } from 'ink';

export interface KrakenResponseProps {
  provider: string;
  model: string;
  content: string;
  tokenUsage: { input: number; output: number };
  cost: number;
  duration: number;
}

export const KrakenResponseMessage: React.FC<KrakenResponseProps> = ({
  provider,
  model,
  content,
  tokenUsage,
  cost,
  duration
}) => {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">🦑 {provider}</Text>
        <Text dimColor> • {model}</Text>
      </Box>
      
      {/* Content */}
      <Box marginBottom={1}>
        <Text>{content}</Text>
      </Box>
      
      {/* Footer */}
      <Box borderStyle="single" borderColor="gray" padding={1}>
        <Text dimColor>
          Tokens: {tokenUsage.input + tokenUsage.output} 
          ({tokenUsage.input} in, {tokenUsage.output} out) • 
          Cost: ${cost.toFixed(4)} • 
          Time: {(duration / 1000).toFixed(1)}s
        </Text>
      </Box>
    </Box>
  );
};
```


## Testing Strategy

### Dual Testing Approach

The Kraken Integration feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both types of tests are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

We will use **fast-check** for property-based testing in TypeScript. Each property test should:

- Run a minimum of 100 iterations
- Reference the design document property number
- Use the tag format: `Feature: kraken-integration, Property {number}: {property_text}`

Example property test structure:

```typescript
import fc from 'fast-check';

describe('Feature: kraken-integration', () => {
  it('Property 1: STDIN Prompt Delivery', () => {
    // Feature: kraken-integration, Property 1: STDIN Prompt Delivery
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 10000 }),
        async (prompt) => {
          const executor = new CliExecutor();
          const spy = jest.spyOn(executor as any, 'execWithStdin');
          
          await executor.executeDirect(prompt, mockConfig);
          
          expect(spy).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.stringContaining(prompt),
            expect.any(Number)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 7: Cost Calculation Accuracy', () => {
    // Feature: kraken-integration, Property 7: Cost Calculation Accuracy
    fc.assert(
      fc.property(
        fc.record({
          provider: fc.constantFrom('openai', 'anthropic', 'google'),
          model: fc.string(),
          inputTokens: fc.integer({ min: 0, max: 1000000 }),
          outputTokens: fc.integer({ min: 0, max: 1000000 })
        }),
        (data) => {
          const tracker = new CostTracker();
          const cost = tracker.calculateCost(
            data.provider,
            data.model,
            { input: data.inputTokens, output: data.outputTokens }
          );
          
          // Cost should be non-negative
          expect(cost).toBeGreaterThanOrEqual(0);
          
          // Cost should scale with token count
          if (data.inputTokens > 0 || data.outputTokens > 0) {
            expect(cost).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing

Unit tests should cover:

1. **CLI Executor**:
   - Executable discovery on different platforms
   - STDIN input handling
   - Timeout enforcement
   - Output parsing (text, code blocks, JSON)
   - Proxy mode execution

2. **API Client**:
   - Request formatting for each provider (OpenAI, Anthropic, Google)
   - SSE stream parsing
   - Token counting
   - Retry logic with exponential backoff
   - Error handling

3. **Kraken Manager**:
   - Provider selection logic
   - Health check execution
   - Auto-escalation triggers
   - Session management
   - Budget enforcement

4. **Context Transfer**:
   - Context export with all required fields
   - Context compression
   - Response import
   - Session merging
   - Fallback on failure

5. **Cost Tracker**:
   - Cost calculation for different providers
   - Budget tracking
   - Session reset
   - Usage logging
   - Cost estimation

### Integration Testing

Integration tests should verify end-to-end flows:

1. **CLI Bridge Flow**:
   - Configure CLI provider → Execute prompt → Parse response → Return events

2. **API Provider Flow**:
   - Configure API provider → Send request → Stream response → Track cost

3. **Context Transfer Flow**:
   - Export context → Send to Kraken → Receive response → Import to local session

4. **Auto-Escalation Flow**:
   - Local model fails → Trigger escalation → Select provider → Execute with Kraken

5. **Budget Enforcement Flow**:
   - Track usage → Approach limit → Reject request → Display error

### Mock Providers

For testing without real CLI tools or API access:

```typescript
// Mock CLI executable
export class MockCliExecutor extends CliExecutor {
  private responses = new Map<string, string>();
  
  setResponse(prompt: string, response: string) {
    this.responses.set(prompt, response);
  }
  
  async executeDirect(prompt: string, config: KrakenCliConfig) {
    const response = this.responses.get(prompt) || 'Default response';
    return {
      stdout: response,
      stderr: '',
      exitCode: 0,
      duration: 100
    };
  }
}

// Mock API server
export class MockApiServer {
  private server: http.Server;
  private responses: any[] = [];
  
  setResponses(responses: any[]) {
    this.responses = responses;
  }
  
  async start(port: number) {
    this.server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      for (const response of this.responses) {
        res.write(`data: ${JSON.stringify(response)}\n\n`);
      }
      res.end();
    });
    
    await new Promise(resolve => this.server.listen(port, resolve));
  }
  
  async stop() {
    await new Promise(resolve => this.server.close(resolve));
  }
}
```

### Test Coverage Goals

- **Line Coverage**: Minimum 80%
- **Branch Coverage**: Minimum 75%
- **Property Tests**: All 45 properties implemented
- **Unit Tests**: All core functions covered
- **Integration Tests**: All major flows covered


## Design Decisions and Rationales

### 1. Unified Provider Adapter Pattern

**Decision**: Both CLI Bridge and API providers implement the same `ProviderAdapter` interface.

**Rationale**: 
- Ensures consistency across all provider types
- Allows transparent switching between local and external models
- Simplifies the provider registry and selection logic
- Enables future provider types without architectural changes

### 2. STDIN for CLI Execution

**Decision**: Send prompts to CLI tools via STDIN instead of command-line arguments.

**Rationale**:
- Avoids Windows command-line length limits (8191 characters)
- Prevents shell escaping issues with special characters
- More secure (arguments visible in process list)
- Consistent behavior across platforms

### 3. Proxy Mode for CLI Tools

**Decision**: Support HTTP proxy for CLI tool execution in addition to direct subprocess execution.

**Rationale**:
- Enables use of CLI tools on systems where they're not installed
- Allows centralized management of CLI tool versions
- Provides fallback when local execution fails
- Supports environments with restricted subprocess execution

### 4. Cost Tracking and Budget Enforcement

**Decision**: Track token usage and enforce per-session budget limits before allowing Kraken invocations.

**Rationale**:
- Prevents unexpected costs from runaway API usage
- Provides transparency about external provider costs
- Allows users to set spending limits
- Enables cost-aware provider selection

### 5. Context Transfer with Compression

**Decision**: Export conversation context with automatic compression when it exceeds provider limits.

**Rationale**:
- Ensures external providers have necessary background
- Handles large conversations gracefully
- Preserves essential information while reducing size
- Allows fallback to minimal context on failure

### 6. Confirmation Dialogs with Always Allow

**Decision**: Show confirmation dialogs before Kraken invocations with option to always allow specific providers.

**Rationale**:
- Gives users control over when external providers are used
- Displays cost and context sharing information upfront
- Allows trusted providers to skip confirmation
- Balances security with convenience

### 7. Auto-Escalation with Hook Events

**Decision**: Automatically escalate to Kraken providers on specific failures, with hook events for customization.

**Rationale**:
- Provides seamless fallback when local models fail
- Allows users to customize escalation behavior via hooks
- Emits events for logging and monitoring
- Can be disabled for full manual control

### 8. Environment Variable API Keys

**Decision**: Support environment variable references in configuration for API keys.

**Rationale**:
- Avoids storing sensitive credentials in plaintext config files
- Follows security best practices
- Compatible with CI/CD and deployment workflows
- Allows per-environment configuration

### 9. Cross-Platform Subprocess Handling

**Decision**: Use platform-specific subprocess execution mechanisms (thread pool on Windows, fork/exec on Unix).

**Rationale**:
- Ensures reliable subprocess execution on all platforms
- Handles Windows-specific subprocess limitations
- Provides consistent behavior across operating systems
- Avoids platform-specific bugs

### 10. Dual Testing Strategy

**Decision**: Implement both unit tests and property-based tests for all components.

**Rationale**:
- Unit tests catch specific bugs and edge cases
- Property tests verify universal correctness across inputs
- Complementary approaches provide comprehensive coverage
- Property tests serve as executable specifications

### 11. Separate CLI and API Provider Implementations

**Decision**: Implement CLI Bridge and API providers as separate classes rather than a single unified implementation.

**Rationale**:
- CLI and API execution have fundamentally different mechanisms
- Separation of concerns improves maintainability
- Allows independent evolution of each provider type
- Simplifies testing and debugging

### 12. Health Checks on Startup

**Decision**: Perform health checks on all configured providers when OLLM CLI starts.

**Rationale**:
- Provides immediate feedback about provider availability
- Allows early detection of configuration issues
- Enables intelligent provider selection based on availability
- Improves user experience with clear status information


## Implementation Notes

### File Organization

```
packages/core/src/kraken/
├── index.ts                          # Public exports
├── types.ts                          # Type definitions
├── KrakenManager.ts                  # Main orchestrator
├── ContextTransferService.ts         # Context management
├── CostTracker.ts                    # Cost tracking
├── config/
│   ├── loader.ts                     # Configuration loading
│   └── validator.ts                  # Configuration validation
├── execution/
│   ├── CliExecutor.ts                # CLI subprocess execution
│   ├── ApiClient.ts                  # API HTTP client
│   ├── discovery.ts                  # Executable discovery
│   └── parser.ts                     # Output parsing
├── providers/
│   ├── KrakenCliProvider.ts          # CLI provider adapter
│   └── KrakenApiProvider.ts          # API provider adapter
├── health/
│   ├── CliHealthCheck.ts             # CLI health checks
│   └── ApiHealthCheck.ts             # API health checks
├── security/
│   ├── keyManager.ts                 # API key management
│   ├── privacyGuard.ts               # Sensitive data detection
│   └── auditLogger.ts                # Audit logging
└── errors/
    └── errorBuilder.ts               # Error message construction
```

### Dependencies

New dependencies required:
- None (uses existing Node.js built-ins and project dependencies)

### Integration Points

1. **Provider Registry**: `packages/core/src/provider/registry.ts`
   - Add `registerKrakenProvider()` method
   - Add `listKrakenProviders()` method

2. **Policy Engine**: `packages/core/src/policy/policyEngine.ts`
   - Add `KrakenConfirmationPolicy` rule
   - Add `CostWarningPolicy` rule

3. **Hook System**: `packages/core/src/hooks/types.ts`
   - Add `before_kraken` event type
   - Add `after_kraken` event type
   - Add `kraken_escalate` event type

4. **CLI Commands**: `packages/cli/src/commands/`
   - Add `kraken.ts` command handler
   - Register `/kraken`, `/k`, `/release` aliases

5. **UI Components**: `packages/cli/src/ui/components/`
   - Add `KrakenStatusBar.tsx`
   - Add `ProviderSelectionMenu.tsx`
   - Add `KrakenConfirmationDialog.tsx`
   - Add `KrakenResponseMessage.tsx`

### Configuration Schema

Add to `schemas/settings.schema.json`:

```json
{
  "properties": {
    "kraken": {
      "type": "object",
      "description": "Kraken external provider configuration",
      "properties": {
        "enabled": { "type": "boolean" },
        "defaultProvider": { "type": "string" },
        "maxCostPerSession": { "type": "number" },
        "autoEscalate": { "type": "object" },
        "cliProviders": { "type": "object" },
        "apiProviders": { "type": "object" },
        "policies": { "type": "object" }
      }
    }
  }
}
```


## Summary

The Kraken Integration design provides a comprehensive solution for accessing external LLM providers through OLLM CLI. Key highlights:

- **Unified Interface**: Both CLI and API providers implement the same `ProviderAdapter` interface
- **Cost Awareness**: Built-in cost tracking and budget enforcement prevent unexpected expenses
- **Security First**: API key management, sensitive data detection, and HTTPS enforcement
- **Cross-Platform**: Consistent behavior on Windows, macOS, and Linux
- **User Control**: Confirmation dialogs, auto-escalation, and policy customization
- **Comprehensive Testing**: Dual strategy with unit tests and property-based tests

The design addresses all 15 requirement categories with 45 testable correctness properties, ensuring a robust and reliable implementation.

