# Design Document: Tool System and Policy Engine

## Overview

This design defines the tool system that enables LLMs to interact with the file system, execute shell commands, fetch web content, and perform other operations through a secure, policy-controlled interface. The system consists of four main layers:

1. **Tool Registry Layer**: Central registration and discovery of tools with schema exposure
2. **Tool Invocation Layer**: Declarative tool definitions with parameter validation and execution
3. **Policy Engine Layer**: Rule-based confirmation system for controlling tool execution
4. **Built-in Tools Layer**: File operations, shell execution, web tools, and persistent storage

The design prioritizes safety (policy-controlled execution), extensibility (easy addition of new tools), and usability (clear error messages and streaming output).

## Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Chat Client                            │
│  - Requests tool schemas from registry                      │
│  - Executes tools via invocations                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool Registry                            │
│  - Stores registered tools                                  │
│  - Provides tool schemas for LLM                            │
│  - Creates tool invocations                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool Invocation                           │
│  - Validates parameters                                     │
│  - Checks policy for confirmation                           │
│  - Executes tool operation                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Policy Engine                            │
│  - Evaluates rules against tool/params                      │
│  - Requests confirmation via Message Bus                    │
│  - Returns allow/deny/ask decision                          │
└─────────────────────────────────────────────────────────────┘
```


### Tool Execution Flow

```
LLM requests tool call
    │
    ▼
┌─────────────────────┐
│  Tool Registry      │
│  - Get tool by name │
│  - Create invocation│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Tool Invocation    │
│  - Validate params  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Policy Check       │
│  - Evaluate rules   │
└─────────────────────┘
    │
    ├─→ Allow ──────────┐
    │                   │
    ├─→ Ask ──→ Message │
    │           Bus     │
    │             │     │
    │             ▼     │
    │         User      │
    │         Confirms  │
    │             │     │
    │             ▼     │
    └─→ Deny ──→ Error  │
                        │
                        ▼
                ┌───────────────┐
                │ Execute Tool  │
                │ - Run operation│
                │ - Stream output│
                └───────────────┘
                        │
                        ▼
                ┌───────────────┐
                │ Return Result │
                │ - llmContent  │
                │ - returnDisplay│
                └───────────────┘
```


## Components and Interfaces

### Tool Types (`packages/core/src/tools/types.ts`)

**Tool Result:**

```typescript
export interface ToolResult {
  llmContent: string;      // Content sent to LLM
  returnDisplay: string;   // Content displayed to user
  error?: {
    message: string;
    type: string;
  };
}
```

**Confirmation Details:**

```typescript
export interface ToolCallConfirmationDetails {
  toolName: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  locations?: string[];  // Files/resources affected
}
```

**Tool Invocation Interface:**

```typescript
export interface ToolInvocation<TParams extends object, TResult> {
  params: TParams;
  
  getDescription(): string;
  toolLocations(): string[];
  
  shouldConfirmExecute(
    abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false>;
  
  execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<TResult>;
}
```

**Declarative Tool Interface:**

```typescript
export interface DeclarativeTool<TParams extends object, TResult> {
  name: string;
  displayName: string;
  schema: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;  // JSON Schema
  };
  
  createInvocation(
    params: TParams,
    messageBus: MessageBus
  ): ToolInvocation<TParams, TResult>;
}
```


### Tool Registry (`packages/core/src/tools/tool-registry.ts`)

**Purpose**: Central registry for tool registration, discovery, and schema exposure.

**Interface:**

```typescript
export class ToolRegistry {
  private tools: Map<string, DeclarativeTool<any, any>>;

  constructor() {
    this.tools = new Map();
  }

  register(tool: DeclarativeTool<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): DeclarativeTool<any, any> | undefined {
    return this.tools.get(name);
  }

  list(): DeclarativeTool<any, any>[] {
    // Return tools in alphabetical order by name
    return Array.from(this.tools.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getFunctionSchemas(): ToolSchema[] {
    return this.list().map(tool => tool.schema);
  }
}
```

**Key Behaviors:**
- Tools are stored by name as the unique key
- Registering a tool with an existing name replaces the previous tool
- List returns tools in alphabetical order for consistency
- getFunctionSchemas converts tools to provider-compatible format


### Policy Engine (`packages/core/src/policy/policyEngine.ts`)

**Purpose**: Evaluates policy rules to determine if tool execution requires user confirmation.

**Policy Decision Types:**

```typescript
export type PolicyDecision = 'allow' | 'deny' | 'ask';

export interface PolicyRule {
  tool: string;              // Tool name or '*' for all
  action: PolicyDecision;
  risk?: 'low' | 'medium' | 'high';
  message?: string;          // Custom confirmation message
  conditions?: PolicyCondition[];
}

export interface PolicyCondition {
  param: string;             // Parameter name
  operator: 'equals' | 'contains' | 'matches' | 'startsWith';
  value: string | string[];
}

export interface PolicyConfig {
  defaultAction: PolicyDecision;
  rules: PolicyRule[];
}
```

**Interface:**

```typescript
export class PolicyEngine {
  constructor(private config: PolicyConfig) {}

  evaluate(
    toolName: string,
    params: Record<string, unknown>
  ): PolicyDecision {
    // Find matching rule (tool-specific rules first, then wildcard)
    const rule = this.findMatchingRule(toolName, params);
    
    if (rule) {
      return rule.action;
    }
    
    return this.config.defaultAction;
  }

  getRiskLevel(toolName: string): 'low' | 'medium' | 'high' {
    const rule = this.config.rules.find(r => r.tool === toolName);
    return rule?.risk ?? this.inferRiskLevel(toolName);
  }

  private findMatchingRule(
    toolName: string,
    params: Record<string, unknown>
  ): PolicyRule | undefined {
    // Check tool-specific rules first
    for (const rule of this.config.rules) {
      if (rule.tool === toolName) {
        if (this.evaluateConditions(rule.conditions, params)) {
          return rule;
        }
      }
    }
    
    // Check wildcard rules
    for (const rule of this.config.rules) {
      if (rule.tool === '*') {
        if (this.evaluateConditions(rule.conditions, params)) {
          return rule;
        }
      }
    }
    
    return undefined;
  }

  private evaluateConditions(
    conditions: PolicyCondition[] | undefined,
    params: Record<string, unknown>
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }
    
    return conditions.every(condition => {
      const value = params[condition.param];
      if (value === undefined) return false;
      
      const valueStr = String(value);
      
      switch (condition.operator) {
        case 'equals':
          return valueStr === condition.value;
        case 'contains':
          return valueStr.includes(String(condition.value));
        case 'startsWith':
          return valueStr.startsWith(String(condition.value));
        case 'matches':
          return new RegExp(String(condition.value)).test(valueStr);
        default:
          return false;
      }
    });
  }

  private inferRiskLevel(toolName: string): 'low' | 'medium' | 'high' {
    // Infer risk based on tool name
    if (toolName.startsWith('read') || toolName === 'ls' || toolName === 'glob') {
      return 'low';
    }
    if (toolName.startsWith('write') || toolName.startsWith('edit')) {
      return 'medium';
    }
    if (toolName === 'shell') {
      return 'high';
    }
    return 'medium';
  }
}
```


### Message Bus (`packages/core/src/confirmation-bus/messageBus.ts`)

**Purpose**: Async communication channel for requesting and receiving user confirmations.

**Interface:**

```typescript
export interface ConfirmationRequest {
  id: string;  // Correlation ID
  details: ToolCallConfirmationDetails;
  timeout?: number;
}

export interface ConfirmationResponse {
  id: string;  // Correlation ID
  approved: boolean;
}

export class MessageBus {
  private pendingRequests: Map<string, {
    resolve: (response: ConfirmationResponse) => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }>;

