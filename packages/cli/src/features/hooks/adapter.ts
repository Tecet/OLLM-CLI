/**
 * Adapter layer for converting between core Hook and UI Hook types
 * 
 * The core Hook system uses a command-based structure for execution,
 * while the UI uses a when/then structure for better user understanding.
 * This adapter bridges the two representations.
 */

import type { Hook as CoreHook } from '@ollm/ollm-cli-core/hooks/types.js';
import type { UIHook, UIHookEventType, UIHookActionType } from './types.js';

/**
 * Convert a core Hook to a UI Hook
 * 
 * This function attempts to parse the command field to extract when/then structure.
 * If the command doesn't follow the expected format, it creates a best-effort UIHook.
 * 
 * @param coreHook - The core hook to convert
 * @param enabled - Whether the hook is enabled (from settings)
 * @returns A UI-friendly hook representation
 */
export function coreHookToUIHook(coreHook: CoreHook, enabled: boolean = false): UIHook {
  // Try to parse the command to extract when/then structure
  const parsed = parseHookCommand(coreHook.command, coreHook.args);
  
  return {
    id: coreHook.id,
    name: coreHook.name,
    version: '1.0.0', // Default version if not specified
    description: undefined, // Core hooks don't have descriptions
    when: {
      type: parsed.eventType,
      patterns: parsed.patterns,
    },
    then: {
      type: parsed.actionType,
      prompt: parsed.actionType === 'askAgent' ? parsed.actionValue : undefined,
      command: parsed.actionType === 'runCommand' ? parsed.actionValue : undefined,
    },
    enabled,
    trusted: coreHook.source === 'builtin' || coreHook.source === 'user',
    source: coreHook.source,
    extensionName: coreHook.extensionName,
  };
}

/**
 * Convert a UI Hook to a core Hook
 * 
 * This function creates a command string that encodes the when/then structure
 * in a format that the core hook system can execute.
 * 
 * @param uiHook - The UI hook to convert
 * @returns A core hook representation
 */
export function uiHookToCoreHook(uiHook: UIHook): CoreHook {
  // Build command string that encodes the when/then structure
  const command = buildHookCommand(uiHook);
  
  return {
    id: uiHook.id,
    name: uiHook.name,
    command,
    args: [],
    source: uiHook.source,
    extensionName: uiHook.extensionName,
    sourcePath: undefined,
  };
}

/**
 * Parse a hook command to extract when/then structure
 * 
 * This is a best-effort parser that handles common command patterns.
 * For hooks created through the UI, the command will follow a known format.
 * For legacy hooks, we make reasonable assumptions.
 * 
 * @param command - The command string to parse
 * @param args - Optional command arguments
 * @returns Parsed hook structure
 */
function parseHookCommand(
  command: string,
  _args?: string[]
): {
  eventType: UIHookEventType;
  patterns?: string[];
  actionType: UIHookActionType;
  actionValue: string;
} {
  // Default fallback values
  let eventType: UIHookEventType = 'userTriggered';
  let patterns: string[] | undefined;
  let actionType: UIHookActionType = 'runCommand';
  let actionValue: string = command;
  
  // Try to parse structured command format: "event:action:value"
  // Example: "fileEdited:*.ts:askAgent:Review changes"
  const parts = command.split(':');
  
  if (parts.length >= 3) {
    // Parse event type
    const eventPart = parts[0];
    if (isUIHookEventType(eventPart)) {
      eventType = eventPart;
    }
    
    // Parse patterns (for file events)
    if (parts.length >= 4 && isFileEvent(eventType)) {
      patterns = parts[1].split(',').map(p => p.trim());
      actionType = parts[2] as UIHookActionType;
      actionValue = parts.slice(3).join(':');
    } else {
      actionType = parts[1] as UIHookActionType;
      actionValue = parts.slice(2).join(':');
    }
  }
  
  return {
    eventType,
    patterns,
    actionType,
    actionValue,
  };
}

/**
 * Build a command string from a UI Hook
 * 
 * Creates a structured command format that can be parsed back into a UIHook.
 * Format: "eventType:patterns:actionType:actionValue"
 * 
 * @param uiHook - The UI hook to encode
 * @returns Command string
 */
