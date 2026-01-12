# Requirements Document: Stage 6 - CLI and UI

## Introduction

This document specifies the requirements for the OLLM CLI interactive terminal user interface (TUI) and non-interactive execution modes. The system provides a full-featured React + Ink based interface with hybrid layout (tabs + collapsible side panel), GPU monitoring, performance metrics, reasoning model support, and comprehensive status tracking.

## Glossary

- **TUI**: Terminal User Interface - full-screen interactive terminal application
- **CLI**: Command-Line Interface - the executable entry point and argument parser
- **Tab**: A top-level navigation element in the UI (Chat, Tools, Files, Search, Docs, Settings)
- **Side_Panel**: Collapsible panel showing context files, git status, reviews, and active tools
- **Status_Bar**: Bottom bar displaying model, tokens, git, GPU, and cost information
- **GPU_Monitor**: Service tracking GPU temperature and VRAM usage
- **Slash_Command**: Interactive command starting with "/" (e.g., `/model list`)
- **Non_Interactive_Mode**: Single-prompt execution mode without TUI
- **Launch_Screen**: Initial branded screen with Llama animation and quick actions
- **Metrics_Display**: Performance statistics shown under each response
- **Reasoning_Box**: Nested scrollable container for model thinking process
- **Theme**: Color scheme and visual styling configuration
- **Session**: A conversation context with history and state
- **Snapshot**: Saved context state for rollover or resume

## Requirements

### Requirement 1: CLI Configuration and Initialization

**User Story:** As a developer, I want the CLI to load configuration from multiple sources with proper precedence, so that I can customize behavior at different levels.

#### Acceptance Criteria

1. WHEN the CLI starts, THE Config_Loader SHALL load settings from system defaults, user config, workspace config, environment variables, and CLI flags in that precedence order
2. WHEN a configuration file is invalid, THE Config_Loader SHALL display a clear error message with the file path and validation issue
3. WHEN configuration values conflict, THE Config_Loader SHALL apply the highest precedence value
4. THE Config_Loader SHALL validate all configuration against a JSON schema
5. WHEN required configuration is missing, THE Config_Loader SHALL use documented default values

### Requirement 2: GPU and VRAM Monitoring

**User Story:** As a user, I want to see GPU temperature and VRAM usage in real-time, so that I can monitor system resources during inference.

#### Acceptance Criteria

1. WHEN a GPU is available, THE GPU_Monitor SHALL detect the vendor (NVIDIA, AMD, Apple, or CPU-only)
2. WHEN polling is enabled, THE GPU_Monitor SHALL query GPU metrics every 5 seconds during active inference
3. WHEN GPU temperature exceeds 80°C, THE GPU_Monitor SHALL display a warning indicator
4. WHEN VRAM usage is queried, THE GPU_Monitor SHALL return total, used, and free VRAM in megabytes
5. WHEN no GPU is detected, THE GPU_Monitor SHALL display "CPU mode" without errors
6. THE GPU_Monitor SHALL support NVIDIA (nvidia-smi), AMD (rocm-smi), and Apple Silicon (ioreg) platforms

### Requirement 3: Non-Interactive Execution Mode

**User Story:** As a developer, I want to execute single prompts without the TUI, so that I can integrate the CLI into scripts and pipelines.

#### Acceptance Criteria

1. WHEN the `--prompt` flag is provided, THE CLI SHALL execute in non-interactive mode
2. WHEN non-interactive mode completes, THE CLI SHALL output the result and exit with code 0
3. WHEN `--output text` is specified, THE CLI SHALL output plain text response only
4. WHEN `--output json` is specified, THE CLI SHALL output a JSON object with response and metadata
5. WHEN `--output stream-json` is specified, THE CLI SHALL output NDJSON stream of events
6. WHEN an error occurs in non-interactive mode, THE CLI SHALL write error to stderr and exit with non-zero code
7. WHEN input is piped, THE CLI SHALL read from stdin as the prompt

### Requirement 4: Tab-Based Navigation

**User Story:** As a user, I want to navigate between different functional areas using tabs, so that I can access different features without losing context.

#### Acceptance Criteria

