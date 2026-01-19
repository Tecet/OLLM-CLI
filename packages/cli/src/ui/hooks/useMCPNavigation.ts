/**
 * useMCPNavigation - Navigation hook for MCP Panel UI
 * 
 * Manages keyboard navigation and focus state for the MCP panel following
 * the Browse Mode/Active Mode pattern.
 * 
 * Features:
 * - Exit item at position 0 with proper navigation
 * - Up/Down arrow navigation between Exit and servers
 * - Left/Right toggle for server enabled/disabled state
 * - Enter key for expand/collapse (Exit exits, server expands)
 * - Esc/0 to exit Active Mode (auto-saves changes)
 * - Action keys (M, H, O, V, C, R, L, I, U) when server selected
 * - Windowed rendering for performance with 20+ servers
 * - Auto-scroll to keep selected item visible
 * - Scroll indicators (top/bottom)
 * 
 * Validates: Requirements 12.1-12.15
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Key } from 'ink';
import { useMCP } from '../contexts/MCPContext.js';
import { useFocusManager } from '../../features/context/FocusContext.js';

/**
 * Action callbacks for navigation events
 */
export interface NavigationActions {
  /** Toggle server enabled/disabled */
  onToggle: (serverName: string) => void;
  /** Open server configuration dialog */
  onConfigure: () => void;
  /** Open OAuth configuration dialog */
  onOAuth: () => void;
  /** View server tools */
  onViewTools: () => void;
  /** Restart server */
  onRestart: () => void;
  /** View server logs */
  onLogs: () => void;
  /** Open marketplace */
  onMarketplace: () => void;
  /** Open health monitor */
  onHealth: () => void;
  /** Install server (in marketplace) */
  onInstall: () => void;
  /** Uninstall server */
  onUninstall: () => void;
}

/**
 * Navigation state and handlers
 */
export interface MCPNavigationState {
  // State
  /** Current selected server index (0-based, -1 when on Exit) */
  selectedIndex: number;
  /** Whether Exit item is selected */
  isOnExitItem: boolean;
  /** Set of expanded server names */
  expandedServers: Set<string>;
  /** Scroll offset for windowed rendering */
  scrollOffset: number;
  /** Whether in Active Mode */
  isActive: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  
  // Windowed rendering
  /** Visible servers in current window */
  visibleServers: Array<any>;
  /** Show scroll up indicator */
  showScrollUp: boolean;
  /** Show scroll down indicator */
  showScrollDown: boolean;
  
  // Actions
  /** Handle keyboard input */
  handleKeyPress: (input: string, key: Key, actions: NavigationActions) => void;
  /** Toggle server expand/collapse */
  toggleServer: (serverName: string) => void;
  /** Save pending changes */
  saveChanges: () => Promise<void>;
}

/**
 * Hook for MCP panel navigation
 */
