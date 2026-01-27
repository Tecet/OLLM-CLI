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

import { spawn } from 'child_process';


import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useStdout, BoxProps, useInput } from 'ink';

import { SettingsService } from '../config/settingsService.js';
import { defaultDarkTheme } from '../config/styles.js';
import { ContextProfile } from '../config/types.js';
import { AllCallbacksBridge } from './components/AllCallbacksBridge.js';
import { DialogManager } from './components/dialogs/DialogManager.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { FileExplorerComponent } from './components/file-explorer/FileExplorerComponent.js';
import { 
  WorkspaceProvider, 
  FileFocusProvider,
} from './components/file-explorer/index.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import { ChatInputArea } from './components/layout/ChatInputArea.js';
import { Clock } from './components/layout/Clock.js';
import { SidePanel } from './components/layout/SidePanel.js';
import { GPUInfo } from './components/layout/StatusBar.js';
import { SystemBar } from './components/layout/SystemBar.js';
import { TabBar, tabs } from './components/layout/TabBar.js';
import { BugReportTab } from './components/tabs/BugReportTab.js';
import { ChatTab } from './components/tabs/ChatTab.js';
import { DocsTab } from './components/tabs/DocsTab.js';
import { GitHubTab } from './components/tabs/GitHubTab.js';
import { HooksTab } from './components/tabs/HooksTab.js';
import { MCPTab } from './components/tabs/MCPTab.js';
import { SearchTab } from './components/tabs/SearchTab.js';
import { SettingsTab } from './components/tabs/SettingsTab.js';
import { ToolsTab } from './components/tabs/ToolsTab.js';
import { DialogProvider } from './contexts/DialogContext.js';
import { HooksProvider } from './contexts/HooksContext.js';
import { InputRoutingProvider } from './contexts/InputRoutingContext.js';
import { MCPProvider } from './contexts/MCPContext.js';
import { Terminal2Provider } from './contexts/Terminal2Context.js';
import { TerminalProvider } from './contexts/TerminalContext.js';
import { ToolsProvider } from './contexts/ToolsContext.js';
import { WindowProvider } from './contexts/WindowContext.js';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts.js';
import { useMouse, MouseProvider } from './hooks/useMouse.js';
import { profileManager } from '../features/context/../profiles/ProfileManager.js';
import { ActiveContextProvider } from '../features/context/ActiveContextState.js';
import { ChatProvider, useChat } from '../features/context/ChatContext.js';
import { ContextManagerProvider, useContextManager } from '../features/context/ContextManagerContext.js';
import { FocusProvider, useFocusManager } from '../features/context/FocusContext.js';
import { GPUProvider, useGPU } from '../features/context/GPUContext.js';
import { KeybindsProvider } from '../features/context/KeybindsContext.js';
import { ModelProvider, useModel } from '../features/context/ModelContext.js';
import { ReviewProvider, useReview } from '../features/context/ReviewContext.js';
import { ServiceProvider, useServices } from '../features/context/ServiceContext.js';
import { SettingsProvider } from '../features/context/SettingsContext.js';
import { createWelcomeMessage, createCompactWelcomeMessage, CONTEXT_OPTIONS, ContextSizeOption } from '../features/context/SystemMessages.js';
import { UIProvider, useUI, TabType } from '../features/context/UIContext.js';
import { UserPromptProvider } from '../features/context/UserPromptContext.js';

import type { Config, Theme } from '../config/types.js';
import type { MenuOption } from '../features/context/ChatContext.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '@ollm/core';
// Model loading indicator not currently used here



// Dynamic require for LocalProvider to avoid build-time module resolution errors when bridge isn't installed
declare const require: (moduleName: string) => { LocalProvider: unknown } | unknown;

interface AppContentProps {
  config: Config;
}