  constructor() {
    this.pendingRequests = new Map();
  }

  async requestConfirmation(
    details: ToolCallConfirmationDetails,
    abortSignal?: AbortSignal,
    timeout: number = 60000
  ): Promise<boolean> {
    const id = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          this.cancelRequest(id);
          reject(new Error('Confirmation request cancelled'));
        });
      }
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.cancelRequest(id);
        reject(new Error('Confirmation request timed out'));
      }, timeout);
      
      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response.approved);
        },
        reject,
        timeoutId,
      });
      
      // Emit request event (to be handled by UI)
      this.emitRequest({ id, details, timeout });
    });
  }

  respondToConfirmation(response: ConfirmationResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      pending.resolve(response);
      this.pendingRequests.delete(response.id);
    }
  }

  cancelRequest(id: string): void {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      this.pendingRequests.delete(id);
    }
  }

  private emitRequest(request: ConfirmationRequest): void {
    // Emit event for UI to handle
    // Implementation will use EventEmitter or similar
  }
}
```


### Output Helpers (`packages/core/src/tools/output-helpers.ts`)

**Purpose**: Utilities for truncating and formatting tool output.

**Interface:**

```typescript
export interface TruncationConfig {
  maxChars?: number;
  maxLines?: number;
}

export class OutputFormatter {
  static truncate(
    output: string,
    config: TruncationConfig
  ): { content: string; truncated: boolean; omitted?: string } {
    let content = output;
    let truncated = false;
    let omitted: string | undefined;
    
    // Truncate by lines
    if (config.maxLines) {
      const lines = content.split('\n');
      if (lines.length > config.maxLines) {
        content = lines.slice(0, config.maxLines).join('\n');
        truncated = true;
        omitted = `${lines.length - config.maxLines} lines`;
      }
    }
    
    // Truncate by characters
    if (config.maxChars && content.length > config.maxChars) {
      content = content.slice(0, config.maxChars);
      truncated = true;
      omitted = omitted 
        ? `${omitted} and ${output.length - config.maxChars} characters`
        : `${output.length - config.maxChars} characters`;
    }
    
    if (truncated) {
      content += `\n\n[Output truncated: ${omitted} omitted]`;
    }
    
    return { content, truncated, omitted };
  }

  static formatForLLM(output: string): string {
    // Format output for optimal LLM consumption
    return output.trim();
  }

  static formatForDisplay(output: string): string {
    // Format output for user display
    return output;
  }
}
```


## Built-in Tools

### File Reading Tools

**read_file Tool:**

```typescript
interface ReadFileParams {
  path: string;
  startLine?: number;
  endLine?: number;
}

class ReadFileTool implements DeclarativeTool<ReadFileParams, ToolResult> {
  name = 'read_file';
  displayName = 'Read File';
  schema = {
    name: 'read_file',
    description: 'Read file content with optional line range',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        startLine: { type: 'number', description: 'Starting line (1-indexed)' },
        endLine: { type: 'number', description: 'Ending line (inclusive)' },
      },
      required: ['path'],
    },
  };

  createInvocation(params: ReadFileParams, messageBus: MessageBus) {
    return new ReadFileInvocation(params, messageBus);
  }
}

class ReadFileInvocation implements ToolInvocation<ReadFileParams, ToolResult> {
  constructor(
    public params: ReadFileParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    const range = this.params.startLine || this.params.endLine
      ? ` (lines ${this.params.startLine ?? 1}-${this.params.endLine ?? 'end'})`
      : '';
    return `Read ${this.params.path}${range}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    // Read operations typically don't require confirmation
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      // Read file
      const content = await fs.readFile(this.params.path, 'utf-8');
      const lines = content.split('\n');
      
      // Apply line range
      const start = (this.params.startLine ?? 1) - 1;
      const end = this.params.endLine ?? lines.length;
      const selectedLines = lines.slice(start, end);
      
      const result = selectedLines.join('\n');
      
      return {
        llmContent: result,
        returnDisplay: result,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileReadError',
        },
      };
    }
  }
}
```


**read_many_files Tool:**

```typescript
interface ReadManyFilesParams {
  paths: string[];
}

class ReadManyFilesTool implements DeclarativeTool<ReadManyFilesParams, ToolResult> {
  name = 'read_many_files';
  displayName = 'Read Multiple Files';
  schema = {
    name: 'read_many_files',
    description: 'Read multiple files at once',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths',
        },
      },
      required: ['paths'],
    },
  };

  createInvocation(params: ReadManyFilesParams, messageBus: MessageBus) {
    return new ReadManyFilesInvocation(params, messageBus);
  }
}

class ReadManyFilesInvocation implements ToolInvocation<ReadManyFilesParams, ToolResult> {
  constructor(
    public params: ReadManyFilesParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `Read ${this.params.paths.length} files`;
  }

  toolLocations(): string[] {
    return this.params.paths;
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const results: string[] = [];
    
    for (const path of this.params.paths) {
      try {
        const content = await fs.readFile(path, 'utf-8');
        results.push(`=== ${path} ===\n${content}\n`);
      } catch (error) {
        results.push(`=== ${path} ===\nError: ${(error as Error).message}\n`);
      }
    }
    
    const combined = results.join('\n');
    
    return {
      llmContent: combined,
      returnDisplay: combined,
    };
  }
}
```


### File Writing Tools

**write_file Tool:**

```typescript
interface WriteFileParams {
  path: string;
  content: string;
  overwrite?: boolean;
}

class WriteFileTool implements DeclarativeTool<WriteFileParams, ToolResult> {
  name = 'write_file';
  displayName = 'Write File';
  schema = {
    name: 'write_file',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
        overwrite: { type: 'boolean', description: 'Allow overwriting existing file' },
      },
      required: ['path', 'content'],
    },
  };

  createInvocation(params: WriteFileParams, messageBus: MessageBus) {
    return new WriteFileInvocation(params, messageBus, this.policyEngine);
  }
}

class WriteFileInvocation implements ToolInvocation<WriteFileParams, ToolResult> {
  constructor(
    public params: WriteFileParams,
    private messageBus: MessageBus,
    private policyEngine: PolicyEngine
  ) {}

  getDescription(): string {
    return `Write to ${this.params.path}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    const decision = this.policyEngine.evaluate('write_file', this.params);
    
    if (decision === 'allow') {
      return false;
    }
    
    if (decision === 'deny') {
      throw new Error('Write operation denied by policy');
    }
    
    // Ask for confirmation
    const risk = this.policyEngine.getRiskLevel('write_file');
    return {
      toolName: 'write_file',
      description: this.getDescription(),
      risk,
      locations: this.toolLocations(),
    };
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      // Check if file exists
      const exists = await fs.access(this.params.path).then(() => true).catch(() => false);
      
      if (exists && !this.params.overwrite) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `File ${this.params.path} already exists. Set overwrite=true to replace it.`,
            type: 'FileExistsError',
          },
        };
      }
      
      // Create parent directories
      const dir = path.dirname(this.params.path);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(this.params.path, this.params.content, 'utf-8');
      
      return {
        llmContent: `Successfully wrote ${this.params.content.length} characters to ${this.params.path}`,
        returnDisplay: `Wrote to ${this.params.path}`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileWriteError',
        },
      };
    }
  }
}
```


**edit_file Tool:**

```typescript
interface EditFileParams {
  path: string;
  edits: Array<{
    target: string;      // Text to find
    replacement: string; // Text to replace with
    lineHint?: number;   // Optional line number hint
  }>;
}