1. THE Tab_Bar SHALL display 6 tabs: Chat, Tools, Files, Search, Docs, and Settings
2. WHEN a user presses Ctrl+1 through Ctrl+6, THE Tab_Bar SHALL switch to the corresponding tab
3. WHEN a tab has notifications, THE Tab_Bar SHALL display a badge with the count
4. WHEN switching tabs, THE UI SHALL preserve the state of the previous tab
5. WHEN a tab is active, THE Tab_Bar SHALL highlight it visually

### Requirement 5: Collapsible Side Panel

**User Story:** As a user, I want a collapsible side panel showing context and status, so that I can see relevant information without cluttering the main view.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+P, THE Side_Panel SHALL toggle between visible and hidden states
2. WHEN the Side_Panel is visible, THE Side_Panel SHALL display sections for Context Files, Git Status, Pending Reviews, and Active Tools
3. WHEN the Side_Panel is hidden, THE main content SHALL expand to full width
4. WHEN relevant actions occur, THE Side_Panel SHALL auto-show (e.g., when a diff needs review)
5. THE Side_Panel SHALL persist visibility preference across sessions

### Requirement 6: Status Bar Display

**User Story:** As a user, I want a status bar showing key metrics, so that I can monitor system state at a glance.

#### Acceptance Criteria

1. THE Status_Bar SHALL display provider connection status with color indicators (🟢🟡🔴)
2. THE Status_Bar SHALL display current model name
3. THE Status_Bar SHALL display token usage in format "current/max"
4. THE Status_Bar SHALL display git branch and change counts
5. WHEN GPU is available, THE Status_Bar SHALL display temperature and VRAM usage
6. THE Status_Bar SHALL display pending review count when reviews exist
7. THE Status_Bar SHALL display estimated session cost
8. THE Status_Bar SHALL update all components in real-time

### Requirement 7: Chat Interface

**User Story:** As a user, I want to interact with the LLM through a chat interface, so that I can have natural conversations.

#### Acceptance Criteria

1. THE Chat_History SHALL display messages with role-based colors (user, assistant, system, tool)
2. WHEN the assistant is generating, THE Chat_History SHALL display streaming text incrementally
3. WHEN a tool is called, THE Chat_History SHALL display the tool name, arguments, and result
4. WHEN tool arguments exceed 80 characters, THE Chat_History SHALL wrap them with an expand option
5. WHEN waiting for first token, THE Chat_History SHALL display a spinner animation
6. WHEN a diff is small (≤5 lines), THE Chat_History SHALL display it inline
7. WHEN a diff is large (>5 lines), THE Chat_History SHALL show a summary and link to Tools tab

### Requirement 8: Llama Thinking Animation

**User Story:** As a user, I want to see a branded animation while waiting for responses, so that I know the system is working.

#### Acceptance Criteria

1. WHEN the state is WAITING_FOR_RESPONSE, THE Chat_History SHALL display the Llama animation
2. THE Llama_Animation SHALL use the "small" size (12 lines)
3. WHEN the animation displays, THE Chat_History SHALL scroll up by 20 lines to provide clean space
4. WHEN streaming starts, THE Llama_Animation SHALL unmount immediately
5. THE Llama_Animation SHALL use pixel art images or fallback to emoji

### Requirement 9: Tools Tab and Diff Review

**User Story:** As a user, I want to review and approve file changes, so that I can control what the LLM modifies.

#### Acceptance Criteria

1. THE Tools_Tab SHALL display a list of pending reviews with file names and line counts
2. WHEN a review is selected, THE Tools_Tab SHALL display the full diff with syntax highlighting
3. WHEN the user approves a diff, THE Tools_Tab SHALL apply the changes and remove it from pending
4. WHEN the user rejects a diff, THE Tools_Tab SHALL discard the changes and remove it from pending
5. THE Tools_Tab SHALL support batch approve and batch reject actions
6. THE Tools_Tab SHALL display tool execution history with expand/collapse

### Requirement 10: Files Tab

**User Story:** As a user, I want to manage context files and git status, so that I can control what information the LLM has access to.

