# Requirements Document: File Explorer UI

## Introduction

The File Explorer UI is a comprehensive workspace and file management system for OLLM CLI. It provides a VS Code-style multi-project workspace with file browsing, focus management, external editor integration, and vision support for images. The system enables users to navigate their filesystem, manage project contexts, and integrate file content with LLM interactions through a terminal-based interface.

## Glossary

- **File_Explorer**: The terminal UI component that displays the file tree and handles user interactions
- **Workspace**: A collection of projects defined in a `.ollm-workspace` JSON file
- **Project**: A directory with optional `.ollm-project` configuration file containing metadata
- **Focus_System**: The mechanism for pinning files to LLM context with content injection
- **Browse_Mode**: Navigation mode allowing access to the entire filesystem
- **Workspace_Mode**: Navigation mode restricted to workspace projects
- **Virtual_Scrolling**: Rendering technique that displays only visible items (15-item window)
- **Quick_Open**: Fuzzy search dialog for rapid file navigation (Ctrl+O)
- **Follow_Mode**: Automatic expansion to files referenced by the LLM
- **Vision_Service**: Component handling image processing and encoding for vision models
- **Editor_Integration**: System for spawning external text editors
- **Git_Status_Indicator**: Visual markers showing file modification state
- **Path_Sanitizer**: Security component that validates and rejects unsafe path operations

## Requirements

### Requirement 1: Workspace Management

**User Story:** As a developer, I want to manage multi-project workspaces, so that I can organize related projects and control LLM access to different codebases.

#### Acceptance Criteria

1. WHEN a `.ollm-workspace` file is present, THE Workspace_Manager SHALL parse it and load all configured projects
2. WHEN a project path in the workspace file is invalid, THE Workspace_Manager SHALL log a warning and skip that project
3. THE Workspace_Manager SHALL support project metadata including name, llmAccess flag, and exclude patterns
4. WHEN a user selects a project, THE Workspace_Manager SHALL mark it as the active project for LLM context
5. WHEN no workspace file exists, THE File_Explorer SHALL operate in Browse_Mode with full filesystem access

### Requirement 2: File Tree Navigation

**User Story:** As a user, I want to navigate the file tree efficiently, so that I can quickly locate and interact with files.

#### Acceptance Criteria

1. THE File_Explorer SHALL render a tree view using virtual scrolling with a 15-item visible window
2. WHEN a user presses 'j' or Down arrow, THE File_Explorer SHALL move the cursor to the next item
3. WHEN a user presses 'k' or Up arrow, THE File_Explorer SHALL move the cursor to the previous item
4. WHEN a user presses 'h' or Left arrow on a directory, THE File_Explorer SHALL collapse that directory
5. WHEN a user presses 'l' or Right arrow on a directory, THE File_Explorer SHALL expand that directory
6. THE File_Explorer SHALL display file and folder icons using Nerd Fonts
7. WHEN Git status is available, THE File_Explorer SHALL color-code items (green=new, yellow=modified, grey=ignored)

### Requirement 3: Focus System

**User Story:** As a user, I want to pin files to LLM context, so that the AI has access to relevant code during conversations.

#### Acceptance Criteria

1. WHEN a user focuses a file, THE Focus_System SHALL add it to the focused files list with a 📌 indicator
2. WHEN a focused file exceeds 8KB, THE Focus_System SHALL truncate the content and display a warning
3. THE Focus_System SHALL inject focused file content into LLM prompts before each turn
4. WHEN a user unfocuses a file, THE Focus_System SHALL remove it from the focused files list
5. THE File_Explorer SHALL display all focused files in a dedicated context section

### Requirement 4: File Operations

**User Story:** As a user, I want to perform file operations, so that I can manage my workspace without leaving the terminal.

#### Acceptance Criteria

1. WHEN a user creates a file or folder, THE File_Explorer SHALL validate the path and create the item
2. WHEN a user renames a file or folder, THE File_Explorer SHALL validate the new name and perform the rename
3. WHEN a user deletes a file or folder, THE File_Explorer SHALL display a confirmation dialog before deletion
4. WHEN a user copies a path, THE File_Explorer SHALL write the absolute path to the system clipboard
5. THE Path_Sanitizer SHALL reject any path containing `../` traversal sequences
6. WHEN a file operation fails, THE File_Explorer SHALL display an error message with the failure reason

### Requirement 5: Editor Integration

**User Story:** As a developer, I want to open files in my preferred editor, so that I can edit code with my familiar tools.

#### Acceptance Criteria