class EditFileTool implements DeclarativeTool<EditFileParams, ToolResult> {
  name = 'edit_file';
  displayName = 'Edit File';
  schema = {
    name: 'edit_file',
    description: 'Apply targeted edits to a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'Text to find' },
              replacement: { type: 'string', description: 'Replacement text' },
              lineHint: { type: 'number', description: 'Optional line number' },
            },
            required: ['target', 'replacement'],
          },
        },
      },
      required: ['path', 'edits'],
    },
  };

  createInvocation(params: EditFileParams, messageBus: MessageBus) {
    return new EditFileInvocation(params, messageBus, this.policyEngine);
  }
}

class EditFileInvocation implements ToolInvocation<EditFileParams, ToolResult> {
  constructor(
    public params: EditFileParams,
    private messageBus: MessageBus,
    private policyEngine: PolicyEngine
  ) {}

  getDescription(): string {
    return `Edit ${this.params.path} (${this.params.edits.length} edits)`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    const decision = this.policyEngine.evaluate('edit_file', this.params);
    
    if (decision === 'allow') {
      return false;
    }
    
    if (decision === 'deny') {
      throw new Error('Edit operation denied by policy');
    }
    
    const risk = this.policyEngine.getRiskLevel('edit_file');
    return {
      toolName: 'edit_file',
      description: this.getDescription(),
      risk,
      locations: this.toolLocations(),
    };
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      let content = await fs.readFile(this.params.path, 'utf-8');
      
      // Apply each edit
      for (const edit of this.params.edits) {
        const occurrences = (content.match(new RegExp(this.escapeRegex(edit.target), 'g')) || []).length;
        
        if (occurrences === 0) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Target text not found: "${edit.target}"`,
              type: 'EditTargetNotFound',
            },
          };
        }
        
        if (occurrences > 1) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Target text is ambiguous (${occurrences} matches): "${edit.target}"`,
              type: 'EditTargetAmbiguous',
            },
          };
        }
        
        content = content.replace(edit.target, edit.replacement);
      }
      
      // Write back
      await fs.writeFile(this.params.path, content, 'utf-8');
      
      return {
        llmContent: `Successfully applied ${this.params.edits.length} edits to ${this.params.path}`,
        returnDisplay: `Edited ${this.params.path}`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileEditError',
        },
      };
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```


### File Discovery Tools

**glob Tool:**

```typescript
interface GlobParams {
  pattern: string;
  directory?: string;
  maxResults?: number;
  includeHidden?: boolean;
}

class GlobTool implements DeclarativeTool<GlobParams, ToolResult> {
  name = 'glob';
  displayName = 'Find Files by Pattern';
  schema = {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
        directory: { type: 'string', description: 'Base directory' },
        maxResults: { type: 'number', description: 'Maximum results' },
        includeHidden: { type: 'boolean', description: 'Include hidden files' },
      },
      required: ['pattern'],
    },
  };

  createInvocation(params: GlobParams, messageBus: MessageBus) {
    return new GlobInvocation(params, messageBus);
  }
}

class GlobInvocation implements ToolInvocation<GlobParams, ToolResult> {
  constructor(
    public params: GlobParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `Find files matching ${this.params.pattern}`;
  }

  toolLocations(): string[] {
    return [this.params.directory ?? '.'];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      // Use glob library (e.g., fast-glob)
      const matches = await glob(this.params.pattern, {
        cwd: this.params.directory ?? process.cwd(),
        dot: this.params.includeHidden ?? false,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });
      
      const limited = this.params.maxResults
        ? matches.slice(0, this.params.maxResults)
        : matches;
      
      const result = limited.join('\n');
      
      return {
        llmContent: result,
        returnDisplay: `Found ${limited.length} files${matches.length > limited.length ? ` (showing first ${limited.length})` : ''}`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'GlobError',
        },
      };
    }
  }
}
```


**grep Tool:**

```typescript
interface GrepParams {
  pattern: string;
  directory?: string;
  filePattern?: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

class GrepTool implements DeclarativeTool<GrepParams, ToolResult> {
  name = 'grep';
  displayName = 'Search File Contents';
  schema = {
    name: 'grep',
    description: 'Search for pattern in file contents',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex)' },
        directory: { type: 'string', description: 'Directory to search' },
        filePattern: { type: 'string', description: 'File pattern to search in' },
        caseSensitive: { type: 'boolean', description: 'Case sensitive search' },
        maxResults: { type: 'number', description: 'Maximum results' },
      },
      required: ['pattern'],
    },
  };

  createInvocation(params: GrepParams, messageBus: MessageBus) {
    return new GrepInvocation(params, messageBus);
  }
}

class GrepInvocation implements ToolInvocation<GrepParams, ToolResult> {
  constructor(
    public params: GrepParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `Search for "${this.params.pattern}"`;
  }

