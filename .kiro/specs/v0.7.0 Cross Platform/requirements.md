# Requirements Document: Cross-Platform Support

## Introduction

This document specifies the requirements for ensuring OLLM CLI works consistently across Windows, macOS, and Linux operating systems. The system must handle platform-specific differences in file paths, shell execution, GPU monitoring, and terminal capabilities while maintaining a unified user experience.

## Glossary

- **Platform_Detector**: Component that identifies the operating system and platform-specific capabilities
- **Config_Path_Manager**: Component that resolves configuration file locations according to platform conventions
- **GPU_Monitor**: Component that queries GPU information using platform-specific tools
- **Terminal_Capability_Detector**: Component that identifies terminal features (color, Unicode support)
- **Shell_Executor**: Component that executes shell commands using platform-appropriate shells
- **Path_Normalizer**: Component that handles path separators and conversions
- **XDG**: X Desktop Group specification for Linux directory structure
- **AppData**: Windows application data directory structure
- **VRAM**: Video Random Access Memory (GPU memory)

## Requirements

### Requirement 1: Platform Detection

**User Story:** As a developer, I want the system to automatically detect the operating system, so that platform-specific behavior is applied correctly.

#### Acceptance Criteria

1. WHEN the system starts, THE Platform_Detector SHALL identify whether the OS is Windows, macOS, or Linux
2. WHEN the platform is Windows, THE Platform_Detector SHALL set the default shell to cmd.exe with flag /c
3. WHEN the platform is macOS or Linux, THE Platform_Detector SHALL set the default shell to /bin/sh with flag -c
4. WHEN the platform is Windows, THE Platform_Detector SHALL set the Python command to python
5. WHEN the platform is macOS or Linux, THE Platform_Detector SHALL set the Python command to python3
6. THE Platform_Detector SHALL expose boolean flags for isWindows, isMac, and isLinux

### Requirement 2: Configuration Path Resolution

**User Story:** As a user, I want my configuration files stored in the standard location for my operating system, so that the application follows platform conventions.

#### Acceptance Criteria

1. WHEN the platform is Windows, THE Config_Path_Manager SHALL store configuration in %APPDATA%\ollm
2. WHEN the platform is Windows, THE Config_Path_Manager SHALL store cache in %LOCALAPPDATA%\ollm\cache
3. WHEN the platform is macOS, THE Config_Path_Manager SHALL store configuration in ~/Library/Application Support/ollm
4. WHEN the platform is macOS, THE Config_Path_Manager SHALL store cache in ~/Library/Caches/ollm
5. WHEN the platform is Linux, THE Config_Path_Manager SHALL store configuration in $XDG_CONFIG_HOME/ollm or ~/.config/ollm
6. WHEN the platform is Linux, THE Config_Path_Manager SHALL store data in $XDG_DATA_HOME/ollm or ~/.local/share/ollm
7. WHEN the platform is Linux, THE Config_Path_Manager SHALL store cache in $XDG_CACHE_HOME/ollm or ~/.cache/ollm
8. WHEN a legacy ~/.ollm directory exists, THE Config_Path_Manager SHALL support reading from it for backward compatibility

### Requirement 3: Terminal Capability Detection

**User Story:** As a user, I want the CLI to adapt its output to my terminal's capabilities, so that I see appropriate formatting and characters.

#### Acceptance Criteria

1. WHEN the terminal is not a TTY, THE Terminal_Capability_Detector SHALL disable color output
2. WHEN the NO_COLOR environment variable is set, THE Terminal_Capability_Detector SHALL disable color output
3. WHEN COLORTERM is set to truecolor or 24bit, THE Terminal_Capability_Detector SHALL enable true color support
4. WHEN TERM contains 256color, THE Terminal_Capability_Detector SHALL enable 256-color support
5. WHEN the platform is Windows and WT_SESSION is set, THE Terminal_Capability_Detector SHALL enable Unicode support
6. WHEN the platform is Windows and ConEmuANSI is set, THE Terminal_Capability_Detector SHALL enable Unicode support
7. WHEN the platform is Windows and TERM_PROGRAM is set, THE Terminal_Capability_Detector SHALL enable Unicode support
8. WHEN the platform is macOS or Linux, THE Terminal_Capability_Detector SHALL enable Unicode support by default
9. WHEN Unicode is not supported, THE Terminal_Capability_Detector SHALL provide ASCII fallback characters for icons

### Requirement 4: GPU Monitoring Cross-Platform

**User Story:** As a user, I want GPU information to be available regardless of my operating system, so that context management can optimize memory usage.

#### Acceptance Criteria

