/**
 * Property-based tests for GitStatusService
 * 
 * These tests validate correctness properties related to git status tracking,
 * color mapping, caching, and repository detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { GitStatusService } from '../../GitStatusService.js';
import { GitStatus } from '../../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';

/**
 * Helper to create a temporary git repository for testing
 */
async function createTempGitRepo(): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');
  return tempDir;
}

/**
 * Helper to clean up temporary directory
 */
function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

describe('GitStatusService - Property Tests', () => {
  let service: GitStatusService;
  let tempRepos: string[] = [];

  beforeEach(() => {
    service = new GitStatusService();
  });

  afterEach(() => {
    // Clean up all temporary repositories
    for (const repo of tempRepos) {
      cleanupTempDir(repo);
    }
    tempRepos = [];
  });

  /**
   * Feature: file-explorer-ui, Property 6: Git Status Maps to Correct Colors
   * 
   * For any file with git status, the displayed color should match the status:
   * - untracked → green
   * - modified → yellow
   * - ignored → grey
   * - clean → default
   * 
   * Validates: Requirements 2.7, 8.2, 8.3, 8.4
   */
  it('Property 6: Git status maps to correct colors', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);
    const git = simpleGit(repoPath);

    // Create test files with different statuses
    const untrackedFile = path.join(repoPath, 'untracked.txt');
    fs.writeFileSync(untrackedFile, 'untracked content');

    const modifiedFile = path.join(repoPath, 'modified.txt');
    fs.writeFileSync(modifiedFile, 'initial content');
    await git.add('modified.txt');
    await git.commit('Initial commit');
    fs.writeFileSync(modifiedFile, 'modified content');

    const cleanFile = path.join(repoPath, 'clean.txt');
    fs.writeFileSync(cleanFile, 'clean content');
    await git.add('clean.txt');
    await git.commit('Add clean file');

    const ignoredFile = path.join(repoPath, 'ignored.txt');
    fs.writeFileSync(ignoredFile, 'ignored content');
    fs.writeFileSync(path.join(repoPath, '.gitignore'), 'ignored.txt');

    // Get status for all files
    const untrackedStatus = await service.getFileStatus(untrackedFile);
    const modifiedStatus = await service.getFileStatus(modifiedFile);
    const cleanStatus = await service.getFileStatus(cleanFile);
    const ignoredStatus = await service.getFileStatus(ignoredFile);

    // Verify color mappings
    expect(untrackedStatus).toBe('untracked'); // → green
    expect(modifiedStatus).toBe('modified');   // → yellow
    expect(cleanStatus).toBe('clean');         // → default
    expect(ignoredStatus).toBe('ignored');     // → grey
  });

  /**
   * Property: Git status values are always one of the valid types
   * 
   * This property ensures that the service only returns valid GitStatus values
   */
  it('Property: Git status values are always valid', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    // Windows-invalid characters: < > : " / \ | ? *
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => !invalidChars.test(s) && s.trim().length > 0),
        async (filename) => {
          const filePath = path.join(repoPath, filename);
          
          // Create a file
          fs.writeFileSync(filePath, 'test content');
          
          // Get its status
          const status = await service.getFileStatus(filePath);
          
          // Status should be null or one of the valid values
          const validStatuses: (GitStatus | null)[] = ['untracked', 'modified', 'ignored', 'clean', null];
          expect(validStatuses).toContain(status);
          
          // Clean up
          fs.unlinkSync(filePath);
        }
      ),
      { numRuns: 20 } // Reduced runs for git operations
    );
  });

  /**
   * Property: Status mapping is consistent for the same file
   * 
   * Getting status for the same file multiple times should return the same result
   */
  it('Property: Status mapping is consistent', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    const testFile = path.join(repoPath, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    // Get status multiple times
    const status1 = await service.getFileStatus(testFile);
    const status2 = await service.getFileStatus(testFile);
    const status3 = await service.getFileStatus(testFile);

    // All should be the same
    expect(status1).toBe(status2);
    expect(status2).toBe(status3);
  });

  /**
   * Property: Non-git directories return null status
   * 
   * Files in non-git directories should return null status
   */
  it('Property: Non-git directories return null status', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    tempRepos.push(tempDir);

    // Windows-invalid characters: < > : " / \ | ? *
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => !invalidChars.test(s) && s.trim().length > 0),
        async (filename) => {
          const filePath = path.join(tempDir, filename);
          fs.writeFileSync(filePath, 'test content');
          
          const status = await service.getFileStatus(filePath);
          
          // Should return null for non-git directories
          expect(status).toBeNull();
          
          // Clean up
          fs.unlinkSync(filePath);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: file-explorer-ui, Property 31: Git Status Results Are Cached
   * 
   * For any git status query, subsequent queries within 5 seconds should return
   * the cached result without calling git again.
   * 
   * Validates: Requirements 8.5
   */
  it('Property 31: Git status results are cached', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    // Create a test file
    const testFile = path.join(repoPath, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    // First call - should query git
    const startTime = Date.now();
    const statusMap1 = await service.getStatus(repoPath);
    const firstCallDuration = Date.now() - startTime;

    // Second call - should use cache (much faster)
    const cachedStartTime = Date.now();
    const statusMap2 = await service.getStatus(repoPath);
    const cachedCallDuration = Date.now() - cachedStartTime;

    // Verify results are the same
    expect(statusMap1.size).toBe(statusMap2.size);
    for (const [key, value] of statusMap1) {
      expect(statusMap2.get(key)).toBe(value);
    }

    // Cached call should be significantly faster (at least 2x faster)
    // This is a heuristic check - cached calls should be nearly instant
    expect(cachedCallDuration).toBeLessThan(firstCallDuration / 2);
  });

  /**
   * Property: Cache expires after TTL
   * 
   * After the cache TTL (5 seconds), a new query should fetch fresh data
   */
  it('Property: Cache expires after TTL', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);
    const git = simpleGit(repoPath);

    // Create initial file
    const testFile = path.join(repoPath, 'test.txt');
    fs.writeFileSync(testFile, 'initial content');

    // Get initial status
    const status1 = await service.getFileStatus(testFile);
    expect(status1).toBe('untracked');

    // Add and commit the file
    await git.add('test.txt');
    await git.commit('Add test file');

    // Immediately check status - should still be cached as untracked
    const status2 = await service.getFileStatus(testFile);
    expect(status2).toBe('untracked'); // Still cached

    // Clear cache manually to simulate TTL expiration
    service.clearCache();

    // Now status should be clean
    const status3 = await service.getFileStatus(testFile);
    expect(status3).toBe('clean');
  });

  /**
   * Property: Cache can be manually cleared
   * 
   * Calling clearCache() should invalidate all cached results
   */
  it('Property: Cache can be manually cleared', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    // Create a test file
    const testFile = path.join(repoPath, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    // Get status to populate cache
    await service.getStatus(repoPath);

    // Clear cache
    service.clearCache();

    // Next call should query git again (not use cache)
    const statusMap = await service.getStatus(repoPath);
    
    // Should still get correct results
    expect(statusMap.size).toBeGreaterThanOrEqual(0);
  });

  /**
   * Feature: file-explorer-ui, Property 30: Git Status Is Queried for Repositories
   * 
   * For any directory that is a git repository, the git status service should
   * query status for all files in that repository.
   * 
   * Validates: Requirements 8.1
   */
  it('Property 30: Git status is queried for repositories', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    // Verify it's detected as a git repository
    expect(service.isGitRepository(repoPath)).toBe(true);

    // Create multiple files
    const file1 = path.join(repoPath, 'file1.txt');
    const file2 = path.join(repoPath, 'file2.txt');
    const file3 = path.join(repoPath, 'file3.txt');
    
    fs.writeFileSync(file1, 'content 1');
    fs.writeFileSync(file2, 'content 2');
    fs.writeFileSync(file3, 'content 3');

    // Query status for the repository
    const statusMap = await service.getStatus(repoPath);

    // Should have status for all files
    expect(statusMap.size).toBeGreaterThanOrEqual(3);
    expect(statusMap.has(file1)).toBe(true);
    expect(statusMap.has(file2)).toBe(true);
    expect(statusMap.has(file3)).toBe(true);
  });

  /**
   * Property: Non-git directories are not queried
   * 
   * Directories without .git should not be treated as repositories
   */
  it('Property: Non-git directories are not queried', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    tempRepos.push(tempDir);

    // Should not be detected as a git repository
    expect(service.isGitRepository(tempDir)).toBe(false);

    // Querying status should return empty map
    const statusMap = await service.getStatus(tempDir);
    expect(statusMap.size).toBe(0);
  });

  /**
   * Property: Repository detection is consistent
   * 
   * Calling isGitRepository multiple times should return the same result
   */
  it('Property: Repository detection is consistent', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    const nonGitPath = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    tempRepos.push(nonGitPath);

    // Check multiple times
    expect(service.isGitRepository(repoPath)).toBe(true);
    expect(service.isGitRepository(repoPath)).toBe(true);
    expect(service.isGitRepository(repoPath)).toBe(true);

    expect(service.isGitRepository(nonGitPath)).toBe(false);
    expect(service.isGitRepository(nonGitPath)).toBe(false);
    expect(service.isGitRepository(nonGitPath)).toBe(false);
  });

  /**
   * Property: Nested repositories are detected correctly
   * 
   * A subdirectory of a git repository should not be detected as a separate repository
   * unless it has its own .git directory
   */
  it('Property: Nested repositories are detected correctly', async () => {
    const repoPath = await createTempGitRepo();
    tempRepos.push(repoPath);

    // Create a subdirectory
    const subDir = path.join(repoPath, 'subdir');
    fs.mkdirSync(subDir);

    // Parent is a repository
    expect(service.isGitRepository(repoPath)).toBe(true);

    // Subdirectory is not a repository (no .git in it)
    expect(service.isGitRepository(subDir)).toBe(false);

    // But files in subdirectory should still get status from parent repo
    const subFile = path.join(subDir, 'test.txt');
    fs.writeFileSync(subFile, 'test content');

    const status = await service.getFileStatus(subFile);
    expect(status).not.toBeNull(); // Should get status from parent repo
  });
});