  toolLocations(): string[] {
    return [this.params.directory ?? '.'];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const flags = this.params.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(this.params.pattern, flags);
      
      // Find files to search
      const filePattern = this.params.filePattern ?? '**/*';
      const files = await glob(filePattern, {
        cwd: this.params.directory ?? process.cwd(),
        ignore: ['**/node_modules/**', '**/.git/**'],
      });
      
      const results: string[] = [];
      let count = 0;
      
      for (const file of files) {
        if (this.params.maxResults && count >= this.params.maxResults) {
          break;
        }
        
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${file}:${i + 1}: ${lines[i]}`);
            count++;
            
            if (this.params.maxResults && count >= this.params.maxResults) {
              break;
            }
          }
        }
      }
      
      const result = results.join('\n');
      
      return {
        llmContent: result,
        returnDisplay: `Found ${count} matches`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'GrepError',
        },
      };
    }
  }
}
```


**ls Tool:**

```typescript
interface LsParams {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
}

class LsTool implements DeclarativeTool<LsParams, ToolResult> {
  name = 'ls';
  displayName = 'List Directory';
  schema = {
    name: 'ls',
    description: 'List directory contents',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        recursive: { type: 'boolean', description: 'List recursively' },
        includeHidden: { type: 'boolean', description: 'Include hidden files' },
        maxDepth: { type: 'number', description: 'Maximum recursion depth' },
      },
      required: ['path'],
    },
  };

  createInvocation(params: LsParams, messageBus: MessageBus) {
    return new LsInvocation(params, messageBus);
  }
}

class LsInvocation implements ToolInvocation<LsParams, ToolResult> {
  constructor(
    public params: LsParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `List ${this.params.path}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const entries = await this.listDirectory(
        this.params.path,
        0,
        this.params.maxDepth ?? (this.params.recursive ? 3 : 0)
      );
      
      const result = entries.join('\n');
      
      return {
        llmContent: result,
        returnDisplay: `Listed ${entries.length} entries`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'LsError',
        },
      };
    }
  }

  private async listDirectory(
    dir: string,
    depth: number,
    maxDepth: number
  ): Promise<string[]> {
    const entries: string[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      // Skip hidden files unless requested
      if (!this.params.includeHidden && item.name.startsWith('.')) {
        continue;
      }
      
      const indent = '  '.repeat(depth);
      const prefix = item.isDirectory() ? 'd' : '-';
      entries.push(`${indent}${prefix} ${item.name}`);
      
      // Recurse into directories
      if (item.isDirectory() && depth < maxDepth) {
        const subPath = path.join(dir, item.name);
        const subEntries = await this.listDirectory(subPath, depth + 1, maxDepth);
        entries.push(...subEntries);
      }
    }
    
    return entries;
  }
}
```


### Shell Execution Tool

**shell Tool:**

```typescript
interface ShellParams {
  command: string;
  cwd?: string;
  timeout?: number;
  background?: boolean;
}

class ShellTool implements DeclarativeTool<ShellParams, ToolResult> {
  name = 'shell';
  displayName = 'Execute Shell Command';
  schema = {
    name: 'shell',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        cwd: { type: 'string', description: 'Working directory' },
        timeout: { type: 'number', description: 'Timeout in milliseconds' },
        background: { type: 'boolean', description: 'Run in background' },
      },
      required: ['command'],
    },
  };

  constructor(private shellService: ShellExecutionService) {}

  createInvocation(params: ShellParams, messageBus: MessageBus) {
    return new ShellInvocation(params, messageBus, this.policyEngine, this.shellService);
  }
}

class ShellInvocation implements ToolInvocation<ShellParams, ToolResult> {
  constructor(
    public params: ShellParams,
    private messageBus: MessageBus,
    private policyEngine: PolicyEngine,
    private shellService: ShellExecutionService
  ) {}

  getDescription(): string {
    return `Execute: ${this.params.command}`;
  }

  toolLocations(): string[] {
    return [this.params.cwd ?? process.cwd()];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    const decision = this.policyEngine.evaluate('shell', this.params);
    
    if (decision === 'allow') {
      return false;
    }
    
    if (decision === 'deny') {
      throw new Error('Shell execution denied by policy');
    }
    
    return {
      toolName: 'shell',
      description: this.getDescription(),
      risk: 'high',
      locations: this.toolLocations(),
    };
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      const result = await this.shellService.execute({
        command: this.params.command,
        cwd: this.params.cwd,
        timeout: this.params.timeout ?? 30000,
        background: this.params.background ?? false,
        abortSignal: signal,
        onOutput: updateOutput,
      });
      
      return {
        llmContent: `Exit code: ${result.exitCode}\n\nOutput:\n${result.output}`,
        returnDisplay: result.output,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'ShellExecutionError',
        },
      };
    }
  }
}
```

**Shell Execution Service (`packages/core/src/services/shellExecutionService.ts`):**

```typescript
export interface ShellExecutionOptions {
  command: string;
  cwd?: string;
  timeout: number;
  background: boolean;
  abortSignal?: AbortSignal;
  onOutput?: (output: string) => void;
}

export interface ShellExecutionResult {
  exitCode: number;
  output: string;
  error?: string;
}

export class ShellExecutionService {
  async execute(options: ShellExecutionOptions): Promise<ShellExecutionResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(options.command, {
        cwd: options.cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      
      let output = '';
      let error = '';
      
      // Collect output
      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        options.onOutput?.(chunk);
      });
      
      proc.stderr?.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        options.onOutput?.(chunk);
      });
      
      // Handle timeout
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
      
      // Handle abort signal
      options.abortSignal?.addEventListener('abort', () => {
        proc.kill('SIGTERM');
        clearTimeout(timeoutId);
        reject(new Error('Command cancelled'));
      });
      
      // Handle completion
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode: code ?? 0,
          output: output + error,
          error: error || undefined,
        });
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }
}
```


### Web Tools

**web_fetch Tool:**

```typescript
interface WebFetchParams {
  url: string;
  selector?: string;
  maxLength?: number;
}

class WebFetchTool implements DeclarativeTool<WebFetchParams, ToolResult> {
  name = 'web_fetch';
  displayName = 'Fetch Web Content';
  schema = {
    name: 'web_fetch',
    description: 'Fetch content from a URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        selector: { type: 'string', description: 'CSS selector for extraction' },
        maxLength: { type: 'number', description: 'Maximum content length' },
      },
      required: ['url'],
    },
  };

  createInvocation(params: WebFetchParams, messageBus: MessageBus) {
    return new WebFetchInvocation(params, messageBus);
  }
}

