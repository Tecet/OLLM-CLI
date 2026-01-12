# Requirements Document: CLI and UI

## Introduction

This document specifies the requirements for the OLLM CLI interactive terminal user interface (TUI) and non-interactive execution modes. The system provides a hybrid layout with tabs and a collapsible side panel, comprehensive status monitoring including GPU/VRAM tracking, and a full-featured command-line interface for local LLM interaction.

## Glossary

- **TUI**: Terminal User Interface - a text-based user interface rendered in the terminal
- **CLI**: Command-Line Interface - the command-line argument parser and non-interactive execution mode
- **Tab**: A top-level navigation element that switches the main content area
- **Side_Panel**: A collapsible panel on the right side showing contextual information
- **Status_Bar**: The bottom bar displaying system status, model info, and metrics
- **GPU_Monitor**: Service that tracks GPU temperature and VRAM usage
- **Diff_Review**: Interface for reviewing and approving file changes before application
- **Launch_Screen**: The initial screen displayed on startup with ASCII art and quick actions
- **Slash_Command**: Interactive commands prefixed with `/` for system operations
- **Non_Interactive_Mode**: Single-prompt execution mode that outputs results and exits
- **Streaming_Indicator**: Visual feedback showing the model is generating a response
- **Tool_Call**: Display of a tool execution with arguments and results
- **Context_File**: A file that has been @-mentioned and added to the conversation context

## Requirements

### Requirement 1: Configuration Management

**User Story:** As a developer, I want layered configuration resolution, so that I can customize settings at different levels with clear precedence.

#### Acceptance Criteria

1. WHEN the system loads configuration, THE Config_Loader SHALL merge settings from system defaults, user config, workspace config, environment variables, and CLI flags in that precedence order
2. WHEN a configuration file contains invalid YAML or JSON, THE Config_Loader SHALL display a clear error message indicating the file path and validation error
3. WHEN a configuration value violates the JSON schema, THE Config_Loader SHALL display a clear error message indicating which setting is invalid and why
4. WHEN multiple configuration layers define the same setting, THE Config_Loader SHALL use the value from the highest precedence layer
5. THE Config_Loader SHALL validate all configuration values against the JSON schema before application

### Requirement 2: GPU Monitoring

**User Story:** As a developer, I want to monitor GPU temperature and VRAM usage, so that I can understand resource utilization during model inference.

#### Acceptance Criteria

1. WHEN the GPU_Monitor queries GPU information on NVIDIA hardware, THE GPU_Monitor SHALL execute nvidia-smi and parse temperature, VRAM total, VRAM used, and GPU utilization
2. WHEN the GPU_Monitor queries GPU information on AMD hardware, THE GPU_Monitor SHALL execute rocm-smi and parse temperature, VRAM total, VRAM used, and GPU utilization
3. WHEN the GPU_Monitor queries GPU information on Apple Silicon, THE GPU_Monitor SHALL use ioreg or fallback to display "CPU mode"
4. WHEN GPU hardware is not available, THE GPU_Monitor SHALL report vendor as "cpu" and available as false
5. WHEN the GPU_Monitor is started with polling enabled, THE GPU_Monitor SHALL query GPU information at the specified interval
6. WHEN GPU temperature exceeds the configured threshold, THE GPU_Monitor SHALL invoke the registered high temperature callback
7. WHEN available VRAM falls below the configured threshold, THE GPU_Monitor SHALL invoke the registered low VRAM callback
8. WHEN the GPU_Monitor is stopped, THE GPU_Monitor SHALL cease all polling operations

### Requirement 3: Non-Interactive Execution

**User Story:** As a developer, I want to execute single prompts from the command line, so that I can integrate OLLM into scripts and automation workflows.

#### Acceptance Criteria

