# Model Routing - Development Guide

**Creating Custom Routing Profiles**

---

## Creating Custom Profiles

### Define Profile

```typescript
// packages/core/src/routing/routingProfiles.ts

export const myProfile: RoutingProfile = {
  name: 'my-profile',
  description: 'My custom profile',
  preferredFamilies: ['llama', 'mistral'],
  minContextWindow: 8192,
  requiredCapabilities: ['tools'],
  fallbackProfile: 'general'
};
```

### Register Profile

```typescript
// Add to ROUTING_PROFILES map
export const ROUTING_PROFILES = new Map([
  ['fast', fastProfile],
  ['general', generalProfile],
  ['code', codeProfile],
  ['creative', creativeProfile],
  ['my-profile', myProfile], // Add here
]);
```

### Use Profile

```yaml
routing:
  profile: my-profile
```

---

## Profile Properties

### name
- **Type:** string
- **Description:** Unique profile identifier

### description
- **Type:** string
- **Description:** Human-readable description

### preferredFamilies
- **Type:** string[]
- **Description:** Model families to prefer (in order)

### minContextWindow
- **Type:** number
- **Description:** Minimum context window required

### requiredCapabilities
- **Type:** string[]
- **Description:** Required model capabilities
- **Values:** 'tools', 'vision', 'streaming'

### fallbackProfile
- **Type:** string (optional)
- **Description:** Profile to use if no models match

---

## Example: Data Analysis Profile

```typescript
export const dataAnalysisProfile: RoutingProfile = {
  name: 'data-analysis',
  description: 'Optimized for data analysis and statistics',
  preferredFamilies: [
    'qwen',           // Good at math
    'deepseek-coder', // Good at code
    'llama'           // General fallback
  ],
  minContextWindow: 16384,  // Need large context for data
  requiredCapabilities: ['tools'], // Need tool calling
  fallbackProfile: 'code'
};
```

---

## See Also

- [User Guide](user-guide.md)
- [Profiles Reference](profiles-reference.md)
- [API Reference](../api/model-router.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
