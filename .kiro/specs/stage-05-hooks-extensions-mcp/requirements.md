# Requirements Document

## Introduction

This document specifies the requirements for the Hooks, Extensions, and MCP (Model Context Protocol) integration system for OLLM CLI. This system enables event-driven customization through hooks, modular functionality through extensions with manifest-based configuration, and external tool integration through MCP servers. The system must be secure, performant, and provide clear feedback to users about extension behavior.

## Glossary

- **Hook**: An executable script or command that runs in response to specific events in the CLI lifecycle
- **Extension**: A packaged collection of hooks, MCP servers, settings, and skills defined by a manifest
- **MCP_Server**: An external process that provides tools via the Model Context Protocol
- **Hook_Registry**: Component that manages registration and discovery of hooks
- **Hook_Runner**: Component that executes hooks with timeout and error handling
- **Extension_Manager**: Component that loads, enables, and disables extensions
- **MCP_Client**: Component that communicates with MCP servers
- **Trust_Model**: Security system that requires approval for untrusted hooks
- **Manifest**: JSON file describing an extension's capabilities and requirements
- **Tool_Wrapper**: Adapter that translates MCP tool calls to internal format
- **Hook_Event**: Specific lifecycle point where hooks can execute (e.g., before_model, after_tool)

## Requirements

### Requirement 1: Hook System Core

**User Story:** As a developer, I want to register and execute hooks at specific lifecycle events, so that I can customize CLI behavior without modifying core code.

#### Acceptance Criteria

1. WHEN a hook is registered for an event, THE Hook_Registry SHALL store the hook with its event association
2. WHEN a lifecycle event occurs, THE Hook_Planner SHALL identify all hooks registered for that event
3. WHEN hooks are executed, THE Hook_Runner SHALL run them in registration order with a configurable timeout
4. IF a hook execution exceeds the timeout, THEN THE Hook_Runner SHALL terminate the hook and continue with remaining hooks
5. IF a hook fails with an error, THEN THE Hook_Runner SHALL log the error and continue executing remaining hooks
6. WHEN a hook completes, THE Hook_Runner SHALL capture the hook's output and make it available to the system
7. THE Hook_System SHALL support all defined hook events: session_start, session_end, before_agent, after_agent, before_model, after_model, before_tool_selection, before_tool, after_tool
8. WHEN hook input is prepared, THE Hook_Translator SHALL convert system data to the hook protocol JSON format
9. WHEN hook output is received, THE Hook_Translator SHALL parse the JSON response and extract relevant data

### Requirement 2: Hook Protocol Communication

**User Story:** As an extension developer, I want hooks to communicate via a standard JSON protocol, so that I can write hooks in any language.

#### Acceptance Criteria

1. WHEN a hook is executed, THE Hook_Runner SHALL provide input as JSON via stdin
2. THE Hook_Input SHALL include the event name and event-specific data fields
3. WHEN a hook produces output, THE Hook_Runner SHALL read JSON from stdout
4. THE Hook_Output SHALL include a continue field indicating whether to proceed
5. WHERE a hook provides a system message, THE Hook_Output SHALL include a systemMessage field
6. WHERE a hook provides additional data, THE Hook_Output SHALL include hook-specific output fields
7. IF hook output is malformed JSON, THEN THE Hook_Runner SHALL log an error and treat it as a failed hook

### Requirement 3: Hook Trust and Security

**User Story:** As a user, I want to approve workspace hooks before they execute, so that I can prevent malicious code from running.

#### Acceptance Criteria

1. WHEN a hook is from a built-in source, THE Trust_Model SHALL mark it as trusted without approval
2. WHEN a hook is from the user directory (~/.ollm/), THE Trust_Model SHALL mark it as trusted by default
3. WHEN a hook is from a workspace directory (.ollm/), THE Trust_Model SHALL require explicit user approval
4. WHEN a hook is from a downloaded extension, THE Trust_Model SHALL require explicit user approval
5. WHEN an untrusted hook is encountered, THE Trust_Model SHALL prompt the user for approval
6. WHEN a user approves a hook, THE Trust_Model SHALL compute a hash of the hook script and store it in trusted-hooks.json
7. WHEN a previously approved hook is encountered, THE Trust_Model SHALL verify its hash matches the stored hash
8. IF a hook's hash has changed, THEN THE Trust_Model SHALL prompt the user for re-approval
9. THE Trust_Model SHALL store approval metadata including source path, hash, timestamp, and approver

### Requirement 4: Extension Discovery and Loading

**User Story:** As a user, I want extensions to be automatically discovered and loaded, so that I can easily add functionality to the CLI.

#### Acceptance Criteria

