/**
 * Unit tests for FileTreeContext
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  FileTreeProvider,
  useFileTree,
  type FileNode,
} from '../../FileTreeContext.js';

describe('FileTreeContext', () => {
  const mockFileNode: FileNode = {
    name: 'file.ts',
    path: '/path/to/file.ts',
    type: 'file',
  };

  const mockDirectoryNode: FileNode = {
    name: 'src',
    path: '/path/to/src',
    type: 'directory',
    children: [mockFileNode],
    expanded: false,
  };

  const mockTree: FileNode = {
    name: 'root',
    path: '/path/to/root',
    type: 'directory',
    children: [mockDirectoryNode, mockFileNode],
    expanded: true,
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    expect(result.current.state.root).toBeNull();
    expect(result.current.state.cursorPosition).toBe(0);
    expect(result.current.state.scrollOffset).toBe(0);
    expect(result.current.state.expandedPaths.size).toBe(0);
    expect(result.current.state.visibleWindow).toEqual([]);
    expect(result.current.state.windowSize).toBe(15);
  });

  it('should set root node', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.setRoot(mockTree);
    });

    expect(result.current.state.root).toEqual(mockTree);
    expect(result.current.state.cursorPosition).toBe(0);
    expect(result.current.state.scrollOffset).toBe(0);
  });

  it('should set cursor position', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(1);
    });

    expect(result.current.state.cursorPosition).toBe(1);
  });

  it('should clamp cursor position to valid range', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(10); // Beyond range
    });

    expect(result.current.state.cursorPosition).toBe(1); // Clamped to max
  });

  it('should move cursor up', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(1);
      result.current.moveCursorUp();
    });

    expect(result.current.state.cursorPosition).toBe(0);
  });

  it('should not move cursor up beyond top', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(0);
      result.current.moveCursorUp();
    });

    expect(result.current.state.cursorPosition).toBe(0);
  });

  it('should move cursor down', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(0);
      result.current.moveCursorDown();
    });

    expect(result.current.state.cursorPosition).toBe(1);
  });

  it('should not move cursor down beyond bottom', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(1);
      result.current.moveCursorDown();
    });

    expect(result.current.state.cursorPosition).toBe(1);
  });

  it('should set scroll offset', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.setScrollOffset(5);
    });

    expect(result.current.state.scrollOffset).toBe(5);
  });

  it('should not allow negative scroll offset', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.setScrollOffset(-5);
    });

    expect(result.current.state.scrollOffset).toBe(0);
  });

  it('should expand directory', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.expandDirectory('/path/to/dir');
    });

    expect(result.current.isExpanded('/path/to/dir')).toBe(true);
  });

  it('should collapse directory', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.expandDirectory('/path/to/dir');
      result.current.collapseDirectory('/path/to/dir');
    });

    expect(result.current.isExpanded('/path/to/dir')).toBe(false);
  });

  it('should toggle directory expansion', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.toggleDirectory('/path/to/dir');
    });

    expect(result.current.isExpanded('/path/to/dir')).toBe(true);

    act(() => {
      result.current.toggleDirectory('/path/to/dir');
    });

    expect(result.current.isExpanded('/path/to/dir')).toBe(false);
  });

  it('should set visible window', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
    });

    expect(result.current.state.visibleWindow).toEqual(visibleNodes);
  });

  it('should get selected node', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const visibleNodes = [mockFileNode, mockDirectoryNode];

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(1);
    });

    const selectedNode = result.current.getSelectedNode();
    expect(selectedNode).toEqual(mockDirectoryNode);
  });

  it('should return null for selected node when cursor is out of range', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    const selectedNode = result.current.getSelectedNode();
    expect(selectedNode).toBeNull();
  });

  it('should reset tree state', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => <FileTreeProvider>{children}</FileTreeProvider>,
    });

    act(() => {
      result.current.setRoot(mockTree);
      result.current.setCursorPosition(5);
      result.current.expandDirectory('/path/to/dir');
      result.current.resetTree();
    });

    expect(result.current.state.root).toBeNull();
    expect(result.current.state.cursorPosition).toBe(0);
    expect(result.current.state.scrollOffset).toBe(0);
    expect(result.current.state.expandedPaths.size).toBe(0);
  });

  it('should throw error when useFileTree is used outside provider', () => {
    expect(() => {
      renderHook(() => useFileTree());
    }).toThrow('useFileTree must be used within a FileTreeProvider');
  });

  it('should accept custom window size', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => (
        <FileTreeProvider windowSize={20}>{children}</FileTreeProvider>
      ),
    });

    expect(result.current.state.windowSize).toBe(20);
  });

  it('should accept initial state', () => {
    const initialExpandedPaths = new Set(['/path/to/dir']);

    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => (
        <FileTreeProvider
          initialState={{
            root: mockTree,
            expandedPaths: initialExpandedPaths,
          }}
        >
          {children}
        </FileTreeProvider>
      ),
    });

    expect(result.current.state.root).toEqual(mockTree);
    expect(result.current.isExpanded('/path/to/dir')).toBe(true);
  });

  it('should adjust scroll offset when cursor moves outside visible window', () => {
    const { result } = renderHook(() => useFileTree(), {
      wrapper: ({ children }) => (
        <FileTreeProvider windowSize={3}>{children}</FileTreeProvider>
      ),
    });

    // Create a list of 10 nodes
    const visibleNodes = Array.from({ length: 10 }, (_, i) => ({
      name: `file${i}.ts`,
      path: `/path/to/file${i}.ts`,
      type: 'file' as const,
    }));

    act(() => {
      result.current.setVisibleWindow(visibleNodes);
      result.current.setCursorPosition(5);
    });

    // Cursor at position 5 with window size 3 should adjust scroll offset
    expect(result.current.state.scrollOffset).toBeGreaterThan(0);
  });
});