export function useMCPNavigation(): MCPNavigationState {
  const { state } = useMCP();
  const { servers } = state;
  const { isFocused, exitToNavBar } = useFocusManager();
  
  // Navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOnExitItem, setIsOnExitItem] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Convert servers Map to array for indexing
  const serverList = useMemo(() => Array.from(servers.values()), [servers]);
  
  // Check if panel is active
  const isActive = isFocused('mcp-panel');
  
  // Windowed rendering configuration
  const terminalHeight = typeof process !== 'undefined' && process.stdout?.rows ? process.stdout.rows : 24;
  const headerRows = 3; // Header + spacing
  const footerRows = 2; // Actions footer
  const availableRows = terminalHeight - headerRows - footerRows;
  const windowSize = Math.max(5, availableRows - 4); // Reserve space for scroll indicators
  
  // Calculate visible window
  const totalItems = 1 + serverList.length; // Exit item + servers
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(scrollOffset + windowSize, totalItems);
  const visibleServers = useMemo(() => {
    return serverList.slice(
      Math.max(0, scrollOffset - 1), // Adjust for Exit item
      Math.max(0, visibleEnd - 1)
    );
  }, [serverList, scrollOffset, visibleEnd]);
  
  // Scroll indicators
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = visibleEnd < totalItems;
  
  /**
   * Adjust scroll offset to keep selected item visible
   */
  const adjustScroll = useCallback((index: number) => {
    const position = index + 1; // Account for Exit item at position 0
    
    if (position < scrollOffset) {
      // Scroll up to show item
      setScrollOffset(position);
    } else if (position >= scrollOffset + windowSize) {
      // Scroll down to show item
      setScrollOffset(position - windowSize + 1);
    }
  }, [scrollOffset, windowSize]);
  
  /**
   * Toggle server expand/collapse
   */
  const toggleServer = useCallback((serverName: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  }, []);
  
  /**
   * Save pending changes
   */
  const saveChanges = useCallback(async () => {
    // Changes are auto-saved by MCPContext methods
    // Just clear the flag
    setHasUnsavedChanges(false);
  }, []);
  
  /**
   * Handle keyboard input in Active Mode
   */
  const handleKeyPress = useCallback((input: string, key: Key, actions: NavigationActions) => {
    // Exit to Browse Mode
    if (key.escape || input === '0') {
      if (hasUnsavedChanges) {
        // Auto-save on exit
        saveChanges();
      }
      exitToNavBar();
      return;
    }
    
    // Up/Down navigation
    if (key.upArrow) {
      if (isOnExitItem) {
        // Already at top, no action
        return;
      }
      
      if (selectedIndex === 0) {
        // Move to Exit item
        setIsOnExitItem(true);
        setSelectedIndex(-1);
        setScrollOffset(0);
      } else {
        // Move to previous server
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
    } else if (key.downArrow) {
      if (isOnExitItem) {
        // Move from Exit to first server
        setIsOnExitItem(false);
        setSelectedIndex(0);
        adjustScroll(0);
      } else if (selectedIndex < serverList.length - 1) {
        // Move to next server
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
      // Already at bottom, no action
    }
    
    // Enter key actions
    else if (key.return) {
      if (isOnExitItem) {
        // Exit on Enter from Exit item
        if (hasUnsavedChanges) {
          saveChanges();
        }
        exitToNavBar();
      } else if (selectedIndex >= 0 && selectedIndex < serverList.length) {
        // Toggle expand/collapse with Enter
        const serverName = serverList[selectedIndex].name;
        toggleServer(serverName);
      }
    }
    
    // Left/Right toggle enabled/disabled
    else if (key.leftArrow || key.rightArrow) {
      if (!isOnExitItem && selectedIndex >= 0 && selectedIndex < serverList.length) {
        const serverName = serverList[selectedIndex].name;
        actions.onToggle(serverName);
        setHasUnsavedChanges(true);
      }
    }
    
    // Action keys (only when not on Exit item)
    else if (!isOnExitItem && selectedIndex >= 0 && selectedIndex < serverList.length) {
      if (input === 'v' || input === 'V') {
        actions.onViewTools();
      } else if (input === 'c' || input === 'C') {
        actions.onConfigure();
      } else if (input === 'o' || input === 'O') {
        actions.onOAuth();
      } else if (input === 'r' || input === 'R') {
        actions.onRestart();
      } else if (input === 'l' || input === 'L') {
        actions.onLogs();
      } else if (input === 'm' || input === 'M') {
        actions.onMarketplace();
      } else if (input === 'h' || input === 'H') {
        actions.onHealth();
      } else if (input === 'i' || input === 'I') {
        actions.onInstall();
      } else if (input === 'u' || input === 'U') {
        actions.onUninstall();
      }
    }
  }, [
    isOnExitItem,
    selectedIndex,
    serverList,
    hasUnsavedChanges,
    adjustScroll,
    toggleServer,
    saveChanges,
    exitToNavBar,
  ]);
  
  // Auto-scroll when selected index changes
  useEffect(() => {
    if (!isOnExitItem && selectedIndex >= 0) {
      adjustScroll(selectedIndex);
    }
  }, [selectedIndex, isOnExitItem, adjustScroll]);
  
  return {
    // State
    selectedIndex,
    isOnExitItem,
    expandedServers,
    scrollOffset,
    isActive,
    hasUnsavedChanges,
    
    // Windowed rendering
    visibleServers,
    showScrollUp,
    showScrollDown,
    
    // Actions
    handleKeyPress,
    toggleServer,
    saveChanges,
  };
}
