# Requirements Document: Services and Sessions

## Introduction

This specification defines the core services layer for the OLLM CLI, focusing on session persistence, context management, safety mechanisms, and environment security. These services enable users to maintain conversation history across CLI restarts, manage context size within model limits, prevent runaway tool execution loops, and protect sensitive environment variables from exposure.

## Glossary

- **Session**: A persistent conversation between the user and the LLM, including all messages and tool calls
- **Chat_Recording_Service**: Service responsible for persisting session data to disk
- **Chat_Compression_Service**: Service that reduces message history size while preserving conversation context
- **Loop_Detection_Service**: Service that monitors and prevents infinite tool calling loops
- **Context_Manager**: Service that manages dynamic context injection into system prompts
- **File_Discovery_Service**: Service that scans project directories while respecting ignore patterns
- **Environment_Sanitization_Service**: Service that filters sensitive environment variables from tool execution contexts
- **Session_Data_Directory**: File system location where session files are stored (`~/.ollm/session-data/`)
- **Token_Limit**: Maximum number of tokens a model can process in a single request
- **Compression_Threshold**: Percentage of token limit at which compression is triggered (default: 80%)
- **Turn**: A single request-response cycle between user and LLM
- **Tool_Call**: An invocation of a registered tool by the LLM during a turn

## Requirements

### Requirement 1: Session Recording

**User Story:** As a user, I want my conversations to be automatically saved, so that I can resume them later or review past interactions.

#### Acceptance Criteria

1. WHEN a user sends a message, THE Chat_Recording_Service SHALL persist the message to the Session_Data_Directory
2. WHEN the LLM responds with a message, THE Chat_Recording_Service SHALL persist the response to the Session_Data_Directory
3. WHEN a tool is invoked, THE Chat_Recording_Service SHALL persist the tool call and its result to the Session_Data_Directory
4. WHEN a user requests to list sessions, THE Chat_Recording_Service SHALL return all available sessions with summary information
5. WHEN a user requests to resume a session, THE Chat_Recording_Service SHALL load the complete session history including all messages and tool calls
6. WHEN a user requests to delete a session, THE Chat_Recording_Service SHALL remove the session file from the Session_Data_Directory
7. THE Chat_Recording_Service SHALL store each session as a JSON file with a unique session identifier
8. THE Chat_Recording_Service SHALL include metadata in each session file (session ID, start time, last activity, model name, provider, token count)

### Requirement 2: Session File Format

**User Story:** As a developer, I want session files to use a well-defined JSON format, so that sessions can be parsed, exported, and analyzed reliably.

#### Acceptance Criteria

1. THE Chat_Recording_Service SHALL store sessions in JSON format with fields: sessionId, startTime, lastActivity, model, provider, messages, toolCalls, and metadata
2. WHEN storing a message, THE Chat_Recording_Service SHALL include role, parts array, and timestamp
3. WHEN storing a tool call, THE Chat_Recording_Service SHALL include id, name, args, result, and timestamp
4. THE Chat_Recording_Service SHALL use ISO 8601 format for all timestamp fields
5. THE Chat_Recording_Service SHALL use UUID format for session identifiers

### Requirement 3: Chat Compression

**User Story:** As a user, I want long conversations to be automatically compressed, so that I can continue chatting without hitting context limits.

#### Acceptance Criteria

1. WHEN token usage exceeds the Compression_Threshold, THE Chat_Compression_Service SHALL compress the message history
2. WHEN compressing messages, THE Chat_Compression_Service SHALL preserve the system prompt
3. WHEN compressing messages, THE Chat_Compression_Service SHALL preserve the most recent messages (configurable count)
4. WHEN compressing messages, THE Chat_Compression_Service SHALL replace older messages with a summary
5. THE Chat_Compression_Service SHALL support multiple compression strategies: summarize, truncate, and hybrid
6. WHERE the hybrid strategy is selected, THE Chat_Compression_Service SHALL summarize old messages and keep recent messages intact
7. THE Chat_Compression_Service SHALL provide a method to check if compression is needed based on current token count and Token_Limit
8. THE Chat_Compression_Service SHALL increment the compression count in session metadata after each compression

### Requirement 4: Loop Detection

**User Story:** As a user, I want the system to detect and stop infinite loops, so that runaway tool calls don't waste resources or cause system issues.

#### Acceptance Criteria

1. WHEN the same tool is called consecutively with identical arguments N times (configurable), THE Loop_Detection_Service SHALL emit a loop detection event
2. WHEN the same output is repeated N times consecutively (configurable), THE Loop_Detection_Service SHALL emit a loop detection event
3. WHEN the turn count exceeds the maximum turn limit (configurable), THE Loop_Detection_Service SHALL emit a loop detection event
4. THE Loop_Detection_Service SHALL track tool call patterns including tool name and arguments
5. THE Loop_Detection_Service SHALL track output similarity across consecutive turns
6. THE Loop_Detection_Service SHALL expose configuration for maxTurns (default: 50) and repeatThreshold (default: 3)
7. WHEN a loop is detected, THE Loop_Detection_Service SHALL stop further execution
8. WHEN a loop is detected, THE Loop_Detection_Service SHALL notify the user with details about the detected loop pattern

### Requirement 5: Context Management

**User Story:** As a developer or power user, I want to dynamically inject context into conversations, so that the LLM has access to relevant information without manual copying.

