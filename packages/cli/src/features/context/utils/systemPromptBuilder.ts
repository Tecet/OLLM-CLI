/**
 * System Prompt Builder Utility
 *
 * Builds the final system prompt for LLM requests.
 * Handles reasoning model simplification, tool support notes, and focused files injection.
 *
 * Extracted from ChatContext.tsx for better separation of concerns.
 *
 * TODO: This logic should eventually be moved to core PromptOrchestrator.
 * The reasoning model simplification and tool support notes should be handled
 * by the core prompt building system, not in the CLI layer. This is a temporary
 * solution to reduce ChatContext.tsx size.
 *
 * Proper architecture:
 * - PromptOrchestrator (core) should handle reasoning model detection
 * - PromptOrchestrator should handle tool support notes
 * - ChatContext should only add CLI-specific things (focused files)
 */

import { stripSection } from './promptUtils.js';

import type { LLMProfile } from '../../../config/types.js';

export interface BuildSystemPromptOptions {
  /** Base system prompt from context manager */
  basePrompt: string;

  /** Tier-specific prompt template */
  tierPrompt: string;

  /** Model profile for reasoning detection */
  modelProfile: LLMProfile | undefined;

  /** Whether the model supports tools */
  supportsTools: boolean;

  /** Focused files injection function */
  injectFocusedFiles: (prompt: string) => string;
}

/**
 * Build the final system prompt for LLM requests
 *
 * @param options - Prompt building options
 * @returns Final system prompt ready to send to LLM
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const { basePrompt, tierPrompt, supportsTools, injectFocusedFiles } = options;

  let systemPrompt = basePrompt;

  const toolNote = supportsTools
    ? ''
    : 'Note: This model does not support function calling. Do not attempt to use tools or make tool calls.';

  const rulesOnly = stripSection(stripSection(systemPrompt, tierPrompt), toolNote);

  systemPrompt = [tierPrompt, rulesOnly, toolNote].filter(Boolean).join('\n\n');

  // Inject focused files into system prompt (CLI-specific feature)
  systemPrompt = injectFocusedFiles(systemPrompt);

  return systemPrompt;
}
