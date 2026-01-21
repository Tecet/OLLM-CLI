/**
 * Main App component - integrates all contexts and wires up the UI
 * 
 * This component:
 * - Wires up all contexts (UI, GPU, Chat, Review)
 * - Manages launch screen and main interface state transitions
 * - Integrates GPU monitoring with status bar
 * - Integrates metrics collection with chat
 * - Integrates reasoning parser with chat
 * - Applies theme system to all components
 * - Loads and applies configuration to UI
 * - Uses alternate screen buffer for flicker-free rendering
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useStdout, BoxProps } from 'ink';
import { UIProvider, useUI, TabType } from '../features/context/UIContext.js';
import { ChatProvider, useChat } from '../features/context/ChatContext.js';
import { GPUProvider, useGPU } from '../features/context/GPUContext.js';
import { ReviewProvider, useReview } from '../features/context/ReviewContext.js';
import { ServiceProvider } from '../features/context/ServiceContext.js';
import { ContextManagerProvider, useContextManager } from '../features/context/ContextManagerContext.js';
import { ModelProvider, useModel } from '../features/context/ModelContext.js';
import { ActiveContextProvider } from '../features/context/ActiveContextState.js';
import { DialogProvider } from './contexts/DialogContext.js';
import { UserPromptProvider } from '../features/context/UserPromptContext.js';
import { HooksProvider } from './contexts/HooksContext.js';
import { ToolsProvider } from './contexts/ToolsContext.js';
import { MCPProvider } from './contexts/MCPContext.js';
import { WindowProvider, useWindow } from './contexts/WindowContext.js';
import { TerminalProvider } from './contexts/TerminalContext.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '@ollm/core';
import { createWelcomeMessage, createCompactWelcomeMessage, CONTEXT_OPTIONS, ContextSizeOption } from '../features/context/SystemMessages.js';
import { ContextProfile } from '../config/types.js';
import type { MenuOption } from '../features/context/ChatContext.js';
import { profileManager } from '../features/context/../profiles/ProfileManager.js';
import { SettingsService } from '../config/settingsService.js';
import { FocusProvider, useFocusManager } from '../features/context/FocusContext.js';
import { keybindsData as keybinds } from '../config/keybinds.js';
import { defaultDarkTheme } from '../config/styles.js';
import { SettingsProvider } from '../features/context/SettingsContext.js';

import { TabBar, tabs } from './components/layout/TabBar.js';
import { ChatInputArea } from './components/layout/ChatInputArea.js';
import { SystemBar } from './components/layout/SystemBar.js';
import { SidePanel } from './components/layout/SidePanel.js';
import { Clock } from './components/layout/Clock.js';
import { Terminal } from './components/Terminal.js';
import { GPUInfo } from './components/layout/StatusBar.js';
import { WindowSwitcher } from './components/WindowSwitcher.js';
// Model loading indicator not currently used here

import { ChatTab } from './components/tabs/ChatTab.js';
import { ToolsTab } from './components/tabs/ToolsTab.js';
import { HooksTab } from './components/tabs/HooksTab.js';
import { FilesTab } from './components/tabs/FilesTab.js';
import { FileExplorerComponent } from './components/file-explorer/FileExplorerComponent.js';
import { SearchTab } from './components/tabs/SearchTab.js';
import { DocsTab } from './components/tabs/DocsTab.js';
import { GitHubTab } from './components/tabs/GitHubTab.js';
import { SettingsTab } from './components/tabs/SettingsTab.js';
import { MCPTab } from './components/tabs/MCPTab.js';
import { DialogManager } from './components/dialogs/DialogManager.js';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useMouse } from './hooks/useMouse.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { AllCallbacksBridge } from './components/AllCallbacksBridge.js';
import { 
  WorkspaceProvider, 
  FileTreeProvider, 
  FileFocusProvider,
  FileTreeService,
  FocusSystem,
  EditorIntegration,
  FileOperations
} from './components/file-explorer/index.js';

// Dynamic require for LocalProvider to avoid build-time module resolution errors when bridge isn't installed
declare const require: (moduleName: string) => { LocalProvider: unknown } | unknown;
import type { Config, Theme } from '../config/types.js';

interface AppContentProps {
  config: Config;
}

function AppContent({ config }: AppContentProps) {
  // Use global UI state for launch screen visibility
  const { state: uiState, setActiveTab, toggleSidePanel, setLaunchScreenVisible } = useUI();
  
  const [debugMode, setDebugMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  // Get terminal dimensions
  const { stdout } = useStdout();
  const terminalHeight = (stdout?.rows || 24) - 1; // reserve 1 for system
  const rawTerminalWidth = stdout?.columns || 80;
  
  // Apply requested 3-char margin on both sides
  const terminalWidth = Math.max(40, rawTerminalWidth - 6); 

  // Layout Calculations for 4-Row Restructuring
  const row1Height = Math.max(3, Math.floor(terminalHeight * 0.05));
  const row3Height = 3; // Fixed height for single line of text + borders
  const row4Height = 11; // Fixed height as per user request (reduced padding)
  
  // Calculate Row 2 (Chat) as remaining space to prevent gaps
  const row2Height = Math.max(18, terminalHeight - row1Height - row3Height - row4Height);

  const leftColumnWidth = Math.max(20, Math.floor(terminalWidth * 0.7));
  const rightColumnWidth = Math.max(20, terminalWidth - leftColumnWidth);
  
  const { state: chatState, clearChat, cancelGeneration, contextUsage: _contextUsage, addMessage, activateMenu, requestManualContextInput, scrollUp, scrollDown } = useChat();
  
  // File Explorer Services
  const fileTreeService = useState(() => new FileTreeService())[0];
  const focusSystem = useState(() => new FocusSystem())[0];
  const editorIntegration = useState(() => new EditorIntegration())[0];
  const fileOperations = useState(() => new FileOperations(process.cwd()))[0];

  // Helper object for shortcuts (so we don't need to change all callbacks below)
  const chatActions = { scrollUp, scrollDown };

  // Mouse Handling
  useMouse((event) => {
    // 1-based coordinates from terminal
    const { x, y, action, button } = event;

    // Layout Definitions (must match render logic)
    const leftWidth = uiState.sidePanelVisible ? leftColumnWidth - 1 : terminalWidth - 1;
    const rightStart = leftWidth + 1;
    
    // Rows (Y-axis)
    const row1End = row1Height; // Nav Bar
    // Row 2 starts after Row 1
    const row2Start = row1End + 1;
    const row2End = row1End + row2Height; // Main Content
    // Row 3 (System) starts after Row 2
    const row3Start = row2End + 1;
    const row3End = row2End + row3Height;
    // Row 4 (Input) starts after Row 3
    const row4Start = row3End + 1;
    // const row4End = row3End + row4Height;

    // Hit Testing
    const isLeftColumn = x <= leftWidth;
    const isRightColumn = x >= rightStart;

    if (action === 'down' && button === 'left') {
      // Handle Clicking / Selecting Windows
      if (isLeftColumn) {
        if (y <= row1End) {
          // Nav Bar Click
          focusManager.setFocus('nav-bar');
          
          // Hit Test for Tabs
          // TabBar has paddingX={1} (1 cell left) + 1 cell border (if any, but border is on parent)
          // `x` is 1-based absolute. `leftColumnWidth` is width.
          // Container starts at x=1 (or 2 if border?). `Box` defaults.
          // TabBar is inside a Box with border. Border takes 1 cell? 
          // `Box borderStyle` usually adds 1 cell padding.
          // Let's assume start X = 2 (border) + 1 (paddingX) = 3.
          
          let currentX = 3; 
          for (const tab of tabs) {
            // Width = Icon(2) + Space(1) + Label(N)
            // Plus PaddingLeft(1) if not first?
            // TabBar map uses `paddingLeft={index === 0 ? 0 : 1}`
            // So: First tab = content. Next tabs = 1 + content.
            
            const labelWidth = tab.label.length;
            const contentWidth = 2 + 1 + labelWidth; // Icon + Space + Label
            const padding = (tab.id === tabs[0].id) ? 0 : 1;
            const totalTabWidth = contentWidth + padding;
            
            if (x >= currentX && x < currentX + totalTabWidth) {
              setActiveTab(tab.id);
              // Also activate content if we click the tab
              focusManager.activateContent(tab.id); 
              break;
            }
            
            currentX += totalTabWidth;
          }

          if (focusManager.isFocused('nav-bar') && x > currentX) {
             // If clicked empty space in nav bar, maybe just focus?
             // focusManager.activateContent(uiState.activeTab);
          }
        } else if (y >= row2Start && y <= row2End) {
          // Main Content Click
          // Focus the main content based on active tab
          focusManager.activateContent(uiState.activeTab);
        } else if (y >= row4Start) {
          // Input Click
          focusManager.setFocus('chat-input');
        }
      } else if (isRightColumn && uiState.sidePanelVisible) {
        // Side Panel Click
        // Simple heuristic: Top half = File Tree/Active Context, Bottom half = Context/Functions
        // Actually SidePanel has: Header (Row1), File Tree (10 lines), Context (Flex), Functions (4 lines)
        // This is dynamic. Let's just focus 'context-panel' generically for now or 'side-file-tree'
        // Let's try to be slightly smarter based on relative Y?
        // Header: row1Height.
        const sideHeaderEnd = row1Height;
        const sideFileTreeEnd = sideHeaderEnd + 10;
        
        if (y <= sideHeaderEnd) {
           // Header
        } else if (y <= sideFileTreeEnd) {
           focusManager.setFocus('side-file-tree');
        } else {
           focusManager.setFocus('context-panel');
        }
      }
    } else if (action === 'scroll-up') {
      chatActions.scrollUp();
    } else if (action === 'scroll-down') {
      chatActions.scrollDown();
    }
  });

  useReview();
  const { info: gpuInfo } = useGPU();
  const { currentModel, setCurrentModel, modelLoading, provider } = useModel();
  const { state: contextState, actions: contextActions } = useContextManager();
  const focusManager = useFocusManager();
  const lastWelcomeModelRef = useRef<string | null>(null);
  const prevModelLoadingRef = useRef<boolean>(modelLoading);
  const { activeWindow } = useWindow();

    // Persist hardware info if newfound or better than what we have
  useEffect(() => {
      if (!gpuInfo) return;

      const currentSettings = SettingsService.getInstance().getSettings();
      const savedHW = currentSettings.hardware || {};

      const liveName = gpuInfo?.model || gpuInfo?.vendor || 'Unknown';
      // Convert to GB for storage
      const liveVRAM_GB = typeof gpuInfo?.vramTotal === 'number' ? gpuInfo.vramTotal / (1024 * 1024 * 1024) : 0;

      // Conditions to update:
      // 1. We have no saved info at all
      // 2. Saved name is 'Unknown' but we have a real name now
      // 3. Saved VRAM is missing/0 but we have real VRAM now
      
      const isBetterName = liveName !== 'Unknown' && savedHW.gpuName === 'Unknown';
      const isBetterVRAM = liveVRAM_GB > 0 && (!savedHW.totalVRAM || savedHW.totalVRAM === 0);
      const isMissing = !savedHW.gpuName;

      if (isMissing || isBetterName || isBetterVRAM) {
            SettingsService.getInstance().setHardwareInfo({
              gpuCount: 1, 
              gpuName: liveName,
              totalVRAM: liveVRAM_GB
          });
      }
  }, [gpuInfo]); // Only run when gpuInfo updates

  const buildWelcomeMessage = useCallback(() => {
    const modelName = currentModel || 'Unknown Model';
    const profile = profileManager.findProfile(modelName);

    const settings = SettingsService.getInstance().getSettings();
    const persistedHW = settings.hardware;

    const effectiveGPUInfo = gpuInfo || {
      model: persistedHW?.gpuName || 'Unknown GPU',
      vendor: 'Unknown',
      total: persistedHW?.totalVRAM || 0,
      vramTotal: (persistedHW?.totalVRAM || 0) * 1024 * 1024 * 1024,
      count: persistedHW?.gpuCount || 1,
    };

    const currentContextSize = contextState.usage.maxTokens;
    return createWelcomeMessage(modelName, currentContextSize, profile, effectiveGPUInfo);
  }, [currentModel, gpuInfo, contextState.usage.maxTokens]);

  const openModelContextMenu = useCallback((messageId?: string) => {
    const menuMessageId = messageId;
    const modelName = currentModel || 'Unknown Model';
    const profile = profileManager.findProfile(modelName);
    const settings = SettingsService.getInstance().getSettings();
    const persistedHW = settings.hardware;

    // Logic:
    // 1. prefer live gpuInfo.vramTotal (Bytes) converted to GB
    // 2. fallback to persistedHW.totalVRAM (GB)
    // 3. fallback to default (0)
    let effectiveTotalVRAM_GB = 0;

    if (gpuInfo) {
      if (typeof gpuInfo.vramTotal === 'number' && gpuInfo.vramTotal > 0) {
        effectiveTotalVRAM_GB = gpuInfo.vramTotal / (1024 * 1024 * 1024);
      }
    }

    // Fallback to persisted if live detection failed to find a value
    if (effectiveTotalVRAM_GB === 0) {
      if (persistedHW?.totalVRAM) {
        effectiveTotalVRAM_GB = persistedHW.totalVRAM;
      } else if (persistedHW?.gpuCount) {
        effectiveTotalVRAM_GB = 24; // Default fallback
      }
    }

    const SAFETY_BUFFER_GB = effectiveTotalVRAM_GB > 0 ? Math.max(1.5, effectiveTotalVRAM_GB * 0.1) : 0;
    const availableForContextGB = effectiveTotalVRAM_GB > 0 ? (effectiveTotalVRAM_GB - SAFETY_BUFFER_GB) : 0;

    // Calculate max safe context for "Auto" logic (80% rule)
    const targetVRAM = effectiveTotalVRAM_GB * 0.8;

    let maxSafeSize = 4096;
    const manager = contextActions.getManager();
    if (manager && provider && profile) { 
      for (const opt of profile.context_profiles) {
        const vramNum = parseFloat(opt.vram_estimate.replace(' GB', ''));
        if (!isNaN(vramNum) && vramNum <= targetVRAM) {
          maxSafeSize = opt.size;
        }
      }
    }

    // Define main menu options
    const mainMenuOptions: MenuOption[] = [
      {
        id: 'opt-context',
        label: 'Change Context Size',
        action: () => {
          const optionsToUse = profile ? profile.context_profiles : CONTEXT_OPTIONS;
          const sizeOptions: MenuOption[] = [];

          sizeOptions.push({
            id: 'size-auto',
            label: 'Auto (Dynamic based on VRAM)',
            action: async () => {
              const targetSize = maxSafeSize;
              await contextActions.resize(targetSize);
              SettingsService.getInstance().setContextSize(targetSize); // Persist
              addMessage({
                role: 'system',
                content: `Context size automatically set to **${targetSize}** tokens based on available VRAM (${effectiveTotalVRAM_GB.toFixed(1)} GB).`,
                excludeFromContext: true
              });
              activateMenu(mainMenuOptions, menuMessageId); // Return to main menu
            }
          });
          
          optionsToUse.forEach(opt => {
            const val = 'size' in opt ? (opt as {size: number}).size : (opt as {value: number}).value;
            let sizeStr = `${val}`;
            if ('size_label' in opt && opt.size_label) {
              sizeStr = opt.size_label;
            } else {
              sizeStr = val >= 1024 ? `${val / 1024}k` : `${val}`;
            }

            let vramStr = '';
            if ('vram_estimate' in opt && opt.vram_estimate) {
              vramStr = ` - ${opt.vram_estimate}`;
            }

            const vramEst = ('vram_estimate' in opt ? (opt as {vram_estimate: string}).vram_estimate : (opt as {vramEstimate: string}).vramEstimate) || '';

            // Check if this option exceeds VRAM limits
            let isUnsafe = false;
            if (vramEst) {
              const vramNum = parseFloat(vramEst.replace(' GB', ''));
              // Allow 50% overhead for CPU offloading (Ollama can handle this with system RAM)
              // The VRAM estimates in profiles are already conservative, so we can be more generous
              const vramLimitWithOffload = availableForContextGB * 1.5;
              if (!isNaN(vramNum) && vramNum > vramLimitWithOffload) {
                isUnsafe = true;
              }
            }

            // Skip unsafe options - don't add them to the menu
            if (isUnsafe) {
              return;
            }

            let label = `${sizeStr}${vramStr}`;
            if (val === maxSafeSize) {
              label += ' (Recommended)';
            }

            sizeOptions.push({
              id: `size-${val}`,
              label: label,
              value: val,
              action: async () => {
                await contextActions.resize(val);
                SettingsService.getInstance().setContextSize(val); // Persist
                
                addMessage({
                  role: 'system',
                  content: `Context size updated to **${sizeStr}** (${val} tokens).`,
                  excludeFromContext: true
                });
                
                activateMenu(mainMenuOptions, menuMessageId); // Return to main menu
              }
            });
          });

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
                SettingsService.getInstance().setContextSize(value);
                addMessage({
                  role: 'system',
                  content: `Manual context size set to **${value}** tokens.`,
                  excludeFromContext: true
                });
                activateMenu(mainMenuOptions, menuMessageId);
              });
            }
          });

          sizeOptions.push({
            id: 'opt-back',
            label: 'Back',
            action: () => {
              activateMenu(mainMenuOptions, menuMessageId);
            }
          });

          sizeOptions.push({
            id: 'opt-exit',
            label: 'Exit to Chat',
            action: async () => { }
          });

          activateMenu(sizeOptions, menuMessageId);
        }
      },
      {
        id: 'opt-model',
        label: 'Change Model',
        action: () => {
          const userModels = profileManager.getUserModels().slice().sort((a, b) => {
            const aLabel = (a.name || a.id).toLowerCase();
            const bLabel = (b.name || b.id).toLowerCase();
            return aLabel.localeCompare(bLabel);
          });
          if (userModels.length === 0) {
            addMessage({
              role: 'system',
              content: 'No installed models found. Run `/model list` to refresh the model list.',
              excludeFromContext: true
            });
            return;
          }
          const modelOptions: MenuOption[] = userModels.map(entry => {
            const modelLabel = entry.name || entry.id;
            return {
            id: `model-${entry.id}`,
            label: modelLabel,
            action: async () => {
              const description = entry.description ? `*${entry.description}*` : '';
              const abilities = entry.abilities?.length ? `**Abilities:** ${entry.abilities.join(', ')}` : '';
              const toolSupport = entry.tool_support ? '**Tool Support:** Enabled' : '';
              const infoMsg = `
**Selected Model:** ${modelLabel}
${description}
${abilities}
${toolSupport}

**Select Context Size for this model:**
`.trim();

              addMessage({
                role: 'system',
                content: infoMsg,
                excludeFromContext: true
              });

              SettingsService.getInstance().setModel(entry.id); // Persist Model Selection
              setCurrentModel(entry.id); // Update UI State

              let safeSizeForModel = 4096;
              const settings = SettingsService.getInstance().getSettings();
              const persistedHW = settings.hardware;
              let cardTotal = 0;
              if (gpuInfo) {
                if (typeof gpuInfo.vramTotal === 'number' && gpuInfo.vramTotal > 0) {
                  cardTotal = gpuInfo.vramTotal / (1024 * 1024 * 1024);
                }
              }
              if (cardTotal === 0 && persistedHW) {
                cardTotal = persistedHW.totalVRAM || (persistedHW.gpuCount ? 24 : 0);
              }
              const safetyBuffer = cardTotal > 0 ? Math.max(1.5, cardTotal * 0.1) : 0;
              const availableForCtx = cardTotal > 0 ? (cardTotal - safetyBuffer) : 0;

              safeSizeForModel = entry.default_context || safeSizeForModel;

              const modelContextOptions: MenuOption[] = [];
              modelContextOptions.push({
                id: 'model-size-auto',
                label: 'Auto (Dynamic)',
                action: async () => {
                  await contextActions.resize(safeSizeForModel);
                  SettingsService.getInstance().setContextSize(safeSizeForModel); // Persist
                  addMessage({
                    role: 'system',
                    content: `Selected **${modelLabel}** with Auto context (**${safeSizeForModel}** tokens).`,
                    excludeFromContext: true
                  });
                  activateMenu(mainMenuOptions, menuMessageId);
                }
              });

              const contextProfiles = entry.context_profiles || CONTEXT_OPTIONS;
              const manualContext = entry.manual_context;
              
              // Add user's saved manual context first if it exists
              if (manualContext) {
                const manualSizeStr = manualContext >= 1024 ? `${manualContext / 1024}k` : `${manualContext}`;
                modelContextOptions.push({
                  id: `model-size-user-${manualContext}`,
                  label: `User Context (${manualSizeStr})`,
                  action: async () => {
                    await contextActions.resize(manualContext);
                    SettingsService.getInstance().setContextSize(manualContext);
                    addMessage({
                      role: 'system',
                      content: `Selected **${modelLabel}** with **${manualSizeStr}** context.`,
                      excludeFromContext: true
                    });
                    activateMenu(mainMenuOptions, menuMessageId);
                  }
                });
              }

              // Add standard context profiles
              contextProfiles.forEach((opt: ContextProfile | ContextSizeOption) => {
                const optIsProfile = 'size' in opt;
                const optSize = optIsProfile ? opt.size : (opt as ContextSizeOption).value;
                const optLabel = optIsProfile ? opt.size_label : (opt as ContextSizeOption).label;
                const optVram = optIsProfile ? opt.vram_estimate : (opt as ContextSizeOption).vramEstimate;

                const sizeStr = optLabel || (optSize >= 1024 ? `${optSize / 1024}k` : `${optSize}`);
                const vramEstimate = optVram || '';
                const vramStr = vramEstimate ? ` - ${vramEstimate}` : '';

                // Check if this option exceeds VRAM limits
                let isUnsafe = false;
                if (vramEstimate) {
                  const vramNum = parseFloat(vramEstimate.replace(' GB', ''));
                  // Allow 50% overhead for CPU offloading (Ollama can handle this with system RAM)
                  // The VRAM estimates in profiles are already conservative, so we can be more generous
                  const vramLimitWithOffload = availableForCtx * 1.5;
                  if (!isNaN(vramNum) && vramNum > vramLimitWithOffload) {
                    isUnsafe = true;
                  }
                }

                // Skip unsafe options - don't add them to the menu
                if (isUnsafe) {
                  return;
                }

                let label = `${sizeStr}${vramStr}`;
                if (optSize === safeSizeForModel) {
                  label += ' (Recommended)';
                }

                modelContextOptions.push({
                  id: `model-size-${optSize}`,
                  label: label,
                  action: async () => {
                    await contextActions.resize(optSize);
                    SettingsService.getInstance().setContextSize(optSize); // Persist
                    addMessage({
                      role: 'system',
                      content: `Selected **${modelLabel}** with **${sizeStr}** context.`,
                      excludeFromContext: true
                    });
                    activateMenu(mainMenuOptions, menuMessageId);
                  }
                });
              });

              // Add Manual input option at the end
              modelContextOptions.push({
                id: 'model-size-manual',
                label: 'Manual...',
                action: async () => {
                  addMessage({
                    role: 'system',
                    content: 'Enter a manual context size in tokens. Type "cancel" to abort.',
                    excludeFromContext: true
                  });
                  requestManualContextInput(entry.id, async (value) => {
                    profileManager.setManualContext(entry.id, value);
                    await contextActions.resize(value);
                    SettingsService.getInstance().setContextSize(value);
                    addMessage({
                      role: 'system',
                      content: `Manual context size set to **${value}** tokens.`,
                      excludeFromContext: true
                    });
                    activateMenu(mainMenuOptions, menuMessageId);
                  });
                }
              });

              modelContextOptions.push({
                id: 'opt-back',
                label: 'Back to Models',
                action: () => {
                  activateMenu(modelOptions, menuMessageId);
                }
              });

              modelContextOptions.push({
                id: 'opt-exit',
                label: 'Exit to Chat',
                action: async () => { }
              });

              activateMenu(modelContextOptions, menuMessageId);
            }
          };
          });
          modelOptions.push({
            id: 'opt-back',
            label: 'Back',
            action: () => {
              activateMenu(mainMenuOptions, menuMessageId);
            }
          });

          modelOptions.push({
            id: 'opt-exit',
            label: 'Exit to Chat',
            action: async () => { }
          });

          activateMenu(modelOptions, menuMessageId);
        }
      },
      {
        id: 'opt-exit',
        label: 'Exit to Chat',
        action: async () => { }
      }
    ];

    activateMenu(mainMenuOptions, menuMessageId);
  }, [currentModel, addMessage, activateMenu, contextActions, gpuInfo, requestManualContextInput, setCurrentModel, provider]);

  // Handle launch screen dismiss
  const handleDismissLaunch = useCallback(() => {
    setLaunchScreenVisible(false);

    const welcomeMsg = buildWelcomeMessage();
    addMessage(welcomeMsg);
    lastWelcomeModelRef.current = currentModel || null;
    openModelContextMenu(welcomeMsg.id);
    return;
  }, [setLaunchScreenVisible, currentModel, addMessage, buildWelcomeMessage, openModelContextMenu]);

  useEffect(() => {
    globalThis.__ollmOpenModelMenu = () => openModelContextMenu();
    return () => {
      if (globalThis.__ollmOpenModelMenu) {
        globalThis.__ollmOpenModelMenu = undefined;
      }
    };
  }, [openModelContextMenu]);

  useEffect(() => {
    const wasLoading = prevModelLoadingRef.current;
    prevModelLoadingRef.current = modelLoading;

    if (wasLoading && !modelLoading && currentModel) {
      if (lastWelcomeModelRef.current !== currentModel) {
        const profile = profileManager.findProfile(currentModel);
        const welcomeMsg = createCompactWelcomeMessage(currentModel, profile);
        addMessage(welcomeMsg);
        lastWelcomeModelRef.current = currentModel;
      }
    }
  }, [modelLoading, currentModel, addMessage]);

  // Handle save session
  const handleSaveSession = useCallback(async () => {
    console.log('Save session');
  }, []);

  // Handle toggle debug
  const handleToggleDebug = useCallback(() => {
    setDebugMode((prev) => !prev);
  }, []);

  // Handle command palette
  const handleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  // Register global keyboard shortcuts
  useGlobalKeyboardShortcuts([
    {
      key: keybinds.tabNavigation.tabChat,
      handler: () => setActiveTab('chat'),
      description: 'Switch to Chat tab',
    },
    {
      key: keybinds.tabNavigation.tabTools,
      handler: () => setActiveTab('tools'),
      description: 'Switch to Tools tab',
    },
    {
      key: keybinds.tabNavigation.tabHooks,
      handler: () => setActiveTab('hooks'),
      description: 'Switch to Hooks tab',
    },
    {
      key: keybinds.tabNavigation.tabFiles,
      handler: () => setActiveTab('files'),
      description: 'Switch to Files tab',
    },
    {
      key: keybinds.tabNavigation.tabSearch,
      handler: () => setActiveTab('search'),
      description: 'Switch to Search tab',
    },
    {
      key: keybinds.tabNavigation.tabDocs,
      handler: () => setActiveTab('docs'),
      description: 'Switch to Docs tab',
    },
    {
      key: keybinds.tabNavigation.tabGithub,
      handler: () => setActiveTab('github'),
      description: 'Switch to GitHub tab',
    },
    {
      key: keybinds.tabNavigation.tabMcp,
      handler: () => setActiveTab('mcp'),
      description: 'Switch to MCP tab',
    },
    {
      key: keybinds.tabNavigation.tabSettings,
      handler: () => setActiveTab('settings'),
      description: 'Switch to Settings tab',
    },
    {
      key: 'ctrl+p',
      handler: toggleSidePanel,
      description: 'Toggle side panel',
    },
    {
      key: 'ctrl+k',
      handler: handleCommandPalette,
      description: 'Open command palette',
    },
    {
      key: 'ctrl+/',
      handler: handleToggleDebug,
      description: 'Toggle debug mode',
    },
    {
      key: 'ctrl+l',
      handler: clearChat,
      description: 'Clear chat',
    },
    {
      key: 'ctrl+s',
      handler: handleSaveSession,
      description: 'Save session',
    },
    {
      key: 'escape',
      handler: () => {
        if (chatState.streaming || chatState.waitingForResponse) {
          cancelGeneration();
        } else {
          focusManager.exitToNavBar();
        }
      },
      description: 'Cancel current action or return to navigation',
    },
    // Global support for Chat Scrolling (Capture keys anywhere)
    {
        key: 'ctrl+pageup',
        handler: () => chatActions.scrollUp(),
        description: 'Scroll Chat Up'
    },
    {
        key: 'ctrl+pagedown',
        handler: () => chatActions.scrollDown(),
        description: 'Scroll Chat Down'
    },
    // Alternative keys for better terminal compatibility
    {
        key: 'meta+up', // Alt+Up
        handler: () => chatActions.scrollUp(),
        description: 'Scroll Chat Up (Alt)'
    },
    {
        key: 'meta+down', // Alt+Down
        handler: () => chatActions.scrollDown(),
        description: 'Scroll Chat Down (Alt)'
    },
    // Focus Management Shortcuts
    {
        key: keybinds.global.cycleNext,
        handler: () => {
            focusManager.cycleFocus('next');
        },
        description: 'Next Pane'
    },
    {
        key: keybinds.global.cyclePrev,
        handler: () => {
            focusManager.cycleFocus('previous');
        },
        description: 'Previous Pane'
    },
    {
        key: keybinds.global.focusChatInput,
        handler: () => focusManager.setFocus('chat-input'),
        description: 'Focus Chat Input'
    },
    {
        key: keybinds.global.focusNavigation,
        handler: () => focusManager.setFocus('nav-bar'),
        description: 'Focus Navigation'
    },
    {
        key: keybinds.global.focusContext,
        handler: () => focusManager.setFocus('context-panel'),
        description: 'Focus Context Panel'
    },
    {
        key: keybinds.global.focusFileTree,
        handler: () => focusManager.setFocus('file-tree'),
        description: 'Focus File Tree'
    },
    {
        key: keybinds.global.focusFunctions,
        handler: () => focusManager.setFocus('functions'),
        description: 'Focus Functions'
    }
  ]);

  // Show launch screen
  if (uiState.launchScreenVisible) {
    return (
      <LaunchScreen
        theme={uiState.theme}
        onDismiss={handleDismissLaunch}
        recentSessions={[]}
      />
    );
  }

  // Render active tab
  const renderActiveTab = (height: number, width: number) => {
    // If we're in terminal mode, override the active tab display
    if (activeWindow === 'terminal') {
      const isTerminalFocused = focusManager.isFocused('chat-input') || focusManager.isFocused('nav-bar');
      return (
        <Box 
          height={height} 
          width={width}
          borderStyle={uiState.theme.border.style as BoxProps['borderStyle']} 
          borderColor={isTerminalFocused ? uiState.theme.border.active : uiState.theme.border.primary} 
          flexShrink={1} 
          flexGrow={1} 
          overflow="hidden"
        >
          <Terminal height={height} />
        </Box>
      );
    }

    switch (uiState.activeTab) {
      case 'chat':
        return (
          <ChatTab
            height={height}
            showBorder={true}
            metricsConfig={{
                enabled: config.ui?.metrics?.enabled !== false,
                compactMode: config.ui?.metrics?.compactMode || false,
                showPromptTokens: config.ui?.metrics?.showPromptTokens !== false,
                showTTFT: config.ui?.metrics?.showTTFT !== false,
                showInStatusBar: config.ui?.metrics?.showInStatusBar !== false,
            }}
            reasoningConfig={{
                enabled: config.ui?.reasoning?.enabled !== false,
                maxVisibleLines: config.ui?.reasoning?.maxVisibleLines || 8,
                autoCollapseOnComplete: config.ui?.reasoning?.autoCollapseOnComplete !== false,
            }}
            columnWidth={width}
          />
        );
      case 'tools':
        return <ToolsTab width={width} />;
      case 'hooks':
        return <HooksTab windowWidth={width} />;
      case 'mcp':
        return <MCPTab windowWidth={width} />;
      case 'files':
        return (
          <FileExplorerComponent
            rootPath={process.cwd()}
            autoLoadWorkspace={false}
            restoreState={true}
            excludePatterns={['node_modules', '.git', 'dist', 'coverage']}
            hasFocus={true}
          />
        );
      case 'search':
        return <SearchTab width={width} />;
      case 'docs':
        return <DocsTab height={height} width={width} />;
      case 'github':
        return <GitHubTab width={width} />;
      case 'settings':
        return <SettingsTab width={width} />;
      default:
        return <SearchTab width={width} />;
    }
  };

  // Calculate notification counts
  const notificationCounts = new Map<TabType, number>();
  uiState.notifications.forEach((notification) => {
    const current = notificationCounts.get(notification.tab) || 0;
    notificationCounts.set(notification.tab, current + notification.count);
  });


  return (
    <Box flexDirection="row" height={terminalHeight} width={terminalWidth} overflow="hidden">
      {/* Left Column (70%): Restructured into 4 distinct rows */}
      <Box 
          width={uiState.sidePanelVisible ? leftColumnWidth - 1 : terminalWidth - 1} 
          flexDirection="column" 
          flexShrink={0}
          overflow="hidden"
          minHeight={0}
      >
          {/* Row 1: Top Bar (5%) */}
          <Box 
            height={row1Height} 
            flexDirection="row" 
            alignItems="center" 
            justifyContent="space-between"
            overflow="hidden"
            flexWrap="nowrap"
          >
            <Box flexShrink={0}>
              <Clock borderColor={uiState.theme.border.primary} />
            </Box>

            <Box flexGrow={1} flexDirection="row" justifyContent="center">
              <Box borderStyle={uiState.theme.border.style as BoxProps['borderStyle']} borderColor={focusManager.isFocused('nav-bar') ? uiState.theme.border.active : uiState.theme.border.primary}>
                <TabBar
                  activeTab={uiState.activeTab}
                  onTabChange={setActiveTab}
                  notifications={notificationCounts}
                  theme={uiState.theme}
                  noBorder
                />
              </Box>
            </Box>
            
            <Box flexShrink={0}>
              <WindowSwitcher />
            </Box>
          </Box>

          {/* Model Loading Indicator - now shown in SystemBar instead */}
          {/* <ModelLoadingIndicator /> */}

          {/* Row 2: Main Content Area with 10/80/10 split */}
          {(() => {
            const leftColBaseWidth = uiState.sidePanelVisible ? leftColumnWidth - 1 : terminalWidth - 1;
            const spacerWidth = Math.floor(leftColBaseWidth * 0.1);
            const mainContentWidth = leftColBaseWidth - (2 * spacerWidth);
            
            return (
              <Box flexGrow={1} minHeight={row2Height} flexDirection="row" width={leftColBaseWidth}>
                {/* Left Spacer */}
                <Box width={spacerWidth} />
                
                {/* Middle Content */}
                <Box width={mainContentWidth} flexDirection="column">
                  {renderActiveTab(row2Height, mainContentWidth)}
                </Box>
                
                {/* Right Spacer */}
                <Box width={spacerWidth} />
              </Box>
            );
          })()}
          
          {/* Row 3: System Bar (10%, Yellow) */}
          <SystemBar height={row3Height} showBorder={true} />
          
          {/* Row 4: User Input Box (25%, Red) */}
          <ChatInputArea height={row4Height} showBorder={true} />
        </Box>

        {/* Right: Full-Height Side Panel (30%) */}
        {uiState.sidePanelVisible && (
          <Box width={Math.max(0, rightColumnWidth - 2)} flexShrink={0} minHeight={0} overflow="hidden">
            <SidePanel
              visible={uiState.sidePanelVisible}
              connection={{ status: 'connected', provider: config.provider.default }}
              model={currentModel || 'model'}
              gpu={gpuInfo as unknown as GPUInfo | null}
              theme={uiState.theme}
              row1Height={row1Height}
            />
          </Box>
        )}

      {/* Dialog Manager - renders active dialogs */}
      <DialogManager />

      {/* Debug overlay */}
      {debugMode && (
        <Box
          padding={1}
          borderStyle="single"
          borderColor={uiState.theme.border.primary}
        >
          <Text>Debug Mode: ON</Text>
          <Text>Active Tab: {uiState.activeTab}</Text>
          <Text>Side Panel: {uiState.sidePanelVisible ? 'Visible' : 'Hidden'}</Text>
          <Text>GPU: {gpuInfo ? `${gpuInfo.vendor} - ${gpuInfo.temperature}°C` : 'N/A'}</Text>
          <Text>Messages: {chatState.messages.length}</Text>
        </Box>
      )}

      {/* Command Palette (placeholder) */}
      {commandPaletteOpen && (
        <Box
          padding={1}
          borderStyle="single"
          borderColor={uiState.theme.border.active}
        >
          <Text>Command Palette (Coming Soon)</Text>
          <Text>Press Ctrl+K to close</Text>
        </Box>
      )}

      {/* Launch Screen Overlay */}
      {uiState.launchScreenVisible && (
        <Box position="absolute" width="100%" height="100%">
            <LaunchScreen 
                onDismiss={handleDismissLaunch}
                recentSessions={[]} // TODO: wire up recent sessions
                theme={uiState.theme}
                modelInfo={{
                    name: currentModel || 'Unknown',
                    size: 'Unknown' // TODO: get size
                }}
                gpuInfo={gpuInfo ? {
                    name: gpuInfo.model || 'Generic GPU',
                    vram: `${(gpuInfo.vramTotal / (1024 * 1024 * 1024)).toFixed(1)} GB`,
                    utilization: `${gpuInfo.gpuUtilization}%`
                } : undefined}
            />
        </Box>
      )}
    </Box>
  );
}

