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
import { Box, Text } from 'ink';
import { UIProvider, useUI, TabType } from '../contexts/UIContext.js';
import { ChatProvider, useChat } from '../contexts/ChatContext.js';
import { GPUProvider, useGPU } from '../contexts/GPUContext.js';
import { ReviewProvider, useReview } from '../contexts/ReviewContext.js';
import { ContextManagerProvider } from '../contexts/ContextManagerContext.js';
import { ServiceProvider } from '../contexts/ServiceContext.js';
import { ModelProvider, useModel } from '../contexts/ModelContext.js';
import { LaunchScreen } from './components/launch/LaunchScreen.js';
import { TabBar } from './components/layout/TabBar.js';
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
import { LocalProvider } from '@ollm/ollm-bridge/provider/localProvider.js';
import type { Config } from '../config/types.js';

interface AppContentProps {
  config: Config;
}

function AppContent({ config }: AppContentProps) {
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  const { state: uiState, setActiveTab, toggleSidePanel } = useUI();
  const { clearChat, cancelGeneration, state: chatState } = useChat();
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
    setShowLaunchScreen(false);
  }, []);

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
  if (showLaunchScreen) {
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
        return <ChatTab metricsConfig={metricsConfig} reasoningConfig={reasoningConfig} />;
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
        return <ChatTab metricsConfig={metricsConfig} reasoningConfig={reasoningConfig} />;
    }
  };

  // Calculate notification counts
  const notificationCounts = new Map<TabType, number>();
  uiState.notifications.forEach((notification) => {
    const current = notificationCounts.get(notification.tab) || 0;
    notificationCounts.set(notification.tab, current + notification.count);
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Tab Bar */}
      <TabBar
        activeTab={uiState.activeTab}
        onTabChange={setActiveTab}
        notifications={notificationCounts}
        theme={uiState.theme}
      />

      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Active Tab Content */}
        <Box flexGrow={1}>
          {renderActiveTab()}
        </Box>

        {/* Side Panel */}
        {uiState.sidePanelVisible && (
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
        )}
      </Box>

      {/* Status Bar - integrated with GPU monitoring */}
      <StatusBar
        connection={{ status: 'connected', provider: config.provider.default }}
        model={currentModel}
        tokens={{ current: chatState.messages.reduce((sum, m) => sum + m.content.length, 0), max: 4096 }}
        git={{ branch: 'main', staged: 0, modified: 0 }}
        gpu={gpuInfo}
        reviews={reviews.length}
        cost={0}
        theme={uiState.theme}
      />

      {/* Debug overlay */}
      {debugMode && (
        <Box
          padding={1}
          borderStyle="single"
          borderColor="yellow"
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
    
    if (providerName === 'ollama' || providerName === 'local') {
      const ollamaConfig = config.provider.ollama || {
        host: 'http://localhost:11434',
        timeout: 30000,
      };
      
      return new LocalProvider({
        baseUrl: ollamaConfig.host,
        timeout: ollamaConfig.timeout,
      });
    }
    
    // TODO: Add vLLM and OpenAI-compatible providers
    // For now, default to Ollama
    return new LocalProvider({
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
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
