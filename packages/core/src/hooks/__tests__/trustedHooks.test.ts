/**
 * Unit tests for TrustedHooks
 * Tests trust verification, approval management, and hash computation
 *
 * Feature: v0.1.0 Debugging and Polishing
 * Task: 39. Add Hook System Tests
 */

import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TrustedHooks } from '../trustedHooks.js';
import { createTestHook } from './test-helpers.js';

import type { Hook } from '../types.js';

describe('TrustedHooks - Unit Tests', () => {
  let trustedHooks: TrustedHooks;
  let testDir: string;
  let storagePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `trusted-hooks-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    storagePath = join(testDir, 'trusted-hooks.json');

    trustedHooks = new TrustedHooks({
      storagePath,
      trustWorkspace: false,
    });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Trust Rules', () => {
    it('should trust builtin hooks', async () => {
      const hook = createTestHook({ source: 'builtin' });

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(true);
    });

    it('should trust user hooks', async () => {
      const hook = createTestHook({ source: 'user' });

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(true);
    });

    it('should not trust workspace hooks by default', async () => {
      const hook = createTestHook({ source: 'workspace' });

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(false);
    });

    it('should trust workspace hooks when trustWorkspace is enabled', async () => {
      const trustedHooksWithWorkspace = new TrustedHooks({
        storagePath,
        trustWorkspace: true,
      });

      const hook = createTestHook({ source: 'workspace' });

      const trusted = await trustedHooksWithWorkspace.isTrusted(hook);

      expect(trusted).toBe(true);
    });

    it('should not trust downloaded hooks', async () => {
      const hook = createTestHook({ source: 'downloaded' });

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(false);
    });

    it('should not trust extension hooks', async () => {
      const hook = createTestHook({ source: 'extension' });

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(false);
    });
  });

  describe('Hash Computation', () => {
    it('should compute hash from file content when sourcePath is provided', async () => {
      const scriptPath = join(testDir, 'test-hook.js');
      const scriptContent = 'console.log("test");';
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        sourcePath: scriptPath,
      });

      const hash = await trustedHooks.computeHash(hook);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should compute same hash for same file content', async () => {
      const scriptPath = join(testDir, 'test-hook.js');
      const scriptContent = 'console.log("test");';
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        sourcePath: scriptPath,
      });

      const hash1 = await trustedHooks.computeHash(hook);
      const hash2 = await trustedHooks.computeHash(hook);

      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different file content', async () => {
      const script1Path = join(testDir, 'hook1.js');
      const script2Path = join(testDir, 'hook2.js');
      await writeFile(script1Path, 'console.log("test1");');
      await writeFile(script2Path, 'console.log("test2");');

      const hook1 = createTestHook({ sourcePath: script1Path });
      const hook2 = createTestHook({ sourcePath: script2Path });

      const hash1 = await trustedHooks.computeHash(hook1);
      const hash2 = await trustedHooks.computeHash(hook2);

      expect(hash1).not.toBe(hash2);
    });

    it('should fall back to command hash when file cannot be read', async () => {
      const hook = createTestHook({
        command: 'node',
        args: ['script.js'],
        sourcePath: '/non/existent/path.js',
      });

      const hash = await trustedHooks.computeHash(hook);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should compute hash from command and args when no sourcePath', async () => {
      const hook = createTestHook({
        command: 'node',
        args: ['script.js', '--flag'],
      });

      const hash = await trustedHooks.computeHash(hook);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should include source and extensionName in command hash', async () => {
      const hook1 = createTestHook({
        command: 'node',
        args: ['script.js'],
        source: 'user',
        extensionName: 'ext1',
      });

      const hook2 = createTestHook({
        command: 'node',
        args: ['script.js'],
        source: 'workspace',
        extensionName: 'ext2',
      });

      const hash1 = await trustedHooks.computeHash(hook1);
      const hash2 = await trustedHooks.computeHash(hook2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Approval Management', () => {
    it('should store approval for a hook', async () => {
      const hook = createTestHook({
        id: 'test-hook',
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();

      expect(approvals).toHaveLength(1);
      expect(approvals[0].source).toBe('/path/to/hook.js');
      expect(approvals[0].hash).toBe(hash);
    });

    it('should persist approvals to disk', async () => {
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      // Read the file directly
      const fileContent = await readFile(storagePath, 'utf-8');
      const storage = JSON.parse(fileContent);

      expect(storage.version).toBe(1);
      expect(storage.approvals).toHaveLength(1);
      expect(storage.approvals[0].source).toBe('/path/to/hook.js');
    });

    it('should load approvals from disk', async () => {
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      // Create new instance to test loading
      const newTrustedHooks = new TrustedHooks({
        storagePath,
        trustWorkspace: false,
      });

      await newTrustedHooks.load();
      const approvals = newTrustedHooks.getApprovals();

      expect(approvals).toHaveLength(1);
      expect(approvals[0].source).toBe('/path/to/hook.js');
      expect(approvals[0].hash).toBe(hash);
    });

    it('should trust approved hooks with matching hash', async () => {
      const scriptPath = join(testDir, 'approved-hook.js');
      await writeFile(scriptPath, 'console.log("approved");');

      const hook = createTestHook({
        source: 'workspace',
        sourcePath: scriptPath,
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(true);
    });

    it('should not trust approved hooks with mismatched hash', async () => {
      const scriptPath = join(testDir, 'modified-hook.js');
      await writeFile(scriptPath, 'console.log("original");');

      const hook = createTestHook({
        source: 'workspace',
        sourcePath: scriptPath,
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      // Modify the file
      await writeFile(scriptPath, 'console.log("modified");');

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(false);
    });

    it('should remove approval', async () => {
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const removed = await trustedHooks.removeApproval('/path/to/hook.js');

      expect(removed).toBe(true);
      expect(trustedHooks.getApprovals()).toHaveLength(0);
    });

    it('should return false when removing non-existent approval', async () => {
      const removed = await trustedHooks.removeApproval('/non/existent/path.js');

      expect(removed).toBe(false);
    });

    it('should clear all approvals', async () => {
      const hook1 = createTestHook({ source: 'workspace', sourcePath: '/path/1.js' });
      const hook2 = createTestHook({ source: 'workspace', sourcePath: '/path/2.js' });

      const hash1 = await trustedHooks.computeHash(hook1);
      const hash2 = await trustedHooks.computeHash(hook2);

      await trustedHooks.storeApproval(hook1, hash1);
      await trustedHooks.storeApproval(hook2, hash2);

      await trustedHooks.clearApprovals();

      expect(trustedHooks.getApprovals()).toHaveLength(0);
    });

    it('should include approval metadata', async () => {
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();
      const approval = approvals[0];

      expect(approval.approvedAt).toBeDefined();
      expect(approval.approvedBy).toBeDefined();
      expect(new Date(approval.approvedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Approval Callback', () => {
    it('should call approval callback for untrusted hooks', async () => {
      let callbackCalled = false;
      let callbackHook: Hook | null = null;

      const trustedHooksWithCallback = new TrustedHooks({
        storagePath,
        trustWorkspace: false,
        approvalCallback: async (hook, _hash) => {
          callbackCalled = true;
          callbackHook = hook;
          return true;
        },
      });

      const hook = createTestHook({
        id: 'test-hook',
        source: 'workspace',
      });

      const approved = await trustedHooksWithCallback.requestApproval(hook);

      expect(approved).toBe(true);
      expect(callbackCalled).toBe(true);
      expect(callbackHook).toBe(hook);
    });

    it('should deny approval when callback returns false', async () => {
      const trustedHooksWithCallback = new TrustedHooks({
        storagePath,
        trustWorkspace: false,
        approvalCallback: async (_hook, _hash) => false,
      });

      const hook = createTestHook({
        source: 'workspace',
      });

      const approved = await trustedHooksWithCallback.requestApproval(hook);

      expect(approved).toBe(false);
    });

    it('should deny approval when no callback is configured', async () => {
      const hook = createTestHook({
        source: 'workspace',
      });

      const approved = await trustedHooks.requestApproval(hook);

      expect(approved).toBe(false);
    });

    it('should deny approval when callback throws error', async () => {
      const trustedHooksWithCallback = new TrustedHooks({
        storagePath,
        trustWorkspace: false,
        approvalCallback: async (_hook, _hash) => {
          throw new Error('Callback error');
        },
      });

      const hook = createTestHook({
        source: 'workspace',
      });

      const approved = await trustedHooksWithCallback.requestApproval(hook);

      expect(approved).toBe(false);
    });

    it('should pass hash to approval callback', async () => {
      let receivedHash: string | null = null;

      const trustedHooksWithCallback = new TrustedHooks({
        storagePath,
        trustWorkspace: false,
        approvalCallback: async (_hook, hash) => {
          receivedHash = hash;
          return true;
        },
      });

      const hook = createTestHook({
        source: 'workspace',
      });

      await trustedHooksWithCallback.requestApproval(hook);

      expect(receivedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('Storage Management', () => {
    it('should handle missing storage file gracefully', async () => {
      const newTrustedHooks = new TrustedHooks({
        storagePath: join(testDir, 'non-existent.json'),
        trustWorkspace: false,
      });

      await expect(newTrustedHooks.load()).resolves.not.toThrow();
      expect(newTrustedHooks.getApprovals()).toHaveLength(0);
    });

    it('should create storage directory if it does not exist', async () => {
      const nestedPath = join(testDir, 'nested', 'dir', 'trusted-hooks.json');
      const newTrustedHooks = new TrustedHooks({
        storagePath: nestedPath,
        trustWorkspace: false,
      });

      const hook = createTestHook({
        source: 'workspace',
        sourcePath: '/path/to/hook.js',
      });

      const hash = await newTrustedHooks.computeHash(hook);
      await newTrustedHooks.storeApproval(hook, hash);

      // Verify file was created
      const fileContent = await readFile(nestedPath, 'utf-8');
      expect(fileContent).toBeDefined();
    });

    it('should handle concurrent approvals', async () => {
      const hooks = Array.from({ length: 10 }, (_, i) =>
        createTestHook({
          id: `hook-${i}`,
          source: 'workspace',
          sourcePath: `/path/to/hook-${i}.js`,
        })
      );

      await Promise.all(
        hooks.map(async (hook) => {
          const hash = await trustedHooks.computeHash(hook);
          await trustedHooks.storeApproval(hook, hash);
        })
      );

      const approvals = trustedHooks.getApprovals();
      expect(approvals).toHaveLength(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle hooks without sourcePath', async () => {
      const hook = createTestHook({
        id: 'no-source-path',
        command: 'node',
        args: ['script.js'],
        source: 'workspace',
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const trusted = await trustedHooks.isTrusted(hook);

      expect(trusted).toBe(true);
    });

    it('should handle hooks with same command but different args', async () => {
      const hook1 = createTestHook({
        command: 'node',
        args: ['script.js', '--flag1'],
        source: 'workspace',
      });

      const hook2 = createTestHook({
        command: 'node',
        args: ['script.js', '--flag2'],
        source: 'workspace',
      });

      const hash1 = await trustedHooks.computeHash(hook1);
      const hash2 = await trustedHooks.computeHash(hook2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle hooks with empty args', async () => {
      const hook = createTestHook({
        command: 'node',
        args: [],
        source: 'workspace',
      });

      const hash = await trustedHooks.computeHash(hook);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should handle hooks with undefined args', async () => {
      const hook = createTestHook({
        command: 'node',
        args: undefined,
        source: 'workspace',
      });

      const hash = await trustedHooks.computeHash(hook);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should handle very long file paths', async () => {
      const longPath = '/path/' + 'a'.repeat(1000) + '/hook.js';
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: longPath,
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();
      expect(approvals[0].source).toBe(longPath);
    });

    it('should handle unicode characters in paths', async () => {
      const unicodePath = '/path/日本語/hook.js';
      const hook = createTestHook({
        source: 'workspace',
        sourcePath: unicodePath,
      });

      const hash = await trustedHooks.computeHash(hook);
      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();
      expect(approvals[0].source).toBe(unicodePath);
    });
  });
});
