# Implementation Plan: Hooks, Extensions, and MCP Integration

## Overview

This implementation plan breaks down the hooks, extensions, and MCP integration system into discrete, incremental tasks. The approach follows a bottom-up strategy: build core hook system first, add trust model, implement extension system, integrate MCP, and finally add advanced features. Each task builds on previous work and includes testing to validate functionality early.

## Tasks

- [ ] 1. Set up hook system foundation
  - Create directory structure for hooks module
  - Define core interfaces and types (Hook, HookEvent, HookInput, HookOutput)
  - Set up testing infrastructure with fast-check for property-based tests
  - _Requirements: 1.1, 1.2, 1.7_

- [ ] 2. Implement HookRegistry
  - [ ] 2.1 Implement hook registration and storage
    - Write HookRegistry class with registerHook, getHooksForEvent, unregisterHook methods
    - Use Map<HookEvent, Hook[]> to maintain insertion order
    - _Requirements: 1.1, 12.2_

  - [ ] 2.2 Write property test for hook registration and retrieval
    - **Property 1: Hook Registration and Retrieval**
    - **Validates: Requirements 1.1, 1.2**

  - [ ] 2.3 Write unit tests for HookRegistry
    - Test registration of multiple hooks for same event
    - Test unregistration
    - Test getAllHooks and clearEvent methods
    - _Requirements: 1.1, 1.2_

- [ ] 3. Implement HookTranslator
  - [ ] 3.1 Implement data conversion methods
    - Write toHookInput to convert system data to JSON format
    - Write parseHookOutput to parse JSON responses
    - Write validateOutput to check output structure
    - _Requirements: 1.8, 1.9, 2.1, 2.2, 2.3_

  - [ ] 3.2 Write property test for hook protocol round trip
    - **Property 6: Hook Protocol Round Trip**
    - **Validates: Requirements 1.8, 1.9, 2.1, 2.2**

  - [ ] 3.3 Write unit tests for HookTranslator
    - Test conversion of each event type with specific data
    - Test parsing of valid and invalid JSON
    - Test validation of output structure
    - _Requirements: 1.8, 1.9, 2.4, 2.5, 2.6_

- [ ] 4. Implement HookRunner
  - [ ] 4.1 Implement basic hook execution
    - Write executeHook to spawn process and communicate via stdin/stdout
    - Write executeHooks to run multiple hooks in sequence
    - Implement timeout mechanism using AbortController or process.kill
    - _Requirements: 1.3, 1.6, 2.1, 2.3_

  - [ ] 4.2 Implement error handling and isolation
    - Catch and log exceptions during hook execution
    - Handle process crashes gracefully
    - Continue with remaining hooks after failures
    - _Requirements: 1.5, 11.1_

  - [ ] 4.3 Write property test for hook execution order
    - **Property 2: Hook Execution Order**
    - **Validates: Requirements 1.3, 12.1, 12.2, 12.3, 12.4, 12.5**

  - [ ] 4.4 Write property test for hook timeout termination
    - **Property 3: Hook Timeout Termination**
    - **Validates: Requirements 1.4, 11.2**

  - [ ] 4.5 Write property test for hook error isolation
    - **Property 4: Hook Error Isolation**
    - **Validates: Requirements 1.5, 11.1**

  - [ ] 4.6 Write property test for hook output capture
    - **Property 5: Hook Output Capture**
    - **Validates: Requirements 1.6, 2.3**

  - [ ] 4.7 Write unit tests for HookRunner
    - Test execution with various hook outputs
    - Test timeout with slow hooks
    - Test error handling with failing hooks
    - Test malformed JSON handling
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.7_

- [ ] 5. Implement HookPlanner
  - [ ] 5.1 Implement hook planning logic
    - Write planExecution to identify hooks for events
    - Implement ordering logic (user before workspace)
    - Create HookExecutionPlan structure
    - _Requirements: 1.2, 12.4_

  - [ ] 5.2 Write unit tests for HookPlanner
    - Test planning with hooks from different sources
    - Test ordering of user vs workspace hooks
    - Test planning with no hooks registered
    - _Requirements: 1.2, 12.4_

