/**
 * ContextMenu Component
 *
 * Responsibilities:
 * - Build context size menu options
 * - Build model selection menu options
 * - Handle menu navigation
 * - Filter context sizes by model capabilities and VRAM
 *
 * Does NOT:
 * - Calculate context sizes (core does this)
 * - Validate VRAM (core does this)
 * - Persist settings (SettingsService does this)
 */

import { useCallback } from 'react';

import { CONTEXT_OPTIONS } from '../../../features/context/SystemMessages.js';
import { profileManager } from '../../../features/profiles/ProfileManager.js';

import type { MenuOption, Message } from '../../../features/context/ChatContext.js';

export interface ContextMenuOptions {
  currentModel: string;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  activateMenu: (options: MenuOption[], messageId?: string) => void;
  requestManualContextInput: (
    modelName: string,
    callback: (value: number) => Promise<void>
  ) => void;
  contextActions: {
    resize: (size: number) => Promise<void>;
  };
  setCurrentModel: (model: string) => void;
  availableVRAM?: number; // Total VRAM capacity in GB (not free VRAM - models will be swapped)
}

export interface ContextSizeOption {
  value: number;
  label: string;
}

/**
 * Hook to create context menu builder
 */
export function useContextMenu(options: ContextMenuOptions) {
  const {
    currentModel,
    addMessage,
    activateMenu,
    requestManualContextInput,
    contextActions,
    setCurrentModel,
    availableVRAM = 8, // Default to 8GB if not provided (total VRAM, not free)
  } = options;

  /**
   * Filter context sizes based on model capabilities and total VRAM
   * Uses total VRAM because old model will be unloaded when switching
   */
  const filterContextSizes = useCallback(
    (
      contextProfiles: Array<
        | { size: number; size_label?: string; vram_estimate_gb?: number }
        | { value: number; label: string }
      >,
      modelProfile: any
    ) => {
      const maxContextWindow = modelProfile?.max_context_window || 131072;
      const vramLimit = availableVRAM * 1.3; // Allow 30% overhead for CPU offloading

      return contextProfiles.filter((profile) => {
        // Get size from either format
        const size = 'size' in profile ? profile.size : profile.value;

        // Filter by model's max context window
        if (size > maxContextWindow) {
          return false;
        }

        // Filter by VRAM requirements (only if vram_estimate_gb exists)
        if ('vram_estimate_gb' in profile && profile.vram_estimate_gb) {
          if (profile.vram_estimate_gb > vramLimit) {
            return false;
          }
        }

        return true;
      });
    },
    [availableVRAM]
  );

  /**
   * Build context size submenu
   */
  const buildContextSizeMenu = useCallback(
    (
      mainMenuOptions: MenuOption[],
      menuMessageId?: string,
      returnToModelSelection?: boolean
    ): MenuOption[] => {
      const modelName = currentModel || 'Unknown Model';
      const profile = profileManager.findProfile(modelName);
      const optionsToUse = profile ? profile.context_profiles : CONTEXT_OPTIONS;

      // Filter context sizes
      const filteredOptions = filterContextSizes(optionsToUse, profile);

      // Check if no options available
      if (filteredOptions.length === 0) {
        const minContext = optionsToUse[0];
        const minVRAM =
          minContext && 'vram_estimate_gb' in minContext
            ? (minContext as any).vram_estimate_gb
            : 2.5;

        addMessage({
          role: 'system',
          content: `⚠️ **Insufficient VRAM for this model**\n\nMinimum requirements:\n- 4k context: ${minVRAM} GB VRAM\n\nYour total VRAM: ${availableVRAM.toFixed(1)} GB\n\nPlease select a different model or upgrade your hardware.`,
          excludeFromContext: true,
        });

        // Return to model selection or main menu
        const backOptions: MenuOption[] = [
          {
            id: 'opt-back',
            label: 'Back',
            action: () => {
              if (returnToModelSelection) {
                const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
                activateMenu(modelOptions, menuMessageId);
              } else {
                activateMenu(mainMenuOptions, menuMessageId);
              }
            },
          },
          {
            id: 'opt-exit',
            label: 'Exit to Chat',
            action: async () => {},
          },
        ];

        return backOptions;
      }

      const sizeOptions: MenuOption[] = [];

      filteredOptions.forEach((opt) => {
        const val =
          'size' in opt ? (opt as { size: number }).size : (opt as { value: number }).value;
        const sizeStr =
          'size_label' in opt && opt.size_label
            ? opt.size_label
            : val >= 1024
              ? `${val / 1024}k`
              : `${val}`;

        // Add VRAM estimate to label (only if available)
        const vramEstimate =
          'vram_estimate_gb' in opt ? (opt as any).vram_estimate_gb : undefined;
        const label = vramEstimate ? `${sizeStr} (${vramEstimate.toFixed(1)} GB)` : sizeStr;

        sizeOptions.push({
          id: `size-${val}`,
          label,
          value: val,
          action: async () => {
            await contextActions.resize(val);
            addMessage({
              role: 'system',
              content: `Context size updated to **${sizeStr}** (${val} tokens).`,
              excludeFromContext: true,
            });
            activateMenu(mainMenuOptions, menuMessageId);
          },
        });
      });

      // Manual input option
      sizeOptions.push({
        id: 'size-manual',
        label: 'Manual...',
        action: async () => {
          addMessage({
            role: 'system',
            content: 'Enter a manual context size in tokens. Type "cancel" to abort.',
            excludeFromContext: true,
          });
          requestManualContextInput(modelName, async (value) => {
            profileManager.setManualContext(modelName, value);
            await contextActions.resize(value);
            addMessage({
              role: 'system',
              content: `Manual context size set to **${value}** tokens.`,
              excludeFromContext: true,
            });
            activateMenu(mainMenuOptions, menuMessageId);
          });
        },
      });

      // Navigation options
      sizeOptions.push({
        id: 'opt-back',
        label: 'Back',
        action: () => {
          if (returnToModelSelection) {
            const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
            activateMenu(modelOptions, menuMessageId);
          } else {
            activateMenu(mainMenuOptions, menuMessageId);
          }
        },
      });

      sizeOptions.push({
        id: 'opt-exit',
        label: 'Exit to Chat',
        action: async () => {},
      });

      return sizeOptions;
    },
    [
      currentModel,
      addMessage,
      activateMenu,
      requestManualContextInput,
      contextActions,
      availableVRAM,
      filterContextSizes,
    ]
  );

  /**
   * Build model selection submenu
   * After selecting a model, automatically show context size selection
   * Model is NOT loaded until context size is selected
   */
  const buildModelSelectionMenu = useCallback(
    (mainMenuOptions: MenuOption[], menuMessageId?: string): MenuOption[] => {
      const userModels = profileManager
        .getUserModels()
        .slice()
        .sort((a, b) => {
          const aLabel = (a.name || a.id).toLowerCase();
          const bLabel = (b.name || b.id).toLowerCase();
          return aLabel.localeCompare(bLabel);
        });

      if (userModels.length === 0) {
        addMessage({
          role: 'system',
          content: 'No models found. Please pull a model first using `/model pull <model-name>`.',
          excludeFromContext: true,
        });
        return [];
      }

      const modelOptions: MenuOption[] = userModels.map((entry) => {
        const modelLabel = entry.name || entry.id;
        return {
          id: `model-${entry.id}`,
          label: modelLabel,
          action: async () => {
            // DON'T call setCurrentModel yet - wait for context size selection
            addMessage({
              role: 'system',
              content: `Selected model **${modelLabel}**.\n\nPlease select a context size:`,
              excludeFromContext: true,
            });

            // Show context size selection with the selected model ID
            const sizeOptions = buildContextSizeMenuForModel(
              entry.id,
              modelLabel,
              mainMenuOptions,
              menuMessageId
            );
            activateMenu(sizeOptions, menuMessageId);
          },
        };
      });

      // Navigation options
      modelOptions.push({
        id: 'opt-back',
        label: 'Back',
        action: () => activateMenu(mainMenuOptions, menuMessageId),
      });

      modelOptions.push({
        id: 'opt-exit',
        label: 'Exit to Chat',
        action: async () => {},
      });

      return modelOptions;
    },
    [addMessage, activateMenu]
  );

  /**
   * Build context size menu for a specific model
   * This is called after model selection, before loading the model
   */
  const buildContextSizeMenuForModel = useCallback(
    (
      modelId: string,
      modelLabel: string,
      mainMenuOptions: MenuOption[],
      menuMessageId?: string
    ): MenuOption[] => {
      const profile = profileManager.findProfile(modelId);
      const optionsToUse = profile ? profile.context_profiles : CONTEXT_OPTIONS;

      // Filter context sizes
      const filteredOptions = filterContextSizes(optionsToUse, profile);

      // Check if no options available
      if (filteredOptions.length === 0) {
        const minContext = optionsToUse[0];
        const minVRAM =
          minContext && 'vram_estimate_gb' in minContext
            ? (minContext as any).vram_estimate_gb
            : 2.5;

        addMessage({
          role: 'system',
          content: `⚠️ **Insufficient VRAM for this model**\n\nMinimum requirements:\n- 4k context: ${minVRAM} GB VRAM\n\nYour total VRAM: ${availableVRAM.toFixed(1)} GB\n\nPlease select a different model or upgrade your hardware.`,
          excludeFromContext: true,
        });

        // Return to model selection
        const backOptions: MenuOption[] = [
          {
            id: 'opt-back',
            label: 'Back',
            action: () => {
              const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
              activateMenu(modelOptions, menuMessageId);
            },
          },
          {
            id: 'opt-exit',
            label: 'Exit to Chat',
            action: async () => {},
          },
        ];

        return backOptions;
      }

      const sizeOptions: MenuOption[] = [];

      filteredOptions.forEach((opt) => {
        const val =
          'size' in opt ? (opt as { size: number }).size : (opt as { value: number }).value;
        const sizeStr =
          'size_label' in opt && opt.size_label
            ? opt.size_label
            : val >= 1024
              ? `${val / 1024}k`
              : `${val}`;

        // Add VRAM estimate to label (only if available)
        const vramEstimate =
          'vram_estimate_gb' in opt ? (opt as any).vram_estimate_gb : undefined;
        const label = vramEstimate ? `${sizeStr} (${vramEstimate.toFixed(1)} GB)` : sizeStr;

        sizeOptions.push({
          id: `size-${val}`,
          label,
          value: val,
          action: async () => {
            // Check if VRAM usage is above 80% threshold
            const vramUsagePercent = vramEstimate ? (vramEstimate / availableVRAM) * 100 : 0;
            const isHighVRAMUsage = vramUsagePercent > 80;

            // Store the pending context size in SessionManager
            // This will be used when the new session is created
            try {
              const { getSessionManager } = await import('../../../features/context/SessionManager.js');
              const sessionManager = getSessionManager();
              sessionManager.setPendingContextSize(val);
            } catch (error) {
              console.warn('[ContextMenu] Failed to set pending context size:', error);
            }

            // Now swap to the new model
            // This will create a new session and use the pending context size
            setCurrentModel(modelId);

            // Build message with optional warning
            let message = `Switched to **${modelLabel}** with **${sizeStr}** context (${val} tokens).`;

            if (isHighVRAMUsage && vramEstimate) {
              message += `\n\n⚠️ **Performance Warning**: VRAM usage is high (${vramUsagePercent.toFixed(0)}% - ${vramEstimate.toFixed(1)} GB / ${availableVRAM.toFixed(1)} GB). Model may be partially offloaded to CPU, reducing performance.`;
            }

            addMessage({
              role: 'system',
              content: message,
              excludeFromContext: true,
            });
            activateMenu(mainMenuOptions, menuMessageId);
          },
        });
      });

      // Manual input option
      sizeOptions.push({
        id: 'size-manual',
        label: 'Manual...',
        action: async () => {
          addMessage({
            role: 'system',
            content: 'Enter a manual context size in tokens. Type "cancel" to abort.',
            excludeFromContext: true,
          });
          requestManualContextInput(modelId, async (value) => {
            profileManager.setManualContext(modelId, value);
            
            // Store the pending context size in SessionManager
            try {
              const { getSessionManager } = await import('../../../features/context/SessionManager.js');
              const sessionManager = getSessionManager();
              sessionManager.setPendingContextSize(value);
            } catch (error) {
              console.warn('[ContextMenu] Failed to set pending context size:', error);
            }
            
            // Now swap to the new model
            setCurrentModel(modelId);
            
            addMessage({
              role: 'system',
              content: `Switched to **${modelLabel}** with manual context size **${value}** tokens.`,
              excludeFromContext: true,
            });
            activateMenu(mainMenuOptions, menuMessageId);
          });
        },
      });

      // Navigation options
      sizeOptions.push({
        id: 'opt-back',
        label: 'Back',
        action: () => {
          const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
          activateMenu(modelOptions, menuMessageId);
        },
      });

      sizeOptions.push({
        id: 'opt-exit',
        label: 'Exit to Chat',
        action: async () => {},
      });

      return sizeOptions;
    },
    [
      addMessage,
      activateMenu,
      requestManualContextInput,
      contextActions,
      availableVRAM,
      filterContextSizes,
      setCurrentModel,
      buildModelSelectionMenu,
    ]
  );

  /**
   * Build main context menu
   */
  const buildMainMenu = useCallback(
    (menuMessageId?: string): MenuOption[] => {
      const mainMenuOptions: MenuOption[] = [
        {
          id: 'opt-context',
          label: 'Change Context Size',
          action: () => {
            const sizeOptions = buildContextSizeMenu(mainMenuOptions, menuMessageId);
            activateMenu(sizeOptions, menuMessageId);
          },
        },
        {
          id: 'opt-model',
          label: 'Change Model',
          action: () => {
            const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
            if (modelOptions.length > 0) {
              activateMenu(modelOptions, menuMessageId);
            }
          },
        },
        {
          id: 'opt-exit',
          label: 'Exit to Chat',
          action: async () => {},
        },
      ];

      return mainMenuOptions;
    },
    [buildContextSizeMenu, buildModelSelectionMenu, activateMenu]
  );

  /**
   * Open the context menu
   */
  const openContextMenu = useCallback(
    (messageId?: string) => {
      const mainMenu = buildMainMenu(messageId);
      activateMenu(mainMenu, messageId);
    },
    [buildMainMenu, activateMenu]
  );

  return {
    openContextMenu,
    buildMainMenu,
    buildContextSizeMenu,
    buildModelSelectionMenu,
  };
}

