# Template System Guide

Complete guide to creating and using prompt templates in OLLM CLI.

## Table of Contents

- [Overview](#overview)
- [Template Basics](#template-basics)
- [Creating Templates](#creating-templates)
- [Using Templates](#using-templates)
- [Variable Substitution](#variable-substitution)
- [Template Organization](#template-organization)
- [Built-in Templates](#built-in-templates)
- [Best Practices](#best-practices)

## Overview

Templates allow you to create reusable prompts with variable substitution. This is useful for:

- **Consistency**: Use the same prompt structure across sessions
- **Efficiency**: Avoid retyping common prompts
- **Sharing**: Share templates with team members
- **Customization**: Adapt prompts with variables

## Template Basics

### What is a Template?

A template is a YAML file defining:
- **Name**: Unique identifier
- **Description**: What the template does
- **Template text**: The prompt with variable placeholders
- **Variables**: Definitions for each variable (required, default, description)

**Example** (`code_review.yaml`):
```yaml
name: code_review
description: Review code for quality and security
template: "Review this {language} code for {focus:bugs and security}:\n\n{code}"
variables:
  - name: language
    required: true
    description: Programming language
  - name: focus
    required: false
    default: "bugs and security"
    description: Review focus areas
  - name: code
    required: true
    description: Code to review
```

### Template Locations

Templates are loaded from two directories:

1. **User templates**: `~/.ollm/templates/`
   - Personal templates available in all projects
   - Synced across workspaces

2. **Workspace templates**: `.ollm/templates/`
   - Project-specific templates
   - Shared with team via version control
   - Override user templates with same name

**Precedence**: Workspace templates override user templates.

## Creating Templates

### Interactive Creation

Create a template interactively:

```bash
/template create my_template
```

**Prompts**:
1. Description
2. Template text (with variable placeholders)
3. Variable definitions (name, required/optional, default, description)

**Example interaction**:
```
/template create api_endpoint

Description: Design a REST API endpoint
Template text: Design a {method} endpoint for {resource} that {action}

Add variable 'method' (required/optional/done): required
Description for 'method': HTTP method (GET, POST, etc.)

Add variable 'resource' (required/optional/done): required
Description for 'resource': Resource name (users, posts, etc.)

Add variable 'action' (required/optional/done): required
Description for 'action': What the endpoint does

Add variable (required/optional/done): done

Template 'api_endpoint' created successfully.
Saved to: ~/.ollm/templates/api_endpoint.yaml
```

### Manual Creation

Create a template file manually:

**File**: `~/.ollm/templates/bug_report.yaml`
```yaml
name: bug_report
description: Generate a detailed bug report
template: |
  Create a bug report for the following issue:
  
  Component: {component}
  Severity: {severity:medium}
  Description: {description}
  
  Include:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Possible causes
  - Suggested fixes

variables:
  - name: component
    required: true
    description: Component or module affected
  
  - name: severity
    required: false
    default: "medium"
    description: Bug severity (low, medium, high, critical)
  
  - name: description
    required: true
    description: Brief description of the bug
```

### Template Validation

Templates are validated on load:

**Checks**:
- Valid YAML syntax
- Required fields present (name, description, template)
- Variable references match definitions
- No duplicate variable names

**Invalid template example**:
```yaml
name: invalid_template
# Missing description
template: "Hello {name}"
# Missing variable definition for 'name'
```

**Error**:
```
Error loading template 'invalid_template':
  - Missing required field: description
  - Undefined variable in template: name
```

## Using Templates

### Basic Usage

Use a template with all variables provided:

```bash
/template use code_review language=TypeScript code="const x = 1;"
```

**Behavior**:
1. Loads the template
2. Substitutes variables
3. Executes the resulting prompt

### Interactive Variable Input

If required variables are missing, OLLM prompts for them:

```bash
/template use code_review language=TypeScript
```

**Prompts**:
```
Enter value for 'code': const add = (a, b) => a + b;
```

**Result**:
```
Review this TypeScript code for bugs and security:

const add = (a, b) => a + b;
```

### Multi-line Variables

For multi-line input, use quotes:

```bash
/template use code_review language=Python code="def hello():
    print('Hello, world!')
    return True"
```

Or use interactive mode for easier multi-line input.

### Default Values

Variables with defaults use the default if not provided:

```bash
/template use code_review language=Rust code="fn main() {}"
```

Uses default `focus="bugs and security"`.

**Override default**:
```bash
/template use code_review language=Rust focus="performance" code="fn main() {}"
```

## Variable Substitution

### Variable Syntax

Two formats supported:

1. **Required variable**: `{variable_name}`
2. **Optional with default**: `{variable_name:default_value}`

**Examples**:
```yaml
template: |
  Hello {name}!                          # Required
  Your role is {role:developer}.         # Optional, default "developer"
  Working on {project:unnamed project}.  # Optional, default "unnamed project"
```

### Escaping Braces

To include literal braces in template text, escape them:

```yaml
template: "Use \{curly braces\} for {variable}"
```

**Result**: `Use {curly braces} for <value>`

### Variable Types

Variables are always strings, but you can document expected formats:

```yaml
variables:
  - name: count
    required: true
    description: "Number of items (integer)"
  
  - name: enabled
    required: false
    default: "true"
    description: "Enable feature (true/false)"
  
  - name: tags
    required: false
    default: "tag1,tag2"
    description: "Comma-separated list of tags"
```

### Nested Variables

Variables can reference other variables:

```yaml
template: |
  Project: {project_name}
  File: {project_name}/src/{file_name}
```

**Usage**:
```bash
/template use my_template project_name=myapp file_name=main.ts
```

**Result**:
```
Project: myapp
File: myapp/src/main.ts
```

## Template Organization

### Naming Conventions

**Recommended naming**:
- Use lowercase with underscores: `code_review`, `bug_report`
- Be descriptive: `api_endpoint_design` not `api`
- Group related templates: `test_unit`, `test_integration`, `test_e2e`

### Categorization

Organize templates by purpose:

**User templates** (`~/.ollm/templates/`):
```
~/.ollm/templates/
├── code_review.yaml
├── bug_report.yaml
├── commit_message.yaml
├── refactor_plan.yaml
└── test_plan.yaml
```

**Workspace templates** (`.ollm/templates/`):
```
.ollm/templates/
├── api_endpoint.yaml
├── database_migration.yaml
├── component_design.yaml
└── architecture_decision.yaml
```

### Sharing Templates

**With team**:
1. Create templates in `.ollm/templates/`
2. Commit to version control
3. Team members get templates automatically

**Publicly**:
1. Create templates in `~/.ollm/templates/`
2. Share YAML files via gist, repo, or package
3. Users copy to their templates directory

## Built-in Templates

OLLM includes several built-in templates:

### Code Review
```yaml
name: code_review
description: Review code for quality and security
template: "Review this {language} code for {focus:bugs and security}:\n\n{code}"
```

**Usage**:
```bash
/template use code_review language=TypeScript code="const x = 1;"
```

### Bug Report
```yaml
name: bug_report
description: Generate detailed bug report
template: "Create a bug report for: {description}\nComponent: {component}\nSeverity: {severity:medium}"
```

**Usage**:
```bash
/template use bug_report component=auth description="Login fails with valid credentials"
```

### Commit Message
```yaml
name: commit_message
description: Generate semantic commit message
template: "Generate a commit message for these changes:\n{changes}\n\nType: {type:feat}"
```

**Usage**:
```bash
/template use commit_message changes="Added user authentication" type=feat
```

### Test Plan
```yaml
name: test_plan
description: Create test plan for feature
template: "Create a test plan for: {feature}\nScope: {scope:unit and integration tests}"
```

**Usage**:
```bash
/template use test_plan feature="User registration"
```

## Best Practices

### Template Design

**Keep templates focused**:
- One template per task
- Clear, specific purpose
- Avoid overly generic templates

**Use descriptive variables**:
```yaml
# Good
variables:
  - name: http_method
    description: "HTTP method (GET, POST, PUT, DELETE)"

# Bad
variables:
  - name: method
    description: "Method"
```

**Provide good defaults**:
```yaml
# Good defaults for common cases
variables:
  - name: test_type
    default: "unit"
    description: "Type of test (unit, integration, e2e)"
  
  - name: language
    default: "TypeScript"
    description: "Programming language"
```

### Variable Naming

**Use clear, descriptive names**:
- `language` not `lang`
- `description` not `desc`
- `http_method` not `method`

**Be consistent**:
- Use same names across templates
- Follow project conventions
- Document expected formats

### Template Maintenance

**Version control**:
- Commit workspace templates
- Document template changes
- Review template updates

**Regular review**:
- Remove unused templates
- Update outdated templates
- Consolidate similar templates

**Documentation**:
- Add comments to complex templates
- Document variable formats
- Provide usage examples

### Performance

**Keep templates concise**:
- Avoid very long templates
- Split complex templates into multiple
- Use variables for repeated content

**Minimize variables**:
- Only add necessary variables
- Use defaults for common values
- Group related variables

## Advanced Usage

### Conditional Content

Use variables to include/exclude content:

```yaml
template: |
  Review this code:
  {code}
  
  {additional_context:}
```

If `additional_context` is empty, it's omitted.

### Template Composition

Reference other templates:

```yaml
name: full_review
template: |
  {code_review_template}
  
  Additionally, check for:
  - Performance issues
  - Security vulnerabilities
```

### Dynamic Defaults

Use current context as defaults:

```yaml
variables:
  - name: branch
    default: "main"
    description: "Git branch (current: {current_branch})"
```

## Troubleshooting

### Template Not Found

```
Error: Template 'my_template' not found.
```

**Solutions**:
- Check template name spelling
- Verify template file exists
- Run `/template list` to see available templates
- Check file extension is `.yaml`

### Variable Not Defined

```
Error: Variable 'language' not defined in template.
```

**Solutions**:
- Add variable to `variables` section
- Check variable name spelling
- Ensure variable is in template text

### Invalid YAML

```
Error: Failed to parse template 'my_template': Invalid YAML syntax.
```

**Solutions**:
- Validate YAML syntax
- Check indentation (use spaces, not tabs)
- Escape special characters
- Use YAML validator

### Missing Required Variable

```
Error: Required variable 'code' not provided.
```

**Solutions**:
- Provide variable: `code="..."`
- Make variable optional with default
- Use interactive mode to be prompted

## See Also

- [Commands Reference](commands.md) - All template commands
- [Memory System](memory-system.md) - Cross-session memory
- [Project Profiles](project-profiles.md) - Project-specific configuration
