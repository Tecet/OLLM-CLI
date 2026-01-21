/**
 * Unit tests for WorkspaceContext
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceConfig,
} from '../../WorkspaceContext.js';

describe('WorkspaceContext', () => {
  const mockWorkspaceConfig: WorkspaceConfig = {
    version: '1.0',
    projects: [
      {
        name: 'project-a',
        path: '/path/to/project-a',
        llmAccess: true,
        excludePatterns: ['node_modules', '*.log'],
      },
      {
        name: 'project-b',
        path: '/path/to/project-b',
        llmAccess: false,
        excludePatterns: ['dist'],
      },
    ],
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    expect(result.current.state.config).toBeNull();
    expect(result.current.state.activeProject).toBeNull();
    expect(result.current.state.mode).toBe('browse');
    expect(result.current.state.rootPath).toBe(process.cwd());
  });

  it('should load workspace configuration', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.loadWorkspace(mockWorkspaceConfig);
    });

    expect(result.current.state.config).toEqual(mockWorkspaceConfig);
    expect(result.current.state.mode).toBe('workspace');
    expect(result.current.state.activeProject).toBe('project-a'); // First project with llmAccess
  });

  it('should set active project', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.loadWorkspace(mockWorkspaceConfig);
      result.current.setActiveProject('project-b');
    });

    expect(result.current.state.activeProject).toBe('project-b');
  });

  it('should get active project configuration', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.loadWorkspace(mockWorkspaceConfig);
      result.current.setActiveProject('project-b');
    });

    const activeProject = result.current.getActiveProject();
    expect(activeProject).toEqual(mockWorkspaceConfig.projects[1]);
  });

  it('should return null for active project when none selected', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    const activeProject = result.current.getActiveProject();
    expect(activeProject).toBeNull();
  });

  it('should set navigation mode', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.setMode('workspace');
    });

    expect(result.current.state.mode).toBe('workspace');
  });

  it('should set root path', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.setRootPath('/custom/path');
    });

    expect(result.current.state.rootPath).toBe('/custom/path');
  });

  it('should clear workspace and return to browse mode', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => <WorkspaceProvider>{children}</WorkspaceProvider>,
    });

    act(() => {
      result.current.loadWorkspace(mockWorkspaceConfig);
      result.current.clearWorkspace();
    });

    expect(result.current.state.config).toBeNull();
    expect(result.current.state.activeProject).toBeNull();
    expect(result.current.state.mode).toBe('browse');
  });

  it('should throw error when useWorkspace is used outside provider', () => {
    expect(() => {
      renderHook(() => useWorkspace());
    }).toThrow('useWorkspace must be used within a WorkspaceProvider');
  });

  it('should accept initial state', () => {
    const initialState = {
      mode: 'workspace' as const,
      rootPath: '/initial/path',
    };

    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }) => (
        <WorkspaceProvider initialState={initialState}>{children}</WorkspaceProvider>
      ),
    });

    expect(result.current.state.mode).toBe('workspace');
    expect(result.current.state.rootPath).toBe('/initial/path');
  });
});