function buildHookCommand(uiHook: UIHook): string {
  const parts: string[] = [uiHook.when.type];
  
  // Add patterns for file events
  if (uiHook.when.patterns && uiHook.when.patterns.length > 0) {
    parts.push(uiHook.when.patterns.join(','));
  }
  
  // Add action type
  parts.push(uiHook.then.type);
  
  // Add action value
  const actionValue = uiHook.then.type === 'askAgent' 
    ? uiHook.then.prompt 
    : uiHook.then.command;
  
  if (actionValue) {
    parts.push(actionValue);
  }
  
  return parts.join(':');
}

/**
 * Type guard to check if a string is a valid UIHookEventType
 */
function isUIHookEventType(value: string): value is UIHookEventType {
  return [
    'fileEdited',
    'fileCreated',
    'fileDeleted',
    'userTriggered',
    'promptSubmit',
    'agentStop',
  ].includes(value);
}

/**
 * Check if an event type is a file event
 */
function isFileEvent(eventType: UIHookEventType): boolean {
  return ['fileEdited', 'fileCreated', 'fileDeleted'].includes(eventType);
}

/**
 * Validate that a UIHook has all required fields
 * 
 * @param hook - The hook to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateUIHook(hook: Partial<UIHook>): string[] {
  const errors: string[] = [];
  
  if (!hook.name || hook.name.trim() === '') {
    errors.push('Hook name is required');
  }
  
  if (!hook.when?.type) {
    errors.push('Hook event type is required');
  }
  
  if (!hook.then?.type) {
    errors.push('Hook action type is required');
  }
  
  // Validate file events have patterns
  if (hook.when?.type && isFileEvent(hook.when.type)) {
    if (!hook.when.patterns || hook.when.patterns.length === 0) {
      errors.push('File events require at least one file pattern');
    }
  }
  
  // Validate askAgent has prompt
  if (hook.then?.type === 'askAgent') {
    if (!hook.then.prompt || hook.then.prompt.trim() === '') {
      errors.push('askAgent action requires a prompt');
    }
  }
  
  // Validate runCommand has command
  if (hook.then?.type === 'runCommand') {
    if (!hook.then.command || hook.then.command.trim() === '') {
      errors.push('runCommand action requires a command');
    }
  }
  
  return errors;
}

/**
 * Create a new UIHook with default values
 * 
 * @param overrides - Optional field overrides
 * @returns A new UIHook with defaults
 */
export function createDefaultUIHook(overrides?: Partial<UIHook>): UIHook {
  return {
    id: generateHookId(),
    name: '',
    version: '1.0.0',
    description: '',
    when: {
      type: 'fileEdited',
      patterns: [],
    },
    then: {
      type: 'askAgent',
      prompt: '',
    },
    enabled: true,
    trusted: false,
    source: 'user',
    ...overrides,
  };
}

/**
 * Generate a unique hook ID
 * 
 * @returns A unique hook identifier
 */
function generateHookId(): string {
  return `hook-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert form data to a UIHook
 * 
 * @param formData - Form data from the add/edit dialog
 * @returns A UIHook instance
 */
export function formDataToUIHook(formData: {
  name: string;
  description: string;
  eventType: UIHookEventType;
  patterns: string[];
  actionType: UIHookActionType;
  promptOrCommand: string;
}): Omit<UIHook, 'id' | 'enabled' | 'trusted' | 'source'> {
  return {
    name: formData.name,
    version: '1.0.0',
    description: formData.description || undefined,
    when: {
      type: formData.eventType,
      patterns: formData.patterns.length > 0 ? formData.patterns : undefined,
    },
    then: {
      type: formData.actionType,
      prompt: formData.actionType === 'askAgent' ? formData.promptOrCommand : undefined,
      command: formData.actionType === 'runCommand' ? formData.promptOrCommand : undefined,
    },
  };
}

/**
 * Convert a UIHook to form data
 * 
 * @param hook - The hook to convert
 * @returns Form data for editing
 */
export function uiHookToFormData(hook: UIHook): {
  name: string;
  description: string;
  eventType: UIHookEventType;
  patterns: string[];
  actionType: UIHookActionType;
  promptOrCommand: string;
} {
  return {
    name: hook.name,
    description: hook.description || '',
    eventType: hook.when.type,
    patterns: hook.when.patterns || [],
    actionType: hook.then.type,
    promptOrCommand: (hook.then.type === 'askAgent' ? hook.then.prompt : hook.then.command) || '',
  };
}
