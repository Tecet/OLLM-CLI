# Implementation Plan: Kraken Integration

## Overview

This implementation plan breaks down the Kraken Integration feature into discrete, incremental tasks. Each task builds on previous work and includes testing to validate functionality early. The plan follows a bottom-up approach: foundation → executors → providers → manager → integration → UI.

## Tasks

- [ ] 1. Foundation and Type Definitions
  - Create `packages/core/src/kraken/` directory structure
  - Define all TypeScript interfaces in `types.ts`
  - Create configuration schema types
  - Set up exports in `index.ts`
  - _Requirements: 11.1, 11.2_

- [ ]* 1.1 Write unit tests for type definitions
  - Test configuration schema validation
  - Test type guards and type checking utilities
  - _Requirements: 11.2_

- [ ] 2. CLI Executor - Discovery and Execution
  - [ ] 2.1 Implement executable discovery service
    - Create `packages/core/src/kraken/execution/discovery.ts`
    - Implement platform-specific search paths (Windows, macOS, Linux)
    - Implement `which` command equivalent for PATH search
    - Add file existence and executable permission checks
    - _Requirements: 1.1, 15.1, 15.2_

  - [ ]* 2.2 Write property tests for executable discovery
    - **Property 43: Executable Discovery Cross-Platform**
    - **Validates: Requirements 1.1, 15.1, 15.2**

  - [ ] 2.3 Implement subprocess executor
    - Create `packages/core/src/kraken/execution/CliExecutor.ts`
    - Implement `execWithStdin` for STDIN-based execution
    - Add timeout handling with process termination
    - Implement Windows thread pool compatibility
    - _Requirements: 1.2, 1.4, 15.3, 15.4_

  - [ ]* 2.4 Write property tests for subprocess execution
    - **Property 1: STDIN Prompt Delivery**
    - **Property 3: Timeout Enforcement**
    - **Property 44: Subprocess Execution Cross-Platform**
    - **Validates: Requirements 1.2, 1.4, 15.3, 15.4**

  - [ ] 2.5 Implement CLI output parser
    - Create `packages/core/src/kraken/execution/parser.ts`
    - Parse text content, fenced code blocks, and JSON
    - Convert parsed output to ProviderEvent stream
    - _Requirements: 1.3_

  - [ ]* 2.6 Write property tests for output parsing
    - **Property 2: Output Parsing Completeness**
    - **Validates: Requirements 1.3**

- [ ] 3. CLI Executor - Proxy Mode
  - [ ] 3.1 Implement HTTP proxy client
    - Add proxy execution method to CliExecutor
    - Implement request formatting for proxy API
    - Add proxy authentication with API key
    - Handle proxy-specific errors
    - _Requirements: 1.7_

  - [ ]* 3.2 Write property tests for proxy routing
    - **Property 4: Proxy Routing**
    - **Validates: Requirements 1.7**

  - [ ] 3.3 Implement proxy health check
    - Create health check endpoint call
    - Parse proxy availability response
    - Detect which CLI tools are available via proxy
    - _Requirements: 3.1_

- [ ] 4. Checkpoint - CLI Executor Complete
  - Ensure all CLI executor tests pass
  - Verify cross-platform compatibility
  - Ask the user if questions arise

- [ ] 5. API Client - Core Functionality
  - [ ] 5.1 Implement base API client
    - Create `packages/core/src/kraken/execution/ApiClient.ts`
    - Implement SSE stream parser
    - Add request/response logging
    - Implement base error handling
    - _Requirements: 2.2, 2.3_

  - [ ]* 5.2 Write property tests for SSE parsing
    - **Property 6: SSE Parsing Completeness**
    - **Validates: Requirements 2.3**

  - [ ] 5.3 Implement retry logic with exponential backoff
    - Add retry wrapper for network requests
    - Implement exponential delay calculation
    - Limit retries to 3 attempts
    - _Requirements: 2.7_

  - [ ]* 5.4 Write property tests for retry logic
    - **Property 8: Retry with Exponential Backoff**
    - **Validates: Requirements 2.7**

