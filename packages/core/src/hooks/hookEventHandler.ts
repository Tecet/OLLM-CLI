/**
 * HookEventHandler bridges MessageBus events to Hook execution
 * 
 * Subscribes to MessageBus events and executes registered hooks,
 * providing a clean separation between event emission and hook execution.
 */

import { MessageBus, type EventListener } from './messageBus.js';
import { createLogger } from '../utils/logger.js';

import type { HookRegistry } from './hookRegistry.js';
import type { HookRunner } from './hookRunner.js';
import type { HookEvent, Hook, HookInput } from './types.js';

const logger = createLogger('hookEventHandler');

/**
 * Options for hook event handler
 */
export interface HookEventHandlerOptions {
  /** Whether to execute hooks in parallel (default: false) */
  parallel?: boolean;
  /** Whether to stop on first hook failure (default: false) */
  stopOnError?: boolean;
  /** Whether to log hook execution (default: true) */
  logging?: boolean;
}

/**
 * Result of handling an event
 */
export interface EventHandlingResult {
  /** The event that was handled */
  event: HookEvent;
  /** Number of hooks executed */
  hooksExecuted: number;
  /** Whether all hooks succeeded */
  success: boolean;
  /** System messages from hooks */
  systemMessages: string[];
  /** Whether execution should continue */
  shouldContinue: boolean;
  /** Aggregated data from hooks */
  aggregatedData: Record<string, unknown>;
  /** Errors that occurred */
  errors: Error[];
}

/**
 * Handler that connects MessageBus events to Hook execution
 */
export class HookEventHandler {
  private messageBus: MessageBus;
  private hookRegistry: HookRegistry;
  private hookRunner: HookRunner;
  private options: Required<HookEventHandlerOptions>;
  private listenerIds: Map<HookEvent, string>;
  private enabled: boolean;

  constructor(
    messageBus: MessageBus,
    hookRegistry: HookRegistry,
    hookRunner: HookRunner,
    options?: HookEventHandlerOptions
  ) {
    this.messageBus = messageBus;
    this.hookRegistry = hookRegistry;
    this.hookRunner = hookRunner;
    this.options = {
      parallel: options?.parallel ?? false,
      stopOnError: options?.stopOnError ?? false,
      logging: options?.logging ?? true,
    };
    this.listenerIds = new Map();
    this.enabled = true;
  }

  /**
   * Start listening for events and executing hooks
   */
  start(): void {
    if (!this.enabled) {
      this.enabled = true;
    }

    // Subscribe to all hook events
    const events: HookEvent[] = [
      'session_start',
      'session_end',
      'before_agent',
      'after_agent',
      'before_model',
      'after_model',
      'before_tool_selection',
      'before_tool',
      'after_tool',
      'pre_compress',
      'post_compress',
      'notification',
    ];

    for (const event of events) {
      const listener: EventListener = async (evt, data) => {
        if (!this.enabled) return;
        await this.handleEvent(evt, data as Record<string, unknown>);
      };

      const listenerId = this.messageBus.on(event, listener);
      this.listenerIds.set(event, listenerId);
    }

    if (this.options.logging) {
      logger.info('HookEventHandler started and listening for events');
    }
  }

  /**
   * Stop listening for events
   */
  stop(): void {
    this.enabled = false;

    // Unsubscribe from all events
    for (const listenerId of this.listenerIds.values()) {
      this.messageBus.off(listenerId);
    }

    this.listenerIds.clear();

    if (this.options.logging) {
      logger.info('HookEventHandler stopped');
    }
  }

  /**
   * Handle an event by executing registered hooks
   * 
   * @param event - The event to handle
   * @param data - Event-specific data
   * @returns Promise resolving to handling result
   */
  private async handleEvent(event: HookEvent, data: Record<string, unknown>): Promise<EventHandlingResult> {
    const startTime = Date.now();
    
    // Get hooks for this event
    const hooks = this.hookRegistry.getHooksForEvent(event);

    if (hooks.length === 0) {
      // No hooks registered for this event
      return {
        event,
        hooksExecuted: 0,
        success: true,
        systemMessages: [],
        shouldContinue: true,
        aggregatedData: {},
        errors: [],
      };
    }

    if (this.options.logging) {
      logger.debug(`Executing ${hooks.length} hook(s) for event '${event}'`);
    }

    // Prepare hook input
    const input: HookInput = {
      event,
      data,
    };

    try {
      if (this.options.parallel) {
        // Execute hooks in parallel
        return await this.executeHooksParallel(hooks, input);
      } else {
        // Execute hooks sequentially
        return await this.executeHooksSequential(hooks, input);
      }
    } catch (error) {
      logger.error(`Error handling event '${event}':`, { error: error instanceof Error ? error.message : String(error) });
      return {
        event,
        hooksExecuted: 0,
        success: false,
        systemMessages: [],
        shouldContinue: true,
        aggregatedData: {},
        errors: [error instanceof Error ? error : new Error(String(error))],
      };
    } finally {
      const duration = Date.now() - startTime;
      if (this.options.logging) {
        logger.debug(`Event '${event}' handling completed in ${duration}ms`);
      }
    }
  }

  /**
   * Execute hooks sequentially
   */
  private async executeHooksSequential(hooks: Hook[], input: HookInput): Promise<EventHandlingResult> {
    const summary = await this.hookRunner.executeHooksWithSummary(hooks, input);

    return {
      event: input.event as HookEvent,
      hooksExecuted: hooks.length,
      success: !summary.aborted && summary.outputs.every((o) => !o.error),
      systemMessages: summary.systemMessages,
      shouldContinue: summary.shouldContinue,
      aggregatedData: summary.aggregatedData,
      errors: summary.outputs
        .filter((o) => o.error)
        .map((o) => new Error(o.error)),
    };
  }

  /**
   * Execute hooks in parallel
   */
  private async executeHooksParallel(hooks: Hook[], input: HookInput): Promise<EventHandlingResult> {
    const results = await Promise.allSettled(
      hooks.map((hook) => this.hookRunner.executeHook(hook, input))
    );

    const systemMessages: string[] = [];
    const errors: Error[] = [];
    let shouldContinue = true;
    const aggregatedData: Record<string, unknown> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const output = result.value;
        
        if (output.systemMessage) {
          systemMessages.push(output.systemMessage);
        }

        if (!output.continue) {
          shouldContinue = false;
        }

        if (output.data) {
          Object.assign(aggregatedData, output.data);
        }

        if (output.error) {
          errors.push(new Error(output.error));
        }
      } else {
        errors.push(result.reason);
        if (this.options.stopOnError) {
          shouldContinue = false;
        }
      }
    }

    return {
      event: input.event as HookEvent,
      hooksExecuted: hooks.length,
      success: errors.length === 0,
      systemMessages,
      shouldContinue,
      aggregatedData,
      errors,
    };
  }

  /**
   * Enable hook execution
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable hook execution (events still received but hooks not executed)
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if handler is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set execution options
   */
  setOptions(options: Partial<HookEventHandlerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  /**
   * Get current options
   */
  getOptions(): Required<HookEventHandlerOptions> {
    return { ...this.options };
  }
}
