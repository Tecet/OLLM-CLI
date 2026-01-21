/**
 * Goal Management Prompt for Non-Tool Models
 * 
 * This prompt is appended to the system prompt when the model doesn't support tools.
 * It teaches the model to use structured text markers for goal management.
 */

/**
 * Additive prompt for goal management without tools
 * This gets appended to any existing system prompt
 */
export const GOAL_MANAGEMENT_ADDITIVE_PROMPT = `

## Goal Management

Since you don't have access to tools, you can track your progress using structured markers in your responses. These markers will be automatically parsed and tracked.

### Available Markers

**Create a new goal:**
\`\`\`
NEW_GOAL: [description] | [priority: high/medium/low]
\`\`\`

**Mark progress with a checkpoint:**
\`\`\`
CHECKPOINT: [what you just completed]
\`\`\`

**Record an important decision:**
\`\`\`
DECISION: [decision] | [rationale]
\`\`\`

**Lock a decision (prevent changes):**
\`\`\`
DECISION_LOCKED: [decision] | [rationale]
\`\`\`

**Record a file modification:**
\`\`\`
ARTIFACT: [file path] | [action: created/modified/deleted]
\`\`\`

**Complete current goal:**
\`\`\`
GOAL_COMPLETE: [summary of what was accomplished]
\`\`\`

**Pause current goal:**
\`\`\`
GOAL_PAUSE
\`\`\`

### Usage Guidelines

1. **Use markers naturally** - Include them in your responses where appropriate
2. **One marker per line** - Each marker should be on its own line
3. **Be specific** - Provide clear descriptions
4. **Track progress** - Use checkpoints for significant steps
5. **Record decisions** - Document important choices and rationale

### Example Usage

\`\`\`
I'll start working on fixing the authentication bug.

NEW_GOAL: Fix authentication bug in login.ts | high

First, let me analyze the code...

[analysis here]

I found the issue - there's a missing null check on line 42.

CHECKPOINT: Found bug in validateUser() function on line 42
DECISION: Add null check before validation | Prevents crash on undefined user

Now I'll implement the fix...

[implementation here]

ARTIFACT: src/auth/login.ts | modified

The fix is complete. Let me add tests...

[tests here]

ARTIFACT: tests/login.test.ts | created
CHECKPOINT: Added comprehensive tests for null user handling

All tests pass. The authentication bug is fixed.

GOAL_COMPLETE: Fixed authentication bug by adding null check and comprehensive tests
\`\`\`

### Important Notes

- Markers are case-sensitive
- Use pipe (|) to separate fields
- Markers will be automatically removed from the displayed output
- Your progress will be tracked even across context compressions
`;

/**
 * Parser for structured markers in LLM output
 */
export class GoalManagementParser {
  /**
   * Parse goal management markers from LLM output
   */
  static parse(text: string): ParsedMarkers {
    const markers: ParsedMarkers = {
      newGoals: [],
      checkpoints: [],
      decisions: [],
      artifacts: [],
      goalComplete: null,
      goalPause: false
    };

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // NEW_GOAL: description | priority
      const newGoalMatch = trimmed.match(/^NEW_GOAL:\s*(.+?)\s*\|\s*(high|medium|low)$/i);
      if (newGoalMatch) {
        markers.newGoals.push({
          description: newGoalMatch[1].trim(),
          priority: newGoalMatch[2].toLowerCase() as 'high' | 'medium' | 'low'
        });
        continue;
      }

      // CHECKPOINT: description
      const checkpointMatch = trimmed.match(/^CHECKPOINT:\s*(.+)$/i);
      if (checkpointMatch) {
        markers.checkpoints.push({
          description: checkpointMatch[1].trim()
        });
        continue;
      }

      // DECISION: description | rationale
      const decisionMatch = trimmed.match(/^DECISION:\s*(.+?)\s*\|\s*(.+)$/i);
      if (decisionMatch) {
        markers.decisions.push({
          description: decisionMatch[1].trim(),
          rationale: decisionMatch[2].trim(),
          locked: false
        });
        continue;
      }

      // DECISION_LOCKED: description | rationale
      const decisionLockedMatch = trimmed.match(/^DECISION_LOCKED:\s*(.+?)\s*\|\s*(.+)$/i);
      if (decisionLockedMatch) {
        markers.decisions.push({
          description: decisionLockedMatch[1].trim(),
          rationale: decisionLockedMatch[2].trim(),
          locked: true
        });
        continue;
      }

      // ARTIFACT: path | action
      const artifactMatch = trimmed.match(/^ARTIFACT:\s*(.+?)\s*\|\s*(created|modified|deleted)$/i);
      if (artifactMatch) {
        markers.artifacts.push({
          path: artifactMatch[1].trim(),
          action: artifactMatch[2].toLowerCase() as 'created' | 'modified' | 'deleted'
        });
        continue;
      }

      // GOAL_COMPLETE: summary
      const goalCompleteMatch = trimmed.match(/^GOAL_COMPLETE:\s*(.+)$/i);
      if (goalCompleteMatch) {
        markers.goalComplete = goalCompleteMatch[1].trim();
        continue;
      }

      // GOAL_PAUSE
      if (trimmed.match(/^GOAL_PAUSE$/i)) {
        markers.goalPause = true;
        continue;
      }
    }

    return markers;
  }

  /**
   * Remove markers from text for display
   */
  static removeMarkers(text: string): string {
    const lines = text.split('\n');
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      return !(
        trimmed.match(/^NEW_GOAL:/i) ||
        trimmed.match(/^CHECKPOINT:/i) ||
        trimmed.match(/^DECISION(_LOCKED)?:/i) ||
        trimmed.match(/^ARTIFACT:/i) ||
        trimmed.match(/^GOAL_COMPLETE:/i) ||
        trimmed.match(/^GOAL_PAUSE$/i)
      );
    });
    return filtered.join('\n');
  }
}

/**
 * Parsed markers from LLM output
 */
export interface ParsedMarkers {
  newGoals: Array<{
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  checkpoints: Array<{
    description: string;
  }>;
  decisions: Array<{
    description: string;
    rationale: string;
    locked: boolean;
  }>;
  artifacts: Array<{
    path: string;
    action: 'created' | 'modified' | 'deleted';
  }>;
  goalComplete: string | null;
  goalPause: boolean;
}
