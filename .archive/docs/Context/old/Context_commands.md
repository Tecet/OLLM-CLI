# Context Management Commands

Complete reference for all Context Management CLI commands in OLLM CLI.

## Table of Contents

- [Overview](#overview)
- [Command Syntax](#command-syntax)
- [Commands Reference](#commands-reference)
  - [/context](#context)
  - [/context size](#context-size)
  - [/context auto](#context-auto)
  - [/context snapshot](#context-snapshot)
  - [/context restore](#context-restore)
  - [/context list](#context-list)
  - [/context clear](#context-clear)
  - [/context compress](#context-compress)
  - [/context stats](#context-stats)
- [Output Formats](#output-formats)
- [Common Workflows](#common-workflows)
- [Error Messages](#error-messages)
- [See Also](#see-also)

---

## Overview

Context Management commands allow you to control how OLLM CLI manages conversation memory and GPU resources. These commands provide real-time control over context size, snapshots, compression, and memory usage.

**Key Features:**
- View current context and VRAM usage
- Manually adjust context size or enable auto-sizing
- Create and restore conversation snapshots
- Trigger manual compression
- View detailed memory statistics

**Command Prefix:** All context commands start with `/context`

---

## Command Syntax

```bash
/context [subcommand] [arguments]
```

**General Rules:**
- Commands are case-insensitive
- Arguments are space-separated
- Use quotes for arguments containing spaces
- Commands can be used in both interactive and non-interactive modes

---

## Commands Reference

### /context

**Description:** Display current context status

**Syntax:**
```bash
/context
```

**Output:**
```
Context Status:
  Model: llama3.1:8b
  Tokens: 12,847 / 32,768 (39.2%)
  VRAM: 6.2 GB / 8.0 GB (77.5%)
  KV Cache: q8_0 (1.8 GB)
  Snapshots: 3 available
  Auto-compress: enabled at 80%
```

**When to Use:**
- Check current memory usage
- Verify context size settings
- See available snapshots
- Monitor VRAM consumption

**Example:**
```bash
# Check status before starting a long conversation
/context

# Verify settings after configuration change
/context
```

---

### /context size

**Description:** Set target context size manually

**Syntax:**
```bash
/context size <tokens>
```

**Arguments:**
- `<tokens>` - Target context size in tokens (positive integer)

**Constraints:**
- Must be between `minSize` and `maxSize` (configured in settings)
- Default range: 2,048 - 32,768 tokens
- Disables auto-sizing when used

**Output:**
```
Context size set to 16384 tokens. Auto-sizing disabled.
```

**When to Use:**
- Need consistent context size for testing
- Working with specific model requirements
- Troubleshooting memory issues
- Optimizing for specific workloads

**Examples:**
```bash
# Set context to 8K tokens
/context size 8192

# Set context to 16K tokens
/context size 16384

# Set to minimum (for low VRAM)
/context size 2048
```

**Error Messages:**
```bash
# Invalid input
/context size abc
→ Invalid token count. Must be a positive number.

# Below minimum
/context size 1000
→ Target size 1000 is below minimum 2048

# Above maximum
/context size 100000
→ Target size 100000 exceeds maximum 32768
```

---

### /context auto

**Description:** Enable automatic context sizing based on available VRAM

**Syntax:**
```bash
/context auto
```

**Output:**
```
Auto-sizing enabled. Context will adjust based on available VRAM. Current size: 24576 tokens.
```

**Behavior:**
- Monitors VRAM availability in real-time
- Adjusts context size dynamically
- Respects min/max size constraints
- Accounts for KV cache quantization
- Reserves safety buffer (default: 512MB)

**When to Use:**
- Default recommended mode
- Maximize context within VRAM limits
- Adapt to changing memory conditions
- Share GPU with other applications

**Example:**
```bash
# Enable auto-sizing after manual adjustment
/context auto

# Re-enable after troubleshooting
/context auto
```

**Calculation:**
```
Available Context = (Available VRAM - Safety Buffer) / Bytes Per Token
```

---

### /context snapshot

**Description:** Create manual snapshot of current conversation

**Syntax:**
```bash
/context snapshot
```

**Output:**
```
Snapshot created: snapshot-2026-01-16-14-30-45
Tokens: 12,847 | Messages: 24
```

**Snapshot Contents:**
- All messages in current conversation
- System prompt
- Token count and metadata
- Timestamp and model information
- Compression state

**Storage Location:**
```
~/.ollm/session-data/{sessionId}/snapshots/
```

**When to Use:**
- Before risky operations
- Save conversation state
- Create checkpoint for rollback
- Before context compression
- End of important discussion

**Examples:**
```bash
# Create snapshot before clearing context
/context snapshot
/context clear

# Create snapshot before compression
/context snapshot
/context compress

# Create snapshot at conversation milestone
/context snapshot
```

---

### /context restore

**Description:** Restore conversation from snapshot

**Syntax:**
```bash
/context restore <snapshot-id>
```

**Arguments:**
- `<snapshot-id>` - Snapshot identifier (from `/context list`)

**Output:**
```
Restored snapshot snapshot-2026-01-16-14-30-45
Tokens: 12,847
```

**Behavior:**
- Replaces current context with snapshot
- Preserves system prompt
- Restores all messages
- Updates token count
- Clears any unsaved changes

**When to Use:**
- Undo unwanted changes
- Return to previous conversation state
- Recover from errors
- Switch between conversation branches

**Examples:**
```bash
# List available snapshots
/context list

# Restore specific snapshot
/context restore snapshot-2026-01-16-14-30-45

# Restore most recent snapshot
/context list
/context restore <most-recent-id>
```

**Error Messages:**
```bash
# Missing argument
/context restore
→ Usage: /context restore <snapshot-id>

# Invalid snapshot ID
/context restore invalid-id
→ Failed to restore snapshot: Snapshot not found
```

---

### /context list

**Description:** List all available snapshots for current session

**Syntax:**
```bash
/context list
```

**Output:**
```
Snapshots:
  1. snapshot-2026-01-16-14-30-45 - 2 hours ago (12,847 tokens)
  2. snapshot-2026-01-16-12-15-30 - 4 hours ago (8,234 tokens)
  3. snapshot-2026-01-16-10-00-00 - 6 hours ago (15,432 tokens)
```

**Information Displayed:**
- Snapshot ID
- Time created (relative)
- Token count
- Numbered for easy reference

**When to Use:**
- Find snapshot to restore
- Check snapshot history
- Verify snapshot creation
- Clean up old snapshots

**Example:**
```bash
# List all snapshots
/context list

# List before restoring
/context list
/context restore snapshot-2026-01-16-14-30-45
```

**Empty State:**
```
No snapshots available.
```

---

### /context clear

**Description:** Clear all messages except system prompt

**Syntax:**
```bash
/context clear
```

**Output:**
```
Context cleared. System prompt preserved.
```

**Behavior:**
- Removes all user and assistant messages
- Preserves system prompt
- Resets token count
- Does NOT create automatic snapshot (create manually first)

**When to Use:**
- Start fresh conversation
- Free up memory
- Reset after errors
- Clean slate for new topic

**⚠️ Warning:** This action cannot be undone unless you create a snapshot first!

**Examples:**
```bash
# Clear with snapshot backup
/context snapshot
/context clear

# Clear without backup (use with caution)
/context clear

# Clear and verify
/context clear
/context
```

---

### /context compress

**Description:** Manually trigger context compression

**Syntax:**
```bash
/context compress
```

**Output:**
```
Compressed: 12,847 → 8,234 tokens (35.9% reduction)
```

**Compression Strategies:**
1. **Truncate** - Remove oldest messages
2. **Summarize** - LLM-generated summary of old messages
3. **Hybrid** - Truncate + summarize + preserve recent (default)

**Behavior:**
- Uses configured compression strategy
- Preserves system prompt (always)
- Preserves recent messages (configurable)
- Creates summary of older messages
- Reduces token count

**When to Use:**
- Approaching context limit
- Before adding large content
- Optimize memory usage
- Prepare for long conversation

**Examples:**
```bash
# Compress when nearing limit
/context
→ Tokens: 28,000 / 32,768 (85.4%)
/context compress
→ Compressed: 28,000 → 18,000 tokens (35.7% reduction)

# Compress before large operation
/context compress
# Now add large file or context
```

**Configuration:**
```yaml
context:
  compression:
    enabled: true
    threshold: 0.8          # Auto-compress at 80%
    strategy: hybrid        # truncate, summarize, or hybrid
    preserveRecent: 4096    # Keep last 4K tokens intact
```

---

### /context stats

**Description:** Show detailed context and memory statistics

**Syntax:**
```bash
/context stats
```

**Output:**
```
Detailed Context Statistics:

Memory:
  Model Weights: 4.2 GB
  KV Cache: 1.8 GB (q8_0)
  Total VRAM: 6.2 GB / 8.0 GB
  Safety Buffer: 512.0 MB reserved

Context:
  Current: 12,847 tokens
  Maximum: 32,768 tokens
  Usage: 39.2%

Session:
  Duration: 2h 15m
  Messages: 24
  Snapshots: 3

Compression History:
  Last compressed: 45 min ago
  Ratio: 28,000 → 18,000 (36% reduction)
```

**Information Displayed:**
- **Memory**: Model weights, KV cache, VRAM usage, safety buffer
- **Context**: Current/max tokens, usage percentage
- **Session**: Duration, message count, snapshot count
- **Compression**: Last compression time and ratio

**When to Use:**
- Troubleshoot memory issues
- Optimize performance
- Understand memory distribution
- Monitor session health
- Debug context problems

**Example:**
```bash
# Check detailed stats
/context stats

# Compare before and after compression
/context stats
/context compress
/context stats
```

---

## Output Formats

### Interactive Mode

Commands display formatted output in the terminal UI with:
- Color-coded status indicators
- Progress bars for usage percentages
- Formatted tables for lists
- Clear section headers

### Non-Interactive Mode

Commands output structured data for scripting:

**JSON Format:**
```bash
ollm --non-interactive --output json "/context"
```

```json
{
  "success": true,
  "data": {
    "model": "llama3.1:8b",
    "tokens": {
      "current": 12847,
      "max": 32768,
      "percentage": 39.2
    },
    "vram": {
      "used": 6643507200,
      "total": 8589934592,
      "percentage": 77.5
    }
  }
}
```

**Text Format:**
```bash
ollm --non-interactive --output text "/context"
```

```
Context Status:
  Model: llama3.1:8b
  Tokens: 12,847 / 32,768 (39.2%)
  VRAM: 6.2 GB / 8.0 GB (77.5%)
```

---

## Common Workflows

### Workflow 1: Monitor and Optimize Memory

```bash
# 1. Check current status
/context

# 2. If usage is high, compress
/context compress

# 3. Verify reduction
/context

# 4. Enable auto-sizing for future
/context auto
```

### Workflow 2: Create Checkpoint Before Risky Operation

```bash
# 1. Create snapshot
/context snapshot

# 2. Perform risky operation
# ... your commands ...

# 3. If something goes wrong, restore
/context list
/context restore <snapshot-id>
```

### Workflow 3: Start Fresh Conversation

```bash
# 1. Save current state (optional)
/context snapshot

# 2. Clear context
/context clear

# 3. Verify clean state
/context
```

### Workflow 4: Troubleshoot Memory Issues

```bash
# 1. Check detailed stats
/context stats

# 2. If VRAM is high, compress
/context compress

# 3. If still high, reduce context size
/context size 8192

# 4. Verify improvement
/context stats
```

### Workflow 5: Manage Long Conversations

```bash
# 1. Enable auto-compression
# (in config: compression.enabled = true)

# 2. Create periodic snapshots
/context snapshot

# 3. Monitor usage
/context

# 4. Compress manually if needed
/context compress

# 5. List and clean old snapshots
/context list
```

---

## Error Messages

### Common Errors

**Invalid Subcommand:**
```
Unknown subcommand: xyz. Use /context, /context size, /context auto, 
/context snapshot, /context restore, /context list, /context clear, 
/context compress, or /context stats
```

**Missing Arguments:**
```
Usage: /context size <tokens>
Usage: /context restore <snapshot-id>
```

**Invalid Token Count:**
```
Invalid token count. Must be a positive number.
```

**Size Out of Range:**
```
Target size 1000 is below minimum 2048
Target size 100000 exceeds maximum 32768
```

**Snapshot Not Found:**
```
Failed to restore snapshot: Snapshot not found
```

**Compression Failed:**
```
Failed to compress context: <error details>
```

**VRAM Query Failed:**
```
Failed to get VRAM info: <error details>
```

### Troubleshooting

**Command Not Recognized:**
- Check spelling and syntax
- Ensure `/` prefix is used
- Try `/help` for command list

**Snapshot Operations Fail:**
- Check disk space
- Verify permissions on `~/.ollm/session-data/`
- Check snapshot ID from `/context list`

**Compression Not Reducing Tokens:**
- Already at minimum (system prompt + recent messages)
- Adjust `preserveRecent` in configuration
- Try different compression strategy

**Auto-Sizing Not Working:**
- Check VRAM monitoring is functional
- Verify GPU detection: `/context stats`
- Check configuration: `autoSize: true`

---

## See Also

- [Getting Started](./getting-started.md) - Quick start guide
- [Architecture](./Context_architecture.md) - System design and components
- [Configuration](./Context_configuration.md) - Configuration options
- [Management Guide](./management/user-guide.md) - Managing context effectively
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions

---

**Last Updated:** 2026-01-16  
**Version:** 1.0.0