- [ ] 6. API Client - Provider Adapters
  - [ ] 6.1 Implement OpenAI adapter
    - Create request formatter for OpenAI API
    - Implement streaming response parser
    - Add token counting for OpenAI models
    - Handle OpenAI-specific errors
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 6.2 Write property tests for OpenAI adapter
    - **Property 5: Request Formatting Consistency**
    - **Property 7: Cost Calculation Accuracy**
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 6.3 Implement Anthropic adapter
    - Create request formatter for Anthropic API
    - Implement streaming response parser
    - Add token counting for Claude models
    - Handle Anthropic-specific errors
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 6.4 Write property tests for Anthropic adapter
    - **Property 5: Request Formatting Consistency**
    - **Property 7: Cost Calculation Accuracy**
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 6.5 Implement Google AI adapter
    - Create request formatter for Google AI API
    - Implement streaming response parser
    - Add token counting for Gemini models
    - Handle Google-specific errors
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 6.6 Write property tests for Google AI adapter
    - **Property 5: Request Formatting Consistency**
    - **Property 7: Cost Calculation Accuracy**
    - **Validates: Requirements 2.2, 2.4**

- [ ] 7. Checkpoint - API Client Complete
  - Ensure all API client tests pass
  - Verify all three providers work correctly
  - Ask the user if questions arise

- [ ] 8. Health Check System
  - [ ] 8.1 Implement CLI health check
    - Create `packages/core/src/kraken/health/CliHealthCheck.ts`
    - Implement version detection via `--version`
    - Implement authentication detection
    - Add 5-second timeout for health checks
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 8.2 Write property tests for CLI health checks
    - **Property 9: Health Check Execution**
    - **Property 10: Version Detection**
    - **Property 11: Authentication Detection**
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ] 8.3 Implement API health check
    - Create `packages/core/src/kraken/health/ApiHealthCheck.ts`
    - Validate API key and connectivity
    - Enforce 5-second timeout
    - Parse health check responses
    - _Requirements: 3.5_

  - [ ]* 8.4 Write property tests for API health checks
    - **Property 12: API Health Check Timeout**
    - **Property 13: Health Status Tracking**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 9. Cost Tracker
  - [ ] 9.1 Implement cost calculation and tracking
    - Create `packages/core/src/kraken/CostTracker.ts`
    - Add pricing data for all providers
    - Implement cost calculation from token usage
    - Add session cost tracking
    - Implement budget enforcement
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.2 Write property tests for cost tracker
    - **Property 7: Cost Calculation Accuracy**
    - **Property 25: Budget Enforcement**
    - **Property 26: Budget Display**
    - **Property 27: Session Reset**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [ ] 9.3 Implement cost estimation
    - Add estimation method for pre-request warnings
    - Calculate min/max cost ranges
    - _Requirements: 6.6_

  - [ ]* 9.4 Write property tests for cost estimation
    - **Property 28: Cost Warning Display**
    - **Validates: Requirements 6.6**

  - [ ] 9.5 Implement usage logging
    - Add logging for all Kraken invocations
    - Store records with timestamps and costs
    - Implement history retrieval
    - _Requirements: 6.7_

  - [ ]* 9.6 Write property tests for usage logging
    - **Property 29: Usage Logging**
    - **Validates: Requirements 6.7**

