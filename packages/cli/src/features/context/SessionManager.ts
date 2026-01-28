/**
 * Session Manager
 * 
 * Handles session ID generation and management for model swaps.
 * Keeps session logic separate from UI components.
 */

type SessionChangeCallback = (sessionId: string, model: string) => void;

class SessionManager {
  private currentSessionId: string;
  private currentModel: string;
  private callbacks: Set<SessionChangeCallback> = new Set();

  constructor(initialModel: string) {
    this.currentSessionId = `session-${Date.now()}`;
    this.currentModel = initialModel;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Get the current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Create a new session for a model swap
   * @param newModel - The new model being switched to
   * @returns The new session ID
   */
  createNewSession(newModel: string): string {
    const newSessionId = `session-${Date.now()}`;
    console.log(`[SessionManager] Model changed: ${this.currentModel} → ${newModel}, new session: ${newSessionId}`);
    
    this.currentSessionId = newSessionId;
    this.currentModel = newModel;
    
    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(newSessionId, newModel);
      } catch (error) {
        console.error('[SessionManager] Callback error:', error);
      }
    });
    
    return newSessionId;
  }

  /**
   * Register a callback to be notified of session changes
   * @param callback - Function to call when session changes
   * @returns Cleanup function to unregister the callback
   */
  onSessionChange(callback: SessionChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }
}

// Global singleton instance
let globalSessionManager: SessionManager | null = null;

/**
 * Initialize the global session manager
 * @param initialModel - The initial model
 */
export function initializeSessionManager(initialModel: string): void {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager(initialModel);
  }
}

/**
 * Get the global session manager instance
 */
export function getSessionManager(): SessionManager {
  if (!globalSessionManager) {
    throw new Error('SessionManager not initialized. Call initializeSessionManager first.');
  }
  return globalSessionManager;
}

/**
 * Reset the global session manager (for testing)
 */
export function resetSessionManager(): void {
  globalSessionManager = null;
}
