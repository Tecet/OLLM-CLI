# Implementation Plan: Multi-Provider Support (vLLM & OpenAI-Compatible)

## Overview

This implementation adds support for vLLM and OpenAI-compatible LLM backends to OLLM CLI through a 3-tier provider architecture. The implementation focuses on creating two new provider adapters (VllmProvider and OpenAICompatibleProvider), a shared SSE parser utility, and enhancing the provider registry with alias support. All changes maintain backward compatibility with existing Ollama setups.

## Tasks

- [ ] 1. Extend provider type system
  - Update `packages/core/src/provider/types.ts` to add `streamingFormat` field to ProviderAdapter interface
  - Add `extraBody` field to GenerationOptions interface for provider-specific options
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]\* 1.1 Write unit tests for type definitions
  - Test that streamingFormat accepts 'ndjson' and 'sse' values
  - Test that extraBody accepts arbitrary key-value pairs
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 2. Implement SSE parser utility
  - [ ] 2.1 Create `packages/ollm-bridge/src/utils/sseParser.ts`
    - Implement parseSSEStream function that parses Server-Sent Events from HTTP response
    - Handle partial data chunks with buffering
    - Extract and parse JSON from `data:` prefixed lines
    - Terminate on `[DONE]` marker
    - Skip malformed JSON lines gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]\* 2.2 Write unit tests for SSE parser
    - Test empty stream returns no results
    - Test single data line is parsed correctly
    - Test multiple data lines are parsed in order
    - Test [DONE] marker terminates stream
    - Test malformed JSON lines are skipped
    - Test partial chunks are buffered correctly
    - Test mixed valid/invalid lines are handled
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]\* 2.3 Write property test for SSE parser correctness
    - **Property 2: SSE Stream Parsing Correctness**
    - **Validates: Requirements 3.1, 3.2, 3.6**

  - [ ]\* 2.4 Write property test for SSE stream termination
    - **Property 3: SSE Stream Termination**
    - **Validates: Requirements 3.3**

  - [ ]\* 2.5 Write property test for malformed JSON resilience
    - **Property 4: SSE Malformed JSON Resilience**
    - **Validates: Requirements 3.4**

  - [ ]\* 2.6 Write property test for partial chunk buffering
    - **Property 5: SSE Partial Chunk Buffering**
    - **Validates: Requirements 3.5**

- [ ] 3. Implement VllmProvider
  - [ ] 3.1 Create `packages/ollm-bridge/src/provider/vllmProvider.ts`
    - Implement VllmProvider class with ProviderAdapter interface
    - Implement chatStream method using SSE parser
    - Implement listModels method querying /v1/models endpoint
    - Support vLLM-specific options via extraBody passthrough
    - Use /v1/chat/completions endpoint for requests
    - Include API key in Authorization header when configured
    - Default base URL to http://localhost:8000
    - Map OpenAI response format to ProviderEvent format
    - Handle network errors with descriptive messages
    - Handle authentication errors (401/403) with clear messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]\* 3.2 Write unit tests for VllmProvider
    - Test default base URL is http://localhost:8000
    - Test API key is included in Authorization header when configured
    - Test extraBody options are passed through to request
    - Test model listing returns parsed model data
    - Test network errors yield error events
    - Test authentication errors yield clear messages
    - Test abort signal terminates stream gracefully
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]\* 3.3 Write property test for provider interface compliance
    - **Property 1: Provider Interface Compliance**
    - **Validates: Requirements 1.1**

  - [ ]\* 3.4 Write property test for endpoint usage
    - **Property 6: OpenAI-Compatible Endpoint Usage**
    - **Validates: Requirements 1.3**

  - [ ]\* 3.5 Write property test for options passthrough
    - **Property 7: Provider-Specific Options Passthrough**
    - **Validates: Requirements 1.5, 11.1, 11.2**

  - [ ]\* 3.6 Write property test for authenticated request headers
    - **Property 8: Authenticated Request Headers**
    - **Validates: Requirements 1.6**

