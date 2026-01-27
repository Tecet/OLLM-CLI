/**
 * ContextMenu Component
 * 
 * Responsibilities:
 * - Build context size menu options
 * - Build model selection menu options
 * - Handle menu navigation
 * 
 * Does NOT:
 * - Calculate context sizes (core does this)
 * - Validate VRAM (core does this)
 * - Persist settings (SettingsService does this)
 */

import { useCallback } from 'react';
import { profileManager } from '../../../features/profiles/ProfileManager.js';
import { CONTEXT_OPTIONS } from '../../../features/context/SystemMessages.js';
import type { MenuOption, Message } from '../../../features/context/ChatContext.js';

export interface ContextMenuOptions {
  currentModel: string;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  activateMenu: (options: MenuOption[], messageId?: string) => void;
  requestManualContextInput: (modelName: string, callback: (value: number) => Promise<void>) => void;
  contextActions: {
    resize: (size: number) => Promise<void>;
  };
  setCurrentModel: (model: string) => void;
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
  } = options;

  /**
   * Build context size submenu
   */
  const buildContextSizeMenu = useCallback((
    mainMenuOptions: MenuOption[],
    menuMessageId?: string
  ): MenuOption[] => {
    const modelName = currentModel || 'Unknown Model';
    const profile = profileManager.findProfile(modelName);
    const optionsToUse = profile ? profile.context_profiles : CONTEXT_OPTIONS;
    const sizeOptions: MenuOption[] = [];

    optionsToUse.forEach(opt => {
      const val = 'size' in opt ? (opt as {size: number}).size : (opt as {value: number}).value;
      const sizeStr = 'size_label' in opt && opt.size_label 
        ? opt.size_label 
        : val >= 1024 ? `${val / 1024}k` : `${val}`;

      sizeOptions.push({
        id: `size-${val}`,
        label: sizeStr,
        value: val,
        action: async () => {
          await contextActions.resize(val);
          addMessage({
            role: 'system',
            content: `Context size updated to **${sizeStr}** (${val} tokens).`,
            excludeFromContext: true
          });
          activateMenu(mainMenuOptions, menuMessageId);
        }
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
          excludeFromContext: true
        });
        requestManualContextInput(modelName, async (value) => {
          profileManager.setManualContext(modelName, value);
          await contextActions.resize(value);
          addMessage({
            role: 'system',
            content: `Manual context size set to **${value}** tokens.`,
            excludeFromContext: true
          });
          activateMenu(mainMenuOptions, menuMessageId);
        });
      }
    });

    // Navigation options
    sizeOptions.push({
      id: 'opt-back',
      label: 'Back',
      action: () => activateMenu(mainMenuOptions, menuMessageId)
    });

    sizeOptions.push({
      id: 'opt-exit',
      label: 'Exit to Chat',
      action: async () => { }
    });

    return sizeOptions;
  }, [currentModel, addMessage, activateMenu, requestManualContextInput, contextActions]);

  /**
   * Build model selection submenu
   */
  const buildModelSelectionMenu = useCallback((
    mainMenuOptions: MenuOption[],
    menuMessageId?: string
  ): MenuOption[] => {
    const userModels = profileManager.getUserModels().slice().sort((a, b) => {
      const aLabel = (a.name || a.id).toLowerCase();
      const bLabel = (b.name || b.id).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    if (userModels.length === 0) {
      addMessage({
        role: 'system',
        content: 'No models found. Please pull a model first using `/model pull <model-name>`.',
        excludeFromContext: true
      });
      return [];
    }

    const modelOptions: MenuOption[] = userModels.map(entry => {
      const modelLabel = entry.name || entry.id;
      return {
        id: `model-${entry.id}`,
        label: modelLabel,
        action: async () => {
          setCurrentModel(entry.id);
          addMessage({
            role: 'system',
            content: `Switched to model **${modelLabel}**.`,
            excludeFromContext: true
          });
          activateMenu(mainMenuOptions, menuMessageId);
        }
      };
    });

    // Navigation options
    modelOptions.push({
      id: 'opt-back',
      label: 'Back',
      action: () => activateMenu(mainMenuOptions, menuMessageId)
    });

    modelOptions.push({
      id: 'opt-exit',
      label: 'Exit to Chat',
      action: async () => { }
    });

    return modelOptions;
  }, [addMessage, activateMenu, setCurrentModel]);

  /**
   * Build main context menu
   */
  const buildMainMenu = useCallback((menuMessageId?: string): MenuOption[] => {
    const mainMenuOptions: MenuOption[] = [
      {
        id: 'opt-context',
        label: 'Change Context Size',
        action: () => {
          const sizeOptions = buildContextSizeMenu(mainMenuOptions, menuMessageId);
          activateMenu(sizeOptions, menuMessageId);
        }
      },
      {
        id: 'opt-model',
        label: 'Change Model',
        action: () => {
          const modelOptions = buildModelSelectionMenu(mainMenuOptions, menuMessageId);
          if (modelOptions.length > 0) {
            activateMenu(modelOptions, menuMessageId);
          }
        }
      },
      {
        id: 'opt-exit',
        label: 'Exit to Chat',
        action: async () => { }
      }
    ];

    return mainMenuOptions;
  }, [buildContextSizeMenu, buildModelSelectionMenu, activateMenu]);

  /**
   * Open the context menu
   */
  const openContextMenu = useCallback((messageId?: string) => {
    const mainMenu = buildMainMenu(messageId);
    activateMenu(mainMenu, messageId);
  }, [buildMainMenu, activateMenu]);

  return {
    openContextMenu,
    buildMainMenu,
    buildContextSizeMenu,
    buildModelSelectionMenu,
  };
}
