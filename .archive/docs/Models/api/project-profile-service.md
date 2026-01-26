# Project Profile Service API

**Project Type Detection and Configuration**

---

## Overview

The Project Profile Service detects project types and applies appropriate settings.

**File:** `packages/core/src/services/projectProfileService.ts`

---

## Constructor

```typescript
constructor(options?: ProfileOptions)
```

---

## Methods

### detectProfile()

Detect project type from files.

```typescript
async detectProfile(projectPath: string): Promise<ProjectType | null>
```

**Returns:** 'typescript' | 'python' | 'rust' | 'go' | 'documentation' | null

**Example:**
```typescript
const type = await service.detectProfile('/path/to/project');
console.log(`Detected: ${type}`);
```

---

### loadProfile()

Load profile configuration.

```typescript
async loadProfile(projectPath: string): Promise<ProjectProfile>
```

---

### applyProfile()

Apply profile settings.

```typescript
async applyProfile(profile: ProjectProfile): Promise<void>
```

---

### initializeProject()

Initialize project configuration.

```typescript
async initializeProject(
  projectPath: string,
  profile: ProjectType
): Promise<void>
```

**Example:**
```typescript
await service.initializeProject('/path/to/project', 'typescript');
```

---

## See Also

- [Profile Guide](../profiles/user-guide.md)
- [Built-in Profiles](../profiles/built-in-profiles.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