- [ ] 4. Implement OpenAICompatibleProvider
  - [ ] 4.1 Create `packages/ollm-bridge/src/provider/openaiCompatibleProvider.ts`
    - Implement OpenAICompatibleProvider class with ProviderAdapter interface
    - Implement chatStream method using SSE parser
    - Implement listModels method with graceful error handling
    - Support backend-specific header adaptation (LM Studio uses X-API-Key)
    - Use /v1/chat/completions endpoint for requests
    - Default base URL to http://localhost:1234
    - Map OpenAI response format to ProviderEvent format
    - Handle network errors with descriptive messages
    - Handle authentication errors (401/403) with clear messages
    - Return empty array on model listing errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]\* 4.2 Write unit tests for OpenAICompatibleProvider
    - Test default base URL is http://localhost:1234
    - Test LM Studio backend uses X-API-Key header
    - Test other backends use Authorization header
    - Test model listing returns empty array on error
    - Test backend hint affects header selection
    - Test network errors yield error events
    - Test authentication errors yield clear messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]\* 4.3 Write property test for model listing error handling
    - **Property 9: Model Listing Error Handling**
    - **Validates: Requirements 2.5, 9.4**

  - [ ]\* 4.4 Write property test for backend-specific header adaptation
    - **Property 10: Backend-Specific Header Adaptation**
    - **Validates: Requirements 2.6**

- [ ] 5. Enhance provider registry with alias support
  - [ ] 5.1 Update `packages/core/src/provider/registry.ts`
    - Add providerAliases map to store alias mappings
    - Implement registerAlias method for registering aliases
    - Implement resolve method that checks aliases first, then exact names
    - Return undefined for unregistered names/aliases
    - Maintain backward compatibility with existing get() method
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 5.2 Write unit tests for provider registry enhancements
    - Test alias registration and resolution
    - Test exact name resolution still works
    - Test unregistered names return undefined
    - Test backward compatibility with get() method
    - Test common alias mappings (lmstudio, localai, kobold)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 5.3 Write property test for alias resolution
    - **Property 11: Provider Registry Alias Resolution**
    - **Validates: Requirements 4.2**

  - [ ]\* 5.4 Write property test for not found behavior
    - **Property 12: Provider Registry Not Found Behavior**
    - **Validates: Requirements 4.4**

  - [ ]\* 5.5 Write property test for backward compatibility
    - **Property 13: Provider Registry Backward Compatibility**
    - **Validates: Requirements 4.5, 12.5**

- [ ] 6. Update package exports
  - Update `packages/ollm-bridge/src/index.ts` to export VllmProvider and OpenAICompatibleProvider
  - Export VllmProviderConfig and OpenAICompatibleProviderConfig types
  - Export parseSSEStream utility function
  - _Requirements: 1.1, 2.1_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update configuration schema
  - [ ] 8.1 Update `schemas/settings.schema.json`
    - Add provider field with enum: 'local', 'vllm', 'openai-compatible'
    - Add providers object with nested configuration for each provider type
    - Add vllm provider config with baseUrl and apiKey fields
    - Add openai-compatible provider config with baseUrl, apiKey, and backend fields
    - Add backend enum: 'lmstudio', 'localai', 'kobold', 'llamacpp', 'generic'
    - Support environment variable substitution syntax
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]\* 8.2 Write unit tests for configuration schema
    - Test schema accepts valid vllm configurations
    - Test schema accepts valid openai-compatible configurations
    - Test schema validates backend enum values
    - Test schema supports environment variable references
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]\* 8.3 Write property test for schema validation
    - **Property 14: Configuration Schema Validation**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]\* 8.4 Write property test for environment variable substitution
    - **Property 15: Environment Variable Substitution**
    - **Validates: Requirements 6.6**

- [ ] 9. Add environment variable support
  - [ ] 9.1 Update `packages/cli/src/config/env.ts`
    - Add VLLM_HOST environment variable with default http://localhost:8000
    - Add VLLM_API_KEY environment variable
    - Add OPENAI_COMPATIBLE_HOST environment variable with default http://localhost:1234
    - Add OPENAI_COMPATIBLE_API_KEY environment variable
    - Implement precedence: env vars override config file values
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]\* 9.2 Write unit tests for environment variable support
    - Test VLLM_HOST is recognized with correct default
    - Test VLLM_API_KEY is recognized
    - Test OPENAI_COMPATIBLE_HOST is recognized with correct default
    - Test OPENAI_COMPATIBLE_API_KEY is recognized
    - Test environment variables override config file values
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]\* 9.3 Write property test for configuration precedence
    - **Property 16: Configuration Precedence**
    - **Validates: Requirements 7.5**

