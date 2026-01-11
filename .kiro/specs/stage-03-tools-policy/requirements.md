# Requirements Document

## Introduction

This document specifies the requirements for the Tool System and Policy Engine in OLLM CLI. The system enables LLMs to interact with the file system, execute shell commands, fetch web content, and perform other operations through a secure, policy-controlled interface. The tool system provides a declarative API for registering tools, validating parameters, and managing execution with user confirmation when needed.

## Glossary

- **Tool**: A capability exposed to the LLM that performs an operation (file read, shell command, web fetch, etc.)
- **Tool_Registry**: Central registry that manages tool registration, discovery, and schema exposure
- **Tool_Invocation**: An instance of a tool being called with specific parameters
- **Policy_Engine**: Component that determines whether a tool execution requires user confirmation
- **Message_Bus**: Communication channel for requesting and receiving user confirmations
- **Declarative_Tool**: A tool defined by its schema and invocation factory
- **Tool_Schema**: JSON schema describing a tool's parameters for LLM consumption
- **Risk_Level**: Classification of tool danger (low, medium, high)
- **Confirmation_Details**: Information presented to user for approval decisions
- **Output_Truncation**: Limiting tool output to prevent context overflow

## Requirements

### Requirement 1: Tool Registry

**User Story:** As a developer, I want a central registry for tools, so that tools can be discovered and exposed to LLMs consistently.

#### Acceptance Criteria

1. WHEN a tool is registered, THE Tool_Registry SHALL store it with its name as the key
2. WHEN a tool with an existing name is registered, THE Tool_Registry SHALL replace the previous tool
3. WHEN a tool is unregistered by name, THE Tool_Registry SHALL remove it from the registry
4. WHEN listing tools, THE Tool_Registry SHALL return all registered tools in alphabetical order by name
5. WHEN getting a tool by name, THE Tool_Registry SHALL return the tool if it exists or undefined if it does not
6. WHEN generating function schemas, THE Tool_Registry SHALL convert all registered tools to provider-compatible schemas
7. THE Tool_Registry SHALL maintain consistent ordering across multiple calls to list()

### Requirement 2: File Reading Tools

**User Story:** As an LLM, I want to read file contents with optional line ranges, so that I can examine code and documents efficiently.

#### Acceptance Criteria

1. WHEN reading a file with valid path, THE read_file Tool SHALL return the complete file contents
2. WHEN reading a file with startLine specified, THE read_file Tool SHALL return content from that line to the end
3. WHEN reading a file with endLine specified, THE read_file Tool SHALL return content from the beginning to that line
4. WHEN reading a file with both startLine and endLine, THE read_file Tool SHALL return content within that range inclusive
5. WHEN reading a non-existent file, THE read_file Tool SHALL return an error indicating the file was not found
6. WHEN reading a file exceeding size limits, THE read_file Tool SHALL return an error indicating the file is too large
7. WHEN reading a binary file, THE read_file Tool SHALL detect the encoding and return an appropriate message
8. WHEN reading multiple files, THE read_many_files Tool SHALL return combined output with file path headers
9. FOR ALL file read operations, the system SHALL preserve the original file encoding

### Requirement 3: File Writing Tools

**User Story:** As an LLM, I want to write and edit files safely, so that I can create and modify code without data loss.

#### Acceptance Criteria

1. WHEN writing to a new file, THE write_file Tool SHALL create the file with the specified content
2. WHEN writing to an existing file without overwrite flag, THE write_file Tool SHALL return an error
3. WHEN writing to an existing file with overwrite flag, THE write_file Tool SHALL replace the file contents
4. WHEN writing to a path with non-existent parent directories, THE write_file Tool SHALL create the parent directories
5. WHEN editing a file with valid edits, THE edit_file Tool SHALL apply all edits and return success
6. WHEN editing a file with invalid target text, THE edit_file Tool SHALL return an error indicating which edit failed
7. WHEN editing a file with ambiguous target text, THE edit_file Tool SHALL return an error indicating multiple matches
8. FOR ALL file write operations, the system SHALL validate that the path is within allowed directories

