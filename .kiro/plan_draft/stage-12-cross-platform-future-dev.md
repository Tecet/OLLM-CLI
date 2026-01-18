# Future Development: Cross-Platform Support

**Goal**: Ensure OLLM CLI works consistently across Windows, macOS, and Linux.

**Priority**: High (should be addressed during Stage 06 implementation)

**Estimated Effort**: 1-2 days

---

## Overview

OLLM CLI is built on Node.js + TypeScript which provides good cross-platform foundation. However, several components require platform-specific handling to work correctly on all operating systems.

---

## Platform Compatibility Matrix

### Already Cross-Platform ✅

| Component | Technology | Notes |
|-----------|------------|-------|
| Core Runtime | Node.js + TypeScript | Native cross-platform |
| UI Framework | React + Ink | Terminal UI works everywhere |
| Package Manager | npm workspaces | Standard tooling |
| HTTP Client | Native fetch | Built into Node.js |
| File System | Node.js `fs` | Use `path.join()` |
| Git Integration | `simple-git` | Wraps git CLI |

### Needs Platform Handling ⚠️

| Component | Issue | Solution |
|-----------|-------|----------|
| GPU Monitoring | Different commands | Platform detection |
| Config Paths | Home dir differences | XDG/AppData support |
| Code Execution | Shell differences | Platform-aware shells |
| Terminal Caps | Unicode/color support | Feature detection |
| Clipboard | Different APIs | Use `clipboardy` |

---

## Tasks

### CPT-01: Platform Detection Utilities

**Create**: `packages/core/src/utils/platform.ts`

```typescript
export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux';
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  shell: string;
  shellFlag: string;
  pythonCommand: string;
  supportsUnicode: boolean;
}

export function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  
  return {
    os: platform === 'win32' ? 'windows' : 
        platform === 'darwin' ? 'macos' : 'linux',
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux',
    shell: platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    shellFlag: platform === 'win32' ? '/c' : '-c',
    pythonCommand: platform === 'win32' ? 'python' : 'python3',
    supportsUnicode: detectUnicodeSupport(),
  };
}

function detectUnicodeSupport(): boolean {
  if (process.platform !== 'win32') return true;
  
  // Windows Terminal and modern terminals support Unicode
  return !!(
    process.env.WT_SESSION ||      // Windows Terminal
    process.env.ConEmuANSI ||      // ConEmu
    process.env.TERM_PROGRAM       // VS Code terminal, etc.
  );
}
```

**Deliverables**:
- `packages/core/src/utils/platform.ts`
- `packages/core/src/utils/__tests__/platform.test.ts`

---

### CPT-02: Cross-Platform Config Paths

**Create**: `packages/core/src/config/paths.ts`

```typescript
import os from 'os';
import path from 'path';

export interface ConfigPaths {
  configDir: string;      // User config directory
  dataDir: string;        // User data directory  
  cacheDir: string;       // Cache directory
  configFile: string;     // Main config file
  sessionsDir: string;    // Session storage
  indexDir: string;       // Codebase index
}

export function getConfigPaths(): ConfigPaths {
  const home = os.homedir();
  const platform = process.platform;
  
  let configDir: string;
  let dataDir: string;
  let cacheDir: string;
  
  if (platform === 'win32') {
    // Windows: Use AppData
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    configDir = path.join(appData, 'ollm');
    dataDir = path.join(appData, 'ollm');
    cacheDir = path.join(localAppData, 'ollm', 'cache');
    
  } else if (platform === 'darwin') {
    // macOS: Use Library directories
    configDir = path.join(home, 'Library', 'Application Support', 'ollm');
    dataDir = path.join(home, 'Library', 'Application Support', 'ollm');
    cacheDir = path.join(home, 'Library', 'Caches', 'ollm');
    
  } else {
    // Linux: Follow XDG spec
    configDir = process.env.XDG_CONFIG_HOME 
      ? path.join(process.env.XDG_CONFIG_HOME, 'ollm')
      : path.join(home, '.config', 'ollm');
    dataDir = process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, 'ollm')
      : path.join(home, '.local', 'share', 'ollm');
    cacheDir = process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'ollm')
      : path.join(home, '.cache', 'ollm');
  }
  
  return {
    configDir,
    dataDir,
    cacheDir,
    configFile: path.join(configDir, 'config.yaml'),
    sessionsDir: path.join(dataDir, 'sessions'),
    indexDir: path.join(cacheDir, 'index'),
  };
}

// Also support legacy ~/.ollm path for migration
export function getLegacyConfigPath(): string {
  return path.join(os.homedir(), '.ollm', 'config.yaml');
}
```

