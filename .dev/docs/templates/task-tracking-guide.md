# Task Tracking Guide

This guide explains how to use the task tracking system to monitor time spent on development tasks.

## Overview

The task tracking system helps you:

- Record start and completion times for each task
- Calculate actual duration vs estimates
- Generate status reports for stages
- Improve future time estimates based on real data

## Task Tracker Script

### Installation

The script is located at `scripts/task-tracker.js` and requires Node.js.

### Commands

#### Start a Task

```bash
node scripts/task-tracker.js start <task-file> <task-number>
```

Example:

```bash
node scripts/task-tracker.js start .kiro/specs/stage-03-tools-policy/tasks.md 1
```

This will:

- Add a `Started: YYYY-MM-DD HH:MM` timestamp to the task
- Display confirmation with the timestamp

#### Complete a Task

```bash
node scripts/task-tracker.js complete <task-file> <task-number>
```

Example:

```bash
node scripts/task-tracker.js complete .kiro/specs/stage-03-tools-policy/tasks.md 1
```

This will:

- Mark the task as complete `[x]`
- Add a `Completed: YYYY-MM-DD HH:MM` timestamp
- Calculate and add `Duration: Xh Ym` if start time exists
- Display confirmation with duration

#### View Status

```bash
node scripts/task-tracker.js status <task-file>
```

Example:

```bash
node scripts/task-tracker.js status .kiro/specs/stage-03-tools-policy/tasks.md
```

This will display:

- Table of all tracked tasks with timestamps
- Summary statistics (total, completed, active)
- Total time spent on completed tasks

### Example Output

```
Task Status for tasks.md:

Task | Status   | Started          | Completed        | Duration
-----|----------|------------------|------------------|----------
1    | ✓ Done   | 2026-01-10 14:30 | 2026-01-10 15:15 | 45m
1.1  | ✓ Done   | 2026-01-10 15:15 | 2026-01-10 15:45 | 30m
2.1  | ⧗ Active | 2026-01-10 15:45 | -                | -
2.2  | ✓ Done   | 2026-01-10 16:00 | 2026-01-10 16:40 | 40m

Summary:
  Total tasks tracked: 4
  Completed: 3
  Active: 1
  Total time: 1h 55m
```

## Task Format in Markdown

### Basic Task Structure

```markdown
- [ ] 1. Task name
  - Task description
  - _Requirements: X.X_
```

### With Timestamps

```markdown
- [x] 1. Task name
  - Task description
  - _Requirements: X.X_
  - _Started: 2026-01-10 14:30_
  - _Completed: 2026-01-10 15:15_
  - _Duration: 45m_
```

### Nested Tasks

The script supports nested tasks (e.g., 1.1, 1.2, 2.1):

```markdown
- [x] 1. Parent task
  - _Started: 2026-01-10 14:30_
  - _Completed: 2026-01-10 16:00_
  - _Duration: 1h 30m_

  - [x] 1.1 Subtask one
    - _Started: 2026-01-10 14:30_
    - _Completed: 2026-01-10 15:00_
    - _Duration: 30m_

  - [x] 1.2 Subtask two
    - _Started: 2026-01-10 15:00_
    - _Completed: 2026-01-10 16:00_
    - _Duration: 1h_
```

## Workflow

### Starting a New Stage

1. Create the tasks.md file for the stage
2. Add the timestamp format note at the top:

```markdown
## Tasks

> **Timestamp Format**: Each task can include `Started: YYYY-MM-DD HH:MM` and `Completed: YYYY-MM-DD HH:MM` to track actual time spent.
```

### Working on Tasks

1. **Before starting a task:**

   ```bash
   node scripts/task-tracker.js start .kiro/specs/stage-XX/tasks.md <task-number>
   ```

2. **Work on the task**

3. **After completing a task:**

   ```bash
   node scripts/task-tracker.js complete .kiro/specs/stage-XX/tasks.md <task-number>
   ```

4. **Check progress:**
   ```bash
   node scripts/task-tracker.js status .kiro/specs/stage-XX/tasks.md
   ```

### Completing a Stage

1. Run final status report:

   ```bash
   node scripts/task-tracker.js status .kiro/specs/stage-XX/tasks.md
   ```

2. Copy the summary data to the dev log (`.dev/logs/dev-log.md`)

3. Compare actual time vs estimates to improve future planning

## Tips

### Accurate Tracking

- Start the timer immediately when beginning work
- Complete the timer as soon as you finish (don't wait)
- If interrupted, complete the current task and start a new timer when resuming

### Handling Interruptions

If you need to pause work:

1. Complete the current task with the time spent so far
2. When resuming, start a new timer
3. The total duration will be the sum of all time blocks

### Batch Operations

For multiple subtasks, you can use shell loops:

```bash
# Start all subtasks of task 2
for i in 1 2 3; do
  node scripts/task-tracker.js start .kiro/specs/stage-03/tasks.md 2.$i
done
```

### Integration with Git

Add timestamps before committing:

```bash
# Complete current task
node scripts/task-tracker.js complete .kiro/specs/stage-03/tasks.md 5

# Check status
node scripts/task-tracker.js status .kiro/specs/stage-03/tasks.md

# Commit with task reference
git add .
git commit -m "feat(stage-03): complete task 5 - implement tool registry"
```

## Analysis

### Comparing Estimates vs Actuals

After completing a stage, compare the task breakdown table:

| Task | Estimate | Actual | Variance |
| ---- | -------- | ------ | -------- |
| 1    | 45 min   | 50 min | +5 min   |
| 2.1  | 40 min   | 35 min | -5 min   |
| 2.2  | 35 min   | 45 min | +10 min  |

### Improving Estimates

Use actual durations to:

- Identify task types that consistently take longer
- Adjust Kiro credit estimates
- Better plan future stages
- Optimize development workflow

### Efficiency Metrics

Track these metrics per stage:

- **Total estimated time** vs **Total actual time**
- **Tasks completed on time** vs **Tasks over time**
- **Average variance** (actual - estimate)
- **Kiro credits used** vs **Estimated credits**

## Troubleshooting

### Task Not Found

If you get "Task X not found":

- Check the task number matches exactly (including decimals)
- Ensure the task follows the format: `- [ ] X.` or `- [x] X.`
- Verify the file path is correct

### Timestamp Already Exists

The script will update existing timestamps if you run start/complete again.

### Duration Not Calculated

Duration requires both start and complete timestamps. If missing:

- Manually add the start timestamp in the format: `_Started: YYYY-MM-DD HH:MM_`
- Run complete again to calculate duration

## Future Enhancements

Potential improvements to the tracking system:

- VS Code extension for one-click task tracking
- Automatic git commit message generation with task references
- Dashboard visualization of time spent per stage
- Integration with time tracking tools (Toggl, Clockify)
- Slack/Discord notifications when tasks complete
- AI-powered estimate suggestions based on historical data