class WebFetchInvocation implements ToolInvocation<WebFetchParams, ToolResult> {
  constructor(
    public params: WebFetchParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `Fetch ${this.params.url}`;
  }

  toolLocations(): string[] {
    return [this.params.url];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const response = await fetch(this.params.url, { signal });
      
      if (!response.ok) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            type: 'HttpError',
          },
        };
      }
      
      let content = await response.text();
      
      // Apply CSS selector if provided
      if (this.params.selector) {
        // Use cheerio or similar for HTML parsing
        const $ = cheerio.load(content);
        content = $(this.params.selector).text();
      }
      
      // Truncate if needed
      if (this.params.maxLength && content.length > this.params.maxLength) {
        content = content.slice(0, this.params.maxLength) + 
          `\n\n[Content truncated: ${content.length - this.params.maxLength} characters omitted]`;
      }
      
      return {
        llmContent: content,
        returnDisplay: `Fetched ${content.length} characters`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FetchError',
        },
      };
    }
  }
}
```

**web_search Tool:**

```typescript
interface WebSearchParams {
  query: string;
  numResults?: number;
}

class WebSearchTool implements DeclarativeTool<WebSearchParams, ToolResult> {
  name = 'web_search';
  displayName = 'Search the Web';
  schema = {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', description: 'Number of results' },
      },
      required: ['query'],
    },
  };

  createInvocation(params: WebSearchParams, messageBus: MessageBus) {
    return new WebSearchInvocation(params, messageBus);
  }
}

class WebSearchInvocation implements ToolInvocation<WebSearchParams, ToolResult> {
  constructor(
    public params: WebSearchParams,
    private messageBus: MessageBus
  ) {}

  getDescription(): string {
    return `Search for "${this.params.query}"`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      // Use search API (e.g., DuckDuckGo, SearXNG)
      const results = await this.performSearch(
        this.params.query,
        this.params.numResults ?? 5
      );
      
      const formatted = results.map((r, i) => 
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n');
      
      return {
        llmContent: formatted,
        returnDisplay: `Found ${results.length} results`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'SearchError',
        },
      };
    }
  }

  private async performSearch(query: string, numResults: number) {
    // Implementation depends on search API
    // This is a placeholder
    return [];
  }
}
```


### Persistent Storage Tools

**memory Tool:**

```typescript
interface MemoryParams {
  action: 'get' | 'set' | 'delete' | 'list';
  key?: string;
  value?: string;
}

class MemoryTool implements DeclarativeTool<MemoryParams, ToolResult> {
  name = 'memory';
  displayName = 'Persistent Memory';
  schema = {
    name: 'memory',
    description: 'Store and retrieve persistent key-value data',
    parameters: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['get', 'set', 'delete', 'list'],
          description: 'Action to perform' 
        },
        key: { type: 'string', description: 'Key name' },
        value: { type: 'string', description: 'Value to store' },
      },
      required: ['action'],
    },
  };

  constructor(private storePath: string) {}

  createInvocation(params: MemoryParams, messageBus: MessageBus) {
    return new MemoryInvocation(params, messageBus, this.storePath);
  }
}

class MemoryInvocation implements ToolInvocation<MemoryParams, ToolResult> {
  constructor(
    public params: MemoryParams,
    private messageBus: MessageBus,
    private storePath: string
  ) {}

  getDescription(): string {
    return `Memory ${this.params.action}${this.params.key ? ` ${this.params.key}` : ''}`;
  }

  toolLocations(): string[] {
    return [this.storePath];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const store = await this.loadStore();
      
      switch (this.params.action) {
        case 'get':
          if (!this.params.key) {
            throw new Error('Key required for get action');
          }
          const value = store[this.params.key];
          return {
            llmContent: value ?? 'Key not found',
            returnDisplay: value ? `Retrieved ${this.params.key}` : 'Key not found',
          };
        
        case 'set':
          if (!this.params.key || !this.params.value) {
            throw new Error('Key and value required for set action');
          }
          store[this.params.key] = this.params.value;
          await this.saveStore(store);
          return {
            llmContent: `Stored ${this.params.key}`,
            returnDisplay: `Stored ${this.params.key}`,
          };
        
        case 'delete':
          if (!this.params.key) {
            throw new Error('Key required for delete action');
          }
          delete store[this.params.key];
          await this.saveStore(store);
          return {
            llmContent: `Deleted ${this.params.key}`,
            returnDisplay: `Deleted ${this.params.key}`,
          };
        
        case 'list':
          const keys = Object.keys(store);
          return {
            llmContent: keys.join('\n'),
            returnDisplay: `${keys.length} keys`,
          };
        
        default:
          throw new Error(`Unknown action: ${this.params.action}`);
      }
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'MemoryError',
        },
      };
    }
  }

  private async loadStore(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(this.storePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async saveStore(store: Record<string, string>): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }
}
```


**write_todos Tool:**

```typescript
interface WriteTodosParams {
  action: 'add' | 'complete' | 'remove' | 'list';
  task?: string;
  id?: string;
}

class WriteTodosTool implements DeclarativeTool<WriteTodosParams, ToolResult> {
  name = 'write_todos';
  displayName = 'Manage Todos';
  schema = {
    name: 'write_todos',
    description: 'Manage a todo list',
    parameters: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['add', 'complete', 'remove', 'list'],
          description: 'Action to perform' 
        },
        task: { type: 'string', description: 'Task description' },
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['action'],
    },
  };

  constructor(private todosPath: string) {}

  createInvocation(params: WriteTodosParams, messageBus: MessageBus) {
    return new WriteTodosInvocation(params, messageBus, this.todosPath);
  }
}

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  createdAt: string;
}

class WriteTodosInvocation implements ToolInvocation<WriteTodosParams, ToolResult> {
  constructor(
    public params: WriteTodosParams,
    private messageBus: MessageBus,
    private todosPath: string
  ) {}

  getDescription(): string {
    return `Todo ${this.params.action}`;
  }

