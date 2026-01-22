# Requirements Document: Multi-Provider Support (vLLM & OpenAI-Compatible)

## Introduction

This specification defines the requirements for extending OLLM CLI's provider system to support multiple LLM backends beyond the existing Ollama integration. The system will implement a 3-tier provider strategy: Tier 1 (Ollama - existing), Tier 2 (vLLM - high-performance production), and Tier 3 (OpenAI-Compatible - universal fallback for LM Studio, LocalAI, Kobold, etc.).

## Glossary

- **Provider**: An adapter that translates between OLLM CLI's internal format and a specific LLM backend's API
- **LocalProvider**: Existing Tier 1 provider for Ollama backend
- **VllmProvider**: New Tier 2 provider for vLLM backend with high-performance features
- **OpenAICompatibleProvider**: New Tier 3 provider supporting any OpenAI-compatible API
- **SSE**: Server-Sent Events, a streaming format used by OpenAI-compatible APIs
- **NDJSON**: Newline-Delimited JSON, a streaming format used by Ollama
- **Provider_Registry**: Central registry managing all available providers
- **Backend**: The actual LLM server software (Ollama, vLLM, LM Studio, etc.)
- **Guided_Decoding**: vLLM-specific feature for constraining output to JSON schemas or regex patterns
- **Tool_Calling**: Ability for LLM to invoke external functions/tools during generation

## Requirements

### Requirement 1: vLLM Provider Implementation

**User Story:** As a developer, I want to use vLLM as my LLM backend, so that I can achieve maximum throughput and leverage vLLM-specific features for production deployments.

#### Acceptance Criteria

1. THE VllmProvider SHALL implement the ProviderAdapter interface
2. WHEN streaming chat responses, THE VllmProvider SHALL parse Server-Sent Events format correctly
3. WHEN making requests, THE VllmProvider SHALL use the OpenAI-compatible endpoint `/v1/chat/completions`
4. WHEN listing models, THE VllmProvider SHALL query the `/v1/models` endpoint
5. WHERE vLLM-specific features are requested, THE VllmProvider SHALL support guided_json, guided_regex, guided_choice, min_tokens, presence_penalty, frequency_penalty, best_of, use_beam_search, and skip_special_tokens options
6. WHEN authentication is configured, THE VllmProvider SHALL include API key in request headers
7. THE VllmProvider SHALL default to base URL `http://localhost:8000`

### Requirement 2: OpenAI-Compatible Provider Implementation

**User Story:** As a user, I want to connect to any OpenAI-compatible LLM server, so that I can use my preferred backend (LM Studio, LocalAI, Kobold, llama.cpp, etc.) without code changes.

#### Acceptance Criteria

1. THE OpenAICompatibleProvider SHALL implement the ProviderAdapter interface
2. WHEN streaming chat responses, THE OpenAICompatibleProvider SHALL parse Server-Sent Events format correctly
3. WHEN making requests, THE OpenAICompatibleProvider SHALL use the standard OpenAI endpoint `/v1/chat/completions`
4. WHEN listing models, THE OpenAICompatibleProvider SHALL attempt to query the `/v1/models` endpoint
5. IF model listing fails, THEN THE OpenAICompatibleProvider SHALL handle the error gracefully
6. WHERE backend-specific quirks exist, THE OpenAICompatibleProvider SHALL adapt headers and request format accordingly
7. WHEN backend is LM Studio, THE OpenAICompatibleProvider SHALL use `X-API-Key` header instead of `Authorization` header
8. THE OpenAICompatibleProvider SHALL support configurable base URL with default `http://localhost:1234`
9. WHEN authentication is configured, THE OpenAICompatibleProvider SHALL include API key in appropriate headers

### Requirement 3: SSE Stream Parsing Utility

**User Story:** As a developer, I want a reusable SSE parser, so that both vLLM and OpenAI-compatible providers can share streaming logic without duplication.

#### Acceptance Criteria

1. THE SSE_Parser SHALL parse Server-Sent Events from HTTP response streams
2. WHEN encountering `data:` prefixed lines, THE SSE_Parser SHALL extract and parse JSON content
3. WHEN encountering `[DONE]` marker, THE SSE_Parser SHALL terminate the stream
4. IF JSON parsing fails for a line, THEN THE SSE_Parser SHALL skip that line and continue
5. THE SSE_Parser SHALL handle partial data chunks and buffer incomplete lines
6. THE SSE_Parser SHALL yield parsed JSON objects as an async iterable

### Requirement 4: Provider Registry Enhancement

**User Story:** As a user, I want to select providers by name or alias, so that I can easily switch between backends using familiar names.

#### Acceptance Criteria

1. THE Provider_Registry SHALL support registering provider aliases
2. WHEN resolving a provider name, THE Provider_Registry SHALL check aliases first, then exact names
3. THE Provider_Registry SHALL map common backend names to appropriate providers (e.g., 'lmstudio' → 'openai-compatible')
4. WHEN a provider is not found, THE Provider_Registry SHALL return undefined
5. THE Provider_Registry SHALL maintain backward compatibility with existing provider resolution

### Requirement 5: Provider Type System Extension

**User Story:** As a developer, I want provider metadata to include streaming format information, so that the system can correctly parse responses from different backends.

#### Acceptance Criteria

1. THE ProviderAdapter interface SHALL include an optional streamingFormat field
2. THE streamingFormat field SHALL accept values 'ndjson' or 'sse'
3. THE GenerationOptions interface SHALL include an extraBody field for provider-specific options
4. THE extraBody field SHALL accept arbitrary key-value pairs as Record<string, unknown>