1. WHEN the CLI starts, THE Extension_Manager SHALL scan user extension directories (~/.ollm/extensions/)
2. WHEN the CLI starts, THE Extension_Manager SHALL scan workspace extension directories (.ollm/extensions/)
3. WHEN an extension directory is found, THE Extension_Manager SHALL look for a manifest.json file
4. WHEN a manifest is found, THE Extension_Manager SHALL parse and validate it against the manifest schema
5. IF a manifest is invalid, THEN THE Extension_Manager SHALL log an error and skip that extension
6. WHEN an extension is loaded, THE Extension_Manager SHALL register its hooks with the Hook_Registry
7. WHEN an extension is loaded, THE Extension_Manager SHALL register its MCP servers with the MCP_Client
8. WHEN an extension is loaded, THE Extension_Manager SHALL merge its settings with core configuration
9. THE Extension_Manager SHALL maintain a list of all discovered extensions with their enabled/disabled state

### Requirement 5: Extension Manifest Specification

**User Story:** As an extension developer, I want to declare my extension's capabilities in a manifest, so that the CLI knows how to integrate my extension.

#### Acceptance Criteria

1. THE Manifest SHALL include required fields: name, version, description
2. WHERE an extension provides MCP servers, THE Manifest SHALL include an mcpServers object with server configurations
3. WHERE an extension provides hooks, THE Manifest SHALL include a hooks object mapping events to hook commands
4. WHERE an extension requires settings, THE Manifest SHALL include a settings array with setting definitions
5. WHERE an extension provides skills, THE Manifest SHALL include a skills array with skill definitions
6. WHEN an MCP server is defined, THE Manifest SHALL specify the command, args, and optional env variables
7. WHEN a hook is defined, THE Manifest SHALL specify the hook name and command to execute
8. WHEN a setting is defined, THE Manifest SHALL specify the name, optional envVar, sensitive flag, and description
9. THE Extension_Manager SHALL validate all manifest fields against expected types and formats

### Requirement 6: Extension Enable and Disable

**User Story:** As a user, I want to enable or disable extensions without uninstalling them, so that I can control which extensions are active.

#### Acceptance Criteria

1. WHEN a user disables an extension, THE Extension_Manager SHALL unregister all hooks from that extension
2. WHEN a user disables an extension, THE Extension_Manager SHALL disconnect all MCP servers from that extension
3. WHEN a user disables an extension, THE Extension_Manager SHALL remove all tools provided by that extension
4. WHEN a user enables an extension, THE Extension_Manager SHALL register its hooks with the Hook_Registry
5. WHEN a user enables an extension, THE Extension_Manager SHALL start its MCP servers
6. WHEN a user enables an extension, THE Extension_Manager SHALL register its tools with the Tool_Registry
7. THE Extension_Manager SHALL persist the enabled/disabled state in configuration
8. WHEN the CLI restarts, THE Extension_Manager SHALL restore the previous enabled/disabled state for all extensions

### Requirement 7: MCP Client Connection Management

**User Story:** As a user, I want the CLI to connect to MCP servers and manage their lifecycle, so that I can use external tools seamlessly.

#### Acceptance Criteria

1. WHEN an MCP server is configured, THE MCP_Client SHALL start the server process with the specified command and args
2. THE MCP_Client SHALL support stdio transport for MCP communication
3. THE MCP_Client SHALL support SSE (Server-Sent Events) transport for MCP communication
4. THE MCP_Client SHALL support HTTP transport for MCP communication
5. WHEN an MCP server starts, THE MCP_Client SHALL establish a connection within the configured timeout
6. IF an MCP server fails to start, THEN THE MCP_Client SHALL log an error and mark the server as unavailable
7. WHEN an MCP server connection is established, THE MCP_Client SHALL request the list of available tools
8. WHEN an MCP server disconnects, THE MCP_Client SHALL remove its tools from the Tool_Registry
9. THE MCP_Client SHALL manage multiple MCP servers simultaneously
10. WHEN the CLI exits, THE MCP_Client SHALL gracefully disconnect all MCP servers

### Requirement 8: MCP Tool Schema Conversion

**User Story:** As a developer, I want MCP tools to appear as native tools, so that the agent can use them without special handling.

#### Acceptance Criteria

1. WHEN an MCP server provides a tool schema, THE MCP_Schema_Converter SHALL convert it to the internal ToolSchema format
2. THE MCP_Schema_Converter SHALL map MCP parameter types to internal parameter types
3. THE MCP_Schema_Converter SHALL preserve parameter descriptions and constraints
4. THE MCP_Schema_Converter SHALL handle optional and required parameters correctly
5. WHEN an MCP tool is invoked, THE Tool_Wrapper SHALL convert internal arguments to MCP format
6. WHEN an MCP tool returns a result, THE Tool_Wrapper SHALL convert the MCP response to internal format
7. IF an MCP tool returns an error, THEN THE Tool_Wrapper SHALL translate it to an internal error format
8. THE Tool_Registry SHALL list MCP tools alongside built-in tools with no distinction to the agent

