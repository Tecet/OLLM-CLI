# Template Format Reference

**YAML Template Specification**

---

## Template Structure

```yaml
name: string              # Required: Template identifier
description: string       # Required: Human-readable description
prompt: string           # Required: Prompt text with variables
variables:               # Optional: Variable definitions
  - name: string         # Required: Variable name
    description: string  # Optional: Variable description
    required: boolean    # Optional: Is variable required? (default: false)
    default: string      # Optional: Default value
metadata:                # Optional: Custom metadata
  key: value
```

---

## Fields

### name
- **Type:** string
- **Required:** Yes
- **Description:** Unique template identifier
- **Example:** `code_review`

### description
- **Type:** string
- **Required:** Yes
- **Description:** Human-readable description
- **Example:** `Review code for issues`

### prompt
- **Type:** string (multiline)
- **Required:** Yes
- **Description:** Prompt text with `{variables}`
- **Example:**
```yaml
prompt: |
  Review this {language} code:
  {code}
```

### variables
- **Type:** array
- **Required:** No
- **Description:** Variable definitions

#### Variable Fields

**name:**
- **Type:** string
- **Required:** Yes
- **Pattern:** `[a-zA-Z_][a-zA-Z0-9_]*`
- **Example:** `language`, `code`, `max_length`

**description:**
- **Type:** string
- **Required:** No
- **Example:** `Programming language`

**required:**
- **Type:** boolean
- **Required:** No
- **Default:** false
- **Example:** `true`

**default:**
- **Type:** string
- **Required:** No
- **Example:** `TypeScript`

### metadata
- **Type:** object
- **Required:** No
- **Description:** Custom metadata
- **Example:**
```yaml
metadata:
  author: Alice
  version: 1.0
  tags: [code, review]
```

---

## Variable Syntax

### Basic Variable

```yaml
prompt: |
  Hello {name}!
```

**Substitution:**
- `name=Alice` → `Hello Alice!`

### Variable with Default

```yaml
prompt: |
  Language: {language:TypeScript}
```

**Substitution:**
- No value → `Language: TypeScript`
- `language=Python` → `Language: Python`

### Multiple Variables

```yaml
prompt: |
  {greeting:Hello} {name}!
  You are {age:unknown} years old.
```

---

## Complete Example

```yaml
name: code_review
description: Review code for bugs and improvements
prompt: |
  Review the following {language:TypeScript} code:
  
  ```{language}
  {code}
  ```
  
  Focus on:
  {focus:bugs, performance, best practices}
  
  Provide {detail_level:detailed} feedback.

variables:
  - name: language
    description: Programming language
    required: false
    default: TypeScript
    
  - name: code
    description: Code to review
    required: true
    
  - name: focus
    description: What to focus on
    required: false
    default: bugs, performance, best practices
    
  - name: detail_level
    description: Level of detail (brief, detailed, comprehensive)
    required: false
    default: detailed

metadata:
  author: Development Team
  version: 1.0
  category: code
  tags: [review, quality, best-practices]
```

---

## Validation Rules

### Template Name
- Must be unique
- Alphanumeric and underscores only
- No spaces

### Variable Names
- Must start with letter or underscore
- Alphanumeric and underscores only
- No spaces or special characters

### Required Variables
- Must be provided when using template
- No default value allowed

### Optional Variables
- Can have default value
- Default used if not provided

---

## See Also

- [User Guide](user-guide.md)
- [Template Service API](../api/template-service.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