### Requirement 6: Configuration Schema Updates

**User Story:** As a user, I want to configure provider settings in my config file, so that I can specify base URLs, API keys, and backend hints without command-line flags.

#### Acceptance Criteria

1. THE configuration schema SHALL include a provider field with enum values: 'local', 'vllm', 'openai-compatible'
2. THE configuration schema SHALL include a providers object with nested configuration for each provider type
3. WHEN configuring vllm provider, THE schema SHALL accept baseUrl and apiKey fields
4. WHEN configuring openai-compatible provider, THE schema SHALL accept baseUrl, apiKey, and backend fields
5. THE backend field SHALL accept enum values: 'lmstudio', 'localai', 'kobold', 'llamacpp', 'generic'
6. THE configuration SHALL support environment variable substitution for sensitive values

### Requirement 7: Environment Variable Support

**User Story:** As a user, I want to configure providers via environment variables, so that I can avoid storing sensitive API keys in config files.

#### Acceptance Criteria

1. THE system SHALL recognize VLLM_HOST environment variable with default `http://localhost:8000`
2. THE system SHALL recognize VLLM_API_KEY environment variable for authentication
3. THE system SHALL recognize OPENAI_COMPATIBLE_HOST environment variable with default `http://localhost:1234`
4. THE system SHALL recognize OPENAI_COMPATIBLE_API_KEY environment variable for authentication
5. WHEN both environment variable and config file specify a value, THE environment variable SHALL take precedence

### Requirement 8: CLI Provider Selection

**User Story:** As a user, I want to select providers via command-line flags, so that I can quickly test different backends without modifying config files.

#### Acceptance Criteria

1. THE CLI SHALL accept a `--provider` flag with values: 'local', 'vllm', 'openai-compatible'
2. THE CLI SHALL accept a `--host` flag to override the provider's base URL
3. THE CLI SHALL accept an `--api-key` flag to provide authentication credentials
4. WHEN CLI flags are provided, THEN they SHALL override config file settings
5. WHEN no provider is specified, THE system SHALL default to 'local' (Ollama)

### Requirement 9: Error Handling and Graceful Degradation

**User Story:** As a user, I want clear error messages when provider operations fail, so that I can diagnose and fix configuration issues.

#### Acceptance Criteria

1. WHEN a provider endpoint is unreachable, THE system SHALL return a descriptive error message
2. WHEN authentication fails, THE system SHALL indicate invalid API key or missing credentials
3. WHEN a backend does not support an operation, THE system SHALL return a clear unsupported operation message
4. IF model listing is not supported by a backend, THEN THE system SHALL handle the absence gracefully
5. WHEN streaming fails mid-response, THE system SHALL report the partial response and error details

### Requirement 10: Feature Detection and Capability Reporting

**User Story:** As a developer, I want to know which features each provider supports, so that I can conditionally enable functionality based on backend capabilities.

#### Acceptance Criteria

1. THE VllmProvider SHALL report support for guided decoding features
2. THE LocalProvider SHALL report support for model management operations (pull, delete)
3. THE OpenAICompatibleProvider SHALL report limited or unknown capabilities for model management
4. WHEN tool calling is requested, THE provider SHALL indicate whether the feature is supported
5. THE system SHALL gracefully disable unsupported features rather than failing

### Requirement 11: Provider-Specific Options Passthrough

**User Story:** As a power user, I want to pass provider-specific options to the backend, so that I can leverage advanced features like vLLM's guided decoding.

#### Acceptance Criteria

1. WHEN extraBody is provided in GenerationOptions, THE provider SHALL include those options in the API request
2. THE VllmProvider SHALL support passing guided_json, guided_regex, and other vLLM-specific parameters
3. THE system SHALL not validate provider-specific options, allowing flexibility for future backend features
4. IF a provider does not recognize an option, THE backend SHALL handle it according to its own logic

### Requirement 12: Backward Compatibility

**User Story:** As an existing user, I want my current Ollama setup to continue working without changes, so that the new provider system doesn't break my workflow.

#### Acceptance Criteria

1. WHEN no provider is specified, THE system SHALL default to LocalProvider (Ollama)
2. THE existing LocalProvider implementation SHALL remain unchanged in functionality
3. THE existing configuration format SHALL continue to work without modification
4. WHEN using Ollama, THE system SHALL use NDJSON streaming format as before
5. THE Provider_Registry SHALL maintain the existing registration API for LocalProvider

### Requirement 13: Documentation and Examples

**User Story:** As a new user, I want clear documentation for each provider, so that I can set up and configure my preferred backend correctly.

#### Acceptance Criteria

1. THE documentation SHALL include setup guides for vLLM provider
2. THE documentation SHALL include setup guides for each supported OpenAI-compatible backend
3. THE documentation SHALL provide configuration examples for each provider
4. THE documentation SHALL include a feature comparison matrix showing capabilities of each provider
5. THE documentation SHALL explain when to use each provider tier (development vs production)

### Requirement 14: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for each provider, so that I can ensure reliability across different backends.

#### Acceptance Criteria

1. THE VllmProvider SHALL have unit tests covering streaming, model listing, and error handling
2. THE OpenAICompatibleProvider SHALL have unit tests covering streaming, model listing, and error handling
3. THE SSE_Parser SHALL have unit tests covering edge cases (partial chunks, malformed JSON, [DONE] marker)
4. THE Provider_Registry SHALL have unit tests covering alias resolution and provider lookup
5. THE system SHALL include integration tests with mock servers simulating each backend type
