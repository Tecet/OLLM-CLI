# Platform-Specific Testing Guide

This guide provides instructions for testing OLLM CLI across different operating systems to ensure cross-platform compatibility.

## Overview

OLLM CLI is designed to work consistently across Windows, macOS, and Linux. This document outlines the testing procedures for each platform to verify functionality and identify platform-specific issues.

## Prerequisites

Before testing on any platform, ensure you have:

- Node.js 20.x or higher installed
- npm 10.x or higher installed
- Ollama or compatible LLM provider installed and running
- Git installed (for repository cloning)
- Terminal/command prompt access

## Testing on macOS

### Environment Setup

1. **Install Node.js:**
   ```bash
   # Using Homebrew
   brew install node@20
   
   # Or download from nodejs.org
   # https://nodejs.org/
   ```

2. **Install Ollama:**
   ```bash
   # Using Homebrew
   brew install ollama
   
   # Start Ollama service
   ollama serve
   ```

3. **Clone and Build:**
   ```bash
   git clone <repository-url>
   cd ollm-cli
   npm install
   npm run build
   ```

### Test Procedures

1. **Global Installation Test:**
   ```bash
   npm install -g .
   ollm --version
   ollm -p "Hello, world!"
   ```

2. **Path Handling Test:**
   ```bash
   # Test with various path formats
   ollm -p "List files in ~/Documents"
   ollm -p "Read file at ./README.md"
   ```

3. **Shell Command Test:**
   ```bash
   # Test shell tool with macOS-specific commands
   ollm -p "Run: ls -la"
   ollm -p "Run: which node"
   ```

4. **File Operations Test:**
   ```bash
   # Test file operations in different directories
   ollm -p "Create a test file in /tmp/ollm-test.txt"
   ollm -p "Read the file /tmp/ollm-test.txt"
   ```

5. **Configuration Test:**
   ```bash
   # Test user config location
   mkdir -p ~/.ollm
   echo "model:
  default: llama3.1:8b" > ~/.ollm/config.yaml
   ollm -p "What model are you using?"
   ```

### Platform-Specific Checks

- ✅ Verify Terminal.app compatibility
- ✅ Verify iTerm2 compatibility
- ✅ Test with zsh shell (default on macOS)
- ✅ Test with bash shell
- ✅ Verify GPU monitoring on Apple Silicon (M1/M2/M3)
- ✅ Test XDG config paths (if set)
- ✅ Verify file permissions handling

### Known Platform Issues

- Apple Silicon GPU monitoring requires Metal Performance Shaders
- Some terminal emulators may have limited color support
- File paths with spaces require proper quoting

---

## Testing on Linux

### Environment Setup

1. **Install Node.js:**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Fedora/RHEL
   sudo dnf install nodejs
   
   # Arch Linux
   sudo pacman -S nodejs npm
   ```

2. **Install Ollama:**
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Start Ollama service
   ollama serve
   ```

3. **Clone and Build:**
   ```bash
   git clone <repository-url>
   cd ollm-cli
   npm install
   npm run build
   ```

### Test Procedures

1. **Global Installation Test:**
   ```bash
   npm install -g .
   ollm --version
   ollm -p "Hello, world!"
   ```

2. **Path Handling Test:**
   ```bash
   # Test with various path formats
   ollm -p "List files in ~/Documents"
   ollm -p "Read file at ./README.md"
   ollm -p "List files in /tmp"
   ```

3. **Shell Command Test:**
   ```bash
   # Test shell tool with Linux-specific commands
   ollm -p "Run: ls -la"
   ollm -p "Run: which node"
   ollm -p "Run: cat /etc/os-release"
   ```

4. **File Operations Test:**
   ```bash
   # Test file operations in different directories
   ollm -p "Create a test file in /tmp/ollm-test.txt"
   ollm -p "Read the file /tmp/ollm-test.txt"
   ```

5. **Configuration Test:**
   ```bash
   # Test XDG config location (Linux standard)
   mkdir -p ~/.config/ollm
   echo "model:
  default: llama3.1:8b" > ~/.config/ollm/config.yaml
   ollm -p "What model are you using?"
   
   # Also test legacy location
   mkdir -p ~/.ollm
   echo "model:
  default: llama3.1:8b" > ~/.ollm/config.yaml
   ollm -p "What model are you using?"
   ```

### Platform-Specific Checks

- ✅ Verify GNOME Terminal compatibility
- ✅ Verify Konsole compatibility
- ✅ Verify xterm compatibility
- ✅ Test with bash shell
- ✅ Test with zsh shell
- ✅ Test with fish shell
- ✅ Verify NVIDIA GPU monitoring (nvidia-smi)
- ✅ Verify AMD GPU monitoring (rocm-smi)
- ✅ Test XDG Base Directory specification compliance
- ✅ Verify file permissions handling
- ✅ Test with different distributions (Ubuntu, Fedora, Arch)

### Known Platform Issues

- GPU monitoring requires nvidia-smi or rocm-smi to be in PATH
- Some distributions may require additional permissions for GPU access
- Terminal color support varies by terminal emulator
- XDG environment variables may not be set on all systems

---

## Testing on Windows

### Environment Setup

1. **Install Node.js:**
   - Download installer from https://nodejs.org/
   - Run installer and follow prompts
   - Verify installation:
     ```cmd
     node --version
     npm --version
     ```

2. **Install Ollama:**
   - Download installer from https://ollama.com/download/windows
   - Run installer and follow prompts
   - Verify Ollama is running in system tray

3. **Clone and Build:**
   ```cmd
   git clone <repository-url>
   cd ollm-cli
   npm install
   npm run build
   ```

### Test Procedures

