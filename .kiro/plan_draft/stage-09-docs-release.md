# Stage 09: Docs and Release

## Overview
Provide complete documentation and packaging. Make install and upgrade straightforward for end users.

## Prerequisites
- Stage 08 complete (Testing and QA)

## Estimated Effort
2-3 days

---

## Tasks

### S09-T01: Documentation

**Steps**:
1. Write README.md:
   - Project overview
   - Quick start guide
   - Installation instructions
   - Basic usage examples
   - Links to detailed docs
2. Write configuration reference:
   - All settings with descriptions
   - Environment variables
   - Config file locations
   - Example configurations
3. Write troubleshooting guide:
   - Common issues and solutions
   - Error message explanations
   - Debug mode usage
   - Getting help

**Deliverables**:
- `README.md`
- `docs/configuration.md`
- `docs/troubleshooting.md`

**Acceptance Criteria**:
- New users can install and run with minimal steps
- All configuration options documented
- Common issues have solutions

---

### S09-T02: Packaging

**Steps**:
1. Ensure build outputs single executable entry:
   - Bundle all dependencies
   - Minimize output size
   - Include source maps for debugging
2. Configure package metadata:
   - `bin` field in package.json
   - `files` field for npm publish
   - `engines` field for Node version
3. Verify global install:
   - `npm install -g` works
   - `ollm` command available
   - Permissions are correct
4. Test on multiple platforms:
   - macOS
   - Linux
   - Windows

**Deliverables**:
- Updated `packages/cli/package.json`
- Build outputs in `dist/`
- `.npmignore` or `files` configuration

**Acceptance Criteria**:
- `npm install -g` provides the `ollm` command
- Works on all major platforms
- Bundle size is reasonable

---

### S09-T03: Release Checklist

**Steps**:
1. Create versioning strategy:
   - Semantic versioning
   - Version bump scripts
   - Changelog generation
2. Create release notes template:
   - New features
   - Bug fixes
   - Breaking changes
   - Upgrade instructions
3. Document release process:
   - Pre-release checks
   - Build and test
   - Publish steps
   - Post-release verification

**Deliverables**:
- `docs/release-checklist.md`
- `CHANGELOG.md` template
- Version bump scripts

**Acceptance Criteria**:
- Release steps are documented
- Process is repeatable
- Changelog is maintained

---

## File Structure After Stage 09

```
repo/
├── README.md                 # Main readme
├── CHANGELOG.md              # Version history
├── LICENSE                   # License file
├── docs/
│   ├── configuration.md      # Config reference
│   ├── troubleshooting.md    # Troubleshooting guide
│   ├── compatibility.md      # Model compatibility (from Stage 08)
│   └── release-checklist.md  # Release process
├── packages/cli/
│   └── package.json          # With bin, files, engines
└── dist/
    └── cli.js                # Bundled output
```

---

## README Structure

```markdown
# OLLM CLI

Local-first CLI for open-source LLMs with tools, hooks, and MCP integration.

## Features

- 🖥️ Interactive TUI and non-interactive modes
- 🔧 Built-in tools for file, shell, and web operations
- 🪝 Hook system for automation
- 🔌 Extension and MCP support
- 💾 Session recording and resume
- 🔒 Safe tool execution with confirmations

## Quick Start

### Prerequisites
- Node.js 20+
- Ollama (or compatible LLM server)

### Installation
\`\`\`bash
npm install -g ollm-cli
\`\`\`

### Usage
\`\`\`bash
# Interactive mode
ollm

# One-shot prompt
ollm -p "Explain async/await in JavaScript"

# With specific model
ollm -m llama3.1:8b -p "Write a hello world in Python"
\`\`\`

## Documentation

- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Model Compatibility](docs/compatibility.md)

## License

MIT
```

---

## Configuration Reference Structure

```markdown
# Configuration Reference

## Config File Locations

| Location | Priority | Description |
|----------|----------|-------------|
| CLI flags | Highest | Command-line arguments |
| Environment | High | Environment variables |
| `.ollm/config.yaml` | Medium | Workspace config |
| `~/.ollm/config.yaml` | Low | User config |
| Defaults | Lowest | Built-in defaults |

## Settings

### model
- **Type**: string
- **Default**: (none)
- **Env**: `OLLM_MODEL`
- **Flag**: `--model, -m`
- **Description**: Default model to use

### provider
- **Type**: string
- **Default**: `ollama`
- **Env**: `OLLM_PROVIDER`
- **Flag**: `--provider`
- **Description**: LLM provider to use

[... more settings ...]

## Example Configuration

\`\`\`yaml
model: llama3.1:8b
provider: ollama
host: http://localhost:11434

options:
  temperature: 0.7
  maxTokens: 4096

ui:
  theme: dark
  showDebug: false

tools:
  shell:
    timeout: 30000
    confirmDangerous: true
\`\`\`
```

---

## Troubleshooting Guide Structure

```markdown
# Troubleshooting

## Connection Issues

### "Cannot connect to Ollama"

**Symptoms**: Error message about connection refused

**Solutions**:
1. Ensure Ollama is running: `ollama serve`
2. Check the host setting: `ollm --host http://localhost:11434`
3. Verify firewall settings

### "Model not found"

**Symptoms**: Error when trying to use a model

**Solutions**:
1. List available models: `ollm --list-models`
2. Pull the model: `ollm --pull-model llama3.1:8b`

## Tool Issues

### "Shell command timed out"

**Symptoms**: Tool execution stops after timeout

**Solutions**:
1. Increase timeout in config
2. Use background execution for long commands

[... more issues ...]

## Debug Mode

Enable debug output for detailed information:

\`\`\`bash
ollm --debug
\`\`\`

## Getting Help

- GitHub Issues: [link]
- Documentation: [link]
```

---

## Release Checklist Structure

```markdown
# Release Checklist

## Pre-Release

- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Documentation updated

## Release

- [ ] Create git tag: `git tag vX.X.X`
- [ ] Push tag: `git push origin vX.X.X`
- [ ] Publish to npm: `npm publish`
- [ ] Create GitHub release with notes

## Post-Release

- [ ] Verify npm package: `npm info ollm-cli`
- [ ] Test global install: `npm install -g ollm-cli`
- [ ] Verify `ollm --version` shows new version
- [ ] Announce release (if applicable)

## Rollback (if needed)

- [ ] Unpublish from npm: `npm unpublish ollm-cli@X.X.X`
- [ ] Delete git tag: `git tag -d vX.X.X`
- [ ] Push tag deletion: `git push origin :refs/tags/vX.X.X`
```

---

## Package.json Updates

```json
{
  "name": "ollm-cli",
  "version": "0.1.0",
  "description": "Local-first CLI for open-source LLMs",
  "type": "module",
  "bin": {
    "ollm": "./dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": [
    "llm",
    "cli",
    "ollama",
    "ai",
    "local"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/user/ollm-cli"
  },
  "license": "MIT"
}
```

---

## Verification Checklist

- [ ] README is complete and accurate
- [ ] Quick start works for new users
- [ ] Configuration reference covers all settings
- [ ] Troubleshooting covers common issues
- [ ] Build produces single executable
- [ ] Global install works
- [ ] `ollm` command is available after install
- [ ] Works on macOS
- [ ] Works on Linux
- [ ] Works on Windows
- [ ] Release checklist is complete
- [ ] CHANGELOG template exists
