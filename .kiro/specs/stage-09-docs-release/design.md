# Design Document: Documentation and Release

## Overview

This design outlines the documentation structure, content organization, and release process for OLLM CLI. The documentation system will provide comprehensive guides for users at all levels, from quick-start installation to advanced configuration. The release process will ensure consistent, high-quality releases with proper versioning, changelog maintenance, and cross-platform verification.

The design focuses on three main areas:

1. **User-facing documentation** - README, configuration reference, and troubleshooting guide
2. **Package distribution** - npm packaging with proper metadata and cross-platform support
3. **Release management** - versioning strategy, changelog maintenance, and release procedures

## Architecture

### Documentation Structure

```
ollm-cli/
├── README.md                      # Main entry point
├── CHANGELOG.md                   # Version history
├── LICENSE                        # MIT license
├── docs/
│   ├── configuration.md           # Complete config reference
│   ├── troubleshooting.md         # Common issues and solutions
│   ├── release-checklist.md       # Release procedures
│   ├── ROADMAP.md                 # Future development roadmap
│   ├── architecture.md            # (existing) System design
│   ├── context-management-plan.md # (existing) Context system
│   └── draft/                     # (existing) Development docs
├── packages/
│   ├── cli/
│   │   └── package.json           # CLI package metadata
│   ├── core/
│   │   └── package.json           # Core package metadata
│   └── ...
└── scripts/
    ├── version-bump.js            # Version management
    └── verify-release.js          # Post-release verification
```

### Documentation Hierarchy

1. **README.md** - Quick start and overview (5-minute read)
2. **Configuration Reference** - Complete settings documentation (reference)
3. **Troubleshooting Guide** - Problem-solving resource (as-needed)
4. **Roadmap** - Future development plans and feature timeline
5. **Release Checklist** - Maintainer procedures (internal)

### Package Distribution Flow

```
Source Code
    ↓
Build (esbuild)
    ↓
Bundle (dist/cli.js)
    ↓
Package (npm pack)
    ↓
Publish (npm publish)
    ↓
Install (npm install -g)
    ↓
Verify (ollm --version)
```

## Components and Interfaces

### Documentation Components

#### README.md Structure

````markdown
# OLLM CLI

[Badge: npm version] [Badge: license] [Badge: node version]

## Features

- Bullet list of key features with emojis

## Quick Start

### Prerequisites

- Node.js 20+
- Ollama or compatible provider

### Installation

```bash
npm install -g ollm-cli
```
````

### Basic Usage

```bash
ollm                    # Interactive mode
ollm -p "prompt"        # One-shot
ollm --model llama3.1   # Specific model
```

## Documentation

- Links to detailed docs

## Configuration

- Brief overview with link to full reference

## Development

- Setup instructions for contributors

## License

MIT

````

#### Configuration Reference Structure

```markdown
# Configuration Reference

## Overview
Configuration precedence and file locations

## Settings by Category

### Provider Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| provider | string | "ollama" | LLM provider |
| providerConfig.ollama.host | string | "http://localhost:11434" | Ollama endpoint |
| ... | ... | ... | ... |

### Model Settings
[Similar table format]

### Context Settings
[Similar table format]

### UI Settings
[Similar table format]

### Tool Settings
[Similar table format]

## Environment Variables
Complete list with OLLM_ prefix

## Configuration Files
- User config: ~/.ollm/settings.yaml
- Workspace config: .ollm/settings.yaml

## Examples
### Minimal Configuration
```yaml
model:
  name: llama3.1:8b
````

### Advanced Configuration

```yaml
[Complete example with all major settings]
```

````

#### Troubleshooting Guide Structure

```markdown
# Troubleshooting Guide

## Connection Issues

### Cannot connect to Ollama
**Symptoms:** Connection refused errors
**Cause:** Ollama not running or wrong host
**Solution:**
1. Start Ollama: `ollama serve`
2. Verify host: `ollm --host http://localhost:11434`
3. Check firewall settings

