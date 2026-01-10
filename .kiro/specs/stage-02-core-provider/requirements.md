# Requirements Document

## Introduction

This document defines the requirements for the core runtime and provider interface system. The system provides a provider-agnostic architecture for chat interactions, tool execution, and streaming responses. It enables OLLM CLI to work with multiple LLM backends through a unified interface while supporting both native tool calling and ReAct-based fallback mechanisms.

## Glossary

- **Provider_Adapter**: An implementation that connects the core runtime to a specific LLM backend (e.g., Ollama)
- **Chat_Runtime**: The core system that manages conversation turns, tool execution, and streaming responses
- **Tool_Call**: A request from the model to execute a specific tool with provided arguments
- **Turn**: A single conversation cycle including model response and any tool executions
- **ReAct**: A prompting pattern (Reasoning + Acting) used for tool calling when native function calling is unavailable
- **Provider_Event**: A typed event emitted during streaming (text, tool_call, finish, error)
- **Token_Limit**: The maximum number of tokens a model can process in a single request
- **Tool_Schema**: A structured definition of a tool's name, description, and parameters

## Requirements

### Requirement 1: Provider Registry

**User Story:** As a developer, I want to register and resolve provider adapters, so that the system can work with multiple LLM backends.

#### Acceptance Criteria

1. WHEN a provider adapter is registered, THE Provider_Registry SHALL store it with its name as the key
2. WHEN a provider is requested by name, THE Provider_Registry SHALL return the corresponding adapter if it exists
3. WHEN no provider name is specified, THE Provider_Registry SHALL return the default provider
4. WHEN listing providers, THE Provider_Registry SHALL return all registered provider names
5. WHERE a default provider is configured, THE Provider_Registry SHALL use that provider when no specific provider is requested

### Requirement 2: Chat Streaming

**User Story:** As a user, I want to receive streaming responses from the model, so that I can see output as it's generated.

#### Acceptance Criteria

1. WHEN a chat request is initiated, THE Chat_Runtime SHALL produce an async iterable of provider events
2. WHEN the provider emits text, THE Chat_Runtime SHALL forward text events to consumers
3. WHEN the provider completes generation, THE Chat_Runtime SHALL emit a finish event with the termination reason
4. IF an error occurs during streaming, THEN THE Chat_Runtime SHALL emit an error event with details
5. WHEN an abort signal is provided, THE Chat_Runtime SHALL cancel the stream when the signal is triggered

### Requirement 3: Tool Call Detection and Execution

**User Story:** As a user, I want the model to execute tools during conversation, so that it can perform actions and retrieve information.

#### Acceptance Criteria

1. WHEN the provider emits a tool_call event, THE Chat_Runtime SHALL queue the tool call for execution
2. WHEN the model stream completes with tool calls, THE Chat_Runtime SHALL execute all queued tool calls
3. WHEN tool execution completes, THE Chat_Runtime SHALL continue the conversation with tool results
4. WHEN multiple tool calls are requested, THE Chat_Runtime SHALL execute them in parallel
5. WHEN the turn count exceeds the maximum limit, THE Chat_Runtime SHALL terminate the conversation to prevent infinite loops

### Requirement 4: Provider Adapter Interface

**User Story:** As a developer, I want a standardized interface for provider adapters, so that I can integrate different LLM backends consistently.

#### Acceptance Criteria

1. THE Provider_Adapter SHALL implement a chatStream method that returns an async iterable of provider events
2. WHERE token counting is supported, THE Provider_Adapter SHALL implement a countTokens method
3. WHERE model management is supported, THE Provider_Adapter SHALL implement listModels, pullModel, deleteModel, and showModel methods
4. WHEN a chat request is made, THE Provider_Adapter SHALL map internal message format to the provider's expected format
5. WHEN tool schemas are provided, THE Provider_Adapter SHALL convert them to the provider's function calling format

### Requirement 5: Local Provider Implementation

**User Story:** As a user, I want to connect to a local LLM server, so that I can use the CLI with locally-hosted models.

