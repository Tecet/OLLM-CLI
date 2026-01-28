/**
 * Model Warmup Management Hook
 *
 * Manages model warmup state, retry logic, and timeout handling.
 * Handles warmup configuration, progress tracking, and user skip functionality.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { SettingsService } from '../../../config/settingsService.js';
import { profileManager } from '../../profiles/ProfileManager.js';

import type { ProviderAdapter } from '@ollm/core';

/**
 * Warmup status details for UI display
 */
export interface WarmupStatus {
  active: boolean;
  attempt: number;
  elapsedMs: number;
}

/**
 * Model warmup management hook
 */
export function useModelWarmup(
  provider: ProviderAdapter,
  currentModel: string,
  modelLoading: boolean,
  setModelLoading: (loading: boolean) => void,
  addSystemMessage: (message: string) => void,
  isTimeoutError: (message: string) => boolean
) {
  const [warmupStatus, setWarmupStatus] = useState<WarmupStatus | null>(null);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const warmupModelRef = useRef<string | null>(null);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmupAttemptsRef = useRef<Map<string, number>>(new Map());
  const warmupStartRef = useRef<number | null>(null);

  /**
   * Clear warmup status
   */
  const clearWarmupStatus = useCallback(() => {
    setWarmupStatus(null);
    warmupStartRef.current = null;
  }, []);

  /**
   * Skip the current warmup process
   */
  const skipWarmup = useCallback(() => {
    if (warmupAbortRef.current) {
      warmupAbortRef.current.abort();
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    setModelLoading(false);
    setWarmupStatus(null);
    warmupStartRef.current = null;

    // Add system message
    addSystemMessage('Warmup skipped by user.');
  }, [setModelLoading, addSystemMessage]);

  /**
   * Warmup effect - runs when model loading state changes
   */
  useEffect(() => {
    if (!modelLoading || !currentModel) return;
    if (warmupModelRef.current === currentModel) return;

    // Check if warmup is enabled in settings
    const settingsService = SettingsService.getInstance();
    const settings = settingsService.getSettings();
    const warmupEnabled = settings.llm?.warmup?.enabled ?? true;

    if (!warmupEnabled) {
      // Warmup disabled, skip it
      setModelLoading(false);
      return;
    }

    if (warmupAbortRef.current) {
      warmupAbortRef.current.abort();
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }

    warmupModelRef.current = currentModel;
    warmupStartRef.current = Date.now();
    setWarmupStatus({
      active: true,
      attempt: 1,
      elapsedMs: 0,
    });
    const controller = new AbortController();
    warmupAbortRef.current = controller;
    const modelName = currentModel;

    // Get configuration
    const maxAttempts = settings.llm?.warmup?.maxAttempts ?? 3;
    const retryDelaysMs = [1000, 2000, 4000].slice(0, maxAttempts - 1);

    const scheduleRetry = () => {
      const previousAttempts = warmupAttemptsRef.current.get(modelName) ?? 0;
      const nextAttempts = previousAttempts + 1;
      warmupAttemptsRef.current.set(modelName, nextAttempts);
      const delay = retryDelaysMs[nextAttempts - 1];
      if (!delay) {
        setModelLoading(false);
        setWarmupStatus(null);
        warmupStartRef.current = null;
        return;
      }
      setWarmupStatus((current) => ({
        active: true,
        attempt: nextAttempts + 1,
        elapsedMs: current?.elapsedMs ?? 0,
      }));
      warmupTimerRef.current = setTimeout(() => {
        if (controller.signal.aborted) return;
        if (warmupModelRef.current !== modelName) return;
        void runWarmup();
      }, delay);
    };

    const runWarmup = async (): Promise<void> => {
      try {
        // Get model-specific timeout from profile or settings
        const profile = profileManager.findProfile(currentModel);
        const configTimeout = settings.llm?.warmup?.timeout ?? 30000;
        const warmupTimeout = profile?.warmup_timeout ?? configTimeout;

        const stream = provider.chatStream({
          model: currentModel,
          messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'warmup' }] }],
          abortSignal: controller.signal,
          timeout: warmupTimeout,
        });

        for await (const event of stream) {
          if (controller.signal.aborted) return;
          if (event.type === 'error') {
            const message = event.error.message || '';
            const isTimeout = isTimeoutError(message);
            if (isTimeout) {
              scheduleRetry();
              return;
            }
            setModelLoading(false);
            return;
          }

          setModelLoading(false);
          setWarmupStatus(null);
          warmupStartRef.current = null;
          warmupAttemptsRef.current.delete(modelName);
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        scheduleRetry();
      }
    };

    void runWarmup();
    return () => {
      if (warmupTimerRef.current) {
        clearTimeout(warmupTimerRef.current);
        warmupTimerRef.current = null;
      }
      setWarmupStatus(null);
      warmupStartRef.current = null;
      controller.abort();
    };
  }, [modelLoading, currentModel, provider, isTimeoutError, setModelLoading]);

  /**
   * Warmup status update effect - updates elapsed time
   */
  useEffect(() => {
    if (!warmupStatus?.active) return;
    const interval = setInterval(() => {
      const startedAt = warmupStartRef.current;
      if (!startedAt) return;
      setWarmupStatus((current) => {
        if (!current?.active) return current;
        return {
          ...current,
          elapsedMs: Date.now() - startedAt,
        };
      });
    }, 250);
    return () => clearInterval(interval);
  }, [warmupStatus?.active]);

  return {
    warmupStatus,
    skipWarmup,
    clearWarmupStatus,
  };
}
