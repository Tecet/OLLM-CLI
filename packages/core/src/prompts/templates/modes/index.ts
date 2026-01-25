/**
 * Mode Metadata Index
 *
 * Provides mode metadata for UI display and mode suggestions.
 * System prompts are loaded from tiered prompt files.
 */

/**
 * Mode metadata for UI display and configuration
 */
export const MODE_METADATA = {
  assistant: {
    name: 'Assistant',
    persona: 'Helpful AI Assistant',
    icon: '🤖',
    color: 'blue',
    description: 'General conversation, explanations, discussions',
    temperatureTier: 3,
  },
  planning: {
    name: 'Planning',
    persona: 'Technical Architect & Planner',
    icon: '📐',
    color: 'yellow',
    description: 'Research, design, architecture, planning before implementation',
    temperatureTier: 2,
  },
  developer: {
    name: 'Developer',
    persona: 'Senior Software Engineer',
    icon: '💻',
    color: 'green',
    description: 'Full implementation, coding, refactoring, tool usage',
    temperatureTier: 1,
  },
  debugger: {
    name: 'Debugger',
    persona: 'Senior Debugging Specialist',
    icon: '🐞',
    color: 'red',
    description: 'Systematic debugging, error analysis, performance optimization',
    temperatureTier: 1,
  },
} as const;
