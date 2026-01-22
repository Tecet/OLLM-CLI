# Session Recovery and Rollback

**Last Updated:** January 20, 2026

---

## Overview

OLLM CLI provides two separate systems for managing conversation data:

1. **Chat History (Sessions)** - Complete record of all conversations
2. **Context Snapshots** - Save context state for recovery and rollback

This separation provides clarity, better organization, and powerful recovery capabilities.

---

## Two-System Architecture

### System 1: Chat History (Full Conversation)

**Purpose:** Preserve complete conversation history for review, audit, and debugging

**Storage Location:**
- **Linux/macOS:** `~/.ollm/sessions/`
- **Windows:** `C:\Users\{username}\.ollm\sessions\`

**What It Saves:**
- Complete session metadata (model, provider, timestamps)
- All messages in conversation
- All tool calls and results
- Token counts and compression history
- Mode transition history

**File Format:** JSON files named `{sessionId}.json`

**Retention:** Last 100 sessions (configurable)

**Use Cases:**
- Review past conversations
- Audit tool usage
- Debug issues
- Export conversations
- Resume previous sessions

---

### System 2: Context Snapshots (Rollover State)

**Purpose:** Save context state at key points for recovery and rollback

**Storage Location:**
- **Linux/macOS:** `~/.ollm/context-snapshots/`
- **Windows:** `C:\Users\{username}\.ollm\context-snapshots\`

**What It Saves:**
- Context snapshot at specific point in time
- All messages at snapshot time
- Token counts and compression ratios
- Model and context size metadata
- Summary of conversation content

**File Format:** JSON files in `{sessionId}/snapshots/` directories

**Retention:** Last 5 snapshots per session (configurable)

**Use Cases:**
- Recover from LLM malfunction
- Rollback for development
- Test different approaches
- Restore to known good state

---

## CLI Commands

### Session Management

#### List All Sessions
```bash
/session list
```

Shows all saved sessions with:
- Session ID
- Start time
- Last activity
- Model used
- Message count

#### Show Session Details
```bash
/session show <session-id>
```

Displays detailed information about a specific session.

#### Resume Session
```bash
/session resume <session-id>
```

Restores a previous session and continues the conversation.

#### Delete Session
```bash
/session delete <session-id>
```

Permanently deletes a session and its data.

#### Export Session
```bash
/session export <session-id> [output-file]
```

Exports a session to a JSON file for backup or sharing.

---

### Snapshot Management

#### List Snapshots
```bash
/snapshot list <session-id>
```

Shows all snapshots for a session with:
- Snapshot ID
- Timestamp
- Token count
- Summary

#### Show Snapshot Details
```bash
/snapshot show <snapshot-id>
```

Displays detailed information about a specific snapshot.

#### Restore from Snapshot
```bash
/snapshot restore <snapshot-id>
```

Restores context from a specific snapshot.

#### Rollback to Last Snapshot
```bash
/snapshot rollback <session-id>
```

Quickly rollback to the most recent snapshot for a session.

#### Create Manual Snapshot
```bash
/snapshot create
```

Manually creates a snapshot of the current context.

---

### Configuration

#### Show Storage Paths
```bash
/config paths
```

Displays all storage locations:
- Sessions directory
- Context snapshots directory
- Config directory
- Cache directory

Useful for verifying paths on Windows and debugging storage issues.

---

## Recovery Procedures

### Scenario 1: Recover from LLM Malfunction

**Problem:** LLM starts producing nonsensical output or gets confused

**Solution:**
1. List available snapshots:
   ```bash
   /snapshot list <session-id>
   ```

2. Identify snapshot before malfunction (check timestamps)

3. Restore from that snapshot:
   ```bash
   /snapshot restore <snapshot-id>
   ```

4. Continue conversation from restored state

**Result:** Context restored to known good state, conversation continues normally

---

### Scenario 2: Rollback for Development

**Problem:** Testing a risky change and want ability to rollback

**Solution:**
1. Create snapshot before change:
   ```bash
   /snapshot create
   ```

2. Make your changes and test

3. If needed, rollback:
   ```bash
   /snapshot rollback <session-id>
   ```

4. Try different approach

**Result:** Can safely experiment knowing you can rollback

---

### Scenario 3: Resume Previous Session

**Problem:** Want to continue a conversation from yesterday

**Solution:**
1. List available sessions:
   ```bash
   /session list
   ```

2. Find the session you want to resume

3. Resume it:
   ```bash
   /session resume <session-id>
   ```

**Result:** Previous conversation restored, can continue where you left off

---

### Scenario 4: Export for Backup

**Problem:** Want to backup important conversations

**Solution:**
1. List sessions:
   ```bash
   /session list
   ```

2. Export important sessions:
   ```bash
   /session export <session-id> backup-2026-01-20.json
   ```

3. Store backup file safely

**Result:** Conversation backed up to external file

---

## Automatic Snapshots

Snapshots are created automatically at key points:

### Trigger Points
- **Context Compression:** Snapshot created before compression
- **High Token Usage:** Snapshot at 80% context capacity
- **Mode Transitions:** Snapshot when switching operational modes
- **Manual Request:** User can create snapshot anytime

### Configuration
```yaml
contextManagement:
  snapshots:
    enabled: true           # Enable automatic snapshots
    maxCount: 5             # Keep last 5 snapshots per session
    autoCreate: true        # Auto-create at trigger points
    autoThreshold: 0.8      # Create at 80% capacity
