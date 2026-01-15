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
 */

import { useState, useCallback, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { UIProvider, useUI, TabType } from '../contexts/UIContext.js';
import { ChatProvider, useChat } from '../contexts/ChatContext.js';
import { GPUProvider, useGPU } from '../contexts/GPUContext.js';
import { ReviewProvider, useReview } from '../contexts/ReviewContext.js';
import { ContextManagerProvider, useContextUsage } from '../contexts/ContextManagerContext.js';
import { ServiceProvider } from '../contexts/ServiceContext.js';
import { ModelProvider, useModel } from '../contexts/ModelContext.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import { TabBar } from './components/layout/TabBar.js';
import { HeaderBar } from './components/layout/HeaderBar.js';
import { StaticInputArea } from './components/layout/StaticInputArea.js';
import { SidePanel } from './components/layout/SidePanel.js';
import { StatusBar } from './components/layout/StatusBar.js';
import { ChatTab } from './components/tabs/ChatTab.js';
import { ToolsTab } from './components/tabs/ToolsTab.js';
import { FilesTab } from './components/tabs/FilesTab.js';
import { SearchTab } from './components/tabs/SearchTab.js';
import { DocsTab } from './components/tabs/DocsTab.js';
import { SettingsTab } from './components/tabs/SettingsTab.js';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
// Dynamic require for LocalProvider to avoid build-time module resolution errors when bridge isn't installed
declare const require: any;
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
  
  const { clearChat, cancelGeneration, state: chatState, setCurrentInput, sendMessage } = useChat();
  // Context usage (tokens, vram) from ContextManager
  let contextUsage;
  try {
    contextUsage = useContextUsage();
  } catch {
    contextUsage = null;
  }
  const { reviews } = useReview();
  const { info: gpuInfo } = useGPU();
  const { currentModel } = useModel();

  // Extract configuration settings
  const metricsConfig = {
    enabled: config.ui?.metrics?.enabled !== false,
    compactMode: config.ui?.metrics?.compactMode || false,
    showPromptTokens: config.ui?.metrics?.showPromptTokens !== false,
    showTTFT: config.ui?.metrics?.showTTFT !== false,
    showInStatusBar: config.ui?.metrics?.showInStatusBar !== false,
  };

  const reasoningConfig = {
    enabled: config.ui?.reasoning?.enabled !== false,
    maxVisibleLines: config.ui?.reasoning?.maxVisibleLines || 8,
    autoCollapseOnComplete: config.ui?.reasoning?.autoCollapseOnComplete !== false,
  };

  // Apply configuration settings on mount
  useEffect(() => {
    // Load custom theme if specified in config
    // Theme manager would be used here to load custom themes
    // For now, we use the default theme from UIContext
  }, [config]);

  // Handle launch screen dismiss
  const handleDismissLaunch = useCallback(() => {
    setLaunchScreenVisible(false);
  }, [setLaunchScreenVisible]);

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
      handler: () => setActiveTab('chat'),
      description: 'Switch to Chat tab',
    },
    {
      key: 'ctrl+2',
      handler: () => setActiveTab('tools'),
      description: 'Switch to Tools tab',
    },
    {
      key: 'ctrl+3',
      handler: () => setActiveTab('files'),
      description: 'Switch to Files tab',
    },
    {
      key: 'ctrl+4',
      handler: () => setActiveTab('search'),
      description: 'Switch to Search tab',
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
            metricsConfig={metricsConfig}
            reasoningConfig={reasoningConfig}
            columnWidth={leftColumnWidth}
          />
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
        return (
          <ChatTab
            metricsConfig={metricsConfig}
            reasoningConfig={reasoningConfig}
            columnWidth={leftColumnWidth}
          />
        );
    }
  };

  // Calculate notification counts
  const notificationCounts = new Map<TabType, number>();
  uiState.notifications.forEach((notification) => {
    const current = notificationCounts.get(notification.tab) || 0;
    notificationCounts.set(notification.tab, current + notification.count);
  });


  return (
    <Box flexDirection="column" height={terminalHeight} width="100%">
      {/* Static Header Bar at the top */}
      <HeaderBar
        connection={{ status: 'connected', provider: config.provider.default }}
        model={currentModel || 'model'}
        tokens={contextUsage ? { current: contextUsage.currentTokens, max: contextUsage.maxTokens } : { current: chatState.messages.reduce((sum, m) => sum + m.content.length, 0), max: config.context?.maxSize || 4096 }}
        gpu={contextUsage ? {
          available: true,
          vendor: gpuInfo?.vendor || 'unknown',
          vramTotal: contextUsage.vramTotal,
          vramUsed: contextUsage.vramUsed,
          vramFree: Math.max(0, contextUsage.vramTotal - contextUsage.vramUsed),
          temperature: gpuInfo?.temperature || 0,
          temperatureMax: gpuInfo?.temperatureMax || 0,
          gpuUtilization: gpuInfo?.gpuUtilization || 0,
        } : gpuInfo}
        theme={uiState.theme}
        activeTab={uiState.activeTab}
        onTabChange={setActiveTab}
        notifications={notificationCounts}
        contextSize={contextUsage ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}` : (config.context?.maxSize ? String(config.context.maxSize) : undefined)}
      />

      {/* Main content row: left = active tab, right = side panel */}
      <Box flexDirection="row" flexGrow={1} minHeight={0} width="100%">
        {/* Left: Active Tab Content (Chat, Tools, etc.) */}
        <Box width={leftColumnWidth} flexShrink={0} minHeight={0} overflow="hidden">
          {renderActiveTab()}
        </Box>

        {/* Right: Side Panel */}
        {uiState.sidePanelVisible && (
          <Box width={rightColumnWidth} flexShrink={0} minHeight={0}>
            <SidePanel
              visible={uiState.sidePanelVisible}
              sections={[
                {
                  id: 'context',
                  title: 'Context Files',
                  component: () => <Box><Text>Context files section</Text></Box>,
                  collapsed: false,
                },
                {
                  id: 'git',
                  title: 'Git Status',
                  component: () => <Box><Text>Git status section</Text></Box>,
                  collapsed: false,
                },
                {
                  id: 'reviews',
                  title: 'Pending Reviews',
                  component: () => <Box><Text>Reviews section</Text></Box>,
                  collapsed: false,
                },
                {
                  id: 'tools',
                  title: 'Active Tools',
                  component: () => <Box><Text>Tools section</Text></Box>,
                  collapsed: false,
                },
              ]}
              theme={uiState.theme}
            />
          </Box>
        )}
      </Box>

      {/* Static input area at the bottom, always visible */}
      <StaticInputArea
        inputValue={chatState.currentInput}
        onInputChange={setCurrentInput}
        onInputSubmit={async (value) => { if (value.trim()) await sendMessage(value); }}
        userMessages={chatState.messages.filter(m => m.role === 'user').map(m => m.content)}
        statusText={chatState.streaming ? '⠋ Assistant is typing...' : chatState.waitingForResponse ? 'Waiting for response...' : ''}
        streaming={chatState.streaming}
        waitingForResponse={chatState.waitingForResponse}
        theme={uiState.theme}
      />

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
    const providerName = config.provider.default;

    // Try to require the LocalProvider implementation at runtime; fall back to a no-op class if unavailable
    let LocalProviderClass: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@ollm/ollm-bridge/provider/localProvider.js');
      LocalProviderClass = mod?.LocalProvider || mod;
    } catch (err) {
      LocalProviderClass = class {
        constructor(_opts: any) {}
      };
    }

    const ollamaConfig = config.provider.ollama || {
      host: 'http://localhost:11434',
      timeout: 30000,
    };

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
              config={contextConfig}
            >
              <ModelProvider
                provider={provider}
                initialModel={config.model.default}
              >
                <ChatProvider>
                  <ReviewProvider>
                    <ErrorBoundary>
                      <AppContent config={config} />
                    </ErrorBoundary>
                  </ReviewProvider>
                </ChatProvider>
              </ModelProvider>
            </ContextManagerProvider>
          </ServiceProvider>
        </GPUProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
