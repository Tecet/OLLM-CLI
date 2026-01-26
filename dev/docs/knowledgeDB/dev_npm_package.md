# npm Package Distribution

**Last Updated:** January 26, 2026  
**Status:** Planned (v1.0.0)

**Related Documents:**
- `dev_ProviderSystem.md` - Ollama provider configuration
- `works_todo.md` - Task #8 (Ollama Settings Management)

---

## Overview

This document describes the strategy for packaging and distributing OLLM CLI as an npm package. The package will be published to npm registry for easy installation and updates.

**Current Status:** Development (v0.1.0)  
**Target:** npm package release (v1.0.0)

---

## Package Information

### Package Name

```
ollm-cli
```

**Alternatives considered:**
- `@ollm/cli` - Scoped package (requires npm organization)
- `ollm` - Shorter, but may conflict with existing packages

### Package Metadata

```json
{
  "name": "ollm-cli",
  "version": "1.0.0",
  "description": "Local-first CLI for open-source LLMs with Ollama",
  "keywords": [
    "ollama",
    "llm",
    "ai",
    "cli",
    "local",
    "chatbot",
    "assistant"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/ollm-cli"
  },
  "bugs": {
    "url": "https://github.com/yourusername/ollm-cli/issues"
  },
  "homepage": "https://github.com/yourusername/ollm-cli#readme",
  "bin": {
    "ollm": "./dist/cli.js"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

## Installation

### Global Installation (Recommended)

```bash
npm install -g ollm-cli
```

**Benefits:**
- Available as `ollm` command globally
- Easy to use from any directory
- Automatic updates with `npm update -g ollm-cli`

### Local Installation

```bash
npm install ollm-cli
npx ollm
```

**Use case:** Project-specific installation

---

## Interactive Installer

### Installation Flow

```
$ npm install -g ollm-cli

> ollm-cli@1.0.0 postinstall
> node scripts/postinstall.js

┌─ OLLM CLI Setup ─────────────────────────┐
│                                           │
│ Welcome to OLLM CLI!                     │
│                                           │
│ Checking for Ollama...                   │
│ ✗ Ollama not detected                    │
│                                           │
│ Ollama is required to run local models.  │
│ Install Ollama now? (Y/n): Y             │
│                                           │
│ Downloading Ollama...                    │
│ ████████████████████ 100%                │
│ Installing Ollama...                     │
│ ✓ Ollama installed successfully          │
│                                           │
│ Pull default model (llama3.2:3b ~2GB)?  │
│ This will download a small model to      │
│ get you started. (Y/n): Y                │
│                                           │
│ Pulling llama3.2:3b...                   │
│ ████████████████████ 100%                │
│ ✓ Model downloaded successfully          │
│                                           │
│ ✓ Setup complete!                        │
│                                           │
│ Start using OLLM CLI:                    │
│   ollm                                   │
│                                           │
│ Documentation:                           │
│   https://github.com/yourusername/ollm-cli │
│                                           │
└───────────────────────────────────────────┘
```

### User Declined Installation

```
$ npm install -g ollm-cli

> ollm-cli@1.0.0 postinstall
> node scripts/postinstall.js

┌─ OLLM CLI Setup ─────────────────────────┐
│                                           │
│ Welcome to OLLM CLI!                     │
│                                           │
│ Checking for Ollama...                   │
│ ✗ Ollama not detected                    │
│                                           │
│ Ollama is required to run local models.  │
│ Install Ollama now? (Y/n): n             │
│                                           │
│ ⚠️ Skipping Ollama installation          │
│                                           │
│ To install Ollama manually:              │
│   https://ollama.ai/download             │
│                                           │
│ Or configure a remote Ollama server:     │
│   ollm config ollama host remote.com     │
│   ollm config ollama port 11434          │
│                                           │
│ After installing Ollama, pull a model:   │
│   ollama pull llama3.2:3b                │
│                                           │
│ Start OLLM CLI:                          │
│   ollm                                   │
│                                           │
└───────────────────────────────────────────┘
```

### Ollama Already Installed

```
$ npm install -g ollm-cli

