# Hook System Documentation

**Event-Driven Automation for OLLM CLI**

The hook system enables event-driven automation, allowing you to run custom code in response to events during LLM execution.

---

## 📚 Documentation

### User Documentation
- **[User Guide](user-guide.md)** - Using hooks in your workflow ⏳ Coming soon
- **[Hook Protocol](protocol.md)** - Hook communication protocol ⏳ Coming soon

### Developer Documentation  
- **[Development Guide](development-guide.md)** - Creating custom hooks ⏳ Coming soon

### Related Documentation
- **[Getting Started](../getting-started.md)** - Quick start with hooks
- **[MCP Commands](../MCP_commands.md)** - Hook commands reference
- **[MCP Architecture](../MCP_architecture.md)** - Hook system architecture
- **[Extensions](../extensions/)** - Extension system (can include hooks)
- **[API Reference](../api/hook-system.md)** - Hook system API ⏳ Coming soon

---

## 🎯 What are Hooks?

Hooks are executables that run in response to events. They receive event data via stdin and can:
- Validate inputs
- Transform data
- Trigger external actions
- Implement safety gates
- Automate workflows

### Hook Events

OLLM CLI supports 12 hook events:

| Event | Description | Use Cases |
|-------|-------------|-----------|
| `pre-execution` | Before LLM execution | Validate prompts, add context |
| `post-execution` | After LLM execution | Save results, trigger actions |
| `pre-tool-call` | Before tool execution | Safety checks, validation |
| `post-tool-call` | After tool execution | Logging, cleanup |
| `on-error` | When error occurs | Error handling, notifications |
| `on-file-change` | File modified | Format code, run linters |
| `on-git-commit` | Before git commit | Run tests, validate |
| `on-session-start` | Session starts | Initialize, load context |
| `on-session-end` | Session ends | Cleanup, save state |
| `on-context-overflow` | Context full | Compress, summarize |
| `on-approval-request` | Approval needed | Custom approval logic |
| `custom` | Custom events | Any custom automation |

---

## 🚀 Quick Start

### Create Your First Hook

```bash
# Simple command hook
/hooks create pre-execution "echo 'Starting execution...'"

# Script hook
/hooks create on-file-change "./scripts/format.sh {file}"

# Executable hook
/hooks create pre-tool-call ./hooks/safety-check.js
```

### Manage Hooks

```bash
# List hooks
/hooks list

# Enable/disable
/hooks enable <name>
/hooks disable <name>

# Trust hooks
/hooks trust <name>

# Debug mode
/hooks debug on
```

---

## 📖 Hook Protocol

Hooks communicate via JSON on stdin/stdout:

### Input (stdin)
```json
{
  "event": "pre-tool-call",
  "context": {
    "tool": "read-file",
    "args": { "path": "README.md" },
    "session": { "id": "abc123" }
  }
}
```

### Output (stdout)
```json
{
  "allow": true,
  "message": "Tool call approved",
  "metadata": { "checked": true }
}
```

**See:** [Hook Protocol](protocol.md) for complete specification

---

## 🔒 Trust Model

Hooks have three trust levels:

### 1. Trusted Hooks
- System hooks
- Always run without approval
- Highest privilege

### 2. Workspace Hooks
- Project-specific hooks
- Require approval first time
- Can be trusted permanently

### 3. Downloaded Hooks
- From extensions
- Require approval each time
- Lowest privilege

```bash
# Trust a workspace hook
/hooks trust my-hook

# Untrust a hook
/hooks untrust my-hook

# List trust status
/hooks list
```

---

## 💡 Common Use Cases

### Code Quality
```bash
# Format on save
/hooks create on-file-change "prettier --write {file}"

# Lint on save
/hooks create on-file-change "eslint --fix {file}"

# Run tests before commit
/hooks create on-git-commit "npm test"
```

### Safety Gates
```bash
# Validate tool calls
/hooks create pre-tool-call "./validate-tool.sh {tool} {args}"

# Check file operations
/hooks create pre-tool-call "./check-file-access.sh {args}"

# Approve destructive operations
/hooks create pre-tool-call "./approve-destructive.sh {tool}"
```

### Workflow Automation
```bash
# Save session on end
/hooks create on-session-end "./save-session.sh {session}"

# Load context on start
/hooks create on-session-start "./load-context.sh"

# Compress context when full
/hooks create on-context-overflow "./compress-context.sh"
```

### Integration
```bash
# Notify on errors
/hooks create on-error "./notify-slack.sh {error}"

# Log executions
/hooks create post-execution "./log-execution.sh {result}"

# Sync with external system
/hooks create post-tool-call "./sync-external.sh {tool} {result}"
```

---

## 🛠️ Development

### Creating Hooks

Hooks can be written in any language:

**Bash:**
```bash
#!/bin/bash
# Read JSON from stdin
input=$(cat)
# Process and output JSON
echo '{"allow": true, "message": "Approved"}'
```

**Python:**
```python
#!/usr/bin/env python3
import json, sys
input_data = json.load(sys.stdin)
# Process
output = {"allow": True, "message": "Approved"}
json.dump(output, sys.stdout)
```

**Node.js:**
```javascript
#!/usr/bin/env node
const input = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
// Process
console.log(JSON.stringify({allow: true, message: "Approved"}));
```

**See:** [Development Guide](development-guide.md) for detailed instructions

---

## 📊 Hook Lifecycle

```
Event Occurs
    ↓
Hook Registry Checks
    ↓
Find Matching Hooks
    ↓
Check Trust Level
    ↓
Request Approval (if needed)
    ↓
Execute Hook
    ↓
Process Response
    ↓
Continue or Block
```

---

## 🔍 Debugging

### Enable Debug Mode
```bash
/hooks debug on
```

### Check Hook Status
```bash
# List all hooks with status
/hooks list

# Show hook details
/hooks info <name>
```

### Test Hooks
```bash
# Test hook manually
echo '{"event":"test","context":{}}' | ./my-hook.sh

# Check hook output
/hooks test <name>
```

### Common Issues

**Hook not executing:**
- Check if hook is enabled
- Verify trust level
- Check file permissions
- Enable debug mode

**Hook failing:**
- Check hook logs
- Verify JSON format
- Test hook manually
- Check dependencies

---

## 📚 Further Reading

### User Documentation
- [User Guide](user-guide.md) - Complete user guide
- [Hook Protocol](protocol.md) - Protocol specification

### Developer Documentation
- [Development Guide](development-guide.md) - Creating hooks
- [API Reference](../api/hook-system.md) - Hook system API

### Related Documentation
- [Extensions](../extensions/) - Extension system
- [MCP Servers](../servers/) - MCP server integration
- [MCP Architecture](../MCP_architecture.md) - System architecture

---

## 🤝 Contributing

Want to contribute hook examples or improvements?

1. Check [Development Guide](development-guide.md)
2. See Contributing Guide (../../../CONTRIBUTING.md)
3. Submit pull requests

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Status:** Active Development
