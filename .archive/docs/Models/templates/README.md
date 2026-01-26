# Template System

**Reusable Prompt Templates**

---

## Overview

The Template System provides reusable prompt templates with variable substitution. Create templates once, use them many times with different variables.

### Key Features

- **YAML Format:** Easy to read and edit
- **Variable Substitution:** `{var}` and `{var:default}`
- **Required/Optional Variables:** Validate inputs
- **User & Workspace Templates:** Personal and team templates
- **Template Caching:** Fast loading

---

## Quick Start

### Create Template

```yaml
# ~/.ollm/templates/code_review.yaml
name: code_review
description: Review code for issues
prompt: |
  Review the following {language:TypeScript} code:
  
  ```{language}
  {code}
  ```
  
  Check for:
  - Bugs
  - Performance issues
  - Best practices
  
variables:
  - name: language
    description: Programming language
    required: false
    default: TypeScript
  - name: code
    description: Code to review
    required: true
```

### Use Template

```bash
/template use code_review code="const x = 1;"
```

### List Templates

```bash
/template list
```

---

## Documentation

- **[User Guide](user-guide.md)** - Using templates
- **[Template Reference](template-reference.md)** - Template format
- **[Service API](../api/template-service.md)** - Service documentation

---

## See Also

- [Getting Started](../getting-started.md)
- [Configuration](../Models_configuration.md)
- [Commands Reference](../Models_commands.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
