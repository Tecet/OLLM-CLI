# Implementation Plan: Model Management and Routing

## Overview

This implementation plan breaks down the Model Management and Routing system into discrete, incremental tasks. Each task builds on previous work and includes testing to validate functionality early. The plan follows a bottom-up approach, implementing core data structures and services first, then building higher-level features on top.

## Tasks

- [ ] 1. Implement Model Database and Routing Profiles
  - Create model database with pattern matching for known model families
  - Define routing profiles (fast, general, code, creative) with selection criteria
  - Implement lookup functions with wildcard support and safe defaults
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 1.1 Write property tests for Model Database
  - **Property 13: Known model lookup**
  - **Property 14: Unknown model defaults**
  - **Property 15: Wildcard pattern matching**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 2. Implement Model Router
  - [ ] 2.1 Create ModelRouter class with selection algorithm
    - Implement filtering by context window and capabilities
    - Implement scoring by preferred families
    - Implement fallback chain with circular detection
    - Support configuration overrides
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 6.5, 6.6_

- [ ] 2.2 Write property tests for Model Router
  - **Property 9: Profile-based model selection**
  - **Property 10: Preferred family prioritization**
  - **Property 11: Fallback profile usage**
  - **Property 12: Configuration override precedence**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 6.5, 6.6**

- [ ] 2.3 Write unit tests for routing profiles
  - Test that fast, general, code, and creative profiles exist
  - Test profile metadata and requirements
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 3. Implement Model Management Service
  - [ ] 3.1 Create ModelManagementService class with core operations
    - Implement listModels with caching and TTL
    - Implement pullModel with progress events and cancellation
    - Implement deleteModel with unload-first logic
    - Implement showModel for detailed info
    - Add error handling with descriptive messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [ ] 3.2 Write property tests for Model Management Service
  - **Property 1: Model list retrieval**
  - **Property 2: Model list caching**
  - **Property 3: Cache invalidation after mutations**
  - **Property 4: Offline operation with cache**
  - **Property 5: Progress event emission**
  - **Property 6: Pull cancellation**
  - **Property 7: Loaded model unload before deletion**
  - **Property 8: Error handling consistency**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 4.3**

- [ ] 3.3 Implement keep-alive functionality
  - Add keepModelLoaded and unloadModel methods
  - Implement periodic keep-alive requests
  - Track last-used timestamps
  - Support configurable timeout
  - Add getLoadedModels status method
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 20.1, 20.2, 20.3, 20.4_

- [ ] 3.4 Write property tests for keep-alive
  - **Property 38: Keep-alive request sending**
  - **Property 39: Last-used timestamp tracking**
  - **Property 40: Idle timeout unloading**
  - **Property 41: Keep-alive disable respect**
  - **Property 42: Loaded model status reporting**
  - **Validates: Requirements 19.1, 19.2, 19.3, 20.1, 20.2, 20.3, 20.4**

- [ ] 4. Checkpoint - Ensure model management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Memory Service
  - [ ] 5.1 Create MemoryService class with CRUD operations
    - Implement remember, recall, search, forget, listAll methods
    - Implement JSON file persistence (~/.ollm/memory.json)
    - Track access count and timestamps
    - Support categorization (fact, preference, context)
    - Mark source (user, llm, system)
    - _Requirements: 11.1, 11.2, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.3, 13.4_

- [ ] 5.2 Write property tests for Memory Service persistence
  - **Property 20: Memory persistence round-trip**
  - **Property 23: Memory metadata tracking**
  - **Property 24: Memory search**
  - **Property 25: Memory deletion**
  - **Property 26: Memory listing**
  - **Property 28: Memory categorization**
  - **Validates: Requirements 11.1, 11.2, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.4**

- [ ] 5.3 Implement system prompt injection
  - Implement getSystemPromptAddition method
  - Respect token budget (default 500 tokens)
  - Prioritize by access count and recency
  - Format as key-value pairs
  - _Requirements: 11.3, 11.4_

- [ ] 5.4 Write property tests for system prompt injection
  - **Property 21: System prompt injection with budget**
  - **Property 22: Memory prioritization by recency**
  - **Validates: Requirements 11.3, 11.4**

- [ ] 5.5 Create remember tool for LLM
  - Register remember tool in tool registry
  - Integrate with MemoryService
  - Mark source as 'llm' for tool-initiated memories
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 5.6 Write unit tests for remember tool
  - Test tool registration
  - Test LLM source marking
  - **Property 27: LLM memory source marking**
  - **Validates: Requirements 13.1, 13.2, 13.3**

- [ ] 6. Implement Template Service
  - [ ] 6.1 Create TemplateService class with template management
    - Implement loadTemplates from user and workspace directories
    - Parse YAML template definitions
    - Validate template structure
    - Cache parsed templates
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [ ] 6.2 Write property tests for template loading
  - **Property 32: Template loading from directories**
  - **Property 33: Template metadata preservation**
  - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**

- [ ] 6.3 Implement variable substitution
  - Support {variable_name} syntax
  - Support {variable_name:default_value} syntax
  - Handle required vs optional variables
  - Validate required variables are provided
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 6.4 Write property tests for variable substitution
  - **Property 34: Variable substitution**
  - **Property 35: Default value usage**
  - **Property 36: Required variable validation**
  - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

- [ ] 6.5 Implement template CRUD operations
  - Implement listTemplates, getTemplate, createTemplate, deleteTemplate
  - Persist new templates to user directory
  - Handle workspace override of user templates
  - _Requirements: 18.1, 18.2, 18.3_

