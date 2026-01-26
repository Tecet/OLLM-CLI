# Extension Manager API Reference

**ExtensionManager Class API Documentation**

---

## Overview

The `ExtensionManager` class handles extension loading and management.

---

## Getting Instance

```typescript
import { ExtensionManager } from '@ollm/ollm-cli-core';

const manager = ExtensionManager.getInstance();
```

---

## Methods

### loadExtensions()

Load all installed extensions.

```typescript
async loadExtensions(): Promise<void>
```

**Example:**
```typescript
await manager.loadExtensions();
```

### install()

Install an extension.

```typescript
async install(source: string, options?: InstallOptions): Promise<void>
```

**Parameters:**
- `source` - URL or file path
- `options` - Installation options

```typescript
interface InstallOptions {
  dev?: boolean;
  path?: string;
}
```

**Example:**
```typescript
await manager.install('https://example.com/extension.tar.gz');

// Dev mode
await manager.install('./my-extension', { dev: true });
```

### enable()

Enable an extension.

```typescript
enable(name: string): void
```

### disable()

Disable an extension.

```typescript
disable(name: string): void
```

### remove()

Remove an extension.

```typescript
async remove(name: string): Promise<void>
```

### listExtensions()

List all extensions.

```typescript
listExtensions(): Extension[]
```

**Returns:**
```typescript
interface Extension {
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  components: {
    skills: number;
    settings: number;
    servers: number;
    hooks: number;
  };
}
```

### getExtension()

Get extension details.

```typescript
getExtension(name: string): Extension | undefined
```

### reload()

Reload all extensions.

```typescript
async reload(): Promise<void>
```

---

## Events

```typescript
manager.on('extension-loaded', (extension) => {
  console.log('Extension loaded:', extension.name);
});

manager.on('extension-enabled', (extension) => {
  console.log('Extension enabled:', extension.name);
});

manager.on('extension-disabled', (extension) => {
  console.log('Extension disabled:', extension.name);
});

manager.on('extension-reloaded', (extension) => {
  console.log('Extension reloaded:', extension.name);
});
```

---

## Example Usage

```typescript
import { ExtensionManager } from '@ollm/ollm-cli-core';

const manager = ExtensionManager.getInstance();

// Load extensions
await manager.loadExtensions();

// Install extension
await manager.install('https://example.com/github-integration.tar.gz');

// List extensions
const extensions = manager.listExtensions();
console.log('Installed extensions:', extensions.length);

// Enable extension
manager.enable('github-integration');

// Get extension details
const ext = manager.getExtension('github-integration');
console.log('Extension:', ext);

// Disable extension
manager.disable('github-integration');

// Remove extension
await manager.remove('github-integration');
```

---

## Further Reading

- [API Overview](README.md)
- [MCP Client API](mcp-client.md)
- [Hook System API](hook-system.md)
- [Extension System Overview](../extensions/README.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
