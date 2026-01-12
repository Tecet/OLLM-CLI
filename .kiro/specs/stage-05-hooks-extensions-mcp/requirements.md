# Requirements Document

## Introduction

This document specifies the requirements for implementing a hook system, extension loading mechanism, and Model Context Protocol (MCP) integration for the OLLM CLI. These features enable event-driven customization, modular tool additions, and integration with external tool servers.

## Glossary

- **Hook**: An executable script or command that runs in response to specific system events
- **Hook_Registry**: Component that manages hook registration and discovery
- **Hook_Runner**: Component that executes hooks with timeout and error handling
- **Extension**: A package containing hooks, MCP servers, skills, and settings defined by a manifest
- **Extension_Manager**: Component that loads and manages extensions
- **MCP**: Model Context Protocol, a standard for connecting LLMs to external tool servers
- **MCP_Client**: Component that communicates with MCP servers
- **MCP_Server**: External process that provides tools via the MCP protocol
- **Tool_Wrapper**: Adapter that translates between internal tool format and MCP format
- **Trust_Model**: Security mechanism for approving hook execution
- **Manifest**: JSON file describing an extension's contents and configuration
- **System**: The OLLM CLI application

## Requirements

### Requirement 1: Hook Event System

**User Story:** As a developer, I want to execute custom code at specific points in the application lifecycle, so that I can customize behavior and add safety gates.

#### Acceptance Criteria

1. WHEN a session starts, THE System SHALL emit a session_start event with session_id
2. WHEN a session ends, THE System SHALL emit a session_end event with session_id and messages
3. WHEN the agent begins processing, THE System SHALL emit a before_agent event with prompt and context
4. WHEN the agent completes processing, THE System SHALL emit an after_agent event with response and tool_calls
5. WHEN a model call is about to be made, THE System SHALL emit a before_model event with messages and model
6. WHEN a model call completes, THE System SHALL emit an after_model event with response and tokens
7. WHEN tool selection occurs, THE System SHALL emit a before_tool_selection event with available_tools
8. WHEN a tool is about to execute, THE System SHALL emit a before_tool event with tool_name and args
9. WHEN a tool completes execution, THE System SHALL emit an after_tool event with tool_name and result

### Requirement 2: Hook Registration and Discovery

**User Story:** As a developer, I want to register hooks for specific events, so that my custom code runs at the right time.

#### Acceptance Criteria

1. THE Hook_Registry SHALL maintain a mapping of events to registered hooks
2. WHEN a hook is registered, THE Hook_Registry SHALL store the hook with its event type, name, and command
3. WHEN querying hooks for an event, THE Hook_Registry SHALL return all hooks registered for that event in registration order
4. THE Hook_Registry SHALL support registering multiple hooks for the same event
5. THE Hook_Registry SHALL allow unregistering hooks by name

### Requirement 3: Hook Execution

**User Story:** As a user, I want hooks to execute reliably without blocking the system, so that customizations don't cause hangs or crashes.

#### Acceptance Criteria

1. WHEN a hook executes, THE Hook_Runner SHALL pass event data to the hook via stdin as JSON
2. WHEN a hook completes, THE Hook_Runner SHALL parse the hook's stdout as JSON
3. WHEN a hook exceeds the timeout limit, THE Hook_Runner SHALL terminate the hook process and log a warning
4. WHEN a hook fails with an error, THE Hook_Runner SHALL isolate the error and continue executing remaining hooks
5. WHEN multiple hooks are registered for an event, THE Hook_Runner SHALL execute them sequentially in order
6. THE Hook_Runner SHALL enforce a default timeout of 30 seconds per hook
7. WHEN a hook returns continue: false, THE Hook_Runner SHALL signal that the operation should be cancelled

### Requirement 4: Hook Trust and Security

**User Story:** As a user, I want to approve workspace hooks before they execute, so that I can prevent malicious code from running.

#### Acceptance Criteria

1. WHEN a built-in hook is encountered, THE System SHALL trust it automatically
2. WHEN a user-level hook is encountered, THE System SHALL trust it automatically
3. WHEN a workspace hook is encountered for the first time, THE System SHALL prompt the user for approval
4. WHEN a hook is approved, THE System SHALL compute and store the hook's SHA-256 hash
5. WHEN an approved hook's hash changes, THE System SHALL prompt the user for re-approval
6. THE System SHALL store hook approvals in ~/.ollm/trusted-hooks.json
7. WHEN a hook is not approved, THE System SHALL skip executing that hook

### Requirement 5: Extension Discovery and Loading

**User Story:** As a developer, I want to package hooks, MCP servers, and settings into extensions, so that I can distribute reusable functionality.

#### Acceptance Criteria

1. THE Extension_Manager SHALL scan ~/.ollm/extensions/ for user-level extensions
2. THE Extension_Manager SHALL scan .ollm/extensions/ for workspace-level extensions
3. WHEN an extension directory contains a manifest.json file, THE Extension_Manager SHALL parse the manifest
4. WHEN a manifest is invalid, THE Extension_Manager SHALL log an error and skip that extension
5. THE Extension_Manager SHALL load extensions from user directories before workspace directories
6. WHEN extensions are loaded, THE Extension_Manager SHALL register hooks defined in each extension's manifest
7. WHEN extensions are loaded, THE Extension_Manager SHALL register MCP servers defined in each extension's manifest

### Requirement 6: Extension Manifest Parsing

**User Story:** As a developer, I want to define extension capabilities in a manifest file, so that the system knows what my extension provides.

#### Acceptance Criteria

