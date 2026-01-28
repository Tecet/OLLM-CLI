/**
 * Hook Debugger
 *
 * Provides debugging and tracing capabilities for hook execution.
 */

import type { Hook, HookEvent } from './types.js';

/**
 * Hook execution trace entry
 */
export interface HookTraceEntry {
  /** Hook name */
  hookName: string;
  /** Hook source (user/workspace/downloaded) */
  source: string;
  /** Event that triggered the hook */
  event: HookEvent;
  /** Execution start time */
  startTime: number;
  /** Execution end time */
  endTime?: number;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Hook input data */
  input: unknown;
  /** Hook output data */
  output?: unknown;
  /** Error if execution failed */
  error?: string;
  /** Exit code */
  exitCode?: number;
  /** Whether execution was successful */
  success: boolean;
}

/**
 * Debug output format
 */
export type DebugFormat = 'json' | 'pretty' | 'compact';

/**
 * Hook debugger configuration
 */
export interface HookDebuggerConfig {
  /** Whether debugging is enabled */
  enabled: boolean;
  /** Output format */
  format: DebugFormat;
  /** Whether to include input/output data */
  includeData: boolean;
  /** Maximum data size to include (in characters) */
  maxDataSize: number;
  /** Whether to log to console */
  logToConsole: boolean;
}

/**
 * Default debugger configuration
 */
const DEFAULT_CONFIG: HookDebuggerConfig = {
  enabled: false,
  format: 'pretty',
  includeData: true,
  maxDataSize: 1000,
  logToConsole: true,
};

/**
 * Hook Debugger
 *
 * Provides debugging and tracing capabilities for hook execution.
 */
export class HookDebugger {
  private config: HookDebuggerConfig;
  private traces: HookTraceEntry[] = [];
  private activeTraces: Map<string, HookTraceEntry> = new Map();

  constructor(config?: Partial<HookDebuggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enable debugging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable debugging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set output format
   */
  setFormat(format: DebugFormat): void {
    this.config.format = format;
  }

  /**
   * Start tracing a hook execution
   */
  startTrace(hook: Hook, event: HookEvent, input: unknown): string {
    if (!this.config.enabled) {
      return '';
    }

    const traceId = `${hook.name}-${Date.now()}`;
    const trace: HookTraceEntry = {
      hookName: hook.name,
      source: hook.source || 'unknown',
      event,
      startTime: Date.now(),
      input: this.sanitizeData(input),
      success: false,
    };

    this.activeTraces.set(traceId, trace);

    if (this.config.logToConsole) {
      this.logTraceStart(trace);
    }

    return traceId;
  }

  /**
   * End tracing a hook execution
   */
  endTrace(traceId: string, output?: unknown, error?: Error, exitCode?: number): void {
    if (!this.config.enabled || !traceId) {
      return;
    }

    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.output = this.sanitizeData(output);
    trace.error = error?.message;
    trace.exitCode = exitCode;
    trace.success = !error && (exitCode === undefined || exitCode === 0);

    this.traces.push(trace);
    this.activeTraces.delete(traceId);

    if (this.config.logToConsole) {
      this.logTraceEnd(trace);
    }
  }

  /**
   * Get all traces
   */
  getTraces(): HookTraceEntry[] {
    return [...this.traces];
  }

  /**
   * Get traces for a specific hook
   */
  getTracesForHook(hookName: string): HookTraceEntry[] {
    return this.traces.filter((t) => t.hookName === hookName);
  }

  /**
   * Get traces for a specific event
   */
  getTracesForEvent(event: HookEvent): HookTraceEntry[] {
    return this.traces.filter((t) => t.event === event);
  }

  /**
   * Get failed traces
   */
  getFailedTraces(): HookTraceEntry[] {
    return this.traces.filter((t) => !t.success);
  }

  /**
   * Clear all traces
   */
  clearTraces(): void {
    this.traces = [];
    this.activeTraces.clear();
  }

  /**
   * Export traces to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.traces, null, 2);
  }

  /**
   * Export traces to formatted text
   */
  exportToText(): string {
    return this.traces.map((trace) => this.formatTrace(trace, 'pretty')).join('\n\n');
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    byHook: Record<string, number>;
    byEvent: Record<string, number>;
  } {
    const total = this.traces.length;
    const successful = this.traces.filter((t) => t.success).length;
    const failed = total - successful;
    const averageDuration =
      total > 0 ? this.traces.reduce((sum, t) => sum + (t.duration || 0), 0) / total : 0;

    const byHook: Record<string, number> = {};
    const byEvent: Record<string, number> = {};

    for (const trace of this.traces) {
      byHook[trace.hookName] = (byHook[trace.hookName] || 0) + 1;
      byEvent[trace.event] = (byEvent[trace.event] || 0) + 1;
    }

    return {
      total,
      successful,
      failed,
      averageDuration,
      byHook,
      byEvent,
    };
  }

  /**
   * Sanitize data for logging
   */
  private sanitizeData(data: unknown): unknown {
    if (!this.config.includeData) {
      return '[data hidden]';
    }

    const json = JSON.stringify(data);
    if (json.length > this.config.maxDataSize) {
      return json.substring(0, this.config.maxDataSize) + '... [truncated]';
    }

    return data;
  }

  /**
   * Log trace start
   */
  private logTraceStart(trace: HookTraceEntry): void {
    const formatted = this.formatTraceStart(trace);
    console.log(formatted);
  }

  /**
   * Log trace end
   */
  private logTraceEnd(trace: HookTraceEntry): void {
    const formatted = this.formatTrace(trace, this.config.format);
    console.log(formatted);
  }

  /**
   * Format trace start message
   */
  private formatTraceStart(trace: HookTraceEntry): string {
    return `🔍 Hook: ${trace.hookName} (${trace.source}) - Event: ${trace.event} - Started`;
  }

  /**
   * Format trace entry
   */
  private formatTrace(trace: HookTraceEntry, format: DebugFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(trace);
      case 'compact':
        return this.formatCompact(trace);
      case 'pretty':
      default:
        return this.formatPretty(trace);
    }
  }