1. WHEN the CLI is invoked with the --prompt flag, THE Non_Interactive_Runner SHALL execute a single turn with the provided prompt and exit
2. WHEN the output format is "text", THE Non_Interactive_Runner SHALL write the plain text response to stdout
3. WHEN the output format is "json", THE Non_Interactive_Runner SHALL write a JSON object containing the response to stdout
4. WHEN the output format is "stream-json", THE Non_Interactive_Runner SHALL write NDJSON events to stdout as they occur
5. WHEN an error occurs during non-interactive execution, THE Non_Interactive_Runner SHALL write the error message to stderr and exit with a non-zero exit code
6. WHEN input is piped to stdin, THE Non_Interactive_Runner SHALL read the piped content as the prompt

### Requirement 4: Tab Navigation

**User Story:** As a developer, I want to navigate between different functional areas using tabs, so that I can focus on specific tasks without clutter.

#### Acceptance Criteria

1. THE Tab_Bar SHALL display six tabs: Chat, Tools, Files, Search, Docs, and Settings
2. WHEN a user presses Ctrl+1 through Ctrl+6, THE Tab_Bar SHALL switch to the corresponding tab
3. WHEN a tab has pending items (reviews, running tools), THE Tab_Bar SHALL display a notification badge with the count
4. WHEN a user switches tabs, THE UI SHALL preserve the state of the previous tab
5. WHEN a user switches back to a tab, THE UI SHALL restore the preserved state

### Requirement 5: Side Panel

**User Story:** As a developer, I want a collapsible side panel showing contextual information, so that I can see relevant context without switching tabs.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+P, THE Side_Panel SHALL toggle between visible and hidden states
2. WHEN the Side_Panel is hidden, THE main content area SHALL expand to full width
3. THE Side_Panel SHALL display four sections: Context Files, Git Status, Pending Reviews, and Active Tools
4. WHEN a file is @-mentioned in chat, THE Side_Panel SHALL add it to the Context Files section
5. WHEN git status changes, THE Side_Panel SHALL update the Git Status section
6. WHEN a diff review is pending, THE Side_Panel SHALL update the Pending Reviews section with the count
7. WHEN a tool is executing, THE Side_Panel SHALL add it to the Active Tools section
8. WHEN the user closes the application, THE UI SHALL persist the Side_Panel visibility preference

### Requirement 6: Status Bar

**User Story:** As a developer, I want a status bar showing system metrics, so that I can monitor connection status, resource usage, and session information at a glance.

#### Acceptance Criteria

1. THE Status_Bar SHALL display provider connection status using colored indicators (green for connected, yellow for connecting, red for disconnected)
2. THE Status_Bar SHALL display the current model name
3. THE Status_Bar SHALL display token usage in the format "current/max"
4. THE Status_Bar SHALL display git status showing branch name and counts of staged and modified files
5. WHEN GPU information is available, THE Status_Bar SHALL display GPU temperature and VRAM usage in the format "temp°C used/total"
6. WHEN GPU information is not available, THE Status_Bar SHALL display "CPU mode"
7. THE Status_Bar SHALL display the count of pending reviews
8. THE Status_Bar SHALL display an estimated session cost
9. WHEN any status component changes, THE Status_Bar SHALL update in real-time

### Requirement 7: Chat Interface

**User Story:** As a developer, I want to view conversation history and send messages, so that I can interact with the LLM naturally.

#### Acceptance Criteria

1. THE Chat_History SHALL display messages with role-specific colors (user, assistant, system, tool)
2. WHEN the model is generating a response, THE Chat_Interface SHALL display a streaming indicator with animated spinner
3. WHEN streaming text arrives, THE Chat_Interface SHALL render it incrementally
4. WHEN a tool is called, THE Chat_Interface SHALL display the tool name, arguments, execution time, and result
5. WHEN tool arguments exceed 80 characters, THE Chat_Interface SHALL wrap them and provide an expand option
6. WHEN a file change is small (5 lines or fewer), THE Chat_Interface SHALL display an inline diff preview
7. WHEN a user presses Enter in the input box, THE Chat_Interface SHALL send the message
8. WHEN a user presses Shift+Enter in the input box, THE Chat_Interface SHALL insert a newline

