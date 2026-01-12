# Design Document

## Overview

The Hooks, Extensions, and MCP system provides a comprehensive extensibility framework for OLLM CLI. It consists of three interconnected subsystems:

1. **Hook System**: Event-driven execution of custom scripts at specific lifecycle points
2. **Extension System**: Manifest-based packaging of hooks, MCP servers, settings, and skills
3. **MCP Integration**: Client for communicating with Model Context Protocol servers to provide external tools

The design prioritizes security through a trust model, reliability through error isolation, and developer experience through clear protocols and conventions.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Core                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Hook       │    │  Extension   │    │     MCP      │  │
│  │   System     │◄───┤   Manager    │───►│    Client    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Trust     │    │   Manifest   │    │    Tool      │  │
│  │    Model     │    │   Parser     │    │   Wrapper    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Tool Registry   │
                    └──────────────────┘
```

### Component Interaction Flow

```
Extension Loading:
Extension Manager → Manifest Parser → Validate Schema
                 → Hook Registry (register hooks)
                 → MCP Client (start servers)
                 → Tool Registry (register MCP tools)

Hook Execution:
Event Trigger → Hook Planner → Identify Hooks
             → Trust Model → Verify Approval
             → Hook Runner → Execute with Timeout
             → Hook Translator → Parse Output
             → System → Process Results

MCP Tool Call:
Agent → Tool Registry → Tool Wrapper
     → MCP Client → MCP Server
     → Tool Wrapper → Format Response
     → Agent → Display Result
```

## Components and Interfaces

### Hook System Components

#### HookRegistry

Manages registration and discovery of hooks.

```typescript
interface HookRegistry {
  /**
   * Register a hook for a specific event
   */
  registerHook(event: HookEvent, hook: Hook): void;
  
  /**
   * Get all hooks for an event
   */
  getHooksForEvent(event: HookEvent): Hook[];
  
  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string): void;
  
  /**
   * Get all registered hooks
   */
  getAllHooks(): Map<HookEvent, Hook[]>;
  
  /**
   * Clear all hooks for an event
   */
  clearEvent(event: HookEvent): void;
}

interface Hook {
  id: string;
  name: string;
  command: string;
  args?: string[];
  source: HookSource;
  extensionName?: string;
}

type HookEvent = 
  | 'session_start'
  | 'session_end'
  | 'before_agent'
  | 'after_agent'
  | 'before_model'
  | 'after_model'
  | 'before_tool_selection'
  | 'before_tool'
  | 'after_tool';

type HookSource = 'builtin' | 'user' | 'workspace' | 'downloaded';
```

#### HookPlanner

Determines which hooks to execute for an event.

```typescript
interface HookPlanner {
  /**
   * Plan hook execution for an event
   */
  planExecution(event: HookEvent, context: HookContext): HookExecutionPlan;
}

interface HookExecutionPlan {
  hooks: Hook[];
  order: 'registration' | 'priority';
  parallel: boolean;
}

interface HookContext {
  sessionId: string;
  event: HookEvent;
  data: Record<string, unknown>;
}
```

#### HookRunner

Executes hooks with timeout and error handling.

```typescript
interface HookRunner {
  /**
   * Execute a single hook
   */
  executeHook(hook: Hook, input: HookInput): Promise<HookOutput>;
  
  /**
   * Execute multiple hooks in sequence
   */
  executeHooks(hooks: Hook[], input: HookInput): Promise<HookOutput[]>;
  
  /**
   * Set timeout for hook execution
   */
  setTimeout(ms: number): void;
}

interface HookInput {
  event: string;
  data: Record<string, unknown>;
}

interface HookOutput {
  continue: boolean;
  systemMessage?: string;
  data?: Record<string, unknown>;
  error?: string;
}
```

#### HookTranslator

Converts between system data and hook protocol.

```typescript
interface HookTranslator {
  /**
   * Convert system data to hook input format
   */
  toHookInput(event: HookEvent, data: unknown): HookInput;
  
  /**
   * Parse hook output from JSON
   */
  parseHookOutput(json: string): HookOutput;
  
