/**
 * Hook system for event-driven customization
 * 
 * The hook system allows users and extensions to register executable scripts
 * that run at specific lifecycle events. Hooks communicate via JSON protocol
 * over stdin/stdout and are subject to trust verification.
 */

export * from './types.js';
export { HookRegistry } from './hookRegistry.js';
export { HookTranslator } from './hookTranslator.js';
export { HookRunner } from './hookRunner.js';
export type { HookExecutionResult, HookExecutionSummary } from './hookRunner.js';
export { HookPlanner } from './hookPlanner.js';
export type { ExecutionStrategy, HookPlanningOptions } from './hookPlanner.js';
export { TrustedHooks } from './trustedHooks.js';
export type { TrustedHooksConfig } from './trustedHooks.js';
export * from './config.js';
export { HookDebugger, getHookDebugger, setHookDebugger } from './hookDebugger.js';
export type { HookTraceEntry, DebugFormat, HookDebuggerConfig } from './hookDebugger.js';
export { MessageBus, getMessageBus, setMessageBus, resetMessageBus } from './messageBus.js';
export type { EventListener, ListenerOptions } from './messageBus.js';
export { HookEventHandler } from './hookEventHandler.js';
export type { HookEventHandlerOptions, EventHandlingResult } from './hookEventHandler.js';
