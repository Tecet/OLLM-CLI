/**
 * Main App Component
 *
 * Responsibilities:
 * - Wire up all context providers
 * - Manage layout and UI state
 * - Handle keyboard shortcuts
 * - Integrate all tabs and components
 *
 * Does NOT:
 * - Calculate context sizes (core does this)
 * - Manage VRAM (core does this)
 * - Build prompts (core does this)
 */

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { Box, useStdout, BoxProps } from 'ink';

import { SettingsService } from '../config/settingsService.js';
import { defaultDarkTheme } from '../config/styles.js';
import { AllCallbacksBridge } from './components/AllCallbacksBridge.js';
import { useContextMenu } from './components/context/ContextMenu.js';
import { DialogManager } from './components/dialogs/DialogManager.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { WorkspaceProvider, FileFocusProvider } from './components/file-explorer/index.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import { ChatInputArea } from './components/layout/ChatInputArea.js';
import { Clock } from './components/layout/Clock.js';
import { HeaderBar } from './components/layout/HeaderBar.js';
import { SidePanel } from './components/layout/SidePanel.js';
import { SystemBar } from './components/layout/SystemBar.js';
import { TabBar } from './components/layout/TabBar.js';
import { BugReportTab } from './components/tabs/BugReportTab.js';
import { ChatTab } from './components/tabs/ChatTab.js';
import { DocsTab } from './components/tabs/DocsTab.js';
import { FilesTabWrapper } from './components/tabs/FilesTabWrapper.js';
import { FileViewerTab } from './components/tabs/FileViewerTab.js';
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
import { ActiveContextProvider } from '../features/context/ActiveContextState.js';
import { ChatProvider, useChat } from '../features/context/ChatContext.js';
import {
  ContextManagerProvider,
  useContextManager,
} from '../features/context/ContextManagerContext.js';
import { FocusProvider, useFocusManager } from '../features/context/FocusContext.js';
import { GPUProvider, useGPU } from '../features/context/GPUContext.js';
import { KeybindsProvider } from '../features/context/KeybindsContext.js';
import { ModelProvider, useModel } from '../features/context/ModelContext.js';
import { ReviewProvider } from '../features/context/ReviewContext.js';
import { ServiceProvider } from '../features/context/ServiceContext.js';
import { SettingsProvider } from '../features/context/SettingsContext.js';
import {
  createWelcomeMessage,
  createCompactWelcomeMessage,
} from '../features/context/SystemMessages.js';
import { UIProvider, useUI } from '../features/context/UIContext.js';
import { UserPromptProvider } from '../features/context/UserPromptContext.js';
import { profileManager } from '../features/profiles/ProfileManager.js';

import type { Config } from '../config/types.js';
import type { ProviderAdapter } from '@ollm/core';

interface AppContentProps {
  config: Config;
}

