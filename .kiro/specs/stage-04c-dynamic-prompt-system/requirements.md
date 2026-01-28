# Requirements Document: Dynamic Prompt System

## Introduction

The Dynamic Prompt System provides context-aware system prompt management with four distinct modes (Assistant, Planning, Developer, Tool) that automatically adapt based on conversation context. The system integrates with existing context management, tool execution, and UI components to provide intelligent mode switching, tool filtering, and clear visual feedback.

## Glossary

- **Mode**: A distinct operational state with specific persona, allowed tools, and prompt template
- **Assistant Mode**: General conversation mode with no tools
- **Planning Mode**: Research and design mode with read-only tools
- **Developer Mode**: Full implementation mode with all tools
- **Tool Mode**: Enhanced tool usage mode with detailed guidance
- **Context Analyzer**: Service that detects conversation context and recommends modes
- **Prompt Mode Manager**: Service that orchestrates mode transitions and prompt building
- **Mode Template**: Prompt template specific to a mode
- **Tool Filtering**: Restricting available tools based on current mode
- **Mode Transition**: Switching from one mode to another
- **Confidence Score**: Numerical measure of how well a mode fits the conversation context
- **Hysteresis**: Delay mechanism to prevent rapid mode switching

## Requirements

### Requirement 1: Mode Definitions

**User Story:** As a system, I want four distinct modes with clear personas and tool access, so that the LLM behaves appropriately for different tasks.

#### Acceptance Criteria

1. THE system SHALL support four modes: assistant, planning, developer, and tool
2. WHEN in assistant mode, THE system SHALL use the persona "Helpful AI Assistant" with no tools
3. WHEN in planning mode, THE system SHALL use the persona "Technical Architect & Planner" with read-only tools
4. WHEN in developer mode, THE system SHALL use the persona "Senior Software Engineer" with all tools
5. WHEN in tool mode, THE system SHALL use the persona "Senior Software Engineer + Tool Expert" with all tools and enhanced guidance
6. EACH mode SHALL have a unique icon: 💬 (assistant), 📋 (planning), 👨‍💻 (developer), 🔧 (tool)
7. EACH mode SHALL have a unique color: blue (assistant), yellow (planning), green (developer), cyan (tool)

### Requirement 2: Context Analysis

**User Story:** As a user, I want the system to automatically detect when to switch modes, so that I don't have to manually change modes.

#### Acceptance Criteria

1. WHEN analyzing a message, THE Context_Analyzer SHALL detect keywords for each mode
2. WHEN planning keywords are detected (plan, design, research, architecture), THE Context_Analyzer SHALL recommend planning mode
3. WHEN developer keywords are detected (implement, refactor, debug, function, class), THE Context_Analyzer SHALL recommend developer mode
4. WHEN assistant keywords are detected (what, why, explain, tell me), THE Context_Analyzer SHALL recommend assistant mode
5. WHEN tool usage is detected, THE Context_Analyzer SHALL recommend tool mode
6. THE Context_Analyzer SHALL calculate confidence scores for each mode (0.0 to 1.0)
7. THE Context_Analyzer SHALL analyze the last 5 messages for context
8. THE Context_Analyzer SHALL boost confidence for explicit mode requests (e.g., "switch to planning mode")

### Requirement 3: Mode Transitions

**User Story:** As a user, I want smooth mode transitions that don't switch too frequently, so that the conversation feels natural.

#### Acceptance Criteria

1. WHEN confidence for a new mode exceeds 0.7, THE Prompt_Mode_Manager SHALL switch to that mode
2. WHEN switching from assistant to planning, THE system SHALL require 0.7 confidence
3. WHEN switching from planning to developer, THE system SHALL require 0.8 confidence
4. WHEN switching from developer to planning, THE system SHALL require 0.6 confidence (easier to step back)
5. WHEN switching to tool mode, THE system SHALL require 0.9 confidence (explicit tool usage)
6. THE Prompt_Mode_Manager SHALL implement hysteresis with minimum 30 seconds between switches
7. THE Prompt_Mode_Manager SHALL implement cooldown with 10 seconds after each switch
8. WHEN a mode switch occurs, THE Prompt_Mode_Manager SHALL emit a 'mode-changed' event