function AppContent({ config }: AppContentProps) {
  // Use global UI state for launch screen visibility
  const { state: uiState, setActiveTab, setLaunchScreenVisible } = useUI();
  const { container: serviceContainer } = useServices();
  
  const [debugMode, setDebugMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [lastPressedKey, setLastPressedKey] = useState<string>('None');
  
  // Get terminal dimensions
  const { stdout } = useStdout();
  const terminalHeight = (stdout?.rows || 24) - 1; // reserve 1 for system
  const rawTerminalWidth = stdout?.columns || 100;
  
  // Apply requested 1-char margin on both sides (previously 3)
  const terminalWidth = Math.max(40, rawTerminalWidth); 

  // Layout Calculations for 4-Row Restructuring
  const row1Height = Math.max(3, Math.floor(terminalHeight * 0.05));
  const row3Height = 3; // Fixed height for single line of text + borders
  const row4Height = 8; // Adjusted to 8 as per user request
  
  // Calculate Row 2 (Chat) as remaining space to prevent gaps
  const row2Height = Math.max(18, terminalHeight - row1Height - row3Height - row4Height);

  const leftColumnWidth = Math.max(20, Math.floor(terminalWidth * 0.7));
  const rightColumnWidth = Math.max(20, terminalWidth - leftColumnWidth);
  
  const { state: chatState, contextUsage: _contextUsage, addMessage, activateMenu, requestManualContextInput, scrollUp, scrollDown } = useChat();
  
  // Helper object for shortcuts (so we don't need to change all callbacks below)
  const chatActions = useMemo(() => ({ scrollUp, scrollDown }), [scrollUp, scrollDown]);

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
    const row3End = row2End + row3Height;
    // Row 4 (Input) starts after Row 3
    const row4Start = row3End + 1; // row3End + 1 boundary
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
    } else if (action === 'down' && button === 'right') {
      // Handle Right Click in Input Area (placeholder behavior)
      if (y >= row4Start) {
        chatActions.scrollUp();
      }
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
  const ollamaInitRef = useRef(false);

  const checkOllamaHealth = useCallback(async (host: string, timeoutMs: number): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${host}/api/version`, { signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const startOllamaServe = useCallback((): void => {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.on('error', (error) => {
      console.warn('[Ollama] Failed to start server:', error);
    });
    child.unref();
  }, []);

  const normalizeOllamaHost = useCallback((host: string): string => {
    if (/^https?:\/\//i.test(host)) {
      return host;
    }
    return `http://${host}`;
  }, []);

  useEffect(() => {
    if (ollamaInitRef.current) return;
    ollamaInitRef.current = true;

    const settings = SettingsService.getInstance().getSettings();
    const autoStart = settings.llm?.ollamaAutoStart ?? false;
    const healthCheck = settings.llm?.ollamaHealthCheck ?? true;
    const ollamaHost = normalizeOllamaHost(config.provider.ollama?.host ?? 'http://localhost:11434');

    const run = async (): Promise<void> => {
      if (!healthCheck) return;

      const isHealthy = await checkOllamaHealth(ollamaHost, 2500);
      if (isHealthy) {
        addMessage({ role: 'system', content: 'Ollama is reachable.', excludeFromContext: true });
        return;
      }

      if (!autoStart) {
        addMessage({ role: 'system', content: `Ollama is not reachable at ${ollamaHost}.`, excludeFromContext: true });
        return;
      }

      addMessage({ role: 'system', content: 'Starting Ollama server...', excludeFromContext: true });
      startOllamaServe();

      const maxAttempts = 8;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const ok = await checkOllamaHealth(ollamaHost, 2500);
        if (ok) {
          addMessage({ role: 'system', content: 'Ollama server is ready.', excludeFromContext: true });
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 750));
      }

      addMessage({ role: 'system', content: `Ollama did not respond at ${ollamaHost}.`, excludeFromContext: true });
    };

    void run();
  }, [addMessage, checkOllamaHealth, config.provider.ollama?.host, normalizeOllamaHost, startOllamaServe]);

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

  function getVramGBFromOption(opt: any): number {
    if (!opt) return 0;
    if (typeof opt.vram_estimate_gb === 'number') return opt.vram_estimate_gb;
    if (typeof opt.vramEstimate_gb === 'number') return opt.vramEstimate_gb;
    const candidate = (opt.vram_estimate || (opt as any).vramEstimate || '').toString();
    const match = candidate.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (match) return Number(match[1]);
    return 0;
  }

  function getVramDisplayFromOption(opt: any): string {
    if (!opt) return '';
    if (typeof opt.vram_estimate_gb === 'number') return `${opt.vram_estimate_gb.toFixed(1)} GB`;
    if (typeof opt.vramEstimate_gb === 'number') return `${opt.vramEstimate_gb.toFixed(1)} GB`;
    if (opt.vram_estimate) return opt.vram_estimate;
    if ((opt as any).vramEstimate) return (opt as any).vramEstimate;
    return '';
  }

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
        const vramNum = getVramGBFromOption(opt);
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
            vramStr = getVramDisplayFromOption(opt);
            if (vramStr) vramStr = ` - ${vramStr}`;

            const vramEst = getVramDisplayFromOption(opt) || '';

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
                  const optVram = optIsProfile ? getVramDisplayFromOption(opt) : getVramDisplayFromOption(opt as any);

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

  /**
   * Global Keyboard Shortcuts
   * 
   * All global keyboard shortcuts are now handled by the useGlobalKeyboardShortcuts hook.
   * This provides a centralized location for all shortcuts and makes them easier to maintain.
   * 
   * Shortcuts include:
   * - Tab Navigation: Ctrl+1-9 to switch between tabs
   * - Layout: Ctrl+B (toggle panel), Ctrl+K (command palette), Ctrl+Shift+D (debug)
   * - Chat: Ctrl+L (clear), Ctrl+S (save), Ctrl+C (cancel)
   * - Scroll: Ctrl+PageUp/Down, Meta+Up/Down
   * - Focus: Tab, Shift+Tab, and direct focus shortcuts
   * 
   * See: packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts
   * See: docs/keyboard-shortcuts.md for complete reference
   */
  useGlobalKeyboardShortcuts({
    onToggleDebug: handleToggleDebug,
    onCommandPalette: handleCommandPalette,
    onSaveSession: handleSaveSession,
    onScrollUp: chatActions.scrollUp,
    onScrollDown: chatActions.scrollDown,
  });

  // Debug key logging (only when debug mode is enabled)
  useInput((input, key) => {
    if (debugMode) {
      const keyInfo = `input="${input}", key=${JSON.stringify(key)}`;
      setLastPressedKey(keyInfo);
    }
  }, { isActive: debugMode });

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

  /**
   * Renders the active tab content
   * 
   * This function is responsible for rendering the main content area based on the active tab.
   * The window system (Chat/Terminal/Editor) is managed within the ChatTab component using
   * WindowSwitcher for visual indication.
   * 
   * Architecture Notes:
   * - Each tab is responsible for its own content and layout
   * - The ChatTab handles multiple windows (Chat, Terminal, Editor) internally
   * - Other tabs (Tools, Hooks, Files, etc.) render their own content directly
   * - Height and width are passed down to allow responsive layouts
   * 
   * @param height - Available height for the tab content
   * @param width - Available width for the tab content
   * @returns React element containing the active tab's content
   */
  const renderActiveTab = (height: number, width: number) => {
    const content = (() => {
      switch (uiState.activeTab) {
        case 'chat':
          return (
            <ChatTab
              height={height}
              showBorder={true}
              showWindowSwitcher={true}
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
            <Box flexDirection="column" width={width} height={height}>
              {/* Simple header */}
              <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
                <Box flexDirection="row" justifyContent="space-between">
                  <Text color="cyan" bold>📁 File Explorer</Text>
                  <Text dimColor>
                    <Text color="cyan">↑↓</Text> Navigate | 
                    <Text color="cyan"> Enter</Text> Open | 
                    <Text color="cyan"> F</Text> Focus | 
                    <Text color="cyan"> Ctrl+F</Text> Search | 
                    <Text color="cyan"> ?</Text> Help
                  </Text>
                </Box>
              </Box>
              
              {/* File Explorer */}
              <Box flexGrow={1}>
                <FileExplorerComponent
                  rootPath={process.cwd()}
                  autoLoadWorkspace={true}
                  restoreState={false}
                  excludePatterns={['node_modules', '.git', 'dist', 'coverage']}
                  windowSize={Math.max(10, height - 6)}
                  hasFocus={focusManager.isFocused('file-tree')}
                  toolRegistry={serviceContainer?.getToolRegistry()}
                  policyEngine={serviceContainer?.getPolicyEngine()}
                  messageBus={serviceContainer?.getHookService()?.getMessageBus()}
                />
              </Box>
            </Box>
          );
        case 'search':
          return <SearchTab width={width} />;
        case 'docs':
          return <DocsTab height={height} width={width} />;
        case 'github':
          return <GitHubTab width={width} />;
        case 'settings':
          return <SettingsTab width={width} />;
        case 'bug-report':
          return <BugReportTab width={width} />;
        default:
          return <SearchTab width={width} />;
      }
    })();

    return (
      <Box width={width} height={height}>
        {content}
      </Box>
    );
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
            {/* Left: Clock (separate container) */}
            <Box flexShrink={0} marginLeft={1} marginRight={1} alignItems="center">
              <Clock borderColor={uiState.theme.border.primary} />
            </Box>

            {/* Center: Navigation TabBar (separate container) */}
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
          
          {/* Row 3: System Bar + Window Switcher */}
          <Box height={row3Height} flexDirection="row" width="100%">
            <Box flexGrow={1}>
              <SystemBar height={row3Height} showBorder={true} />
            </Box>
          </Box>
          
          {/* Row 4: User Input Box (25%, Red) */}
          <ChatInputArea height={row4Height} showBorder={true} />
        </Box>

        {/* Right: Full-Height Side Panel (30%) */}
        {uiState.sidePanelVisible && (
          <Box
            // Use the precomputed rightColumnWidth so the side panel fills its column
            width={rightColumnWidth}
            flexShrink={0}
            minHeight={0}
            overflow="hidden"
          >
            <SidePanel
              visible={uiState.sidePanelVisible}
              connection={{ status: 'connected', provider: config.provider.default }}
              model={currentModel || 'model'}
              gpu={gpuInfo as unknown as GPUInfo | null}
              theme={uiState.theme}
              row1Height={row1Height}
              width={rightColumnWidth}
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
          <Text color="yellow">Key: {lastPressedKey}</Text>
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
  const modelEntry = profileManager.getModelEntry(initialModel);
  const modelInfo = {
    parameters: extractModelSize(initialModel),
    contextLimit: persistedContextSize || config.context?.maxSize || 8192,
    contextProfiles: modelEntry.context_profiles || [],
    modelId: initialModel,
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
      threshold: config.context.compressionThreshold ?? 0.68,
      strategy: 'truncate' as const, // Default strategy
      preserveRecent: 4096, // Default recent tokens to preserve
      summaryMaxTokens: 1024, // Default summary max size
    },
    snapshots: {
      enabled: config.context.snapshotsEnabled ?? true,
      maxCount: config.context.maxSnapshots ?? 5,
      autoCreate: true, // Default auto-create enabled
      autoThreshold: 0.85, // Default threshold for auto-creation
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
        <SettingsProvider>
          <KeybindsProvider>
            <WindowProvider>
              <InputRoutingProvider>
                <TerminalProvider>
                  <Terminal2Provider>
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
                                  <WorkspaceProvider>
                                    <FileFocusProvider>
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
                                                  <MouseProvider>
                                                    <AppContent config={config} />
                                                  </MouseProvider>
                                                </ErrorBoundary>
                                              </ActiveContextProvider>
                                            </FocusProvider>
                                          </ReviewProvider>
                                        </AllCallbacksBridge>
                                      </ChatProvider>
                                    </FileFocusProvider>
                                  </WorkspaceProvider>
                                </ModelProvider>
                              </ContextManagerProvider>
                            </GPUProvider>
                        </UserPromptProvider>
                      </MCPProvider>
                    </ToolsProvider>
                  </HooksProvider>
                </ServiceProvider>
                </DialogProvider>
                  </Terminal2Provider>
                </TerminalProvider>
              </InputRoutingProvider>
            </WindowProvider>
          </KeybindsProvider>
        </SettingsProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
