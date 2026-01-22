# Hook Development Guide

This guide provides comprehensive instructions for developing, testing, and deploying hooks for the OLLM CLI.

## Table of Contents

- [Getting Started](#getting-started)
- [Hook Protocol](#hook-protocol)
- [Development Workflow](#development-workflow)
- [Testing Hooks](#testing-hooks)
- [Debugging Hooks](#debugging-hooks)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Publishing Hooks](#publishing-hooks)

## Getting Started

### Prerequisites

- OLLM CLI installed
- Basic understanding of JSON
- Familiarity with your chosen language (Node.js, Python, etc.)
- Text editor or IDE

### Quick Start

1. **Create a hook script**:

```javascript
#!/usr/bin/env node
// my-first-hook.js

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const { event, data } = JSON.parse(input);
  
  console.error(`Hook received event: ${event}`);
  
  process.stdout.write(JSON.stringify({
    continue: true,
    systemMessage: 'Hello from my first hook!',
  }));
});
```

2. **Make it executable**:

```bash
chmod +x my-first-hook.js
```

3. **Test it manually**:

```bash
echo '{"event":"before_model","data":{"model":"llama2"}}' | ./my-first-hook.js
```

4. **Register it** (in your application code):

```typescript
registry.registerHook('before_model', {
  id: 'my-first-hook',
  name: 'My First Hook',
  command: 'node',
  args: ['/path/to/my-first-hook.js'],
  source: 'user',
  sourcePath: '/path/to/my-first-hook.js',
});
```

## Hook Protocol

### Input Format

Hooks receive JSON on stdin:

```json
{
  "event": "before_model",
  "data": {
    "model": "llama2",
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  }
}
```

### Output Format

Hooks must write JSON to stdout:

```json
{
  "continue": true,
  "systemMessage": "Optional message",
  "data": {
    "customField": "value"
  }
}
```

### Required Fields

- **continue** (boolean): Whether to continue operation
  - `true`: Proceed normally
  - `false`: Abort operation

### Optional Fields

- **systemMessage** (string): Message to add to conversation
- **data** (object): Data to pass to next hook
- **error** (string): Error message if hook failed

### Event Types

See [README.md](./README.md#hook-events) for complete list of events and their data structures.

## Development Workflow

### Step 1: Choose Your Language

Hooks can be written in any language that can:
- Read from stdin
- Write to stdout
- Parse and generate JSON

Popular choices:
- **Node.js**: Fast, good JSON support, large ecosystem
- **Python**: Easy to learn, great for data processing
- **Bash**: Simple for basic operations
- **Go**: Fast, compiled, good for performance-critical hooks
- **Rust**: Maximum performance and safety

### Step 2: Set Up Development Environment

#### Node.js

```bash
mkdir my-hook
cd my-hook
npm init -y
npm install --save-dev @types/node
```

Create `hook.js`:

```javascript
#!/usr/bin/env node

const readline = require('readline');

async function main() {
  // Read input from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let input = '';
  for await (const line of rl) {
    input += line;
  }

  try {
    const { event, data } = JSON.parse(input);
    
    // Your hook logic here
    const output = {
      continue: true,
      systemMessage: `Processed ${event}`,
    };
    
    console.log(JSON.stringify(output));
  } catch (error) {
    console.log(JSON.stringify({
      continue: true,
      error: error.message,
    }));
  }
}

main();
```

#### Python

```bash
mkdir my-hook
cd my-hook
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Create `hook.py`:

```python
#!/usr/bin/env python3

import sys
import json

def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        event = input_data['event']
        data = input_data['data']
        
        # Your hook logic here
        output = {
            'continue': True,
            'systemMessage': f'Processed {event}',
        }
        
        json.dump(output, sys.stdout)
    
    except Exception as e:
        json.dump({
            'continue': True,
            'error': str(e),
        }, sys.stdout)

if __name__ == '__main__':
    main()
```

### Step 3: Implement Hook Logic

#### Example: Logging Hook

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const { event, data } = JSON.parse(input);
    
    // Log to file
    const logFile = path.join(process.env.HOME, '.ollm', 'hook.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
    };
    
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    // Continue normally
    process.stdout.write(JSON.stringify({ continue: true }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      continue: true,
      error: error.message,
    }));
  }
});
```

#### Example: Validation Hook

```python
#!/usr/bin/env python3

import sys
import json
import re

def main():
    try:
        input_data = json.load(sys.stdin)
        event = input_data['event']
        data = input_data['data']
        
        # Validate tool calls
        if event == 'before_tool':
            tool_name = data.get('tool_name')
            args = data.get('args', {})
            
            # Block dangerous patterns
            if tool_name == 'shell':
                command = args.get('command', '')
                dangerous_patterns = [
                    r'rm\s+-rf\s+/',
                    r'dd\s+if=',
                    r'mkfs',
                ]
                
                for pattern in dangerous_patterns:
                    if re.search(pattern, command):
                        json.dump({
                            'continue': False,
                            'systemMessage': f'Blocked dangerous command pattern: {pattern}',
                        }, sys.stdout)
                        return
        
        # Allow by default
        json.dump({'continue': True}, sys.stdout)
    
    except Exception as e:
        json.dump({
            'continue': True,
            'error': str(e),
        }, sys.stdout)

if __name__ == '__main__':
    main()
```

### Step 4: Handle Errors

Always handle errors gracefully:

```javascript
try {
  // Hook logic
  const result = processEvent(event, data);
  
  process.stdout.write(JSON.stringify({
    continue: true,
    data: result,
  }));
} catch (error) {
  // Log error to stderr (visible in logs)
  console.error('Hook error:', error);
  
  // Return error in output (doesn't abort operation)
  process.stdout.write(JSON.stringify({
    continue: true,
    error: error.message,
  }));
}
```

## Testing Hooks

### Manual Testing

Test hooks with sample input:

```bash
# Create test input
cat > test-input.json << EOF
{
  "event": "before_model",
  "data": {
    "model": "llama2",
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  }
}
EOF

# Run hook
cat test-input.json | node hook.js

# Expected output:
# {"continue":true,"systemMessage":"..."}
```

### Automated Testing

#### Node.js with Jest

```javascript
// hook.test.js
const { spawn } = require('child_process');

function runHook(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['hook.js']);
    
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Hook exited with code ${code}`));
      } else {
        resolve(JSON.parse(output));
      }
    });
    
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

describe('Hook', () => {
  it('should process before_model event', async () => {
    const input = {
      event: 'before_model',
      data: { model: 'llama2' },
    };
    
    const output = await runHook(input);
    
    expect(output.continue).toBe(true);
    expect(output.systemMessage).toBeDefined();
  });
  
  it('should handle errors gracefully', async () => {
    const input = {
      event: 'invalid_event',
      data: {},
    };
    
    const output = await runHook(input);
    
    expect(output.continue).toBe(true);
    expect(output.error).toBeDefined();
  });
});
```

#### Python with pytest

```python
# test_hook.py
import subprocess
import json
import pytest

def run_hook(input_data):
    proc = subprocess.run(
        ['python3', 'hook.py'],
        input=json.dumps(input_data),
        capture_output=True,
        text=True,
    )
    
    if proc.returncode != 0:
        raise Exception(f'Hook exited with code {proc.returncode}')
    
    return json.loads(proc.stdout)

def test_before_model_event():
    input_data = {
        'event': 'before_model',
        'data': {'model': 'llama2'},
    }
    
    output = run_hook(input_data)
    
    assert output['continue'] == True
    assert 'systemMessage' in output

def test_error_handling():
    input_data = {
        'event': 'invalid_event',
        'data': {},
    }
    
    output = run_hook(input_data)
    
    assert output['continue'] == True
    assert 'error' in output
```

### Integration Testing

Test hooks in the actual OLLM CLI environment:

```typescript
import { HookRegistry, HookRunner, HookTranslator } from '@ollm/ollm-cli-core/hooks';

describe('Hook Integration', () => {
  it('should execute hook in real environment', async () => {
    const registry = new HookRegistry();
    const runner = new HookRunner();
    const translator = new HookTranslator();
    
    // Register hook
    registry.registerHook('before_model', {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'node',
      args: ['/path/to/hook.js'],
      source: 'user',
    });
    
    // Execute
    const hooks = registry.getHooksForEvent('before_model');
    const input = translator.toHookInput('before_model', {
      model: 'llama2',
      messages: [],
    });
    
    const results = await runner.executeHooks(hooks, input);
    
    expect(results).toHaveLength(1);
    expect(results[0].continue).toBe(true);
  });
});
```

## Debugging Hooks

### Logging

Use stderr for debug output (won't interfere with stdout):

```javascript
// Debug logging
console.error('Debug: Processing event', event);
console.error('Debug: Data received', JSON.stringify(data, null, 2));

// Normal output to stdout
process.stdout.write(JSON.stringify(output));
```

### Hook Debugger

Enable hook debugging in OLLM CLI:

```typescript
import { getHookDebugger } from '@ollm/ollm-cli-core/hooks';

const debugger = getHookDebugger();
debugger.enable();
debugger.setFormat('detailed');

// Hook execution will now be traced
```

### Debugging Tools

#### Node.js

```bash
# Run with debugger
node --inspect-brk hook.js < test-input.json

# Attach with Chrome DevTools
# Open chrome://inspect
```

#### Python

```bash
# Run with debugger
python3 -m pdb hook.py < test-input.json

# Or use ipdb for better experience
pip install ipdb
python3 -m ipdb hook.py < test-input.json
```

### Common Issues

#### Issue: Hook times out

**Cause**: Hook takes too long to execute

**Solution**:
- Optimize hook logic
- Increase timeout in configuration
- Use async operations

#### Issue: Hook produces no output

**Cause**: Hook crashes or doesn't write to stdout

**Solution**:
- Check stderr for errors
- Add error handling
- Test hook manually

#### Issue: Invalid JSON output

**Cause**: Hook writes malformed JSON

**Solution**:
- Validate JSON before writing
- Use JSON library (don't construct manually)
- Test with JSON validator

## Best Practices

### 1. Always Validate Input

```javascript
const { event, data } = JSON.parse(input);

// Validate event type
const validEvents = ['before_model', 'after_model'];
if (!validEvents.includes(event)) {
  throw new Error(`Unexpected event: ${event}`);
}

// Validate data structure
if (!data || typeof data !== 'object') {
  throw new Error('Invalid data structure');
}
```

### 2. Handle All Errors

```javascript
try {
  // Hook logic
} catch (error) {
  console.error('Hook error:', error);
  process.stdout.write(JSON.stringify({
    continue: true,
    error: error.message,
  }));
  process.exit(0); // Exit successfully even on error
}
```

### 3. Use Structured Logging

```javascript
function log(level, message, data = {}) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  }));
}

