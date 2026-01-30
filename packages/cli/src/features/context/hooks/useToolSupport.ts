/**
 * Tool Support Management Hook
 *
 * Manages tool support detection, overrides, and metadata persistence for models.
 * Handles runtime detection, user confirmation, and session-based overrides.
 */

import { useCallback, useRef } from 'react';

import { profileManager } from '../../profiles/ProfileManager.js';

import type { ProviderAdapter, ToolSchema } from '@ollm/core';

// Session overrides expire after 1 hour
const SESSION_OVERRIDE_TTL = 60 * 60 * 1000;

// Debounce repeated error prompts (60 seconds)
const ERROR_PROMPT_DEBOUNCE_MS = 60000;

/**
 * Tool support override metadata
 */
interface ToolSupportOverride {
  supported: boolean;
  source: 'user_confirmed' | 'session';
  timestamp: number;
  expiresAt?: number; // For session overrides only
}

/**
 * Tool support management hook
 */
export function useToolSupport(
  provider: ProviderAdapter,
  promptUser: (message: string, options: string[]) => Promise<string>,
  addSystemMessage: (message: string) => void
) {
  // Simplified tool support override tracking (2 levels: user_confirmed vs session)
  const toolSupportOverridesRef = useRef<Map<string, ToolSupportOverride>>(new Map());

  // Track recent error prompts to debounce repeated errors
  const recentErrorPromptsRef = useRef<Map<string, number>>(new Map());

  /**
   * Save tool support metadata to user_models.json
   * Updates both the runtime override and persists to the user models file
   * @param model - The model ID
   * @param supported - Whether the model supports tools
   * @param permanent - Whether to save permanently (user_confirmed) or session-only
   */
  const saveToolSupport = useCallback(
    async (model: string, supported: boolean, permanent: boolean = false) => {
      // Update runtime override
      const override: ToolSupportOverride = {
        supported,
        source: permanent ? 'user_confirmed' : 'session',
        timestamp: Date.now(),
        expiresAt: permanent ? undefined : Date.now() + SESSION_OVERRIDE_TTL,
      };

      toolSupportOverridesRef.current.set(model, override);

      // Only persist to user_models.json if permanent
      if (permanent) {
        const userModels = profileManager.getUserModels();
        const existing = userModels.find((m) => m.id === model);

        if (existing) {
          existing.tool_support = supported;
          existing.tool_support_source = 'user_confirmed';
          existing.tool_support_confirmed_at = new Date().toISOString();
        } else {
          // Create new entry for unknown model
          userModels.push({
            id: model,
            name: model,
            source: 'ollama',
            last_seen: new Date().toISOString(),
            tool_support: supported,
            tool_support_source: 'user_confirmed',
            tool_support_confirmed_at: new Date().toISOString(),
            description: 'Custom model',
            abilities: [],
            context_profiles: [],
            default_context: 4096,
          });
        }

        profileManager.setUserModels(userModels);
      }
    },
    []
  );

  /**
   * Get tool support override for a model, checking for expiration
   * @param model - The model ID
   * @returns Tool support status, or undefined if no override exists
   */
  const getToolSupportOverride = useCallback((model: string): boolean | undefined => {
    const override = toolSupportOverridesRef.current.get(model);

    if (!override) {
      return undefined;
    }

    // Check expiration for session overrides
    if (override.source === 'session' && override.expiresAt) {
      if (Date.now() > override.expiresAt) {
        // Expired, remove it
        toolSupportOverridesRef.current.delete(model);
        return undefined;
      }
    }

    return override.supported;
  }, []);

  /**
   * Check if an error message indicates tool unsupported error
   * Checks structured error code first, then falls back to pattern matching
   * @param message - The error message to check
   * @param code - Optional structured error code
   * @returns True if the message indicates tools are not supported
   */
  const isToolUnsupportedError = useCallback((message: string, code?: string): boolean => {
    // Check structured code first (most reliable)
    if (code === 'TOOL_UNSUPPORTED') {
      return true;
    }

    // Fall back to pattern matching for compatibility
    const patterns = [
      /tools?.*not supported/i,
      /tool_calls?.*not supported/i,
      /unknown field.*tools?/i,
      /function calling.*not supported/i,
      /model does not support.*tools?/i,
      /tools?.*not available/i,
      /tools?.*disabled/i,
    ];

    return patterns.some((pattern) => pattern.test(message));
  }, []);

  /**
   * Handle tool errors detected at runtime
   * Prompts user for confirmation before persisting metadata
   * Debounces repeated errors to avoid multiple prompts
   */
  const handleToolError = useCallback(
    async (model: string, errorMessage: string, errorCode?: string) => {
      // Check if this is actually a tool unsupported error
      if (!isToolUnsupportedError(errorMessage, errorCode)) {
        return;
      }

      // Check if we already have a user_confirmed override - don't override user choice
      const existing = toolSupportOverridesRef.current.get(model);
      if (existing?.source === 'user_confirmed') {
        return;
      }

      // Debounce: Check if we've recently prompted for this model
      const lastPromptTime = recentErrorPromptsRef.current.get(model);
      const now = Date.now();
      if (lastPromptTime && now - lastPromptTime < ERROR_PROMPT_DEBOUNCE_MS) {
        // Too soon since last prompt, skip
        return;
      }

      // Record that we're prompting now
      recentErrorPromptsRef.current.set(model, now);

      // Prompt user for confirmation with model name in context
      addSystemMessage(`Tool error detected for model "${model}": ${errorMessage}`);

      const response = await promptUser(
        `Model "${model}" appears to not support tools. Save this permanently?`,
        ['Yes (Permanent)', 'No (Session Only)', 'Cancel']
      );

      if (response === 'Yes (Permanent)') {
        // Save permanently to user_models.json
        await saveToolSupport(model, false, true);
        addSystemMessage(`Tool support disabled for "${model}" and saved permanently.`);
      } else if (response === 'No (Session Only)') {
        // Set session-only override (expires in 1 hour)
        await saveToolSupport(model, false, false);
        addSystemMessage(
          `Tool support disabled for "${model}" for this session only (expires in 1 hour).`
        );
      } else {
        // Cancel - don't set any override
        addSystemMessage(`Tool support setting not changed for "${model}".`);
      }
    },
    [isToolUnsupportedError, saveToolSupport, promptUser, addSystemMessage]
  );

  /**
   * Auto-detect tool support by sending a test request with minimal tool schema
   * Sends a test message with a minimal tool to check if the model supports function calling
   * @param model - The model ID to test
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const autoDetectToolSupport = useCallback(
    async (model: string): Promise<boolean> => {
      addSystemMessage(`Auto-detecting tool support for ${model}...`);

      // Create minimal test tool schema
      const testTools: ToolSchema[] = [
        {
          name: 'test_tool',
          description: 'Test tool for capability detection',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ];

      try {
        // Create abort controller with 5-second timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 5000);

        // Send test request with tools
        const stream = provider.chatStream({
          model,
          messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'test' }] }],
          tools: testTools,
          abortSignal: abortController.signal,
        });

        let hasToolError = false;
        let hasSuccess = false;

        // Check for tool errors in the response
        for await (const event of stream) {
          if (event.type === 'error') {
            const message = event.error.message || '';
            hasToolError = isToolUnsupportedError(message);
            break;
          }
          if (event.type === 'text' || event.type === 'tool_call' || event.type === 'finish') {
            hasSuccess = true;
            break;
          }
        }

        clearTimeout(timeoutId);

        // Determine tool support based on response
        const supported = hasSuccess && !hasToolError;

        // Save result permanently
        await saveToolSupport(model, supported, true);

        const status = supported ? 'Enabled' : 'Disabled';
        addSystemMessage(`Tool support detected: ${status} (saved permanently)`);

        return supported;
      } catch (error) {
        // Handle timeout or other errors
        if (error instanceof Error && error.name === 'AbortError') {
          addSystemMessage('Auto-detect timed out. Defaulting to tools disabled.');
        } else {
          addSystemMessage('Auto-detect failed. Defaulting to tools disabled.');
        }

        // Default to safe setting on error (session only)
        await saveToolSupport(model, false, false);
        return false;
      }
    },
    [provider, saveToolSupport, isToolUnsupportedError, addSystemMessage]
  );

  /**
   * Handle unknown model by prompting user for tool support information
   * Prompts the user to specify if the model supports tools, with options for manual
   * confirmation or auto-detection. Includes a 30-second timeout with safe default.
   * @param model - The unknown model ID
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const handleUnknownModel = useCallback(
    async (model: string): Promise<boolean> => {
      addSystemMessage(`Unknown model detected: ${model}`);

      // Set up 30-second timeout with safe default
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          addSystemMessage('No response received. Defaulting to tools disabled for safety.');
          resolve('No'); // Safe default
        }, 30000);
      });

      // Race between user response and timeout
      const responsePromise = promptUser(`Does "${model}" support function calling/tools?`, [
        'Yes',
        'No',
        'Auto-detect',
      ]);

      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (response === 'Yes') {
        await saveToolSupport(model, true, true);
        addSystemMessage('Tool support enabled and saved permanently.');
        return true;
      } else if (response === 'No') {
        await saveToolSupport(model, false, true);
        addSystemMessage('Tool support disabled and saved permanently.');
        return false;
      } else if (response === 'Auto-detect') {
        // Run auto-detection
        return await autoDetectToolSupport(model);
      } else {
        // Fallback for any other response (including timeout)
        addSystemMessage('Invalid response. Defaulting to tools disabled (session only).');
        await saveToolSupport(model, false, false);
        return false;
      }
    },
    [saveToolSupport, autoDetectToolSupport, promptUser, addSystemMessage]
  );

  /**
   * Check if a model supports tools based on overrides and profile metadata
   * Checks runtime overrides first (with expiration), then falls back to profile data
   * @param model - The model ID to check
   * @returns True if the model supports tools, false otherwise
   */
  const modelSupportsTools = useCallback(
    (model: string): boolean => {
      // Check for override (handles expiration automatically)
      const override = getToolSupportOverride(model);
      if (override !== undefined) {
        return override;
      }

      // Fall back to profile data (static profiles)
      const profile = profileManager.findProfile(model);

      // Check explicit tool_support flag
      if (profile && typeof profile.tool_support === 'boolean') {
        return profile.tool_support;
      }

      // Check capabilities object if present (as used in ContextManagerFactory)
      if (profile && (profile as any).capabilities?.tools === true) {
        return true;
      }

      // Default to FALSE for safety.
      // This prevents "hallucinated tool calls" on models that don't support them.
      // Users can enable tools via the "Auto-detect" or manual override features if needed.
      return false;
    },
    [getToolSupportOverride]
  );

  return {
    modelSupportsTools,
    handleToolError,
    autoDetectToolSupport,
    handleUnknownModel,
    saveToolSupport,
    isToolUnsupportedError,
  };
}
