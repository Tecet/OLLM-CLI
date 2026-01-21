/**
 * Unit tests for FileFocusContext
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  FileFocusProvider,
  useFileFocus,
  type FocusedFile,
} from '../../FileFocusContext.js';

describe('FileFocusContext', () => {
  const mockFocusedFile: FocusedFile = {
    path: '/path/to/file.ts',
    content: 'console.log("test");',
    truncated: false,
    size: 21,
  };

  const mockLargeFile: FocusedFile = {
    path: '/path/to/large.ts',
    content: 'x'.repeat(8192),
    truncated: true,
    size: 10000,
  };

  it('should initialize with empty focus state', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    expect(result.current.state.focusedFiles.size).toBe(0);
    expect(result.current.state.totalSize).toBe(0);
    expect(result.current.state.maxSize).toBe(8192);
  });

  it('should add a focused file', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
    });

    expect(result.current.state.focusedFiles.size).toBe(1);
    expect(result.current.state.totalSize).toBe(mockFocusedFile.content.length);
    expect(result.current.isFocused(mockFocusedFile.path)).toBe(true);
  });

  it('should remove a focused file', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
      result.current.removeFocusedFile(mockFocusedFile.path);
    });

    expect(result.current.state.focusedFiles.size).toBe(0);
    expect(result.current.state.totalSize).toBe(0);
    expect(result.current.isFocused(mockFocusedFile.path)).toBe(false);
  });

  it('should handle removing non-existent file gracefully', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.removeFocusedFile('/non/existent/path');
    });

    expect(result.current.state.focusedFiles.size).toBe(0);
  });

  it('should check if file is focused', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
    });

    expect(result.current.isFocused(mockFocusedFile.path)).toBe(true);
    expect(result.current.isFocused('/other/path')).toBe(false);
  });

  it('should get focused file by path', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
    });

    const file = result.current.getFocusedFile(mockFocusedFile.path);
    expect(file).toEqual(mockFocusedFile);
  });

  it('should get all focused files as array', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
      result.current.addFocusedFile(mockLargeFile);
    });

    const files = result.current.getAllFocusedFiles();
    expect(files).toHaveLength(2);
    expect(files).toContainEqual(mockFocusedFile);
    expect(files).toContainEqual(mockLargeFile);
  });

  it('should clear all focused files', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
      result.current.addFocusedFile(mockLargeFile);
      result.current.clearAllFocusedFiles();
    });

    expect(result.current.state.focusedFiles.size).toBe(0);
    expect(result.current.state.totalSize).toBe(0);
  });

  it('should get focused file count', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
      result.current.addFocusedFile(mockLargeFile);
    });

    expect(result.current.getFocusedFileCount()).toBe(2);
  });

  it('should update total size when replacing existing file', () => {
    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => <FileFocusProvider>{children}</FileFocusProvider>,
    });

    const updatedFile: FocusedFile = {
      ...mockFocusedFile,
      content: 'console.log("updated");',
    };

    act(() => {
      result.current.addFocusedFile(mockFocusedFile);
    });

    const initialSize = result.current.state.totalSize;

    act(() => {
      result.current.addFocusedFile(updatedFile);
    });

    expect(result.current.state.focusedFiles.size).toBe(1);
    expect(result.current.state.totalSize).toBe(updatedFile.content.length);
    expect(result.current.state.totalSize).not.toBe(initialSize);
  });

  it('should throw error when useFileFocus is used outside provider', () => {
    expect(() => {
      renderHook(() => useFileFocus());
    }).toThrow('useFileFocus must be used within a FileFocusProvider');
  });

  it('should accept initial state', () => {
    const initialFiles = new Map<string, FocusedFile>([
      [mockFocusedFile.path, mockFocusedFile],
    ]);

    const { result } = renderHook(() => useFileFocus(), {
      wrapper: ({ children }) => (
        <FileFocusProvider
          initialState={{
            focusedFiles: initialFiles,
            totalSize: mockFocusedFile.content.length,
          }}
        >
          {children}
        </FileFocusProvider>
      ),
    });

    expect(result.current.state.focusedFiles.size).toBe(1);
    expect(result.current.isFocused(mockFocusedFile.path)).toBe(true);
  });
});