1. WHEN a user opens a file for editing, THE Editor_Integration SHALL spawn the editor specified in $EDITOR environment variable
2. WHEN $EDITOR is not set, THE Editor_Integration SHALL fall back to nano on Unix or notepad on Windows
3. WHEN the external editor exits, THE Editor_Integration SHALL reload the file content
4. THE File_Explorer SHALL provide a syntax-highlighted viewer component using shiki for read-only viewing
5. THE Syntax_Viewer SHALL support common programming languages and configuration formats

### Requirement 6: Vision and Image Support

**User Story:** As a user, I want to work with images in my projects, so that I can analyze visual content with vision-capable models.

#### Acceptance Criteria

1. WHEN an image file is detected, THE Vision_Service SHALL determine its dimensions
2. WHEN an image exceeds 2048 pixels in any dimension, THE Vision_Service SHALL resize it proportionally
3. THE Vision_Service SHALL encode images as base64 for vision model consumption
4. THE Vision_Service SHALL support JPEG, PNG, GIF, and WebP formats
5. WHEN an image format is unsupported, THE Vision_Service SHALL return an error message
6. WHERE screenshot capture is enabled, THE Screenshot_Service SHALL use browser automation to capture web pages

### Requirement 7: Quick Navigation

**User Story:** As a user, I want quick access to files, so that I can navigate large codebases efficiently.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+O, THE Quick_Open SHALL display a fuzzy search dialog
2. WHEN a user types in Quick_Open, THE Quick_Open SHALL filter files by fuzzy matching the input
3. WHEN a user selects a file from Quick_Open, THE File_Explorer SHALL navigate to and highlight that file
4. THE Quick_Actions_Menu SHALL provide options: Open, Focus, Edit, Rename, Delete, Copy Path
5. WHERE Follow_Mode is enabled, THE File_Explorer SHALL automatically expand to files referenced by the LLM

### Requirement 8: Git Integration

**User Story:** As a developer, I want to see git status in the file tree, so that I can track changes while browsing.

#### Acceptance Criteria

1. WHEN a directory is a git repository, THE Git_Status_Indicator SHALL query git status for all files
2. WHEN a file is untracked, THE Git_Status_Indicator SHALL display it in green
3. WHEN a file is modified, THE Git_Status_Indicator SHALL display it in yellow
4. WHEN a file is ignored, THE Git_Status_Indicator SHALL display it in grey
5. THE Git_Status_Indicator SHALL cache status results for 5 seconds to avoid excessive git calls

### Requirement 9: Performance and Scalability

**User Story:** As a user, I want the file explorer to remain responsive, so that I can work with large directories efficiently.

#### Acceptance Criteria

1. THE File_Explorer SHALL use virtual scrolling to render only visible items
2. WHEN a directory contains more than 1000 items, THE File_Explorer SHALL paginate or warn the user
3. THE File_Explorer SHALL debounce keyboard input to prevent excessive re-renders
4. THE File_Explorer SHALL lazy-load directory contents only when expanded
5. THE File_Explorer SHALL maintain a maximum memory footprint of 100MB for tree state

### Requirement 10: Security and Safety

**User Story:** As a user, I want safe file operations, so that I cannot accidentally damage my system or escape workspace boundaries.

#### Acceptance Criteria

1. THE Path_Sanitizer SHALL reject any path containing `../` sequences
2. THE Path_Sanitizer SHALL reject absolute paths outside the workspace when in Workspace_Mode
3. WHEN a destructive operation is requested, THE File_Explorer SHALL require explicit confirmation
4. THE File_Explorer SHALL validate file permissions before attempting operations
5. THE File_Explorer SHALL sanitize file content before injection into LLM prompts to prevent prompt injection

### Requirement 11: User Interface and Accessibility

**User Story:** As a user, I want a clear and intuitive interface, so that I can navigate and understand the file explorer easily.

#### Acceptance Criteria

1. THE File_Explorer SHALL display the current mode (Browse/Workspace) in the header
2. THE File_Explorer SHALL show keyboard shortcuts in a help panel accessible via '?'
3. THE File_Explorer SHALL provide visual feedback for all user actions within 100ms
4. THE File_Explorer SHALL display loading indicators for operations taking longer than 500ms
5. THE File_Explorer SHALL use consistent color schemes that work in both light and dark terminals

### Requirement 12: Configuration and Persistence

**User Story:** As a user, I want my file explorer preferences to persist, so that I don't have to reconfigure settings each session.

#### Acceptance Criteria

1. THE File_Explorer SHALL save expanded directory state to `.ollm/explorer-state.json`
2. THE File_Explorer SHALL restore expanded directories on startup
3. THE File_Explorer SHALL persist focused files list across sessions
4. THE File_Explorer SHALL save Quick_Open history for recent file access
5. WHEN configuration files are corrupted, THE File_Explorer SHALL reset to default state and log a warning