#### Acceptance Criteria

1. THE Files_Tab SHALL display all @-mentioned context files
2. THE Files_Tab SHALL display git status with branch and change counts
3. WHEN a user selects a file, THE Files_Tab SHALL allow adding or removing it from context
4. THE Files_Tab SHALL provide quick git actions (commit, stash, diff)
5. THE Files_Tab SHALL update automatically when files change

### Requirement 11: Search Tab

**User Story:** As a user, I want to search the codebase semantically, so that I can find relevant code quickly.

#### Acceptance Criteria

1. THE Search_Tab SHALL provide a search input field
2. WHEN a search is executed, THE Search_Tab SHALL display results with code snippets
3. WHEN a result is selected, THE Search_Tab SHALL allow adding it to context
4. THE Search_Tab SHALL support filtering by file type
5. THE Search_Tab SHALL display a placeholder message indicating full implementation in Stage 11

### Requirement 12: Docs Tab

**User Story:** As a user, I want to browse documentation within the CLI, so that I can learn without leaving the interface.

#### Acceptance Criteria

1. THE Docs_Tab SHALL display a list of available documentation files in the side panel
2. WHEN a document is selected, THE Docs_Tab SHALL render the markdown content in the main area
3. THE Docs_Tab SHALL support keyboard navigation (j/k for scroll, Enter to select)
4. THE Docs_Tab SHALL support internal links between documents
5. THE Docs_Tab SHALL provide a back button to return to the previous document

### Requirement 13: Settings Tab

**User Story:** As a user, I want to configure the CLI and view session information, so that I can customize behavior and monitor usage.

#### Acceptance Criteria

1. THE Settings_Tab SHALL display a model picker with available models
2. THE Settings_Tab SHALL display a provider selector
3. THE Settings_Tab SHALL display a theme picker with built-in themes (Default Dark, Dracula, Nord, Monokai, Solarized Dark)
4. WHEN a theme is selected, THE Settings_Tab SHALL apply it immediately
5. THE Settings_Tab SHALL display session statistics (tokens, duration, cost)
6. THE Settings_Tab SHALL provide options for temperature, max tokens, and review mode
7. THE Settings_Tab SHALL provide quick actions (save, export, clear)

### Requirement 14: Launch Screen

**User Story:** As a user, I want to see a branded launch screen on startup, so that I have a welcoming entry point.

#### Acceptance Criteria

1. WHEN the CLI starts, THE Launch_Screen SHALL display the Llama animation in standard size
2. THE Launch_Screen SHALL display the version banner in a centered border box
3. THE Launch_Screen SHALL display documentation links and quick help
4. THE Launch_Screen SHALL display recent sessions with timestamps
5. WHEN any key is pressed, THE Launch_Screen SHALL dismiss and show the Chat tab
6. WHEN the `/home` command is executed, THE CLI SHALL return to the Launch_Screen

### Requirement 15: Performance Metrics Display

**User Story:** As a user, I want to see performance metrics for each response, so that I can understand inference speed and resource usage.

#### Acceptance Criteria

1. WHEN a response completes, THE Metrics_Display SHALL show tokens per second
2. THE Metrics_Display SHALL show input token count (📥)
3. THE Metrics_Display SHALL show output token count (📤)
4. THE Metrics_Display SHALL show total generation time
5. WHEN available, THE Metrics_Display SHALL show time to first token (TTFT)
6. WHEN compact mode is enabled, THE Metrics_Display SHALL show abbreviated metrics
7. WHEN metrics are disabled, THE Metrics_Display SHALL not render

### Requirement 16: Reasoning Model Support

**User Story:** As a user, I want to see the thinking process of reasoning models, so that I can understand how they arrive at answers.

#### Acceptance Criteria

1. WHEN a model outputs `<think>` blocks, THE Reasoning_Parser SHALL extract the thinking content
2. THE Reasoning_Box SHALL display thinking content in a nested scrollable container
3. THE Reasoning_Box SHALL show 8 lines visible with scroll for overflow
4. WHEN streaming, THE Reasoning_Box SHALL auto-scroll to follow new content
5. WHEN generation completes, THE Reasoning_Box SHALL auto-collapse and show token count and duration
6. WHEN the user clicks expand/collapse, THE Reasoning_Box SHALL toggle visibility
7. THE Reasoning_Box SHALL support Ctrl+R keyboard shortcut for toggle

