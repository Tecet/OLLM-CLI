/**
 * Model Utilities
 *
 * Helper functions for working with model names and metadata.
 */

/**
 * Extract model size from model name
 * @param modelName - The model name (e.g., "llama3.2:3b")
 * @returns The model size in billions of parameters (default: 7)
 */
export function extractModelSize(modelName: string): number {
  if (!modelName || modelName === '') return 7; // Default to 7B if no model name
  const match = modelName.match(/(\d+\.?\d*)b/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 7; // Default to 7B
}