- [ ] 10. Context Transfer Service
  - [ ] 10.1 Implement context export
    - Create `packages/core/src/kraken/ContextTransferService.ts`
    - Implement context extraction from session
    - Extract recent messages, active files, current task
    - Extract tool results
    - Generate conversation summary
    - _Requirements: 5.1, 5.2_

  - [ ]* 10.2 Write property tests for context export
    - **Property 19: Context Export Completeness**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 10.3 Implement context compression
    - Add compression for oversized context
    - Use summarization to reduce size
    - Preserve essential information
    - _Requirements: 5.3_

  - [ ]* 10.4 Write property tests for context compression
    - **Property 20: Context Compression**
    - **Validates: Requirements 5.3**

  - [ ] 10.5 Implement response import and session merging
    - Add response import to local session
    - Implement session merging with metadata
    - Add fallback for transfer failures
    - Handle context inheritance toggle
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.6 Write property tests for import and merging
    - **Property 21: Response Import**
    - **Property 22: Session Merging**
    - **Property 23: Fallback on Transfer Failure**
    - **Property 24: Context Inheritance Toggle**
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

- [ ] 11. Checkpoint - Core Services Complete
  - Ensure all health check, cost tracker, and context transfer tests pass
  - Verify integration between services
  - Ask the user if questions arise

- [ ] 12. Kraken Provider Adapters
  - [ ] 12.1 Implement KrakenCliProvider
    - Create `packages/core/src/kraken/providers/KrakenCliProvider.ts`
    - Implement ProviderAdapter interface
    - Integrate with CliExecutor
    - Build prompts from messages
    - Parse output to ProviderEvent stream
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 12.2 Write unit tests for KrakenCliProvider
    - Test chatStream implementation
    - Test prompt building
    - Test output parsing integration
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 12.3 Implement KrakenApiProvider
    - Create `packages/core/src/kraken/providers/KrakenApiProvider.ts`
    - Implement ProviderAdapter interface
    - Integrate with ApiClient
    - Format requests for specific APIs
    - Parse streaming responses
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 12.4 Write unit tests for KrakenApiProvider
    - Test chatStream implementation
    - Test request formatting
    - Test response parsing integration
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 13. Kraken Manager
  - [ ] 13.1 Implement provider selection logic
    - Create `packages/core/src/kraken/KrakenManager.ts`
    - Implement task-based provider selection
    - Add CLI provider preference logic
    - Implement preferred provider priority
    - Add unavailable provider exclusion
    - Handle explicit provider selection
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 13.2 Write property tests for provider selection
    - **Property 14: Task-Based Selection**
    - **Property 15: CLI Provider Preference**
    - **Property 16: Preferred Provider Priority**
    - **Property 17: Unavailable Provider Exclusion**
    - **Property 18: Explicit Provider Selection**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7**

  - [ ] 13.3 Implement health check orchestration
    - Add healthCheckAll method
    - Integrate with CLI and API health checks
    - Track health status for all providers
    - _Requirements: 3.1, 3.6, 3.7_

  - [ ]* 13.4 Write property tests for health checks
    - **Property 9: Health Check Execution**
    - **Property 13: Health Status Tracking**
    - **Validates: Requirements 3.1, 3.6, 3.7**

  - [ ] 13.5 Implement release method
    - Add Kraken release orchestration
    - Integrate with cost tracker for budget checks
    - Integrate with context transfer service
    - Create and manage Kraken sessions
    - _Requirements: 4.1, 5.1, 6.2_

  - [ ]* 13.6 Write integration tests for release flow
    - Test end-to-end Kraken invocation
    - Test context transfer integration
    - Test cost tracking integration
    - _Requirements: 4.1, 5.1, 6.2_

  - [ ] 13.7 Implement auto-escalation logic
    - Add escalation trigger detection
    - Implement provider selection for escalation
    - Add escalation disabled behavior
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [ ]* 13.8 Write property tests for auto-escalation
    - **Property 30: Escalation Trigger Detection**
    - **Property 31: Escalation Provider Selection**
    - **Property 33: Escalation Disabled Behavior**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6**

- [ ] 14. Checkpoint - Kraken Manager Complete
  - Ensure all manager tests pass
  - Verify provider selection works correctly
  - Verify auto-escalation triggers properly
  - Ask the user if questions arise