  toolLocations(): string[] {
    return [this.todosPath];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal) {
    return false;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const todos = await this.loadTodos();
      
      switch (this.params.action) {
        case 'add':
          if (!this.params.task) {
            throw new Error('Task required for add action');
          }
          const newTodo: Todo = {
            id: crypto.randomUUID(),
            task: this.params.task,
            completed: false,
            createdAt: new Date().toISOString(),
          };
          todos.push(newTodo);
          await this.saveTodos(todos);
          return {
            llmContent: `Added todo: ${newTodo.id}`,
            returnDisplay: `Added: ${this.params.task}`,
          };
        
        case 'complete':
          if (!this.params.id) {
            throw new Error('ID required for complete action');
          }
          const todoToComplete = todos.find(t => t.id === this.params.id);
          if (!todoToComplete) {
            throw new Error(`Todo not found: ${this.params.id}`);
          }
          todoToComplete.completed = true;
          await this.saveTodos(todos);
          return {
            llmContent: `Completed todo: ${this.params.id}`,
            returnDisplay: `Completed: ${todoToComplete.task}`,
          };
        
        case 'remove':
          if (!this.params.id) {
            throw new Error('ID required for remove action');
          }
          const index = todos.findIndex(t => t.id === this.params.id);
          if (index === -1) {
            throw new Error(`Todo not found: ${this.params.id}`);
          }
          const removed = todos.splice(index, 1)[0];
          await this.saveTodos(todos);
          return {
            llmContent: `Removed todo: ${this.params.id}`,
            returnDisplay: `Removed: ${removed.task}`,
          };
        
        case 'list':
          const formatted = todos.map(t => 
            `[${t.completed ? 'x' : ' '}] ${t.id}: ${t.task}`
          ).join('\n');
          return {
            llmContent: formatted,
            returnDisplay: `${todos.length} todos`,
          };
        
        default:
          throw new Error(`Unknown action: ${this.params.action}`);
      }
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'TodoError',
        },
      };
    }
  }

  private async loadTodos(): Promise<Todo[]> {
    try {
      const content = await fs.readFile(this.todosPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async saveTodos(todos: Todo[]): Promise<void> {
    await fs.writeFile(this.todosPath, JSON.stringify(todos, null, 2), 'utf-8');
  }
}
```


## Data Models

### Tool Registration Flow

1. **Tool Definition** → `DeclarativeTool` with name, schema, and invocation factory
2. **Registration** → `ToolRegistry.register(tool)` stores tool by name
3. **Schema Exposure** → `ToolRegistry.getFunctionSchemas()` provides schemas to LLM
4. **Tool Call** → LLM requests tool with name and parameters
5. **Invocation Creation** → `tool.createInvocation(params, messageBus)` creates invocation
6. **Policy Check** → `invocation.shouldConfirmExecute()` checks policy
7. **Execution** → `invocation.execute()` performs operation
8. **Result** → `ToolResult` returned with llmContent and returnDisplay

### Policy Evaluation Flow

1. **Tool Invocation** → Tool name and parameters provided
2. **Rule Matching** → Policy engine finds matching rule (tool-specific first, then wildcard)
3. **Condition Evaluation** → If rule has conditions, evaluate against parameters
4. **Decision** → Return 'allow', 'deny', or 'ask'
5. **Confirmation** → If 'ask', request user confirmation via Message Bus
6. **Execution** → If approved, execute tool; if denied, return error

### Message Bus Flow

1. **Request** → Tool invocation requests confirmation with details
2. **Correlation ID** → Unique ID generated for tracking
3. **Emit Event** → Request emitted to UI layer
4. **User Response** → User approves or denies
5. **Response** → Response delivered to waiting invocation via correlation ID
6. **Timeout** → If no response within timeout, reject with error

## Error Handling

### File Operation Errors

**File Not Found:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'File not found: /path/to/file.txt',
    type: 'FileNotFoundError'
  }
}
```

**File Already Exists:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'File already exists. Set overwrite=true to replace it.',
    type: 'FileExistsError'
  }
}
```

**Permission Denied:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'Permission denied: /path/to/file.txt',
    type: 'PermissionError'
  }
}
```

### Edit Operation Errors

**Target Not Found:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'Target text not found: "function oldName"',
    type: 'EditTargetNotFound'
  }
}
```

**Ambiguous Target:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'Target text is ambiguous (3 matches): "const x"',
    type: 'EditTargetAmbiguous'
  }
}
```

### Shell Execution Errors

**Timeout:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'Command timed out after 30000ms',
    type: 'ShellTimeoutError'
  }
}
```

**Non-Zero Exit Code:**
```typescript
{
  llmContent: 'Exit code: 1\n\nOutput:\nerror: command failed',
  returnDisplay: 'error: command failed',
  error: {
    message: 'Command exited with code 1',
    type: 'ShellExecutionError'
  }
}
```

### Web Operation Errors

**HTTP Error:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'HTTP 404: Not Found',
    type: 'HttpError'
  }
}
```

**Network Error:**
```typescript
{
  llmContent: '',
  returnDisplay: '',
  error: {
    message: 'Failed to fetch: Network request failed',
    type: 'FetchError'
  }
}
```

### Policy Errors

**Denied by Policy:**
```typescript
throw new Error('Write operation denied by policy');
```

**Confirmation Timeout:**
```typescript
throw new Error('Confirmation request timed out');
```

**Confirmation Cancelled:**
```typescript
throw new Error('Confirmation request cancelled');
```

### Abort Signal Handling

All tool executions respect the AbortSignal:

```typescript
async execute(signal: AbortSignal): Promise<ToolResult> {
  // Check signal before starting
  if (signal.aborted) {
    throw new Error('Operation cancelled');
  }
  
  // Pass signal to async operations
  const response = await fetch(url, { signal });
  
  // Check signal during long operations
  for (const item of items) {
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }
    // Process item
  }
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Tool Registration and Retrieval

*For any* tool with a unique name, registering it in the Tool_Registry and then retrieving it by name should return the same tool instance.

**Validates: Requirements 1.1, 1.5**

### Property 2: Tool Replacement

*For any* two tools with the same name, registering the first then registering the second should result in only the second tool being retrievable.

**Validates: Requirements 1.2**

### Property 3: Tool Unregistration

*For any* registered tool, unregistering it by name should result in that tool no longer being retrievable.

**Validates: Requirements 1.3**

### Property 4: Tool List Ordering and Consistency

*For any* set of registered tools, calling list() should return all tools in alphabetical order by name, and multiple calls to list() should return the same ordering.

**Validates: Requirements 1.4, 1.7**

### Property 5: Schema Generation Completeness

*For any* set of registered tools, getFunctionSchemas() should return exactly one schema for each tool, with all schema fields (name, description, parameters) preserved.

**Validates: Requirements 1.6**

### Property 6: File Read Round Trip

*For any* file content, writing it to a file and then reading it back should return the same content.

**Validates: Requirements 2.1, 2.9, 3.1**

### Property 7: File Read Line Range Slicing

*For any* file and any valid line range (startLine, endLine), reading the file with that range should return exactly the lines within that range (inclusive).

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 8: File Read Error Handling

*For any* non-existent file path, attempting to read it should return an error with type 'FileNotFoundError'.

**Validates: Requirements 2.5**

### Property 9: Multiple File Read Formatting

*For any* set of file paths, reading them with read_many_files should return output containing each file path as a header followed by its content.

**Validates: Requirements 2.8**

### Property 10: File Write Overwrite Protection

*For any* existing file, attempting to write to it without the overwrite flag should return an error with type 'FileExistsError'.

**Validates: Requirements 3.2**

### Property 11: File Write Overwrite Behavior

*For any* existing file and new content, writing with overwrite=true should replace the file content, and reading it back should return the new content.

**Validates: Requirements 3.3**

### Property 12: Parent Directory Creation

*For any* file path with non-existent parent directories, writing to that path should create all parent directories.

**Validates: Requirements 3.4**

### Property 13: File Edit Target Uniqueness

*For any* file and edit target that appears exactly once, applying the edit should succeed and the target should be replaced with the replacement text.

**Validates: Requirements 3.5**

### Property 14: File Edit Target Not Found

*For any* file and edit target that does not appear in the file, attempting the edit should return an error with type 'EditTargetNotFound'.

**Validates: Requirements 3.6**

### Property 15: File Edit Target Ambiguity

*For any* file and edit target that appears multiple times, attempting the edit should return an error with type 'EditTargetAmbiguous'.

**Validates: Requirements 3.7**

### Property 16: Glob Pattern Matching

*For any* file structure and glob pattern, the glob tool should return all and only the files that match the pattern.

**Validates: Requirements 4.1**

### Property 17: Glob Max Results Constraint

*For any* glob search with maxResults specified, the number of returned results should be less than or equal to maxResults.

**Validates: Requirements 4.2**

### Property 18: Glob Hidden File Filtering

*For any* file structure containing hidden files, glob with includeHidden=false should exclude all hidden files, and includeHidden=true should include them.

**Validates: Requirements 4.3, 4.4**

### Property 19: Grep Pattern Matching

*For any* file structure and search pattern, grep should return all lines containing matches to the pattern along with their file paths and line numbers.

**Validates: Requirements 4.5**

### Property 20: Grep Case Sensitivity

*For any* search pattern and file content, grep with caseSensitive=true should only match exact case, while caseSensitive=false should match regardless of case.

**Validates: Requirements 4.6, 4.7**

### Property 21: Grep File Pattern Filtering

*For any* grep search with filePattern specified, only files matching the filePattern should be searched.

**Validates: Requirements 4.8**

### Property 22: Directory Listing Completeness

*For any* directory, ls should return all non-hidden entries (or all entries if includeHidden=true).

**Validates: Requirements 4.9**

### Property 23: Directory Listing Recursion

*For any* directory with subdirectories, ls with recursive=true should include subdirectory contents, and maxDepth should limit the recursion depth.

**Validates: Requirements 4.10, 4.11**

### Property 24: Gitignore Respect

*For any* file discovery operation (glob, grep, ls) in a directory with .gitignore, files matching .gitignore patterns should be excluded from results.

**Validates: Requirements 4.12**

### Property 25: Shell Command Execution

*For any* shell command, executing it should return a ToolResult containing the command output and exit code.

**Validates: Requirements 5.1**

### Property 26: Shell Output Streaming

*For any* shell command with streaming enabled, the updateOutput callback should be invoked with incremental output during execution.

**Validates: Requirements 5.2**

### Property 27: Shell Timeout Enforcement

*For any* shell command that runs longer than the timeout, the shell tool should terminate the process and return a timeout error.

**Validates: Requirements 5.3**

### Property 28: Shell Working Directory

*For any* shell command with a specified working directory, the command should execute in that directory.

**Validates: Requirements 5.7**

### Property 29: Web Fetch Content Retrieval

*For any* valid URL, web_fetch should return the page content as text.

**Validates: Requirements 6.1**

### Property 30: Web Fetch CSS Selector

*For any* URL and CSS selector, web_fetch with the selector should return only content matching that selector.

**Validates: Requirements 6.2**

### Property 31: Web Fetch Truncation

*For any* web content exceeding maxLength, web_fetch should truncate the output at maxLength and append a truncation indicator.

**Validates: Requirements 6.3**

### Property 32: Web Search Result Count

*For any* search query with numResults specified, web_search should return at most numResults results.

**Validates: Requirements 6.7**

### Property 33: Policy Decision Evaluation

*For any* tool and parameters, the Policy_Engine should return 'allow' if a matching allow rule exists, 'deny' if a deny rule exists, 'ask' if an ask rule exists, or the default action if no rule matches.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 34: Policy Rule Precedence

*For any* tool with both a tool-specific rule and a wildcard rule, the Policy_Engine should apply the tool-specific rule.

**Validates: Requirements 7.4**

### Property 35: Policy Condition Evaluation

*For any* policy rule with conditions, the Policy_Engine should only apply the rule if all conditions evaluate to true against the tool parameters.

**Validates: Requirements 7.6**

### Property 36: Policy Risk Classification

*For any* tool, the Policy_Engine should classify it with a risk level of low, medium, or high.

**Validates: Requirements 7.7**

### Property 37: Confirmation Details Completeness

*For any* tool requiring confirmation, the confirmation details should include the tool name, description, risk level, and affected locations.

**Validates: Requirements 7.8**

### Property 38: Message Bus Correlation ID Uniqueness

*For any* set of confirmation requests, each should receive a unique correlation ID.

**Validates: Requirements 8.1**

### Property 39: Message Bus Request-Response Matching

*For any* confirmation request, the Message_Bus should deliver the response with matching correlation ID to the correct requester.

**Validates: Requirements 8.2, 8.3**

### Property 40: Message Bus Timeout Handling

*For any* confirmation request that receives no response within the timeout period, the Message_Bus should reject with a timeout error.

**Validates: Requirements 8.4**

### Property 41: Message Bus Concurrent Requests

*For any* set of concurrent confirmation requests, the Message_Bus should handle each independently without interference.

**Validates: Requirements 8.5**

### Property 42: Message Bus Cancellation

*For any* confirmation request with an AbortSignal, triggering the signal should cancel the request and reject with a cancellation error.

**Validates: Requirements 8.6**

### Property 43: Output Truncation Behavior

*For any* tool output exceeding maxChars or maxLines, the system should truncate at the limit and append an indicator specifying how much content was omitted.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 44: Tool Invocation Parameter Validation

*For any* tool invocation with parameters that don't match the tool schema, the system should return a validation error.

**Validates: Requirements 10.1**

### Property 45: Tool Invocation Description

*For any* tool invocation, getDescription() should return a non-empty human-readable string describing the operation.

**Validates: Requirements 10.2**

### Property 46: Tool Invocation Locations

*For any* tool invocation, toolLocations() should return an array of file paths or resources that will be affected.

**Validates: Requirements 10.3**

### Property 47: Tool Invocation Confirmation Check

*For any* tool invocation, shouldConfirmExecute() should return either false (no confirmation needed) or ToolCallConfirmationDetails (confirmation needed).

**Validates: Requirements 10.4**

### Property 48: Tool Invocation Abort Signal Respect

*For any* tool execution with an AbortSignal, triggering the signal should cause the execution to stop and throw a cancellation error.

**Validates: Requirements 10.5**

### Property 49: Tool Result Format

*For any* tool execution, the returned ToolResult should contain llmContent and returnDisplay fields.

**Validates: Requirements 10.7**

### Property 50: Memory Storage Round Trip

*For any* key-value pair, storing it with the memory tool and then retrieving it should return the same value.

**Validates: Requirements 11.1, 11.2**

### Property 51: Memory Deletion

*For any* stored key, deleting it with the memory tool should result in subsequent retrieval indicating the key is not found.

**Validates: Requirements 11.3**

### Property 52: Memory Key Listing

*For any* set of stored key-value pairs, listing memory keys should return exactly the set of stored keys.

**Validates: Requirements 11.4**

### Property 53: Todo Addition

*For any* todo task, adding it should result in the todo list containing that task with a unique ID and completed=false.

**Validates: Requirements 11.5**

### Property 54: Todo Completion

*For any* todo in the list, completing it by ID should result in that todo having completed=true.

**Validates: Requirements 11.6**

### Property 55: Todo Removal

*For any* todo in the list, removing it by ID should result in that todo no longer appearing in the list.

**Validates: Requirements 11.7**

### Property 56: Todo Listing

*For any* todo list state, listing todos should return all todos with their current status (completed or not).

**Validates: Requirements 11.8**

### Property 57: Error Result Format

*For any* tool execution that encounters an error, the ToolResult should include an error object with message and type fields.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**


## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** will verify:
- Specific examples of tool registration and execution
- Edge cases like binary files, size limits, and empty inputs
- Error conditions such as file not found, permission denied, and timeout
- Integration between components (Tool Registry → Policy Engine → Tool Invocation)
- Specific HTTP error codes (404, 500, timeout)
- Specific shell commands and their expected outputs

**Property-Based Tests** will verify:
- Universal properties across all inputs (as defined above)
- Randomized file contents, paths, and tool parameters
- Round-trip properties for file operations and memory storage
- Concurrent tool execution and message bus behavior
- Policy evaluation across random rule configurations

### Property-Based Testing Configuration

We will use **fast-check** (already in package.json) as the property-based testing library for TypeScript.

Each property test will:
- Run a minimum of 100 iterations to ensure comprehensive input coverage
- Be tagged with a comment referencing the design property
- Tag format: `// Feature: stage-03-tools-policy, Property N: [property text]`

