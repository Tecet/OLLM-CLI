# Implementation Plan: Core Runtime and Provider Interface

## Overview

This implementation plan breaks down the core runtime and provider interface system into discrete coding tasks. The approach follows a bottom-up strategy: first establishing the foundational types and interfaces, then building the provider layer, followed by the runtime layer, and finally the tool integration layer. Each task builds incrementally on previous work, with testing integrated throughout.

## Tasks

> **Timestamp Format**: Each task can include `Started: YYYY-MM-DD HH:MM` and `Completed: YYYY-MM-DD HH:MM` to track actual time spent.

- [x] 1. Create provider types and interfaces
  - Create `packages/core/src/provider/types.ts` with all core interfaces
  - Define Role, MessagePart, Message, ToolSchema, ToolCall types
  - Define ProviderRequest, ProviderEvent, ProviderAdapter interfaces
  - Define ModelInfo and PullProgress interfaces
  - Export all types from the file
  - _Requirements: 4.1, 9.1, 9.2, 9.3_
  - _Started: 2026-01-10 14:30_
  - _Completed: 2026-01-10 15:15_

- [x] 1.1 Write property tests for message structure
  - **Property 30: Message Structure Validity**
  - **Validates: Requirements 9.1, 9.2**
  - **Property 31: Tool Message Name Field**
  - **Validates: Requirements 9.3**

- [x] 2. Implement Provider Registry
  - [x] 2.1 Create `packages/core/src/provider/registry.ts`
    - Implement ProviderRegistry class with Map storage
    - Implement register(), get(), setDefault(), getDefault(), list() methods
    - Add error handling for missing providers
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.2 Write property tests for provider registry
    - **Property 1: Provider Registration and Retrieval**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: Default Provider Resolution**
    - **Validates: Requirements 1.3, 1.5**
    - **Property 3: Provider List Completeness**
    - **Validates: Requirements 1.4**

- [x] 3. Implement Token Counter
  - [x] 3.1 Create `packages/core/src/core/tokenLimits.ts`
    - Implement TokenCounter class with provider and config
    - Implement estimateTokens() method with provider fallback
    - Implement fallbackEstimate() using character count / 4
    - Implement checkLimit() method with warning threshold
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.2 Write property tests for token counting
    - **Property 22: Token Count Estimation**
    - **Validates: Requirements 7.1**
    - **Property 23: Provider Tokenizer Usage**
    - **Validates: Requirements 7.2**
    - **Property 24: Fallback Token Estimation**
    - **Validates: Requirements 7.3**
    - **Property 25: Token Limit Warning**
    - **Validates: Requirements 7.4**
    - **Property 26: Token Limit Enforcement**
    - **Validates: Requirements 7.5**

- [x] 4. Implement Turn Manager
  - [x] 4.1 Create `packages/core/src/core/turn.ts`
    - Implement Turn class with provider, toolRegistry, messages, options
    - Implement execute() method that streams from provider
    - Implement tool call queuing during streaming
    - Implement executeToolCalls() method with parallel execution
    - Add accumulated text tracking and message history updates
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.2 Write property tests for turn management
    - **Property 6: Tool Call Queuing and Execution**
    - **Validates: Requirements 3.1, 3.2, 8.3, 8.4**
    - **Property 7: Tool Result Continuation**
    - **Validates: Requirements 3.3**
    - **Property 8: Parallel Tool Execution**
    - **Validates: Requirements 3.4**
    - **Property 27: Turn Initialization**
    - **Validates: Requirements 8.1**
    - **Property 28: Event Collection Completeness**
    - **Validates: Requirements 8.2**
    - **Property 29: Conversation History Update**
    - **Validates: Requirements 8.5**

  - [x] 4.3 Write unit tests for turn edge cases
    - Test turn with no tool calls
    - Test turn with tool execution errors
    - Test turn with abort signal

- [x] 5. Checkpoint - Ensure core components compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Chat Client
  - [x] 6.1 Create `packages/core/src/core/chatClient.ts`
    - Implement ChatClient class with providerRegistry, toolRegistry, config
    - Implement chat() async generator method
    - Implement turn loop with max turns limit
    - Implement event mapping from Turn to Chat events
    - Add abort signal handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.5_

  - [x] 6.2 Write property tests for chat client
    - **Property 4: Event Stream Forwarding**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - **Property 5: Abort Signal Cancellation**
    - **Validates: Requirements 2.5**
    - **Property 9: Maximum Turn Limit**
    - **Validates: Requirements 3.5**

  - [x] 6.3 Write unit tests for chat client
    - Test chat with single turn
    - Test chat with multiple turns and tool calls
    - Test chat with max turns exceeded

