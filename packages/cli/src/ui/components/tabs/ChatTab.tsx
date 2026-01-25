import React, { useEffect, useMemo, useRef, memo } from 'react';
import { Box, useInput, useStdout, BoxProps } from 'ink';

import { useChat } from '../../../features/context/ChatContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useWindow } from '../../contexts/WindowContext.js';
import { profileRender } from '../../utils/performanceProfiler.js';
import { buildChatLines, ChatHistory, messageHasLargeDiff } from '../chat/ChatHistory.js';
import { EditorMockup } from '../code-editor/EditorMockup.js';
import { Terminal } from '../Terminal.js';
import { WindowSwitcher } from '../WindowSwitcher.js';

export interface ChatTabProps {
  /** Assigned height from layout */
  height: number;
  /** Whether to show debugging border */
  showBorder?: boolean;
  columnWidth?: number;
  metricsConfig?: {
    enabled: boolean;
    compactMode: boolean;
    showPromptTokens?: boolean;
    showTTFT?: boolean;
    showInStatusBar?: boolean;
  };
  reasoningConfig?: {
    enabled: boolean;
    maxVisibleLines: number;
    autoCollapseOnComplete?: boolean;
  };
  showWindowSwitcher?: boolean;
  [key: string]: unknown; // Index signature for profileRender compatibility
}

/**
 * ChatTab component
 * 
 * Main chat interface with message history and input box.
 * This component manages multiple windows (Chat, Terminal, Editor) and displays
 * the active window based on WindowContext state.
 * 
 * Window Management:
 * - Chat: Default window showing message history
 * - Terminal: Interactive terminal for command execution
 * - Editor: Code editor for file editing
 * 
 * The WindowSwitcher component provides visual indication of the active window.
 * 
 * Performance Optimizations:
 * - Memoized with React.memo to prevent unnecessary re-renders
 * - Expensive computations (buildChatLines) are memoized with useMemo
 * - Config objects are memoized to prevent reference changes
 * - Profiling available with OLLM_PROFILE_RENDERS=true
 */
