/**
 * Unit tests for File Explorer barrel exports
 * 
 * These tests verify that all types are properly exported from the index file.
 */

import { describe, it, expect } from 'vitest';
import type {
  WorkspaceConfig,
  ProjectConfig,
  FileNode,
  GitStatus,
  FocusedFile,
  ImageMetadata,
} from '../../index.js';

describe('File Explorer Exports', () => {
  it('should export WorkspaceConfig type', () => {
    const config: WorkspaceConfig = {
      version: '1.0.0',
      projects: [],
    };
    
    expect(config).toBeDefined();
  });

  it('should export ProjectConfig type', () => {
    const project: ProjectConfig = {
      name: 'test',
      path: '/test',
      llmAccess: true,
      excludePatterns: [],
    };
    
    expect(project).toBeDefined();
  });

  it('should export FileNode type', () => {
    const node: FileNode = {
      name: 'test.ts',
      path: '/test.ts',
      type: 'file',
    };
    
    expect(node).toBeDefined();
  });

  it('should export GitStatus type', () => {
    const status: GitStatus = 'modified';
    
    expect(status).toBeDefined();
  });

  it('should export FocusedFile type', () => {
    const file: FocusedFile = {
      path: '/test.ts',
      content: 'test',
      truncated: false,
      size: 100,
    };
    
    expect(file).toBeDefined();
  });

  it('should export ImageMetadata type', () => {
    const metadata: ImageMetadata = {
      width: 100,
      height: 100,
      format: 'png',
      base64: 'data',
      resized: false,
    };
    
    expect(metadata).toBeDefined();
  });
});