- [ ] 15. Provider Registry Integration
  - [ ] 15.1 Extend ProviderRegistry for Kraken
    - Update `packages/core/src/provider/registry.ts`
    - Add methods for registering Kraken providers
    - Add methods for querying Kraken providers
    - Add isKrakenAvailable check
    - _Requirements: 4.1_

  - [ ]* 15.2 Write unit tests for registry extension
    - Test Kraken provider registration
    - Test Kraken provider queries
    - Test availability checks
    - _Requirements: 4.1_

- [ ] 16. Configuration Management
  - [ ] 16.1 Create Kraken configuration schema
    - Create `schemas/kraken-config.json`
    - Define JSON schema for all Kraken config options
    - Add validation rules
    - _Requirements: 11.1, 11.2_

  - [ ] 16.2 Implement configuration loader
    - Create `packages/core/src/kraken/config/loader.ts`
    - Parse kraken section from config.yaml
    - Validate configuration against schema
    - Resolve environment variables in API keys
    - _Requirements: 11.3, 11.4_

  - [ ]* 16.3 Write property tests for configuration
    - **Property 38: Configuration Validation**
    - **Property 39: Environment Variable Resolution**
    - **Validates: Requirements 11.2, 11.3, 11.4**

  - [ ] 16.4 Implement configuration hot-reload
    - Add file watcher for config changes
    - Reload Kraken providers on config change
    - Update provider registry
    - _Requirements: 11.6_

  - [ ]* 16.5 Write property tests for hot-reload
    - **Property 40: Configuration Hot-Reload**
    - **Validates: Requirements 11.6**

- [ ] 17. Hook System Integration
  - [ ] 17.1 Add Kraken hook events
    - Update `packages/core/src/hooks/types.ts`
    - Add before_kraken, after_kraken, kraken_escalate events
    - Define hook payload types
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 17.2 Implement hook emission in Kraken Manager
    - Emit before_kraken before invocation
    - Emit after_kraken after response
    - Emit kraken_escalate on auto-escalation
    - Handle hook cancellation
    - Handle hook errors
    - _Requirements: 10.4, 10.5, 10.6_

  - [ ]* 17.3 Write property tests for hooks
    - **Property 34: Before Kraken Hook**
    - **Property 35: After Kraken Hook**
    - **Property 32: Escalation Hook Emission**
    - **Property 36: Hook Cancellation**
    - **Property 37: Hook Error Handling**
    - **Validates: Requirements 10.1, 10.2, 9.5, 10.5, 10.6**

- [ ] 18. Policy Engine Extension
  - [ ] 18.1 Add Kraken policies
    - Update `packages/core/src/policy/policyRules.ts`
    - Add confirmBeforeRelease policy
    - Add showCostWarnings policy
    - Add allowedProviders whitelist
    - _Requirements: 8.1, 8.7_

  - [ ] 18.2 Implement confirmation dialog logic
    - Create confirmation request builder
    - Include provider, model, context, and cost info
    - Handle user responses (approve, reject, always allow)
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 18.3 Write unit tests for policy extension
    - Test confirmation dialog generation
    - Test policy enforcement
    - Test always allow list
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 19. Checkpoint - Integration Complete
  - Ensure all integration tests pass
  - Verify hooks, policies, and config work together
  - Ask the user if questions arise

- [ ] 20. CLI Command Implementation
  - [ ] 20.1 Implement /kraken slash command
    - Create `packages/cli/src/commands/kraken.ts`
    - Implement interactive provider selection
    - Implement direct query with prompt
    - Add command aliases (/k, /release)
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ]* 20.2 Write unit tests for /kraken command
    - Test command parsing
    - Test provider selection
    - Test direct query
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ] 20.3 Implement /kraken status subcommand
    - Display health status of all providers
    - Show remaining budget and session costs
    - Show last used provider
    - _Requirements: 7.3_

  - [ ] 20.4 Implement /kraken config subcommand
    - Open Kraken configuration file for editing
    - _Requirements: 7.4_

  - [ ] 20.5 Implement /kraken history subcommand
    - Display recent Kraken usage
    - Show costs and timestamps
    - _Requirements: 7.5_

