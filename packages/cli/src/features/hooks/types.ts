/**
 * UI-specific types for the Hooks Panel
 * 
 * This module provides UI-friendly hook types that differ from the core Hook type.
 * The core Hook type uses a `command` field for execution, while the UI design
 * expects a `when/then` structure for better user understanding and editing.
 */

import type { HookSource } from '@ollm/ollm-cli-core/hooks/types.js';

/**
 * Hook event types that can trigger hook execution (UI-friendly names)
 */
export type UIHookEventType =
  | 'fileEdited'
  | 'fileCreated'
  | 'fileDeleted'
  | 'userTriggered'
  | 'promptSubmit'
  | 'agentStop';

/**
 * Hook action types that define what the hook does
 */
export type UIHookActionType =
  | 'askAgent'    // Ask the agent to perform a task
  | 'runCommand'; // Run a shell command

/**
 * UI-friendly hook interface with when/then structure
 * This is what the UI components work with
 */
export interface UIHook {
  /** Unique identifier for the hook */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Version of the hook definition */
  version: string;
  
  /** Optional description of what the hook does */
  description?: string;
  
  /** Trigger conditions - when the hook should execute */
  when: {
    /** Event type that triggers the hook */
    type: UIHookEventType;
    
    /** File patterns for file events (e.g., ['*.ts', '*.tsx']) */
    patterns?: string[];
  };
  
  /** Action to perform - what the hook should do */
  then: {
    /** Type of action to perform */
    type: UIHookActionType;
    
    /** Prompt for askAgent action */
    prompt?: string;
    
    /** Command for runCommand action */
    command?: string;
  };
  
  /** Whether the hook is currently enabled */
  enabled: boolean;
  
  /** Whether the hook is trusted (approved by user) */
  trusted: boolean;
  
  /** Source of the hook (determines editability) */
  source: HookSource;
  
  /** Extension name if hook comes from an extension */
  extensionName?: string;
}

/**
 * Hook category for organizing hooks in the UI
 */
export interface HookCategory {
  /** Category name (e.g., "File Events", "Prompt Events") */
  name: string;
  
  /** Event types included in this category */
  eventTypes: UIHookEventType[];
  
  /** Hooks in this category */
  hooks: UIHook[];
  
  /** Whether the category is expanded in the UI */
  expanded: boolean;
}

/**
 * Form data for creating/editing hooks
 */
export interface HookFormData {
  name: string;
  description: string;
  eventType: UIHookEventType;
  patterns: string[];
  actionType: UIHookActionType;
  promptOrCommand: string;
}

/**
 * Validation errors for hook form
 */
export interface ValidationErrors {
  name?: string;
  description?: string;
  eventType?: string;
  patterns?: string;
  actionType?: string;
  promptOrCommand?: string;
}

/**
 * Result of testing a hook
 */
export interface HookTestResult {
  /** Whether the test was successful */
  success: boolean;
  
  /** Message describing the result */
  message: string;
  
  /** Additional details about the test */
  details?: string;
}

/**
 * Dialog state for hook management
 */
export type DialogState =
  | { type: 'add' }
  | { type: 'edit'; hookId: string }
  | { type: 'delete'; hookId: string }
  | { type: 'test'; hookId: string };

/**
 * Navigation item in the flattened hook list
 */
export type NavigationItem =
  | { type: 'category'; id: string; category: HookCategory }
  | { type: 'hook'; id: string; hook: UIHook };
