/**
 * Unit tests for File Explorer core types
 * 
 * These tests verify that the TypeScript interfaces are properly defined
 * and can be used to create valid objects.
 */

import { describe, it, expect } from 'vitest';
import type {
  WorkspaceConfig,
  ProjectConfig,
  FileNode,
  GitStatus,
  FocusedFile,
  ImageMetadata,
} from '../../types.js';

describe('File Explorer Types', () => {
  describe('WorkspaceConfig', () => {
    it('should allow valid workspace configuration', () => {
      const config: WorkspaceConfig = {
        version: '1.0.0',
        projects: [],
      };
      
      expect(config.version).toBe('1.0.0');
      expect(config.projects).toEqual([]);
    });
  });

  describe('ProjectConfig', () => {
    it('should allow valid project configuration', () => {
      const project: ProjectConfig = {
        name: 'test-project',
        path: '/path/to/project',
        llmAccess: true,
        excludePatterns: ['node_modules/**', '*.log'],
      };
      
      expect(project.name).toBe('test-project');
      expect(project.llmAccess).toBe(true);
      expect(project.excludePatterns).toHaveLength(2);
    });
  });

  describe('GitStatus', () => {
    it('should allow valid git status values', () => {
      const statuses: GitStatus[] = ['untracked', 'modified', 'ignored', 'clean'];
      
      expect(statuses).toHaveLength(4);
    });
  });

  describe('FileNode', () => {
    it('should allow file node', () => {
      const fileNode: FileNode = {
        name: 'test.ts',
        path: '/path/to/test.ts',
        type: 'file',
        gitStatus: 'modified',
        isFocused: true,
      };
      
      expect(fileNode.type).toBe('file');
      expect(fileNode.gitStatus).toBe('modified');
      expect(fileNode.isFocused).toBe(true);
    });

    it('should allow directory node with children', () => {
      const dirNode: FileNode = {
        name: 'src',
        path: '/path/to/src',
        type: 'directory',
        expanded: true,
        children: [
          {
            name: 'index.ts',
            path: '/path/to/src/index.ts',
            type: 'file',
          },
        ],
      };
      
      expect(dirNode.type).toBe('directory');
      expect(dirNode.expanded).toBe(true);
      expect(dirNode.children).toHaveLength(1);
    });
  });

  describe('FocusedFile', () => {
    it('should allow focused file with content', () => {
      const focusedFile: FocusedFile = {
        path: '/path/to/file.ts',
        content: 'console.log("hello");',
        truncated: false,
        size: 1024,
      };
      
      expect(focusedFile.truncated).toBe(false);
      expect(focusedFile.size).toBe(1024);
    });

    it('should allow truncated file', () => {
      const focusedFile: FocusedFile = {
        path: '/path/to/large-file.ts',
        content: 'truncated content...',
        truncated: true,
        size: 10240,
      };
      
      expect(focusedFile.truncated).toBe(true);
      expect(focusedFile.size).toBe(10240);
    });
  });

  describe('ImageMetadata', () => {
    it('should allow image metadata', () => {
      const metadata: ImageMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        base64: 'base64encodeddata...',
        resized: false,
      };
      
      expect(metadata.width).toBe(1920);
      expect(metadata.height).toBe(1080);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.resized).toBe(false);
    });

    it('should allow resized image metadata', () => {
      const metadata: ImageMetadata = {
        width: 2048,
        height: 1536,
        format: 'png',
        base64: 'base64encodeddata...',
        resized: true,
      };
      
      expect(metadata.resized).toBe(true);
    });
  });
});
