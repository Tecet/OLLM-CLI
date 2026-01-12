# Implementation Plan: Hooks, Extensions, and MCP Integration

## Overview

This implementation plan breaks down the hooks, extensions, and MCP integration feature into discrete coding tasks. The approach follows a bottom-up strategy: build core components first (hook system), then layer on extensions, and finally integrate MCP. Each major component includes property-based tests to validate correctness properties from the design.

## Tasks

- [ ] 1. Implement Hook Registry
  - Create `packages/core/src/hooks/hookRegistry.ts`
  - Implement `HookRegistry` class with methods: `register()`, `unregister()`, `getHooksForEvent()`, `clear()`
  - Maintain internal `Map<HookEvent, Hook[]>` for event-to-hooks mapping
  - Support multiple hooks per event with registration order preservation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 1.1 Write property tests for Hook Registry
  - **Property 1: Hook Registration Preserves Data**
  - **Property 2: Hook Registration Order Preserved**
  - **Property 3: Hook Unregistration Removes Hook**
  - **Validates: Requirements 2.2, 2.3, 2.5**

- [ ] 2. Implement Hook Runner
  - Create `packages/core/src/hooks/hookRunner.ts`
  - Implement `HookRunner` class with methods: `executeHook()`, `executeHooks()`
  - Spawn child processes for hook execution
  - Pass event data via stdin as JSON
  - Parse hook output from stdout as JSON
  - Implement timeout enforcement with process termination
  - Implement error isolation (one hook failure doesn't stop others)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 2.1 Write property tests for Hook Runner
  - **Property 4: Hook Input Serialization Round-Trip**
  - **Property 5: Hook Timeout Enforcement**
  - **Property 6: Hook Error Isolation**
  - **Property 7: Hook Cancellation Signal**
  - **Property 11: Malformed Hook Output Handling**
  - **Validates: Requirements 3.1, 3.3, 3.4, 3.7, 13.5**

- [ ] 2.2 Write unit tests for Hook Runner
  - Test specific timeout values (30s default)
  - Test hook process spawning with various commands
  - Test stderr capture and logging
  - Test process cleanup after execution
  - _Requirements: 3.6_

- [ ] 3. Implement Trusted Hooks System
  - Create `packages/core/src/hooks/trustedHooks.ts`
  - Implement `TrustedHooks` class with methods: `load()`, `save()`, `isApproved()`, `approve()`, `needsApproval()`, `computeHash()`
  - Use SHA-256 for hook content hashing
  - Store approvals in `~/.ollm/trusted-hooks.json`
  - Implement trust logic: builtin/user auto-trusted, workspace requires approval
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 3.1 Write property tests for Trusted Hooks
  - **Property 8: Hook Trust by Source**
  - **Property 9: Hook Hash Verification**
  - **Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.7**

- [ ] 3.2 Write unit tests for Trusted Hooks
  - Test trusted-hooks.json file creation and parsing
  - Test approval prompt flow (mock user interaction)
  - Test hash computation for various file types
  - _Requirements: 4.3, 4.6_

- [ ] 4. Implement Hook Data Flow
  - Extend `HookRunner` to handle hook output data
  - Implement `systemMessage` injection into conversation context
  - Implement `continue: false` cancellation signaling
  - Implement data propagation between hooks in event chain
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 4.1 Write property tests for Hook Data Flow
  - **Property 10: Hook Output Data Propagation**
  - **Property 12: Per-Hook Timeout Override**
  - **Validates: Requirements 13.3, 13.4, 14.5**

- [ ] 5. Integrate Hook System with Chat Client
  - Add hook event emission to `packages/core/src/core/chatClient.ts`
  - Emit events: `session_start`, `session_end`, `before_agent`, `after_agent`, `before_model`, `after_model`, `before_tool_selection`, `before_tool`, `after_tool`
  - Pass appropriate data with each event
  - Handle hook results (systemMessage, continue flag)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 5.1 Write unit tests for Hook Event Emission
  - Test each event type is emitted at correct lifecycle point
  - Test event data contains expected fields
  - Test systemMessage injection
  - Test operation cancellation on continue: false
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 13.1, 13.2_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Manifest Parser
  - Create `packages/core/src/extensions/manifestParser.ts`
  - Implement `ManifestParser` class with methods: `parse()`, `validate()`
  - Use Zod for schema validation
  - Validate required fields: name, version, description
  - Validate optional fields: mcpServers, hooks, settings, skills
  - Validate nested structures (server configs, hook definitions, etc.)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.1 Write property tests for Manifest Parser
  - **Property 13: Extension Manifest Parsing**
  - **Property 14: Invalid Manifest Rejection**
  - **Property 17: Manifest Field Validation**
  - **Validates: Requirements 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [ ] 8. Implement Extension Manager
  - Create `packages/core/src/extensions/extensionManager.ts`
  - Implement `ExtensionManager` class with methods: `loadExtensions()`, `getExtension()`, `enableExtension()`, `disableExtension()`, `listExtensions()`
  - Scan directories: `~/.ollm/extensions/` and `.ollm/extensions/`
  - Parse manifests using `ManifestParser`
  - Maintain enabled/disabled state
  - Register hooks from enabled extensions
  - Register MCP servers from enabled extensions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8.1 Write property tests for Extension Manager
  - **Property 15: Extension Hook Registration**
  - **Property 16: Extension MCP Server Registration**
  - **Property 18: Extension Enable/Disable State**
  - **Property 19: Extension State Persistence**
  - **Validates: Requirements 5.6, 5.7, 7.2, 7.3, 7.4**

- [ ] 8.2 Write unit tests for Extension Manager
  - Test directory scanning (mock file system)
  - Test user directory loaded before workspace directory
  - Test autoEnable configuration
  - Test extension discovery with missing directories
  - _Requirements: 5.1, 5.2, 5.5, 7.5_

- [ ] 9. Implement Extension Settings Integration
  - Extend `ExtensionManager` to handle settings
  - Merge extension settings with core configuration
  - Read settings from environment variables when `envVar` specified
  - Redact sensitive settings in logs
  - Validate settings against definitions
  - Disable extensions with missing required settings
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 9.1 Write property tests for Extension Settings
  - **Property 20: Extension Settings Merge**
  - **Property 21: Environment Variable Settings**
  - **Property 22: Sensitive Setting Redaction**
  - **Property 23: Extension Settings Validation**
  - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

- [ ] 10. Implement Skills Registration
  - Extend `ExtensionManager` to handle skills
  - Register skills from extension manifests
  - Support skill invocation with prompt injection
  - Handle skill namespace collisions
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 10.1 Write property tests for Skills
  - **Property 24: Skill Registration**
  - **Property 25: Skill Invocation**
  - **Property 26: Skill Namespace Collision**
  - **Validates: Requirements 15.1, 15.2, 15.3, 15.5**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement MCP Transport Layer
  - Create `packages/core/src/mcp/mcpTransport.ts`
  - Implement abstract `MCPTransport` class with methods: `send()`, `receive()`, `close()`
  - Implement `StdioTransport` for stdio communication
  - Implement `SSETransport` for Server-Sent Events
  - Implement `HTTPTransport` for HTTP requests
  - Handle JSON-RPC message serialization/deserialization
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12.1 Write unit tests for MCP Transport
  - Test stdio transport with mock process
  - Test SSE transport with mock server
  - Test HTTP transport with mock server
  - Test JSON-RPC message formatting
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13. Implement MCP Client
  - Create `packages/core/src/mcp/mcpClient.ts`
  - Implement `MCPClient` class with methods: `connect()`, `disconnect()`, `listTools()`, `executeTool()`, `getConnection()`, `listConnections()`
  - Spawn MCP server processes with specified command and args
  - Manage multiple concurrent connections
  - Implement connection timeout (10s default)
  - Handle server disconnections and cleanup
  - _Requirements: 8.4, 8.5, 8.6, 8.7, 11.1, 11.4_

- [ ] 13.1 Write property tests for MCP Client
  - **Property 27: MCP Server Process Spawning**
  - **Property 28: MCP Server Failure Handling**
  - **Property 29: MCP Server Disconnection Cleanup**
  - **Property 35: Multiple MCP Server Connections**
  - **Property 38: MCP Server Failure Isolation**
  - **Validates: Requirements 8.4, 8.5, 8.7, 11.1, 11.4**

- [ ] 13.2 Write unit tests for MCP Client
  - Test connection timeout with slow server
  - Test server process spawn failures
  - Test multiple server coordination
  - _Requirements: 8.6_

- [ ] 14. Implement MCP Schema Converter
  - Create `packages/core/src/mcp/mcpSchemaConverter.ts`
  - Implement `MCPSchemaConverter` class with methods: `convertTool()`, `convertParameter()`
  - Map MCP parameter types to internal types
  - Preserve required/optional parameter information
  - Include MCP server name in tool metadata
  - Handle invalid schemas gracefully
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 14.1 Write property tests for MCP Schema Converter
  - **Property 30: MCP Tool Schema Conversion**
  - **Property 31: MCP Tool Server Metadata**
  - **Property 32: Invalid MCP Tool Schema Handling**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 15. Implement MCP Tool Wrapper
  - Create `packages/core/src/tools/mcp-tool.ts`
  - Implement `MCPToolWrapper` class with method: `execute()`
  - Translate tool calls to MCP format
  - Send calls to appropriate MCP server via `MCPClient`
  - Translate MCP results to internal format
  - Handle MCP errors and translate to user-friendly messages
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 15.1 Write property tests for MCP Tool Wrapper
  - **Property 33: MCP Tool Call Translation Round-Trip**
  - **Property 34: MCP Tool Error Translation**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [ ] 16. Implement MCP Tool Registration
  - Extend `MCPClient` to register tools with `ToolRegistry`
  - Handle tool namespace collisions (server-name:tool-name)
  - Route tool calls to correct server based on metadata
  - Remove tools when server disconnects
  - _Requirements: 11.2, 11.3_

- [ ] 16.1 Write property tests for MCP Tool Registration
  - **Property 36: MCP Tool Namespace Collision**
  - **Property 37: MCP Tool Routing**
  - **Validates: Requirements 11.2, 11.3**

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement Configuration Support
  - Add configuration schema for hooks, extensions, and MCP
  - Support `hooks.enabled`, `hooks.timeout`, `hooks.trustWorkspace`
  - Support `extensions.enabled`, `extensions.directories`, `extensions.autoEnable`
  - Support `mcp.enabled`, `mcp.connectionTimeout`, `mcp.servers`
  - _Requirements: 14.1, 14.2_

- [ ] 18.1 Write unit tests for Configuration
  - Test default values (30s hook timeout, 10s MCP timeout)
  - Test configuration loading and merging
  - Test per-hook timeout overrides
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 19. Integration and Wiring
  - Wire `ExtensionManager` into application startup
  - Wire `MCPClient` into tool system
  - Wire hook system into chat client lifecycle
  - Ensure proper initialization order: config → extensions → hooks → MCP
  - Add status display for connected MCP servers
  - _Requirements: All_

- [ ] 19.1 Write integration tests
  - Test full hook lifecycle: register → execute → cleanup
  - Test full extension lifecycle: discover → load → enable → use
  - Test full MCP lifecycle: connect → list tools → execute → disconnect
  - Test interaction between hooks and MCP tools
  - Test extension hooks triggering on MCP tool execution

- [ ] 20. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows a bottom-up approach: hooks → extensions → MCP
- Hook system is independent and can be tested in isolation
- Extension system depends on hooks but not MCP
- MCP system depends on tool registry but not hooks or extensions
