# Implementation Plan: Kraken Integration

## Overview

This implementation plan breaks down the Kraken Integration feature into discrete, incremental tasks. Each task builds on previous work and includes testing to validate functionality early. The plan follows a bottom-up approach: foundation → executors → providers → manager → integration → UI.

**Current Status**: No Kraken code exists yet. This is a greenfield implementation that will extend the existing OLLM CLI provider system.

## Tasks

- [ ] 1. Foundation and Type Definitions
  - Create `packages/core/src/kraken/` directory structure
  - Define all TypeScript interfaces in `types.ts` (KrakenConfig, CliProviderConfig, ApiProviderConfig, KrakenSession, KrakenContext, etc.)
  - Create configuration schema types matching the design document
  - Set up exports in `index.ts`
  - _Requirements: 11.1, 11.2_

- [ ] 1.1 Write unit tests for type definitions
  - Test configuration schema validation with Ajv
  - Test type guards and type checking utilities
  - Test environment variable resolution patterns
  - _Requirements: 11.2_

- [ ] 2. CLI Executor - Discovery and Execution
  - [ ] 2.1 Implement executable discovery service
    - Create `packages/core/src/kraken/execution/discovery.ts`
    - Implement platform-specific search paths (Windows: check .exe/.cmd, Unix: check PATH and common dirs)
    - Implement `which` command equivalent for PATH search
    - Add file existence and executable permission checks
    - _Requirements: 1.1, 15.1, 15.2_

  - [ ] 2.2 Write property tests for executable discovery
    - **Property 43: Executable Discovery Cross-Platform**
    - Test Windows .exe/.cmd extension handling
    - Test Unix PATH search and permission checks
    - Test fallback to common installation directories
    - **Validates: Requirements 1.1, 15.1, 15.2**

  - [ ] 2.3 Implement subprocess executor
    - Create `packages/core/src/kraken/execution/CliExecutor.ts`
    - Implement `execWithStdin` for STDIN-based execution (avoids Windows command-line length limits)
    - Add timeout handling with process termination (SIGTERM)
    - Implement Windows thread pool compatibility using Node.js spawn
    - Handle stdout/stderr capture and exit code tracking
    - _Requirements: 1.2, 1.4, 15.3, 15.4_

  - [ ] 2.4 Write property tests for subprocess execution
    - **Property 1: STDIN Prompt Delivery** - verify prompts sent via STDIN regardless of length
    - **Property 3: Timeout Enforcement** - verify process termination after timeout
    - **Property 44: Subprocess Execution Cross-Platform** - test Windows vs Unix execution
    - Test trailing newline handling (prevents Gemini CLI hang)
    - **Validates: Requirements 1.2, 1.4, 15.3, 15.4**

  - [ ] 2.5 Implement CLI output parser
    - Create `packages/core/src/kraken/execution/parser.ts`
    - Parse text content, fenced code blocks (```), and JSON responses
    - Convert parsed output to ProviderEvent stream (text, tool_call, finish events)
    - Handle malformed output gracefully
    - _Requirements: 1.3_

  - [ ] 2.6 Write property tests for output parsing
    - **Property 2: Output Parsing Completeness** - verify all structured elements extracted
    - Test text-only output
    - Test mixed text and code blocks
    - Test JSON response parsing
    - Test malformed output handling
    - **Validates: Requirements 1.3**

- [ ] 3. CLI Executor - Proxy Mode
  - [ ] 3.1 Implement HTTP proxy client
    - Add proxy execution method to CliExecutor
    - Implement request formatting for proxy API (POST /execute endpoint)
    - Add proxy authentication with API key (X-API-Key header)
    - Handle proxy-specific errors (HTTP status codes, network failures)
    - Implement timeout using AbortSignal
    - _Requirements: 1.7_

  - [ ] 3.2 Write property tests for proxy routing
    - **Property 4: Proxy Routing** - verify requests route through proxy when configured
    - Test proxy URL validation
    - Test API key authentication
    - Test timeout handling
    - Test error responses from proxy
    - **Validates: Requirements 1.7**

  - [ ] 3.3 Implement proxy health check
    - Create health check endpoint call (GET /health or similar)
    - Parse proxy availability response
    - Detect which CLI tools are available via proxy
    - Handle proxy unreachable scenarios
    - _Requirements: 3.1_

- [ ] 4. Checkpoint - CLI Executor Complete
  - Ensure all CLI executor tests pass
  - Verify cross-platform compatibility
  - Ask the user if questions arise

- [ ] 5. API Client - Core Functionality
  - [ ] 5.1 Implement base API client
    - Create `packages/core/src/kraken/execution/ApiClient.ts`
    - Implement SSE (Server-Sent Events) stream parser for streaming responses
    - Add request/response logging with API key redaction
    - Implement base error handling (HTTP status codes, network errors)
    - Add HTTPS enforcement (reject non-HTTPS URLs)
    - _Requirements: 2.2, 2.3, 14.7_

  - [ ] 5.2 Write property tests for SSE parsing
    - **Property 6: SSE Parsing Completeness** - verify all SSE events converted to ProviderEvent
    - Test data: prefix parsing
    - Test [DONE] termination
    - Test malformed JSON handling
    - Test stream interruption
    - **Validates: Requirements 2.3**

  - [ ] 5.3 Implement retry logic with exponential backoff
    - Add retry wrapper for network requests
    - Implement exponential delay calculation (e.g., 1s, 2s, 4s)
    - Limit retries to 3 attempts
    - Only retry on transient errors (network, 5xx)
    - _Requirements: 2.7_

  - [ ] 5.4 Write property tests for retry logic
    - **Property 8: Retry with Exponential Backoff** - verify retry behavior
    - Test exponential delay calculation
    - Test max retry limit
    - Test non-retryable errors (4xx)
    - Test successful retry after failure
    - **Validates: Requirements 2.7**

- [ ] 6. API Client - Provider Adapters
  - [ ] 6.1 Implement OpenAI adapter
    - Create request formatter for OpenAI API (messages format, tools schema)
    - Implement streaming response parser (delta content handling)
    - Add token counting for OpenAI models (use tiktoken or estimation)
    - Handle OpenAI-specific errors (rate limits, invalid model, etc.)
    - Map OpenAI response to ProviderEvent stream
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 6.2 Write property tests for OpenAI adapter
    - **Property 5: Request Formatting Consistency** - verify no information loss
    - **Property 7: Cost Calculation Accuracy** - verify token counting and pricing
    - Test message format conversion
    - Test tool schema mapping
    - Test streaming delta aggregation
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 6.3 Implement Anthropic adapter
    - Create request formatter for Anthropic API (Claude format)
    - Implement streaming response parser (content blocks)
    - Add token counting for Claude models
    - Handle Anthropic-specific errors (overloaded, invalid request)
    - Map Anthropic response to ProviderEvent stream
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 6.4 Write property tests for Anthropic adapter
    - **Property 5: Request Formatting Consistency**
    - **Property 7: Cost Calculation Accuracy**
    - Test system prompt handling (separate from messages)
    - Test content block parsing
    - Test tool use format
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 6.5 Implement Google AI adapter
    - Create request formatter for Google AI API (Gemini format)
    - Implement streaming response parser (candidates array)
    - Add token counting for Gemini models
    - Handle Google-specific errors (safety filters, quota)
    - Map Google response to ProviderEvent stream
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 6.6 Write property tests for Google AI adapter
    - **Property 5: Request Formatting Consistency**
    - **Property 7: Cost Calculation Accuracy**
    - Test parts array format
    - Test function calling format
    - Test safety settings
    - **Validates: Requirements 2.2, 2.4**

- [ ] 7. Checkpoint - API Client Complete
  - Ensure all API client tests pass
  - Verify all three providers work correctly
  - Ask the user if questions arise

- [ ] 8. Health Check System
  - [ ] 8.1 Implement CLI health check
    - Create `packages/core/src/kraken/health/CliHealthCheck.ts`
    - Implement version detection via `--version` flag execution
    - Implement authentication detection (check for auth errors)
    - Add 5-second timeout for health checks
    - Return HealthCheckResult with available, version, authRequired fields
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 8.2 Write property tests for CLI health checks
    - **Property 9: Health Check Execution** - verify health check runs for all providers
    - **Property 10: Version Detection** - verify version string extraction
    - **Property 11: Authentication Detection** - verify auth requirement detection
    - Test timeout enforcement
    - Test executable not found handling
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ] 8.3 Implement API health check
    - Create `packages/core/src/kraken/health/ApiHealthCheck.ts`
    - Validate API key format (provider-specific patterns)
    - Test connectivity with minimal API call (e.g., list models)
    - Enforce 5-second timeout
    - Parse health check responses and error codes
    - _Requirements: 3.5_

  - [ ] 8.4 Write property tests for API health checks
    - **Property 12: API Health Check Timeout** - verify 5-second limit
    - **Property 13: Health Status Tracking** - verify status updates
    - Test invalid API key detection
    - Test network unreachable handling
    - Test successful connectivity
    - **Validates: Requirements 3.5, 3.6**

- [ ] 9. Cost Tracker
  - [ ] 9.1 Implement cost calculation and tracking
    - Create `packages/core/src/kraken/CostTracker.ts`
    - Add pricing data for all providers (per 1M tokens: input/output rates)
    - Implement cost calculation from token usage (input + output costs)
    - Add session cost tracking (accumulate costs per session)
    - Implement budget enforcement (check before allowing requests)
    - Store cost records with timestamps
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 9.2 Write property tests for cost tracker
    - **Property 7: Cost Calculation Accuracy** - verify pricing calculations
    - **Property 25: Budget Enforcement** - verify requests rejected when budget exceeded
    - **Property 26: Budget Display** - verify accurate remaining budget
    - **Property 27: Session Reset** - verify budget counter resets
    - Test unknown model pricing (conservative estimation)
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [ ] 9.3 Implement cost estimation
    - Add estimation method for pre-request warnings
    - Calculate min/max cost ranges (assume 70/30 input/output split)
    - Handle unknown model pricing
    - _Requirements: 6.6_

  - [ ] 9.4 Write property tests for cost estimation
    - **Property 28: Cost Warning Display** - verify warnings shown for high costs
    - Test min/max range calculation
    - Test warning threshold (e.g., $1.00)
    - **Validates: Requirements 6.6**

  - [ ] 9.5 Implement usage logging
    - Add logging for all Kraken invocations
    - Store records with timestamps, provider, model, tokens, and costs
    - Implement history retrieval (get last N records)
    - Persist to file or database (optional)
    - _Requirements: 6.7_

  - [ ] 9.6 Write property tests for usage logging
    - **Property 29: Usage Logging** - verify all invocations logged
    - Test record format
    - Test history retrieval
    - Test log persistence
    - **Validates: Requirements 6.7**

- [ ] 10. Context Transfer Service
  - [ ] 10.1 Implement context export
    - Create `packages/core/src/kraken/ContextTransferService.ts`
    - Implement context extraction from session (use existing SessionManager)
    - Extract recent messages (last 10), active files (from tool results), current task (last user message)
    - Extract tool results (last 5 tool responses)
    - Generate conversation summary (use existing CompressionService)
    - _Requirements: 5.1, 5.2_

  - [ ] 10.2 Write property tests for context export
    - **Property 19: Context Export Completeness** - verify all required fields present
    - Test message extraction
    - Test file path extraction from tool results
    - Test task extraction
    - Test tool result extraction
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 10.3 Implement context compression
    - Add compression for oversized context (check provider limits)
    - Use summarization to reduce size (leverage existing CompressionService)
    - Preserve essential information (current task, recent tool results)
    - Implement fallback to minimal context if compression fails
    - _Requirements: 5.3_

  - [ ] 10.4 Write property tests for context compression
    - **Property 20: Context Compression** - verify size reduction while preserving info
    - Test compression trigger (context exceeds limit)
    - Test essential information preservation
    - Test compression failure fallback
    - **Validates: Requirements 5.3**

  - [ ] 10.5 Implement response import and session merging
    - Add response import to local session (as assistant message with metadata)
    - Implement session merging with metadata (krakenUsed, krakenProvider, krakenCost)
    - Add fallback for transfer failures (proceed with minimal context)
    - Handle context inheritance toggle (skip export if disabled)
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ] 10.6 Write property tests for import and merging
    - **Property 21: Response Import** - verify response added to session
    - **Property 22: Session Merging** - verify metadata preserved
    - **Property 23: Fallback on Transfer Failure** - verify graceful degradation
    - **Property 24: Context Inheritance Toggle** - verify skip when disabled
    - Test metadata format
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

- [ ] 11. Checkpoint - Core Services Complete
  - Ensure all health check, cost tracker, and context transfer tests pass
  - Verify integration between services
  - Ask the user if questions arise

- [ ] 12. Kraken Provider Adapters
  - [ ] 12.1 Implement KrakenCliProvider
    - Create `packages/core/src/kraken/providers/KrakenCliProvider.ts`
    - Implement ProviderAdapter interface (chatStream, countTokens, listModels)
    - Integrate with CliExecutor for subprocess/proxy execution
    - Build prompts from messages (convert Message[] to string)
    - Parse output to ProviderEvent stream (use parser from 2.5)
    - Handle tool calls if CLI supports them
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 12.2 Write unit tests for KrakenCliProvider
    - Test chatStream implementation
    - Test prompt building from messages
    - Test output parsing integration
    - Test error handling (CLI not found, timeout, etc.)
    - Test proxy mode vs direct mode
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 12.3 Implement KrakenApiProvider
    - Create `packages/core/src/kraken/providers/KrakenApiProvider.ts`
    - Implement ProviderAdapter interface
    - Integrate with ApiClient for HTTPS communication
    - Format requests for specific APIs (OpenAI, Anthropic, Google)
    - Parse streaming responses to ProviderEvent stream
    - Handle tool calls and tool results
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 12.4 Write unit tests for KrakenApiProvider
    - Test chatStream implementation
    - Test request formatting for each provider
    - Test response parsing integration
    - Test error handling (invalid key, rate limit, etc.)
    - Test tool call handling
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 13. Kraken Manager
  - [ ] 13.1 Implement provider selection logic
    - Create `packages/core/src/kraken/KrakenManager.ts`
    - Implement task-based provider selection (complexity, domain, context size)
    - Add CLI provider preference logic (prefer CLI over API for cost)
    - Implement preferred provider priority (use defaultProvider from config)
    - Add unavailable provider exclusion (check health status)
    - Handle explicit provider selection (user-specified provider name)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ] 13.2 Write property tests for provider selection
    - **Property 14: Task-Based Selection** - verify provider matches task requirements
    - **Property 15: CLI Provider Preference** - verify CLI preferred when available
    - **Property 16: Preferred Provider Priority** - verify defaultProvider used
    - **Property 17: Unavailable Provider Exclusion** - verify unavailable providers skipped
    - **Property 18: Explicit Provider Selection** - verify user choice honored
    - Test no providers available error
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7**

  - [ ] 13.3 Implement health check orchestration
    - Add healthCheckAll method (run health checks on all providers)
    - Integrate with CLI and API health checks
    - Track health status for all providers (Map<string, boolean>)
    - Update status on config reload
    - _Requirements: 3.1, 3.6, 3.7_

  - [ ] 13.4 Write property tests for health checks
    - **Property 9: Health Check Execution** - verify all providers checked
    - **Property 13: Health Status Tracking** - verify status map updated
    - Test parallel health check execution
    - Test health check failure handling
    - **Validates: Requirements 3.1, 3.6, 3.7**

  - [ ] 13.5 Implement release method
    - Add Kraken release orchestration (main entry point)
    - Integrate with cost tracker for budget checks
    - Integrate with context transfer service
    - Create and manage Kraken sessions (track start/end, tokens, cost)
    - Handle provider selection (explicit or automatic)
    - Emit hook events (before_kraken, after_kraken)
    - _Requirements: 4.1, 5.1, 6.2_

  - [ ] 13.6 Write integration tests for release flow
    - Test end-to-end Kraken invocation
    - Test context transfer integration
    - Test cost tracking integration
    - Test budget enforcement
    - Test hook emission
    - _Requirements: 4.1, 5.1, 6.2_

  - [ ] 13.7 Implement auto-escalation logic
    - Add escalation trigger detection (modelFailure, contextOverflow, userRequest)
    - Implement provider selection for escalation (choose based on failure reason)
    - Add escalation disabled behavior (check config.autoEscalate.enabled)
    - Emit kraken_escalate hook event
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [ ] 13.8 Write property tests for auto-escalation
    - **Property 30: Escalation Trigger Detection** - verify triggers recognized
    - **Property 31: Escalation Provider Selection** - verify appropriate provider chosen
    - **Property 33: Escalation Disabled Behavior** - verify no auto-escalation when disabled
    - **Property 32: Escalation Hook Emission** - verify hook emitted with reason
    - Test escalation failure handling
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6**

- [ ] 14. Checkpoint - Kraken Manager Complete
  - Ensure all manager tests pass
  - Verify provider selection works correctly
  - Verify auto-escalation triggers properly
  - Ask the user if questions arise

- [ ] 15. Provider Registry Integration
  - [ ] 15.1 Extend ProviderRegistry for Kraken
    - Update `packages/core/src/provider/registry.ts`
    - Add methods for registering Kraken providers (registerKrakenProvider)
    - Add methods for querying Kraken providers (listKrakenProviders, getKrakenProvider)
    - Add isKrakenAvailable check (any Kraken provider healthy)
    - Maintain backward compatibility with existing providers
    - _Requirements: 4.1_

  - [ ] 15.2 Write unit tests for registry extension
    - Test Kraken provider registration
    - Test Kraken provider queries
    - Test availability checks
    - Test mixed local and Kraken providers
    - Test provider name conflicts
    - _Requirements: 4.1_

- [ ] 16. Configuration Management
  - [ ] 16.1 Create Kraken configuration schema
    - Create `schemas/kraken-config.json` (JSON Schema)
    - Define schema for all Kraken config options (enabled, providers, policies, etc.)
    - Add validation rules (required fields, types, formats)
    - Document schema with descriptions
    - _Requirements: 11.1, 11.2_

  - [ ] 16.2 Implement configuration loader
    - Create `packages/core/src/kraken/config/loader.ts`
    - Parse kraken section from config.yaml (use existing yaml parser)
    - Validate configuration against schema (use Ajv)
    - Resolve environment variables in API keys ($ENV_VAR syntax)
    - Provide helpful error messages for invalid config
    - _Requirements: 11.3, 11.4_

  - [ ] 16.3 Write property tests for configuration
    - **Property 38: Configuration Validation** - verify schema enforcement
    - **Property 39: Environment Variable Resolution** - verify $VAR expansion
    - Test required field validation
    - Test type validation
    - Test format validation (URLs, etc.)
    - Test invalid config error messages
    - **Validates: Requirements 11.2, 11.3, 11.4**

  - [ ] 16.4 Implement configuration hot-reload
    - Add file watcher for config changes (use fs.watch or chokidar)
    - Reload Kraken providers on config change
    - Update provider registry (re-register providers)
    - Re-run health checks after reload
    - _Requirements: 11.6_

  - [ ] 16.5 Write property tests for hot-reload
    - **Property 40: Configuration Hot-Reload** - verify reload without restart
    - Test config file change detection
    - Test provider re-registration
    - Test health check re-run
    - Test invalid config handling during reload
    - **Validates: Requirements 11.6**

- [ ] 17. Hook System Integration
  - [ ] 17.1 Add Kraken hook events
    - Update `packages/core/src/hooks/types.ts`
    - Add before_kraken, after_kraken, kraken_escalate event types
    - Define hook payload types (provider, model, prompt, cost, etc.)
    - Document hook events and payloads
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 17.2 Implement hook emission in Kraken Manager
    - Emit before_kraken before invocation (with provider, prompt details)
    - Emit after_kraken after response (with response, tokens, cost)
    - Emit kraken_escalate on auto-escalation (with reason)
    - Handle hook cancellation (if hook returns false, cancel invocation)
    - Handle hook errors (log error, continue with invocation)
    - _Requirements: 10.4, 10.5, 10.6_

  - [ ] 17.3 Write property tests for hooks
    - **Property 34: Before Kraken Hook** - verify hook emitted before invocation
    - **Property 35: After Kraken Hook** - verify hook emitted after response
    - **Property 32: Escalation Hook Emission** - verify hook emitted on escalation
    - **Property 36: Hook Cancellation** - verify invocation cancelled when hook returns false
    - **Property 37: Hook Error Handling** - verify errors logged and invocation continues
    - Test hook payload format
    - Test multiple hooks execution order
    - **Validates: Requirements 10.1, 10.2, 9.5, 10.5, 10.6**

- [ ] 18. Policy Engine Extension
  - [ ] 18.1 Add Kraken policies
    - Update `packages/core/src/policy/policyRules.ts`
    - Add confirmBeforeRelease policy (require confirmation before Kraken use)
    - Add showCostWarnings policy (warn about high costs)
    - Add allowedProviders whitelist (restrict which providers can be used)
    - Integrate with existing policy engine
    - _Requirements: 8.1, 8.7_

  - [ ] 18.2 Implement confirmation dialog logic
    - Create confirmation request builder (format confirmation prompt)
    - Include provider, model, context summary, and estimated cost info
    - Handle user responses (approve, reject, always allow)
    - Update allowed providers list on "always allow"
    - Persist allowed providers to config
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 18.3 Write unit tests for policy extension
    - Test confirmation dialog generation
    - Test policy enforcement (confirmBeforeRelease)
    - Test always allow list
    - Test cost warning policy
    - Test allowed providers whitelist
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 19. Checkpoint - Integration Complete
  - Ensure all integration tests pass
  - Verify hooks, policies, and config work together
  - Ask the user if questions arise

- [ ] 20. CLI Command Implementation
  - [ ] 20.1 Implement /kraken slash command
    - Create `packages/cli/src/commands/kraken.ts`
    - Implement interactive provider selection (show menu when no args)
    - Implement direct query with prompt (/kraken <prompt>)
    - Add command aliases (/k, /release)
    - Integrate with KrakenManager
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ] 20.2 Write unit tests for /kraken command
    - Test command parsing
    - Test provider selection menu
    - Test direct query execution
    - Test command aliases
    - Test error handling (no providers configured)
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ] 20.3 Implement /kraken status subcommand
    - Display health status of all providers (table format)
    - Show remaining budget and session costs
    - Show last used provider and timestamp
    - Use existing UI components for table rendering
    - _Requirements: 7.3_

  - [ ] 20.4 Implement /kraken config subcommand
    - Open Kraken configuration file for editing
    - Use $EDITOR environment variable or default editor
    - Show config file path to user
    - _Requirements: 7.4_

  - [ ] 20.5 Implement /kraken history subcommand
    - Display recent Kraken usage (last 10 invocations)
    - Show costs and timestamps in table format
    - Show total session cost
    - _Requirements: 7.5_

- [ ] 21. UI Components
  - [ ] 21.1 Implement provider selection menu
    - Create interactive menu component using Ink
    - Display CLI and API providers separately (grouped)
    - Show availability status with checkmarks (✓/✗)
    - Handle keyboard navigation (arrow keys, enter, esc)
    - Disable unavailable providers
    - _Requirements: 4.1, 12.7_

  - [ ] 21.2 Implement confirmation dialog
    - Create confirmation dialog component using Ink
    - Display provider, model, context summary, and estimated cost
    - Handle user responses (Y/N/A keys)
    - Show clear instructions for each option
    - Use yellow border for warning style
    - _Requirements: 8.2_

  - [ ] 21.3 Implement Kraken status display
    - Create status table component using Ink
    - Display provider, status, model, and cost columns
    - Show session budget information (remaining/total)
    - Use color coding for status (green=available, red=unavailable)
    - _Requirements: 7.3, 12.7_

  - [ ] 21.4 Update status bar with Kraken indicator
    - Add Kraken status to main status bar component
    - Show Ready/Active/---/⚠️ states (🦑 emoji)
    - Update indicator based on Kraken state (available, active, budget exceeded)
    - Show current provider name when active
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 21.5 Implement Kraken response display
    - Create distinct visual style for Kraken responses (different from local)
    - Show provider name and model in header
    - Display tokens, cost, and time in footer
    - Use different color scheme to distinguish from local responses
    - _Requirements: 12.5, 12.6_

- [ ] 22. Security Implementation
  - [ ] 22.1 Implement API key redaction
    - Create redaction utility in `packages/core/src/kraken/security/keyManager.ts`
    - Redact API keys in logs (show first 4 and last 4 chars only)
    - Redact API keys in error messages
    - Validate API key formats (provider-specific patterns)
    - _Requirements: 14.3_

  - [ ] 22.2 Write property tests for API key redaction
    - **Property 41: API Key Redaction** - verify keys never appear in logs
    - Test redaction format (sk-****...****)
    - Test validation patterns for each provider
    - Test environment variable resolution
    - **Validates: Requirements 14.3**

  - [ ] 22.3 Implement HTTPS enforcement
    - Verify all API requests use HTTPS (in ApiClient)
    - Reject non-HTTPS connections with clear error
    - Validate URL protocol before making requests
    - _Requirements: 14.7_

  - [ ] 22.4 Write property tests for HTTPS enforcement
    - **Property 42: HTTPS Encryption** - verify only HTTPS allowed
    - Test HTTP URL rejection
    - Test HTTPS URL acceptance
    - Test error message clarity
    - **Validates: Requirements 14.7**

  - [ ] 22.5 Implement sensitive data warnings
    - Create PrivacyGuard in `packages/core/src/kraken/security/privacyGuard.ts`
    - Detect sensitive information in context (email, SSN, credit card, passwords, keys)
    - Warn users before sharing with external providers
    - Optionally sanitize context (redact sensitive data)
    - _Requirements: 14.2_

- [ ] 23. Error Handling Implementation
  - [ ] 23.1 Implement error message builders
    - Create error builders in `packages/core/src/kraken/errors/errorBuilder.ts`
    - Build errors for all categories (discovery, execution, network, auth, budget, config, context)
    - Include actionable resolution steps in each error
    - Add installation instructions for missing CLIs (npm install commands)
    - Add authentication instructions (CLI auth commands)
    - Provide documentation links for each error type
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 23.2 Write unit tests for error messages
    - Test all error message formats
    - Verify resolution steps are included
    - Test error code assignment
    - Test documentation link generation
    - Test recoverable vs non-recoverable errors
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [ ] 24. Cross-Platform Compatibility
  - [ ] 24.1 Implement platform-specific path resolution
    - Create path resolver utility in `packages/core/src/kraken/utils/pathResolver.ts`
    - Handle Windows vs Unix path separators (\ vs /)
    - Handle environment variable syntax differences (%VAR% vs $VAR)
    - Normalize paths for cross-platform consistency
    - _Requirements: 15.5, 15.6_

  - [ ] 24.2 Write property tests for path resolution
    - **Property 45: Path Resolution Cross-Platform** - verify correct separators used
    - Test Windows path handling
    - Test Unix path handling
    - Test environment variable expansion
    - Test path normalization
    - **Validates: Requirements 15.5**

  - [ ] 24.3 Test on all platforms
    - Test on Windows (subprocess execution, path resolution, CLI discovery)
    - Test on macOS (subprocess execution, path resolution, CLI discovery)
    - Test on Linux (subprocess execution, path resolution, CLI discovery)
    - Document platform-specific behaviors and limitations
    - _Requirements: 15.7_

- [ ] 25. Final Integration and Testing
  - [ ] 25.1 End-to-end integration tests
    - Test complete CLI Bridge flow (discovery → execution → parsing → response)
    - Test complete API Provider flow (auth → request → streaming → response)
    - Test context transfer flow (export → compress → send → import)
    - Test auto-escalation flow (trigger → select → escalate → return)
    - Test budget enforcement flow (check → track → enforce → reject)
    - Use real CLI tools and API endpoints (with test accounts)
    - _Requirements: All_

  - [ ] 25.2 Performance testing
    - Test with large contexts (10k+ tokens)
    - Test with multiple concurrent requests (if supported)
    - Test timeout handling under load
    - Measure latency overhead vs direct API calls
    - Profile memory usage
    - _Requirements: All_

  - [ ] 25.3 Documentation
    - Write user guide for Kraken feature (getting started, configuration, usage)
    - Document configuration options (all fields in kraken section)
    - Create troubleshooting guide (common errors and solutions)
    - Add API documentation (KrakenManager, providers, services)
    - Add examples (config files, CLI commands, hook scripts)
    - _Requirements: All_

- [ ] 26. Final Checkpoint
  - Ensure all tests pass (unit, property, integration)
  - Verify 80% line coverage and 75% branch coverage targets met
  - Verify all 45 correctness properties are tested
  - Review error messages and user experience
  - Test on all three platforms (Windows, macOS, Linux)
  - Ask the user for final review

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (45 total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- **Current Status**: No Kraken code exists yet - this is a greenfield implementation
- **Dependencies**: Requires existing OLLM CLI components (ProviderRegistry, SessionManager, CompressionService, HookSystem, PolicyEngine)
- **Testing Framework**: Use Vitest for unit tests, fast-check for property-based tests
- **Code Style**: Follow existing OLLM CLI patterns (TypeScript strict mode, ES modules, async/await)

## Implementation Order Rationale

The task order follows a bottom-up approach:
1. **Foundation** (Tasks 1-4): Type definitions and basic executors
2. **Core Services** (Tasks 5-11): API client, health checks, cost tracking, context transfer
3. **Provider Layer** (Tasks 12-14): Kraken provider adapters and manager
4. **Integration** (Tasks 15-19): Registry, config, hooks, policies
5. **User Interface** (Tasks 20-21): CLI commands and UI components
6. **Quality** (Tasks 22-26): Security, error handling, cross-platform, testing

This order ensures each layer has its dependencies ready before implementation.