- [ ] 6. Checkpoint - Basic hook system working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement TrustedHooks
  - [ ] 7.1 Implement trust verification
    - Write isTrusted to check hook trust status
    - Write computeHash using crypto.createHash('sha256')
    - Implement trust rules based on hook source
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 7.2 Implement approval storage
    - Write load and save methods for trusted-hooks.json
    - Write storeApproval to persist approvals
    - Implement hash verification for approved hooks
    - _Requirements: 3.6, 3.7, 3.9_

  - [ ] 7.3 Implement approval prompting (stub for now)
    - Write requestApproval method (returns Promise<boolean>)
    - Add TODO for UI integration
    - _Requirements: 3.5_

  - [ ] 7.4 Write property test for hook trust rules
    - **Property 9: Hook Trust Rules**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ] 7.5 Write property test for hook approval persistence
    - **Property 10: Hook Approval Persistence**
    - **Validates: Requirements 3.6, 3.7, 3.9**

  - [ ] 7.6 Write property test for hook hash change detection
    - **Property 11: Hook Hash Change Detection**
    - **Validates: Requirements 3.8**

  - [ ] 7.7 Write unit tests for TrustedHooks
    - Test trust rules for each source type
    - Test approval storage and retrieval
    - Test hash computation and verification
    - Test hash change detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9_

- [ ] 8. Integrate trust model with hook execution
  - [ ] 8.1 Update HookRunner to check trust before execution
    - Call TrustedHooks.isTrusted before executing hooks
    - Request approval for untrusted hooks
    - Skip hooks that are not approved
    - _Requirements: 3.5_

  - [ ] 8.2 Write integration tests for trust + execution
    - Test execution of trusted hooks
    - Test blocking of untrusted hooks
    - Test approval flow
    - _Requirements: 3.5_

- [ ] 9. Set up extension system foundation
  - Create directory structure for extensions module
  - Define extension interfaces (Extension, ExtensionManifest, ExtensionSetting, Skill)
  - _Requirements: 4.9, 5.1_

- [ ] 10. Implement ManifestParser
  - [ ] 10.1 Implement manifest parsing and validation
    - Write parseManifest to read and parse manifest.json
    - Write validateManifest using JSON schema validation
    - Implement schema for manifest structure
    - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 10.2 Write property test for manifest required fields
    - **Property 15: Manifest Required Fields**
    - **Validates: Requirements 5.1**

  - [ ] 10.3 Write property test for manifest optional fields
    - **Property 16: Manifest Optional Fields**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**

  - [ ] 10.4 Write unit tests for ManifestParser
    - Test parsing of valid manifests
    - Test validation of invalid manifests
    - Test error messages for validation failures
    - _Requirements: 4.4, 5.1, 5.9_

