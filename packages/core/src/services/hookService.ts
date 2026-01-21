/**
 * Hook Service - Manages hook system initialization and lifecycle
 * 
 * Provides centralized management of hooks, including:
 * - Hook registry
 * - Hook runner with trust verification
 * - Hook event handler with message bus
 * - Hook planner for execution strategies
 */

import { homedir } from 'os';
import { join } from 'path';
import {
  HookRegistry,
  HookRunner,
  HookEventHandler,
  HookPlanner,
  TrustedHooks,
  MessageBus,
  getMessageBus,
} from '../hooks/index.js';
import type { TrustedHooksConfig, ApprovalCallback } from '../hooks/trustedHooks.js';
import type { Hook, HookEvent, HookInput } from '../hooks/types.js';

/**
 * Hook service configuration
 */
export interface HookServiceConfig {
  /** Path to trusted hooks storage (default: ~/.ollm/trusted-hooks.json) */
  trustedHooksPath?: string;
  /** Whether to auto-trust workspace hooks */
  trustWorkspace?: boolean;
  /** Hook execution timeout in milliseconds */
  timeout?: number;
  /** Callback for requesting user approval */
  approvalCallback?: ApprovalCallback;
}

/**
 * Hook Service - Manages the hook system
 */
export class HookService {
  private registry: HookRegistry;
  private runner: HookRunner;
  private eventHandler: HookEventHandler;
  private planner: HookPlanner;
  private trustedHooks: TrustedHooks;
  private messageBus: MessageBus;
  private initialized: boolean = false;

  constructor(config: HookServiceConfig = {}) {
    // Initialize message bus (singleton)
    this.messageBus = getMessageBus();

    // Initialize hook registry
    this.registry = new HookRegistry();

    // Initialize hook planner with registry
    this.planner = new HookPlanner(this.registry);

    // Initialize trusted hooks
    const trustedHooksPath = config.trustedHooksPath || join(homedir(), '.ollm', 'trusted-hooks.json');
    const trustedHooksConfig: TrustedHooksConfig = {
      storagePath: trustedHooksPath,
      trustWorkspace: config.trustWorkspace ?? false,
      approvalCallback: config.approvalCallback,
    };
    this.trustedHooks = new TrustedHooks(trustedHooksConfig);

    // Initialize hook runner with trusted hooks
    const timeout = config.timeout ?? 30000; // 30 seconds default
    this.runner = new HookRunner(timeout, this.trustedHooks);

    // Initialize hook event handler
    this.eventHandler = new HookEventHandler(
      this.messageBus,
      this.registry,
      this.runner,
      {
        parallel: false, // Sequential by default
      }
    );
  }

  /**
   * Initialize the hook service
   * Loads trusted hooks from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load trusted hooks
    await this.trustedHooks.load();

    // Start event handler
    this.eventHandler.start();

    this.initialized = true;
  }

  /**
   * Shutdown the hook service
   * Stops event handler and cleans up resources
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Stop event handler
    this.eventHandler.stop();

    this.initialized = false;
  }

  /**
   * Register a hook for an event
   */
  registerHook(event: HookEvent, hook: Hook): void {
    this.registry.registerHook(event, hook);
  }

  /**
   * Unregister a hook by ID
   */
  unregisterHook(hookId: string): boolean {
    return this.registry.unregisterHook(hookId);
  }

  /**
   * Get all hooks for an event
   */
  getHooksForEvent(event: HookEvent): Hook[] {
    return this.registry.getHooksForEvent(event);
  }

  /**
   * Execute hooks for an event manually
   * (Normally hooks are executed automatically via message bus)
   */
  async executeHooks(event: HookEvent, input: HookInput): Promise<void> {
    const hooks = this.registry.getHooksForEvent(event);
    if (hooks.length === 0) {
      return;
    }

    await this.runner.executeHooksWithSummary(hooks, input);
  }

  /**
   * Emit an event to trigger hooks
   */
  emitEvent(event: HookEvent, data: unknown): void {
    this.messageBus.emit(event, data);
  }

  /**
   * Get the hook registry
   */
  getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Get the hook runner
   */
  getRunner(): HookRunner {
    return this.runner;
  }

  /**
   * Get the trusted hooks manager
   */
  getTrustedHooks(): TrustedHooks {
    return this.trustedHooks;
  }

  /**
   * Get the message bus
   */
  getMessageBus(): MessageBus {
    return this.messageBus;
  }

  /**
   * Get the event handler
   */
  getEventHandler(): HookEventHandler {
    return this.eventHandler;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
