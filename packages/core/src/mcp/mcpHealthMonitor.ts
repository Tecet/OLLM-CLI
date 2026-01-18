/**
 * MCP Health Monitor
 * 
 * Monitors the health of MCP servers and automatically restarts failed servers.
 */

import type { MCPClient, MCPServerConfig, MCPServerStatusType } from './types.js';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Server name */
  serverName: string;
  /** Whether the server is healthy */
  healthy: boolean;
  /** Status type */
  status: MCPServerStatusType;
  /** Error message if unhealthy */
  error?: string;
  /** Timestamp of the check */
  timestamp: number;
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Health check interval in milliseconds (default: 30000 = 30s) */
  checkInterval?: number;
  /** Maximum restart attempts (default: 3) */
  maxRestartAttempts?: number;
  /** Initial backoff delay in milliseconds (default: 1000 = 1s) */
  initialBackoffDelay?: number;
  /** Maximum backoff delay in milliseconds (default: 60000 = 1min) */
  maxBackoffDelay?: number;
  /** Whether to enable auto-restart (default: true) */
  autoRestart?: boolean;
}

/**
 * Server health state
 */
interface ServerHealthState {
  /** Server name */
  name: string;
  /** Last known status */
  lastStatus: MCPServerStatusType;
  /** Server configuration */
  config?: MCPServerConfig;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Number of restart attempts */
  restartAttempts: number;
  /** Timestamp of last health check */
  lastCheckTime: number;
  /** Timestamp of last restart attempt */
  lastRestartTime?: number;
  /** Current backoff delay */
  currentBackoffDelay: number;
}

/**
 * Health monitor event types
 */
export type HealthMonitorEventType = 
  | 'health-check'
  | 'server-unhealthy'
  | 'server-recovered'
  | 'restart-attempt'
  | 'restart-success'
  | 'restart-failed'
  | 'max-restarts-exceeded';

/**
 * Health monitor event
 */
export interface HealthMonitorEvent {
  /** Event type */
  type: HealthMonitorEventType;
  /** Server name */
  serverName: string;
  /** Event timestamp */
  timestamp: number;
  /** Additional event data */
  data?: unknown;
}

/**
 * Health monitor event listener
 */
export type HealthMonitorEventListener = (event: HealthMonitorEvent) => void;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<HealthMonitorConfig> = {
  checkInterval: 30000, // 30 seconds
  maxRestartAttempts: 3,
  initialBackoffDelay: 1000, // 1 second
  maxBackoffDelay: 60000, // 1 minute
  autoRestart: true,
};

/**
 * MCP Health Monitor
 * 
 * Monitors MCP server health and automatically restarts failed servers.
 */
export class MCPHealthMonitor {
  private client: MCPClient;
  private config: Required<HealthMonitorConfig>;
  private serverStates: Map<string, ServerHealthState> = new Map();
  private checkIntervalId?: NodeJS.Timeout;
  private listeners: HealthMonitorEventListener[] = [];
  private isRunning = false;
  private restartLocks: Map<string, Promise<void>> = new Map();

  constructor(client: MCPClient, config?: HealthMonitorConfig) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Initialize server states
    this.initializeServerStates();

