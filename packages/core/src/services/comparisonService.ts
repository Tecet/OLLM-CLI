/**
 * Comparison Service
 * Runs prompts through multiple models for side-by-side evaluation.
 */

import type { TokenCounter } from '../context/types.js';
import type { ProviderAdapter, ProviderRequest } from '../provider/types.js';

/**
 * Result from a single model execution.
 */
export interface ModelResult {
  model: string;
  response: string;
  tokenCount: number;
  latencyMs: number;
  tokensPerSecond: number;
  error?: string;
}

/**
 * Complete comparison result with all model outputs.
 */
export interface ComparisonResult {
  prompt: string;
  results: ModelResult[];
  timestamp: Date;
}

/**
 * Comparison Service
 * Executes prompts through multiple models in parallel and collects results.
 */
export class ComparisonService {
  private abortController: AbortController | null = null;
  private tokenCounter?: TokenCounter;

  constructor(
    private provider: ProviderAdapter,
    tokenCounter?: TokenCounter
  ) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Set the token counter service
   */
  setTokenCounter(tokenCounter: TokenCounter): void {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Compare multiple models by running the same prompt through each.
   * Executes all models in parallel and handles individual failures gracefully.
   *
   * @param prompt The prompt to send to all models
   * @param models Array of model names to compare
   * @returns Comparison result with all model outputs
   */
  async compare(prompt: string, models: string[]): Promise<ComparisonResult> {
    // Create abort controller for cancellation support
    this.abortController = new AbortController();

    try {
      // Execute all models in parallel
      const resultPromises = models.map((model) =>
        this.executeModel(prompt, model, this.abortController!.signal)
      );

      const results = await Promise.all(resultPromises);

      return {
        prompt,
        results,
        timestamp: new Date(),
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel an in-progress comparison.
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Execute a single model and collect results.
   * Handles errors gracefully by returning a result with error field.
   *
   * @param prompt The prompt to send
   * @param model The model name
   * @param signal Abort signal for cancellation
   * @returns Model result with response or error
   */
  private async executeModel(
    prompt: string,
    model: string,
    signal: AbortSignal
  ): Promise<ModelResult> {
    const startTime = Date.now();
    let response = '';
    let tokenCount = 0;

    try {
      // Create request
      const request: ProviderRequest = {
        model,
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: prompt }],
          },
        ],
        abortSignal: signal,
      };

      // Stream response and collect text
      for await (const event of this.provider.chatStream(request)) {
        if (event.type === 'text') {
          response += event.value;
        } else if (event.type === 'error') {
          throw new Error(event.error.message);
        }
      }

      // Count tokens using TokenCounterService if available
      if (this.tokenCounter) {
        tokenCount = await this.tokenCounter.countTokens(response);
      } else {
        // Fallback: rough token estimation (~4 characters per token)
        tokenCount = Math.ceil(response.length / 4);
      }

      const latencyMs = Date.now() - startTime;
      const tokensPerSecond = latencyMs > 0 ? (tokenCount / latencyMs) * 1000 : 0;

      return {
        model,
        response,
        tokenCount,
        latencyMs,
        tokensPerSecond,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Return result with error instead of throwing
      return {
        model,
        response: '',
        tokenCount: 0,
        latencyMs,
        tokensPerSecond: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
