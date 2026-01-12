# Implementation Plan: Services and Sessions

## Overview

This implementation plan breaks down the six core services into discrete, incremental coding tasks. Each service is implemented independently with its own tests, then integrated with the chat runtime. The implementation follows a bottom-up approach: build foundational services first (recording, sanitization), then build services that depend on them (compression, loop detection), and finally integrate everything.

## Tasks

- [x] 1. Set up service infrastructure and shared types
  - Create `packages/core/src/services/` directory structure
  - Define shared types and interfaces for all services
  - Set up test infrastructure with fast-check for property-based testing
  - Configure test utilities for file system mocking
  - _Requirements: All_
  - _Started: 2026-01-11 11:10_
  - _Completed: 2026-01-11 11:18_
  - _Duration: 8m_
  - _Credits: 5.36_

- [x] 1.1 Write unit tests for shared types
  - Test type validation and serialization
  - _Requirements: 2.1, 2.2, 2.3_
  - _Started: 2026-01-11 11:17_
  - _Completed: 2026-01-11 11:18_
  - _Duration: 1m_
  - _Credits: 0.20_

- [x] 2. Implement ChatRecordingService
  - [x] 2.1 Implement core session recording functionality
    - Create `chatRecordingService.ts` with session CRUD operations
    - Implement `createSession`, `recordMessage`, `recordToolCall` methods
    - Implement atomic file writes with temp file + rename pattern
    - Add in-memory session cache for current session
    - _Requirements: 1.1, 1.2, 1.3, 9.1_
  - _Started: 2026-01-11 11:26_
  - _Completed: 2026-01-11 11:29_
  - _Duration: 3m_
  - _Credits: 2.2_

  - [x] 2.2 Write property test for session persistence round-trip
    - **Property 1: Session persistence round-trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
    - _Started: 2026-01-11 11:30_
    - _Completed: 2026-01-11 12:14_
    - _Duration: 44m_
    - _Credits: 2.11_

  - [x] 2.3 Write property test for session file format completeness
    - **Property 2: Session file format completeness**
    - **Validates: Requirements 1.7, 1.8, 2.1, 2.2, 2.3**
    - _Started: 2026-01-11 12:15_
    - _Completed: 2026-01-11 12:17_
    - _Duration: 2m_
    - _Credits: 1.8_

  - [x] 2.4 Implement session retrieval and management
    - Implement `getSession`, `listSessions`, `deleteSession` methods
    - Add session summary generation
    - Implement session count limit enforcement
    - _Requirements: 1.4, 1.6, 9.4_
    - _Started: 2026-01-11 12:19_
    - _Completed: 2026-01-11 12:21_
    - _Duration: 2m_
    - _Credits: 3.91_

  - [x] 2.5 Write property test for session listing completeness
    - **Property 5: Session listing completeness**
    - **Validates: Requirements 1.4**
    - _Started: 2026-01-11 12:22_
    - _Completed: 2026-01-11 12:27_
    - _Duration: 5m_
    - _Credits: 4.57_

  - [x] 2.6 Write property test for session deletion
    - **Property 6: Session deletion removes file**
    - **Validates: Requirements 1.6**
    - _Started: 2026-01-11 12:29_
    - _Completed: 2026-01-11 12:33_
    - _Duration: 4m_
    - _Credits: 2.08_

  - [x] 2.7 Write property test for session count limit enforcement
    - **Property 8: Session count limit enforcement**
    - **Validates: Requirements 9.4**
    - _Started: 2026-01-11 12:37_
    - _Completed: 2026-01-11 12:56_
    - _Duration: 19m_
    - _Credits: 2.2_

  - [x] 2.8 Implement session lifecycle management
    - Add auto-save after each turn
    - Implement lastActivity timestamp updates
    - Add durability guarantees (flush to disk)
    - _Requirements: 9.2, 9.3, 9.5, 9.6_
    - _Started: 2026-01-11 13:00_
    - _Completed: 2026-01-11 13:06_
    - _Duration: 6m_
    - _Credits: 3.47_

  - [x] 2.9 Write property test for auto-save durability
    - **Property 7: Session auto-save durability**
    - **Validates: Requirements 9.3, 9.6**
    - _Started: 2026-01-11 13:11_
    - _Completed: 2026-01-11 13:23_
    - _Duration: 12m_
    - _Credits: 2.36_

  - [x] 2.10 Write property test for timestamp updates
    - **Property 9: Last activity timestamp updates**
    - **Validates: Requirements 9.5**
    - _Started: 2026-01-11 13:29_
    - _Completed: 2026-01-11 13:47_
    - _Duration: 18m_
    - _Credits: 4.3_

  - [x] 2.11 Write property tests for timestamp and UUID format validation
    - **Property 3: Timestamp format validity**
    - **Property 4: Session ID uniqueness and format**
    - **Validates: Requirements 2.4, 2.5, 1.7**
    - _Started: 2026-01-11 13:57_
    - _Completed: 2026-01-11 14:08_
    - _Duration: 11m_
    - _Credits: 6.2_

  - [x] 2.12 Write unit tests for error handling
    - Test write failure recovery
    - Test read failure handling
    - Test corrupted file recovery
    - _Requirements: 10.1, 10.2_
    - _Started: 2026-01-11 14:09_
    - _Completed: 2026-01-11 14:14_
    - _Duration: 5m_
    - _Credits: 4.66_