```

---

## Storage Migration

### Automatic Migration

If you're upgrading from an older version that used the unified `~/.ollm/session-data` directory, OLLM CLI will automatically migrate your data on first run:

**Old Structure:**
```
~/.ollm/session-data/
  ├── {sessionId}.json
  └── {sessionId}/snapshots/
```

**New Structure:**
```
~/.ollm/sessions/
  └── {sessionId}.json
~/.ollm/context-snapshots/
  └── {sessionId}/snapshots/
```

**Migration Process:**
1. Detects old location on startup
2. Creates new directories
3. Copies session files to `~/.ollm/sessions/`
4. Copies snapshot directories to `~/.ollm/context-snapshots/`
5. Removes old location after successful migration
6. Logs migration results

**Safety:**
- Migration is non-destructive (copies, not moves)
- Old location only removed after successful migration
- Errors are logged but don't prevent startup
- Safe to run multiple times (skips if already migrated)

---

## Best Practices

### For Regular Use
1. **Let automatic snapshots work** - They're created at optimal points
2. **Review snapshots periodically** - Delete old ones you don't need
3. **Export important sessions** - Backup conversations you want to keep
4. **Use rollback liberally** - It's safe and quick

### For Development
1. **Create snapshot before risky changes** - Easy rollback if needed
2. **Use descriptive session names** - Easier to find later
3. **Clean up test sessions** - Delete sessions you don't need
4. **Export before major changes** - Extra safety net

### For Troubleshooting
1. **Check storage paths first** - Use `/config paths`
2. **Verify files exist** - Check directories manually if needed
3. **Review snapshot timestamps** - Ensure they're being created
4. **Check logs** - Look for migration or storage errors

---

## Troubleshooting

### Sessions Not Saving

**Symptoms:** Sessions don't appear in `/session list`

**Possible Causes:**
1. Storage path not writable
2. Disk full
3. Permission issues

**Solutions:**
1. Check storage paths: `/config paths`
2. Verify directory exists and is writable
3. Check disk space
4. Check file permissions

---

### Snapshots Not Creating

**Symptoms:** No snapshots in `/snapshot list`

**Possible Causes:**
1. Automatic snapshots disabled
2. Context not reaching threshold
3. Storage path issues

**Solutions:**
1. Check configuration
2. Manually create snapshot: `/snapshot create`
3. Check storage paths: `/config paths`
4. Review logs for errors

---

### Windows Path Issues

**Symptoms:** Files not found or saved to wrong location

**Possible Causes:**
1. Home directory not resolving correctly
2. Path separator issues
3. Permission issues

**Solutions:**
1. Check paths: `/config paths`
2. Verify home directory: Should be `C:\Users\{username}`
3. Check permissions on `.ollm` directory
4. Run as administrator if needed

---

### Migration Failed

**Symptoms:** Old files still in `~/.ollm/session-data`

**Possible Causes:**
1. Permission issues
2. Disk space
3. Files in use

**Solutions:**
1. Check logs for specific error
2. Manually copy files if needed
3. Delete old location after verifying new locations have data
4. Contact support if issues persist

---

## Advanced Usage

### Custom Storage Locations

You can configure custom storage locations in your config file:

```yaml
session:
  dataDir: '/custom/path/to/sessions'

contextManagement:
  snapshots:
    dataDir: '/custom/path/to/snapshots'
```

**Note:** Custom paths must be absolute and writable.

---

### Programmatic Access

For advanced users, the storage systems can be accessed programmatically:

```typescript
import { ChatRecordingService } from '@ollm/ollm-cli-core';
import { SnapshotStorageImpl } from '@ollm/ollm-cli-core';

// Access sessions
const recordingService = new ChatRecordingService();
const sessions = await recordingService.listSessions();

// Access snapshots
const snapshotStorage = new SnapshotStorageImpl();
const snapshots = await snapshotStorage.list(sessionId);
```

---

## Summary

The two-system architecture provides:

✅ **Clear Separation** - Sessions and snapshots have distinct purposes  
✅ **Better Organization** - Separate directories for each system  
✅ **Powerful Recovery** - Multiple ways to restore and rollback  
✅ **Automatic Migration** - Seamless upgrade from old structure  
✅ **Cross-Platform** - Works on Windows, macOS, and Linux  
✅ **Well-Documented** - Clear commands and procedures  

Use sessions for long-term history and snapshots for short-term recovery. Together, they provide comprehensive conversation management and recovery capabilities.

---

**See Also:**
- [Context Architecture](../Context-Architecture.md)
- [Progressive Checkpoints](./progressive-checkpoints.md)
- [Context Management](../README.md)
