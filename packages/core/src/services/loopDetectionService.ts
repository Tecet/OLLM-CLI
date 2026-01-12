/**
 * Loop Detection Service
 *
 * Monitors execution patterns and detects infinite loops in tool calling.
 * Tracks:
 * - Consecutive identical tool calls
 * - Consecutive identical outputs
 * - Total turn count
 */

import { createHash } from 'crypto';
import { sanitizeErrorMessage } from './errorSanitization.js';

export interface LoopPattern {
  type: 'repeated-tool' | 'repeated-output' | 'turn-limit';
  details: string;
  count: number;
}

export interface LoopDetectionConfig {
  maxTurns: number; // Default: 50
  repeatThreshold: number; // Default: 3
  enabled: boolean;
}

export type LoopEventCallback = (pattern: LoopPattern) => void;

interface ToolCallRecord {
  name: string;
  argsHash: string;
}

/**
 * Service for detecting and preventing infinite loops in tool execution
 */
export class LoopDetectionService {
  private config: LoopDetectionConfig;
  private turnCount: number = 0;
  private toolCallHistory: ToolCallRecord[] = [];
  private outputHistory: string[] = [];
  private loopDetected: LoopPattern | null = null;
  private loopEventCallbacks: LoopEventCallback[] = [];
  private executionStopped: boolean = false;

  constructor(config?: Partial<LoopDetectionConfig>) {
    this.config = {
      maxTurns: config?.maxTurns ?? 50,
      repeatThreshold: config?.repeatThreshold ?? 3,
      enabled: config?.enabled ?? true,
    };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<LoopDetectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Record a turn (user-assistant cycle)
   */
  recordTurn(): void {
    if (!this.config.enabled) return;
    this.turnCount++;
  }

  /**
   * Record a tool call with its arguments
   */
  recordToolCall(toolName: string, args: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    const argsHash = this.hashArgs(args);
    this.toolCallHistory.push({ name: toolName, argsHash });

    // Keep only recent history (sliding window)
    const maxHistory = this.config.repeatThreshold * 2;
    if (this.toolCallHistory.length > maxHistory) {
      this.toolCallHistory = this.toolCallHistory.slice(-maxHistory);
    }
  }

  /**
   * Record output from a turn
   */
  recordOutput(output: string): void {
    if (!this.config.enabled) return;

    this.outputHistory.push(output);

    // Keep only recent history (sliding window)
    const maxHistory = this.config.repeatThreshold * 2;
    if (this.outputHistory.length > maxHistory) {
      this.outputHistory = this.outputHistory.slice(-maxHistory);
    }
  }

  /**
   * Check for loop patterns
   * Returns loop pattern if detected, null otherwise
   */
  checkForLoop(): LoopPattern | null {
    if (!this.config.enabled) return null;
    if (this.loopDetected) return this.loopDetected;

    // Check turn limit
    if (this.turnCount >= this.config.maxTurns) {
      this.loopDetected = {
        type: 'turn-limit',
        details: `Exceeded maximum turn limit of ${this.config.maxTurns}`,
        count: this.turnCount,
      };
      this.emitLoopEvent(this.loopDetected);
      this.stopExecution();
      return this.loopDetected;
    }

    // Check for repeated tool calls
    const repeatedTool = this.detectRepeatedToolCalls();
    if (repeatedTool) {
      this.loopDetected = repeatedTool;
      this.emitLoopEvent(this.loopDetected);
      this.stopExecution();
      return this.loopDetected;
    }

    // Check for repeated outputs
    const repeatedOutput = this.detectRepeatedOutputs();
    if (repeatedOutput) {
      this.loopDetected = repeatedOutput;
      this.emitLoopEvent(this.loopDetected);
      this.stopExecution();
      return this.loopDetected;
    }

    return null;
  }

  /**
   * Register a callback to be invoked when a loop is detected
   */
  onLoopDetected(callback: LoopEventCallback): void {
    this.loopEventCallbacks.push(callback);
  }

  /**
   * Remove a previously registered callback
   */
  offLoopDetected(callback: LoopEventCallback): void {
    const index = this.loopEventCallbacks.indexOf(callback);
    if (index !== -1) {
      this.loopEventCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if execution has been stopped due to loop detection
   */
  isExecutionStopped(): boolean {
    return this.executionStopped;
  }

  /**
   * Reset all tracking state
   */
  reset(): void {
    this.turnCount = 0;
    this.toolCallHistory = [];
    this.outputHistory = [];
    this.loopDetected = null;
    this.executionStopped = false;
  }

  /**
   * Get current turn count
   */
  getTurnCount(): number {
    return this.turnCount;
  }

  /**
   * Check if a loop has been detected
   */
  isLoopDetected(): boolean {
    return this.loopDetected !== null;
  }

  /**
   * Hash tool arguments for comparison
   */
  private hashArgs(args: Record<string, unknown>): string {
    const normalized = JSON.stringify(args, Object.keys(args).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Emit loop detection event to all registered callbacks
   */
  private emitLoopEvent(pattern: LoopPattern): void {
    for (const callback of this.loopEventCallbacks) {
      try {
        callback(pattern);
      } catch (error) {
        // Silently catch callback errors to prevent one bad callback from affecting others
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error in loop detection callback:', sanitizeErrorMessage(errorMessage));
      }
    }
  }

  /**
   * Stop further execution
   */
  private stopExecution(): void {
    this.executionStopped = true;
  }

  /**
   * Detect repeated tool calls with identical arguments
   */
  private detectRepeatedToolCalls(): LoopPattern | null {
    if (this.toolCallHistory.length < this.config.repeatThreshold) {
      return null;
    }

    // Check last N tool calls
    const recent = this.toolCallHistory.slice(-this.config.repeatThreshold);
    const first = recent[0];

    // Check if all recent calls are identical
    const allSame = recent.every(
      (call) => call.name === first.name && call.argsHash === first.argsHash
    );

    if (allSame) {
      return {
        type: 'repeated-tool',
        details: `Tool "${first.name}" called ${this.config.repeatThreshold} times consecutively with identical arguments`,
        count: this.config.repeatThreshold,
      };
    }

    return null;
  }

  /**
   * Detect repeated outputs
   */
  private detectRepeatedOutputs(): LoopPattern | null {
    if (this.outputHistory.length < this.config.repeatThreshold) {
      return null;
    }

    // Check last N outputs
    const recent = this.outputHistory.slice(-this.config.repeatThreshold);
    const first = recent[0];

    // Check if all recent outputs are identical
    const allSame = recent.every((output) => output === first);

    if (allSame) {
      return {
        type: 'repeated-output',
        details: `Same output repeated ${this.config.repeatThreshold} times consecutively`,
        count: this.config.repeatThreshold,
      };
    }

    return null;
  }
}