export interface AppProps {
  config: Config;
}

export function App({ config }: AppProps) {
  // Load persisted model preference
  const settings = SettingsService.getInstance().getSettings();
  const persistedModel = settings.llm?.model;
  const persistedContextSize = settings.llm?.contextSize;
  const initialModel = persistedModel || config.model.default;

  // Extract UI settings from config
  const initialSidePanelVisible = config.ui?.sidePanel !== false;
  
  // Generate a session ID for context management
  const sessionId = `session-${Date.now()}`;
  
  // Extract model size from model name for VRAM calculations
  const extractModelSize = (modelName: string): number => {
    // Match patterns like "3b", "7b", "1.5b", "13b", "70b"
    const match = modelName.match(/(\d+\.?\d*)b/i);
    if (match) {
      return parseFloat(match[1]);
    }
    // Default to 7B if can't determine
    console.warn(`[App] Could not extract model size from "${modelName}", defaulting to 7B`);
    return 7;
  };

  // Model info for context sizing (from config or defaults)
  const modelInfo = {
    parameters: extractModelSize(initialModel),
    contextLimit: persistedContextSize || config.context?.maxSize || 8192,
  };
  
  // Context manager configuration - maps CLI config to core config format
  const contextConfig = config.context ? {
    targetSize: persistedContextSize || config.context.targetSize,
    minSize: config.context.minSize,
    maxSize: config.context.maxSize,
    autoSize: false, // Disable auto-size - let user control context size
    vramBuffer: config.context.vramBuffer,
    compression: {
      enabled: config.context.compressionEnabled,
      threshold: config.context.compressionThreshold,
      strategy: 'truncate' as const, // Default strategy
      preserveRecent: 4096, // Default recent tokens to preserve
      summaryMaxTokens: 1024, // Default summary max size
    },
    snapshots: {
      enabled: config.context.snapshotsEnabled,
      maxCount: config.context.maxSnapshots,
      autoCreate: true, // Default auto-create enabled
      autoThreshold: 0.8, // Default threshold for auto-creation
    },
  } : undefined;
  
  // Create provider adapter based on config
  const provider = (() => {
    // const providerName = config.provider.default;

    // Try to require the LocalProvider implementation at runtime; fall back to a no-op class if unavailable
    let LocalProviderClass: { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter } | null = null;
    try {
      const mod = require('@ollm/ollm-bridge/provider/localProvider.js') as { LocalProvider: { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter } } | { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter };
      LocalProviderClass = (mod as Record<string, unknown>).LocalProvider as { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter } || mod;
    } catch {
      LocalProviderClass = class implements ProviderAdapter {
        readonly name = 'no-op';
        constructor(_opts: { baseUrl: string; timeout?: number }) {}
        async *chatStream(_req: ProviderRequest): AsyncIterable<ProviderEvent> {
          yield { type: 'error', error: { message: 'Bridge not installed' } };
        }
      } as unknown as { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter };
    }

    const ollamaConfig = config.provider.ollama || {
      host: 'http://localhost:11434',
      timeout: 30000,
    };

    if (!LocalProviderClass) throw new Error('Failed to initialize LocalProvider');
    
    return new LocalProviderClass({
      baseUrl: ollamaConfig.host,
      timeout: ollamaConfig.timeout,
    });
  })();
  
  // Load initial theme from SettingsService
  const initialThemeName = SettingsService.getInstance().getTheme() || config.ui?.theme || 'default-dark';
  let initialTheme = defaultDarkTheme;
  try {
    const { builtInThemes } = require('../config/styles.js') as { builtInThemes: Record<string, Theme> };
    if (builtInThemes[initialThemeName]) {
      initialTheme = builtInThemes[initialThemeName];
    }
  } catch (e) {
    console.warn('Failed to load initial theme from built-ins, using default:', e);
  }
  
  // Get workspace path (if available)
  const workspacePath = process.cwd();
  
  return (
    <ErrorBoundary>
      <UIProvider 
        initialSidePanelVisible={initialSidePanelVisible}
        initialTheme={initialTheme}
      >
        <WindowProvider>
          <TerminalProvider>
            <SettingsProvider>
          <DialogProvider>
            <ServiceProvider
              provider={provider}
              config={config}
              workspacePath={workspacePath}
            >
              <HooksProvider>
                <ToolsProvider>
                  <MCPProvider>
                    <UserPromptProvider>
                      <GPUProvider 
                        pollingInterval={config.status?.pollInterval || 5000}
                        autoStart={config.ui?.showGpuStats !== false}
                      >
                        <ContextManagerProvider
                          sessionId={sessionId}
                          modelInfo={modelInfo}
                          modelId={initialModel}
                          config={contextConfig}
                          provider={provider}
                        >
                          <ModelProvider
                            provider={provider}
                            initialModel={initialModel}
                          >
                            <ChatProvider>
                              <AllCallbacksBridge onOpenModelMenu={() => {
                                // This will be wired up properly when we refactor AppContent
                                // For now, the global callback will be registered
                                console.warn('openModelMenu called from bridge - needs wiring');
                              }}>
                                <ReviewProvider>
                                  <FocusProvider>
                                    <ActiveContextProvider>
                                      <ErrorBoundary>
                                        <WorkspaceProvider>
                                          <FileTreeProvider>
                                            <FileFocusProvider>
                                              <AppContent config={config} />
                                            </FileFocusProvider>
                                          </FileTreeProvider>
                                        </WorkspaceProvider>
                                      </ErrorBoundary>
                                    </ActiveContextProvider>
                                  </FocusProvider>
                                </ReviewProvider>
                              </AllCallbacksBridge>
                            </ChatProvider>
                          </ModelProvider>
                        </ContextManagerProvider>
                      </GPUProvider>
                  </UserPromptProvider>
                </MCPProvider>
              </ToolsProvider>
            </HooksProvider>
          </ServiceProvider>
          </DialogProvider>
        </SettingsProvider>
          </TerminalProvider>
        </WindowProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