### Requirement 17: Session Management Commands

**User Story:** As a developer, I want to manage sessions with commands, so that I can control context and state.

#### Acceptance Criteria

1. WHEN `/new` is executed, THE CLI SHALL prompt for confirmation before clearing
2. WHEN `/new` is confirmed, THE CLI SHALL save a snapshot, clear all context, and reset metrics
3. WHEN `/clear` is executed, THE CLI SHALL clear context but preserve the system prompt
4. WHEN `/compact` is executed, THE CLI SHALL trigger compression and display before/after token counts
5. WHEN `/session save` is executed, THE CLI SHALL persist the current session
6. WHEN `/session list` is executed, THE CLI SHALL display saved sessions
7. WHEN `/session resume <id>` is executed, THE CLI SHALL restore the specified session

### Requirement 18: Theme System

**User Story:** As a user, I want to customize the UI appearance, so that I can match my preferences.

#### Acceptance Criteria

1. THE Theme_System SHALL provide 5 built-in themes (Default Dark, Dracula, Nord, Monokai, Solarized Dark)
2. WHEN a user creates `~/.ollm/ui.yaml`, THE Theme_System SHALL deep-merge it over defaults
3. WHEN `/theme list` is executed, THE CLI SHALL display available themes
4. WHEN `/theme use <name>` is executed, THE CLI SHALL switch to the specified theme
5. WHEN `/theme preview <name>` is executed, THE CLI SHALL temporarily apply the theme without saving
6. THE Theme_System SHALL support customizing colors, typography, and keybinds

### Requirement 19: Slash Commands

**User Story:** As a user, I want to execute commands with slash syntax, so that I can perform actions without leaving the chat.

#### Acceptance Criteria

1. THE CLI SHALL recognize commands starting with "/" in the input
2. THE CLI SHALL support model commands (`/model list`, `/model use`, `/model pull`, `/model rm`, `/model info`)
3. THE CLI SHALL support provider commands (`/provider list`, `/provider use`)
4. THE CLI SHALL support session commands (`/session list`, `/session resume`, `/session delete`, `/session save`, `/session export`)
5. THE CLI SHALL support git commands (`/git status`, `/git commit`, `/git undo`)
6. THE CLI SHALL support review commands (`/review enable`, `/review disable`, `/review pending`)
7. THE CLI SHALL support extension commands (`/extensions list`, `/extensions enable`, `/extensions disable`)
8. THE CLI SHALL support theme commands (`/theme list`, `/theme use`, `/theme preview`)
9. THE CLI SHALL support context commands (`/context`, `/new`, `/clear`, `/compact`)
10. THE CLI SHALL support metrics commands (`/metrics`, `/metrics toggle`, `/metrics reset`)
11. THE CLI SHALL support reasoning commands (`/reasoning toggle`, `/reasoning expand`, `/reasoning collapse`)
12. THE CLI SHALL support utility commands (`/help`, `/exit`, `/home`)

### Requirement 20: Keyboard Shortcuts

**User Story:** As a user, I want keyboard shortcuts for common actions, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN Ctrl+1 through Ctrl+6 are pressed, THE CLI SHALL switch to the corresponding tab
2. WHEN Ctrl+P is pressed, THE CLI SHALL toggle the side panel
3. WHEN Ctrl+L is pressed, THE CLI SHALL clear the chat
4. WHEN Ctrl+S is pressed, THE CLI SHALL save the session
5. WHEN Ctrl+K is pressed, THE CLI SHALL open the command palette
6. WHEN Ctrl+/ is pressed, THE CLI SHALL toggle debug mode
7. WHEN Escape is pressed, THE CLI SHALL cancel current action or return to input
8. WHEN Up arrow is pressed in input, THE CLI SHALL cycle to previous message for editing
9. WHEN Enter is pressed, THE CLI SHALL send the message
10. WHEN Shift+Enter is pressed, THE CLI SHALL insert a newline
11. WHEN y or n is pressed in review mode, THE CLI SHALL approve or reject the diff
12. WHEN j or k is pressed in Docs tab, THE CLI SHALL scroll down or up
13. WHEN Tab is pressed, THE CLI SHALL cycle focus between UI elements