- [ ] 11. Implement ExtensionManager
  - [ ] 11.1 Implement extension discovery
    - Write loadExtensions to scan directories
    - Implement directory scanning for user and workspace paths
    - Use ManifestParser to parse manifests
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 11.2 Implement extension registration
    - Register hooks with HookRegistry
    - Store MCP server configs (MCP client not yet implemented)
    - Merge settings with configuration
    - Track extension enabled/disabled state
    - _Requirements: 4.6, 4.8, 4.9_

  - [ ] 11.3 Implement enable/disable functionality
    - Write enableExtension and disableExtension methods
    - Implement cleanup on disable (unregister hooks)
    - Implement registration on enable
    - Persist state to configuration
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ] 11.4 Write property test for extension discovery
    - **Property 12: Extension Discovery**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ] 11.5 Write property test for invalid extension handling
    - **Property 13: Invalid Extension Handling**
    - **Validates: Requirements 4.5, 11.5**

  - [ ] 11.6 Write property test for extension registration
    - **Property 14: Extension Registration**
    - **Validates: Requirements 4.6, 4.7, 4.8, 4.9**

  - [ ] 11.7 Write property test for extension disable cleanup
    - **Property 17: Extension Disable Cleanup**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ] 11.8 Write property test for extension enable registration
    - **Property 18: Extension Enable Registration**
    - **Validates: Requirements 6.4, 6.5, 6.6**

  - [ ] 11.9 Write property test for extension state persistence
    - **Property 19: Extension State Persistence Round Trip**
    - **Validates: Requirements 6.7, 6.8**

  - [ ] 11.10 Write unit tests for ExtensionManager
    - Test loading from multiple directories
    - Test enable/disable functionality
    - Test state persistence
    - Test error handling for invalid extensions
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 12. Implement extension settings integration
  - [ ] 12.1 Implement settings merging
    - Add extension settings to configuration schema
    - Read settings from environment variables
    - Provide settings to hooks via environment
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ] 12.2 Implement sensitive setting handling
    - Redact sensitive settings from logs
    - Mark sensitive fields in configuration
    - _Requirements: 10.3_

  - [ ] 12.3 Write property test for extension settings integration
    - **Property 28: Extension Settings Integration**
    - **Validates: Requirements 10.1, 10.2, 10.4, 10.6**

  - [ ] 12.4 Write property test for sensitive setting redaction
    - **Property 29: Sensitive Setting Redaction**
    - **Validates: Requirements 10.3**

  - [ ] 12.5 Write property test for extension setting validation
    - **Property 30: Extension Setting Validation**
    - **Validates: Requirements 10.5, 10.7**

  - [ ] 12.6 Write unit tests for settings integration
    - Test settings merging
    - Test environment variable reading
    - Test sensitive setting redaction
    - Test validation of setting values
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 13. Checkpoint - Extension system working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Set up MCP integration foundation
  - Create directory structure for mcp module
  - Define MCP interfaces (MCPClient, MCPTransport, MCPServerConfig, MCPTool)
  - _Requirements: 7.1, 7.9_

- [ ] 15. Implement MCPTransport
  - [ ] 15.1 Implement stdio transport
    - Write StdioTransport class
    - Implement connect, disconnect, sendRequest methods
    - Handle process spawning and communication
    - _Requirements: 7.2_

  - [ ] 15.2 Write unit tests for MCPTransport
    - Test connection establishment
    - Test request/response handling
    - Test disconnection
    - Test error handling
    - _Requirements: 7.2_

- [ ] 16. Implement MCPClient
  - [ ] 16.1 Implement server lifecycle management
    - Write startServer to spawn MCP server processes
    - Write stopServer to gracefully disconnect
    - Implement connection timeout handling
    - Track server status (starting, connected, disconnected, error)
    - _Requirements: 7.1, 7.5, 7.6, 7.10_

  - [ ] 16.2 Implement tool discovery
    - Write getTools to request tool list from server
    - Store tools per server
    - _Requirements: 7.7_

  - [ ] 16.3 Implement tool invocation
    - Write callTool to send tool requests to servers
    - Handle tool responses and errors
    - Implement timeout for tool calls
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 16.4 Implement multi-server management
    - Track multiple servers simultaneously
    - Route tool calls to correct server
    - Handle server disconnections
    - _Requirements: 7.8, 7.9_

  - [ ] 16.5 Write property test for MCP server startup
    - **Property 20: MCP Server Startup**
    - **Validates: Requirements 7.1, 7.5**

  - [ ] 16.6 Write property test for MCP server failure handling
    - **Property 21: MCP Server Failure Handling**
    - **Validates: Requirements 7.6, 11.3**

  - [ ] 16.7 Write property test for MCP tool discovery
    - **Property 22: MCP Tool Discovery**
    - **Validates: Requirements 7.7, 8.8**

  - [ ] 16.8 Write property test for MCP server cleanup
    - **Property 23: MCP Server Cleanup**
    - **Validates: Requirements 7.8, 7.10**

  - [ ] 16.9 Write property test for multiple MCP servers
    - **Property 24: Multiple MCP Servers**
    - **Validates: Requirements 7.9**

  - [ ] 16.10 Write unit tests for MCPClient
    - Test server startup and connection
    - Test tool discovery
    - Test tool invocation
    - Test error handling
    - Test multi-server management
    - _Requirements: 7.1, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