- [x] 3. Checkpoint - Ensure session recording tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-11 14:19_
  - _Completed: 2026-01-11 14:22_
  - _Duration: 3m_
  - _Credits: 0.8_

- [x] 4. Implement EnvironmentSanitizationService
  - [x] 4.1 Implement environment sanitization
    - Create `environmentSanitization.ts` with allow/deny list logic
    - Implement default allow list (PATH, HOME, USER, SHELL, TERM, LANG, LC_*)
    - Implement default deny patterns (*_KEY, *_SECRET, *_TOKEN, *_PASSWORD, *_CREDENTIAL, AWS_*, GITHUB_*)
    - Add pattern matching using picomatch
    - Add configuration support for custom rules
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_
  - _Started: 2026-01-11 14:24_
  - _Completed: 2026-01-11 14:28_
  - _Duration: 4m_
  - _Credits: 1.9_

  - [x] 4.2 Write property test for deny pattern filtering
    - **Property 25: Deny pattern filtering**
    - **Validates: Requirements 7.5**
    - _Started: 2026-01-11 14:30_
    - _Completed: 2026-01-11 14:34_
    - _Duration: 4m_
    - _Credits: 4.12_

  - [x] 4.3 Write property test for allow list preservation
    - **Property 26: Allow list preservation**
    - **Validates: Requirements 7.6**
    - _Started: 2026-01-11 14:39_
    - _Completed: 2026-01-11 14:41_
    - _Duration: 2m_
    - _Credits: 1.9_

  - [x] 4.4 Write property test for sanitization completeness
    - **Property 27: Sanitization completeness**
    - **Validates: Requirements 7.5, 7.6**
    - _Started: 2026-01-11 14:44_
    - _Completed: 2026-01-11 14:47_
    - _Duration: 3m_
    - _Credits: 1.42_

  - [x] 4.5 Write unit tests for default configuration
    - Test default allow list includes core variables
    - Test default deny patterns include sensitive patterns
    - _Requirements: 7.3, 7.4_
    - _Started: 2026-01-11 14:50_
    - _Completed: 2026-01-11 14:55_
    - _Duration: 5m_
    - _Credits: 1.66_

  - [x] 4.6 Write unit tests for error handling
    - Test invalid pattern handling
    - Test configuration error fallback
    - _Requirements: 10.5_
    - _Started: 2026-01-11 14:57_
    - _Completed: 2026-01-11 15:07_
    - _Duration: 10m_
    - _Credits: 5.59_

- [x] 5. Implement FileDiscoveryService
  - [x] 5.1 Implement file discovery
    - Create `fileDiscoveryService.ts` with directory traversal
    - Use fdir for fast async directory scanning
    - Implement ignore pattern loading (.ollmignore, .gitignore)
    - Add built-in ignore patterns (node_modules, .git, dist, build)
    - Implement depth limit enforcement
    - Add result caching
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Started: 2026-01-11 15:08_
  - _Completed: 2026-01-11 15:18_
  - _Duration: 10m_
  - _Credits: 4.96_

  - [x] 5.2 Write property test for ignore pattern respect
    - **Property 22: Ignore pattern respect**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - _Started: 2026-01-11 15:19_
    - _Completed: 2026-01-11 15:28_
    - _Duration: 9m_
    - _Credits: 8.52_

  - [x] 5.3 Write property test for depth limit enforcement
    - **Property 23: Depth limit enforcement**
    - **Validates: Requirements 6.5**
    - _Started: 2026-01-11 15:30_
    - _Completed: 2026-01-11 15:35_
    - _Duration: 5m_
    - _Credits: 2.09_

  - [x] 5.4 Implement file watching
    - Add file system change watching
    - Implement callback invocation on changes
    - _Requirements: 6.7, 6.8_
    - _Started: 2026-01-11 15:39_
    - _Completed: 2026-01-11 15:49_
    - _Duration: 10m_
    - _Credits: 2.76_

  - [x] 5.5 Write property test for file change notification
    - **Property 24: File change notification**
    - **Validates: Requirements 6.8**
    - _Started: 2026-01-11 15:51_
    - _Completed: 2026-01-11 16:17_
    - _Duration: 26m_
    - _Credits: 5.23_

  - [x] 5.6 Write unit tests for error handling
    - Test permission error handling
    - Test invalid pattern handling
    - Test symlink loop detection
    - _Requirements: 10.4_
    - _Started: 2026-01-11 16:33_
    - _Completed: 2026-01-11 16:45_
    - _Duration: 12m_
    - _Credits: 2.24_

