# Template Service API

**Prompt Template Management**

---

## Overview

The Template Service manages prompt templates with variable substitution.

**File:** `packages/core/src/services/templateService.ts`

---

## Constructor

```typescript
constructor(options?: TemplateOptions)
```

**Options:**
```typescript
interface TemplateOptions {
  userDir?: string;         // User template directory
  workspaceDir?: string;    // Workspace template directory
}
```

---

## Methods

### loadTemplates()

Load templates from directories.

```typescript
async loadTemplates(): Promise<void>
```

---

### getTemplate()

Get a template by name.

```typescript
async getTemplate(name: string): Promise<Template>
```

---

### substitute()

Substitute variables in template.

```typescript
async substitute(
  template: Template,
  variables: Record<string, string>
): Promise<string>
```

**Example:**
```typescript
const template = await service.getTemplate('code_review');
const prompt = await service.substitute(template, {
  language: 'TypeScript',
  code: 'const x = 1;'
});
```

---

### createTemplate()

Create a new template.

```typescript
async createTemplate(template: Template): Promise<void>
```

---

### deleteTemplate()

Delete a template.

```typescript
async deleteTemplate(name: string): Promise<void>
```

---

### listTemplates()

List all templates.

```typescript
async listTemplates(): Promise<Template[]>
```

---

## See Also

- [Template Guide](../templates/user-guide.md)
- [Template Reference](../templates/template-reference.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