- [ ] 17. Implement MCPSchemaConverter
  - [ ] 17.1 Implement schema conversion
    - Write convertToolSchema to map MCP schemas to internal format
    - Write convertArgsToMCP to convert arguments
    - Write convertResultFromMCP to convert results
    - Handle type mapping (string, number, boolean, object, array)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 17.2 Write property test for MCP schema conversion round trip
    - **Property 25: MCP Schema Conversion Round Trip**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

  - [ ] 17.3 Write unit tests for MCPSchemaConverter
    - Test conversion of various schema types
    - Test argument conversion
    - Test result conversion
    - Test preservation of descriptions and constraints
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 18. Implement MCPToolWrapper
  - [ ] 18.1 Implement tool wrapping
    - Write wrapTool to create internal Tool from MCP tool
    - Write executeTool to invoke MCP tools via MCPClient
    - Handle errors and translate to internal format
    - Format results for display
    - _Requirements: 8.7, 17.1, 17.4, 17.5_

  - [ ] 18.2 Write property test for MCP error translation
    - **Property 26: MCP Error Translation**
    - **Validates: Requirements 8.7, 11.4**

  - [ ] 18.3 Write property test for MCP tool invocation
    - **Property 37: MCP Tool Invocation**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

  - [ ] 18.4 Write unit tests for MCPToolWrapper
    - Test tool wrapping
    - Test tool execution
    - Test error handling
    - Test result formatting
    - _Requirements: 8.7, 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 19. Integrate MCP with ExtensionManager
  - [ ] 19.1 Update ExtensionManager to start MCP servers
    - Call MCPClient.startServer when loading extensions
    - Register MCP tools with Tool Registry
    - Handle MCP server failures during loading
    - _Requirements: 4.7, 7.1_

  - [ ] 19.2 Update enable/disable to manage MCP servers
    - Start MCP servers on enable
    - Stop MCP servers on disable
    - Remove MCP tools on disable
    - _Requirements: 6.2, 6.5_

  - [ ] 19.3 Write integration tests for MCP + extensions
    - Test loading extension with MCP server
    - Test enable/disable with MCP servers
    - Test tool registration from MCP
    - _Requirements: 4.7, 6.2, 6.5, 7.1_

- [ ] 20. Implement MCP environment variable handling
  - [ ] 20.1 Implement variable substitution
    - Parse ${VAR_NAME} syntax in env config
    - Replace with values from parent environment
    - Handle missing variables with warning
    - Pass extension settings as env vars
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 20.2 Write property test for MCP environment variables
    - **Property 32: MCP Environment Variables**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.6**

  - [ ] 20.3 Write property test for missing environment variable handling
    - **Property 33: Missing Environment Variable Handling**
    - **Validates: Requirements 13.4**

  - [ ] 20.4 Write unit tests for environment variable handling
    - Test variable substitution
    - Test missing variable handling
    - Test environment inheritance
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [ ] 21. Checkpoint - MCP integration working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Implement hook event data passing
  - [ ] 22.1 Update HookTranslator with event-specific data
    - Implement data formatting for each event type
    - Include session_id, messages, model, etc. as appropriate
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [ ] 22.2 Write property test for hook event data completeness
    - **Property 27: Hook Event Data Completeness**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**

  - [ ] 22.3 Write unit tests for event data passing
    - Test data for each event type
    - Test data completeness
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [ ] 23. Implement hook output processing
  - [ ] 23.1 Implement flow control from hook output
    - Handle continue: false to abort operations
    - Add systemMessages to conversation context
    - Pass data between hooks
    - Concatenate multiple systemMessages
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 23.2 Write property test for hook flow control
    - **Property 35: Hook Flow Control**
    - **Validates: Requirements 15.1, 15.2, 15.4**

  - [ ] 23.3 Write property test for hook data passing
    - **Property 36: Hook Data Passing**
    - **Validates: Requirements 15.3, 15.5**

  - [ ] 23.4 Write unit tests for hook output processing
    - Test continue: false behavior
    - Test systemMessage handling
    - Test data passing between hooks
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 24. Implement extension skills system
  - [ ] 24.1 Implement skill registration and invocation
    - Register skills from extension manifests
    - Implement skill discovery (list command)
    - Implement placeholder substitution in prompts
    - Pass rendered prompts to agent
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ] 24.2 Write property test for extension skills registration
    - **Property 34: Extension Skills Registration**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**

  - [ ] 24.3 Write unit tests for skills system
    - Test skill registration
    - Test skill discovery
    - Test placeholder substitution
    - Test skill invocation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 25. Implement configuration system integration
  - [ ] 25.1 Add hook configuration
    - Add hooks.enabled, hooks.timeout, hooks.trustWorkspace settings
    - Implement configuration effects (skip hooks when disabled)
    - Validate configuration values
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [ ] 25.2 Add MCP configuration
    - Add mcp.enabled, mcp.connectionTimeout, mcp.servers settings
    - Implement configuration effects (skip MCP when disabled)
    - Validate configuration values
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ] 25.3 Add extension configuration
    - Add extensions.enabled, extensions.directories, extensions.autoEnable settings
    - Implement configuration effects (skip extensions when disabled)
    - Validate configuration values
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [ ] 25.4 Write property test for hook configuration effects
    - **Property 39: Hook Configuration Effects**
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7**

  - [ ] 25.5 Write property test for MCP configuration effects
    - **Property 40: MCP Configuration Effects**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7**

  - [ ] 25.6 Write property test for extension configuration effects
    - **Property 41: Extension Configuration Effects**
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7**

  - [ ] 25.7 Write unit tests for configuration integration
    - Test all configuration settings
    - Test configuration validation
    - Test configuration effects
    - _Requirements: 18.1-18.7, 19.1-19.7, 20.1-20.7_