- [x] 6. Checkpoint - Ensure environment and file discovery tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-11 16:51_
  - _Completed: 2026-01-11 16:56_
  - _Duration: 5m_
  - _Credits: 0.63_

- [x] 7. Implement ContextManager
  - [x] 7.1 Implement context management
    - Create `contextManager.ts` with context entry storage
    - Implement `addContext`, `removeContext`, `clearContext` methods
    - Implement `getContext`, `getSystemPromptAdditions` methods
    - Add priority-based ordering
    - Support multiple sources (hook, extension, user, system)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_
  - _Started: 2026-01-11 17:03_
  - _Completed: 2026-01-11 17:18_
  - _Duration: 15m_
  - _Credits: 2.14_

  - [x] 7.2 Write property test for context add-remove round-trip
    - **Property 18: Context add-remove round-trip**
    - **Validates: Requirements 5.2**
    - _Started: 2026-01-11 17:25_
    - _Completed: 2026-01-11 17:35_
    - _Duration: 10m_
    - _Credits: 2.17_

  - [x] 7.3 Write property test for context retrieval completeness
    - **Property 19: Context retrieval completeness**
    - **Validates: Requirements 5.3**
    - _Started: 2026-01-11 17:38_
    - _Completed: 2026-01-11 17:40_
    - _Duration: 2m_
    - _Credits: 2.34_

  - [x] 7.4 Write property test for context inclusion in system prompt
    - **Property 20: Context inclusion in system prompt**
    - **Validates: Requirements 5.4**
    - _Started: 2026-01-11 17:41_
    - _Completed: 2026-01-11 17:46_
    - _Duration: 5m_
    - _Credits: 1.83_

  - [x] 7.5 Write property test for context priority ordering
    - **Property 21: Context priority ordering**
    - **Validates: Requirements 5.5, 5.8**
    - _Started: 2026-01-11 18:01_
    - _Completed: 2026-01-11 18:04_
    - _Duration: 3m_
    - _Credits: 1.74_

  - [x] 7.6 Write unit tests for multiple sources
    - Test context from different sources
    - Test source filtering
    - _Requirements: 5.6_
    - _Started: 2026-01-11 18:10_
    - _Completed: 2026-01-11 18:11_
    - _Duration: 1m_
    - _Credits: 1.07_