  /**
   * Format trace in compact format
   */
  private formatCompact(trace: HookTraceEntry): string {
    const status = trace.success ? '✓' : '✗';
    const duration = trace.duration !== undefined ? `${trace.duration}ms` : 'N/A';
    return `${status} ${trace.hookName} (${trace.event}) - ${duration}`;
  }

  /**
   * Format trace in pretty format
   */
  private formatPretty(trace: HookTraceEntry): string {
    const lines: string[] = [];
    const status = trace.success ? '✓ SUCCESS' : '✗ FAILED';
    const duration = trace.duration !== undefined ? `${trace.duration}ms` : 'N/A';

    lines.push(`━━━ Hook Execution ${status} ━━━`);
    lines.push(`Hook:     ${trace.hookName}`);
    lines.push(`Source:   ${trace.source}`);
    lines.push(`Event:    ${trace.event}`);
    lines.push(`Duration: ${duration}`);

    if (trace.exitCode !== undefined) {
      lines.push(`Exit Code: ${trace.exitCode}`);
    }

    if (this.config.includeData && trace.input) {
      lines.push(`Input:    ${JSON.stringify(trace.input, null, 2)}`);
    }

    if (this.config.includeData && trace.output) {
      lines.push(`Output:   ${JSON.stringify(trace.output, null, 2)}`);
    }

    if (trace.error) {
      lines.push(`Error:    ${trace.error}`);
    }

    lines.push('━'.repeat(40));

    return lines.join('\n');
  }
}

/**
 * Global hook debugger instance
 */
let globalDebugger: HookDebugger | null = null;

/**
 * Get the global hook debugger instance
 */
export function getHookDebugger(): HookDebugger {
  if (!globalDebugger) {
    globalDebugger = new HookDebugger();
  }
  return globalDebugger;
}

/**
 * Set the global hook debugger instance
 */
export function setHookDebugger(hookDebugger: HookDebugger): void {
  globalDebugger = hookDebugger;
}