> ollm-cli@1.0.0 postinstall
> node scripts/postinstall.js

┌─ OLLM CLI Setup ─────────────────────────┐
│                                           │
│ Welcome to OLLM CLI!                     │
│                                           │
│ Checking for Ollama...                   │
│ ✓ Ollama detected at http://localhost:11434 │
│                                           │
│ Pull default model (llama3.2:3b ~2GB)?  │
│ (Y/n): Y                                 │
│                                           │
│ Pulling llama3.2:3b...                   │
│ ████████████████████ 100%                │
│ ✓ Model downloaded successfully          │
│                                           │
│ ✓ Setup complete!                        │
│                                           │
│ Start using OLLM CLI:                    │
│   ollm                                   │
│                                           │
└───────────────────────────────────────────┘
```

---

## Platform-Specific Installation

### Windows

**Ollama Installation:**
1. Download `OllamaSetup.exe` from https://ollama.ai/download
2. Run installer (silent or with UI)
3. Add to PATH automatically
4. Start Ollama service

**Script:**
```javascript
async function installOllamaWindows() {
  const installerUrl = 'https://ollama.ai/download/OllamaSetup.exe';
  const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe');
  
  // Download installer
  await downloadFile(installerUrl, installerPath);
  
  // Run installer
  await exec(`"${installerPath}" /S`);  // Silent install
  
  // Wait for installation
  await sleep(5000);
  
  // Verify installation
  const installed = await checkCommand('ollama');
  if (!installed) {
    throw new Error('Ollama installation failed');
  }
}
```

### macOS

**Ollama Installation:**
1. Download `Ollama-darwin.zip` from https://ollama.ai/download
2. Extract to `/Applications/Ollama.app`
3. Run initial setup
4. Add to PATH

**Script:**
```javascript
async function installOllamaMacOS() {
  const zipUrl = 'https://ollama.ai/download/Ollama-darwin.zip';
  const zipPath = path.join(os.tmpdir(), 'Ollama.zip');
  
  // Download zip
  await downloadFile(zipUrl, zipPath);
  
  // Extract to /Applications
  await exec(`unzip -q "${zipPath}" -d /Applications`);
  
  // Run initial setup
  await exec('open /Applications/Ollama.app');
  
  // Wait for setup
  await sleep(3000);
  
  // Verify installation
  const installed = await checkCommand('ollama');
  if (!installed) {
    throw new Error('Ollama installation failed');
  }
}
```

### Linux

**Ollama Installation:**
1. Run official install script
2. Or use package manager (apt, yum, etc.)

**Script:**
```javascript
async function installOllamaLinux() {
  // Use official install script
  await exec('curl -fsSL https://ollama.ai/install.sh | sh');
  
  // Verify installation
  const installed = await checkCommand('ollama');
  if (!installed) {
    throw new Error('Ollama installation failed');
  }
}
```

---

## Postinstall Script

### Implementation

```javascript
// scripts/postinstall.js
const prompts = require('prompts');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

