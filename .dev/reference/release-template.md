# Release v{VERSION}

**Released**: {DATE}

---

## 🎉 Highlights

{Provide a brief, engaging summary of the most important changes in this release. Focus on what users will care about most. Keep it to 2-3 sentences.}

Example:

> This release introduces powerful new context management features with automatic VRAM monitoring, adds support for MCP (Model Context Protocol) integration, and includes significant performance improvements for large codebases.

---

## ✨ New Features

{List all new features added in this release. Include PR/issue numbers for reference.}

- **Feature name**: Brief description of the feature and its benefits (#PR)
- **Another feature**: Description (#PR)

Example:

- **VRAM Monitoring**: Automatic GPU memory monitoring with dynamic context sizing (#123)
- **MCP Integration**: Full support for Model Context Protocol tools and servers (#124)
- **Session Recording**: Record and resume chat sessions with compression (#125)

---

## 🐛 Bug Fixes

{List all bug fixes included in this release. Include PR/issue numbers for reference.}

- Fixed issue where... (#PR)
- Resolved bug causing... (#PR)

Example:

- Fixed memory leak in context management during long sessions (#126)
- Resolved issue with file paths on Windows (#127)
- Fixed streaming response handling for large outputs (#128)

---

## 💥 Breaking Changes

{List any breaking changes that require user action. For each breaking change, provide clear upgrade instructions.}

### Breaking Change 1: {Title}

**What changed**: {Describe what changed and why}

**Migration guide**:

1. {Step-by-step instructions for upgrading}
2. {Include code examples if applicable}

Example:

### Configuration File Format Change

**What changed**: Configuration files now use YAML format instead of JSON for better readability and comment support.

**Migration guide**:

1. Rename your config file from `config.json` to `config.yaml`
2. Convert JSON syntax to YAML:

   ```yaml
   # Before (config.json)
   {
     "model": {
       "name": "llama3.1:8b"
     }
   }

   # After (config.yaml)
   model:
     name: llama3.1:8b
   ```

3. Run `ollm --validate-config` to verify your configuration

---

## 📚 Documentation

{List documentation improvements and additions}

- Added comprehensive configuration reference (#PR)
- Updated troubleshooting guide with new common issues (#PR)
- Improved README with better examples (#PR)

---

## 🔧 Internal Changes

{Optional: List internal improvements that don't directly affect users but are worth noting}

- Refactored context management for better maintainability (#PR)
- Improved test coverage to 85% (#PR)
- Updated dependencies to latest versions (#PR)

---

## 🔒 Security

{If this release includes security fixes, list them here with appropriate detail. Be careful not to expose vulnerability details that could be exploited.}

- **Security Fix**: Resolved potential command injection vulnerability in shell tool (#PR)
- **Security Enhancement**: Added environment variable sanitization (#PR)

**Note**: If you're using an affected version, please upgrade immediately.

---

## 📦 Installation

### New Installation

Install the latest version globally via npm:

```bash
npm install -g ollm-cli@{VERSION}
```

### Verify Installation

```bash
ollm --version
# Should output: {VERSION}
```

---

## 🔄 Upgrade Instructions

### From v{PREVIOUS_VERSION}

{Provide specific upgrade instructions for users coming from the previous version}

#### Standard Upgrade

For most users, simply update the package:

```bash
npm update -g ollm-cli
```

#### Manual Upgrade

If you encounter issues with the standard upgrade:

```bash
# Uninstall old version
npm uninstall -g ollm-cli

# Install new version
npm install -g ollm-cli@{VERSION}
```

#### Configuration Changes

{If there are configuration changes, provide specific instructions}

Example:
If you have a custom configuration file:

1. Back up your existing config: `cp ~/.ollm/config.json ~/.ollm/config.json.backup`
2. Follow the migration guide in the "Breaking Changes" section above
3. Test your configuration: `ollm --validate-config`

#### Data Migration

{If there are data format changes, provide migration instructions}

Example:
Session data format has changed. To migrate existing sessions:

```bash
ollm migrate-sessions
```

---

## 🙏 Contributors

Thanks to all contributors who made this release possible!

{List contributors with GitHub handles}

- @contributor1 - Feature implementation
- @contributor2 - Bug fixes
- @contributor3 - Documentation improvements

{If using GitHub's auto-generated contributor list, you can use:}

**Full Changelog**: https://github.com/{user}/ollm-cli/compare/v{PREVIOUS_VERSION}...v{VERSION}

---

## 📝 Notes

{Any additional notes, known issues, or future plans}

### Known Issues

- {List any known issues that weren't fixed in this release}

### Coming Soon

- {Tease upcoming features if appropriate}

---

## 🐛 Found a Bug?

If you encounter any issues with this release, please:

1. Check the troubleshooting guide (https://github.com/{user}/ollm-cli/blob/main/docs/troubleshooting.md)
2. Search existing issues (https://github.com/{user}/ollm-cli/issues)
3. Open a new issue (https://github.com/{user}/ollm-cli/issues/new) with:
   - Your OLLM CLI version (`ollm --version`)
   - Your operating system
   - Steps to reproduce the issue
   - Expected vs actual behavior

---

## 💬 Feedback

We'd love to hear your feedback on this release! Share your thoughts:

- GitHub Discussions (https://github.com/{user}/ollm-cli/discussions)
- GitHub Issues (https://github.com/{user}/ollm-cli/issues)

---

**Previous Release**: v{PREVIOUS_VERSION} (https://github.com/{user}/ollm-cli/releases/tag/v{PREVIOUS_VERSION})