    // Start periodic health checks
    this.checkIntervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    // Perform initial health check
    this.performHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear interval
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
    }

    // Clear server states
    this.serverStates.clear();
  }

  /**
   * Add an event listener
   * @param listener - Event listener function
   */
  addEventListener(listener: HealthMonitorEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   * @param listener - Event listener function
   */
  removeEventListener(listener: HealthMonitorEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get health status for a server
   * @param serverName - Server name
   * @returns Health check result or undefined if not monitored
   */
  getServerHealth(serverName: string): HealthCheckResult | undefined {
    const state = this.serverStates.get(serverName);
    if (!state) {
      return undefined;
    }

    const status = this.client.getServerStatus(serverName);

    return {
      serverName,
      healthy: status.status === 'connected',
      status: status.status,
      error: status.error,
      timestamp: state.lastCheckTime,
    };
  }

  /**
   * Get health status for all monitored servers
   * @returns Array of health check results
   */
  getAllServerHealth(): HealthCheckResult[] {
    const results: HealthCheckResult[] = [];

    for (const serverName of this.serverStates.keys()) {
      const health = this.getServerHealth(serverName);
      if (health) {
        results.push(health);
      }
    }

    return results;
  }

  /**
   * Manually trigger a restart for a server
   * @param serverName - Server name
   */
  async restartServer(serverName: string): Promise<void> {
    const state = this.serverStates.get(serverName);
    if (!state) {
      throw new Error(`Server '${serverName}' is not being monitored`);
    }

    // Get server info
    const servers = this.client.listServers();
    const serverInfo = servers.find(s => s.name === serverName);
    
    if (!serverInfo) {
      throw new Error(`Server '${serverName}' not found`);
    }

    state.restartAttempts++;
    state.lastRestartTime = Date.now();
    this.emitEvent({
      type: 'restart-attempt',
      serverName,
      timestamp: state.lastRestartTime,
      data: {
        attempt: state.restartAttempts,
        maxAttempts: this.config.maxRestartAttempts,
      },
    });

    // Attempt restart
    await this.attemptRestart(serverName, serverInfo.config);
  }

  /**
   * Initialize server states from current servers
   */
  private initializeServerStates(): void {
    const servers = this.client.listServers();

    for (const server of servers) {
      if (!this.serverStates.has(server.name)) {
        this.serverStates.set(server.name, {
          name: server.name,
          lastStatus: server.status.status,
          config: server.config,
          consecutiveFailures: 0,
          restartAttempts: 0,
          lastCheckTime: Date.now(),
          currentBackoffDelay: this.config.initialBackoffDelay,
        });
      } else {
        const state = this.serverStates.get(server.name);
        if (state) {
          state.config = server.config;
        }
      }
    }
  }

  /**
   * Perform health checks on all servers
   */
  private performHealthChecks(): void {
    // Update server states list
    this.initializeServerStates();

    // Check each server
    for (const [serverName, state] of this.serverStates.entries()) {
      this.checkServerHealth(serverName, state);
    }
  }

  /**
   * Check health of a single server
   * @param serverName - Server name
   * @param state - Server health state
   */
  private checkServerHealth(serverName: string, state: ServerHealthState): void {
    const now = Date.now();
    const status = this.client.getServerStatus(serverName);

    // Update last check time
    state.lastCheckTime = now;

    // Emit health check event
    this.emitEvent({
      type: 'health-check',
      serverName,
      timestamp: now,
      data: { status: status.status },
    });

    // Check if status changed
    const wasHealthy = state.lastStatus === 'connected';
    const isHealthy = status.status === 'connected';

    if (!isHealthy) {
      // Server is unhealthy
      state.consecutiveFailures++;

      if (wasHealthy) {
        this.emitEvent({
          type: 'server-unhealthy',
          serverName,
          timestamp: now,
          data: {
            status: status.status,
            error: status.error,
            consecutiveFailures: state.consecutiveFailures,
          },
        });
      }

      // Attempt restart if auto-restart is enabled
      if (this.config.autoRestart && state.restartAttempts < this.config.maxRestartAttempts) {
        // Check if enough time has passed since last restart (backoff)
        if (state.lastRestartTime === undefined) {
          // Start the backoff window on first failure.
          state.lastRestartTime = now;
        }
        const timeSinceLastRestart = state.lastRestartTime
          ? now - state.lastRestartTime
          : 0;

        if (timeSinceLastRestart >= state.currentBackoffDelay) {
          state.restartAttempts++;
          state.lastRestartTime = now;
          this.emitEvent({
            type: 'restart-attempt',
            serverName,
            timestamp: now,
            data: {
              attempt: state.restartAttempts,
              maxAttempts: this.config.maxRestartAttempts,
            },
          });
          if (state.config) {
            void this.attemptRestart(serverName, state.config);
          }
        }
      } else if (state.restartAttempts >= this.config.maxRestartAttempts) {
        // Max restarts exceeded
        this.emitEvent({
          type: 'max-restarts-exceeded',
          serverName,
          timestamp: now,
          data: {
            maxAttempts: this.config.maxRestartAttempts,
            error: status.error,
          },
        });
      }
    } else if (!wasHealthy && isHealthy) {
      // Server recovered
      state.consecutiveFailures = 0;
      state.restartAttempts = 0;
      state.currentBackoffDelay = this.config.initialBackoffDelay;
      
      this.emitEvent({
        type: 'server-recovered',
        serverName,
        timestamp: now,
      });
    }

    // Update last status
    state.lastStatus = status.status;
  }

  /**
   * Attempt to restart a server
   * @param serverName - Server name
   * @param config - Server configuration
   */
  private async attemptRestart(serverName: string, config: MCPServerConfig): Promise<void> {
    // Check if restart is already in progress
    const existingRestart = this.restartLocks.get(serverName);
    if (existingRestart) {
      return existingRestart;
    }

    const state = this.serverStates.get(serverName);
    if (!state) {
      return;
    }

    // Create restart promise
    const restartPromise = (async () => {
      try {
        // Stop the server
        await this.client.stopServer(serverName);

        // Allow async listeners to flush before restarting.
        await new Promise(resolve => queueMicrotask(resolve));

        // Start the server
        await this.client.startServer(serverName, config);

        // Restart successful
        state.consecutiveFailures = 0;
        state.currentBackoffDelay = this.config.initialBackoffDelay;

        this.emitEvent({
          type: 'restart-success',
          serverName,
          timestamp: Date.now(),
          data: { attempt: state.restartAttempts },
        });
      } catch (error) {
        // Restart failed
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Increase backoff delay (exponential backoff)
        state.currentBackoffDelay = Math.min(
          state.currentBackoffDelay * 2,
          this.config.maxBackoffDelay
        );

        this.emitEvent({
          type: 'restart-failed',
          serverName,
          timestamp: Date.now(),
          data: { 
            attempt: state.restartAttempts,
            error: errorMessage,
            nextBackoffDelay: state.currentBackoffDelay,
          },
        });
      } finally {
        // Remove restart lock
        this.restartLocks.delete(serverName);
      }
    })();

    // Store restart lock
    this.restartLocks.set(serverName, restartPromise);

    return restartPromise;
  }

  /**
   * Emit an event to all listeners
   * @param event - Event to emit
   */
  private emitEvent(event: HealthMonitorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // Ignore listener errors
        console.error('Error in health monitor event listener:', error);
      }
    }
  }
}