### Requirement 9: Hook Execution Data Flow

**User Story:** As an extension developer, I want to receive relevant data for each hook event, so that my hooks can make informed decisions.

#### Acceptance Criteria

1. WHEN a session_start event occurs, THE Hook_Runner SHALL provide session_id in the hook input
2. WHEN a session_end event occurs, THE Hook_Runner SHALL provide session_id and messages in the hook input
3. WHEN a before_agent event occurs, THE Hook_Runner SHALL provide prompt and context in the hook input
4. WHEN an after_agent event occurs, THE Hook_Runner SHALL provide response and tool_calls in the hook input
5. WHEN a before_model event occurs, THE Hook_Runner SHALL provide messages and model in the hook input
6. WHEN an after_model event occurs, THE Hook_Runner SHALL provide response and tokens in the hook input
7. WHEN a before_tool_selection event occurs, THE Hook_Runner SHALL provide available_tools in the hook input
8. WHEN a before_tool event occurs, THE Hook_Runner SHALL provide tool_name and args in the hook input
9. WHEN an after_tool event occurs, THE Hook_Runner SHALL provide tool_name and result in the hook input

### Requirement 10: Extension Settings Integration

**User Story:** As an extension developer, I want my extension settings to integrate with the CLI configuration system, so that users can configure my extension.

#### Acceptance Criteria

1. WHEN an extension declares settings, THE Extension_Manager SHALL add them to the configuration schema
2. WHERE a setting specifies an envVar, THE Extension_Manager SHALL read the value from that environment variable
3. WHERE a setting is marked sensitive, THE Extension_Manager SHALL redact it from logs and error messages
4. WHEN a user queries configuration, THE Extension_Manager SHALL include extension settings in the output
5. WHEN a user modifies an extension setting, THE Extension_Manager SHALL validate it against the setting definition
6. THE Extension_Manager SHALL provide extension settings to hooks and MCP servers via environment variables
7. IF a required setting is missing, THEN THE Extension_Manager SHALL log an error and disable the extension

### Requirement 11: Error Isolation and Recovery

**User Story:** As a user, I want hook and extension errors to be isolated, so that one failing extension doesn't break the entire CLI.

#### Acceptance Criteria

1. IF a hook throws an exception, THEN THE Hook_Runner SHALL catch it and log the error
2. IF a hook times out, THEN THE Hook_Runner SHALL terminate it and continue with remaining hooks
3. IF an MCP server crashes, THEN THE MCP_Client SHALL detect the failure and mark the server as unavailable
4. IF an MCP tool call fails, THEN THE Tool_Wrapper SHALL return an error result without crashing the CLI
5. IF an extension manifest is invalid, THEN THE Extension_Manager SHALL skip that extension and continue loading others
6. WHEN an error occurs in an extension, THE System SHALL display a clear error message identifying the extension
7. THE System SHALL continue normal operation after extension errors

### Requirement 12: Hook Execution Ordering

**User Story:** As an extension developer, I want to control the order in which my hooks execute, so that I can ensure dependencies are met.

#### Acceptance Criteria

1. WHEN multiple hooks are registered for the same event, THE Hook_Runner SHALL execute them in registration order
2. THE Hook_Registry SHALL maintain insertion order for hooks
3. WHERE an extension declares multiple hooks for the same event, THE Hook_Runner SHALL execute them in the order they appear in the manifest
4. WHEN hooks from multiple extensions are registered, THE Hook_Runner SHALL execute user extension hooks before workspace extension hooks
5. THE Hook_Runner SHALL execute all hooks for an event before proceeding with the next system action

### Requirement 13: MCP Server Environment Variables

**User Story:** As an extension developer, I want to pass environment variables to MCP servers, so that they can access configuration and secrets.

#### Acceptance Criteria

1. WHEN an MCP server is configured with env variables, THE MCP_Client SHALL set those variables in the server process environment
2. THE MCP_Client SHALL support variable substitution using ${VAR_NAME} syntax
3. WHEN a variable uses substitution syntax, THE MCP_Client SHALL replace it with the value from the parent process environment
4. IF a substituted variable is not found, THEN THE MCP_Client SHALL log a warning and use an empty string
5. THE MCP_Client SHALL inherit the parent process environment by default
6. WHERE an extension setting specifies an envVar, THE MCP_Client SHALL make that setting available to MCP servers

### Requirement 14: Extension Skills System

**User Story:** As an extension developer, I want to provide pre-defined prompts as skills, so that users can easily invoke common tasks.

#### Acceptance Criteria

