/**
 * Mode Templates Index
 * 
 * Exports all mode templates for the Dynamic Prompt System.
 * Each template defines the persona, behavior, and guidelines for a specific mode.
 */

import { ASSISTANT_MODE_TEMPLATE } from './assistant.js';
import { PLANNING_MODE_TEMPLATE } from './planning.js';
import { DEVELOPER_MODE_TEMPLATE } from './developer.js';
import { TOOL_MODE_TEMPLATE } from './tool.js';
import { DEBUGGER_MODE_TEMPLATE } from './debugger.js';
import { SECURITY_MODE_TEMPLATE } from './security.js';
import { REVIEWER_MODE_TEMPLATE } from './reviewer.js';
import { PERFORMANCE_MODE_TEMPLATE } from './performance.js';

export {
  ASSISTANT_MODE_TEMPLATE,
  PLANNING_MODE_TEMPLATE,
  DEVELOPER_MODE_TEMPLATE,
  TOOL_MODE_TEMPLATE,
  DEBUGGER_MODE_TEMPLATE,
  SECURITY_MODE_TEMPLATE,
  REVIEWER_MODE_TEMPLATE,
  PERFORMANCE_MODE_TEMPLATE
};

/**
 * Map of mode types to their corresponding templates
 */
export const MODE_TEMPLATES = {
  assistant: ASSISTANT_MODE_TEMPLATE,
  planning: PLANNING_MODE_TEMPLATE,
  developer: DEVELOPER_MODE_TEMPLATE,
  tool: TOOL_MODE_TEMPLATE,
  debugger: DEBUGGER_MODE_TEMPLATE,
  security: SECURITY_MODE_TEMPLATE,
  reviewer: REVIEWER_MODE_TEMPLATE,
  performance: PERFORMANCE_MODE_TEMPLATE,
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
  },
  planning: {
    name: 'Planning',
    persona: 'Technical Architect & Planner',
    icon: '📋',
    color: 'yellow',
    description: 'Research, design, architecture, planning before implementation',
  },
  developer: {
    name: 'Developer',
    persona: 'Senior Software Engineer',
    icon: '👨‍💻',
    color: 'green',
    description: 'Full implementation, coding, refactoring, building features',
  },
  tool: {
    name: 'Tool',
    persona: 'Senior Software Engineer + Tool Expert',
    icon: '🔧',
    color: 'cyan',
    description: 'Enhanced tool usage with detailed guidance',
  },
  debugger: {
    name: 'Debugger',
    persona: 'Senior Debugging Specialist',
    icon: '🐛',
    color: 'red',
    description: 'Systematic debugging, error analysis, root cause investigation',
  },
  security: {
    name: 'Security',
    persona: 'Security Auditor & Specialist',
    icon: '🔒',
    color: 'purple',
    description: 'Security audits, vulnerability detection, secure coding practices',
  },
  reviewer: {
    name: 'Reviewer',
    persona: 'Senior Code Reviewer',
    icon: '👀',
    color: 'orange',
    description: 'Code review, quality assessment, best practices enforcement',
  },
  performance: {
    name: 'Performance',
    persona: 'Performance Engineer',
    icon: '⚡',
    color: 'magenta',
    description: 'Performance analysis, optimization, profiling',
  },
} as const;
