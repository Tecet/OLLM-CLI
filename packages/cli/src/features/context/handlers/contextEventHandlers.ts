/**
 * Context Event Handlers
 * 
 * Event handlers for context manager events (compression, summarization, warnings).
 * Extracted from ChatContext.tsx for better separation of concerns.
 * 
 * These handlers manage UI updates in response to context management events:
 * - Memory warnings when context is filling up
 * - Compression events when context is summarized
 * - Summarization progress updates
 * - Session save confirmations
 */

import type { ContextMessage } from '@ollm/core';
import { SettingsService } from '../../../config/settingsService.js';
import type { Message } from '../types/chatTypes.js';

/**
 * Dependencies required by event handlers
 */
export interface EventHandlerDependencies {
  /** Add a message to the UI */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  
  /** Set a sticky status message */
  setStatusMessage: (message: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  
  /** Context actions for querying state */
  contextActions: {
    getUsage: () => { percentage: number };
    getConfig?: () => { compression?: { threshold?: number } } | undefined;
    getContext: () => Promise<ContextMessage[]>;
    on?: (event: string, handler: (data: unknown) => void) => void;
    off?: (event: string, handler: (data: unknown) => void) => void;
  };
  
  /** Context manager state */
  contextManagerState: {
    usage: { percentage?: number };
  };
  
  /** Refs for managing compression retry state */
  compressionOccurredRef: React.MutableRefObject<boolean>;
  compressionRetryCountRef: React.MutableRefObject<number>;
  waitingForResumeRef: React.MutableRefObject<boolean>;
}

/**
 * Create event handlers with dependencies injected
 * 
 * @param deps - Dependencies required by handlers
 * @returns Object containing all event handlers
 */
export function createContextEventHandlers(deps: EventHandlerDependencies) {
  const {
    addMessage,
    setStatusMessage,
    contextActions,
    contextManagerState,
    compressionOccurredRef,
    compressionRetryCountRef,
    waitingForResumeRef,
  } = deps;

  /**
   * Handle memory warning event
   * Shows warning when context usage is high
   */
  const handleMemoryWarning = async (_data: unknown) => {
    try {
      const usage = contextActions.getUsage();
      const cfg = contextActions.getConfig?.();
      const threshold = cfg?.compression?.threshold 
        ? Math.round(cfg.compression.threshold * 100) 
        : Math.round((contextManagerState.usage.percentage || 0));
      
      addMessage({
        role: 'system',
        content: `Warning: context usage at ${Math.round(usage.percentage)}%. Compression enabled at ${threshold}%`,
        excludeFromContext: true,
      });
    } catch (_err) {
      // Ignore errors in warning display
    }
  };

  /**
   * Handle compressed event
   * Shows summary after compression completes
   */
  const handleCompressed = async (_data: unknown) => {
    try {
      const msgs = await contextActions.getContext();
      const summaryMsg = msgs.find(
        (m: ContextMessage) => typeof m.id === 'string' && m.id.startsWith('summary-')
      ) as ContextMessage | undefined;
      const summaryText = summaryMsg ? summaryMsg.content : '[Conversation summary generated]';
      
      // Mark that compression occurred so ongoing generation can retry/resume
      compressionOccurredRef.current = true;
      compressionRetryCountRef.current = 0;

      addMessage({
        role: 'assistant',
        content: `Context compressed: ${summaryText}`,
        excludeFromContext: true,
      });
    } catch (_err) {
      // Ignore errors in compression display
    }
  };

  /**
   * Handle summarizing event
   * Shows sticky status message during summarization
   */
  const handleSummarizing = (_data: unknown) => {
    // Show immediate sticky status
    setStatusMessage('Summarizing conversation history...');
    
    // Auto-clear after 5 seconds so it doesn't stay forever if summarization is slow
    setTimeout(() => {
      setStatusMessage(current => 
        current === 'Summarizing conversation history...' ? undefined : current
      );
    }, 5000);
  };

  /**
   * Handle auto-summary created event
   * Shows summary and optionally prompts user to continue
   */
  const handleAutoSummary = async (data: unknown) => {
    try {
      const typedData = data as { summary?: { content?: string } };
      const summary = typedData?.summary;
      const text = summary?.content || '[Conversation summary]';

      // Clear sticky status
      setStatusMessage(undefined);

      // Add assistant-visible summary message (do not add it to core context again)
      addMessage({
        role: 'assistant',
        content: text,
        excludeFromContext: true,
      });
      
      // Mark that compression happened so ongoing generation can retry/resume
      compressionOccurredRef.current = true;
      compressionRetryCountRef.current = 0;
      
      // Decide whether to auto-resume or ask based on settings
      try {
        const settings = SettingsService.getInstance().getSettings();
        const resumePref = settings.llm?.resumeAfterSummary || 'ask';
        if (resumePref === 'ask') {
          waitingForResumeRef.current = true;
          addMessage({ 
            role: 'system', 
            content: 'Summary complete. Type "continue" to resume generation or "stop" to abort.', 
            excludeFromContext: true 
          });
        }
      } catch (_e) {
        // Ignore settings errors
      }
    } catch (_err) {
      // Ignore errors in summary display
    }
  };

  /**
   * Handle auto-summary failed event
   * Shows error message when summarization fails
   */
  const handleAutoSummaryFailed = async (data: unknown) => {
    // Clear sticky status
    setStatusMessage(undefined);
    
    try {
      const typedData = data as { error?: unknown; reason?: unknown };
      const err = typedData?.error || typedData?.reason || 'Summarization failed';
      const message = typeof err === 'string' 
        ? err 
        : ((err && typeof err === 'object' && 'message' in err) 
          ? String((err as { message?: unknown }).message) 
          : JSON.stringify(err));
      
      addMessage({
        role: 'system',
        content: `❌ Task failed successfully: ${message}`,
        excludeFromContext: true,
      });
    } catch (_e) {
      // Ignore errors in error display
    }
  };

  /**
   * Handle context warning low event
   * Shows warning when context is filling up
   */
  const handleContextWarningLow = (data: unknown) => {
    try {
      const typedData = data as { percentage?: number; message?: string };
      const percentage = typedData?.percentage || 70;
      
      // Show warning message
      setStatusMessage(`⚠️ Context at ${Math.round(percentage)}% - compression will trigger soon`);
      
      // Auto-clear after 10 seconds
      setTimeout(() => {
        setStatusMessage(current => 
          current?.includes('Context at') ? undefined : current
        );
      }, 10000);
    } catch (_e) {
      // Ignore errors in warning display
    }
  };

  /**
   * Handle session saved event
   * Shows brief confirmation when session is saved
   */
  const handleSessionSaved = (data: unknown) => {
    try {
      const typedData = data as { turnNumber?: number };
      const turnNumber = typedData?.turnNumber || 0;
      
      // Show brief confirmation
      setStatusMessage(`💾 Session saved (turn ${turnNumber}) - rollback available`);
      
      // Auto-clear after 3 seconds
      setTimeout(() => {
        setStatusMessage(current => 
          current?.includes('Session saved') ? undefined : current
        );
      }, 3000);
    } catch (_e) {
      // Ignore errors in confirmation display
    }
  };

  return {
    handleMemoryWarning,
    handleCompressed,
    handleSummarizing,
    handleAutoSummary,
    handleAutoSummaryFailed,
    handleContextWarningLow,
    handleSessionSaved,
  };
}

/**
 * Register event handlers with context actions
 * 
 * @param contextActions - Context actions to register handlers with
 * @param handlers - Event handlers to register
 * @returns Cleanup function to unregister handlers
 */
export function registerContextEventHandlers(
  contextActions: EventHandlerDependencies['contextActions'],
  handlers: ReturnType<typeof createContextEventHandlers>
): () => void {
  // Register handlers
  contextActions.on?.('memory-warning', handlers.handleMemoryWarning);
  contextActions.on?.('compressed', handlers.handleCompressed);
  contextActions.on?.('summarizing', handlers.handleSummarizing);
  contextActions.on?.('auto-summary-created', handlers.handleAutoSummary);
  contextActions.on?.('auto-summary-failed', handlers.handleAutoSummaryFailed);
  contextActions.on?.('context-warning-low', handlers.handleContextWarningLow);

  // Return cleanup function
  return () => {
    contextActions.off?.('memory-warning', handlers.handleMemoryWarning);
    contextActions.off?.('compressed', handlers.handleCompressed);
    contextActions.off?.('summarizing', handlers.handleSummarizing);
    contextActions.off?.('auto-summary-created', handlers.handleAutoSummary);
    contextActions.off?.('auto-summary-failed', handlers.handleAutoSummaryFailed);
    contextActions.off?.('context-warning-low', handlers.handleContextWarningLow);
  };
}