- [ ] 26. Implement MCP streaming and structured data support
  - [ ] 26.1 Add streaming response handling
    - Handle streaming responses from MCP servers
    - Support structured data types
    - _Requirements: 17.6, 17.7_

  - [ ] 26.2 Write property test for MCP streaming and structured data
    - **Property 38: MCP Streaming and Structured Data**
    - **Validates: Requirements 17.6, 17.7**

  - [ ] 26.3 Write unit tests for streaming support
    - Test streaming responses
    - Test structured data handling
    - _Requirements: 17.6, 17.7_

- [ ] 27. Implement system resilience and error messaging
  - [ ] 27.1 Improve error messages
    - Add extension name to all error messages
    - Format errors clearly for users
    - _Requirements: 11.6_

  - [ ] 27.2 Verify system resilience
    - Ensure system continues after extension errors
    - Test various error scenarios
    - _Requirements: 11.7_

  - [ ] 27.3 Write property test for system resilience
    - **Property 31: System Resilience After Extension Errors**
    - **Validates: Requirements 11.6, 11.7**

  - [ ] 27.4 Write integration tests for error scenarios
    - Test hook failures
    - Test MCP crashes
    - Test invalid manifests
    - Verify system continues in all cases
    - _Requirements: 11.6, 11.7_

- [ ] 28. Add additional MCP transports (SSE and HTTP)
  - [ ] 28.1 Implement SSE transport
    - Write SSETransport class
    - Handle Server-Sent Events protocol
    - _Requirements: 7.3_

  - [ ] 28.2 Implement HTTP transport
    - Write HTTPTransport class
    - Handle HTTP request/response
    - _Requirements: 7.4_

  - [ ] 28.3 Write unit tests for additional transports
    - Test SSE transport
    - Test HTTP transport
    - _Requirements: 7.3, 7.4_

- [ ] 29. Write comprehensive integration tests
  - [ ] 29.1 Write end-to-end integration tests
    - Test: Load extension → Register hooks → Execute hook on event
    - Test: Load extension → Start MCP server → Invoke MCP tool
    - Test: Approve workspace hook → Execute hook → Verify trust persisted
    - Test: Enable extension → Disable extension → Verify cleanup
    - Test: Multiple extensions with same event → Verify execution order

- [ ] 30. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: hooks → trust → extensions → MCP
- MCP transports are implemented incrementally (stdio first, then SSE and HTTP)
- Configuration integration happens after core functionality is working