### Requirement 4: File Discovery Tools

**User Story:** As an LLM, I want to search for files by pattern and content, so that I can locate relevant code and documents.

#### Acceptance Criteria

1. WHEN using glob with a valid pattern, THE glob Tool SHALL return all matching file paths
2. WHEN using glob with maxResults specified, THE glob Tool SHALL return at most that many results
3. WHEN using glob with includeHidden false, THE glob Tool SHALL exclude hidden files and directories
4. WHEN using glob with includeHidden true, THE glob Tool SHALL include hidden files and directories
5. WHEN using grep with a pattern, THE grep Tool SHALL return all lines matching the pattern with file paths
6. WHEN using grep with caseSensitive true, THE grep Tool SHALL perform case-sensitive matching
7. WHEN using grep with caseSensitive false, THE grep Tool SHALL perform case-insensitive matching
8. WHEN using grep with filePattern, THE grep Tool SHALL only search files matching that pattern
9. WHEN using ls on a directory, THE ls Tool SHALL return a formatted list of directory contents
10. WHEN using ls with recursive true, THE ls Tool SHALL include subdirectory contents
11. WHEN using ls with maxDepth specified, THE ls Tool SHALL limit recursion to that depth
12. FOR ALL file discovery operations, the system SHALL respect .gitignore rules

### Requirement 5: Shell Execution Tool

**User Story:** As an LLM, I want to execute shell commands with streaming output, so that I can run builds, tests, and other operations.

#### Acceptance Criteria

1. WHEN executing a shell command, THE shell Tool SHALL return the command output and exit code
2. WHEN executing a command with streaming enabled, THE shell Tool SHALL provide output incrementally via callback
3. WHEN a command exceeds the timeout, THE shell Tool SHALL terminate the process and return a timeout error
4. WHEN a command produces no output for the idle timeout period, THE shell Tool SHALL terminate the process
5. WHEN executing a background command, THE shell Tool SHALL return immediately with a process identifier
6. WHEN a command fails, THE shell Tool SHALL return the exit code and stderr output
7. WHEN executing with a specified working directory, THE shell Tool SHALL run the command in that directory
8. THE shell Tool SHALL sanitize environment variables to prevent secret leakage

### Requirement 6: Web Tools

**User Story:** As an LLM, I want to fetch web content and search the web, so that I can access documentation and current information.

#### Acceptance Criteria

1. WHEN fetching a valid URL, THE web_fetch Tool SHALL return the page content as text
2. WHEN fetching with a CSS selector, THE web_fetch Tool SHALL return only the matching elements
3. WHEN fetching content exceeding maxLength, THE web_fetch Tool SHALL truncate the output and indicate truncation
4. WHEN fetching a non-existent URL, THE web_fetch Tool SHALL return a 404 error
5. WHEN fetching times out, THE web_fetch Tool SHALL return a timeout error
6. WHEN searching with a query, THE web_search Tool SHALL return formatted search results
7. WHEN searching with numResults specified, THE web_search Tool SHALL return at most that many results
8. FOR ALL web operations, the system SHALL handle network errors gracefully

### Requirement 7: Policy Engine

**User Story:** As a user, I want control over which tools require confirmation, so that I can balance safety and convenience.

#### Acceptance Criteria

1. WHEN a tool is invoked and policy is "allow", THE Policy_Engine SHALL permit execution without confirmation
2. WHEN a tool is invoked and policy is "deny", THE Policy_Engine SHALL block execution and return an error
3. WHEN a tool is invoked and policy is "ask", THE Policy_Engine SHALL request user confirmation before execution
4. WHEN evaluating policy for a tool, THE Policy_Engine SHALL check tool-specific rules before default rules
5. WHEN no policy rule matches, THE Policy_Engine SHALL apply the default action
6. WHEN a policy rule has conditions, THE Policy_Engine SHALL evaluate conditions against tool parameters
7. THE Policy_Engine SHALL classify each tool with a risk level (low, medium, high)
8. WHEN generating confirmation details, THE Policy_Engine SHALL include tool name, description, risk level, and affected locations

