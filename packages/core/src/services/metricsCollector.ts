/**
 * Service for collecting and aggregating inference performance metrics
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 24.1, 24.2, 24.3, 24.4, 24.5
 */

import type { InferenceMetrics, SessionStats } from '../types/metrics.js';

/**
 * Provider metadata from inference response
 */
export interface ProviderMetadata {
  promptTokens: number;
  completionTokens: number;
  totalDuration: number; // Nanoseconds
  promptDuration: number; // Nanoseconds
  evalDuration: number; // Nanoseconds
  loadDuration?: number; // Nanoseconds
}

/**
 * Collects and aggregates performance metrics for inference generations
 */
export class MetricsCollector {
  private sessionStats: SessionStats;
  private currentGeneration: {
    startTime: number;
    firstTokenTime: number | null;
  } | null = null;

  constructor() {
    this.sessionStats = {
      totalGenerations: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTime: 0,
      averageSpeed: 0,
      fastestSpeed: 0,
      slowestSpeed: Infinity,
      averageTTFT: 0,
    };
  }

  /**
   * Start tracking a new generation
   */
  startGeneration(): void {
    this.currentGeneration = {
      startTime: Date.now(),
      firstTokenTime: null,
    };
  }

  /**
   * Record the time when the first token is received
   */
  recordFirstToken(): void {
    if (this.currentGeneration && this.currentGeneration.firstTokenTime === null) {
      this.currentGeneration.firstTokenTime = Date.now();
    }
  }

  /**
   * Record completion and calculate metrics
   * @param metadata Provider metadata from the response
   * @returns Calculated inference metrics
   */
  recordCompletion(metadata: ProviderMetadata): InferenceMetrics {
    if (!this.currentGeneration) {
      throw new Error('No generation in progress');
    }

    const totalSeconds = metadata.totalDuration / 1_000_000_000; // Convert nanoseconds to seconds

    // Calculate time to first token
    let timeToFirstToken = 0;
    if (this.currentGeneration.firstTokenTime !== null) {
      timeToFirstToken =
        (this.currentGeneration.firstTokenTime - this.currentGeneration.startTime) / 1000;
    }

    // Calculate tokens per second
    const tokensPerSecond = totalSeconds > 0 ? metadata.completionTokens / totalSeconds : 0;

    const metrics: InferenceMetrics = {
      promptTokens: metadata.promptTokens,
      completionTokens: metadata.completionTokens,
      totalDuration: metadata.totalDuration,
      promptDuration: metadata.promptDuration,
      evalDuration: metadata.evalDuration,
      tokensPerSecond,
      timeToFirstToken,
      totalSeconds,
      loadDuration: metadata.loadDuration,
    };

    // Update session stats
    this.updateSessionStats(metrics);

    // Reset current generation
    this.currentGeneration = null;

    return metrics;
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Reset session statistics
   */
  resetStats(): void {
    this.sessionStats = {
      totalGenerations: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTime: 0,
      averageSpeed: 0,
      fastestSpeed: 0,
      slowestSpeed: Infinity,
      averageTTFT: 0,
    };
    this.currentGeneration = null;
  }

  /**
   * Update session statistics with new metrics
   */
  private updateSessionStats(metrics: InferenceMetrics): void {
    this.sessionStats.totalGenerations++;
    this.sessionStats.totalTokens += metrics.promptTokens + metrics.completionTokens;
    this.sessionStats.totalPromptTokens += metrics.promptTokens;
    this.sessionStats.totalCompletionTokens += metrics.completionTokens;
    this.sessionStats.totalTime += metrics.totalSeconds;

    // Update speed statistics
    if (metrics.tokensPerSecond > this.sessionStats.fastestSpeed) {
      this.sessionStats.fastestSpeed = metrics.tokensPerSecond;
    }
    if (metrics.tokensPerSecond < this.sessionStats.slowestSpeed) {
      this.sessionStats.slowestSpeed = metrics.tokensPerSecond;
    }

    // Calculate average speed
    this.sessionStats.averageSpeed =
      this.sessionStats.totalTime > 0
        ? this.sessionStats.totalCompletionTokens / this.sessionStats.totalTime
        : 0;

    // Calculate average TTFT
    if (metrics.timeToFirstToken > 0) {
      const previousTotal =
        this.sessionStats.averageTTFT * (this.sessionStats.totalGenerations - 1);
      this.sessionStats.averageTTFT =
        (previousTotal + metrics.timeToFirstToken) / this.sessionStats.totalGenerations;
    }
  }
}
