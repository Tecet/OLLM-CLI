/**
 * Model Comparison Commands
 *
 * Implements commands for comparing model outputs:
 * - /compare "<prompt>" <model1> <model2> [model3] - Compare models
 */

import { ComparisonService } from '@ollm/core';

import type { Command, CommandResult } from './types.js';
import type { ProviderAdapter } from '@ollm/core';

/**
 * /compare "<prompt>" <model1> <model2> [model3] - Compare models
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3
 */
export const compareCommand: Command = {
  name: '/compare',
  description: 'Compare outputs from multiple models',
  usage: '/compare "<prompt>" <model1> <model2> [model3...]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length < 3) {
      return {
        success: false,
        message:
          'Usage: /compare "<prompt>" <model1> <model2> [model3...]\n\n' +
          'Example: /compare "Explain recursion" llama3.1:8b mistral:7b',
      };
    }

    const prompt = args[0];
    const models = args.slice(1);

    if (models.length < 2) {
      return {
        success: false,
        message: 'At least 2 models are required for comparison',
      };
    }

    try {
      // Create service instance
      // TODO: This should be injected via dependency injection
      const service = new ComparisonService({} as ProviderAdapter);

      // Run comparison
      const result = await service.compare(prompt, models);

      // Format results
      const resultLines: string[] = [
        `Comparison Results (${result.timestamp.toLocaleString()})`,
        `Prompt: ${prompt}`,
        '',
      ];

      for (const modelResult of result.results) {
        resultLines.push(`--- ${modelResult.model} ---`);

        if (modelResult.error) {
          resultLines.push(`Error: ${modelResult.error}`);
        } else {
          resultLines.push(`Response: ${modelResult.response}`);
          resultLines.push(`Tokens: ${modelResult.tokenCount}`);
          resultLines.push(`Latency: ${modelResult.latencyMs}ms`);
          resultLines.push(`Speed: ${modelResult.tokensPerSecond.toFixed(2)} tokens/sec`);
        }

        resultLines.push('');
      }

      return {
        success: true,
        message: resultLines.join('\n'),
        data: { result },
      };
    } catch (error) {
      return {
        success: false,
        message: `Comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * All comparison-related commands
 */
export const comparisonCommands: Command[] = [compareCommand];

/**
 * Create comparison commands with service container dependency injection
 */
export function createComparisonCommands(_container: unknown): Command[] {
  // TODO: Implement with service container
  return comparisonCommands;
}

// Keep original export for backwards compatibility
// Export is already defined above as comparisonCommands
