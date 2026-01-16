# Model Router API

**Intelligent Model Selection**

---

## Overview

The Model Router selects the best model for a task based on profiles, capabilities, and preferences.

**File:** `packages/core/src/routing/modelRouter.ts`

---

## Constructor

```typescript
constructor(
  modelDatabase: ModelDatabase,
  modelManagement: ModelManagementService,
  options?: RouterOptions
)
```

---

## Methods

### selectModel()

Select best model for task.

```typescript
async selectModel(criteria: SelectionCriteria): Promise<string>
```

**Criteria:**
```typescript
interface SelectionCriteria {
  profile?: 'fast' | 'general' | 'code' | 'creative';
  minContextWindow?: number;
  requiredCapabilities?: string[];
  preferredFamilies?: string[];
  fallbackProfile?: string;
}
```

**Example:**
```typescript
const model = await router.selectModel({
  profile: 'code',
  minContextWindow: 8192,
  requiredCapabilities: ['tools'],
  preferredFamilies: ['codellama', 'deepseek-coder']
});
```

---

## See Also

- [Model Management Service](model-management-service.md)
- [Routing Guide](../routing/user-guide.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