### Requirement 8: Message Bus for Confirmations

**User Story:** As a developer, I want an async communication channel for confirmations, so that tools can request user approval without blocking.

#### Acceptance Criteria

1. WHEN a confirmation is requested, THE Message_Bus SHALL generate a unique correlation ID
2. WHEN a confirmation request is sent, THE Message_Bus SHALL wait for a response with matching correlation ID
3. WHEN a confirmation response is received, THE Message_Bus SHALL deliver it to the waiting requester
4. WHEN a confirmation request times out, THE Message_Bus SHALL return a timeout error
5. WHEN multiple confirmations are pending, THE Message_Bus SHALL handle them independently by correlation ID
6. THE Message_Bus SHALL support cancellation via AbortSignal

### Requirement 9: Tool Output Management

**User Story:** As a system, I want to truncate large tool outputs, so that I don't exceed context limits or overwhelm the LLM.

#### Acceptance Criteria

1. WHEN tool output exceeds max characters, THE system SHALL truncate at the character limit and append a truncation indicator
2. WHEN tool output exceeds max lines, THE system SHALL truncate at the line limit and append a truncation indicator
3. WHEN tool output is truncated, THE truncation indicator SHALL specify how much content was omitted
4. WHEN a tool supports streaming, THE system SHALL allow incremental output updates via callback
5. THE system SHALL format tool output for optimal LLM consumption with clear structure

### Requirement 10: Tool Invocation Interface

**User Story:** As a tool implementer, I want a consistent invocation interface, so that all tools follow the same execution pattern.

#### Acceptance Criteria

1. WHEN creating a tool invocation, THE system SHALL validate parameters against the tool schema
2. WHEN getting a description, THE Tool_Invocation SHALL return a human-readable summary of the operation
3. WHEN getting tool locations, THE Tool_Invocation SHALL return file paths or resources affected by the operation
4. WHEN checking if confirmation is needed, THE Tool_Invocation SHALL return confirmation details or false
5. WHEN executing a tool, THE Tool_Invocation SHALL respect the AbortSignal for cancellation
6. WHEN executing a tool with updateOutput callback, THE Tool_Invocation SHALL provide streaming output
7. FOR ALL tool executions, the system SHALL return a ToolResult with llmContent and returnDisplay

### Requirement 11: Memory and Todo Tools

**User Story:** As an LLM, I want persistent storage for key-value data and todos, so that I can maintain state across conversations.

#### Acceptance Criteria

1. WHEN storing a value with memory tool, THE system SHALL persist the key-value pair to disk
2. WHEN retrieving a value with memory tool, THE system SHALL return the stored value or indicate if not found
3. WHEN deleting a value with memory tool, THE system SHALL remove the key-value pair
4. WHEN listing memory keys, THE system SHALL return all stored keys
5. WHEN adding a todo, THE write_todos Tool SHALL append it to the todo list with a unique ID
6. WHEN completing a todo, THE write_todos Tool SHALL mark it as complete
7. WHEN removing a todo, THE write_todos Tool SHALL delete it from the list
8. WHEN listing todos, THE write_todos Tool SHALL return all todos with their status
9. FOR ALL persistent storage operations, the system SHALL handle concurrent access safely

### Requirement 12: Error Handling and Validation

**User Story:** As a user, I want clear error messages when tools fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a tool receives invalid parameters, THE system SHALL return a validation error with details
2. WHEN a tool encounters a file system error, THE system SHALL return an error with the file path and reason
3. WHEN a tool encounters a network error, THE system SHALL return an error with the URL and reason
4. WHEN a tool is cancelled via AbortSignal, THE system SHALL stop execution and return a cancellation error
5. WHEN a tool times out, THE system SHALL return a timeout error with the elapsed time
6. FOR ALL tool errors, the system SHALL include the error type and a descriptive message in the ToolResult