### Requirement 8: Tools Tab

**User Story:** As a developer, I want to review and approve file changes, so that I can control what modifications are applied to my codebase.

#### Acceptance Criteria

1. THE Tools_Tab SHALL display a list of all pending diff reviews
2. WHEN a user selects a pending review, THE Tools_Tab SHALL display the full diff with added lines in green and removed lines in red
3. WHEN a user clicks Apply on a review, THE Tools_Tab SHALL apply the changes and remove the review from the pending list
4. WHEN a user clicks Reject on a review, THE Tools_Tab SHALL discard the changes and remove the review from the pending list
5. WHEN multiple reviews are pending, THE Tools_Tab SHALL provide "Apply All" and "Reject All" batch actions
6. THE Tools_Tab SHALL display tool execution history with expand/collapse functionality

### Requirement 9: Files Tab

**User Story:** As a developer, I want to manage context files and view git status, so that I can control what information the model has access to.

#### Acceptance Criteria

1. THE Files_Tab SHALL display all files that have been @-mentioned and added to context
2. THE Files_Tab SHALL display git status including branch name, staged files, and modified files
3. WHEN a user selects a file, THE Files_Tab SHALL provide options to remove it from context
4. THE Files_Tab SHALL provide quick git actions for commit, stash, and diff operations

### Requirement 10: Docs Tab

**User Story:** As a developer, I want to browse documentation within the CLI, so that I can learn about features without leaving the application.

#### Acceptance Criteria

1. THE Docs_Tab SHALL display a navigation list of available documentation files in the side panel
2. WHEN a user selects a document, THE Docs_Tab SHALL render the markdown content in the main area
3. WHEN a document contains internal links, THE Docs_Tab SHALL navigate to the linked document when clicked
4. WHEN a user presses j or k, THE Docs_Tab SHALL scroll down or up respectively
5. WHEN a user presses Enter on a navigation item, THE Docs_Tab SHALL open that document
6. WHEN a user presses Backspace, THE Docs_Tab SHALL return to the previous document

### Requirement 11: Settings Tab

**User Story:** As a developer, I want to configure model settings and view session information, so that I can customize behavior and track usage.

#### Acceptance Criteria

1. THE Settings_Tab SHALL display a model picker showing all available models
2. WHEN a user selects a model, THE Settings_Tab SHALL switch to that model for subsequent requests
3. THE Settings_Tab SHALL display session information including token count, duration, and estimated cost
4. THE Settings_Tab SHALL provide options to adjust temperature, max tokens, and review mode
5. WHEN a user changes an option, THE Settings_Tab SHALL apply the change immediately
6. THE Settings_Tab SHALL provide quick actions to save session, export session, and clear conversation

### Requirement 12: Launch Screen

**User Story:** As a developer, I want to see a welcoming launch screen on startup, so that I can quickly access recent sessions and understand available actions.

#### Acceptance Criteria

1. WHEN the application starts, THE Launch_Screen SHALL display ASCII art loaded from docs/OLLM_v01.txt
2. THE Launch_Screen SHALL display the application version number
3. THE Launch_Screen SHALL display a list of up to 3 recent sessions with titles and timestamps
4. THE Launch_Screen SHALL display quick action hints for common operations
5. WHEN a user presses any key, THE Launch_Screen SHALL dismiss and switch to the Chat tab
6. WHEN a user types /home, THE UI SHALL return to the Launch_Screen

### Requirement 13: Slash Commands

**User Story:** As a developer, I want to execute system commands using slash syntax, so that I can perform operations without leaving the chat interface.

#### Acceptance Criteria