---

### CPT-03: GPU Monitoring Cross-Platform

**Update**: `packages/core/src/services/gpuMonitor.ts`

```typescript
async function queryGPU(): Promise<GPUInfo> {
  const { isWindows, isMac, isLinux } = getPlatformInfo();
  
  if (isWindows) {
    return await queryWindowsGPU();
  } else if (isMac) {
    return await queryMacGPU();
  } else {
    return await queryLinuxGPU();
  }
}

// Windows: nvidia-smi.exe
async function queryWindowsGPU(): Promise<GPUInfo> {
  const paths = [
    process.env.NVIDIA_SMI_PATH,
    'nvidia-smi',  // If in PATH
    'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
    'C:\\Windows\\System32\\nvidia-smi.exe',
  ].filter(Boolean);
  
  for (const nvidiaSmi of paths) {
    try {
      return await execNvidiaSmi(nvidiaSmi);
    } catch {}
  }
  
  return getCPUFallback();
}

// macOS: Apple Silicon or discrete GPU
async function queryMacGPU(): Promise<GPUInfo> {
  // Apple Silicon doesn't expose VRAM/temp easily
  // Could use: system_profiler SPDisplaysDataType
  // Or: ioreg -l | grep -i "temperature"
  
  // For now, return limited info
  return {
    available: true,
    vendor: 'apple',
    vramTotal: 0,  // Unified memory
    vramUsed: 0,
    temperature: 0,  // Not available without sudo
    gpuUtilization: 0,
  };
}

// Linux: nvidia-smi or rocm-smi
async function queryLinuxGPU(): Promise<GPUInfo> {
  // Try NVIDIA first
  try {
    return await execNvidiaSmi('nvidia-smi');
  } catch {}
  
  // Try AMD
  try {
    return await execRocmSmi();
  } catch {}
  
  return getCPUFallback();
}

function getCPUFallback(): GPUInfo {
  return {
    available: false,
    vendor: 'cpu',
    vramTotal: 0,
    vramUsed: 0,
    temperature: 0,
    gpuUtilization: 0,
  };
}
```

---

### CPT-04: Terminal Capabilities Detection

**Create**: `packages/cli/src/utils/terminal.ts`

```typescript
export interface TerminalCapabilities {
  supportsColor: boolean;
  supports256Colors: boolean;
  supportsTrueColor: boolean;
  supportsUnicode: boolean;
  columns: number;
  rows: number;
  isInteractive: boolean;
}

export function getTerminalCapabilities(): TerminalCapabilities {
  const isWindows = process.platform === 'win32';
  const isTTY = process.stdout.isTTY;
  
  // Detect color support
  const forceColor = process.env.FORCE_COLOR;
  const noColor = process.env.NO_COLOR;
  const colorTerm = process.env.COLORTERM;
  
  let supportsColor = isTTY && !noColor;
  let supports256Colors = false;
  let supportsTrueColor = false;
  
  if (colorTerm === 'truecolor' || colorTerm === '24bit') {
    supportsTrueColor = true;
    supports256Colors = true;
  } else if (process.env.TERM?.includes('256color')) {
    supports256Colors = true;
  }
  
  // Unicode support
  let supportsUnicode = !isWindows;
  if (isWindows) {
    supportsUnicode = !!(
      process.env.WT_SESSION ||     // Windows Terminal
      process.env.ConEmuANSI ||     // ConEmu
      process.env.TERM_PROGRAM      // VS Code, etc.
    );
  }
  
  return {
    supportsColor,
    supports256Colors,
    supportsTrueColor,
    supportsUnicode,
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    isInteractive: isTTY,
  };
}

// Fallback icons for legacy terminals
export const icons = {
  get success() {
    return getTerminalCapabilities().supportsUnicode ? '✓' : '+';
  },
  get error() {
    return getTerminalCapabilities().supportsUnicode ? '✗' : 'x';
  },
  get warning() {
    return getTerminalCapabilities().supportsUnicode ? '⚠' : '!';
  },
  get spinner() {
    return getTerminalCapabilities().supportsUnicode 
      ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      : ['-', '\\', '|', '/'];
  },
};
```