- [x] 8. Implement ChatCompressionService
  - [x] 8.1 Implement compression infrastructure
    - Create `chatCompressionService.ts` with compression strategies
    - Implement `shouldCompress` method with threshold checking
    - Add token counting utilities
    - Implement system prompt preservation logic
    - Implement recent message preservation logic
    - _Requirements: 3.1, 3.2, 3.3, 3.7_
  - _Started: 2026-01-11 18:12_
  - _Completed: 2026-01-11 18:15_
  - _Duration: 3m_
  - _Credits: 2.33_

  - [x] 8.2 Write property test for compression trigger threshold
    - **Property 10: Compression trigger threshold**
    - **Validates: Requirements 3.1, 3.7**
    - _Started: 2026-01-11 18:16_
    - _Completed: 2026-01-11 18:19_
    - _Duration: 3m_
    - _Credits: 2.56_

  - [x] 8.3 Implement truncate compression strategy
    - Remove oldest messages until under target token count
    - Preserve system prompt and recent messages
    - _Requirements: 3.4, 3.5_
    - _Started: 2026-01-11 18:42_
    - _Completed: 2026-01-11 18:47_
    - _Duration: 5m_
    - _Credits: 3.27_

  - [x] 8.4 Implement summarize compression strategy
    - Use LLM to generate summary of older messages
    - Replace old messages with summary message
    - Preserve system prompt and recent messages
    - _Requirements: 3.4, 3.5_
    - _Started: 2026-01-11 18:49_
    - _Completed: 2026-01-11 19:22_
    - _Duration: 33m_
    - _Credits: 9.3_

  - [x] 8.5 Implement hybrid compression strategy
    - Combine summarize and truncate strategies
    - Summarize middle messages, truncate oldest, preserve recent
    - _Requirements: 3.5, 3.6_
    - _Started: 2026-01-11 19:23_
    - _Completed: 2026-01-11 19:30_
    - _Duration: 7m_
    - _Credits: 3.21_

  - [x] 8.6 Write property test for compression preserves critical messages
    - **Property 11: Compression preserves critical messages**
    - **Validates: Requirements 3.2, 3.3, 3.6**
    - _Started: 2026-01-11 19:33_
    - _Completed: 2026-01-11 19:36_
    - _Duration: 3m_
    - _Credits: 2.31_

  - [x] 8.7 Write property test for compression reduces token count
    - **Property 12: Compression reduces token count**
    - **Validates: Requirements 3.4**
    - _Started: 2026-01-11 19:38_
    - _Completed: 2026-01-11 19:40_
    - _Duration: 2m_
    - _Credits: 1.92_

  - [x] 8.8 Implement compression metadata tracking
    - Increment compressionCount after each compression
    - Update session metadata
    - _Requirements: 3.8_
    - _Started: 2026-01-11 19:41_
    - _Completed: 2026-01-11 19:47_
    - _Duration: 6m_
    - _Credits: 3.68_

  - [x] 8.9 Write property test for compression count increments
    - **Property 13: Compression count increments**
    - **Validates: Requirements 3.8**
    - _Started: 2026-01-11 19:54_
    - _Completed: 2026-01-11 20:00_
    - _Duration: 6m_
    - _Credits: 2.62_

  - [x] 8.10 Write unit tests for each strategy
    - Test truncate strategy behavior
    - Test summarize strategy behavior
    - Test hybrid strategy behavior
    - _Requirements: 3.5_
    - _Started: 2026-01-11 20:03_
    - _Completed: 2026-01-11 20:18_
    - _Duration: 15m_
    - _Credits: 1.56_

  - [x] 8.11 Write unit tests for error handling
    - Test compression failure recovery
    - Test model unavailable fallback
    - _Requirements: 10.3_
    - _Started: 2026-01-11 20:37_
    - _Completed: 2026-01-11 21:00_
    - _Duration: 23m_
    - _Credits: 3.11_

- [x] 9. Checkpoint - Ensure context and compression tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Started: 2026-01-11 21:04_
  - _Completed: 2026-01-11 21:21_
  - _Duration: 17m_
  - _Credits: 0.67_

- [x] 10. Implement LoopDetectionService
  - [x] 10.1 Implement loop detection infrastructure
    - Create `loopDetectionService.ts` with pattern tracking
    - Implement turn counter
    - Implement tool call history tracking (with argument hashing)
    - Implement output history tracking
    - Add configuration support (maxTurns, repeatThreshold)
    - _Requirements: 4.4, 4.5, 4.6_
  - _Started: 2026-01-11 21:23_
  - _Completed: 2026-01-11 21:27_
  - _Duration: 4m_
  - _Credits: 1.95_

  - [x] 10.2 Write property test for repeated tool call detection
    - **Property 14: Repeated tool call detection**
    - **Validates: Requirements 4.1, 4.4**
    - _Started: 2026-01-11 21:30_
    - _Completed: 2026-01-11 21:37_
    - _Duration: 7m_
    - _Credits: 4.22_

  - [x] 10.3 Write property test for repeated output detection
    - **Property 15: Repeated output detection**
    - **Validates: Requirements 4.2, 4.5**
    - _Started: 2026-01-11 21:39_
    - _Completed: 2026-01-11 21:44_
    - _Duration: 5m_
    - _Credits: 1.5_

  - [x] 10.4 Write property test for turn limit detection
    - **Property 16: Turn limit detection**
    - **Validates: Requirements 4.3**
    - _Started: 2026-01-11 21:46_
    - _Completed: 2026-01-11 21:49_
    - _Duration: 3m_
    - _Credits: 1.65_

  - [x] 10.5 Implement loop event emission and execution stopping
    - Emit loop event with pattern details
    - Provide method to check if loop detected
    - Add reset functionality
    - _Requirements: 4.7, 4.8_
    - _Started: 2026-01-11 21:52_
    - _Completed: 2026-01-11 22:14_
    - _Duration: 22m_
    - _Credits: 5.26_

  - [x] 10.6 Write property test for loop detection stops execution
    - **Property 17: Loop detection stops execution**
    - **Validates: Requirements 4.7, 4.8**
    - _Started: 2026-01-11 22:21_
    - _Completed: 2026-01-11 22:27_
    - _Duration: 6m_
    - _Credits: 2.0_

  - [x] 10.7 Write unit tests for configuration
    - Test default values
    - Test custom configuration
    - _Requirements: 4.6_
    - _Started: 2026-01-11 22:28_
    - _Completed: 2026-01-11 22:37_
    - _Duration: 9m_
    - _Credits: 2.23_

