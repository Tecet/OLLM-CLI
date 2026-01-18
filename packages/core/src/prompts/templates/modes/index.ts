/**
 * Mode Templates Index
 * 
 * Exports all mode templates for the Dynamic Prompt System.
 * Each template defines the persona, behavior, and guidelines for a specific mode.
 */

import { ASSISTANT_MODE_TEMPLATE } from './assistant.js';
import { PLANNING_MODE_TEMPLATE } from './planning.js';
import { DEVELOPER_MODE_TEMPLATE } from './developer.js';
import { DEBUGGER_MODE_TEMPLATE } from './debugger.js';
import { REVIEWER_MODE_TEMPLATE } from './reviewer.js';

export {
  ASSISTANT_MODE_TEMPLATE,
  PLANNING_MODE_TEMPLATE,
  DEVELOPER_MODE_TEMPLATE,
  DEBUGGER_MODE_TEMPLATE,
  REVIEWER_MODE_TEMPLATE
};

/**
 * Map of mode types to their corresponding templates
 */
export const MODE_TEMPLATES = {
  assistant: ASSISTANT_MODE_TEMPLATE,
  planning: PLANNING_MODE_TEMPLATE,
  developer: DEVELOPER_MODE_TEMPLATE,
  debugger: DEBUGGER_MODE_TEMPLATE,
  reviewer: REVIEWER_MODE_TEMPLATE,
} as const;

/**
 * Mode metadata for UI display and configuration
 */
export const MODE_METADATA = {
  assistant: {
    name: 'Assistant',
    persona: 'Helpful AI Assistant',
    icon: '💬',
    color: 'blue',
    description: 'General conversation, explanations, discussions',
    temperatureTier: 3,
  },
  planning: {
    name: 'Planning',
    persona: 'Technical Architect & Planner',
    icon: '📋',
    color: 'yellow',
    description: 'Research, design, architecture, planning before implementation',
    temperatureTier: 2,
  },
  developer: {
    name: 'Developer',
    persona: 'Senior Software Engineer',
    icon: '👨‍💻',
    color: 'green',
    description: 'Full implementation, coding, refactoring, tool usage',
    temperatureTier: 1,
  },
  debugger: {
    name: 'Debugger',
    persona: 'Senior Debugging Specialist',
    icon: '🐛',
    color: 'red',
    description: 'Systematic debugging, error analysis, performance optimization',
    temperatureTier: 1,
  },
  reviewer: {
    name: 'Reviewer',
    persona: 'Senior Code Reviewer',
    icon: '👀',
    color: 'orange',
    description: 'Code review, quality assessment, security audits',
    temperatureTier: 2,
  },
} as const;