#### Acceptance Criteria

1. WHEN the local provider is initialized, THE Local_Provider SHALL connect to the configured server endpoint
2. WHEN a chat request is made, THE Local_Provider SHALL send properly formatted requests to the local server
3. WHEN the server responds, THE Local_Provider SHALL stream events back to the chat runtime
4. IF the connection fails, THEN THE Local_Provider SHALL emit an error event with connection details
5. WHEN tool schemas are provided, THE Local_Provider SHALL format them according to the server's function calling specification

### Requirement 6: ReAct Fallback for Tool Calling

**User Story:** As a user, I want to use tools with models that don't support native function calling, so that I can access tool functionality regardless of model capabilities.

#### Acceptance Criteria

1. WHEN native tool calling is unavailable, THE ReAct_Handler SHALL format tool schemas as text instructions
2. WHEN the model outputs a ReAct-formatted response, THE ReAct_Handler SHALL parse the Thought, Action, and Action Input fields
3. WHEN Action Input is parsed, THE ReAct_Handler SHALL validate it as valid JSON before execution
4. IF Action Input is invalid JSON, THEN THE ReAct_Handler SHALL emit an error and request correction
5. WHEN a tool result is received, THE ReAct_Handler SHALL format it as an Observation for the next turn
6. WHEN the model outputs "Final Answer", THE ReAct_Handler SHALL treat it as the completion of the turn

### Requirement 7: Token Limit Enforcement

**User Story:** As a user, I want the system to prevent context overflow, so that requests don't fail due to exceeding model limits.

#### Acceptance Criteria

1. WHEN a chat request is prepared, THE Token_Counter SHALL estimate the total token count
2. WHERE the provider supports token counting, THE Token_Counter SHALL use the provider's tokenizer
3. WHERE the provider does not support token counting, THE Token_Counter SHALL use a fallback estimation of text length divided by 4
4. WHEN the estimated tokens approach 90% of the model's limit, THE Chat_Runtime SHALL emit a warning
5. WHEN the estimated tokens exceed the model's limit, THE Chat_Runtime SHALL block the request and return an error

### Requirement 8: Turn Management

**User Story:** As a developer, I want each conversation turn to be managed independently, so that the system can handle complex multi-turn interactions.

#### Acceptance Criteria

1. WHEN a turn begins, THE Turn_Manager SHALL initialize with the current conversation state
2. WHEN streaming from the provider, THE Turn_Manager SHALL collect all events until completion
3. WHEN tool calls are detected, THE Turn_Manager SHALL maintain them in a queue
4. WHEN the stream completes, THE Turn_Manager SHALL execute queued tool calls before continuing
5. WHEN a turn completes, THE Turn_Manager SHALL update the conversation history with all messages and tool results

### Requirement 9: Message Format Standardization

**User Story:** As a developer, I want a consistent internal message format, so that the system can work uniformly across different providers.

#### Acceptance Criteria

1. THE Message SHALL contain a role field with values: system, user, assistant, or tool
2. THE Message SHALL contain a parts array with text or image content
3. WHEN a message contains tool results, THE Message SHALL include the tool name
4. WHEN converting to provider format, THE Provider_Adapter SHALL map internal messages to provider-specific structure
5. WHEN receiving provider responses, THE Provider_Adapter SHALL map them back to internal message format

### Requirement 10: Error Handling and Recovery

**User Story:** As a user, I want clear error messages when things go wrong, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a provider connection fails, THE Chat_Runtime SHALL emit an error event with connection details
2. WHEN a tool execution fails, THE Chat_Runtime SHALL include the error in the tool result and continue
3. WHEN JSON parsing fails in ReAct mode, THE Chat_Runtime SHALL request the model to correct the format
4. WHEN the abort signal is triggered, THE Chat_Runtime SHALL clean up resources and emit a cancellation event
5. WHEN an unexpected error occurs, THE Chat_Runtime SHALL emit an error event without crashing the process
