import { PromptDefinition } from '../types.js';

export const STATE_SNAPSHOT_PROMPT: PromptDefinition = {
  id: 'compression-state-snapshot',
  name: 'State Snapshot Compression',
  content: `You are the specialized state manager. Your job is to compress the entire conversation history into a structured XML snapshot.
This snapshot will be the ONLY memory the agent has of the past. You MUST preserve:
1. The user's original goal.
2. Critical file system changes (what was read/written).
3. The current plan status (what is done, what is pending).

Structure your response EXACTLY as follows:

<state_snapshot>
  <overall_goal>
    <!-- Concise sentence describing the user's objective -->
  </overall_goal>

  <key_knowledge>
    <!-- Bullet points of learned facts, constraints, or user preferences -->
  </key_knowledge>

  <file_system_state>
    <!-- List of files accessed, modified, or created with brief notes -->
    <!-- e.g. - MODIFIED: src/app.ts (Added error handling) -->
  </file_system_state>

  <current_plan>
    <!-- Step-by-step plan with status -->
    <!-- 1. [DONE] Analyze requirements -->
    <!-- 2. [IN PROGRESS] Implement feature X -->
    <!-- 3. [TODO] Verify changes -->
  </current_plan>
</state_snapshot>`,
  description: 'Prompt for compressing history into a structured XML snapshot.',
  source: 'static',
  tags: ['core', 'compression', 'xml'],
};