- [-] 11. Implement service configuration loading
  - [x] 11.1 Add service configuration schema
    - Define YAML schema for all service configurations
    - Add to existing config system
    - Implement configuration validation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  - _Started: 2026-01-11 22:45_
  - _Completed: 2026-01-11 23:01_
  - _Duration: 16m_
  - _Credits: 2.8_

  - [x] 11.2 Write unit tests for configuration loading
    - Test default values
    - Test custom configuration
    - Test configuration validation
    - _Started: 2026-01-11 23:43_
    - _Completed: 2026-01-11 23:46_
    - _Duration: 3m_
    - _Credits: 1.97_

- [x] 12. Integrate services with chat runtime
  - [x] 12.1 Wire ChatRecordingService into chatClient
    - Initialize service on chat start
    - Record messages and tool calls during turns
    - Save session on exit
    - _Requirements: 1.1, 1.2, 1.3, 9.2_
  - _Started: 2026-01-11 23:47_
  - _Completed: 2026-01-11 23:55_
  - _Duration: 8m_
  - _Credits: 4.12_

  - [x] 12.2 Wire ChatCompressionService into chatClient
    - Check compression threshold before each turn
    - Trigger compression when needed
    - Update message history with compressed messages
    - _Requirements: 3.1_
    - _Started: 2026-01-11 23:58_
    - _Completed: 2026-01-12 00:08_
    - _Duration: 10m_
    - _Credits: 8.15_

  - [x] 12.3 Wire LoopDetectionService into chatClient
    - Track turns, tool calls, and outputs
    - Check for loops before each turn
    - Stop execution and notify user on loop detection
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8_
    - _Started: 2026-01-12 00:09_
    - _Completed: 2026-01-12 00:21_
    - _Duration: 12m_
    - _Credits: 11.31_

  - [x] 12.4 Wire ContextManager into chatClient
    - Inject context additions into system prompt
    - Support context from hooks and extensions
    - _Requirements: 5.7_
    - _Started: 2026-01-12 00:24_
    - _Completed: 2026-01-12 00:33_
    - _Duration: 9m_
    - _Credits: 7.16_

  - [x] 12.5 Wire EnvironmentSanitizationService into shell tool
    - Sanitize environment before shell execution
    - Apply to all shell-based tools
    - _Requirements: 7.8_
    - _Started: 2026-01-12 00:35_
    - _Completed: 2026-01-12 01:04_
    - _Duration: 29m_
    - _Credits: 11.15_

  - [x] 12.6 Write integration tests for service interactions
    - Test session recording + compression
    - Test loop detection + chat runtime
    - Test context manager + chat runtime
    - Test environment sanitization + shell tool
    - _Started: 2026-01-12 01:09_
    - _Completed: 2026-01-12 01:24_
    - _Duration: 15m_
    - _Credits: 10.36_

- [x] 13. Implement sensitive data filtering in error messages
  - [x] 13.1 Add error message sanitization
    - Create utility to scan error messages for sensitive patterns
    - Apply to all service error logging
    - _Requirements: 10.7_
  - _Started: 2026-01-12 01:26_
  - _Completed: 2026-01-12 01:38_
  - _Duration: 12m_
  - _Credits: 7.19_

  - [x] 13.2 Write property test for sensitive data exclusion
    - **Property 28: Sensitive data exclusion from errors**
    - **Validates: Requirements 10.7**
    - _Started: 2026-01-12 02:38_
    - _Completed: 2026-01-12 03:05_
    - _Duration: 27m_
    - _Credits: 6.35_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify all property tests pass with 100+ iterations
  - Verify all integration tests pass
  - Ask the user if questions arise.
  - _Started: 2026-01-12 02:39_
  - _Completed: 2026-01-12 03:05_
  - _Duration: 26m_
  - _Credits: 10.04_

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify service interactions
- All tests use fast-check library for property-based testing
- Test tags format: `Feature: services-sessions, Property N: [property text]`