1. **Global Installation Test:**
   ```cmd
   npm install -g .
   ollm --version
   ollm -p "Hello, world!"
   ```

2. **Path Handling Test:**
   ```cmd
   REM Test with various path formats
   ollm -p "List files in %USERPROFILE%\Documents"
   ollm -p "Read file at .\README.md"
   ollm -p "List files in C:\Temp"
   ```

3. **Shell Command Test:**
   ```cmd
   REM Test shell tool with Windows-specific commands
   ollm -p "Run: dir"
   ollm -p "Run: where node"
   ollm -p "Run: echo %PATH%"
   ```

4. **PowerShell Test:**
   ```powershell
   # Test with PowerShell commands
   ollm -p "Run: Get-ChildItem"
   ollm -p "Run: Get-Process | Select-Object -First 5"
   ```

5. **File Operations Test:**
   ```cmd
   REM Test file operations in different directories
   ollm -p "Create a test file in C:\Temp\ollm-test.txt"
   ollm -p "Read the file C:\Temp\ollm-test.txt"
   ```

6. **Configuration Test:**
   ```cmd
   REM Test user config location
   mkdir %USERPROFILE%\.ollm
   echo model: > %USERPROFILE%\.ollm\config.yaml
   echo   default: llama3.1:8b >> %USERPROFILE%\.ollm\config.yaml
   ollm -p "What model are you using?"
   ```

### Platform-Specific Checks

- ✅ Verify Command Prompt (cmd.exe) compatibility
- ✅ Verify PowerShell compatibility
- ✅ Verify Windows Terminal compatibility
- ✅ Test with Git Bash
- ✅ Verify NVIDIA GPU monitoring (Windows Performance Counters)
- ✅ Test with Windows-style paths (C:\, backslashes)
- ✅ Test with UNC paths (\\server\share)
- ✅ Verify file permissions handling
- ✅ Test with spaces in paths
- ✅ Verify USERPROFILE environment variable usage

### Known Platform Issues

- GPU monitoring uses Windows Performance Counters (different from Linux/macOS)
- Backslash path separators must be handled correctly
- Some terminal emulators have limited ANSI color support
- File paths with spaces require proper quoting
- PowerShell execution policy may block scripts

---

## Cross-Platform Test Matrix

| Feature | macOS | Linux | Windows | Notes |
|---------|-------|-------|---------|-------|
| Basic CLI execution | ✅ | ✅ | ✅ | |
| Interactive TUI | ✅ | ✅ | ✅ | |
| File operations | ✅ | ✅ | ✅ | |
| Shell commands | ✅ | ✅ | ⚠️ | Windows uses cmd/PowerShell |
| Path handling | ✅ | ✅ | ✅ | |
| Configuration loading | ✅ | ✅ | ✅ | |
| GPU monitoring | ✅ | ✅ | ✅ | Platform-specific APIs |
| Session recording | ✅ | ✅ | ✅ | |
| Hook system | ✅ | ✅ | ✅ | |
| MCP integration | ✅ | ✅ | ✅ | |

Legend:
- ✅ Fully supported
- ⚠️ Supported with limitations
- ❌ Not supported

---

## Automated Testing

### Running Tests on Each Platform

```bash
# Run full test suite
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- packages/core
npm test -- packages/cli
```

### Platform-Specific Test Flags

```bash
# Skip GPU tests if no GPU available
SKIP_GPU_TESTS=1 npm test

# Skip integration tests
npm test -- --testPathIgnorePatterns=integration

# Run only unit tests
npm test -- --testPathPattern=unit
```

---

## Continuous Integration

### GitHub Actions Matrix

The project uses GitHub Actions to test across multiple platforms:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [20.x, 22.x]
```

### Local Multi-Platform Testing

For maintainers with access to multiple platforms:

1. **Use Docker for Linux testing:**
   ```bash
   docker run -it --rm -v $(pwd):/app node:20 bash
   cd /app && npm install && npm test
   ```

2. **Use VMs for Windows testing:**
   - VirtualBox or VMware with Windows 10/11
   - Windows Subsystem for Linux (WSL) for Linux testing on Windows

3. **Use cloud CI services:**
   - GitHub Actions (free for public repos)
   - CircleCI
   - Travis CI

---

## Reporting Platform-Specific Issues

When reporting platform-specific issues, please include:

1. **Platform Information:**
   - Operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Terminal/shell being used

2. **OLLM CLI Information:**
   - OLLM CLI version (`ollm --version`)
   - Installation method (npm global, local build)

3. **Reproduction Steps:**
   - Exact commands run
   - Expected behavior
   - Actual behavior
   - Error messages (if any)

4. **Environment:**
   - Ollama version
   - GPU information (if relevant)
   - Any custom configuration

---

## Best Practices for Cross-Platform Development

1. **Always use `path.join()` and `path.resolve()`** instead of string concatenation
2. **Use `os.EOL`** for line endings when writing files
3. **Use `process.platform`** to detect platform and adapt behavior
4. **Test on all three major platforms** before releasing
5. **Use platform-agnostic APIs** from Node.js standard library
6. **Avoid shell-specific commands** in core functionality
7. **Handle path separators correctly** (use `path.sep`)
8. **Test with spaces in paths** on all platforms
9. **Use environment variables correctly** (HOME vs USERPROFILE)
10. **Document platform-specific behavior** clearly

---

## Resources

- [Node.js Platform Documentation](https://nodejs.org/api/os.html)
- [Path Module Documentation](https://nodejs.org/api/path.html)
- [Cross-Platform Node.js Guide](https://nodejs.org/en/docs/guides/)
- [Windows Terminal Documentation](https://docs.microsoft.com/en-us/windows/terminal/)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
