import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadJitContext } from '../jitDiscovery.js';

vi.mock('fs/promises');

describe('JIT Context Discovery', () => {
  const root = path.resolve('/project');
  const subDir = path.resolve('/project/src/feature');
  const targetFile = path.resolve('/project/src/feature/file.ts');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should travel up from a file path to find context files', async () => {
    const mockFiles = {
      [path.join(root, 'root-context.md')]: 'Root context content',
      [path.join(subDir, 'feature-context.md')]: 'Feature context content',
    };

    const mockDirs = {
      [root]: [{ name: 'root-context.md', isFile: () => true, isDirectory: () => false }],
      [path.resolve('/project/src')]: [],
      [subDir]: [{ name: 'feature-context.md', isFile: () => true, isDirectory: () => false }],
    } as any;

    (fs.stat as any).mockImplementation((p: string) => ({
      isFile: () => p === targetFile,
      isDirectory: () => p !== targetFile
    }));

    (fs.readdir as any).mockImplementation((p: string) => {
      return Promise.resolve(mockDirs[p] || []);
    });

    (fs.readFile as any).mockImplementation((p: string) => {
      return Promise.resolve(mockFiles[p] || '');
    });

    const result = await loadJitContext(targetFile, [root]);

    expect(result.files).toHaveLength(2);
    expect(result.instructions).toContain('Root context content');
    expect(result.instructions).toContain('Feature context content');
    expect(result.instructions).toContain('feature-context.md');
    expect(result.instructions).toContain('root-context.md');
  });

  it('should honor trusted roots and not go above them', async () => {
    const outsideFile = path.resolve('/outside/secret.md');

    (fs.stat as any).mockImplementation(() => ({ isFile: () => true }));
    (fs.readdir as any).mockImplementation(() => Promise.resolve([{ name: 'secret.md', isFile: () => true }]));
    
    const result = await loadJitContext(outsideFile, [root]);

    expect(result.files).toHaveLength(0);
    expect(result.instructions).toBe('');
  });

  it('should skip already loaded paths', async () => {
    const loadedPaths = new Set([path.join(root, 'root-context.md')]);
    
    (fs.stat as any).mockImplementation(() => ({ isFile: () => true }));
    (fs.readdir as any).mockImplementation((p: string) => {
      if (p === root) return Promise.resolve([{ name: 'root-context.md', isFile: () => true }]);
      return Promise.resolve([]);
    });

    const result = await loadJitContext(path.join(root, 'some-file.ts'), [root], loadedPaths);

    expect(result.files).toHaveLength(0);
  });
});