1. WHEN a user types /model list, THE CLI SHALL display all available models
2. WHEN a user types /model use followed by a model name, THE CLI SHALL switch to that model
3. WHEN a user types /session list, THE CLI SHALL display all saved sessions
4. WHEN a user types /session resume followed by a session ID, THE CLI SHALL resume that session
5. WHEN a user types /git status, THE CLI SHALL display git status information
6. WHEN a user types /review enable, THE CLI SHALL enable diff review mode
7. WHEN a user types /review disable, THE CLI SHALL disable diff review mode
8. WHEN a user types /clear, THE CLI SHALL clear the conversation history
9. WHEN a user types /help, THE CLI SHALL display all available slash commands
10. WHEN a user types /exit, THE CLI SHALL exit the application

### Requirement 14: CLI Flags

**User Story:** As a developer, I want to configure the CLI using command-line flags, so that I can customize behavior for different use cases.

#### Acceptance Criteria

1. WHEN the CLI is invoked with --prompt or -p, THE CLI SHALL execute in non-interactive mode with the provided prompt
2. WHEN the CLI is invoked with --model or -m, THE CLI SHALL use the specified model
3. WHEN the CLI is invoked with --output or -o, THE CLI SHALL use the specified output format (text, json, stream-json)
4. WHEN the CLI is invoked with --list-models, THE CLI SHALL display all available models and exit
5. WHEN the CLI is invoked with --pull-model, THE CLI SHALL download the specified model
6. WHEN the CLI is invoked with --remove-model, THE CLI SHALL remove the specified model
7. WHEN the CLI is invoked with --model-info, THE CLI SHALL display details about the specified model
8. WHEN the CLI is invoked with --session or -s, THE CLI SHALL resume the specified session
9. WHEN the CLI is invoked with --debug, THE CLI SHALL enable debug output
10. WHEN the CLI is invoked with --no-color, THE CLI SHALL disable colored output
11. WHEN the CLI is invoked with --version or -v, THE CLI SHALL display the version number and exit
12. WHEN the CLI is invoked with --help or -h, THE CLI SHALL display help information and exit

### Requirement 15: Keyboard Shortcuts

**User Story:** As a developer, I want keyboard shortcuts for common actions, so that I can work efficiently without using a mouse.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+1 through Ctrl+6, THE UI SHALL switch to the corresponding tab
2. WHEN a user presses Ctrl+P, THE UI SHALL toggle the side panel visibility
3. WHEN a user presses Ctrl+L, THE UI SHALL clear the chat history
4. WHEN a user presses Ctrl+S, THE UI SHALL save the current session
5. WHEN a user presses Ctrl+K, THE UI SHALL open the command palette
6. WHEN a user presses Esc, THE UI SHALL cancel the current operation or return focus to the input box
7. WHEN a user presses Tab, THE UI SHALL cycle focus between interactive elements
8. WHEN a user is in the Docs tab and presses j or k, THE UI SHALL scroll down or up respectively

### Requirement 16: Theme

**User Story:** As a developer, I want a dark theme optimized for terminal use, so that the interface is comfortable for extended use.

#### Acceptance Criteria

1. THE UI SHALL use a dark background color (#0d1117) for the primary background
2. THE UI SHALL use role-specific colors for messages (user: #58a6ff, assistant: #7ee787, system: #a371f7, tool: #f0883e)
3. THE UI SHALL use status colors (success: #3fb950, warning: #d29922, error: #f85149, info: #58a6ff)
4. THE UI SHALL use diff colors (added: #2ea043, removed: #f85149)
5. THE UI SHALL ensure all text has sufficient contrast against backgrounds for readability

### Requirement 17: Error Handling

**User Story:** As a developer, I want clear error messages when operations fail, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN a configuration file fails to load, THE CLI SHALL display the file path and specific parsing error
2. WHEN a model fails to load, THE CLI SHALL display the model name and error reason
3. WHEN a tool execution fails, THE Chat_Interface SHALL display the tool name and error message
4. WHEN GPU monitoring fails, THE GPU_Monitor SHALL fall back to "CPU mode" without crashing
5. WHEN a slash command is invalid, THE CLI SHALL display available commands and usage examples
