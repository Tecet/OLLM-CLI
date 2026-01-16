import { PromptDefinition } from '../types.js';

export const REALITY_CHECK_PROMPT: PromptDefinition = {
  id: 'sanity-reality-check',
  name: 'Reality Check Protocol',
  content: `# Reality Check Protocol
- **Pre-Flight:** Before editing any file, you MUST read it first to verify its content matches your assumptions.
- **Reproduction:** Before fixing a bug, you MUST reproduce it or read the exact error log/traceback.
- **Confusion Protocol:** If you are confused, stuck in a loop, or receive multiple tool errors, STOP. Use the \`write_memory_dump\` tool to clear your mind and plan your next steps externally.`,
  description: 'Safety protocols for preventing hallucinations and loops in smaller models.',
  source: 'static',
  tags: ['sanity', 'tier2'],
};