1. WHEN an extension declares skills, THE Extension_Manager SHALL register them with the skill system
2. WHEN a user invokes a skill, THE System SHALL load the skill's prompt template
3. THE Skill SHALL include a name, description, and prompt template
4. THE System SHALL make skills discoverable via a list command
5. WHERE a skill prompt includes placeholders, THE System SHALL substitute them with user-provided values
6. THE System SHALL pass the rendered skill prompt to the agent for execution

### Requirement 15: Hook Output Processing

**User Story:** As a developer, I want hook output to influence system behavior, so that hooks can modify or enhance the CLI's operation.

#### Acceptance Criteria

1. WHEN a hook returns continue: false, THE System SHALL abort the current operation
2. WHEN a hook returns a systemMessage, THE System SHALL add it to the conversation context
3. WHEN a hook returns additional data, THE System SHALL make it available to subsequent hooks
4. WHEN multiple hooks return systemMessages, THE System SHALL concatenate them in execution order
5. THE System SHALL preserve hook output data throughout the event processing chain
6. IF a hook returns invalid output format, THEN THE System SHALL log an error and treat continue as true

### Requirement 16: Extension Directory Structure

**User Story:** As an extension developer, I want a clear directory structure for extensions, so that I know where to place files.

#### Acceptance Criteria

1. THE Extension SHALL have a root directory containing manifest.json
2. WHERE an extension has hooks, THE Extension MAY organize them in a hooks/ subdirectory
3. WHERE an extension has MCP servers, THE Extension MAY organize them in a servers/ subdirectory
4. WHERE an extension has skills, THE Extension MAY organize them in a skills/ subdirectory
5. THE Extension_Manager SHALL resolve relative paths in the manifest relative to the extension root directory
6. THE Extension_Manager SHALL support extensions with all files in the root directory
7. THE Extension_Manager SHALL support extensions with organized subdirectories

### Requirement 17: MCP Tool Invocation

**User Story:** As a user, I want MCP tools to be invoked seamlessly by the agent, so that I can use external tools without manual intervention.

#### Acceptance Criteria

1. WHEN the agent selects an MCP tool, THE Tool_Wrapper SHALL send the tool call to the appropriate MCP server
2. THE Tool_Wrapper SHALL wait for the MCP server response with a configurable timeout
3. IF the MCP server does not respond within the timeout, THEN THE Tool_Wrapper SHALL return a timeout error
4. WHEN the MCP server returns a result, THE Tool_Wrapper SHALL format it for display to the user
5. WHEN the MCP server returns an error, THE Tool_Wrapper SHALL format the error message for display
6. THE Tool_Wrapper SHALL handle streaming responses from MCP servers
7. THE Tool_Wrapper SHALL support MCP tools that return structured data

### Requirement 18: Hook Configuration

**User Story:** As a user, I want to configure hook behavior globally, so that I can control timeout, trust, and execution settings.

#### Acceptance Criteria

1. THE Configuration SHALL include a hooks.enabled setting to enable or disable all hooks
2. THE Configuration SHALL include a hooks.timeout setting to control hook execution timeout
3. THE Configuration SHALL include a hooks.trustWorkspace setting to auto-trust workspace hooks
4. WHEN hooks.enabled is false, THE Hook_Runner SHALL skip all hook execution
5. WHEN hooks.trustWorkspace is true, THE Trust_Model SHALL not prompt for workspace hook approval
6. THE Configuration SHALL allow per-extension hook configuration
7. THE System SHALL validate hook configuration values on startup

### Requirement 19: MCP Configuration

**User Story:** As a user, I want to configure MCP behavior globally, so that I can control connection settings and server management.

#### Acceptance Criteria

1. THE Configuration SHALL include an mcp.enabled setting to enable or disable MCP integration
2. THE Configuration SHALL include an mcp.connectionTimeout setting to control server connection timeout
3. THE Configuration SHALL include an mcp.servers object for direct MCP server configuration
4. WHEN mcp.enabled is false, THE MCP_Client SHALL not start any MCP servers
5. THE Configuration SHALL allow per-server configuration overrides
6. THE System SHALL validate MCP configuration values on startup
7. THE Configuration SHALL support both extension-provided and directly-configured MCP servers

### Requirement 20: Extension Configuration

**User Story:** As a user, I want to configure extension behavior globally, so that I can control loading and auto-enable settings.

#### Acceptance Criteria

1. THE Configuration SHALL include an extensions.enabled setting to enable or disable all extensions
2. THE Configuration SHALL include an extensions.directories array to specify extension search paths
3. THE Configuration SHALL include an extensions.autoEnable setting to control automatic enabling of new extensions
4. WHEN extensions.enabled is false, THE Extension_Manager SHALL not load any extensions
5. WHEN extensions.autoEnable is false, THE Extension_Manager SHALL require manual enabling of new extensions
6. THE Configuration SHALL allow per-extension enable/disable overrides
7. THE System SHALL validate extension configuration values on startup