### Model not found
[Similar format]

## Installation Issues

### Global install fails
[Similar format]

### Permission errors
[Similar format]

## Tool Execution Issues

### Shell command timeout
[Similar format]

### File operation denied
[Similar format]

## Context Issues

### Out of memory
[Similar format]

### Context overflow
[Similar format]

## Debug Mode

Enable detailed logging:
```bash
ollm --debug
OLLM_LOG_LEVEL=debug ollm
````

## Getting Help

- GitHub Issues: [link]
- Documentation: [link]
- Community: [link]

````

#### Roadmap Document Structure

```markdown
# OLLM CLI Roadmap

## Overview

This document outlines the development roadmap for OLLM CLI, including completed features and planned future development stages.

## Current Status

**Latest Release:** v0.1.0
**Current Stage:** Stage 9 - Documentation and Release

## Completed Stages

### ✅ Stage 1-8: Core Features (Completed)

Brief summary of completed stages including:
- Interactive TUI and non-interactive modes
- Tool system with file, shell, and web operations
- Context management with VRAM monitoring
- Session recording and compression
- Hook system for automation
- MCP integration
- Testing and QA infrastructure

[Link to detailed documentation]

## Planned Future Development

### 🔮 Stage 10: Kraken Integration (Planned)

**Status:** Planned for future development
**Description:** External LLM provider integration for accessing powerful cloud models

**Key Features:**
- CLI bridge execution for terminal-based coding agents (Gemini CLI, Claude Code, Codex CLI)
- API provider integration (OpenAI, Anthropic, Google AI)
- Provider discovery and health checks
- Intelligent provider selection and auto-escalation
- Cost tracking and budget enforcement
- Context transfer between local and external models

[Link to detailed specification: .kiro/specs/stage-10-kraken-integration-future-dev/]

### 🔮 Stage 11: Developer Productivity Tools (Planned)

**Status:** Planned for future development
**Description:** Git integration, @-mentions, and diff review for Aider-like workflows

**Key Features:**
- Git operations tool (status, commit, diff, undo)
- @-mention syntax for explicit context loading (@file, @symbol, @url)
- Diff review mode with approve/reject workflow
- Auto-commit with semantic commit messages
- Git status in system prompt and status bar

[Link to detailed specification: .kiro/specs/stage-11-developer-productivity-future-dev/]

### 🔮 Stage 12: Cross-Platform Support (Planned)

**Status:** Planned for future development
**Description:** Comprehensive cross-platform compatibility for Windows, macOS, and Linux

**Key Features:**
- Platform detection and adaptation
- Configuration path resolution (XDG, AppData, Library)
- Terminal capability detection
- Cross-platform GPU monitoring
- Platform-specific shell execution
- Path normalization

[Link to detailed specification: .kiro/specs/stage-12-cross-platform-future-dev/]

### 🔮 Stage 13: Multi-Provider Support (Planned)

**Status:** Planned for future development
**Description:** vLLM and OpenAI-compatible provider adapters

**Key Features:**
- vLLM provider with high-performance features
- OpenAI-compatible provider (LM Studio, LocalAI, Kobold, llama.cpp)
- SSE stream parsing utility
- Provider registry with aliases
- Guided decoding support (vLLM-specific)
- Provider-specific options passthrough

[Link to detailed specification: .kiro/specs/stage-13-vllm-openai-future-dev/]

### 🔮 Stage 14: File Upload System (Planned)

**Status:** Planned for future development
**Description:** File sharing with LLM through terminal interface

**Key Features:**
- Multiple upload methods (slash commands, clipboard, drag-drop, @mentions)
- Session-scoped storage with automatic cleanup
- File deduplication with checksums
- Image processing for vision models
- Text file extraction and syntax highlighting
- Storage limits and retention policies

[Link to detailed specification: .kiro/specs/stage-14-file-upload-future-dev/]