async function postInstall() {
  console.log('\n┌─ OLLM CLI Setup ─────────────────────────┐\n');
  console.log('│ Welcome to OLLM CLI!\n│');
  
  try {
    // 1. Check if ollama is installed
    console.log('│ Checking for Ollama...');
    const ollamaInstalled = await checkCommand('ollama');
    
    if (!ollamaInstalled) {
      console.log('│ ✗ Ollama not detected\n│');
      console.log('│ Ollama is required to run local models.');
      
      // 2. Ask to install ollama
      const { installOllama } = await prompts({
        type: 'confirm',
        name: 'installOllama',
        message: 'Install Ollama now?',
        initial: true
      });
      
      if (installOllama) {
        // 3. Install ollama based on platform
        await installOllamaForPlatform();
      } else {
        // Show manual installation instructions
        showManualInstructions();
        return;
      }
    } else {
      console.log('│ ✓ Ollama detected at http://localhost:11434\n│');
    }
    
    // 4. Ask to pull default model
    const { pullModel } = await prompts({
      type: 'confirm',
      name: 'pullModel',
      message: 'Pull default model (llama3.2:3b ~2GB)?',
      initial: true
    });
    
    if (pullModel) {
      // 5. Pull model
      await pullDefaultModel();
    } else {
      console.log('│ ⚠️ Skipping model download');
      console.log('│ Pull a model manually: ollama pull llama3.2:3b\n│');
    }
    
    // 6. Write default settings
    await writeDefaultSettings();
    
    console.log('│ ✓ Setup complete!\n│');
    console.log('│ Start using OLLM CLI:');
    console.log('│   ollm\n│');
    console.log('└───────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('│ ✗ Setup failed:', error.message);
    console.log('│\n│ Please install Ollama manually:');
    console.log('│   https://ollama.ai/download\n│');
    console.log('└───────────────────────────────────────────┘\n');
    process.exit(0);  // Don't fail npm install
  }
}

async function checkCommand(command) {
  try {
    await execAsync(`${command} --version`);
    return true;
  } catch {
    return false;
  }
}

async function installOllamaForPlatform() {
  const platform = os.platform();
  
  console.log('│ Downloading Ollama...');
  
  switch (platform) {
    case 'win32':
      await installOllamaWindows();
      break;
    case 'darwin':
      await installOllamaMacOS();
      break;
    case 'linux':
      await installOllamaLinux();
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  console.log('│ ✓ Ollama installed successfully\n│');
}

async function pullDefaultModel() {
  console.log('│ Pulling llama3.2:3b...');
  
  return new Promise((resolve, reject) => {
    const child = exec('ollama pull llama3.2:3b');
    
    let lastProgress = '';
    child.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line !== lastProgress) {
        process.stdout.write(`\r│ ${line}${' '.repeat(40)}`);
        lastProgress = line;
      }
    });
    
    child.on('close', (code) => {
      console.log('\n│ ✓ Model downloaded successfully\n│');
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Failed to pull model'));
      }
    });
  });
}