1. WHEN the platform is Windows, THE GPU_Monitor SHALL attempt to execute nvidia-smi.exe from standard Windows locations
2. WHEN the platform is Windows and NVIDIA_SMI_PATH is set, THE GPU_Monitor SHALL use that path first
3. WHEN the platform is Linux, THE GPU_Monitor SHALL attempt to execute nvidia-smi for NVIDIA GPUs
4. WHEN the platform is Linux and nvidia-smi fails, THE GPU_Monitor SHALL attempt to execute rocm-smi for AMD GPUs
5. WHEN the platform is macOS, THE GPU_Monitor SHALL return limited GPU information for Apple Silicon
6. WHEN GPU monitoring tools are unavailable, THE GPU_Monitor SHALL return a CPU fallback with available set to false
7. WHEN GPU monitoring fails, THE GPU_Monitor SHALL not throw errors but return fallback information

### Requirement 5: Shell Command Execution

**User Story:** As a user, I want to execute shell commands that work correctly on my operating system, so that tool execution is reliable.

#### Acceptance Criteria

1. WHEN executing a shell command on Windows, THE Shell_Executor SHALL use cmd.exe with the /c flag
2. WHEN executing a shell command on macOS or Linux, THE Shell_Executor SHALL use /bin/sh with the -c flag
3. WHEN executing Python code on Windows, THE Shell_Executor SHALL use the python command
4. WHEN executing Python code on macOS or Linux, THE Shell_Executor SHALL use the python3 command
5. WHEN a shell command is executed, THE Shell_Executor SHALL create temporary files with platform-appropriate line endings

### Requirement 6: Path Normalization

**User Story:** As a developer, I want paths to be handled consistently regardless of input format, so that file operations work across platforms.

#### Acceptance Criteria

1. WHEN displaying a path to the user, THE Path_Normalizer SHALL convert all backslashes to forward slashes
2. WHEN performing file operations, THE Path_Normalizer SHALL use the native path separator for the platform
3. WHEN joining path components, THE Path_Normalizer SHALL use the platform-appropriate separator
4. WHEN resolving relative paths, THE Path_Normalizer SHALL handle both forward slashes and backslashes in input
5. WHEN constructing absolute paths, THE Path_Normalizer SHALL use platform-native separators

### Requirement 7: Cross-Platform Testing

**User Story:** As a developer, I want automated tests to run on all supported platforms, so that platform-specific bugs are caught early.

#### Acceptance Criteria

1. WHEN CI runs, THE test suite SHALL execute on Windows, macOS, and Linux
2. WHEN CI runs, THE test suite SHALL execute on Node.js versions 18, 20, and 22
3. WHEN platform detection tests run, THE tests SHALL verify correct values for the current platform
4. WHEN config path tests run, THE tests SHALL verify correct paths for the current platform
5. WHEN path normalization tests run, THE tests SHALL verify handling of mixed separators

### Requirement 8: Graceful Degradation

**User Story:** As a user, I want the application to work even when platform-specific features are unavailable, so that I can use core functionality everywhere.

#### Acceptance Criteria

1. WHEN GPU monitoring is unavailable, THE system SHALL continue operating with CPU-only mode
2. WHEN Unicode is not supported, THE system SHALL use ASCII fallback characters
3. WHEN color is not supported, THE system SHALL display plain text output
4. WHEN platform-specific tools are missing, THE system SHALL log a warning and continue with fallback behavior
5. WHEN environment variables are not set, THE system SHALL use sensible defaults

### Requirement 9: Environment Variable Support

**User Story:** As a user, I want to override platform defaults using environment variables, so that I can customize behavior for my setup.

#### Acceptance Criteria

1. WHEN NVIDIA_SMI_PATH is set, THE GPU_Monitor SHALL use that path for nvidia-smi
2. WHEN NO_COLOR is set, THE system SHALL disable color output
3. WHEN FORCE_COLOR is set, THE system SHALL enable color output
4. WHEN XDG_CONFIG_HOME is set on Linux, THE Config_Path_Manager SHALL use it for configuration
5. WHEN XDG_DATA_HOME is set on Linux, THE Config_Path_Manager SHALL use it for data
6. WHEN XDG_CACHE_HOME is set on Linux, THE Config_Path_Manager SHALL use it for cache

### Requirement 10: Consistent User Experience

**User Story:** As a user, I want the same features and commands to work on all platforms, so that I can use the tool consistently.

#### Acceptance Criteria

1. THE system SHALL provide the same CLI commands on Windows, macOS, and Linux
2. THE system SHALL provide the same configuration options on all platforms
3. THE system SHALL provide the same tool capabilities on all platforms
4. WHEN displaying file paths, THE system SHALL use forward slashes for consistency
5. WHEN a feature is platform-specific, THE system SHALL document the limitation clearly