### 🔮 Stage 15: Intelligence Layer (Planned)

**Status:** Planned for future development
**Description:** Advanced AI capabilities for large codebases

**Key Features:**
- Semantic codebase search with RAG
- Structured JSON output with schema enforcement
- Sandboxed code execution (JavaScript, Python, Bash)
- Vision and image analysis support
- Developer productivity tools (undo, export, copy, templates)
- Usage and cost tracking

[Link to detailed specification: .kiro/specs/stage-15-intelligence-layer-future-dev/]

## Timeline

**Note:** All future development stages are planned but not yet scheduled. Timeline will be determined based on:
- Community feedback and feature requests
- Resource availability
- Priority of features for user workflows
- Technical dependencies between stages

## Contributing

We welcome contributions to any planned feature! Please:
1. Review the detailed specification for the stage you're interested in
2. Open an issue to discuss your approach
3. Submit a pull request with your implementation

## Feedback

Have suggestions for the roadmap? Please open an issue with the "roadmap" label to share your thoughts.
````

### Package Configuration

#### package.json (CLI Package)

```json
{
  "name": "ollm-cli",
  "version": "0.1.0",
  "description": "Local-first CLI for open-source LLMs with tools, hooks, and MCP integration",
  "type": "module",
  "bin": {
    "ollm": "./dist/cli.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["llm", "cli", "ollama", "ai", "local", "mcp", "tools", "context-management"],
  "repository": {
    "type": "git",
    "url": "https://github.com/user/ollm-cli"
  },
  "bugs": {
    "url": "https://github.com/user/ollm-cli/issues"
  },
  "homepage": "https://github.com/user/ollm-cli#readme",
  "license": "MIT",
  "author": "Author Name",
  "scripts": {
    "version": "node scripts/version-bump.js && git add -A",
    "postversion": "git push && git push --tags"
  }
}
```

### Release Management Components

#### Version Bump Script

```javascript
// scripts/version-bump.js
// Updates version in all package.json files
// Updates CHANGELOG.md with new version section
// Commits changes with version tag
```

#### Release Verification Script

```javascript
// scripts/verify-release.js
// Checks npm registry for published version
// Performs test installation in temp directory
// Verifies ollm command works
// Runs basic smoke tests
```

#### Release Checklist Document

```markdown
# Release Checklist

## Pre-Release (Development)

- [ ] All tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

## Version Bump

- [ ] Determine version type (major/minor/patch)
- [ ] Run: npm version [major|minor|patch]
- [ ] Verify version in package.json files
- [ ] Verify CHANGELOG.md entry

## Build and Test

- [ ] Clean build: npm run clean && npm run build
- [ ] Run full test suite: npm test
- [ ] Test global install locally: npm install -g .
- [ ] Verify ollm command works
- [ ] Test on macOS (if available)
- [ ] Test on Linux (if available)
- [ ] Test on Windows (if available)

## Publish

- [ ] Ensure logged into npm: npm whoami
- [ ] Publish: npm publish
- [ ] Verify on npm: npm info ollm-cli

## Post-Release

- [ ] Create GitHub release with notes
- [ ] Test global install: npm install -g ollm-cli
- [ ] Verify version: ollm --version
- [ ] Run smoke test: ollm -p "test"
- [ ] Update documentation site (if applicable)
- [ ] Announce release (if applicable)

## Rollback (if needed)

- [ ] Deprecate version: npm deprecate ollm-cli@X.X.X "reason"
- [ ] Publish fixed version
- [ ] Update GitHub release notes
```

## Data Models

### CHANGELOG.md Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New features in development

### Changed

- Changes to existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security fixes

## [0.1.0] - 2024-01-15

### Added

- Initial release
- Interactive TUI mode
- Tool system with file, shell, and web tools
- Context management with VRAM monitoring
- Session recording and resume
- Hook system
- MCP integration
- Configuration system

