import { HookEvent } from './types.js';
import { createLogger } from '../utils/logger.js';
/**
 * Message Bus for Hook System
 * 
 * Provides an event-driven communication channel for the hook system.
 * Supports priority-based listeners, async event emission, and wildcard events.
 */


const logger = createLogger('messageBus');

/**
 * Listener function for message bus events
 */
export type EventListener = (event: HookEvent, data: unknown) => void | Promise<void>;

/**
 * Options for event listeners
 */
export interface ListenerOptions {
  /** Priority of the listener (higher runs first, default: 0) */
  priority?: number;
}

/**
 * Internal listener record
 */
interface ListenerRecord {
  id: string;
  event: HookEvent | '*';
  listener: EventListener;
  priority: number;
  once: boolean;
}

/**
 * History record of emitted events
 */
interface HistoryRecord {
  event: HookEvent;
  data: unknown;
  timestamp: number;
}

/**
 * Message Bus implementation
 */
export class MessageBus {
  private listeners: Map<string, ListenerRecord> = new Map();
  private history: HistoryRecord[] = [];
  private historyLimit: number;
  private idCounter = 0;

  constructor(historyLimit = 100) {
    this.historyLimit = historyLimit;
  }

  /**
   * Register a listener for an event
   * 
   * @param event The event to listen for, or '*' for all events
   * @param listener The listener function
   * @param options Listener options
   * @returns A unique ID for removing the listener
   */
  on(event: HookEvent | '*', listener: EventListener, options?: ListenerOptions): string {
    const id = `listener-${this.idCounter++}`;
    this.listeners.set(id, {
      id,
      event,
      listener,
      priority: options?.priority ?? 0,
      once: false,
    });
    return id;
  }

  /**
   * Register a listener that runs only once
   */
  once(event: HookEvent | '*', listener: EventListener): string {
    const id = `listener-${this.idCounter++}`;
    this.listeners.set(id, {
      id,
      event,
      listener,
      priority: 0,
      once: true,
    });
    return id;
  }

  /**
   * Remove a listener by its ID
   * 
   * @param id The listener ID returned by on() or once()
   * @returns true if the listener was removed, false otherwise
   */
  off(id: string): boolean {
    return this.listeners.delete(id);
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners(event?: HookEvent | '*'): void {
    if (event) {
      for (const [id, record] of this.listeners.entries()) {
        if (record.event === event) {
          this.listeners.delete(id);
        }
      }
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Emit an event and wait for all listeners to complete
   */
  async emit(event: HookEvent, data: unknown): Promise<void> {
    // Record history
    this.history.push({
      event,
      data,
      timestamp: Date.now(),
    });

    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    // Get matching listeners
    const matching = Array.from(this.listeners.values())
      .filter((r) => r.event === event || r.event === '*')
      .sort((a, b) => b.priority - a.priority);

    // Execute listeners
    for (const record of matching) {
      try {
        await record.listener(event, data);
      } catch (error) {
        logger.error(`Error in MessageBus listener for event '${event}':`, error);
      }

      if (record.once) {
        this.listeners.delete(record.id);
      }
    }
  }

  /**
   * Emit an event without waiting for listeners to complete
   */
  emitSync(event: HookEvent, data: unknown): void {
    queueMicrotask(() => {
      this.emit(event, data).catch(() => {});
    });
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: HookEvent | '*'): number {
    let count = 0;
    for (const record of this.listeners.values()) {
      if (record.event === event) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all event names that have at least one listener
   */
  getEvents(): string[] {
    const events = new Set<string>();
    for (const record of this.listeners.values()) {
      events.add(record.event);
    }
    return Array.from(events);
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): HistoryRecord[] {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Wait for a specific event to occur
   */
  waitFor(event: HookEvent, timeout = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(listenerId);
        reject(new Error(`Timeout waiting for event '${event}' after ${timeout}ms`));
      }, timeout);

      const listenerId = this.once(event, (_evt, data) => {
        clearTimeout(timeoutId);
        resolve(data);
      });
    });
  }

  /**
   * Create a filtered view of the message bus
   */
  filter(predicate: (event: HookEvent, data: unknown) => boolean): MessageBus {
    const proxy = new MessageBus();
    
    // This is a simplified proxy implementation. 
    // In a real system, this would subscribe to the parent bus.
    this.on('*', async (event, data) => {
      if (predicate(event as HookEvent, data)) {
        await proxy.emit(event as HookEvent, data);
      }
    });

    return proxy;
  }
}

/**
 * Singleton instance management
 */
let globalBus: MessageBus | undefined;

/**
 * Get the global message bus instance
 */
export function getMessageBus(): MessageBus {
  if (!globalBus) {
    globalBus = new MessageBus();
  }
  return globalBus;
}

/**
 * Set the global message bus instance
 */
export function setMessageBus(bus: MessageBus): void {
  globalBus = bus;
}

/**
 * Reset the global message bus instance
 */
export function resetMessageBus(): void {
  globalBus = undefined;
}
