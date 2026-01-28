# Task Tracking Quick Reference

## Quick Commands

### Using npm scripts (shorter):

```bash
npm run task:start .kiro/specs/stage-XX/tasks.md <task-number>
npm run task:complete .kiro/specs/stage-XX/tasks.md <task-number>
npm run task:credits .kiro/specs/stage-XX/tasks.md <task-number> <credits>
npm run task:status .kiro/specs/stage-XX/tasks.md
```

### Using node directly:

```bash
node scripts/task-tracker.js start .kiro/specs/stage-XX/tasks.md <task-number>
node scripts/task-tracker.js complete .kiro/specs/stage-XX/tasks.md <task-number>
node scripts/task-tracker.js credits .kiro/specs/stage-XX/tasks.md <task-number> <credits>
node scripts/task-tracker.js status .kiro/specs/stage-XX/tasks.md
```

## Common Examples

### Stage 03 Tasks

```bash
# Start task 1
npm run task:start .kiro/specs/stage-03-tools-policy/tasks.md 1

# Complete task 1
npm run task:complete .kiro/specs/stage-03-tools-policy/tasks.md 1

# Add credits used (from chat window)
npm run task:credits .kiro/specs/stage-03-tools-policy/tasks.md 1 0.11

# Start subtask 2.1
npm run task:start .kiro/specs/stage-03-tools-policy/tasks.md 2.1

# View status
npm run task:status .kiro/specs/stage-03-tools-policy/tasks.md
```

## Workflow

1. **Start work** → `npm run task:start <file> <task>`
2. **Do the work** → Code, test, commit
3. **Log credits** → `npm run task:credits <file> <task> <credits>` (from chat window)
4. **Finish work** → `npm run task:complete <file> <task>`
5. **Check progress** → `npm run task:status <file>`

## What Gets Added

### When you start:

```markdown
- [ ] 1. Task name
  - _Started: 2026-01-10 14:30_
```

### When you complete:

```markdown
- [x] 1. Task name
  - _Started: 2026-01-10 14:30_
  - _Completed: 2026-01-10 15:15_
  - _Duration: 45m_
  - _Credits: 0.11_
```

## Status Report Example

```
Task | Status   | Started          | Completed        | Duration | Credits
-----|----------|------------------|------------------|----------|--------
1    | ✓ Done   | 2026-01-10 14:30 | 2026-01-10 15:15 | 45m      | 0.11
2.1  | ⧗ Active | 2026-01-10 15:15 | -                | -        | 0.05

Summary:
  Total tasks tracked: 2
  Completed: 1
  Active: 1
  Total time: 45m
  Total credits: 0.16
```

## Tips

- ✓ Start timer immediately when beginning work
- ✓ Complete timer as soon as you finish
- ✓ Log credits after each agent interaction (check chat window)
- ✓ Credits accumulate if you log multiple times for same task
- ✓ Run status before committing to see progress
- ✓ Copy final status to dev log when stage completes

## Full Documentation

See `.dev/task-tracking-guide.md` for complete documentation.