---

### CPT-05: Code Execution Cross-Platform

**Update**: `packages/core/src/sandbox/executor.ts`

```typescript
import { getPlatformInfo } from '../utils/platform';

export class BashExecutor implements LanguageExecutor {
  async execute(code: string): Promise<ExecutionResult> {
    const { shell, shellFlag, isWindows } = getPlatformInfo();
    
    // On Windows, convert common Unix commands
    const adjustedCode = isWindows ? this.adjustForWindows(code) : code;
    
    return await this.spawnProcess(shell, [shellFlag, adjustedCode]);
  }
  
  private adjustForWindows(code: string): string {
    // Basic translations (optional, or warn user)
    return code
      .replace(/^ls\b/gm, 'dir')
      .replace(/^cat\b/gm, 'type')
      .replace(/^rm\b/gm, 'del')
      .replace(/^cp\b/gm, 'copy')
      .replace(/^mv\b/gm, 'move');
  }
}

export class PythonExecutor implements LanguageExecutor {
  async execute(code: string): Promise<ExecutionResult> {
    const { pythonCommand } = getPlatformInfo();
    
    // Write to temp file and execute
    const tempFile = await this.writeTempFile(code, '.py');
    
    try {
      return await this.spawnProcess(pythonCommand, [tempFile]);
    } finally {
      await this.cleanupTempFile(tempFile);
    }
  }
}
```

---

### CPT-06: Path Normalization

**Create**: `packages/core/src/utils/paths.ts`

```typescript
import path from 'path';

// Always use forward slashes for display
export function normalizeForDisplay(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// Use native separators for file operations
export function toNativePath(filePath: string): string {
  return filePath.replace(/[/\\]/g, path.sep);
}

// Safe path joining
export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

// Resolve relative to workspace
export function resolvePath(workspaceRoot: string, relativePath: string): string {
  // Handle both forward and back slashes in input
  const normalized = relativePath.replace(/\\/g, '/');
  return path.resolve(workspaceRoot, ...normalized.split('/'));
}
```

---

## Testing Strategy

### Unit Tests
- Platform detection returns correct values on each OS
- Config paths resolve correctly per platform
- Path normalization works with mixed separators

### Integration Tests (CI Matrix)
```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### Manual Testing
- [ ] Test on Windows 10/11 with Windows Terminal
- [ ] Test on Windows with legacy cmd.exe
- [ ] Test on macOS (Intel and Apple Silicon)
- [ ] Test on Ubuntu/Debian
- [ ] Test on Fedora/RHEL

---

## File Structure

```
packages/core/src/
├── utils/
│   ├── platform.ts          # Platform detection
│   ├── paths.ts              # Path utilities
│   └── __tests__/
│       ├── platform.test.ts
│       └── paths.test.ts
├── config/
│   └── paths.ts              # Config path resolution

packages/cli/src/
└── utils/
    └── terminal.ts           # Terminal capabilities
```

---

## Verification Checklist

- [ ] Platform detection works on Windows/macOS/Linux
- [ ] Config files stored in correct platform locations
- [ ] GPU monitoring gracefully handles unavailable GPU
- [ ] Terminal detects Unicode/color support
- [ ] Code execution uses correct shell per platform
- [ ] Paths work with both `/` and `\` input
- [ ] CI runs on all platforms
- [ ] No hardcoded paths with wrong separators

---

## Dependencies

No new dependencies needed. Uses:
- Node.js built-in: `os`, `path`, `process`
- `clipboardy` - Already cross-platform
- `simple-git` - Already cross-platform