log('info', 'Hook started', { event });
log('debug', 'Processing data', { data });
log('error', 'Hook failed', { error: error.message });
```

### 4. Keep Hooks Fast

```javascript
// Bad: Synchronous file I/O
const data = fs.readFileSync('/large/file.txt', 'utf8');

// Good: Async or streaming
const stream = fs.createReadStream('/large/file.txt');
```

### 5. Minimize Dependencies

```javascript
// Bad: Large dependency for simple task
const _ = require('lodash');
const result = _.get(data, 'nested.field');

// Good: Native JavaScript
const result = data?.nested?.field;
```

### 6. Document Your Hook

```javascript
/**
 * Model Call Logger Hook
 * 
 * Logs all model calls to ~/.ollm/model-calls.log
 * 
 * Events: before_model
 * 
 * Configuration:
 * - LOG_FILE: Path to log file (default: ~/.ollm/model-calls.log)
 * 
 * Security: Reads/writes to user's home directory only
 */
```

## Common Patterns

### Pattern 1: Conditional Execution

```javascript
const { event, data } = JSON.parse(input);

// Only process specific events
if (event !== 'before_model') {
  process.stdout.write(JSON.stringify({ continue: true }));
  return;
}

// Process event
// ...
```

### Pattern 2: Data Transformation

```javascript
const { event, data } = JSON.parse(input);