function AppContent({ config }: AppContentProps) {
  // UI State
  const { state: uiState, setActiveTab, setLaunchScreenVisible } = useUI();

  // Terminal dimensions
  const { stdout } = useStdout();
  const terminalHeight = (stdout?.rows || 24) - 1;
  const rawTerminalWidth = stdout?.columns || 100;
  const terminalWidth = Math.max(40, rawTerminalWidth);

  // Layout calculations
  const row1Height = Math.max(3, Math.floor(terminalHeight * 0.05));
  const row3Height = 3;
  const row4Height = 8;
  const row2Height = Math.max(18, terminalHeight - row1Height - row3Height - row4Height);

  const leftColumnWidth = Math.max(20, Math.floor(terminalWidth * 0.7));
  const rightColumnWidth = Math.max(20, terminalWidth - leftColumnWidth);

  // Chat and context
  const { addMessage, activateMenu, requestManualContextInput, scrollUp, scrollDown } = useChat();
  const chatActions = useMemo(() => ({ scrollUp, scrollDown }), [scrollUp, scrollDown]);
  const { state: contextState, actions: contextActions } = useContextManager();
  const { currentModel, setCurrentModel } = useModel();
  const { info: gpuInfo } = useGPU();
  const focusManager = useFocusManager();

  // Focus states
  const navBarFocused = focusManager.isFocused('nav-bar');
  const chatHistoryFocused = focusManager.isFocused('chat-history');

  // Context menu hook
  const { openContextMenu } = useContextMenu({
    currentModel: currentModel || 'Unknown Model',
    addMessage,
    activateMenu,
    requestManualContextInput,
    contextActions,
    setCurrentModel,
    availableVRAM: gpuInfo?.vramTotal ? gpuInfo.vramTotal / (1024 * 1024 * 1024) : 8, // Convert bytes to GB, use TOTAL VRAM not available
  });

  // Welcome message tracking
  const lastWelcomeModelRef = useRef<string | null>(null);

  // Build welcome message
  const buildWelcomeMessage = useCallback(() => {
    const modelName = currentModel || 'No Model Selected';

    // If no model is available, show a helpful message
    if (!currentModel || currentModel === '') {
      return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'system' as const,
        content: `**Welcome to OLLM CLI!**

No model is currently selected. To get started:

1. Pull a model using: \`/model pull <model-name>\`
   Example: \`/model pull llama3.2:3b\`

2. Or select from available models using the menu below.

**Popular models:**
- \`llama3.2:3b\` - Fast, good for coding (3B parameters)
- \`llama3.2:latest\` - Balanced performance (7B parameters)
- \`codellama:7b\` - Optimized for code generation
- \`mistral:7b\` - High quality general purpose

Type \`/help\` for more commands.`,
        timestamp: new Date(),
      };
    }

    const profile = profileManager.findProfile(modelName);
    const settings = SettingsService.getInstance().getSettings();
    const persistedHW = settings.hardware;

    // Get effective GPU info (live or persisted)
    const effectiveGPUInfo = gpuInfo || {
      model: persistedHW?.gpuName || 'Unknown GPU',
      vendor: 'Unknown',
      total: persistedHW?.totalVRAM || 0,
      vramTotal: (persistedHW?.totalVRAM || 0) * 1024 * 1024 * 1024,
      count: persistedHW?.gpuCount || 1,
    };

    const currentContextSize = contextState.usage.maxTokens;

    if (uiState.sidePanelVisible) {
      return createWelcomeMessage(modelName, currentContextSize, profile, effectiveGPUInfo);
    } else {
      return createCompactWelcomeMessage(modelName, profile);
    }
  }, [currentModel, gpuInfo, contextState.usage.maxTokens, uiState.sidePanelVisible]);

  // Mouse handling
  useMouse((event) => {
    const { x, y, action, button } = event;
    const leftWidth = uiState.sidePanelVisible ? leftColumnWidth - 1 : terminalWidth - 1;
    const rightStart = leftWidth + 1;

    const row1End = row1Height;
    const row2Start = row1End + 1;
    const row2End = row1End + row2Height;
    const row3End = row2End + row3Height;
    const row4Start = row3End + 1;

    const isLeftColumn = x <= leftWidth;
    const isRightColumn = x >= rightStart;

    if (action === 'down' && button === 'left') {
      if (isLeftColumn) {
        if (y <= row1End) {
          focusManager.setFocus('nav-bar');
        } else if (y >= row2Start && y <= row2End) {
          focusManager.activateContent(uiState.activeTab);
        } else if (y >= row4Start) {
          focusManager.setFocus('chat-input');
        }
      } else if (isRightColumn && uiState.sidePanelVisible) {
        const sideHeaderEnd = row1Height;
        const sideFileTreeEnd = sideHeaderEnd + 10;

        if (y <= sideHeaderEnd) {
          // Header click
        } else if (y <= sideFileTreeEnd) {
          focusManager.setFocus('side-file-tree');
        } else {
          focusManager.setFocus('context-panel');
        }
      }
    } else if (action === 'down' && button === 'right') {
      if (y >= row4Start) {
        chatActions.scrollUp();
      }
    } else if (action === 'scroll-down') {
      chatActions.scrollDown();
    }
  });

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onScrollUp: chatActions.scrollUp,
    onScrollDown: chatActions.scrollDown,
  });

  // Handle launch screen dismiss
  const handleLaunchScreenDismiss = useCallback(() => {
    setLaunchScreenVisible(false);

    const welcomeMsg = buildWelcomeMessage();
    addMessage(welcomeMsg);
    lastWelcomeModelRef.current = currentModel || null;
    openContextMenu(welcomeMsg.id);
  }, [setLaunchScreenVisible, currentModel, addMessage, buildWelcomeMessage, openContextMenu]);

  // Register global menu callback
  useEffect(() => {
    globalThis.__ollmOpenModelMenu = () => openContextMenu();
    return () => {
      if (globalThis.__ollmOpenModelMenu) {
        delete globalThis.__ollmOpenModelMenu;
      }
    };
  }, [openContextMenu]);

  // Show launch screen
  if (uiState.launchScreenVisible) {
    return (
      <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
        <LaunchScreen theme={uiState.theme} onDismiss={handleLaunchScreenDismiss} />
      </Box>
    );
  }

  // Main UI
  const leftWidth = uiState.sidePanelVisible ? leftColumnWidth - 1 : terminalWidth - 1;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      <Box width={terminalWidth} height={terminalHeight} flexDirection="row">
        {/* Left Column: All 4 rows */}
        <Box width={leftWidth} flexDirection="column">
          {/* Row 1: Navigation */}
          <Box height={row1Height} flexDirection="row">
            <Clock borderColor={uiState.theme.border.primary} />
            <Box
              flexGrow={1}
              borderStyle={uiState.theme.border.style as BoxProps['borderStyle']}
              borderColor={
                navBarFocused ? uiState.theme.border.active : uiState.theme.border.primary
              }
            >
              <TabBar
                activeTab={uiState.activeTab}
                onTabChange={setActiveTab}
                notifications={new Map()}
                theme={uiState.theme}
                noBorder
              />
            </Box>
          </Box>

          {/* Row 2: Main Content */}
          <Box
            height={row2Height}
            borderStyle={uiState.theme.border.style as BoxProps['borderStyle']}
            borderColor={
              chatHistoryFocused ? uiState.theme.border.active : uiState.theme.border.primary
            }
          >
            {/* Show file viewer if a file is open, otherwise show the active tab */}
            {uiState.fileViewer.isOpen ? (
              <FileViewerTab width={leftWidth} height={row2Height - 2} />
            ) : (
              <>
                {uiState.activeTab === 'chat' && (
                  <ChatTab
                    height={row2Height}
                    showBorder={false}
                    showWindowSwitcher={true}
                    metricsConfig={{
                      enabled: config.ui?.metrics?.enabled !== false,
                      compactMode: config.ui?.metrics?.compactMode || false,
                      showPromptTokens: config.ui?.metrics?.showPromptTokens !== false,
                      showTTFT: config.ui?.metrics?.showTTFT !== false,
                      showInStatusBar: config.ui?.metrics?.showInStatusBar !== false,
                    }}
                    reasoningConfig={{
                      enabled: true,
                      maxVisibleLines: 8,
                      autoCollapseOnComplete: false,
                    }}
                    columnWidth={leftWidth}
                  />
                )}
                {uiState.activeTab === 'tools' && <ToolsTab width={leftWidth} />}
                {uiState.activeTab === 'files' && <FilesTabWrapper width={leftWidth} height={row2Height - 2} />}
                {uiState.activeTab === 'hooks' && <HooksTab windowWidth={leftWidth} />}
                {uiState.activeTab === 'mcp' && <MCPTab windowWidth={leftWidth} height={row2Height - 2} />}
                {uiState.activeTab === 'settings' && <SettingsTab width={leftWidth} />}
                {uiState.activeTab === 'docs' && <DocsTab height={row2Height - 2} width={leftWidth} />}
                {uiState.activeTab === 'search' && <SearchTab width={leftWidth} />}
                {uiState.activeTab === 'github' && <GitHubTab width={leftWidth} />}
                {uiState.activeTab === 'bug-report' && <BugReportTab width={leftWidth} />}
              </>
            )}
          </Box>

          {/* Row 3: System Bar */}
          <Box height={row3Height}>
            <SystemBar height={row3Height} showBorder={false} />
          </Box>

          {/* Row 4: Input Area */}
          <Box height={row4Height}>
            <ChatInputArea height={row4Height} showBorder={true} />
          </Box>
        </Box>

        {/* Right Column: Full height side panel */}
        {uiState.sidePanelVisible && (
          <Box width={rightColumnWidth} flexDirection="column">
            {/* Row 1: Header Bar (GPU + VRAM only) */}
            <HeaderBar
              gpu={gpuInfo as unknown as { model?: string; vendor?: string; vramTotal?: number; vramUsed?: number; temperature?: number; count?: number } | null}
              theme={uiState.theme}
            />

            {/* Rows 2-4: Side Panel (full height with context at bottom) */}
            <SidePanel
              visible={uiState.sidePanelVisible}
              theme={uiState.theme}
              height={row2Height + row3Height + row4Height}
              width={rightColumnWidth}
            />
          </Box>
        )}
      </Box>

      {/* Dialogs */}
      <DialogManager />
    </Box>
  );
}