1. THE System SHALL parse manifest.json files with fields: name, version, description, mcpServers, hooks, settings, skills
2. WHEN a manifest contains mcpServers, THE System SHALL validate each server has command and args fields
3. WHEN a manifest contains hooks, THE System SHALL validate each hook has name, command, and event fields
4. WHEN a manifest contains settings, THE System SHALL validate each setting has name and description fields
5. WHEN a manifest contains skills, THE System SHALL validate each skill has name, description, and prompt fields
6. WHEN required fields are missing, THE System SHALL reject the manifest and log a validation error

### Requirement 7: Extension Enable/Disable

**User Story:** As a user, I want to enable or disable extensions, so that I can control which extensions are active.

#### Acceptance Criteria

1. THE Extension_Manager SHALL maintain a list of enabled extension names
2. WHEN an extension is disabled, THE Extension_Manager SHALL not register its hooks or MCP servers
3. WHEN an extension is enabled, THE Extension_Manager SHALL register its hooks and MCP servers
4. THE System SHALL persist enabled/disabled state in configuration
5. WHERE autoEnable is configured, THE Extension_Manager SHALL automatically enable newly discovered extensions

### Requirement 8: MCP Client Connection Management

**User Story:** As a user, I want to connect to MCP servers, so that I can use external tools.

#### Acceptance Criteria

1. THE MCP_Client SHALL support stdio transport for MCP servers
2. THE MCP_Client SHALL support SSE transport for MCP servers
3. THE MCP_Client SHALL support HTTP transport for MCP servers
4. WHEN connecting to an MCP server, THE MCP_Client SHALL spawn the server process with specified command and args
5. WHEN an MCP server fails to start, THE MCP_Client SHALL log an error and mark the server as unavailable
6. THE MCP_Client SHALL enforce a connection timeout of 10 seconds by default
7. WHEN an MCP server disconnects, THE MCP_Client SHALL log the disconnection and remove its tools from the registry

### Requirement 9: MCP Tool Schema Conversion

**User Story:** As a developer, I want MCP tools to appear as native tools, so that the agent can use them seamlessly.

#### Acceptance Criteria

1. WHEN an MCP server provides tool schemas, THE System SHALL convert each schema to internal ToolSchema format
2. THE System SHALL map MCP parameter types to internal parameter types
3. THE System SHALL preserve required/optional parameter information during conversion
4. THE System SHALL include the MCP server name in the converted tool metadata
5. WHEN an MCP tool schema is invalid, THE System SHALL log a warning and skip that tool

### Requirement 10: MCP Tool Execution

**User Story:** As a user, I want to execute MCP tools through the normal tool system, so that external tools work like built-in tools.

#### Acceptance Criteria

1. WHEN an MCP tool is invoked, THE Tool_Wrapper SHALL translate the tool call to MCP format
2. THE Tool_Wrapper SHALL send the tool call to the appropriate MCP server
3. WHEN the MCP server returns a result, THE Tool_Wrapper SHALL translate the result to internal format
4. WHEN an MCP tool call fails, THE Tool_Wrapper SHALL return an error result with the failure message
5. THE Tool_Wrapper SHALL handle MCP-specific error codes and translate them to user-friendly messages

### Requirement 11: Multiple MCP Server Support

**User Story:** As a user, I want to connect to multiple MCP servers simultaneously, so that I can use tools from different sources.

#### Acceptance Criteria

1. THE MCP_Client SHALL maintain connections to multiple MCP servers concurrently
2. WHEN multiple servers provide tools with the same name, THE System SHALL namespace tools by server name
3. THE MCP_Client SHALL route tool calls to the correct server based on tool metadata
4. WHEN one MCP server fails, THE System SHALL continue operating with remaining servers
5. THE System SHALL display which MCP servers are connected in status information

### Requirement 12: Extension Settings Integration

**User Story:** As a developer, I want to define settings for my extension, so that users can configure my extension's behavior.

#### Acceptance Criteria

1. WHEN an extension defines settings, THE System SHALL merge those settings with core configuration
2. WHERE a setting specifies an envVar, THE System SHALL read the value from that environment variable
3. WHERE a setting is marked sensitive, THE System SHALL redact its value in logs
4. THE System SHALL validate extension settings against their definitions
5. WHEN a required setting is missing, THE System SHALL log a warning and disable the extension

### Requirement 13: Hook Data Flow

**User Story:** As a developer, I want to pass data between hooks and the core system, so that hooks can influence system behavior.

#### Acceptance Criteria

1. WHEN a hook returns systemMessage, THE System SHALL inject that message into the conversation context
2. WHEN a hook returns continue: false, THE System SHALL cancel the current operation
3. WHEN a hook returns additional data fields, THE System SHALL make those fields available to subsequent hooks
4. THE System SHALL preserve hook output data throughout the event processing chain
5. WHEN hook output is malformed, THE System SHALL log an error and treat it as continue: true

### Requirement 14: Hook Timeout Configuration

**User Story:** As a user, I want to configure hook timeouts, so that I can adjust for slow hooks or fast-fail scenarios.

#### Acceptance Criteria

1. THE System SHALL read hook timeout from configuration with key hooks.timeout
2. WHERE hooks.timeout is not specified, THE System SHALL use 30000 milliseconds as default
3. THE System SHALL apply the configured timeout to all hook executions
4. WHEN a hook times out, THE System SHALL log the hook name and timeout duration
5. THE System SHALL allow per-hook timeout overrides in hook definitions

### Requirement 15: Extension Skills Registration

**User Story:** As a developer, I want to define skills in my extension, so that users can invoke specialized prompts.

#### Acceptance Criteria

1. WHEN an extension defines skills, THE System SHALL register each skill with its name and prompt
2. THE System SHALL make registered skills available for user invocation
3. WHEN a skill is invoked, THE System SHALL inject the skill's prompt into the conversation
4. THE System SHALL support skill parameters defined in the manifest
5. WHEN multiple extensions define skills with the same name, THE System SHALL namespace skills by extension name