[Unreleased]: https://github.com/user/ollm-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/user/ollm-cli/releases/tag/v0.1.0
```

### Release Notes Template

````markdown
# Release v{VERSION}

Released: {DATE}

## 🎉 Highlights

{Brief description of the most important changes}

## ✨ New Features

- Feature 1 description (#PR)
- Feature 2 description (#PR)

## 🐛 Bug Fixes

- Fix 1 description (#PR)
- Fix 2 description (#PR)

## 💥 Breaking Changes

- Breaking change 1 with migration guide
- Breaking change 2 with migration guide

## 📚 Documentation

- Documentation improvements

## 🔧 Internal

- Internal improvements (optional)

## 📦 Installation

```bash
npm install -g ollm-cli@{VERSION}
```
````

## 🔄 Upgrade Instructions

{Instructions for upgrading from previous version}

## 🙏 Contributors

Thanks to all contributors for this release!

````

### Version Metadata

```typescript
interface VersionInfo {
  version: string;           // Semantic version (e.g., "0.1.0")
  releaseDate: string;       // ISO date (e.g., "2024-01-15")
  type: 'major' | 'minor' | 'patch';
  changes: {
    added: string[];         // New features
    changed: string[];       // Changes to existing
    deprecated: string[];    // Soon to be removed
    removed: string[];       // Removed features
    fixed: string[];         // Bug fixes
    security: string[];      // Security fixes
  };
  breakingChanges: {
    description: string;
    migration: string;       // How to migrate
  }[];
}
````

### Package Metadata