### Requirement 4: Tool Filtering

**User Story:** As a user in planning mode, I want to be restricted from writing code, so that I focus on design before implementation.

#### Acceptance Criteria

1. WHEN in assistant mode, THE system SHALL provide no tools to the LLM
2. WHEN in planning mode, THE system SHALL provide only read-only tools: web_search, web_fetch, read_file, grep_search, file_search, list_directory, get_diagnostics
3. WHEN in planning mode, THE system SHALL deny write tools: write_file, fs_append, str_replace, delete_file
4. WHEN in planning mode, THE system SHALL deny execution tools: execute_pwsh, control_pwsh_process
5. WHEN in planning mode, THE system SHALL deny git tools: git\_\*
6. WHEN in developer mode, THE system SHALL provide all tools
7. WHEN in tool mode, THE system SHALL provide all tools with enhanced schemas
8. WHEN a tool is requested that's not allowed in current mode, THE system SHALL return an error explaining the restriction

### Requirement 5: Prompt Building

**User Story:** As a system, I want to build mode-specific prompts dynamically, so that the LLM receives appropriate instructions for each mode.

#### Acceptance Criteria

1. WHEN building a prompt for assistant mode, THE Prompt_Mode_Manager SHALL use the assistant template
2. WHEN building a prompt for planning mode, THE Prompt_Mode_Manager SHALL use the planning template with tool restrictions
3. WHEN building a prompt for developer mode, THE Prompt_Mode_Manager SHALL use the developer template with mandates
4. WHEN building a prompt for tool mode, THE Prompt_Mode_Manager SHALL use the developer template plus tool schemas
5. WHEN building any prompt, THE Prompt_Mode_Manager SHALL inject active skills
6. WHEN building any prompt, THE Prompt_Mode_Manager SHALL inject workspace context
7. WHEN building any prompt, THE Prompt_Mode_Manager SHALL inject available tool list
8. THE Prompt_Mode_Manager SHALL use SystemPromptBuilder for composition

### Requirement 6: UI Integration

**User Story:** As a user, I want to see the current mode in the UI, so that I know what the system can do.

#### Acceptance Criteria

1. WHEN displaying active context, THE UI SHALL show the current mode with icon and label
2. WHEN displaying active context, THE UI SHALL show the current persona
3. WHEN displaying active context, THE UI SHALL show allowed tools for the current mode
4. WHEN displaying active context, THE UI SHALL color-code the mode display
5. WHEN a mode change occurs, THE UI SHALL update immediately
6. THE UI SHALL display mode in the right panel under "Active Mode"
7. THE UI SHALL display persona under "Persona"
8. THE UI SHALL display allowed tools under "Active Tools"

### Requirement 7: Manual Mode Control

**User Story:** As a user, I want to manually switch modes, so that I can override automatic detection when needed.

#### Acceptance Criteria

1. WHEN the user runs `/mode assistant`, THE system SHALL switch to assistant mode
2. WHEN the user runs `/mode planning`, THE system SHALL switch to planning mode
3. WHEN the user runs `/mode developer`, THE system SHALL switch to developer mode
4. WHEN the user runs `/mode auto`, THE system SHALL enable automatic mode switching
5. WHEN the user runs `/mode status`, THE system SHALL display current mode and auto-switch status
6. WHEN manual mode is set, THE system SHALL disable automatic switching until `/mode auto` is run
7. WHEN switching modes manually, THE system SHALL rebuild the system prompt immediately
8. WHEN switching modes manually, THE system SHALL emit a 'mode-changed' event

### Requirement 8: HotSwap Integration

**User Story:** As a user, I want skill switching to work with the mode system, so that skills and modes are coordinated.