- [ ] 21. UI Components
  - [ ] 21.1 Implement provider selection menu
    - Create interactive menu component
    - Display CLI and API providers separately
    - Show availability status with checkmarks
    - Handle keyboard navigation
    - _Requirements: 4.1, 12.7_

  - [ ] 21.2 Implement confirmation dialog
    - Create confirmation dialog component
    - Display provider, model, context, and cost
    - Handle user responses (Y/N/A)
    - _Requirements: 8.2_

  - [ ] 21.3 Implement Kraken status display
    - Create status table component
    - Display provider, status, model, and cost
    - Show session budget information
    - _Requirements: 7.3, 12.7_

  - [ ] 21.4 Update status bar with Kraken indicator
    - Add Kraken status to main status bar
    - Show Ready/Active/---/⚠️ states
    - Update indicator based on Kraken state
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 21.5 Implement Kraken response display
    - Create distinct visual style for Kraken responses
    - Show provider name and model in header
    - Display tokens, cost, and time in footer
    - _Requirements: 12.5, 12.6_

- [ ] 22. Security Implementation
  - [ ] 22.1 Implement API key redaction
    - Create redaction utility
    - Redact API keys in logs
    - Redact API keys in error messages
    - _Requirements: 14.3_

  - [ ]* 22.2 Write property tests for API key redaction
    - **Property 41: API Key Redaction**
    - **Validates: Requirements 14.3**

  - [ ] 22.3 Implement HTTPS enforcement
    - Verify all API requests use HTTPS
    - Reject non-HTTPS connections
    - _Requirements: 14.7_

  - [ ]* 22.4 Write property tests for HTTPS enforcement
    - **Property 42: HTTPS Encryption**
    - **Validates: Requirements 14.7**

  - [ ] 22.5 Implement sensitive data warnings
    - Detect sensitive information in context
    - Warn users before sharing with external providers
    - _Requirements: 14.2_

- [ ] 23. Error Handling Implementation
  - [ ] 23.1 Implement error message builders
    - Create error builders for all error categories
    - Include actionable resolution steps
    - Add installation instructions for missing CLIs
    - Add authentication instructions
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 23.2 Write unit tests for error messages
    - Test all error message formats
    - Verify resolution steps are included
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [ ] 24. Cross-Platform Compatibility
  - [ ] 24.1 Implement platform-specific path resolution
    - Create path resolver utility
    - Handle Windows vs Unix path separators
    - Handle environment variable syntax differences
    - _Requirements: 15.5, 15.6_

  - [ ]* 24.2 Write property tests for path resolution
    - **Property 45: Path Resolution Cross-Platform**
    - **Validates: Requirements 15.5**

  - [ ] 24.3 Test on all platforms
    - Test on Windows
    - Test on macOS
    - Test on Linux
    - _Requirements: 15.7_

- [ ] 25. Final Integration and Testing
  - [ ] 25.1 End-to-end integration tests
    - Test complete CLI Bridge flow
    - Test complete API Provider flow
    - Test context transfer flow
    - Test auto-escalation flow
    - Test budget enforcement flow
    - _Requirements: All_

  - [ ] 25.2 Performance testing
    - Test with large contexts
    - Test with multiple concurrent requests
    - Test timeout handling under load
    - _Requirements: All_

  - [ ] 25.3 Documentation
    - Write user guide for Kraken feature
    - Document configuration options
    - Create troubleshooting guide
    - Add API documentation
    - _Requirements: All_

- [ ] 26. Final Checkpoint
  - Ensure all tests pass (unit, property, integration)
  - Verify 80% line coverage and 75% branch coverage
  - Verify all 45 properties are tested
  - Review error messages and user experience
  - Ask the user for final review

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