if (event === 'before_model') {
  // Transform messages
  const transformedMessages = data.messages.map(msg => ({
    ...msg,
    content: msg.content.toUpperCase(),
  }));
  
  process.stdout.write(JSON.stringify({
    continue: true,
    data: {
      messages: transformedMessages,
    },
  }));
}
```

### Pattern 3: External API Call

```javascript
const https = require('https');

async function callAPI(data) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.example.com',
      path: '/validate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

// Use in hook
const result = await callAPI(data);
```

### Pattern 4: Configuration File

```javascript
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(process.env.HOME, '.ollm', 'hook-config.json');
let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  // Use defaults if config doesn't exist
  config = {
    enabled: true,
    logLevel: 'info',
  };
}

// Use configuration
if (!config.enabled) {
  process.stdout.write(JSON.stringify({ continue: true }));
  return;
}
```

## Troubleshooting

### Hook Not Executing

**Check:**
1. Hook is registered for correct event
2. Hook source is trusted
3. Hook has been approved (if workspace/downloaded)
4. Hooks are enabled in configuration
5. Hook command is valid

### Hook Fails Silently

**Check:**
1. Hook writes to stdout (not stderr)
2. Hook outputs valid JSON
3. Hook exits with code 0
4. No syntax errors in hook script

### Hook Times Out

**Solutions:**
1. Optimize hook logic
2. Increase timeout in configuration
3. Use async operations
4. Cache expensive computations

### Hook Produces Wrong Output

**Debug:**
1. Test hook manually with sample input
2. Check stderr for error messages
3. Validate JSON output
4. Add debug logging

## Publishing Hooks

### Packaging

Create a package with:
- Hook script
- README with usage instructions
- LICENSE file
- Example configuration
- Tests

### Distribution

Options:
1. **npm package** (for Node.js hooks)
2. **PyPI package** (for Python hooks)
3. **GitHub repository**
4. **OLLM extension** (future)

### Documentation

Include:
- What the hook does
- Which events it handles
- Required configuration
- Security implications
- Installation instructions
- Usage examples

### Example README

```markdown
# My Awesome Hook

Logs all model calls to a file.

## Installation

```bash
npm install -g my-awesome-hook
```

## Usage

Register the hook:

```typescript
registry.registerHook('before_model', {
  id: 'my-awesome-hook',
  name: 'My Awesome Hook',
  command: 'my-awesome-hook',
  source: 'user',
});
```

## Configuration

Set `LOG_FILE` environment variable to customize log location:

```bash
export LOG_FILE=~/.ollm/my-hook.log
```

## Security

This hook:
- Reads model call data
- Writes to log file in user's home directory
- Does not make network requests
- Does not access credentials

## License

MIT
```

## Next Steps

- Read [SECURITY.md](./SECURITY.md) for security best practices
- See [README.md](./README.md) for API reference
- Check [examples](./examples/) for more hook examples
- Join the community to share your hooks

## Resources

- [Hook System Spec](.kiro/specs/stage-05-hooks-extensions-mcp/)
- [Security Audit](.dev/audits/hook-system-audit.md)
- [API Documentation](./README.md)
- [Security Model](./SECURITY.md)