#### Acceptance Criteria

1. WHEN HotSwap is triggered, THE HotSwap_Service SHALL use Prompt_Mode_Manager to update skills
2. WHEN HotSwap is triggered, THE HotSwap_Service SHALL rebuild the prompt using Prompt_Mode_Manager
3. WHEN HotSwap is triggered, THE system SHALL switch to developer mode (skills imply implementation)
4. WHEN HotSwap is triggered, THE system SHALL emit both 'active-skills-updated' and 'mode-changed' events
5. WHEN HotSwap generates a snapshot, THE system SHALL use STATE_SNAPSHOT_PROMPT template
6. WHEN HotSwap reseeds context, THE system SHALL preserve the current mode
7. THE HotSwap_Service SHALL accept Prompt_Mode_Manager in its constructor
8. THE HotSwap_Service SHALL delegate prompt building to Prompt_Mode_Manager

### Requirement 9: Compression Integration

**User Story:** As a system, I want context compression to use structured snapshots, so that information is preserved efficiently.

#### Acceptance Criteria

1. WHEN compressing context, THE Compression_Service SHALL use STATE_SNAPSHOT_PROMPT template
2. WHEN compressing context, THE Compression_Service SHALL generate XML-formatted snapshots
3. WHEN compressing context, THE Compression_Service SHALL validate XML structure
4. WHEN compression completes, THE system SHALL rebuild the system prompt using Prompt_Mode_Manager
5. WHEN compression completes, THE system SHALL preserve the current mode
6. THE Compression_Service SHALL emit a 'compression-complete' event
7. THE system SHALL listen for 'compression-complete' and rebuild the prompt
8. THE XML snapshot SHALL include: overall_goal, key_knowledge, file_system_state, current_plan

### Requirement 10: Mode Persistence

**User Story:** As a user, I want my mode preference to persist across sessions, so that I don't have to reset it every time.

#### Acceptance Criteria

1. WHEN a mode is manually set, THE system SHALL save it to settings
2. WHEN the app starts, THE system SHALL load the last used mode from settings
3. WHEN auto-switch is disabled, THE system SHALL save that preference to settings
4. WHEN the app starts, THE system SHALL restore the auto-switch preference
5. THE system SHALL store mode preference in `~/.ollm/settings.json`
6. THE system SHALL default to assistant mode if no preference is saved
7. THE system SHALL default to auto-switch enabled if no preference is saved
8. WHEN a session is resumed, THE system SHALL use the mode from that session

### Requirement 11: Mode History

**User Story:** As a developer, I want to track mode changes over time, so that I can analyze usage patterns.

#### Acceptance Criteria

1. WHEN a mode change occurs, THE Prompt_Mode_Manager SHALL record it in mode history
2. EACH mode history entry SHALL include: timestamp, from_mode, to_mode, trigger (auto/manual), confidence
3. THE Prompt_Mode_Manager SHALL maintain the last 100 mode changes
4. WHEN requesting mode history, THE system SHALL return all recorded changes
5. WHEN running `/mode history`, THE system SHALL display recent mode changes
6. THE mode history SHALL be included in session metadata
7. THE mode history SHALL be saved with session data
8. THE mode history SHALL be restored when resuming a session

### Requirement 12: Error Handling

**User Story:** As a user, I want clear error messages when mode operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN mode detection fails, THE system SHALL log the error and continue with current mode
2. WHEN prompt building fails, THE system SHALL log the error and use a fallback prompt
3. WHEN tool filtering fails, THE system SHALL log the error and allow all tools
4. WHEN mode switching fails, THE system SHALL log the error and revert to previous mode
5. WHEN a restricted tool is requested, THE system SHALL return a clear error message explaining the restriction
6. THE error message SHALL include the current mode and why the tool is restricted
7. THE error message SHALL suggest switching to developer mode if appropriate
8. FOR ALL mode errors, the system SHALL not crash or lose conversation state