- [ ] 10. Add CLI provider selection flags
  - [ ] 10.1 Update CLI argument parser
    - Add --provider flag accepting 'local', 'vllm', 'openai-compatible'
    - Add --host flag to override provider base URL
    - Add --api-key flag to provide authentication credentials
    - Implement precedence: CLI flags override env vars and config file
    - Default to 'local' provider when no provider is specified
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]\* 10.2 Write unit tests for CLI flags
    - Test --provider flag is recognized
    - Test --host flag overrides base URL
    - Test --api-key flag provides credentials
    - Test CLI flags override config file settings
    - Test default provider is 'local'
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]\* 10.3 Write property test for CLI flag precedence
    - **Property 17: CLI Flag Precedence**
    - **Validates: Requirements 8.4**

- [ ] 11. Implement comprehensive error handling
  - [ ] 11.1 Add error handling to all providers
    - Network errors yield descriptive error events
    - Authentication errors (401/403) yield clear messages
    - Unsupported operations return clear messages
    - Mid-stream errors yield partial content then error
    - Gracefully disable unsupported features
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.5_

  - [ ]\* 11.2 Write unit tests for error handling
    - Test network unreachable errors have descriptive messages
    - Test authentication errors indicate invalid credentials
    - Test unsupported operations return clear messages
    - Test mid-stream failures yield partial content
    - Test graceful feature degradation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.5_

  - [ ]\* 11.3 Write property test for network error messages
    - **Property 18: Network Error Messages**
    - **Validates: Requirements 9.1**

  - [ ]\* 11.4 Write property test for authentication error messages
    - **Property 19: Authentication Error Messages**
    - **Validates: Requirements 9.2**

  - [ ]\* 11.5 Write property test for unsupported operation messages
    - **Property 20: Unsupported Operation Messages**
    - **Validates: Requirements 9.3**

  - [ ]\* 11.6 Write property test for mid-stream error handling
    - **Property 21: Mid-Stream Error Handling**
    - **Validates: Requirements 9.5**

  - [ ]\* 11.7 Write property test for graceful feature degradation
    - **Property 23: Graceful Feature Degradation**
    - **Validates: Requirements 10.5**

- [ ] 12. Implement feature capability detection
  - [ ] 12.1 Add capability detection logic
    - Check for presence of optional methods (listModels, pullModel, deleteModel)
    - Report capabilities for each provider type
    - Enable/disable features based on capabilities
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]\* 12.2 Write unit tests for capability detection
    - Test VllmProvider reports guided decoding support
    - Test LocalProvider reports model management support
    - Test OpenAICompatibleProvider reports limited capabilities
    - Test capability detection for tool calling
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]\* 12.3 Write property test for feature capability detection
    - **Property 22: Feature Capability Detection**
    - **Validates: Requirements 10.4**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Verify backward compatibility
  - [ ] 14.1 Run existing LocalProvider tests
    - Verify all existing Ollama tests still pass
    - Verify NDJSON streaming format still works
    - Verify model management operations still work
    - Verify default provider behavior unchanged
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]\* 14.2 Write property test for backward compatibility
    - **Property 24: Backward Compatibility Preservation**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [ ] 15. Create integration tests with mock servers
  - [ ]\* 15.1 Create mock vLLM server for integration testing
    - Mock server responds with SSE format
    - Supports /v1/chat/completions endpoint
    - Supports /v1/models endpoint
    - Requires Bearer token authentication
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ]\* 15.2 Create mock LM Studio server for integration testing
    - Mock server responds with SSE format
    - Supports /v1/chat/completions endpoint
    - Requires X-API-Key authentication
    - Model listing may fail (404)
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.9_

  - [ ]\* 15.3 Create mock Ollama server for integration testing
    - Mock server responds with NDJSON format
    - Supports /api/chat endpoint
    - No authentication required
    - Supports model management endpoints
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]\* 15.4 Write integration tests for all provider types
    - Test successful chat streaming for each provider
    - Test authentication errors for each provider
    - Test network errors for each provider
    - _Requirements: 1.1, 2.1, 12.1_

- [ ] 16. Update documentation
  - Create setup guide for vLLM provider
  - Create setup guide for OpenAI-compatible backends (LM Studio, LocalAI, Kobold, llama.cpp)
  - Provide configuration examples for each provider
  - Create feature comparison matrix
  - Explain when to use each provider tier
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations each
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows with mock servers
- Backward compatibility is critical - existing Ollama setups must continue working
