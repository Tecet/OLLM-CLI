# Hook Development Guide

**Creating Custom Hooks for OLLM CLI**

This guide covers how to develop custom hooks in any programming language.

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Hook Protocol](#hook-protocol)
3. [Development Setup](#development-setup)
4. [Writing Hooks](#writing-hooks)
5. [Testing Hooks](#testing-hooks)
6. [Debugging Hooks](#debugging-hooks)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

**See Also:**
- [Hook System Overview](README.md) - Hook system introduction
- [Hook User Guide](user-guide.md) - Using hooks
- [Hook Protocol](protocol.md) - Complete protocol specification
- [MCP Architecture](../MCP_architecture.md) - System architecture

---

## Introduction

### What You'll Learn

This guide teaches you how to:
- Understand the hook protocol
- Write hooks in any language
- Handle different event types
- Test and debug hooks
- Follow best practices
- Deploy hooks to production

### Prerequisites

**Required:**
- Basic programming knowledge
- Understanding of JSON
- Command-line experience

**Recommended:**
- Familiarity with bash/shell scripting
- Understanding of stdin/stdout
- Experience with your chosen language

---

## Hook Protocol

### Overview

Hooks communicate via JSON over stdin/stdout:

```
OLLM CLI → stdin → Hook → stdout → OLLM CLI
```

### Input Format

Hooks receive JSON on stdin:

```json
{
  "event": "pre-tool-call",
  "context": {
    "tool": "read-file",
    "args": {
      "path": "README.md"
    },
    "session": {
      "id": "abc123",
      "user": "developer"
    }
  },
  "metadata": {
    "timestamp": "2026-01-16T10:00:00Z",
    "hookName": "safety-check"
  }
}
```

**Fields:**
- `event` (string, required) - Event type
- `context` (object, required) - Event-specific data
- `metadata` (object, optional) - Additional metadata

### Output Format

Hooks return JSON on stdout:

```json
{
  "allow": true,
  "message": "Operation approved",
  "metadata": {
    "checked": true,
    "duration": 0.05
  }
}
```

**Fields:**
- `allow` (boolean, required) - Whether to allow operation
- `message` (string, optional) - Message to display
- `metadata` (object, optional) - Additional data

### Error Handling

On error, return:

```json
{
  "allow": false,
  "message": "Error: validation failed",
  "metadata": {
    "error": "Invalid input",
    "code": "VALIDATION_ERROR"
  }
}
```

**See:** [Hook Protocol](protocol.md) for complete specification

---

## Development Setup

### Project Structure

Recommended structure for hook projects:

```
my-hooks/
├── README.md
├── package.json (or equivalent)
├── src/
│   ├── format-on-save.sh
│   ├── safety-check.js
│   └── test-runner.py
├── tests/
│   ├── format-on-save.test.sh
│   ├── safety-check.test.js
│   └── test-runner.test.py
└── examples/
    ├── input-pre-tool-call.json
    └── input-on-file-change.json
```

### Development Tools

**Recommended tools:**
- **jq** - JSON processor for bash
- **Node.js** - For JavaScript hooks
- **Python 3** - For Python hooks
- **shellcheck** - Bash linting
- **Your IDE** - With JSON support

**Install jq:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows
choco install jq
```

---

## Writing Hooks

### Bash Hooks

**Template:**
```bash
#!/bin/bash
set -euo pipefail

# Read input from stdin
input=$(cat)

# Parse JSON
event=$(echo "$input" | jq -r '.event')
context=$(echo "$input" | jq -r '.context')

# Your logic here
# ...

# Return response
echo '{
  "allow": true,
  "message": "Success"
}'
```

**Example - Format on Save:**
```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.context.file')

# Format file
if prettier --write "$file" 2>&1; then
  echo '{"allow": true, "message": "File formatted"}'
else
  echo '{"allow": false, "message": "Format failed"}'
fi
```

### JavaScript/Node.js Hooks

**Template:**
```javascript
#!/usr/bin/env node

const fs = require('fs');

// Read input from stdin
const input = JSON.parse(fs.readFileSync(0, 'utf-8'));

// Extract data
const { event, context } = input;

// Your logic here
// ...

// Return response
const response = {
  allow: true,
  message: 'Success'
};

console.log(JSON.stringify(response));
```

**Example - Safety Check:**
```javascript
#!/usr/bin/env node

const fs = require('fs');

const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
const { tool, args } = input.context;

// Check for dangerous operations
const dangerous = [
  'rm -rf /',
  'dd if=/dev/zero',
  'mkfs',
  ':(){ :|:& };:'
];

const isDangerous = dangerous.some(pattern => 
  JSON.stringify(args).includes(pattern)
);

const response = {
  allow: !isDangerous,
  message: isDangerous 
    ? 'Dangerous operation blocked' 
    : 'Operation approved',
  metadata: {
    tool,
    checked: true
  }
};

console.log(JSON.stringify(response));
```

### Python Hooks

**Template:**
```python
#!/usr/bin/env python3

import sys
import json

# Read input from stdin
input_data = json.load(sys.stdin)

# Extract data
event = input_data['event']
context = input_data['context']

# Your logic here
# ...

# Return response
response = {
    'allow': True,
    'message': 'Success'
}

print(json.dumps(response))
```

**Example - Test Runner:**
```python
#!/usr/bin/env python3

import sys
import json
import subprocess

input_data = json.load(sys.stdin)
files = input_data['context'].get('files', [])

# Run tests
try:
    result = subprocess.run(
        ['pytest', '-v'],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    success = result.returncode == 0
    
    response = {
        'allow': success,
        'message': 'Tests passed' if success else 'Tests failed',
        'metadata': {
            'output': result.stdout,
            'errors': result.stderr
        }
    }
except subprocess.TimeoutExpired:
    response = {
        'allow': False,
        'message': 'Tests timed out',
        'metadata': {'timeout': 30}
    }

print(json.dumps(response))
```

### Go Hooks

**Template:**
```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "os"
)

type Input struct {
    Event    string                 `json:"event"`
    Context  map[string]interface{} `json:"context"`
    Metadata map[string]interface{} `json:"metadata"`
}

type Output struct {
    Allow    bool                   `json:"allow"`
    Message  string                 `json:"message"`
    Metadata map[string]interface{} `json:"metadata,omitempty"`
}

func main() {
    // Read input
    input, err := io.ReadAll(os.Stdin)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
        os.Exit(1)
    }

    var data Input
    if err := json.Unmarshal(input, &data); err != nil {
        fmt.Fprintf(os.Stderr, "Error parsing JSON: %v\n", err)
        os.Exit(1)
    }

    // Your logic here
    // ...

    // Return response
    output := Output{
        Allow:   true,
        Message: "Success",
    }

    response, _ := json.Marshal(output)
    fmt.Println(string(response))
}
```

---

## Testing Hooks

### Manual Testing

**Create test input:**
```json
{
  "event": "pre-tool-call",
  "context": {
    "tool": "read-file",
    "args": {"path": "test.txt"}
  }
}
```

**Test hook:**
```bash
# Test with file
cat test-input.json | ./my-hook.sh

# Test with echo
echo '{"event":"test","context":{}}' | ./my-hook.sh

# Test with heredoc
./my-hook.sh <<EOF
{
  "event": "pre-tool-call",
  "context": {"tool": "read-file"}
}
EOF
```

### Automated Testing

**Bash test:**
```bash
#!/bin/bash
# test-hook.sh

test_format_success() {
  input='{"event":"on-file-change","context":{"file":"test.js"}}'
  output=$(echo "$input" | ./format-on-save.sh)
  
  allow=$(echo "$output" | jq -r '.allow')
  
  if [ "$allow" = "true" ]; then
    echo "✓ Test passed"
  else
    echo "✗ Test failed"
    exit 1
  fi
}

test_format_success
```

**JavaScript test (Jest):**
```javascript
const { execSync } = require('child_process');

describe('safety-check hook', () => {
  test('allows safe operations', () => {
    const input = JSON.stringify({
      event: 'pre-tool-call',
      context: {
        tool: 'read-file',
        args: { path: 'test.txt' }
      }
    });
    
    const output = execSync('./safety-check.js', {
      input,
      encoding: 'utf-8'
    });
    
    const response = JSON.parse(output);
    expect(response.allow).toBe(true);
  });
  
  test('blocks dangerous operations', () => {
    const input = JSON.stringify({
      event: 'pre-tool-call',
      context: {
        tool: 'shell',
        args: { command: 'rm -rf /' }
      }
    });
    
    const output = execSync('./safety-check.js', {
      input,
      encoding: 'utf-8'
    });
    
    const response = JSON.parse(output);
    expect(response.allow).toBe(false);
  });
});
```

**Python test (pytest):**
```python
import json
import subprocess

def test_test_runner_success():
    input_data = {
        'event': 'on-git-commit',
        'context': {'files': ['test.py']}
    }
    
    result = subprocess.run(
        ['./test-runner.py'],
        input=json.dumps(input_data),
        capture_output=True,
        text=True
    )
    
    output = json.loads(result.stdout)
    assert output['allow'] == True
```

---

## Debugging Hooks

### Enable Debug Mode

```bash
# Enable debug mode in OLLM CLI
/hooks debug on

# Now hooks will show detailed logs
```

### Logging

**Bash logging:**
```bash
#!/bin/bash

# Log to stderr (won't interfere with stdout)
echo "Debug: Processing file $file" >&2

# Log to file
echo "Debug: Processing file $file" >> /tmp/hook-debug.log
```

**JavaScript logging:**
```javascript
// Log to stderr
console.error('Debug: Processing file', file);

// Log to file
const fs = require('fs');
fs.appendFileSync('/tmp/hook-debug.log', `Debug: ${file}\n`);
```

**Python logging:**
```python
import sys
import logging

# Log to stderr
print(f'Debug: Processing file {file}', file=sys.stderr)

# Log to file
logging.basicConfig(filename='/tmp/hook-debug.log', level=logging.DEBUG)
logging.debug(f'Processing file {file}')
```

### Common Issues

**Hook not executing:**
- Check if hook is executable (`chmod +x hook.sh`)
- Verify shebang line (`#!/bin/bash`)
- Check file permissions
- Enable debug mode

**Invalid JSON output:**
- Validate JSON with `jq`
- Check for extra output on stdout
- Use stderr for logging
- Test manually

**Hook timing out:**
- Reduce processing time
- Add timeout handling
- Use async operations
- Optimize algorithms

---

## Best Practices

### Performance

**Do:**
- ✅ Keep hooks fast (< 1 second)
- ✅ Cache results when possible
- ✅ Use async operations
- ✅ Optimize algorithms
- ✅ Exit early when possible

**Don't:**
- ❌ Make network requests without timeout
- ❌ Process large files synchronously
- ❌ Use blocking operations
- ❌ Perform expensive computations

### Error Handling

**Do:**
- ✅ Always return valid JSON
- ✅ Include helpful error messages
- ✅ Handle edge cases
- ✅ Validate input
- ✅ Use try-catch blocks

**Don't:**
- ❌ Crash on invalid input
- ❌ Return empty output
- ❌ Ignore errors
- ❌ Use generic error messages

### Security

**Do:**
- ✅ Validate all input
- ✅ Sanitize file paths
- ✅ Use safe commands
- ✅ Limit permissions
- ✅ Avoid shell injection

**Don't:**
- ❌ Execute arbitrary code
- ❌ Trust user input
- ❌ Use eval or exec
- ❌ Access sensitive files
- ❌ Make privileged operations

### Code Quality

**Do:**
- ✅ Write clear, readable code
- ✅ Add comments
- ✅ Follow language conventions
- ✅ Use version control
- ✅ Write tests

**Don't:**
- ❌ Write complex logic
- ❌ Use obscure features
- ❌ Ignore linting warnings
- ❌ Skip documentation

---

## Examples

### Example 1: Multi-Language Hook

**Bash wrapper:**
```bash
#!/bin/bash
# Wrapper that calls Python script

input=$(cat)
echo "$input" | python3 ./hook-logic.py
```

**Python logic:**
```python
#!/usr/bin/env python3
import sys
import json

input_data = json.load(sys.stdin)
# Process...
response = {'allow': True, 'message': 'Success'}
print(json.dumps(response))
```

### Example 2: Async Hook

**JavaScript with async:**
```javascript
#!/usr/bin/env node

const fs = require('fs').promises;

async function main() {
  const input = JSON.parse(
    await fs.readFile('/dev/stdin', 'utf-8')
  );
  
  // Async operations
  const result = await processAsync(input);
  
  console.log(JSON.stringify({
    allow: true,
    message: 'Success',
    metadata: result
  }));
}

main().catch(err => {
  console.log(JSON.stringify({
    allow: false,
    message: err.message
  }));
  process.exit(1);
});
```

### Example 3: Hook with Configuration

**Hook with config file:**
```bash
#!/bin/bash

# Load configuration
config_file=".ollm/hooks/config.json"
if [ -f "$config_file" ]; then
  config=$(cat "$config_file")
  max_size=$(echo "$config" | jq -r '.maxFileSize')
else
  max_size=1000000
fi

# Use configuration
input=$(cat)
file=$(echo "$input" | jq -r '.context.file')
size=$(stat -f%z "$file")

if [ "$size" -gt "$max_size" ]; then
  echo '{"allow": false, "message": "File too large"}'
else
  echo '{"allow": true, "message": "File size OK"}'
fi
```

---

## Deployment

### Installation

**Make hook executable:**
```bash
chmod +x my-hook.sh
```

**Install dependencies:**
```bash
# Node.js
npm install

# Python
pip install -r requirements.txt

# Go
go build -o my-hook main.go
```

### Distribution

**Via Git:**
```bash
# Clone repository
git clone https://github.com/user/my-hooks.git
cd my-hooks

# Install
./install.sh
```

**Via Extension:**
```json
{
  "name": "my-hooks",
  "version": "1.0.0",
  "components": {
    "hooks": ["hooks/*.sh"]
  }
}
```

**Via Package Manager:**
```bash
# npm
npm install -g my-hooks

# pip
pip install my-hooks
```

---

## Further Reading

### Documentation
- [Hook System Overview](README.md) - Introduction
- [Hook User Guide](user-guide.md) - Using hooks
- [Hook Protocol](protocol.md) - Complete specification
- [API Reference](../api/hook-system.md) - Hook system API

### Language Resources
- [Bash Guide](https://www.gnu.org/software/bash/manual/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Python Documentation](https://docs.python.org/)
- [Go Documentation](https://golang.org/doc/)

### Tools
- [jq Manual](https://stedolan.github.io/jq/manual/)
- [shellcheck](https://www.shellcheck.net/)
- [JSON Schema](https://json-schema.org/)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0  
**Next:** [Hook Protocol](protocol.md)