async function writeDefaultSettings() {
  const settingsDir = path.join(os.homedir(), '.ollm');
  const settingsPath = path.join(settingsDir, 'settings.json');
  
  // Create directory if not exists
  await fs.mkdir(settingsDir, { recursive: true });
  
  // Write default settings
  const settings = {
    provider: {
      ollama: {
        autoStart: true,
        host: 'localhost',
        port: 11434,
        url: 'http://localhost:11434'
      }
    }
  };
  
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

function showManualInstructions() {
  console.log('│ ⚠️ Skipping Ollama installation\n│');
  console.log('│ To install Ollama manually:');
  console.log('│   https://ollama.ai/download\n│');
  console.log('│ Or configure a remote Ollama server:');
  console.log('│   ollm config ollama host remote.com');
  console.log('│   ollm config ollama port 11434\n│');
  console.log('│ After installing Ollama, pull a model:');
  console.log('│   ollama pull llama3.2:3b\n│');
  console.log('│ Start OLLM CLI:');
  console.log('│   ollm\n│');
  console.log('└───────────────────────────────────────────┘\n');
}

// Run postinstall
postInstall().catch((error) => {
  console.error('Postinstall error:', error);
  process.exit(0);  // Don't fail npm install
});
```

---

## Package Structure

### Files to Include

```
ollm-cli/
├── dist/                    # Compiled JavaScript
│   ├── cli.js              # Main entry point
│   └── ...
├── scripts/
│   ├── postinstall.js      # Interactive installer
│   ├── installOllama.js    # Platform-specific installation
│   └── downloadWithProgress.js
├── package.json
├── README.md
├── LICENSE
└── .npmignore
```

### .npmignore

```
# Source files
src/
packages/*/src/
*.ts
tsconfig*.json

# Development files
.dev/
.kiro/
.test-snapshots/
.vitest.setup.ts
vitest.config.ts
eslint.config.js
.prettierrc.json
.prettierignore

# Build files
esbuild.config.js
scripts/build.js

# Documentation
docs/
*.md
!README.md

# Git
.git/
.gitignore
.github/

# IDE
.vscode/
.idea/

# Logs
*.log
context-debug.log

# Test files
**/__tests__/
**/*.test.ts
**/*.test.js

# Temporary files
.tmp-*
old-*
```

---

## Publishing

### Pre-publish Checklist

- [ ] All tests passing
- [ ] Documentation complete
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Build successful (`npm run build`)
- [ ] Postinstall script tested on all platforms
- [ ] License file included
- [ ] .npmignore configured correctly

### Publish Commands

```bash
# 1. Build the package
npm run build

# 2. Test the package locally
npm pack
npm install -g ollm-cli-1.0.0.tgz

# 3. Test postinstall script
# (Uninstall ollama first to test full flow)

# 4. Publish to npm
npm login
npm publish

# 5. Verify publication
npm view ollm-cli
```

### Version Management

```bash
# Patch release (bug fixes)
npm version patch
npm publish

# Minor release (new features)
npm version minor
npm publish

# Major release (breaking changes)
npm version major
npm publish
```

---

## Updates

### Automatic Updates

Users can update to the latest version:

```bash
npm update -g ollm-cli
```

### Update Notifications

Show update notification when new version available:

```javascript
// Check for updates on startup
const currentVersion = require('./package.json').version;
const latestVersion = await getLatestVersion('ollm-cli');

if (semver.gt(latestVersion, currentVersion)) {
  console.log(`
┌─ Update Available ───────────────────────┐
│                                           │
│ New version available: ${latestVersion}  │
│ Current version: ${currentVersion}        │
│                                           │
│ Update now:                              │
│   npm update -g ollm-cli                 │
│                                           │
└───────────────────────────────────────────┘
  `);
}
```

---

## Distribution Channels

### npm Registry (Primary)

```bash
npm install -g ollm-cli
```

**Benefits:**
- Easy installation
- Automatic updates
- Version management
- Wide reach

### GitHub Releases (Secondary)

Provide standalone binaries for users without npm:

```
ollm-cli-v1.0.0-win-x64.exe
ollm-cli-v1.0.0-macos-arm64
ollm-cli-v1.0.0-linux-x64
```

**Build with pkg:**
```bash
npm install -g pkg
pkg . --targets node20-win-x64,node20-macos-arm64,node20-linux-x64
```

---

## Support & Documentation

### README.md

Include in package:
- Installation instructions
- Quick start guide
- Configuration options
- Troubleshooting
- Links to full documentation

### Online Documentation

Host documentation at:
- GitHub Pages
- Read the Docs
- Custom domain

---

## Maintenance

### Issue Tracking

Use GitHub Issues for:
- Bug reports
- Feature requests
- Installation problems
- Platform-specific issues

### Release Schedule

- **Patch releases:** As needed (bug fixes)
- **Minor releases:** Monthly (new features)
- **Major releases:** Quarterly (breaking changes)

---

## File Locations

| File | Purpose |
|------|---------|
| `scripts/postinstall.js` | Interactive installer |
| `scripts/installOllama.js` | Platform-specific installation |
| `scripts/downloadWithProgress.js` | Download utility |
| `package.json` | Package metadata |
| `.npmignore` | Files to exclude from package |
| `README.md` | Package documentation |

---

**Note:** This document describes the npm packaging strategy. Implementation will begin after core features are complete and tested. Target release: v1.0.0