#### Acceptance Criteria

1. THE Context_Manager SHALL provide a method to add context entries with a unique key and content
2. THE Context_Manager SHALL provide a method to remove context entries by key
3. THE Context_Manager SHALL provide a method to retrieve all active context entries
4. THE Context_Manager SHALL provide a method to generate system prompt additions from all active context
5. WHEN multiple context entries exist, THE Context_Manager SHALL combine them in priority order
6. THE Context_Manager SHALL support context contributions from hooks, extensions, and user commands
7. THE Context_Manager SHALL include all active context in the system prompt for every turn
8. THE Context_Manager SHALL support configurable priority levels for context ordering

### Requirement 6: File Discovery

**User Story:** As a user, I want the system to quickly scan my project files while respecting ignore patterns, so that tools can efficiently discover relevant files.

#### Acceptance Criteria

1. THE File_Discovery_Service SHALL traverse directories asynchronously starting from a specified root path
2. THE File_Discovery_Service SHALL respect patterns defined in `.ollmignore` files
3. THE File_Discovery_Service SHALL respect patterns defined in `.gitignore` files
4. THE File_Discovery_Service SHALL exclude built-in ignore patterns (node_modules, .git, dist, build)
5. THE File_Discovery_Service SHALL support configurable depth limits for directory traversal
6. THE File_Discovery_Service SHALL cache discovery results for performance
7. THE File_Discovery_Service SHALL provide a method to watch for file system changes
8. WHEN file system changes are detected, THE File_Discovery_Service SHALL invoke registered callbacks with change information

### Requirement 7: Environment Sanitization

**User Story:** As a security-conscious user, I want sensitive environment variables to be filtered out before tools execute, so that API keys and secrets don't leak to the LLM or logs.

#### Acceptance Criteria

1. THE Environment_Sanitization_Service SHALL maintain an allow list of environment variables that are always passed to tools
2. THE Environment_Sanitization_Service SHALL maintain a deny list of environment variable patterns that are never passed to tools
3. THE Environment*Sanitization_Service SHALL include core variables in the allow list: PATH, HOME, USER, SHELL, TERM, LANG, LC*\*
4. THE Environment*Sanitization_Service SHALL include sensitive patterns in the deny list: *\_KEY, *\_SECRET, *\_TOKEN, *\_PASSWORD, \*\_CREDENTIAL, AWS*_, GITHUB\__
5. WHEN sanitizing an environment, THE Environment_Sanitization_Service SHALL remove all variables matching deny patterns
6. WHEN sanitizing an environment, THE Environment_Sanitization_Service SHALL preserve all variables in the allow list
7. THE Environment_Sanitization_Service SHALL support custom allow and deny rules via configuration
8. THE Environment_Sanitization_Service SHALL apply sanitization before every tool execution

### Requirement 8: Service Configuration

**User Story:** As a user, I want to configure service behavior through configuration files, so that I can customize session storage, compression, loop detection, and security settings.

#### Acceptance Criteria

1. THE system SHALL support configuration of session data directory location (default: ~/.ollm/session-data)
2. THE system SHALL support configuration of maximum session count (default: 100)
3. THE system SHALL support configuration of compression threshold (default: 0.8)
4. THE system SHALL support configuration of compression strategy (summarize, truncate, hybrid)
5. THE system SHALL support configuration of recent message preservation count (default: 4096 tokens)
6. THE system SHALL support configuration of loop detection maxTurns (default: 50)
7. THE system SHALL support configuration of loop detection repeatThreshold (default: 3)
8. THE system SHALL support configuration of environment variable allow and deny patterns
9. THE system SHALL load service configuration from YAML configuration files

### Requirement 9: Session Lifecycle

**User Story:** As a user, I want sessions to be automatically managed throughout their lifecycle, so that I don't have to manually save or manage session files.

#### Acceptance Criteria

1. WHEN the CLI starts a new conversation, THE Chat_Recording_Service SHALL create a new session with a unique identifier
2. WHEN the CLI exits normally, THE Chat_Recording_Service SHALL save the current session to disk
3. WHEN the CLI crashes, THE Chat_Recording_Service SHALL have already persisted all messages up to the last turn
4. WHEN the session count exceeds the maximum, THE Chat_Recording_Service SHALL delete the oldest sessions
5. THE Chat_Recording_Service SHALL update the lastActivity timestamp after each message or tool call
6. THE Chat_Recording_Service SHALL auto-save sessions after each turn (configurable)

### Requirement 10: Error Handling

**User Story:** As a user, I want services to handle errors gracefully, so that failures in one service don't crash the entire application.

#### Acceptance Criteria

1. IF session file writing fails, THEN THE Chat_Recording_Service SHALL log the error and continue operation
2. IF session file reading fails, THEN THE Chat_Recording_Service SHALL return an error and allow the user to start a new session
3. IF compression fails, THEN THE Chat_Compression_Service SHALL log the error and continue without compression
4. IF file discovery encounters permission errors, THEN THE File_Discovery_Service SHALL skip inaccessible directories and continue
5. IF environment sanitization encounters invalid patterns, THEN THE Environment_Sanitization_Service SHALL log a warning and use default patterns
6. THE system SHALL provide clear error messages for all service failures
7. THE system SHALL not expose sensitive information in error messages or logs