Example test structure:

```typescript
import fc from 'fast-check';
import { describe, it } from 'vitest';

describe('Tool Registry', () => {
  it('Property 1: Tool Registration and Retrieval', () => {
    // Feature: stage-03-tools-policy, Property 1: Tool Registration and Retrieval
    fc.assert(
      fc.property(
        fc.string().filter(s => s.length > 0), // tool name
        fc.record({ name: fc.string() }), // mock tool
        (name, mockTool) => {
          const registry = new ToolRegistry();
          mockTool.name = name;
          registry.register(mockTool as any);
          const retrieved = registry.get(name);
          return retrieved === mockTool;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Testing Focus Areas

1. **Tool Registry**: Registration, retrieval, replacement, unregistration, listing, schema generation
2. **File Operations**: Read, write, edit with various line ranges and parameters
3. **File Discovery**: Glob patterns, grep searches, directory listings
4. **Shell Execution**: Command execution, streaming, timeouts, working directory
5. **Web Tools**: Fetching, CSS selectors, truncation, search results
6. **Policy Engine**: Rule evaluation, precedence, condition matching, risk classification
7. **Message Bus**: Correlation IDs, request-response matching, timeouts, concurrent requests
8. **Output Management**: Truncation, formatting, streaming callbacks
9. **Persistent Storage**: Memory and todo operations with round-trip properties
10. **Error Handling**: File errors, network errors, validation errors, cancellation

### Mock Services for Testing

We will create mock services in `packages/core/src/tools/__tests__/mocks/` that:
- Provide in-memory file systems for file operation testing
- Simulate shell command execution with predictable outputs
- Mock HTTP responses for web tool testing
- Provide configurable policy rules for policy engine testing
- Support deterministic behavior for property-based testing

This allows testing the tool system without requiring real file system access, network calls, or shell execution.

### Test File Organization

```
packages/core/src/tools/__tests__/
├── tool-registry.test.ts
├── read-file.test.ts
├── write-file.test.ts
├── edit-file.test.ts
├── glob.test.ts
├── grep.test.ts
├── ls.test.ts
├── shell.test.ts
├── web-fetch.test.ts
├── web-search.test.ts
├── memory.test.ts
├── write-todos.test.ts
├── output-helpers.test.ts
└── mocks/
    ├── mockFileSystem.ts
    ├── mockShellService.ts
    ├── mockHttpClient.ts
    └── mockPolicyEngine.ts

packages/core/src/policy/__tests__/
├── policyEngine.test.ts
└── policyRules.test.ts

packages/core/src/confirmation-bus/__tests__/
└── messageBus.test.ts
```

### Property Test Generators

We will create custom generators for property-based testing:

```typescript
// File path generator
const filePathArb = fc.array(
  fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3'), { minLength: 1, maxLength: 10 }),
  { minLength: 1, maxLength: 5 }
).map(parts => parts.join('/'));

// File content generator
const fileContentArb = fc.string({ minLength: 0, maxLength: 1000 });

// Line range generator
const lineRangeArb = (maxLines: number) => fc.record({
  startLine: fc.integer({ min: 1, max: maxLines }),
  endLine: fc.integer({ min: 1, max: maxLines }),
}).filter(range => range.startLine <= range.endLine);

// Tool name generator
const toolNameArb = fc.stringOf(
  fc.constantFrom('a', 'b', 'c', '_', '-'),
  { minLength: 1, maxLength: 20 }
);

// Policy rule generator
const policyRuleArb = fc.record({
  tool: fc.oneof(toolNameArb, fc.constant('*')),
  action: fc.constantFrom('allow', 'deny', 'ask'),
  risk: fc.constantFrom('low', 'medium', 'high'),
});
```

### Integration Testing

In addition to unit and property tests, we will create integration tests that:
- Test the full flow from tool registration to execution
- Verify policy engine integration with tool invocations
- Test message bus integration with confirmation UI
- Verify error propagation through the entire stack
- Test concurrent tool execution scenarios

These integration tests will use real implementations (not mocks) where possible to ensure components work together correctly.