- [ ] 6.6 Write property tests for template persistence
  - **Property 37: Template persistence**
  - **Validates: Requirements 18.3**

- [ ] 7. Checkpoint - Ensure memory and template tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Comparison Service
  - [ ] 8.1 Create ComparisonService class
    - Implement compare method with parallel execution
    - Collect response text, token count, latency, tokens/second
    - Handle individual model failures gracefully
    - Support cancellation via AbortController
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 15.2, 15.3_

- [ ] 8.2 Write property tests for Comparison Service
  - **Property 29: Parallel model execution**
  - **Property 30: Comparison result structure**
  - **Property 31: Partial failure handling**
  - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 15.2, 15.3**

- [ ] 9. Implement Project Profile Service
  - [ ] 9.1 Create ProjectProfileService class with detection
    - Implement detectProfile with file-based detection
    - Support TypeScript, Python, Rust, Go detection
    - Implement loadProfile from .ollm/project.yaml
    - Define built-in profiles (typescript, python, rust, go, documentation)
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 9.2 Write property tests for project detection
  - **Property 43: Project type detection**
  - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5**

- [ ] 9.3 Write unit tests for built-in profiles
  - Test that TypeScript, Python, Rust, Go, and documentation profiles exist
  - Test profile metadata and default settings
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 9.4 Implement profile application
  - Implement applyProfile to merge settings
  - Support project settings precedence over global
  - Apply model, system prompt, tool restrictions
  - Support manual profile override
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 24.4_

- [ ] 9.5 Write property tests for profile application
  - **Property 44: Project settings precedence**
  - **Property 45: Profile setting application**
  - **Property 46: Manual profile override**
  - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 24.4**

- [ ] 9.6 Implement project initialization
  - Implement initializeProject to create .ollm/project.yaml
  - Support profile selection
  - Write configuration file with profile settings
  - _Requirements: 24.3_

- [ ] 9.7 Write property tests for project initialization
  - **Property 47: Project initialization**
  - **Validates: Requirements 24.3**

- [ ] 10. Implement Configuration and Options
  - [ ] 10.1 Extend settings schema
    - Add model management options
    - Add routing configuration
    - Add keep-alive settings
    - Add memory settings
    - Add template directories
    - Add project profile settings
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10.2 Write property tests for options validation
  - **Property 17: Options validation**
  - **Property 18: Generation parameter support**
  - **Validates: Requirements 9.1, 9.2, 9.5**

- [ ] 10.3 Implement environment variable mapping
  - Map OLLM_MODEL, OLLM_TEMPERATURE, OLLM_MAX_TOKENS, OLLM_CONTEXT_SIZE
  - Implement precedence: env vars > config file
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 10.4 Write property tests for environment variable precedence
  - **Property 19: Environment variable precedence**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [ ] 11. Integrate with Token Limits
  - [ ] 11.1 Update token estimation to use Model Database
    - Query Model_Database for context window limits
    - Use safe defaults for unknown models
    - Trigger compression when approaching limits
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 11.2 Write property tests for token limit enforcement
  - **Property 16: Token limit enforcement**
  - **Validates: Requirements 8.1, 8.2**

- [ ] 12. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Add CLI Commands
  - [ ] 13.1 Add model management commands
    - /model list - List available models
    - /model pull <name> - Download a model
    - /model delete <name> - Remove a model
    - /model info <name> - Show model details
    - /model keep <name> - Keep model loaded
    - /model unload <name> - Unload model

- [ ] 13.2 Add memory commands
    - /memory list - Show all memories
    - /memory add <key> <value> - Add memory
    - /memory forget <key> - Remove memory
    - /memory clear - Clear all memories

- [ ] 13.3 Add template commands
    - /template list - Show available templates
    - /template use <name> [vars...] - Use a template
    - /template create <name> - Create new template

- [ ] 13.4 Add comparison command
    - /compare "<prompt>" <model1> <model2> [model3] - Compare models

- [ ] 13.5 Add project commands
    - /project detect - Auto-detect project type
    - /project use <profile> - Select profile
    - /project init - Initialize project config

- [ ] 14. Add UI Components
  - [ ] 14.1 Create ComparisonView component
    - Display responses side-by-side
    - Show performance metrics (tokens/sec, latency)
    - Allow selection of preferred response
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 14.2 Update status bar
    - Show currently loaded models
    - Show active project profile
    - _Requirements: 20.4_

- [ ] 14.3 Write unit tests for UI components
  - Test ComparisonView rendering
  - Test status bar updates

- [ ] 15. Integration and Documentation
  - [ ] 15.1 Wire all services together
    - Register services in dependency injection container
    - Connect Model Router to Model Management Service
    - Connect Memory Service to system prompt generation
    - Connect Template Service to command execution
    - Connect Project Profile Service to configuration

- [ ] 15.2 Add integration tests
    - Test full model lifecycle (list, pull, use, delete)
    - Test routing with real model database
    - Test memory persistence across restarts
    - Test template loading and execution
    - Test project profile detection and application

- [ ] 15.3 Update documentation
    - Document model management commands
    - Document memory system usage
    - Document template creation and usage
    - Document project profiles
    - Document configuration options

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- All services follow dependency injection pattern for testability
- Configuration uses JSON schema validation
- Error messages are descriptive with remediation guidance