```typescript
interface PackageInfo {
  name: string; // "ollm-cli"
  version: string; // Semantic version
  description: string; // Short description
  bin: Record<string, string>; // Command mappings
  files: string[]; // Files to include
  engines: {
    node: string; // Node version requirement
  };
  keywords: string[]; // Search keywords
  repository: {
    type: string;
    url: string;
  };
  license: string; // "MIT"
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: README Completeness

_For any_ README.md file in the repository root, it SHALL contain all required sections including project overview, features list, installation instructions, basic usage examples, links to detailed documentation, at least three code examples, and system requirements.

**Validates: Requirements 1.2, 1.3, 1.5, 1.6**

### Property 2: Configuration Documentation Completeness

_For any_ setting that exists in the codebase configuration schema, the configuration reference SHALL document that setting with its description, type, default value, and all methods of specification (CLI flag, environment variable, config file).

**Validates: Requirements 2.2, 2.3, 2.6**

### Property 3: Configuration Reference Structure

_For any_ configuration reference document, it SHALL include documentation of all configuration file locations with precedence order and at least two complete example configurations.

**Validates: Requirements 2.4, 2.5**

### Property 4: Troubleshooting Guide Completeness

_For any_ troubleshooting guide, it SHALL document at least five common issues with symptoms and solutions, include debug mode instructions, provide help resources, and include code examples for configuration-related solutions.

**Validates: Requirements 3.2, 3.4, 3.5, 3.6**

### Property 5: Bundle Dependency Completeness

_For any_ bundle created by the build process, it SHALL include all necessary dependencies and source maps for debugging.

**Validates: Requirements 4.4, 4.5**

### Property 6: Package Metadata Completeness

_For any_ package.json file in the CLI package, it SHALL include bin field mapping ollm command, files field, engines field with Node.js version, descriptive keywords array, repository URL, and license information.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 7: Package Files Inclusion

_For any_ package created by npm pack, the tarball SHALL contain only the files specified in the package.json files field.

**Validates: Requirements 5.6**

### Property 8: Platform-Agnostic Path Handling

_For any_ file path operation in the bundle, it SHALL use platform-agnostic path handling methods (e.g., path.join) rather than hardcoded separators.

**Validates: Requirements 6.4**

### Property 9: Platform-Agnostic Line Endings

_For any_ file write operation in the bundle, it SHALL use platform-appropriate line ending methods rather than hardcoded line endings.

**Validates: Requirements 6.5**

### Property 10: Platform Detection

_For any_ platform-specific behavior in the code, the system SHALL detect the platform using process.platform or equivalent and adapt behavior accordingly.

**Validates: Requirements 6.6**

### Property 11: Semantic Version Format

_For any_ version string in package.json files, it SHALL match the semantic versioning pattern (MAJOR.MINOR.PATCH with optional pre-release and build metadata).

**Validates: Requirements 7.1**

### Property 12: Version Synchronization

_For any_ version bump operation, all package.json files in the monorepo SHALL be updated to the same version number.

**Validates: Requirements 7.6**

### Property 13: CHANGELOG Format Compliance

_For any_ CHANGELOG.md file, it SHALL follow the Keep a Changelog format with version sections organized by version number and release date, including categories for Added, Changed, Deprecated, Removed, Fixed, and Security.

**Validates: Requirements 8.2, 8.3, 8.4**

### Property 14: Breaking Change Documentation

_For any_ CHANGELOG entry marked as a breaking change or in the "Removed" category, the entry SHALL include upgrade instructions or migration guidance.

**Validates: Requirements 8.5**

### Property 15: CHANGELOG Link References

_For any_ CHANGELOG entry, it SHOULD include links to relevant pull requests or issues using standard reference patterns (#123 or full URLs).

**Validates: Requirements 8.6**

### Property 16: Release Checklist Completeness

_For any_ release checklist document, it SHALL include sections for pre-release verification, build/test/publish commands, post-release verification, and rollback procedures.

**Validates: Requirements 9.2, 9.3, 9.4, 9.5**

### Property 17: Release Notes Structure

_For any_ release notes generated, they SHALL categorize changes into features, bug fixes, and breaking changes sections.

**Validates: Requirements 10.2**

### Property 18: Breaking Change Upgrade Instructions

_For any_ release notes containing breaking changes, they SHALL include upgrade instructions for users.

**Validates: Requirements 10.4**

### Property 19: Security Fix Indication

_For any_ release notes containing security fixes, they SHALL clearly mark or categorize those fixes as security-related.

**Validates: Requirements 10.6**

### Property 20: Verification Script Error Handling

_For any_ verification script, if a verification step fails, the script SHALL exit with a non-zero status code and report the specific failure.

**Validates: Requirements 11.6**

### Property 21: Code Example Syntax Validity

_For any_ code block in documentation files, the code SHALL be syntactically valid for its declared language.

**Validates: Requirements 12.1**

### Property 22: Documentation Accuracy

_For any_ CLI flag or configuration option documented in the documentation, that flag or option SHALL exist in the actual codebase.

**Validates: Requirements 12.2, 12.3**

### Property 23: Link Validity

_For any_ link in documentation files, if it's an internal link, the target file SHALL exist; if it's an external link, it SHOULD return a successful HTTP status code.

**Validates: Requirements 12.5, 12.6**

## Error Handling

### Documentation Errors

**Missing Required Sections:**

- Detection: Parse documentation structure and check for required headings
- Handling: Report missing sections with specific names
- Recovery: Provide template for missing sections

**Invalid Code Examples:**

- Detection: Extract code blocks and run syntax validation
- Handling: Report file, line number, and syntax error
- Recovery: Suggest corrections or mark as pseudocode

**Broken Links:**

- Detection: Parse markdown links and verify targets
- Handling: Report broken link with source location
- Recovery: Suggest alternative links or mark as external

### Package Errors

**Missing Metadata:**

- Detection: Validate package.json against required fields
- Handling: Report missing fields with descriptions
- Recovery: Provide default values or templates

**Bundle Errors:**

- Detection: Build process failures or missing dependencies
- Handling: Report specific build errors
- Recovery: Suggest dependency installation or build fixes

**Installation Failures:**

- Detection: npm install exits with non-zero code
- Handling: Report installation error with logs
- Recovery: Suggest common fixes (permissions, registry issues)

### Release Errors

**Version Mismatch:**

- Detection: Compare versions across package.json files
- Handling: Report files with mismatched versions
- Recovery: Run version sync script

**Verification Failures:**

- Detection: Post-release verification steps fail
- Handling: Report specific verification failure
- Recovery: Provide rollback instructions

**Publish Errors:**

- Detection: npm publish fails
- Handling: Report publish error (auth, network, etc.)
- Recovery: Suggest authentication or retry

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

**Documentation Structure Tests:**

- Test that README.md exists and contains required sections
- Test that configuration.md exists and has proper structure
- Test that troubleshooting.md exists with issue sections
- Test that release-checklist.md exists with all required sections

**Package Metadata Tests:**

- Test package.json has all required fields
- Test bin field points to correct executable
- Test files field includes necessary files
- Test engines field specifies correct Node version

**Version Format Tests:**

- Test version strings match semver pattern
- Test version bump script updates all package.json files
- Test CHANGELOG format matches Keep a Changelog spec

**Link Validation Tests:**

- Test internal links point to existing files
- Test external links return 200 status (with caching)

### Property-Based Tests

Property-based tests will verify universal properties across all inputs using a minimum of 100 iterations per test:

**Property Test 1: README Completeness**

- Generate various README structures
- Verify all required sections are present
- Tag: **Feature: stage-09-docs-release, Property 1: README SHALL contain all required sections**

**Property Test 2: Configuration Documentation Completeness**

- Generate configuration schemas
- Verify all settings are documented with required information
- Tag: **Feature: stage-09-docs-release, Property 2: All settings SHALL be documented**

**Property Test 3: Package Files Inclusion**

- Generate various files field configurations
- Run npm pack and verify tarball contents match
- Tag: **Feature: stage-09-docs-release, Property 7: Package SHALL include only specified files**

**Property Test 4: Platform-Agnostic Paths**

- Generate various path operations
- Verify no hardcoded path separators
- Tag: **Feature: stage-09-docs-release, Property 8: Paths SHALL be platform-agnostic**

**Property Test 5: Version Synchronization**

- Generate version bump operations
- Verify all package.json files updated to same version
- Tag: **Feature: stage-09-docs-release, Property 12: All packages SHALL have same version**

**Property Test 6: CHANGELOG Format**

- Generate CHANGELOG entries
- Verify format compliance with Keep a Changelog
- Tag: **Feature: stage-09-docs-release, Property 13: CHANGELOG SHALL follow standard format**

**Property Test 7: Code Example Validity**

- Extract code blocks from documentation
- Verify syntax validity for declared language
- Tag: **Feature: stage-09-docs-release, Property 21: Code examples SHALL be syntactically valid**

**Property Test 8: Documentation Accuracy**

- Extract documented flags and options
- Verify they exist in codebase
- Tag: **Feature: stage-09-docs-release, Property 22: Documented options SHALL exist in code**

**Property Test 9: Link Validity**

- Extract all links from documentation
- Verify internal links resolve and external links are reachable
- Tag: **Feature: stage-09-docs-release, Property 23: Links SHALL be valid**

### Integration Tests

**End-to-End Release Test:**

- Run complete release process in test environment
- Verify package publishes successfully
- Verify global installation works
- Verify ollm command executes
- Verify version output is correct

**Cross-Platform Tests:**

- Test installation on macOS (if available)
- Test installation on Linux (if available)
- Test installation on Windows (if available)
- Verify no platform-specific errors

**Documentation Build Test:**

- Generate documentation from templates
- Verify all required files are created
- Verify documentation is internally consistent

### Testing Tools

- **Vitest**: Unit and property-based testing framework
- **fast-check**: Property-based testing library for JavaScript/TypeScript
- **markdown-link-check**: Validate markdown links
- **ajv**: JSON schema validation for package.json
- **semver**: Semantic version validation and comparison
- **tar**: Inspect npm pack tarball contents