export interface AppProps {
  config: Config;
}

export function App({ config }: AppProps) {
  // Validate required config properties - fail fast if config is broken
  if (!config) {
    throw new Error('Configuration is required but was not provided');
  }

  if (!config.model) {
    throw new Error('Configuration error: model configuration is missing');
  }

  if (!config.provider) {
    throw new Error('Configuration error: provider configuration is missing');
  }

  if (!config.ui) {
    throw new Error('Configuration error: UI configuration is missing');
  }

  if (!config.status) {
    throw new Error('Configuration error: status configuration is missing');
  }

  if (!config.review) {
    throw new Error('Configuration error: review configuration is missing');
  }

  if (!config.session) {
    throw new Error('Configuration error: session configuration is missing');
  }

  // Context config is optional but if present must be complete
  if (config.context) {
    const ctx = config.context;
    if (typeof ctx.targetSize !== 'number')
      throw new Error('Configuration error: context.targetSize must be a number');
    if (typeof ctx.minSize !== 'number')
      throw new Error('Configuration error: context.minSize must be a number');
    if (typeof ctx.maxSize !== 'number')
      throw new Error('Configuration error: context.maxSize must be a number');
    if (typeof ctx.autoSize !== 'boolean')
      throw new Error('Configuration error: context.autoSize must be a boolean');
    if (typeof ctx.vramBuffer !== 'number')
      throw new Error('Configuration error: context.vramBuffer must be a number');
  }

  const settings = SettingsService.getInstance().getSettings();
  const persistedModel = settings.llm?.model;

  // Get config model default - ensure it's a string
  const configModelDefault = typeof config.model.default === 'string' ? config.model.default : '';

  // Try to get a model from: 1) persisted settings, 2) config, 3) first available model, 4) empty string
  let initialModel: string =
    (typeof persistedModel === 'string' ? persistedModel : '') || configModelDefault;

  // If no model is configured, try to get the first available model from profileManager
  if (!initialModel) {
    const userModels = profileManager.getUserModels();
    if (userModels.length > 0) {
      initialModel = userModels[0].id;
    } else {
      // No models available - use empty string and let the UI handle it
      initialModel = '';
    }
  }

  // Extract model size from model name for VRAM calculations
  const extractModelSize = (modelName: string): number => {
    if (!modelName || modelName === '') return 7; // Default to 7B if no model name
    const match = modelName.match(/(\d+\.?\d*)b/i);
    if (match) {
      return parseFloat(match[1]);
    }
    return 7; // Default to 7B
  };

  const workspacePath = process.cwd();
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [currentAppModel, setCurrentAppModel] = useState(initialModel);
  const initialSidePanelVisible = config.ui.sidePanel !== false;

  // Expose global function for ModelContext to call on model swap
  useEffect(() => {
    (globalThis as any).__ollmResetSession = (newModel: string) => {
      const newSessionId = `session-${Date.now()}`;
      console.log(`[App] Model changed to ${newModel}, creating new session: ${newSessionId}`);
      setCurrentAppModel(newModel); // Update current model
      setSessionId(newSessionId);
      return newSessionId;
    };

    return () => {
      delete (globalThis as any).__ollmResetSession;
    };
  }, []);

  // Compute modelInfo dynamically based on current model
  const modelEntry = currentAppModel ? profileManager.getModelEntry(currentAppModel) : null;
  const modelInfo = {
    parameters: extractModelSize(currentAppModel),
    contextLimit: config.context?.maxSize || 8192,
    contextProfiles: (modelEntry?.context_profiles || []).map((profile) => ({
      ...profile,
      ollama_context_size: profile.ollama_context_size ?? Math.floor(profile.size * 0.85),
    })),
    modelId: currentAppModel || 'no-model',
  };

  // Context manager configuration
  const contextConfig = config.context
    ? {
        targetSize: config.context.targetSize,
        minSize: config.context.minSize,
        maxSize: config.context.maxSize,
        autoSize: config.context.autoSize,
        vramBuffer: config.context.vramBuffer,
        compression: {
          enabled: config.context.compressionEnabled,
          threshold: config.context.compressionThreshold ?? 0.68,
          strategy: 'truncate' as const,
          preserveRecent: 4096,
          summaryMaxTokens: 1024,
        },
        snapshots: {
          enabled: config.context.snapshotsEnabled ?? true,
          maxCount: config.context.maxSnapshots ?? 5,
          autoCreate: true,
          autoThreshold: 0.85,
        },
      }
    : undefined;

  // Create provider adapter
  const provider = (() => {
    let LocalProviderClass: {
      new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter;
    } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@ollm/ollm-bridge/provider/localProvider.js') as
        | { LocalProvider: { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter } }
        | { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter };
      LocalProviderClass =
        ((mod as Record<string, unknown>).LocalProvider as {
          new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter;
        }) || mod;
    } catch (err) {
      console.warn('Failed to load LocalProvider, using no-op provider:', err);
      LocalProviderClass = class implements ProviderAdapter {
        readonly name = 'no-op';
        constructor(_opts: { baseUrl: string; timeout?: number }) {}
        async *chatStream(
          _req: unknown
        ): AsyncIterable<{ type: 'error'; error: { message: string } }> {
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
      baseUrl: ollamaConfig.host || 'http://localhost:11434',
      timeout: ollamaConfig.timeout || 30000,
    });
  })();

  // Load initial theme
  const initialThemeName =
    SettingsService.getInstance().getTheme() || config.ui.theme || 'default-dark';
  let initialTheme = defaultDarkTheme;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { builtInThemes } = require('../config/styles.js') as {
      builtInThemes: Record<string, unknown>;
    };
    if (builtInThemes[initialThemeName]) {
      initialTheme = builtInThemes[initialThemeName] as typeof defaultDarkTheme;
    }
  } catch (e) {
    console.warn('Failed to load initial theme from built-ins, using default:', e);
  }

  return (
    <ErrorBoundary>
      <MouseProvider>
        <UIProvider initialSidePanelVisible={initialSidePanelVisible} initialTheme={initialTheme}>
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
                                    pollingInterval={config.status.pollInterval}
                                    autoStart={config.ui.showGpuStats !== false}
                                  >
                                    <ContextManagerProvider
                                      key={sessionId}
                                      sessionId={sessionId}
                                      modelInfo={modelInfo}
                                      modelId={currentAppModel}
                                      config={contextConfig}
                                      provider={provider}
                                    >
                                      <ModelProvider
                                        provider={provider}
                                        initialModel={currentAppModel}
                                      >
                                        <WorkspaceProvider>
                                          <FileFocusProvider>
                                            <ChatProvider>
                                              <AllCallbacksBridge
                                                onOpenModelMenu={() => {
                                                  if (globalThis.__ollmOpenModelMenu) {
                                                    globalThis.__ollmOpenModelMenu();
                                                  }
                                                }}
                                              >
                                                <ReviewProvider>
                                                  <FocusProvider>
                                                    <ActiveContextProvider>
                                                      <AppContent config={config} />
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
      </MouseProvider>
    </ErrorBoundary>
  );
}