### Requirement 21: CLI Flags

**User Story:** As a developer, I want to control CLI behavior with flags, so that I can customize execution.

#### Acceptance Criteria

1. THE CLI SHALL support `--prompt` / `-p` for one-shot prompt execution
2. THE CLI SHALL support `--model` / `-m` for model selection
3. THE CLI SHALL support `--provider` for provider selection
4. THE CLI SHALL support `--host` for provider endpoint URL
5. THE CLI SHALL support `--list-models` for listing available models
6. THE CLI SHALL support `--pull-model <name>` for downloading models
7. THE CLI SHALL support `--remove-model <name>` for removing models
8. THE CLI SHALL support `--model-info <name>` for showing model details
9. THE CLI SHALL support `--output` / `-o` for output format (text, json, stream-json)
10. THE CLI SHALL support `--review-diffs` for enabling diff review mode
11. THE CLI SHALL support `--no-review` for disabling diff review mode
12. THE CLI SHALL support `--debug` for enabling debug output
13. THE CLI SHALL support `--no-color` for disabling colored output
14. THE CLI SHALL support `--config` / `-c` for custom config file path
15. THE CLI SHALL support `--session` / `-s` for resuming a session by ID
16. THE CLI SHALL support `--version` / `-v` for showing version
17. THE CLI SHALL support `--help` / `-h` for showing help

### Requirement 22: Error Handling and Validation

**User Story:** As a user, I want clear error messages when things go wrong, so that I can understand and fix issues.

#### Acceptance Criteria

1. WHEN configuration is invalid, THE CLI SHALL display the file path, line number, and specific validation error
2. WHEN a command is not recognized, THE CLI SHALL suggest similar commands
3. WHEN a required argument is missing, THE CLI SHALL display usage information
4. WHEN a provider connection fails, THE CLI SHALL display connection status and retry options
5. WHEN GPU monitoring fails, THE CLI SHALL fall back gracefully without crashing

### Requirement 23: UI Settings Customization

**User Story:** As a user, I want to customize UI settings, so that I can tailor the interface to my workflow.

#### Acceptance Criteria

1. THE UI_Settings SHALL support customizing theme colors (background, text, role, status, diff)
2. THE UI_Settings SHALL support customizing typography (bullets, checkmark, cross, arrow, spinner, borders)
3. THE UI_Settings SHALL support customizing keybinds for all shortcuts
4. WHEN a user creates `~/.ollm/ui.yaml`, THE UI_Settings SHALL load and merge it with defaults
5. THE UI_Settings SHALL validate custom settings and show errors for invalid values

### Requirement 24: Metrics Configuration

**User Story:** As a user, I want to configure metrics display, so that I can control what performance information is shown.

#### Acceptance Criteria

1. THE Metrics_Config SHALL support enabling/disabling metrics display
2. THE Metrics_Config SHALL support compact mode for abbreviated metrics
3. THE Metrics_Config SHALL support showing/hiding prompt tokens
4. THE Metrics_Config SHALL support showing/hiding time to first token
5. THE Metrics_Config SHALL support showing/hiding metrics in status bar
6. WHEN metrics are disabled, THE CLI SHALL not collect or display performance data

### Requirement 25: Reasoning Configuration

**User Story:** As a user, I want to configure reasoning display, so that I can control how thinking processes are shown.

#### Acceptance Criteria

1. THE Reasoning_Config SHALL support enabling/disabling reasoning display
2. THE Reasoning_Config SHALL support configuring maximum visible lines (default 8)
3. THE Reasoning_Config SHALL support auto-collapse on completion (default true)
4. WHEN reasoning is disabled, THE CLI SHALL not parse or display `<think>` blocks
5. WHEN auto-collapse is disabled, THE Reasoning_Box SHALL remain expanded after completion
