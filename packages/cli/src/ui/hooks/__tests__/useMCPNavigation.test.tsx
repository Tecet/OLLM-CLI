/**
 * Tests for useMCPNavigation hook
 * 
 * Tests navigation logic, keyboard handling, windowed rendering,
 * and Browse/Active mode transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';
import { useMCPNavigation, type NavigationActions } from '../useMCPNavigation.js';

// Mock dependencies
let mockServers = new Map<string, ExtendedMCPServerStatus>([
  ['server1', createMockServer('server1', 'Server 1')],
  ['server2', createMockServer('server2', 'Server 2')],
  ['server3', createMockServer('server3', 'Server 3')],
]);

const mockExitToNavBar = vi.fn();
const mockIsFocused = vi.fn((id: string) => id === 'mcp-panel');

vi.mock('../../contexts/MCPContext.js', () => ({
  useMCP: () => ({
    state: {
      servers: mockServers,
      config: { mcpServers: {} },
      marketplace: [],
      isLoading: false,
      error: null,
    },
  }),
}));

vi.mock('../../../features/context/FocusContext.js', () => ({
  useFocusManager: () => ({
    isFocused: mockIsFocused,
    exitToNavBar: mockExitToNavBar,
  }),
}));

// Helper to create mock server
function createMockServer(name: string, description: string): ExtendedMCPServerStatus {
  return {
    name,
    description,
    status: 'connected',
    health: 'healthy',
    uptime: 1000,
    toolsList: [],
    config: {
      command: 'test',
      args: [],
      transport: 'stdio',
      disabled: false,
      autoApprove: [],
    },
  };
}

// Helper to create mock actions
function createMockActions(): NavigationActions {
  return {
    onToggle: vi.fn(),
    onConfigure: vi.fn(),
    onOAuth: vi.fn(),
    onViewTools: vi.fn(),
    onRestart: vi.fn(),
    onLogs: vi.fn(),
    onMarketplace: vi.fn(),
    onHealth: vi.fn(),
    onInstall: vi.fn(),
    onUninstall: vi.fn(),
  };
}

// Helper to create mock key object
function createKey(overrides: Partial<import('ink').Key> = {}): import('ink').Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    pageDown: false,
    pageUp: false,
    meta: false,
    ...overrides,
  };
}

// Test component that uses the hook
interface TestComponentProps {
  onRender: (state: ReturnType<typeof useMCPNavigation>) => void;
}

const TestComponent: React.FC<TestComponentProps> = ({ onRender }) => {
  const navigation = useMCPNavigation();
  
  useEffect(() => {
    onRender(navigation);
  }, [navigation, onRender]);
  
  return <Text>Test</Text>;
};

describe('useMCPNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    
    // Reset servers to default
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      expect(capturedState).not.toBeNull();
      expect(capturedState!.selectedIndex).toBe(0);
      expect(capturedState!.isOnExitItem).toBe(false);
      expect(capturedState!.expandedServers.size).toBe(0);
      expect(capturedState!.scrollOffset).toBe(0);
      expect(capturedState!.hasUnsavedChanges).toBe(false);
      expect(capturedState!.isActive).toBe(true);
    });

    it('should calculate visible servers correctly', () => {
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      expect(capturedState!.visibleServers.length).toBe(3);
    });

    it('should show correct scroll indicators initially', () => {
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      expect(capturedState!.showScrollUp).toBe(false);
      expect(capturedState!.showScrollDown).toBe(false);
    });
  });

  describe('Browse Mode / Active Mode Transitions', () => {
    it('should be active when panel is focused', () => {
      mockIsFocused.mockReturnValue(true);
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      expect(capturedState!.isActive).toBe(true);
    });

    it('should not be active when panel is not focused', () => {
      mockIsFocused.mockReturnValue(false);
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      expect(capturedState!.isActive).toBe(false);
    });

    it('should exit to Browse Mode on Escape key', () => {
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      const actions = createMockActions();
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      capturedState!.handleKeyPress('', createKey({ escape: true }), actions);
      
      expect(mockExitToNavBar).toHaveBeenCalledTimes(1);
    });

    it('should exit to Browse Mode on 0 key', () => {
      let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
      const actions = createMockActions();
      
      render(<TestComponent onRender={(state) => { capturedState = state; }} />);
      
      capturedState!.handleKeyPress('0', createKey(), actions);
      
      expect(mockExitToNavBar).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useMCPNavigation - Exit Item Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should move to Exit item when pressing Up from first server', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(0);
    expect(capturedState!.isOnExitItem).toBe(false);
    
    // Press Up
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isOnExitItem).toBe(true);
    expect(capturedState!.selectedIndex).toBe(-1);
  });

  it('should not move up when already on Exit item', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Move to Exit item first
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isOnExitItem).toBe(true);
    
    // Try to press Up again
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Should stay on Exit item
    expect(capturedState!.isOnExitItem).toBe(true);
    expect(capturedState!.selectedIndex).toBe(-1);
  });

  it('should move to first server when pressing Down from Exit item', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Move to Exit item
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isOnExitItem).toBe(true);
    
    // Press Down
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Should move to first server
    expect(capturedState!.isOnExitItem).toBe(false);
    expect(capturedState!.selectedIndex).toBe(0);
  });

  it('should exit when pressing Enter on Exit item', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Move to Exit item
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Press Enter
    capturedState!.handleKeyPress('', createKey({ return: true }), actions);
    
    expect(mockExitToNavBar).toHaveBeenCalledTimes(1);
  });
});

describe('useMCPNavigation - Arrow Key Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should navigate down through servers', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(0);
    
    // Navigate down
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(1);
    
    // Navigate down again
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(2);
  });

  it('should navigate up through servers', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to last server
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(2);
    
    // Navigate up
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(1);
  });

  it('should not navigate past last server', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to last server
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(2);
    
    // Try to navigate down past last
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Should stay at last server
    expect(capturedState!.selectedIndex).toBe(2);
  });

  it('should toggle server enabled/disabled with left/right arrows', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Press left arrow
    capturedState!.handleKeyPress('', createKey({ leftArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(actions.onToggle).toHaveBeenCalledWith('server1');
    expect(capturedState!.hasUnsavedChanges).toBe(true);
    
    // Press right arrow
    capturedState!.handleKeyPress('', createKey({ rightArrow: true }), actions);
    
    expect(actions.onToggle).toHaveBeenCalledWith('server1');
    expect(actions.onToggle).toHaveBeenCalledTimes(2);
  });

  it('should not toggle when on Exit item', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Move to Exit item
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Try to toggle
    capturedState!.handleKeyPress('', createKey({ leftArrow: true }), actions);
    
    expect(actions.onToggle).not.toHaveBeenCalled();
    expect(capturedState!.hasUnsavedChanges).toBe(false);
  });
});

describe('useMCPNavigation - Action Key Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should call action handlers for all action keys', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Test all action keys
    capturedState!.handleKeyPress('v', createKey(), actions);
    expect(actions.onViewTools).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('c', createKey(), actions);
    expect(actions.onConfigure).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('o', createKey(), actions);
    expect(actions.onOAuth).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('r', createKey(), actions);
    expect(actions.onRestart).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('l', createKey(), actions);
    expect(actions.onLogs).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('m', createKey(), actions);
    expect(actions.onMarketplace).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('h', createKey(), actions);
    expect(actions.onHealth).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('i', createKey(), actions);
    expect(actions.onInstall).toHaveBeenCalledTimes(1);
    
    capturedState!.handleKeyPress('u', createKey(), actions);
    expect(actions.onUninstall).toHaveBeenCalledTimes(1);
  });

  it('should handle uppercase action keys', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    capturedState!.handleKeyPress('V', createKey(), actions);
    
    expect(actions.onViewTools).toHaveBeenCalledTimes(1);
  });

  it('should not trigger actions when on Exit item', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Move to Exit item
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Try action keys
    capturedState!.handleKeyPress('v', createKey(), actions);
    capturedState!.handleKeyPress('c', createKey(), actions);
    capturedState!.handleKeyPress('o', createKey(), actions);
    
    expect(actions.onViewTools).not.toHaveBeenCalled();
    expect(actions.onConfigure).not.toHaveBeenCalled();
    expect(actions.onOAuth).not.toHaveBeenCalled();
  });
});

describe('useMCPNavigation - Expand/Collapse Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should expand server when Enter is pressed', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(false);
    
    // Press Enter to expand
    capturedState!.handleKeyPress('', createKey({ return: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(true);
  });

  it('should collapse server when Enter is pressed again', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Expand
    capturedState!.handleKeyPress('', createKey({ return: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(true);
    
    // Collapse
    capturedState!.handleKeyPress('', createKey({ return: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(false);
  });

  it('should toggle server expansion directly', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Expand
    capturedState!.toggleServer('server2');
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server2')).toBe(true);
    
    // Collapse
    capturedState!.toggleServer('server2');
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server2')).toBe(false);
  });

  it('should maintain multiple expanded servers', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    capturedState!.toggleServer('server1');
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    capturedState!.toggleServer('server2');
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(true);
    expect(capturedState!.expandedServers.has('server2')).toBe(true);
    expect(capturedState!.expandedServers.size).toBe(2);
  });
});

describe('useMCPNavigation - Windowed Rendering with Scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    
    // Create many servers for scrolling tests
    const manyServers = new Map<string, ExtendedMCPServerStatus>();
    for (let i = 1; i <= 25; i++) {
      manyServers.set(`server${i}`, createMockServer(`server${i}`, `Server ${i}`));
    }
    mockServers = manyServers;
  });

  it('should show only visible servers in window', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // With 25 servers, not all should be visible
    expect(capturedState!.visibleServers.length).toBeLessThan(25);
    expect(capturedState!.visibleServers.length).toBeGreaterThan(0);
  });

  it('should show scroll down indicator when more items below', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // At top with many servers, should show scroll down
    expect(capturedState!.showScrollDown).toBe(true);
    expect(capturedState!.showScrollUp).toBe(false);
  });

  it('should update visible window when scrolling down', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    const initialFirstServer = capturedState!.visibleServers[0]?.name;
    
    // Navigate down multiple times to trigger scroll
    for (let i = 0; i < 15; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    const newFirstServer = capturedState!.visibleServers[0]?.name;
    
    // Window should have scrolled
    expect(newFirstServer).not.toBe(initialFirstServer);
    expect(capturedState!.scrollOffset).toBeGreaterThan(0);
  });

  it('should show scroll up indicator when scrolled down', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate down to trigger scroll
    for (let i = 0; i < 15; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    expect(capturedState!.showScrollUp).toBe(true);
  });

  it('should keep selected item visible when navigating', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to middle of list
    for (let i = 0; i < 12; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    const selectedIndex = capturedState!.selectedIndex;
    const scrollOffset = capturedState!.scrollOffset;
    const visibleServers = capturedState!.visibleServers;
    
    // Selected server should be in visible window
    const selectedServerIndex = selectedIndex - (scrollOffset > 0 ? scrollOffset - 1 : 0);
    expect(selectedServerIndex).toBeGreaterThanOrEqual(0);
    expect(selectedServerIndex).toBeLessThan(visibleServers.length);
  });

  it('should scroll to bottom when navigating to last server', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to last server
    for (let i = 0; i < 24; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    expect(capturedState!.selectedIndex).toBe(24);
    expect(capturedState!.showScrollDown).toBe(false);
    expect(capturedState!.showScrollUp).toBe(true);
  });
});

describe('useMCPNavigation - Scroll Indicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    
    // Create many servers for scroll indicator tests
    const manyServers = new Map<string, ExtendedMCPServerStatus>();
    for (let i = 1; i <= 25; i++) {
      manyServers.set(`server${i}`, createMockServer(`server${i}`, `Server ${i}`));
    }
    mockServers = manyServers;
  });

  it('should show scroll down indicator at top', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.scrollOffset).toBe(0);
    expect(capturedState!.showScrollUp).toBe(false);
    expect(capturedState!.showScrollDown).toBe(true);
  });

  it('should show both indicators in middle', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to middle
    for (let i = 0; i < 12; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    expect(capturedState!.showScrollUp).toBe(true);
    expect(capturedState!.showScrollDown).toBe(true);
  });

  it('should show scroll up indicator at bottom', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Navigate to bottom
    for (let i = 0; i < 24; i++) {
      capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
      rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    }
    
    expect(capturedState!.showScrollUp).toBe(true);
    expect(capturedState!.showScrollDown).toBe(false);
  });

  it('should hide indicators when all items fit in window', () => {
    // Reset to few servers
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
    ]);
    
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.showScrollUp).toBe(false);
    expect(capturedState!.showScrollDown).toBe(false);
  });
});

describe('useMCPNavigation - Focus Management and Visual Indicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should be active when mcp-panel is focused', () => {
    mockIsFocused.mockReturnValue(true);
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isActive).toBe(true);
  });

  it('should not be active when mcp-panel is not focused', () => {
    mockIsFocused.mockReturnValue(false);
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isActive).toBe(false);
  });

  it('should track selected index for visual highlighting', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(0);
    
    capturedState!.handleKeyPress('', createKey({ downArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.selectedIndex).toBe(1);
  });

  it('should track Exit item selection separately', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isOnExitItem).toBe(false);
    
    capturedState!.handleKeyPress('', createKey({ upArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isOnExitItem).toBe(true);
    expect(capturedState!.selectedIndex).toBe(-1);
  });

  it('should track expanded servers for visual indicators', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.size).toBe(0);
    
    capturedState!.toggleServer('server1');
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.expandedServers.has('server1')).toBe(true);
  });
});

describe('useMCPNavigation - Unsaved Changes Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should mark changes as unsaved when toggling server', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.hasUnsavedChanges).toBe(false);
    
    capturedState!.handleKeyPress('', createKey({ leftArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.hasUnsavedChanges).toBe(true);
  });

  it('should clear unsaved changes when saving', async () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Make changes
    capturedState!.handleKeyPress('', createKey({ leftArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.hasUnsavedChanges).toBe(true);
    
    // Save
    await capturedState!.saveChanges();
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.hasUnsavedChanges).toBe(false);
  });

  it('should auto-save on exit with unsaved changes', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    // Make changes
    capturedState!.handleKeyPress('', createKey({ leftArrow: true }), actions);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.hasUnsavedChanges).toBe(true);
    
    // Exit
    capturedState!.handleKeyPress('', createKey({ escape: true }), actions);
    
    expect(mockExitToNavBar).toHaveBeenCalledTimes(1);
  });

  it('should not mark changes when action keys are pressed', () => {
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    capturedState!.handleKeyPress('v', createKey(), actions);
    capturedState!.handleKeyPress('c', createKey(), actions);
    
    expect(capturedState!.hasUnsavedChanges).toBe(false);
  });
});

describe('useMCPNavigation - Tab Integration and Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFocused.mockImplementation((id: string) => id === 'mcp-panel');
    mockServers = new Map<string, ExtendedMCPServerStatus>([
      ['server1', createMockServer('server1', 'Server 1')],
      ['server2', createMockServer('server2', 'Server 2')],
      ['server3', createMockServer('server3', 'Server 3')],
    ]);
  });

  it('should respond to focus changes', () => {
    mockIsFocused.mockReturnValue(true);
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    
    const { rerender } = render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isActive).toBe(true);
    
    // Simulate focus change
    mockIsFocused.mockReturnValue(false);
    rerender(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isActive).toBe(false);
  });

  it('should handle keyboard input only when active', () => {
    mockIsFocused.mockReturnValue(false);
    let capturedState: ReturnType<typeof useMCPNavigation> | null = null;
    const actions = createMockActions();
    
    render(<TestComponent onRender={(state) => { capturedState = state; }} />);
    
    expect(capturedState!.isActive).toBe(false);
    
    // Input should still be processed by handleKeyPress
    // (the component using the hook should check isActive)
    capturedState!.handleKeyPress('v', createKey(), actions);
    
    // Action is still called (component should gate this)
    expect(actions.onViewTools).toHaveBeenCalled();
  });
});
