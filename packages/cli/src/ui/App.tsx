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

import { useState, useCallback, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { UIProvider, useUI, TabType } from '../features/context/UIContext.js';
import { ChatProvider, useChat } from '../features/context/ChatContext.js';
import { GPUProvider, useGPU } from '../features/context/GPUContext.js';
import { ReviewProvider, useReview } from '../features/context/ReviewContext.js';
import { ServiceProvider } from '../features/context/ServiceContext.js';
import { ContextManagerProvider, useContextManager } from '../features/context/ContextManagerContext.js';
import { ModelProvider, useModel } from '../features/context/ModelContext.js';
import { ActiveContextProvider } from '../features/context/ActiveContextState.js';
import { DialogProvider } from './contexts/DialogContext.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '@ollm/core';
import { createWelcomeMessage, CONTEXT_OPTIONS } from '../features/context/SystemMessages.js';
import type { MenuOption } from '../features/context/ChatContext.js';
import { profileManager } from '../features/context/../profiles/ProfileManager.js';
import { settingsManager } from '../features/settings/SettingsManager.js';

import { HeaderBar } from './components/layout/HeaderBar.js';
import { ChatInputArea } from './components/layout/ChatInputArea.js';
import { SidePanel } from './components/layout/SidePanel.js';
import { ContextSection } from './components/layout/ContextSection.js';

import { ChatTab } from './components/tabs/ChatTab.js';
import { ToolsTab } from './components/tabs/ToolsTab.js';
import { FilesTab } from './components/tabs/FilesTab.js';
import { SearchTab } from './components/tabs/SearchTab.js';
import { DocsTab } from './components/tabs/DocsTab.js';
import { SettingsTab } from './components/tabs/SettingsTab.js';
import { DialogManager } from './components/dialogs/DialogManager.js';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
// Dynamic require for LocalProvider to avoid build-time module resolution errors when bridge isn't installed
declare const require: (moduleName: string) => { LocalProvider: unknown } | unknown;
import type { Config } from '../config/types.js';

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
  const terminalHeight = stdout?.rows || 24; // Default to 24 if not available
  const terminalWidth = stdout?.columns || 80;
  const leftColumnWidth = Math.max(20, Math.floor(terminalWidth * 0.7));
  const rightColumnWidth = Math.max(20, terminalWidth - leftColumnWidth);
  
  const { state: chatState, clearChat, cancelGeneration, contextUsage, addMessage, activateMenu } = useChat();
  useReview();
  const { info: gpuInfo } = useGPU();
  const { currentModel } = useModel();
  const { actions: contextActions } = useContextManager();


  // Apply configuration settings on mount
  useEffect(() => {
    // Load custom theme if specified in config
    // Theme manager would be used here to load custom themes
    // For now, we use the default theme from UIContext
  }, [config]);

  // Persist hardware info when available
  useEffect(() => {
    if (gpuInfo) {
      settingsManager.updateHardwareInfo({
        gpuCount: 1, // Default/Placeholder
        totalVRAM: gpuInfo.total,
        gpuName: gpuInfo.name
      });
    }
  }, [gpuInfo]);

  // Persist hardware info when available
  useEffect(() => {
    if (gpuInfo) {
      settingsManager.updateHardwareInfo({
        gpuCount: 1, // Default/Placeholder as useGPU doesn't seem to export count based on file view
        totalVRAM: gpuInfo.total,
        gpuName: 'Unknown' // Placeholder
      });
    }
  }, [gpuInfo]);

  // Handle launch screen dismiss
  const handleDismissLaunch = useCallback(() => {
    setLaunchScreenVisible(false);
    
    // Create and show welcome message
    // Create and show welcome message
    const currentContextSize = contextUsage?.maxTokens || 4096;
    const modelName = currentModel || 'Unknown Model';
    
    // Lookup profile
    const profile = profileManager.findProfile(modelName);
    
    const welcomeMsg = createWelcomeMessage(modelName, currentContextSize, profile, gpuInfo);
    
    addMessage(welcomeMsg);
    
    // Calculate max safe context for "Auto" logic
    // Same logic as in SystemMessages to ensure consistency
    const persistedHW = settingsManager.getHardwareInfo();
    const effectiveTotalVRAM = gpuInfo ? gpuInfo.total : (persistedHW?.totalVRAM || 0);

    const SAFETY_BUFFER_GB = effectiveTotalVRAM > 0 ? Math.max(1.5, effectiveTotalVRAM * 0.1) : 0;
    const availableForContextGB = effectiveTotalVRAM > 0 ? (effectiveTotalVRAM - SAFETY_BUFFER_GB) : 0;
    
    // Calculate max safe context for "Auto" logic (80% rule)
    const targetVRAM = effectiveTotalVRAM * 0.8;
    
    let maxSafeSize = 4096; 
    if (profile) {
        for (const opt of profile.context_profiles) {
            const vramNum = parseFloat(opt.vram_estimate.replace(' GB', ''));
            // Use 80% rule
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
          // Sub-menu: Context Size
          const optionsToUse = profile ? profile.context_profiles : CONTEXT_OPTIONS;
          
          const sizeOptions: MenuOption[] = [];
          
          // 1. Auto Option
          sizeOptions.push({
             id: 'size-auto',
             label: 'Auto (Dynamic based on VRAM)',
             action: async () => {
                const targetSize = maxSafeSize;
                await contextActions.resize(targetSize);
                addMessage({
                    role: 'system',
                    content: `Context size automatically set to **${targetSize}** tokens based on available VRAM.`,
                    excludeFromContext: true
                });
                activateMenu(mainMenuOptions, welcomeMsg.id); // Return to main menu
             }
          });

          // 2...N Size Options
          optionsToUse.forEach(opt => {
             const val = 'size' in opt ? opt.size : opt.value;
             
             // Use JSON label if available (e.g. "4k") or fallback to calculation
             let sizeStr = `${val}`;
             if ('size_label' in opt && opt.size_label) {
                 sizeStr = opt.size_label;
             } else {
                 sizeStr = val >= 1024 ? `${val/1024}k` : `${val}`;
             }
             
             // Get VRAM estimate if available
             let vramStr = '';
             if ('vram_estimate' in opt) {
                 vramStr = ` - ${opt.vram_estimate}`;
             }

             let label = `${sizeStr}${vramStr}`;
             
             // Check if within hard VRAM limit (not just recommended)
             let disabled = false;
             let vramNum = 0;
             // Handle both naming conventions (camelCase vs snake_case)
             const vramEst = 'vram_estimate' in opt ? opt.vram_estimate : ('vramEstimate' in opt ? opt.vramEstimate : '');
             
             if (vramEst) {
                 vramNum = parseFloat(vramEst.replace(' GB', ''));
                 if (!isNaN(vramNum) && vramNum > availableForContextGB) {
                     disabled = true;
                 }
             }

             if (disabled) {
                 label += ' (Unsafe - Low VRAM)';
             } else if (val === maxSafeSize) {
                 label += ' (Recommended)';
             }

             sizeOptions.push({
                id: `size-${val}`,
                label: label,
                value: val,
                disabled: disabled,
                action: async () => {
                  if (disabled) {
                       addMessage({
                        role: 'system',
                        content: `**⚠️ Cannot Select Context Size**\nRequired VRAM (~${vramEst}) exceeds available system resources (~${availableForContextGB.toFixed(1)} GB).`,
                        excludeFromContext: true
                      });
                      // Don't close menu, just show warning
                      return;
                  }
                  await contextActions.resize(val);
                  addMessage({
                    role: 'system',
                    content: `Context size updated to **${sizeStr}** (${val} tokens).`,
                    excludeFromContext: true
                  });
                   activateMenu(mainMenuOptions, welcomeMsg.id); // Return to main menu
                }
             });
          });

          // 9. Back Option (Mapped to 9 key by ChatInputArea)
          sizeOptions.push({
              id: 'opt-back',
              label: 'Back',
              action: () => {
                  activateMenu(mainMenuOptions, welcomeMsg.id);
              }
          });
          
          // 0. Exit Option (Mapped to 0 key by ChatInputArea)
          sizeOptions.push({
             id: 'opt-exit',
             label: 'Move to Chat',
             action: async () => {
                 // Nothing needed, ChatInputArea handles closure
             }
          });
          
          activateMenu(sizeOptions, welcomeMsg.id);
        }
      },
      {
        id: 'opt-model',
        label: 'Change Model',
        action: () => {
           // Sub-menu: Change Model
           const profiles = profileManager.getProfiles();
           const modelOptions: MenuOption[] = profiles.map(p => ({
               id: `model-${p.id}`,
               label: p.name,
               action: async () => {
                   // In a real scenario, this would trigger model loading.
                   // Show model info
                   const infoMsg = `
**Selected Model:** ${p.name}
*${p.description}*
**Abilities:** ${p.abilities.join(', ')}
${p.tool_support ? '🛠️ **Tool Support:** Enabled' : ''}

**Select Context Size for this model:**
`.trim();
                    
                    addMessage({
                        role: 'system',
                        content: infoMsg,
                        excludeFromContext: true
                    });

                    // Re-calculate safe size for this specific model (80% rule)
                    let safeSizeForModel = 4096;
                    
                    const persistedHW = settingsManager.getHardwareInfo();
                    const cardTotal = gpuInfo ? gpuInfo.total : (persistedHW?.totalVRAM || 0);
                    const safeLimit = cardTotal * 0.8;
                    // To be consistent with handleDismissLaunch, let's recalculate accurately:
                    const safetyBuffer = cardTotal > 0 ? Math.max(1.5, cardTotal * 0.1) : 0;
                    const availableForCtx = cardTotal > 0 ? (cardTotal - safetyBuffer) : 0;

                    for (const opt of p.context_profiles) {
                        const vramNum = parseFloat(opt.vram_estimate.replace(' GB', ''));
                        if (!isNaN(vramNum) && vramNum <= safeLimit) {
                            safeSizeForModel = opt.size;
                        }
                    }

                    const modelContextOptions: MenuOption[] = [];
                    // Auto
                    modelContextOptions.push({
                        id: 'model-size-auto',
                        label: 'Auto (Dynamic)',
                        action: async () => {
                            // "Load" model logic here in future
                            await contextActions.resize(safeSizeForModel);
                             addMessage({
                                role: 'system',
                                content: `Selected **${p.name}** with Auto context (**${safeSizeForModel}** tokens). \n*(Note: Model switching is simulated)*`,
                                excludeFromContext: true
                            });
                             activateMenu(mainMenuOptions, welcomeMsg.id);
                        }
                    });

                    // Sizes
                    p.context_profiles.forEach(opt => {
                         const sizeStr = opt.size_label || (opt.size >= 1024 ? `${opt.size/1024}k` : `${opt.size}`);
                         const vramStr = ` - ${opt.vram_estimate}`;
                         
                         let disabled = false;
                         const vramNum = parseFloat(opt.vram_estimate.replace(' GB', ''));
                         if (!isNaN(vramNum) && vramNum > availableForCtx) { // Hard limit check
                             disabled = true;
                         }

                         let label = `${sizeStr}${vramStr}`;
                         if (disabled) {
                             label += ' (Unsafe - Low VRAM)';
                         } else if (opt.size === safeSizeForModel) {
                             label += ' (Recommended)';
                         }
                         
                         modelContextOptions.push({
                             id: `model-size-${opt.size}`,
                             label: label,
                             disabled: disabled,
                             action: async () => {
                                 if (disabled) {
                                      addMessage({
                                        role: 'system',
                                        content: `**⚠️ Cannot Select Context Size**\nRequired VRAM (~${opt.vram_estimate}) exceeds available system resources (~${availableForContextGB.toFixed(1)} GB).`,
                                        excludeFromContext: true
                                      });
                                      return;
                                 }

                                 await contextActions.resize(opt.size);
                                 addMessage({
                                    role: 'system',
                                    content: `Selected **${p.name}** with **${sizeStr}** context. \n*(Note: Model switching is simulated)*`,
                                    excludeFromContext: true
                                });
                                 activateMenu(mainMenuOptions, welcomeMsg.id);
                             }
                         });
                    });

                    // Back
                    modelContextOptions.push({
                        id: 'opt-back',
                        label: 'Back to Models',
                        action: () => {
                             // Go back to model list
                             activateMenu(modelOptions, welcomeMsg.id); 
                        }
                    });
                    
                    // Exit
                    modelContextOptions.push({
                        id: 'opt-exit',
                        label: 'Move to Chat',
                        action: async () => {} 
                    });

                    activateMenu(modelContextOptions, welcomeMsg.id);
               }
           }));

           // Back to Main
           modelOptions.push({
               id: 'opt-back',
               label: 'Back',
               action: () => {
                   activateMenu(mainMenuOptions, welcomeMsg.id);
               }
           });
           
           // Exit
           modelOptions.push({
               id: 'opt-exit',
               label: 'Move to Chat',
               action: async () => {} 
           });

           activateMenu(modelOptions, welcomeMsg.id);
        }
      },
      {
         // Main Menu Exit Option
         id: 'opt-exit',
         label: 'Move to Chat',
         action: async () => {}
      }
    ];

    activateMenu(mainMenuOptions, welcomeMsg.id);
  }, [setLaunchScreenVisible, contextUsage, currentModel, addMessage, activateMenu, contextActions, gpuInfo]);

  // Handle save session
  const handleSaveSession = useCallback(async () => {
    // TODO: Implement session save
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
    // Tab navigation (Ctrl+1-6)
    {
      key: 'ctrl+1',
      handler: () => setActiveTab('search'),
      description: 'Switch to Search tab',
    },
    {
      key: 'ctrl+2',
      handler: () => setActiveTab('files'),
      description: 'Switch to Files tab',
    },
    {
      key: 'ctrl+3',
      handler: () => setActiveTab('github'),
      description: 'Switch to GitHub tab',
    },
    {
      key: 'ctrl+4',
      handler: () => setActiveTab('tools'),
      description: 'Switch to Tools tab',
    },
    {
      key: 'ctrl+5',
      handler: () => setActiveTab('docs'),
      description: 'Switch to Docs tab',
    },
    {
      key: 'ctrl+6',
      handler: () => setActiveTab('settings'),
      description: 'Switch to Settings tab',
    },
    
    // Layout shortcuts
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
    
    // Chat shortcuts
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
      handler: cancelGeneration,
      description: 'Cancel current action',
    },
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
  const renderActiveTab = () => {
    switch (uiState.activeTab) {
      case 'chat':
        return (
          <ChatTab
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
            columnWidth={leftColumnWidth}
          />
        );
      case 'github':
        return (
          <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
            <Text color={uiState.theme.text.accent} bold>
              GitHub Integration (Coming Soon)
            </Text>
            <Box marginTop={1} justifyContent="center" flexShrink={0}>
                <Text color={uiState.theme.text.secondary} dimColor>
                Press Esc to return to Chat
                </Text>
            </Box>
          </Box>
        );
      case 'tools':
        return <ToolsTab />;
      case 'files':
        return <FilesTab />;
      case 'search':
        return <SearchTab />;
      case 'docs':
        return <DocsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <SearchTab />;
    }
  };

  // Calculate notification counts
  const notificationCounts = new Map<TabType, number>();
  uiState.notifications.forEach((notification) => {
    const current = notificationCounts.get(notification.tab) || 0;
    notificationCounts.set(notification.tab, current + notification.count);
  });


  return (
    <Box flexDirection="column" height={terminalHeight - 1} width="100%">
      {/* Main content row: left = header + chat content + input, right = full-height side panel */}
      <Box flexDirection="row" flexGrow={1} minHeight={0} width="100%">
        {/* Left: Header + Chat/Tab Content + Input Area (70%) */}
        <Box 
            width={leftColumnWidth} 
            flexDirection="column" 
            flexShrink={0} 
            minHeight={0}
        >
          <HeaderBar
            connection={{ status: 'connected', provider: config.provider.default }}
            model={currentModel || 'model'}
            gpu={gpuInfo}
            theme={uiState.theme}
          />
          <Box flexGrow={1} minHeight={0} overflow="hidden">
            {renderActiveTab()}
          </Box>
          
          {/* New: Context Tokens Display area (Yellow Box) */}
          <Box flexDirection="row" justifyContent="flex-end" paddingX={1}>
            <Box 
              borderStyle="single" 
              borderColor="#dcdcaa" 
              paddingX={1}
            >
              <Text color={uiState.theme.text.secondary}>Context: </Text>
              <Text color={uiState.theme.text.accent} bold>
                {contextUsage ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}` : `0/${config.context?.maxSize || 4096}`}
              </Text>
            </Box>
          </Box>
          
          <ChatInputArea />
        </Box>

        {/* Right: Full-Height Side Panel (30%) */}
        {uiState.sidePanelVisible && (
          <Box width={rightColumnWidth} flexShrink={0} minHeight={0}>
            <SidePanel
              visible={uiState.sidePanelVisible}
              activeTab={uiState.activeTab}
              onTabChange={setActiveTab}
              notifications={notificationCounts}
              sections={[
                {
                  id: 'context',
                  title: 'Active Context',
                  component: ContextSection,
                  collapsed: false,
                },
              ]}
              theme={uiState.theme}
            />
          </Box>
        )}
      </Box>

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
          borderColor={uiState.theme.text.accent}
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
                gpuInfo={gpuInfo}
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
  // Extract UI settings from config
  const initialSidePanelVisible = config.ui?.sidePanel !== false;
  
  // Generate a session ID for context management
  const sessionId = `session-${Date.now()}`;
  
  // Model info for context sizing (from config or defaults)
  const modelInfo = {
    parameters: 7, // 7B default - could be derived from model name
    contextLimit: config.context?.maxSize || 8192,
  };
  
  // Context manager configuration - maps CLI config to core config format
  const contextConfig = config.context ? {
    targetSize: config.context.targetSize,
    minSize: config.context.minSize,
    maxSize: config.context.maxSize,
    autoSize: config.context.autoSize,
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
  
  // Get workspace path (if available)
  const workspacePath = process.cwd();
  
  return (
    <ErrorBoundary>
      <UIProvider 
        initialSidePanelVisible={initialSidePanelVisible}
      >
        <DialogProvider>
          <GPUProvider 
            pollingInterval={config.status?.pollInterval || 5000}
            autoStart={config.ui?.showGpuStats !== false}
          >
          <ServiceProvider
            provider={provider}
            config={config}
            workspacePath={workspacePath}
          >
            <ContextManagerProvider
              sessionId={sessionId}
              modelInfo={modelInfo}
              modelId={config.model.default}
              config={contextConfig}
              provider={provider}
            >
              <ModelProvider
                provider={provider}
                initialModel={config.model.default}
              >
                <ChatProvider>
                  <ReviewProvider>
                    <ActiveContextProvider>
                      <ErrorBoundary>
                        <AppContent config={config} />
                      </ErrorBoundary>
                    </ActiveContextProvider>
                  </ReviewProvider>
                </ChatProvider>
              </ModelProvider>
            </ContextManagerProvider>
          </ServiceProvider>
        </GPUProvider>
        </DialogProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
