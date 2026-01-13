/**
 * Performance metrics types for tracking inference performance
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

/**
 * Metrics for a single inference generation
 */
export interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;
  completionTokens: number;
  totalDuration: number; // Nanoseconds
  promptDuration: number; // Nanoseconds
  evalDuration: number; // Nanoseconds

  // Calculated values
  tokensPerSecond: number;
  timeToFirstToken: number; // Seconds
  totalSeconds: number;

  // Optional
  loadDuration?: number;
}

/**
 * Aggregated statistics for a session
 */
export interface SessionStats {
  totalGenerations: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTime: number;
  averageSpeed: number;
  fastestSpeed: number;
  slowestSpeed: number;
  averageTTFT: number;
}

/**
 * Configuration for metrics display
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5
 */
export interface MetricsConfig {
  enabled: boolean;
  compactMode: boolean;
  showPromptTokens: boolean;
  showTTFT: boolean;
  showInStatusBar: boolean;
}
