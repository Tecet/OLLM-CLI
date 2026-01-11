# Enhanced Task Tracking System

## Overview

This enhanced task tracking system integrates seamlessly with Kiro's built-in task management while adding automatic timestamp and credit tracking.

## How It Works

### 1. Kiro's Built-in Task Management
When you or the agent calls the `taskStatus` tool to start or complete a task:
- **Kiro IDE automatically updates the checkbox** (`[ ]` → `[x]` or vice versa)
- The markdown file is edited by Kiro
- You don't manually check boxes - Kiro does it for you

### 2. Automatic Timestamp Sync
After Kiro updates the task checkbox:
- Hook detects the file was edited
- Agent is prompted to run the sync command
- Sync command adds appropriate timestamps:
  - **Start timestamps** when tasks are marked as in-progress
  - **Completion timestamps** when tasks are marked as done
  - **Duration calculations** between start and completion

### 3. Credit Tracking
Credits can be manually added after completing work on a task.

## Components

### Scripts

**`scripts/task-tracker.js`** - Core task tracking functionality
- `start` - Manually start a task with timestamp
- `complete` - Manually complete a task with timestamp and duration
- `credits` - Add credits to a task
- `status` - View task progress summary
- **`sync`** - Auto-sync timestamps based on task checkbox status (NEW!)

### Hooks

**`.kiro/hooks/task-timestamp-on-status-change.kiro.hook`**
- Triggers on task file edits
- Runs `sync` command to add timestamps automatically
- Works alongside Kiro's built-in task management

**`.kiro/hooks/task-tracker-auto.kiro.hook`**
- Triggers after agent execution completes
- Prompts to add credits based on execution log
- Complements Kiro's native task tracking

## Usage

### Automatic Mode (Recommended)

1. **Start a task** - Use Kiro's taskStatus tool or click "Start task" link
   - Kiro automatically marks task as in-progress (unchecks box if needed)
   - Hook prompts agent to run sync command
   - Timestamp is added automatically

2. **Complete a task** - Use Kiro's taskStatus tool or click "Complete task" link
   - Kiro automatically checks the box `[x]`
   - Hook prompts agent to run sync command
   - Completion timestamp and duration are added automatically

3. **Add credits** - After completing work:
   ```bash
   npm run task:credits .kiro/specs/stage-XX/tasks.md <task-number> <credits>
   ```

### Manual Mode

If you prefer manual control:

```bash
# Start a task
npm run task:start .kiro/specs/stage-XX/tasks.md <task-number>

# Complete a task
npm run task:complete .kiro/specs/stage-XX/tasks.md <task-number>

# Add credits
npm run task:credits .kiro/specs/stage-XX/tasks.md <task-number> <credits>

# Sync timestamps for entire file
npm run task:sync .kiro/specs/stage-XX/tasks.md

# View status
npm run task:status .kiro/specs/stage-XX/tasks.md
```

## Benefits

✅ **No Conflicts** - Works alongside Kiro's built-in task management
✅ **Automatic** - Timestamps added automatically when you use Kiro's task links
✅ **Flexible** - Can still use manual commands when needed
✅ **Comprehensive** - Tracks start time, completion time, duration, and credits
✅ **Reporting** - Generate progress reports with `task:status`

## Example Workflow

1. Open `.kiro/specs/stage-03-tools-policy/tasks.md`
2. Agent or user calls taskStatus tool to start task 3
   - **Kiro IDE automatically updates the checkbox**
   - Hook detects file edit and prompts agent
   - Agent runs sync command
   - Timestamp added: `- _Started: 2026-01-10 13:15_`
3. Work on the task
4. Agent or user calls taskStatus tool to complete task 3
   - **Kiro IDE automatically checks the box `[x]`**
   - Hook detects file edit and prompts agent
   - Agent runs sync command
   - Timestamps added:
     - `- _Completed: 2026-01-10 14:30_`
     - `- _Duration: 1h 15m_`
5. Add credits from execution log:
   ```bash
   npm run task:credits .kiro/specs/stage-03-tools-policy/tasks.md 3 2.45
   ```
6. View progress:
   ```bash
   npm run task:status .kiro/specs/stage-03-tools-policy/tasks.md
   ```

## Troubleshooting

### Timestamps not being added automatically?
- Check that `.kiro/hooks/task-timestamp-on-status-change.kiro.hook` is enabled
- Verify the hook has `"enabled": true`
- Try running sync manually: `npm run task:sync <task-file>`

### Duplicate timestamps?
- The sync command is idempotent - it won't add duplicate timestamps
- If you see duplicates, they were likely added manually

### Hook conflicts?
- The new system is designed to complement, not replace, Kiro's built-in tools
- Hooks trigger AFTER Kiro's task management completes
- No conflicts should occur

## Migration from Old System

If you were using the old hook system:
1. The new hooks are already in place
2. Run `npm run task:sync <task-file>` to add missing timestamps
3. Continue using Kiro's built-in task links as normal
4. Timestamps will be added automatically going forward
