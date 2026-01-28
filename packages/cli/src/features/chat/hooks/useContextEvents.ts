/**
 * Hook for handling context manager events (compression, warnings, etc.)
 */

import { useEffect, useRef } from 'react';

import { SettingsService } from '../../../config/settingsService.js';

import type { Message } from '../types.js';
import type { ContextMessage } from '@ollm/core';

export interface UseContextEventsProps {
  contextActions: any; // ContextManagerActions type
  contextUsagePercentage: number;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  setStatusMessage: (message: string | undefined) => void;
}

export interface UseContextEventsReturn {
  compressionOccurred: boolean;
  compressionRetryCount: number;
  waitingForResume: boolean;
  resetCompressionFlags: () => void;
  setWaitingForResume: (waiting: boolean) => void;
}

/**
 * Manages context manager event listeners and compression state
 */
export function useContextEvents({
  contextActions,
  contextUsagePercentage,
  addMessage,
  setStatusMessage,
}: UseContextEventsProps): UseContextEventsReturn {
  const compressionOccurredRef = useRef(false);
  const compressionRetryCountRef = useRef(0);
  const waitingForResumeRef = useRef(false);

  useEffect(() => {
    if (!contextActions) return;

    /**
     * Handle memory warning event
     */
    const handleMemoryWarning = async (_data: unknown) => {
      try {
        const usage = contextActions.getUsage();
        const cfg = contextActions.getConfig?.();
        const threshold = cfg?.compression?.threshold
          ? Math.round(cfg.compression.threshold * 100)
          : Math.round(contextUsagePercentage);

        addMessage({
          role: 'system',
          content: `Warning: context usage at ${Math.round(usage.percentage)}%. Compression enabled at ${threshold}%`,
          excludeFromContext: true,
        });
      } catch (_err) {
        // ignore
      }
    };

    /**
     * Handle compression complete event
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
        // ignore
      }
    };

    /**
     * Handle summarization start event
     */
    const handleSummarizing = (_data: unknown) => {
      // Show immediate sticky status
      setStatusMessage('Summarizing conversation history...');

      // Auto-clear after 5 seconds if summarization is slow
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 5000);
    };

    /**
     * Handle auto-summary creation event
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
              excludeFromContext: true,
            });
          }
        } catch (_e) {
          // ignore
        }
      } catch (_err) {
        // ignore
      }
    };

    /**
     * Handle auto-summary failure event
     */
    const handleAutoSummaryFailed = async (data: unknown) => {
      // Clear sticky status
      setStatusMessage(undefined);

      try {
        const typedData = data as { error?: unknown; reason?: unknown };
        const err = typedData?.error || typedData?.reason || 'Summarization failed';
        const message =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: unknown }).message)
              : JSON.stringify(err);

        addMessage({
          role: 'system',
          content: `Summarization failed: ${message}`,
          excludeFromContext: true,
        });
      } catch (_e) {
        // ignore
      }
    };

    // Register event listeners
    contextActions.on?.('memory-warning', handleMemoryWarning);
    contextActions.on?.('compressed', handleCompressed);
    contextActions.on?.('summarizing', handleSummarizing);
    contextActions.on?.('auto-summary-created', handleAutoSummary);
    contextActions.on?.('auto-summary-failed', handleAutoSummaryFailed);

    // Cleanup listeners on unmount
    return () => {
      contextActions.off?.('memory-warning', handleMemoryWarning);
      contextActions.off?.('compressed', handleCompressed);
      contextActions.off?.('summarizing', handleSummarizing);
      contextActions.off?.('auto-summary-created', handleAutoSummary);
      contextActions.off?.('auto-summary-failed', handleAutoSummaryFailed);
    };
  }, [contextActions, contextUsagePercentage, addMessage, setStatusMessage]);

  return {
    compressionOccurred: compressionOccurredRef.current,
    compressionRetryCount: compressionRetryCountRef.current,
    waitingForResume: waitingForResumeRef.current,
    resetCompressionFlags: () => {
      compressionOccurredRef.current = false;
      compressionRetryCountRef.current = 0;
    },
    setWaitingForResume: (waiting: boolean) => {
      waitingForResumeRef.current = waiting;
    },
  };
}
