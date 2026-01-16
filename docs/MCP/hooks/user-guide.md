# Hook System User Guide

**Complete Guide to Using Hooks in OLLM CLI**

This guide covers everything you need to know about using hooks for workflow automation in OLLM CLI.

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Hook Basics](#hook-basics)
3. [Creating Hooks](#creating-hooks)
4. [Managing Hooks](#managing-hooks)
5. [Hook Events](#hook-events)
6. [Trust and Security](#trust-and-security)
7. [Common Workflows](#common-workflows)
8. [Troubleshooting](#troubleshooting)

**See Also:**
- [Hook System Overview](README.md) - Hook system introduction
- [Hook Development Guide](development-guide.md) - Creating custom hooks
- [Hook Protocol](protocol.md) - Technical protocol specification
- [MCP Commands](../MCP_commands.md) - Hook command reference

---

## Introduction

Hooks are executables that run in response to events during LLM execution. They enable:
- **Workflow Automation** - Automate repetitive tasks
- **Safety Gates** - Validate operations before execution
- **Custom Logic** - Add custom behavior to OLLM CLI
- **Integration** - Connect with external tools and services

### When to Use Hooks

**Use hooks when you want to:**
- Run commands before/after LLM execution
- Validate tool calls before execution
- Format code automatically on save
- Run tests before commits
- Integrate with external systems
- Add custom approval logic

**Don't use hooks when:**
- Simple configuration would work
- Performance is critical (hooks add overhead)
- You need real-time interaction

---

## Hook Basics

### What is a Hook?

A hook is an executable (script, binary, etc.) that:
1. Receives event data via **stdin** (JSON)
2. Processes the event
3. Returns a response via **stdout** (JSON)

### Hook Lifecycle

```
Event Occurs
    ↓
Hook Registry Finds Matching Hooks
    ↓
Check Trust Level
    ↓
Request Approval (if needed)
    ↓
Execute Hook (pass event data via stdin)
    ↓
Hook Processes Event
    ↓
Hook Returns Response (via stdout)
    ↓
Process Response (allow/block/modify)
    ↓
Continue Execution
```

### Hook Response

Hooks return JSON with:
- `allow` (boolean) - Whether to allow the operation
- `message` (string) - Message to display
- `metadata` (object) - Optional metadata

**Example:**
```json
{
  "allow": true,
  "message": "Operation approved",
  "metadata": {
    "checked": true,
    "timestamp": "2026-01-16T10:00:00Z"
  }
}
```

---

## Creating Hooks

### Quick Create

The simplest way to create a hook:

```bash
# Create a command hook
/hooks create pre-execution "echo '{\"allow\":true}'"

# Create a script hook
/hooks create on-file-change "./scripts/format.sh {file}"

# Create from file
/hooks create pre-tool-call ./hooks/safety-check.js
```

### Command Hooks

Simple one-line commands:

```bash
# Echo a message
/hooks create pre-execution "echo 'Starting execution...'"

# Run a formatter
/hooks create on-file-change "prettier --write {file}"

# Run tests
/hooks create on-git-commit "npm test"
```

### Script Hooks

More complex logic in scripts:

**Bash Script:**
```bash
#!/bin/bash
# save as: hooks/format-on-save.sh

# Read input
input=$(cat)

# Extract file path
file=$(echo "$input" | jq -r '.context.file')

# Format file
prettier --write "$file"

# Return success
echo '{"allow": true, "message": "File formatted"}'
```

**Create hook:**
```bash
/hooks create on-file-change ./hooks/format-on-save.sh
```

### Executable Hooks

Compiled binaries or any executable:

```bash
# Create from binary
/hooks create pre-tool-call ./bin/safety-checker

# Create from Python script
/hooks create on-error ./scripts/notify.py

# Create from Node.js script
/hooks create post-execution ./scripts/log.js
```

---

## Managing Hooks

### Listing Hooks

```bash
# List all hooks
/hooks list

# Output shows:
# - Hook name
# - Event type
# - Trust level
# - Enabled status
```

### Enabling/Disabling Hooks

```bash
# Disable a hook
/hooks disable my-hook

# Enable a hook
/hooks enable my-hook

# Hooks can be disabled temporarily without removing them
```

### Removing Hooks

```bash
# Remove a hook
/hooks remove my-hook

# This permanently deletes the hook
```

### Hook Information

```bash
# Show hook details
/hooks info my-hook

# Shows:
# - Name, event, command
# - Trust level
# - Enabled status
# - Last execution time
# - Execution count
```

---

## Hook Events

### Available Events

OLLM CLI supports 12 hook events:

#### 1. pre-execution
**When:** Before LLM execution starts  
**Use Cases:** Validate prompts, add context, check permissions  
**Context:** `{ prompt, session, user }`

**Example:**
```bash
/hooks create pre-execution "./validate-prompt.sh"
```

#### 2. post-execution
**When:** After LLM execution completes  
**Use Cases:** Save results, trigger actions, log execution  
**Context:** `{ prompt, response, session, duration }`

**Example:**
```bash
/hooks create post-execution "./save-session.sh"
```

#### 3. pre-tool-call
**When:** Before a tool is executed  
**Use Cases:** Safety checks, validation, approval  
**Context:** `{ tool, args, session }`

**Example:**
```bash
/hooks create pre-tool-call "./safety-check.sh"
```

#### 4. post-tool-call
**When:** After a tool is executed  
**Use Cases:** Logging, cleanup, notifications  
**Context:** `{ tool, args, result, duration }`

**Example:**
```bash
/hooks create post-tool-call "./log-tool.sh"
```

#### 5. on-error
**When:** When an error occurs  
**Use Cases:** Error handling, notifications, recovery  
**Context:** `{ error, stack, session }`

**Example:**
```bash
/hooks create on-error "./notify-error.sh"
```

#### 6. on-file-change
**When:** When a file is modified  
**Use Cases:** Format code, run linters, update docs  
**Context:** `{ file, changes, session }`

**Example:**
```bash
/hooks create on-file-change "prettier --write {file}"
```

#### 7. on-git-commit
**When:** Before a git commit  
**Use Cases:** Run tests, validate code, check style  
**Context:** `{ files, message, session }`

**Example:**
```bash
/hooks create on-git-commit "npm test"
```

#### 8. on-session-start
**When:** When a session starts  
**Use Cases:** Initialize, load context, setup  
**Context:** `{ session, user }`

**Example:**
```bash
/hooks create on-session-start "./load-context.sh"
```

#### 9. on-session-end
**When:** When a session ends  
**Use Cases:** Cleanup, save state, backup  
**Context:** `{ session, duration, messageCount }`

**Example:**
```bash
/hooks create on-session-end "./save-state.sh"
```

#### 10. on-context-overflow
**When:** When context is full  
**Use Cases:** Compress, summarize, archive  
**Context:** `{ session, contextSize, maxSize }`

**Example:**
```bash
/hooks create on-context-overflow "./compress-context.sh"
```

#### 11. on-approval-request
**When:** When approval is needed  
**Use Cases:** Custom approval logic, notifications  
**Context:** `{ operation, details, session }`

**Example:**
```bash
/hooks create on-approval-request "./custom-approval.sh"
```

#### 12. custom
**When:** Custom events triggered by extensions  
**Use Cases:** Any custom automation  
**Context:** `{ eventName, data, session }`

**Example:**
```bash
/hooks create custom "./custom-handler.sh"
```

---

## Trust and Security

### Trust Levels

Hooks have three trust levels:

#### 1. Trusted Hooks
- **Source:** System hooks, built-in
- **Approval:** Never required
- **Privilege:** Full access
- **Use Case:** Core functionality

#### 2. Workspace Hooks
- **Source:** Project-specific hooks
- **Approval:** Required first time
- **Privilege:** Limited to workspace
- **Use Case:** Project automation

#### 3. Downloaded Hooks
- **Source:** Extensions, external
- **Approval:** Required each time
- **Privilege:** Sandboxed
- **Use Case:** Third-party automation

### Trusting Hooks

```bash
# Trust a workspace hook
/hooks trust my-hook

# Now runs without approval

# Untrust a hook
/hooks untrust my-hook

# Now requires approval again
```

### Security Best Practices

**Do:**
- ✅ Review hook code before trusting
- ✅ Use workspace hooks for project-specific automation
- ✅ Keep hooks simple and focused
- ✅ Test hooks before trusting
- ✅ Use version control for hooks

**Don't:**
- ❌ Trust hooks from unknown sources
- ❌ Give hooks unnecessary permissions
- ❌ Run hooks with sensitive data without review
- ❌ Trust hooks that modify system files
- ❌ Disable approval for downloaded hooks

---

## Common Workflows

### Code Quality Workflow

```bash
# Format on save
/hooks create on-file-change "prettier --write {file}"
/hooks trust on-file-change

# Lint on save
/hooks create on-file-change "eslint --fix {file}"
/hooks trust on-file-change

# Run tests before commit
/hooks create on-git-commit "npm test"
/hooks trust on-git-commit
```

### Safety Gate Workflow

```bash
# Validate tool calls
/hooks create pre-tool-call "./validate-tool.sh"
/hooks trust pre-tool-call

# Check file operations
/hooks create pre-tool-call "./check-file-access.sh"
/hooks trust pre-tool-call

# Approve destructive operations
/hooks create pre-tool-call "./approve-destructive.sh"
/hooks trust pre-tool-call
```

### Integration Workflow

```bash
# Notify on errors
/hooks create on-error "./notify-slack.sh"
/hooks trust on-error

# Log executions
/hooks create post-execution "./log-to-db.sh"
/hooks trust post-execution

# Sync with external system
/hooks create post-tool-call "./sync-external.sh"
/hooks trust post-tool-call
```

### Session Management Workflow

```bash
# Load context on start
/hooks create on-session-start "./load-context.sh"
/hooks trust on-session-start

# Save state on end
/hooks create on-session-end "./save-state.sh"
/hooks trust on-session-end

# Compress context when full
/hooks create on-context-overflow "./compress.sh"
/hooks trust on-context-overflow
```

---

## Troubleshooting

### Hook Not Executing

**Check if hook is enabled:**
```bash
/hooks list
# Look for "enabled: true"
```

**Check trust level:**
```bash
/hooks info my-hook
# If "workspace" or "downloaded", may need approval
```

**Enable debug mode:**
```bash
/hooks debug on
# Shows detailed execution logs
```

### Hook Failing

**Test hook manually:**
```bash
# Test with sample input
echo '{"event":"test","context":{}}' | ./my-hook.sh
```

**Check hook output:**
```bash
# Hook must output valid JSON
# Check for syntax errors
```

**Check permissions:**
```bash
# Make sure hook is executable
chmod +x ./my-hook.sh
```

### Hook Approval Issues

**Trust the hook:**
```bash
/hooks trust my-hook
```

**Check trust level:**
```bash
/hooks info my-hook
# Shows current trust level
```

**Review approval settings:**
```bash
# Check if approval is required
# Workspace hooks need approval first time
# Downloaded hooks need approval each time
```

### Performance Issues

**Disable slow hooks:**
```bash
/hooks disable slow-hook
```

**Optimize hook code:**
- Reduce processing time
- Cache results
- Use async operations

**Limit hook execution:**
- Only run on specific events
- Add conditions in hook code
- Use event filtering

---

## Advanced Usage

### Conditional Execution

Hooks can implement conditions:

```bash
#!/bin/bash
# Only run on TypeScript files

input=$(cat)
file=$(echo "$input" | jq -r '.context.file')

if [[ "$file" == *.ts ]]; then
  prettier --write "$file"
  echo '{"allow": true, "message": "Formatted TypeScript file"}'
else
  echo '{"allow": true, "message": "Skipped non-TypeScript file"}'
fi
```

### Chaining Hooks

Multiple hooks can run for the same event:

```bash
# Create multiple hooks for same event
/hooks create on-file-change "./format.sh"
/hooks create on-file-change "./lint.sh"
/hooks create on-file-change "./test.sh"

# All three will run in order
```

### Hook Variables

Hooks receive context variables:

- `{file}` - File path (on-file-change)
- `{tool}` - Tool name (pre/post-tool-call)
- `{args}` - Tool arguments (pre/post-tool-call)
- `{error}` - Error message (on-error)
- `{session}` - Session ID (all events)

**Example:**
```bash
/hooks create on-file-change "echo 'File changed: {file}'"
```

---

## Best Practices

### Hook Design

**Keep hooks simple:**
- One responsibility per hook
- Fast execution (< 1 second)
- Clear error messages
- Idempotent operations

**Use appropriate events:**
- `pre-*` for validation
- `post-*` for logging
- `on-*` for automation

**Handle errors gracefully:**
- Return proper JSON even on error
- Include helpful error messages
- Don't crash on invalid input

### Hook Organization

**Project structure:**
```
project/
├── .ollm/
│   └── hooks/
│       ├── format-on-save.sh
│       ├── lint-on-save.sh
│       ├── test-pre-commit.sh
│       └── README.md
└── ...
```

**Document your hooks:**
- Add comments to hook code
- Create README for hook directory
- Document required dependencies

**Version control:**
- Commit hooks to repository
- Share with team
- Track changes

---

## Examples

### Example 1: Format on Save

```bash
#!/bin/bash
# .ollm/hooks/format-on-save.sh

input=$(cat)
file=$(echo "$input" | jq -r '.context.file')

# Format file
prettier --write "$file" 2>&1

if [ $? -eq 0 ]; then
  echo '{"allow": true, "message": "File formatted successfully"}'
else
  echo '{"allow": false, "message": "Format failed"}'
fi
```

**Create hook:**
```bash
/hooks create on-file-change ./.ollm/hooks/format-on-save.sh
/hooks trust on-file-change
```

### Example 2: Safety Check

```bash
#!/bin/bash
# .ollm/hooks/safety-check.sh

input=$(cat)
tool=$(echo "$input" | jq -r '.context.tool')
args=$(echo "$input" | jq -r '.context.args')

# Block dangerous operations
if [[ "$tool" == "shell" ]] && [[ "$args" == *"rm -rf"* ]]; then
  echo '{"allow": false, "message": "Dangerous operation blocked"}'
  exit 0
fi

echo '{"allow": true, "message": "Operation approved"}'
```

**Create hook:**
```bash
/hooks create pre-tool-call ./.ollm/hooks/safety-check.sh
/hooks trust pre-tool-call
```

### Example 3: Test Before Commit

```bash
#!/bin/bash
# .ollm/hooks/test-pre-commit.sh

# Run tests
npm test 2>&1

if [ $? -eq 0 ]; then
  echo '{"allow": true, "message": "All tests passed"}'
else
  echo '{"allow": false, "message": "Tests failed, commit blocked"}'
fi
```

**Create hook:**
```bash
/hooks create on-git-commit ./.ollm/hooks/test-pre-commit.sh
/hooks trust on-git-commit
```

---

## Further Reading

### Documentation
- [Hook System Overview](README.md) - Introduction to hooks
- [Hook Development Guide](development-guide.md) - Creating custom hooks
- [Hook Protocol](protocol.md) - Technical specification
- [MCP Commands](../MCP_commands.md) - Hook commands

### Related Features
- [Extensions](../extensions/) - Extensions can include hooks
- [MCP Servers](../servers/) - MCP servers for tools
- [API Reference](../api/hook-system.md) - Hook system API

### External Resources
- [Bash Scripting Guide](https://www.gnu.org/software/bash/manual/)
- [jq Manual](https://stedolan.github.io/jq/manual/)
- [JSON Specification](https://www.json.org/)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Next:** [Hook Development Guide](development-guide.md)
