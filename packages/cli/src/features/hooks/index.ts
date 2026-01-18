/**
 * Hooks feature module
 * 
 * This module provides UI-specific types and utilities for the Hooks Panel.
 * It includes an adapter layer to convert between core Hook types and UI Hook types.
 */

// Export types
export type {
  UIHook,
  UIHookEventType,
  UIHookActionType,
  HookCategory,
  HookFormData,
  ValidationErrors,
  HookTestResult,
  DialogState,
  NavigationItem,
} from './types.js';

// Export adapter functions
export {
  coreHookToUIHook,
  uiHookToCoreHook,
  validateUIHook,
  createDefaultUIHook,
  formDataToUIHook,
  uiHookToFormData,
} from './adapter.js';