- [x] 7. Implement ReAct Tool Handler
  - [x] 7.1 Create `packages/core/src/core/reactToolHandler.ts`
    - Implement ReActToolHandler class with static methods
    - Implement formatToolsAsInstructions() method
    - Implement parseReActOutput() method with regex parsing
    - Implement formatObservation() method
    - Implement validateActionInput() method for JSON validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.2 Write property tests for ReAct handler
    - **Property 17: ReAct Instruction Formatting**
    - **Validates: Requirements 6.1**
    - **Property 18: ReAct Output Parsing**
    - **Validates: Requirements 6.2**
    - **Property 19: ReAct JSON Validation**
    - **Validates: Requirements 6.3, 6.4**
    - **Property 20: ReAct Observation Formatting**
    - **Validates: Requirements 6.5**
    - **Property 21: ReAct Turn Completion**
    - **Validates: Requirements 6.6**

  - [x] 7.3 Write unit tests for ReAct edge cases
    - Test parsing with missing fields
    - Test parsing with malformed JSON
    - Test Final Answer detection

- [x] 8. Implement Local Provider Adapter
  - [x] 8.1 Create `packages/ollm-bridge/src/provider/localProvider.ts`
    - Implement LocalProvider class implementing ProviderAdapter
    - Implement chatStream() method with fetch and NDJSON parsing
    - Implement mapMessages() to convert internal to Ollama format
    - Implement mapTools() to convert tool schemas
    - Implement mapChunkToEvents() to convert server chunks to events
    - Add error handling for connection failures
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Implement model management methods
    - Implement countTokens() with fallback estimation
    - Implement listModels() method
    - Implement pullModel() with progress streaming
    - Implement deleteModel() method
    - Implement showModel() method
    - _Requirements: 4.2, 4.3_

  - [x] 8.3 Write property tests for local provider
    - **Property 10: Provider Interface Compliance**
    - **Validates: Requirements 4.1**
    - **Property 11: Optional Method Presence**
    - **Validates: Requirements 4.2, 4.3**
    - **Property 12: Message Format Mapping**
    - **Validates: Requirements 4.4, 9.4, 9.5**
    - **Property 13: Tool Schema Conversion**
    - **Validates: Requirements 4.5, 5.5**
    - **Property 14: Local Provider Request Formatting**
    - **Validates: Requirements 5.2**
    - **Property 15: Local Provider Event Streaming**
    - **Validates: Requirements 5.3**
    - **Property 16: Connection Error Handling**
    - **Validates: Requirements 5.4, 10.1**

  - [x] 8.4 Write unit tests for local provider
    - Test with mock HTTP responses
    - Test connection error handling
    - Test NDJSON parsing with various chunk sizes

- [x] 9. Implement error handling throughout
  - [x] 9.1 Add error handling to ChatClient
    - Handle provider errors gracefully
    - Emit error events for tool execution failures
    - Handle abort signal cleanup
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

  - [x] 9.2 Add error handling to Turn
    - Catch and emit provider stream errors
    - Handle tool execution errors without terminating
    - Clean up on abort signal
    - _Requirements: 10.2, 10.4, 10.5_

- [x] 9.3 Add ReAct error recovery
  - Detect invalid JSON in Action Input
  - Provide a correction request message helper for callers
  - _Requirements: 10.3_

  - [x] 9.4 Write property tests for error handling
    - **Property 32: Tool Execution Error Handling**
    - **Validates: Requirements 10.2**
    - **Property 33: ReAct JSON Error Recovery**
    - **Validates: Requirements 10.3**
    - **Property 34: Abort Signal Cleanup**
    - **Validates: Requirements 10.4**
    - **Property 35: Unexpected Error Resilience**
    - **Validates: Requirements 10.5**

- [x] 10. Create mock providers for testing
  - [x] 10.1 Create `packages/test-utils/src/mockProvider.ts`
    - Implement MockProvider with configurable event sequences
    - Add support for simulating errors
    - Add configurable delays for parallel execution testing
    - Add deterministic token counting
    - Export from test-utils package

  - [x] 10.2 Write unit tests for mock provider
    - Test event sequence emission
    - Test error simulation
    - Test delay configuration

- [x] 11. Update package exports
  - [x] 11.1 Update `packages/core/src/index.ts`
    - Export all types from provider/types
    - Export ProviderRegistry
    - Export ChatClient
    - Export Turn
    - Export TokenCounter
    - Export ReActToolHandler

  - [x] 11.2 Update `packages/ollm-bridge/src/index.ts`
    - Export LocalProvider
    - Export LocalProviderConfig

  - [x] 11.3 Update `packages/test-utils/src/index.ts`
    - Export MockProvider and related utilities

- [x] 12. Final checkpoint - Integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all components integrate correctly
  - Verify exports are accessible from other packages

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Mock providers enable testing without real LLM backend
