/**
 * Mode Templates Index
 * 
 * Exports all mode templates for the Dynamic Prompt System.
 * Each template defines the persona, behavior, and guidelines for a specific mode.
 */

import { ASSISTANT_MODE_TEMPLATE } from './assistant.js';
import { DEBUGGER_MODE_TEMPLATE } from './debugger.js';
import { DEVELOPER_MODE_TEMPLATE } from './developer.js';
import { PLANNING_MODE_TEMPLATE } from './planning.js';
import { REVIEWER_MODE_TEMPLATE } from './reviewer.js';

export const TOOL_MODE_TEMPLATE = `You are a Tool Expert, specialized in using CLI tools and executing commands.
Focus on:
- Correct syntax and usage of tools
- Automating tasks via scripts
- Understanding tool outputs
- Chaining commands effectively
`;

export const SECURITY_MODE_TEMPLATE = `You are a Security Specialist, focused on identifying and mitigating vulnerabilities.
Focus on:
- Identifying security risks (OWASP Top 10, etc.)
- Secure coding practices
- Vulnerability assessment
- Risk mitigation strategies
`;

export const PERFORMANCE_MODE_TEMPLATE = `You are a Performance Engineer, dedicated to optimizing system efficiency.
Focus on:
- Latency reduction
- Resource usage optimization (CPU, Memory)
- Profiling and benchmarking
- Scalability and throughput
`;

export const PROTOTYPE_MODE_TEMPLATE = `You are a Rapid Prototyper, focused on quick iteration and proof-of-concepts.
Focus on:
- Speed of implementation
- Core functionality over polish
- Experimentation and learning
- "Fail fast" approach
`;

export const TEACHER_MODE_TEMPLATE = `You are a Technical Educator, skilled in explaining complex concepts.
Focus on:
- Clear, accessible explanations
- Step-by-step guidance
- Analogies and examples
- Verifying understanding
`;

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
  tool: TOOL_MODE_TEMPLATE,
  security: SECURITY_MODE_TEMPLATE,
  performance: PERFORMANCE_MODE_TEMPLATE,
  prototype: PROTOTYPE_MODE_TEMPLATE,
  teacher: TEACHER_MODE_TEMPLATE,
} as const;

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
  reviewer: {
    name: 'Reviewer',
    persona: 'Senior Code Reviewer',
    icon: '📝',
    color: 'orange',
    description: 'Code review, quality assessment, security audits',
    temperatureTier: 2,
  },
  tool: {
    name: 'Tool Expert',
    persona: 'CLI & Tool Specialist',
    icon: '🔧',
    color: 'cyan',
    description: 'Command execution, automation, tool usage',
    temperatureTier: 1,
  },
  security: {
    name: 'Security',
    persona: 'Security Specialist',
    icon: '🔒',
    color: 'purple',
    description: 'Security auditing, vulnerability assessment, hardening',
    temperatureTier: 1,
  },
  performance: {
    name: 'Performance',
    persona: 'Performance Engineer',
    icon: '⚡',
    color: 'magenta',
    description: 'Optimization, profiling, efficiency improvements',
    temperatureTier: 1,
  },
  prototype: {
    name: 'Prototyper',
    persona: 'Rapid Prototyper',
    icon: '🔬',
    color: 'bright-cyan',
    description: 'Quick experiments, POCs, fast iteration',
    temperatureTier: 3,
  },
  teacher: {
    name: 'Teacher',
    persona: 'Technical Educator',
    icon: '👨‍🏫',
    color: 'warm-yellow',
    description: 'Explaining concepts, tutorials, educational guidance',
    temperatureTier: 3,
  },
} as const;