  /**
   * Validate hook output structure
   */
  validateOutput(output: unknown): boolean;
}
```

#### TrustedHooks

Manages hook trust and approval.

```typescript
interface TrustedHooks {
  /**
   * Check if a hook is trusted
   */
  isTrusted(hook: Hook): Promise<boolean>;
  
  /**
   * Request user approval for a hook
   */
  requestApproval(hook: Hook): Promise<boolean>;
  
  /**
   * Store approval for a hook
   */
  storeApproval(hook: Hook, hash: string): Promise<void>;
  
  /**
   * Compute hash of hook script
   */
  computeHash(hook: Hook): Promise<string>;
  
  /**
   * Load trusted hooks from storage
   */
  load(): Promise<void>;
  
  /**
   * Save trusted hooks to storage
   */
  save(): Promise<void>;
}

interface HookApproval {
  source: string;
  hash: string;
  approvedAt: string;
  approvedBy: string;
}
```

### Extension System Components

#### ExtensionManager

Manages extension lifecycle.

```typescript
interface ExtensionManager {
  /**
   * Load all extensions from configured directories
   */
  loadExtensions(): Promise<Extension[]>;
  
  /**
   * Get a specific extension by name
   */
  getExtension(name: string): Extension | undefined;
  
  /**
   * Enable an extension
   */
  enableExtension(name: string): Promise<void>;
  
  /**
   * Disable an extension
   */
  disableExtension(name: string): Promise<void>;
  
  /**
   * Get all loaded extensions
   */
  getAllExtensions(): Extension[];
  
  /**
   * Reload an extension
   */
  reloadExtension(name: string): Promise<void>;
}

interface Extension {
  name: string;
  version: string;
  description: string;
  path: string;
  manifest: ExtensionManifest;
  enabled: boolean;
  hooks: Hook[];
  mcpServers: MCPServerConfig[];
  settings: ExtensionSetting[];
  skills: Skill[];
}
```

#### ManifestParser

Parses and validates extension manifests.

```typescript
interface ManifestParser {
  /**
   * Parse manifest from file
   */
  parseManifest(path: string): Promise<ExtensionManifest>;
  
  /**
   * Validate manifest structure
   */
  validateManifest(manifest: unknown): boolean;
  
  /**
   * Get validation errors
   */
  getErrors(): string[];
}

interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  mcpServers?: Record<string, MCPServerConfig>;
  hooks?: Record<HookEvent, HookConfig[]>;
  settings?: ExtensionSetting[];
  skills?: Skill[];
}

interface HookConfig {
  name: string;
  command: string;
  args?: string[];
}

interface ExtensionSetting {
  name: string;
  envVar?: string;
  sensitive?: boolean;
  description: string;
  default?: unknown;
}

interface Skill {
  name: string;
  description: string;
  prompt: string;
}
```

### MCP Integration Components

#### MCPClient

Manages MCP server connections.

```typescript
interface MCPClient {
  /**
   * Start an MCP server
   */
  startServer(name: string, config: MCPServerConfig): Promise<void>;
  
  /**
   * Stop an MCP server
   */
  stopServer(name: string): Promise<void>;
  
  /**
   * Get server status
   */
  getServerStatus(name: string): MCPServerStatus;
  
  /**
   * List all servers
   */
  listServers(): MCPServerInfo[];
  
  /**
   * Call a tool on an MCP server
   */
  callTool(serverName: string, toolName: string, args: unknown): Promise<unknown>;
  
  /**
   * Get tools from a server
   */
  getTools(serverName: string): Promise<MCPTool[]>;
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'http';
}

interface MCPServerStatus {
  name: string;
  status: 'starting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  tools: number;
}

interface MCPServerInfo {
  name: string;
  status: MCPServerStatus;
  config: MCPServerConfig;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: unknown;
}
```

#### MCPTransport

Handles communication with MCP servers.

```typescript
interface MCPTransport {
  /**
   * Connect to MCP server
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from MCP server
   */
  disconnect(): Promise<void>;
  
  /**
   * Send request to server
   */
  sendRequest(request: MCPRequest): Promise<MCPResponse>;
  