function ChatTabComponent(props: ChatTabProps) {
  // Profile renders for performance monitoring
  profileRender('ChatTab', props);
  const { metricsConfig, reasoningConfig, columnWidth, height, showBorder = true } = props;
  const { state: chatState, scrollOffset, selectedLineIndex, setSelectedLineIndex, updateMessage } = useChat(); 
  const { state: uiState } = useUI();
  const { stdout } = useStdout();
  const { isFocused, exitToNavBar } = useFocusManager();
  const { activeWindow, switchWindow } = useWindow();
  
  const hasFocus = isFocused('chat-history');

  // Use provided config or defaults
  const finalMetricsConfig = useMemo(
    () => metricsConfig || { enabled: true, compactMode: false },
    [metricsConfig]
  );
  const finalReasoningConfig = useMemo(
    () => reasoningConfig || { enabled: true, maxVisibleLines: 8 },
    [reasoningConfig]
  );

  // Memoize layout calculations to prevent recalculation on every render
  const layoutMetrics = useMemo(() => {
    const leftWidth = columnWidth ?? stdout?.columns ?? 80;
    const contentWidth = Math.min(100, Math.max(20, Math.floor(leftWidth * 0.8)));
    const maxVisibleLines = height - 4; // account for border and scroll indicators
    return { leftWidth, contentWidth, maxVisibleLines };
  }, [columnWidth, stdout?.columns, height]);

  // Memoize expensive chat line building operation
  // This is one of the most expensive operations in the chat UI
  const lines = useMemo(() => buildChatLines(
    chatState.messages,
    uiState.theme,
    finalMetricsConfig,
    finalReasoningConfig,
    0,
    layoutMetrics.contentWidth - 2,
    2
  ), [chatState.messages, uiState.theme, finalMetricsConfig, finalReasoningConfig, layoutMetrics.contentWidth]);
  const lastLineCountRef = useRef(0);
  
  // Memoize selected line calculations to avoid recalculating on every render
  const selectedLineData = useMemo(() => {
    const clampedIndex = Math.min(Math.max(selectedLineIndex, 0), Math.max(0, lines.length - 1));
    const selectedLine = lines[clampedIndex];
    const selectedMessage = selectedLine?.messageId
      ? chatState.messages.find(item => item.id === selectedLine.messageId)
      : undefined;
    
    const selectedHasToggle = Boolean(
      (selectedLine?.kind === 'header' &&
        selectedMessage &&
        (selectedMessage.reasoning || selectedMessage.toolCalls?.some(tc => {
          const hasArgs = tc.arguments && Object.keys(tc.arguments).length > 0;
          return hasArgs || Boolean(tc.result);
        }))) ||
      (selectedLine?.kind === 'diff-summary' &&
        selectedMessage &&
        messageHasLargeDiff(selectedMessage.content))
    );
    
    const toggleHint = selectedHasToggle ? 'Left/Right to toggle details' : undefined;
    
    return { selectedLine, selectedMessage, selectedHasToggle, toggleHint };
  }, [selectedLineIndex, lines, chatState.messages]);

  useEffect(() => {
    const total = lines.length;
    const lastLineIndex = Math.max(0, total - 1);
    const previousTotal = lastLineCountRef.current;
    const wasAtBottom = selectedLineIndex >= Math.max(0, previousTotal - 1);

    if (total === 0) {
      setSelectedLineIndex(0);
    } else if (selectedLineIndex > lastLineIndex) {
      setSelectedLineIndex(lastLineIndex);
    } else if (total !== previousTotal && wasAtBottom) {
      setSelectedLineIndex(lastLineIndex);
    }

    lastLineCountRef.current = total;
  }, [lines.length, selectedLineIndex, setSelectedLineIndex]);

  // Note: Scroll logic is now handled in ChatContext + App.tsx global shortcuts
  // This ensures scrolling works even when InputBox is focused.
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.ctrl && key.leftArrow) {
      switchWindow('prev');
      return;
    }
    if (key.ctrl && key.rightArrow) {
      switchWindow('next');
      return;
    }

    if (key.upArrow) {
      setSelectedLineIndex((prev: number) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedLineIndex((prev: number) => Math.min(Math.max(0, lines.length - 1), prev + 1));
      return;
    }
    if ((key.rightArrow || key.leftArrow) && !key.ctrl && !key.meta) {
      const { selectedLine: line, selectedMessage: message } = selectedLineData;
      if (!line?.messageId || !message) return;
      const isDiffSummaryLine = line.kind === 'diff-summary';
      const hasExpandableDiff = isDiffSummaryLine && messageHasLargeDiff(message.content);
      const hasExpandableReasoning = !isDiffSummaryLine && Boolean(message.reasoning);
      const hasExpandableTools = !isDiffSummaryLine && Boolean(message.toolCalls?.some(tc => {
        const hasArgs = tc.arguments && Object.keys(tc.arguments).length > 0;
        return hasArgs || Boolean(tc.result);
      }));
      if (!hasExpandableDiff && !hasExpandableReasoning && !hasExpandableTools) return;
      updateMessage(message.id, { expanded: key.rightArrow ? true : false });
      return;
    }

    // Allow ESC to bubble to global handler (unless in menu)
    if (key.escape && !chatState.menuState.active && input !== '0') return;

    if (input === '0') {
      exitToNavBar();
      return;
    }
  }, { isActive: hasFocus });

  // Memoize window switcher to prevent unnecessary re-renders
  const windowSwitcher = useMemo(() => {
    if (!props.showWindowSwitcher) return null;
    return (
      <Box width="100%" flexShrink={0} flexDirection="row" justifyContent="flex-end" paddingRight={1}>
        <WindowSwitcher />
      </Box>
    );
  }, [props.showWindowSwitcher]);

  return (
    <Box 
      flexDirection="column" 
      height={height} 
      overflow="hidden" 
      width="100%" 
      borderStyle={showBorder ? (uiState.theme.border.style as BoxProps['borderStyle']) : undefined}
      borderColor={hasFocus ? uiState.theme.text.secondary : uiState.theme.border.primary}
    >
        {/* Window Switcher - shows which window is active (Chat/Terminal/Editor) */}
        {windowSwitcher}
        
        {/* Render active window content */}
        {activeWindow === 'chat' && (
          <Box 
            flexDirection="column"
            paddingX={1}
            flexGrow={1}
            flexShrink={1}
          >
            <ChatHistory
              messages={chatState.messages}
              streaming={chatState.streaming}
              waitingForResponse={chatState.waitingForResponse}
              scrollToBottom={true}
              theme={uiState.theme}
              scrollOffset={scrollOffset}
              maxVisibleLines={layoutMetrics.maxVisibleLines}
              paddingY={0}
              metricsConfig={finalMetricsConfig}
              reasoningConfig={finalReasoningConfig}
              width={columnWidth ? columnWidth - 2 : 78} 
              selectedLineIndex={selectedLineIndex}
              lines={lines}
              scrollHintTop={hasFocus ? "Keyboard Up to scroll" : undefined}
              scrollHintBottom={hasFocus ? "Keyboard Down to scroll" : undefined}
              toggleHint={selectedLineData.toggleHint}
            />
          </Box>
        )}
        
        {/* Terminal Window */}
        {activeWindow === 'terminal' && (
          <Box flexGrow={1} width="100%">
            <Terminal 
              height={height - (props.showWindowSwitcher ? 3 : 2)} 
            />
          </Box>
        )}
        
        {/* Editor Window */}
        {activeWindow === 'editor' && (
          <Box flexGrow={1} width="100%">
            <EditorMockup 
              width={columnWidth ? columnWidth - 2 : 78} 
              height={height - (props.showWindowSwitcher ? 4 : 3)} 
            />
          </Box>
        )}
    </Box>
  );
}


/**
 * Memoized ChatTab component
 * 
 * Only re-renders when props actually change, preventing unnecessary
 * re-renders when parent components update.
 * 
 * Custom comparison function ensures we only re-render when meaningful
 * props change (height, width, configs, etc.)
 */
export const ChatTab = memo(ChatTabComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.height === nextProps.height &&
    prevProps.showBorder === nextProps.showBorder &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.showWindowSwitcher === nextProps.showWindowSwitcher &&
    // Deep compare configs (they should be stable references from useMemo)
    prevProps.metricsConfig === nextProps.metricsConfig &&
    prevProps.reasoningConfig === nextProps.reasoningConfig
  );
});
