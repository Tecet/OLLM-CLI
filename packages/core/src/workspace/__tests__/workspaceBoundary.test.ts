/**
 * Workspace Boundary Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { 
  WorkspaceBoundary, 
  WorkspaceBoundaryError,
  createWorkspaceBoundary 
} from '../workspaceBoundary.js';

describe('WorkspaceBoundary', () => {
  let tempDir: string;
  let workspace: string;
  let boundary: WorkspaceBoundary;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    workspace = path.join(tempDir, 'workspace');
    await fs.mkdir(workspace, { recursive: true });
    
    // Create boundary with test workspace
    boundary = createWorkspaceBoundary({
      workspacePath: workspace,
      allowSubdirectories: true,
    });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Validation', () => {
    it('should allow paths within workspace', () => {
      const testPath = path.join(workspace, 'file.txt');
      expect(boundary.isPathAllowed(testPath)).toBe(true);
    });

    it('should allow subdirectories within workspace', () => {
      const testPath = path.join(workspace, 'src', 'main.ts');
      expect(boundary.isPathAllowed(testPath)).toBe(true);
    });

    it('should allow workspace root', () => {
      expect(boundary.isPathAllowed(workspace)).toBe(true);
    });

    it('should deny paths outside workspace', () => {
      const testPath = path.join(tempDir, 'outside.txt');
      expect(boundary.isPathAllowed(testPath)).toBe(false);
    });

    it('should deny parent directory access', () => {
      const testPath = path.join(workspace, '..', 'outside.txt');
      expect(boundary.isPathAllowed(testPath)).toBe(false);
    });

    it('should deny path traversal attempts', () => {
      const testPath = path.join(workspace, '..', '..', '..', 'etc', 'passwd');
      expect(boundary.isPathAllowed(testPath)).toBe(false);
    });
  });

  describe('OLLM Data Access', () => {
    it('should allow access to sessions directory', () => {
      const sessionsPath = path.join(os.homedir(), '.ollm', 'sessions', 'session.json');
      expect(boundary.isPathAllowed(sessionsPath)).toBe(true);
    });

    it('should allow access to context-snapshots directory', () => {
      const snapshotsPath = path.join(os.homedir(), '.ollm', 'context-snapshots', 'snap.json');
      expect(boundary.isPathAllowed(snapshotsPath)).toBe(true);
    });

    it('should allow access to config directory', () => {
      const configPath = path.join(os.homedir(), '.ollm', 'config', 'settings.json');
      expect(boundary.isPathAllowed(configPath)).toBe(true);
    });

    it('should deny access to non-allowed OLLM subdirectories', () => {
      const badPath = path.join(os.homedir(), '.ollm', 'not-allowed', 'file.txt');
      expect(boundary.isPathAllowed(badPath)).toBe(false);
    });
  });

  describe('Blocked Paths', () => {
    it('should block Windows system directory', () => {
      if (process.platform === 'win32') {
        expect(boundary.isPathAllowed('C:\\Windows\\System32\\file.txt')).toBe(false);
      }
    });

    it('should block Program Files directory', () => {
      if (process.platform === 'win32') {
        expect(boundary.isPathAllowed('C:\\Program Files\\app\\file.txt')).toBe(false);
      }
    });

    it('should block /etc directory', () => {
      if (process.platform !== 'win32') {
        expect(boundary.isPathAllowed('/etc/passwd')).toBe(false);
      }
    });

    it('should block .ssh directory', () => {
      const sshPath = path.join(os.homedir(), '.ssh', 'id_rsa');
      expect(boundary.isPathAllowed(sshPath)).toBe(false);
    });

    it('should block .aws directory', () => {
      const awsPath = path.join(os.homedir(), '.aws', 'credentials');
      expect(boundary.isPathAllowed(awsPath)).toBe(false);
    });

    it('should block .kube directory', () => {
      const kubePath = path.join(os.homedir(), '.kube', 'config');
      expect(boundary.isPathAllowed(kubePath)).toBe(false);
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative paths from workspace', () => {
      const resolved = boundary.resolvePath('file.txt');
      expect(resolved).toBe(path.join(workspace, 'file.txt'));
    });

    it('should resolve subdirectory paths', () => {
      const resolved = boundary.resolvePath('src/main.ts');
      expect(resolved).toBe(path.join(workspace, 'src', 'main.ts'));
    });

    it('should keep absolute paths as-is', () => {
      const absolutePath = path.join(workspace, 'file.txt');
      const resolved = boundary.resolvePath(absolutePath);
      expect(resolved).toBe(absolutePath);
    });

    it('should handle .. in relative paths', () => {
      const resolved = boundary.resolvePath('src/../file.txt');
      expect(resolved).toBe(path.join(workspace, 'file.txt'));
    });
  });

  describe('Validate Path', () => {
    it('should validate and return allowed paths', async () => {
      const testPath = 'file.txt';
      const validated = await boundary.validatePath(testPath);
      expect(validated).toBe(path.join(workspace, 'file.txt'));
    });

    it('should throw WorkspaceBoundaryError for denied paths', async () => {
      const testPath = '../outside.txt';
      
      await expect(boundary.validatePath(testPath)).rejects.toThrow(WorkspaceBoundaryError);
    });

    it('should include helpful error information', async () => {
      const testPath = '../outside.txt';
      
      try {
        await boundary.validatePath(testPath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkspaceBoundaryError);
        const boundaryError = error as WorkspaceBoundaryError;
        expect(boundaryError.attemptedPath).toBeDefined();
        expect(boundaryError.workspacePath).toBe(workspace);
        expect(boundaryError.allowedPaths).toHaveLength(2);
      }
    });
  });

  describe('Symlink Handling', () => {
    it('should validate symlink targets in strict mode', async () => {
      // Create a file outside workspace
      const outsideFile = path.join(tempDir, 'outside.txt');
      await fs.writeFile(outsideFile, 'content');
      
      // Create symlink inside workspace pointing outside
      const symlinkPath = path.join(workspace, 'link.txt');
      try {
        await fs.symlink(outsideFile, symlinkPath);
        
        // Should reject symlink to outside path
        await expect(boundary.validatePath(symlinkPath)).rejects.toThrow(WorkspaceBoundaryError);
      } catch (error) {
        // Skip test if symlinks not supported (Windows without admin)
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return;
        }
        throw error;
      }
    });

    it('should allow symlinks within workspace', async () => {
      // Create a file inside workspace
      const insideFile = path.join(workspace, 'file.txt');
      await fs.writeFile(insideFile, 'content');
      
      // Create symlink inside workspace pointing inside
      const symlinkPath = path.join(workspace, 'link.txt');
      try {
        await fs.symlink(insideFile, symlinkPath);
        
        // Should allow symlink to inside path
        const validated = await boundary.validatePath(symlinkPath);
        expect(validated).toBeDefined();
      } catch (error) {
        // Skip test if symlinks not supported (Windows without admin)
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return;
        }
        throw error;
      }
    });
  });

  describe('Workspace Info', () => {
    it('should return workspace information', () => {
      const info = boundary.getWorkspaceInfo();
      
      expect(info.workspacePath).toBe(workspace);
      expect(info.ollmDataPath).toBe(path.join(os.homedir(), '.ollm'));
      expect(info.allowedOllmPaths).toHaveLength(7); // Default OLLM paths
      expect(info.restrictions).toHaveLength(3);
    });

    it('should include all allowed OLLM paths', () => {
      const info = boundary.getWorkspaceInfo();
      
      const expectedPaths = [
        'sessions',
        'context-snapshots',
        'config',
        'cache',
        'templates',
        'memory',
        'settings',
      ];
      
      expectedPaths.forEach(p => {
        const fullPath = path.join(os.homedir(), '.ollm', p);
        expect(info.allowedOllmPaths).toContain(fullPath);
      });
    });
  });

  describe('Workspace Change', () => {
    it('should allow changing to valid directory', async () => {
      const newWorkspace = path.join(tempDir, 'new-workspace');
      await fs.mkdir(newWorkspace, { recursive: true });
      
      await boundary.setWorkspace(newWorkspace);
      
      expect(boundary.getWorkspacePath()).toBe(newWorkspace);
    });

    it('should reject non-existent directory', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');
      
      await expect(boundary.setWorkspace(nonExistent)).rejects.toThrow('does not exist');
    });

    it('should reject file as workspace', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      await expect(boundary.setWorkspace(filePath)).rejects.toThrow('not a directory');
    });

    it('should update path validation after workspace change', async () => {
      const newWorkspace = path.join(tempDir, 'new-workspace');
      await fs.mkdir(newWorkspace, { recursive: true });
      
      // Old workspace path should be allowed
      expect(boundary.isPathAllowed(path.join(workspace, 'file.txt'))).toBe(true);
      
      // Change workspace
      await boundary.setWorkspace(newWorkspace);
      
      // Old workspace path should now be denied
      expect(boundary.isPathAllowed(path.join(workspace, 'file.txt'))).toBe(false);
      
      // New workspace path should be allowed
      expect(boundary.isPathAllowed(path.join(newWorkspace, 'file.txt'))).toBe(true);
    });
  });

  describe('Subdirectory Control', () => {
    it('should allow subdirectories when enabled', () => {
      const boundaryWithSub = createWorkspaceBoundary({
        workspacePath: workspace,
        allowSubdirectories: true,
      });
      
      const deepPath = path.join(workspace, 'a', 'b', 'c', 'file.txt');
      expect(boundaryWithSub.isPathAllowed(deepPath)).toBe(true);
    });

    it('should deny subdirectories when disabled', () => {
      const boundaryNoSub = createWorkspaceBoundary({
        workspacePath: workspace,
        allowSubdirectories: false,
      });
      
      const deepPath = path.join(workspace, 'subdir', 'file.txt');
      expect(boundaryNoSub.isPathAllowed(deepPath)).toBe(false);
    });

    it('should allow direct children when subdirectories disabled', () => {
      const boundaryNoSub = createWorkspaceBoundary({
        workspacePath: workspace,
        allowSubdirectories: false,
      });
      
      const directChild = path.join(workspace, 'file.txt');
      expect(boundaryNoSub.isPathAllowed(directChild)).toBe(true);
    });
  });

  describe('Case Sensitivity (Windows)', () => {
    it('should handle case-insensitive paths on Windows', () => {
      if (process.platform !== 'win32') {
        return; // Skip on non-Windows
      }
      
      const lowerPath = path.join(workspace, 'file.txt').toLowerCase();
      const upperPath = path.join(workspace, 'FILE.TXT').toUpperCase();
      
      expect(boundary.isPathAllowed(lowerPath)).toBe(true);
      expect(boundary.isPathAllowed(upperPath)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty path', () => {
      expect(boundary.isPathAllowed('')).toBe(false);
    });

    it('should handle null-like paths gracefully', () => {
      expect(boundary.isPathAllowed(null as any)).toBe(false);
      expect(boundary.isPathAllowed(undefined as any)).toBe(false);
    });

    it('should handle paths with mixed separators', () => {
      const mixedPath = workspace + '/subdir\\file.txt';
      const normalized = path.normalize(mixedPath);
      expect(boundary.isPathAllowed(normalized)).toBe(true);
    });

    it('should handle paths with trailing separators', () => {
      const trailingPath = workspace + path.sep;
      expect(boundary.isPathAllowed(trailingPath)).toBe(true);
    });

    it('should handle Unicode paths', () => {
      const unicodePath = path.join(workspace, '文件.txt');
      expect(boundary.isPathAllowed(unicodePath)).toBe(true);
    });
  });
});