  /**
   * Check if connected
   */
  isConnected(): boolean;
}

interface MCPRequest {
  method: string;
  params?: unknown;
}

interface MCPResponse {
  result?: unknown;
  error?: MCPError;
}

interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}
```

#### MCPSchemaConverter

Converts MCP schemas to internal format.

```typescript
interface MCPSchemaConverter {
  /**
   * Convert MCP tool schema to internal ToolSchema
   */
  convertToolSchema(mcpTool: MCPTool): ToolSchema;
  
  /**
   * Convert internal args to MCP format
   */
  convertArgsToMCP(args: Record<string, unknown>): unknown;
  
  /**
   * Convert MCP result to internal format
   */
  convertResultFromMCP(result: unknown): unknown;
}
```

#### MCPToolWrapper

Wraps MCP tools as internal tools.

```typescript
interface MCPToolWrapper {
  /**
   * Create a tool wrapper for an MCP tool
   */
  wrapTool(serverName: string, mcpTool: MCPTool): Tool;
  
  /**
   * Execute an MCP tool
   */
  executeTool(serverName: string, toolName: string, args: unknown): Promise<ToolResult>;
}
```

## Data Models

### Hook Protocol Messages

#### Hook Input Format

```json
{
  "event": "before_model",
  "data": {
    "session_id": "abc123",
    "prompt": "User prompt text",
    "model": "llama2",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ]
  }
}
```

#### Hook Output Format

```json
{
  "continue": true,
  "systemMessage": "Additional context from hook",
  "data": {
    "customField": "value"
  }
}
```

### Extension Manifest

```json
{
  "name": "github-integration",
  "version": "1.0.0",
  "description": "GitHub integration for OLLM",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  },
  "hooks": {
    "session_start": [
      {
        "name": "init-github",
        "command": "node",
        "args": ["hooks/init.js"]
      }
    ],
    "before_tool": [
      {
        "name": "validate-github",
        "command": "node",
        "args": ["hooks/validate.js"]
      }
    ]
  },
  "settings": [
    {
      "name": "githubToken",
      "envVar": "GITHUB_TOKEN",
      "sensitive": true,
      "description": "GitHub personal access token"
    },
    {
      "name": "defaultRepo",
      "description": "Default repository for operations",
      "default": "owner/repo"
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

### Trusted Hooks Storage

```json
{
  "version": 1,
  "approvals": [
    {
      "source": ".ollm/extensions/my-ext/hooks/validate.js",
      "hash": "sha256:abc123def456...",
      "approvedAt": "2024-01-15T10:30:00Z",
      "approvedBy": "user"
    }
  ]
}
```

### MCP Server Configuration

```typescript
interface MCPServerConfig {
  command: string;           // Executable command
  args: string[];           // Command arguments
  env?: Record<string, string>;  // Environment variables
  transport?: 'stdio' | 'sse' | 'http';  // Communication transport
  timeout?: number;         // Connection timeout in ms
}
```

### Configuration Schema

```yaml
hooks:
  enabled: true
  timeout: 30000
  trustWorkspace: false

extensions:
  enabled: true
  directories:
    - ~/.ollm/extensions
    - .ollm/extensions
  autoEnable: true

mcp:
  enabled: true
  connectionTimeout: 10000
  servers: {}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Hook Registration and Retrieval

*For any* hook and event, registering the hook for that event should make it retrievable when querying hooks for that event.

**Validates: Requirements 1.1, 1.2**

### Property 2: Hook Execution Order

*For any* set of hooks registered for the same event, executing those hooks should run them in registration order, with user extension hooks executing before workspace extension hooks.

**Validates: Requirements 1.3, 12.1, 12.2, 12.3, 12.4, 12.5**

### Property 3: Hook Timeout Termination

*For any* hook that exceeds the configured timeout, the hook runner should terminate it and continue executing remaining hooks without blocking.

**Validates: Requirements 1.4, 11.2**

### Property 4: Hook Error Isolation

*For any* hook that fails with an error or exception, the hook runner should log the error and continue executing remaining hooks without propagating the exception.

**Validates: Requirements 1.5, 11.1**

### Property 5: Hook Output Capture

*For any* hook that completes successfully, the hook runner should capture the hook's stdout output and parse it as JSON.

**Validates: Requirements 1.6, 2.3**

### Property 6: Hook Protocol Round Trip

*For any* valid system event data, converting it to hook input format and then parsing hook output should preserve the event type and allow data to flow through the hook protocol.

**Validates: Requirements 1.8, 1.9, 2.1, 2.2**

### Property 7: Hook Output Validation

*For any* hook output, it should include a continue field, and if it includes systemMessage or custom data fields, those should be preserved and accessible.

**Validates: Requirements 2.4, 2.5, 2.6**

### Property 8: Malformed Hook Output Handling

*For any* hook that produces malformed JSON output, the hook runner should log an error, treat the hook as failed, and treat continue as true to allow system operation to proceed.

**Validates: Requirements 2.7, 15.6**

### Property 9: Hook Trust Rules

*For any* hook, its trust status should be determined by its source: built-in and user hooks are trusted by default, while workspace and downloaded hooks require approval (unless trustWorkspace is enabled).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 10: Hook Approval Persistence

*For any* hook that receives user approval, computing its hash and storing the approval should make the hook trusted on subsequent checks as long as the hash remains unchanged.

**Validates: Requirements 3.6, 3.7, 3.9**

### Property 11: Hook Hash Change Detection

*For any* previously approved hook, if its content changes (resulting in a different hash), it should require re-approval before execution.

**Validates: Requirements 3.8**

### Property 12: Extension Discovery

*For any* extension directory containing a valid manifest.json file, the extension manager should discover and load the extension when scanning configured directories.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 13: Invalid Extension Handling

*For any* extension with an invalid manifest, the extension manager should log an error, skip that extension, and continue loading other extensions without failing.

**Validates: Requirements 4.5, 11.5**

### Property 14: Extension Registration

*For any* loaded extension, its hooks should be registered with the hook registry, its MCP servers should be registered with the MCP client, and its settings should be merged with core configuration.

**Validates: Requirements 4.6, 4.7, 4.8, 4.9**

### Property 15: Manifest Required Fields

*For any* extension manifest, it should include name, version, and description fields, and validation should fail if any required field is missing.

**Validates: Requirements 5.1**

### Property 16: Manifest Optional Fields

*For any* extension manifest, it may include mcpServers, hooks, settings, and skills fields, and each field should be validated according to its schema when present.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**

### Property 17: Extension Disable Cleanup

*For any* enabled extension, disabling it should unregister all its hooks, disconnect all its MCP servers, and remove all its tools from the registry.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 18: Extension Enable Registration

*For any* disabled extension, enabling it should register its hooks, start its MCP servers, and register its tools with the registry.

**Validates: Requirements 6.4, 6.5, 6.6**

### Property 19: Extension State Persistence Round Trip

*For any* extension, enabling or disabling it and then saving and reloading configuration should restore the same enabled/disabled state.

**Validates: Requirements 6.7, 6.8**

### Property 20: MCP Server Startup

*For any* configured MCP server, starting it should spawn a process with the specified command and args, and establish a connection within the configured timeout.

**Validates: Requirements 7.1, 7.5**

### Property 21: MCP Server Failure Handling

*For any* MCP server that fails to start or connect, the MCP client should log an error and mark the server as unavailable without crashing the system.

**Validates: Requirements 7.6, 11.3**

### Property 22: MCP Tool Discovery

*For any* MCP server that successfully connects, the MCP client should request the list of available tools and register them with the tool registry.

**Validates: Requirements 7.7, 8.8**

### Property 23: MCP Server Cleanup

*For any* connected MCP server, disconnecting it should remove all its tools from the tool registry and gracefully terminate the server process.

**Validates: Requirements 7.8, 7.10**

### Property 24: Multiple MCP Servers

*For any* set of MCP servers, the MCP client should manage them simultaneously, allowing tools from different servers to coexist in the tool registry.

**Validates: Requirements 7.9**

### Property 25: MCP Schema Conversion Round Trip

*For any* MCP tool schema, converting it to internal format and then converting arguments and results back to MCP format should preserve the tool's functionality and data types.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

### Property 26: MCP Error Translation

*For any* MCP tool that returns an error, the tool wrapper should translate it to internal error format without crashing the CLI.

**Validates: Requirements 8.7, 11.4**

### Property 27: Hook Event Data Completeness

*For any* hook event, the hook input should include all event-specific data fields required for that event type (e.g., session_id for session_start, messages and model for before_model).

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**

### Property 28: Extension Settings Integration

*For any* extension that declares settings, those settings should be added to the configuration schema, readable from environment variables when specified, and available to hooks and MCP servers.

**Validates: Requirements 10.1, 10.2, 10.4, 10.6**

### Property 29: Sensitive Setting Redaction

*For any* extension setting marked as sensitive, its value should be redacted from logs and error messages.

**Validates: Requirements 10.3**

### Property 30: Extension Setting Validation

*For any* extension setting, modifying it should validate the new value against the setting definition, and missing required settings should cause the extension to be disabled.

**Validates: Requirements 10.5, 10.7**

### Property 31: System Resilience After Extension Errors

*For any* extension error (hook failure, MCP crash, invalid manifest), the system should display a clear error message identifying the extension and continue normal operation.

**Validates: Requirements 11.6, 11.7**

### Property 32: MCP Environment Variables

*For any* MCP server configured with environment variables, those variables should be set in the server process environment, with ${VAR_NAME} syntax substituted from the parent environment.

**Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.6**

### Property 33: Missing Environment Variable Handling

*For any* MCP server environment variable using substitution syntax where the variable is not found, the MCP client should log a warning and use an empty string.

**Validates: Requirements 13.4**

### Property 34: Extension Skills Registration

*For any* extension that declares skills, those skills should be registered with the skill system, discoverable via list commands, and invokable with placeholder substitution.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**

### Property 35: Hook Flow Control

*For any* hook that returns continue: false, the system should abort the current operation, and for hooks that return systemMessages, those messages should be added to conversation context in execution order.

**Validates: Requirements 15.1, 15.2, 15.4**

### Property 36: Hook Data Passing

*For any* hook that returns additional data, that data should be available to subsequent hooks in the same event processing chain.

**Validates: Requirements 15.3, 15.5**

### Property 37: MCP Tool Invocation

*For any* MCP tool selected by the agent, the tool wrapper should send the call to the appropriate server, wait for response with timeout, and format the result or error for display.

**Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

### Property 38: MCP Streaming and Structured Data

*For any* MCP tool that returns streaming responses or structured data, the tool wrapper should handle them correctly and make them available to the agent.

**Validates: Requirements 17.6, 17.7**

### Property 39: Hook Configuration Effects

*For any* hook configuration setting (enabled, timeout, trustWorkspace), changing it should affect hook execution behavior accordingly (e.g., hooks.enabled=false skips all hooks).

**Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7**

### Property 40: MCP Configuration Effects

*For any* MCP configuration setting (enabled, connectionTimeout, servers), changing it should affect MCP client behavior accordingly (e.g., mcp.enabled=false prevents server startup).

**Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7**

### Property 41: Extension Configuration Effects

*For any* extension configuration setting (enabled, directories, autoEnable), changing it should affect extension manager behavior accordingly (e.g., extensions.enabled=false prevents loading).

**Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7**

## Error Handling

### Hook Execution Errors

**Timeout Handling**:
- Default timeout: 30 seconds (configurable)
- On timeout: Terminate hook process, log warning, continue with next hook
- Timeout applies per-hook, not to entire event

**Exception Handling**:
- Catch all exceptions during hook execution
- Log error with hook name and extension source
- Continue executing remaining hooks
- Never propagate exceptions to core system

**Malformed Output**:
- If hook output is not valid JSON: Log error, treat as failed hook
- If hook output missing required fields: Log error, assume continue=true
- If hook output has unexpected structure: Log warning, extract what's possible

### Extension Loading Errors

**Invalid Manifest**:
- Log error with specific validation failures
- Skip extension entirely
- Continue loading other extensions
- Display warning in extension list

**Missing Dependencies**:
- If MCP server command not found: Mark server as unavailable
- If hook script not found: Skip hook, log error
- If required setting missing: Disable extension, log error

**Circular Dependencies**:
- Detect circular dependencies between extensions
- Log error and disable affected extensions
- Prevent infinite loops during loading

### MCP Server Errors

**Connection Failures**:
- Retry connection with exponential backoff (3 attempts)
- After max retries: Mark server as unavailable
- Log detailed error including command and stderr
- Allow manual restart via command

**Runtime Crashes**:
- Detect server process termination
- Remove tools from registry
- Mark server as crashed
- Optionally auto-restart based on configuration

**Tool Call Failures**:
- Timeout: Return error to agent with timeout message
- Server error: Translate MCP error to internal format
- Network error: Return connection error to agent
- Never crash CLI on tool failure

### Configuration Errors

**Invalid Values**:
- Validate all configuration on startup
- Log specific validation errors
- Use default values for invalid settings
- Prevent CLI startup if critical settings invalid

**Type Mismatches**:
- Coerce types when possible (string to number, etc.)
- Log warning for type coercion
- Reject if coercion not possible

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests:

**Unit Tests** focus on:
- Specific examples of hook execution
- Edge cases (empty manifests, missing files)
- Error conditions (timeouts, crashes, invalid JSON)
- Integration between components
- UI interactions (approval prompts)

**Property-Based Tests** focus on:
- Universal properties across all inputs
- Round-trip properties (serialization, state persistence)
- Invariants (hook order, error isolation)
- Comprehensive input coverage through randomization

Both testing approaches are complementary and necessary for comprehensive coverage.

### Property-Based Testing Configuration

**Framework**: fast-check (TypeScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: stage-05-hooks-extensions-mcp, Property N: [property text]`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: stage-05-hooks-extensions-mcp, Property 1: Hook Registration and Retrieval
test('hook registration and retrieval', () => {
  fc.assert(
    fc.property(
      fc.string(), // hook name
      fc.constantFrom(...hookEvents), // event type
      (hookName, event) => {
        const registry = new HookRegistry();
        const hook = createHook(hookName, event);
        
        registry.registerHook(event, hook);
        const retrieved = registry.getHooksForEvent(event);
        
        expect(retrieved).toContainEqual(hook);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Hook System**:
- Hook registration and retrieval
- Hook execution with various outputs
- Timeout handling with slow hooks
- Error isolation with failing hooks
- Trust model approval flow
- Hash computation and verification

**Extension System**:
- Extension discovery from directories
- Manifest parsing and validation
- Extension enable/disable
- Settings integration
- Skills registration

**MCP Integration**:
- Server startup and connection
- Tool discovery and registration
- Tool invocation and response handling
- Error translation
- Multiple server management

### Integration Tests

**End-to-End Scenarios**:
1. Load extension → Register hooks → Execute hook on event
2. Load extension → Start MCP server → Invoke MCP tool
3. Approve workspace hook → Execute hook → Verify trust persisted
4. Enable extension → Disable extension → Verify cleanup
5. Multiple extensions with same event → Verify execution order

**Error Scenarios**:
1. Invalid manifest → Verify extension skipped
2. Hook timeout → Verify other hooks execute
3. MCP server crash → Verify tools removed
4. Missing required setting → Verify extension disabled

### Test Helpers

**Mock Implementations**:
- MockHook: Configurable hook for testing
- MockMCPServer: In-process MCP server for testing
- MockExtension: Extension with configurable manifest

**Generators** (for property-based tests):
- Arbitrary hooks with random names and events
- Arbitrary manifests with valid/invalid structures
- Arbitrary MCP tool schemas
- Arbitrary hook inputs and outputs

### Testing Priorities

**Critical Path** (must have 100% coverage):
1. Hook execution and error isolation
2. Trust model and approval
3. Extension loading and validation
4. MCP server connection and tool registration

**Important** (should have high coverage):
1. Configuration validation
2. Settings integration
3. Skills system
4. Error handling and recovery

**Nice to Have** (can have lower coverage):
1. Extension directory structure conventions
2. UI formatting and display
3. Performance optimizations

## Implementation Notes

### Performance Considerations

**Hook Execution**:
- Execute hooks sequentially to maintain order
- Consider parallel execution for independent hooks (future enhancement)
- Use process pools to avoid spawn overhead
- Cache hook script hashes to avoid recomputation

**Extension Loading**:
- Load extensions in parallel during startup
- Cache parsed manifests
- Lazy-load MCP servers (start on first use)
- Index extensions for fast lookup

**MCP Communication**:
- Use connection pooling for HTTP transport
- Implement request batching for multiple tool calls
- Stream large responses to avoid memory issues
- Timeout aggressively to prevent hangs

### Security Considerations

**Hook Trust**:
- Never auto-trust workspace hooks by default
- Require re-approval on hash change
- Store hashes using SHA-256
- Validate hook output before processing

**Extension Sandboxing**:
- Run hooks in separate processes
- Limit hook execution time
- Sanitize hook input/output
- Redact sensitive data from logs

**MCP Security**:
- Validate MCP server commands
- Sanitize environment variables
- Limit MCP server resource usage
- Validate tool schemas before registration

### Backward Compatibility

**Configuration Migration**:
- Support old configuration formats
- Migrate automatically on first load
- Log migration actions
- Preserve user customizations

**Extension Versioning**:
- Support manifest version field
- Handle version mismatches gracefully
- Provide upgrade path for extensions
- Deprecate old features gradually

## Dependencies

**External Libraries**:
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `fast-check`: Property-based testing
- `ajv`: JSON schema validation
- `js-yaml`: YAML configuration parsing

**Internal Dependencies**:
- Tool Registry (from Stage 03)
- Configuration System (from Stage 04)
- Service Infrastructure (from Stage 04)

## File Structure

```
packages/core/src/
├── hooks/
│   ├── hookRegistry.ts
│   ├── hookPlanner.ts
│   ├── hookRunner.ts
│   ├── hookTranslator.ts
│   ├── trustedHooks.ts
│   ├── index.ts
│   └── __tests__/
│       ├── hookRegistry.test.ts
│       ├── hookPlanner.test.ts
│       ├── hookRunner.test.ts
│       ├── hookTranslator.test.ts
│       ├── trustedHooks.test.ts
│       └── integration.test.ts
├── extensions/
│   ├── extensionManager.ts
│   ├── manifestParser.ts
│   ├── index.ts
│   └── __tests__/
│       ├── extensionManager.test.ts
│       ├── manifestParser.test.ts
│       └── integration.test.ts
├── mcp/
│   ├── mcpClient.ts
│   ├── mcpTransport.ts
│   ├── mcpSchemaConverter.ts
│   ├── index.ts
│   └── __tests__/
│       ├── mcpClient.test.ts
│       ├── mcpTransport.test.ts
│       ├── mcpSchemaConverter.test.ts
│       └── integration.test.ts
└── tools/
    ├── mcp-tool.ts
    └── __tests__/
        └── mcp-tool.test.ts
```

## Migration Path

### From No Extensions to Extensions

1. **Phase 1**: Implement hook system core
   - Hook registry and runner
   - Basic hook protocol
   - No trust model yet

2. **Phase 2**: Add trust model
   - Implement approval flow
   - Add hash verification
   - Migrate any existing hooks

3. **Phase 3**: Implement extension system
   - Extension manager and manifest parser
   - Extension loading and discovery
   - Settings integration

4. **Phase 4**: Add MCP integration
   - MCP client and transports
   - Schema conversion
   - Tool wrappers

5. **Phase 5**: Polish and optimize
   - Performance improvements
   - Error handling refinement
   - Documentation and examples

### Rollout Strategy

**Alpha** (internal testing):
- Basic hook system
- Simple extensions
- Limited MCP support

**Beta** (early adopters):
- Full hook system with trust model
- Extension marketplace
- Multiple MCP transports

**GA** (general availability):
- Stable APIs
- Comprehensive documentation
- Example extensions
- Performance optimized
