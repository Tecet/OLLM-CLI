/**
 * Tests for TrustedHooks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { TrustedHooks } from '../trustedHooks.js';
import type { Hook, HookApproval } from '../types.js';
import { arbHook, arbHookSource, createTestHook } from './test-helpers.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TrustedHooks', () => {
  let tempDir: string;
  let storagePath: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'trusted-hooks-test-'));
    storagePath = join(tempDir, 'trusted-hooks.json');
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Property Tests', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 9: Hook Trust Rules
    it('should apply trust rules based on hook source', async () => {
      await fc.assert(
        fc.asyncProperty(arbHookSource(), async (source) => {
          const trustedHooks = new TrustedHooks({ storagePath });
          const hook = createTestHook({ source });

          const isTrusted = await trustedHooks.isTrusted(hook);

          // Verify trust rules
          switch (source) {
            case 'builtin':
              expect(isTrusted).toBe(true);
              break;
            case 'user':
              expect(isTrusted).toBe(true);
              break;
            case 'workspace':
              // Should require approval (false by default)
              expect(isTrusted).toBe(false);
              break;
            case 'downloaded':
              // Should require approval
              expect(isTrusted).toBe(false);
              break;
          }
        }),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 9: Hook Trust Rules (with trustWorkspace)
    it('should trust workspace hooks when trustWorkspace is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (trustWorkspace) => {
          const trustedHooks = new TrustedHooks({ storagePath, trustWorkspace });
          const hook = createTestHook({ source: 'workspace' });

          const isTrusted = await trustedHooks.isTrusted(hook);

          // Workspace hooks should be trusted when trustWorkspace is enabled
          expect(isTrusted).toBe(trustWorkspace);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 10: Hook Approval Persistence
    it('should persist hook approvals and make hooks trusted', async () => {
      await fc.assert(
        fc.asyncProperty(arbHook(), async (hook) => {
          // Skip builtin and user hooks as they don't need approval
          if (hook.source === 'builtin' || hook.source === 'user') {
            return;
          }

          // Skip hooks with invalid IDs (whitespace-only)
          if (!hook.id || hook.id.trim().length === 0) {
            return;
          }

          const trustedHooks = new TrustedHooks({ storagePath });

          // Hook should not be trusted initially
          const initialTrust = await trustedHooks.isTrusted(hook);
          expect(initialTrust).toBe(false);

          // Compute hash and store approval
          const hash = await trustedHooks.computeHash(hook);
          await trustedHooks.storeApproval(hook, hash);

          // Hook should now be trusted
          const afterApproval = await trustedHooks.isTrusted(hook);
          expect(afterApproval).toBe(true);

          // Create a new instance to verify persistence
          const trustedHooks2 = new TrustedHooks({ storagePath });
          const afterReload = await trustedHooks2.isTrusted(hook);
          expect(afterReload).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 11: Hook Hash Change Detection
    it('should detect hash changes and require re-approval', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.array(fc.string()),
          fc.array(fc.string()),
          async (command1, command2, args1, args2) => {
            // Ensure commands or args are different
            if (command1 === command2 && JSON.stringify(args1) === JSON.stringify(args2)) {
              return;
            }

            const trustedHooks = new TrustedHooks({ storagePath });

            // Create initial hook
            const hook1 = createTestHook({
              source: 'workspace',
              command: command1,
              args: args1,
            });

            // Approve the hook
            const hash1 = await trustedHooks.computeHash(hook1);
            await trustedHooks.storeApproval(hook1, hash1);

            // Verify it's trusted
            expect(await trustedHooks.isTrusted(hook1)).toBe(true);

            // Create modified hook (same ID but different content)
            const hook2 = createTestHook({
              id: hook1.id,
              source: 'workspace',
              command: command2,
              args: args2,
            });

            // Modified hook should not be trusted (hash changed)
            const isTrusted = await trustedHooks.isTrusted(hook2);
            expect(isTrusted).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    describe('Trust Rules', () => {
      it('should trust builtin hooks', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'builtin' });

        expect(await trustedHooks.isTrusted(hook)).toBe(true);
      });

      it('should trust user hooks', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'user' });

        expect(await trustedHooks.isTrusted(hook)).toBe(true);
      });

      it('should not trust workspace hooks by default', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace' });

        expect(await trustedHooks.isTrusted(hook)).toBe(false);
      });

      it('should trust workspace hooks when trustWorkspace is enabled', async () => {
        const trustedHooks = new TrustedHooks({ storagePath, trustWorkspace: true });
        const hook = createTestHook({ source: 'workspace' });

        expect(await trustedHooks.isTrusted(hook)).toBe(true);
      });

      it('should not trust downloaded hooks', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'downloaded' });

        expect(await trustedHooks.isTrusted(hook)).toBe(false);
      });
    });

    describe('Approval Storage', () => {
      it('should store and retrieve approvals', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace' });

        // Initially not trusted
        expect(await trustedHooks.isTrusted(hook)).toBe(false);

        // Store approval
        const hash = await trustedHooks.computeHash(hook);
        await trustedHooks.storeApproval(hook, hash);

        // Now trusted
        expect(await trustedHooks.isTrusted(hook)).toBe(true);

        // Verify approval is in the list
        const approvals = trustedHooks.getApprovals();
        expect(approvals).toHaveLength(1);
        expect(approvals[0].hash).toBe(hash);
      });

      it('should persist approvals to disk', async () => {
        const hook = createTestHook({ source: 'workspace' });

        // Create first instance and store approval
        const trustedHooks1 = new TrustedHooks({ storagePath });
        const hash = await trustedHooks1.computeHash(hook);
        await trustedHooks1.storeApproval(hook, hash);

        // Create second instance and verify approval persisted
        const trustedHooks2 = new TrustedHooks({ storagePath });
        expect(await trustedHooks2.isTrusted(hook)).toBe(true);
      });

      it('should handle missing storage file gracefully', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace' });

        // Should not throw and should return false
        expect(await trustedHooks.isTrusted(hook)).toBe(false);
      });

      it('should remove approvals', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace', command: 'test-command' });

        // Store approval
        const hash = await trustedHooks.computeHash(hook);
        await trustedHooks.storeApproval(hook, hash);
        expect(await trustedHooks.isTrusted(hook)).toBe(true);

        // Remove approval
        await trustedHooks.removeApproval('test-command');
        expect(await trustedHooks.isTrusted(hook)).toBe(false);
      });

      it('should clear all approvals', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook1 = createTestHook({ source: 'workspace', command: 'cmd1' });
        const hook2 = createTestHook({ source: 'workspace', command: 'cmd2' });

        // Store approvals
        await trustedHooks.storeApproval(hook1, await trustedHooks.computeHash(hook1));
        await trustedHooks.storeApproval(hook2, await trustedHooks.computeHash(hook2));

        expect(trustedHooks.getApprovals()).toHaveLength(2);

        // Clear all
        await trustedHooks.clearApprovals();
        expect(trustedHooks.getApprovals()).toHaveLength(0);
      });
    });

    describe('Hash Computation', () => {
      it('should compute consistent hashes', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ command: 'node', args: ['test.js'] });

        const hash1 = await trustedHooks.computeHash(hook);
        const hash2 = await trustedHooks.computeHash(hook);

        expect(hash1).toBe(hash2);
      });

      it('should compute different hashes for different commands', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook1 = createTestHook({ command: 'node', args: ['test1.js'] });
        const hook2 = createTestHook({ command: 'node', args: ['test2.js'] });

        const hash1 = await trustedHooks.computeHash(hook1);
        const hash2 = await trustedHooks.computeHash(hook2);

        expect(hash1).not.toBe(hash2);
      });

      it('should include args in hash', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook1 = createTestHook({ command: 'node', args: ['test.js'] });
        const hook2 = createTestHook({ command: 'node', args: ['test.js', '--flag'] });

        const hash1 = await trustedHooks.computeHash(hook1);
        const hash2 = await trustedHooks.computeHash(hook2);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('Hash Change Detection', () => {
      it('should detect when hook content changes', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace', command: 'original' });

        // Approve original hook
        const hash = await trustedHooks.computeHash(hook);
        await trustedHooks.storeApproval(hook, hash);
        expect(await trustedHooks.isTrusted(hook)).toBe(true);

        // Modify hook
        hook.command = 'modified';

        // Should no longer be trusted
        expect(await trustedHooks.isTrusted(hook)).toBe(false);
      });

      it('should require re-approval after hash change', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace', command: 'original' });

        // Approve original
        await trustedHooks.storeApproval(hook, await trustedHooks.computeHash(hook));
        expect(await trustedHooks.isTrusted(hook)).toBe(true);

        // Modify and re-approve
        hook.command = 'modified';
        expect(await trustedHooks.isTrusted(hook)).toBe(false);

        await trustedHooks.storeApproval(hook, await trustedHooks.computeHash(hook));
        expect(await trustedHooks.isTrusted(hook)).toBe(true);
      });
    });

    describe('Request Approval', () => {
      it('should return false (stub implementation)', async () => {
        const trustedHooks = new TrustedHooks({ storagePath });
        const hook = createTestHook({ source: 'workspace' });

        // Stub implementation always returns false
        const approved = await trustedHooks.requestApproval(hook);
        expect(approved).toBe(false);
      });
    });
  });
});


  describe('Approval Callback', () => {
    it('should use approval callback when provided', async () => {
      let callbackCalled = false;
      let callbackHook: Hook | null = null;
      let callbackHash: string | null = null;

      const approvalCallback = async (hook: Hook, hash: string) => {
        callbackCalled = true;
        callbackHook = hook;
        callbackHash = hash;
        return true; // Approve
      };

      const trustedHooks = new TrustedHooks({
        storagePath,
        approvalCallback,
      });

      const hook = createTestHook({ source: 'workspace' });
      const approved = await trustedHooks.requestApproval(hook);

      expect(callbackCalled).toBe(true);
      expect(callbackHook).toEqual(hook);
      expect(callbackHash).toBeDefined();
      expect(approved).toBe(true);
    });

    it('should deny by default when no callback provided', async () => {
      const trustedHooks = new TrustedHooks({ storagePath });
      const hook = createTestHook({ source: 'workspace' });

      const approved = await trustedHooks.requestApproval(hook);

      expect(approved).toBe(false);
    });

    it('should handle callback errors gracefully', async () => {
      const approvalCallback = async () => {
        throw new Error('Callback error');
      };

      const trustedHooks = new TrustedHooks({
        storagePath,
        approvalCallback,
      });

      const hook = createTestHook({ source: 'workspace' });
      const approved = await trustedHooks.requestApproval(hook);

      // Should deny on error
      expect(approved).toBe(false);
    });

    it('should pass correct hash to callback', async () => {
      let receivedHash: string | null = null;

      const approvalCallback = async (hook: Hook, hash: string) => {
        receivedHash = hash;
        return true;
      };

      const trustedHooks = new TrustedHooks({
        storagePath,
        approvalCallback,
      });

      const hook = createTestHook({ source: 'workspace' });
      await trustedHooks.requestApproval(hook);

      // Hash should be sha256:...
      expect(receivedHash).toBeDefined();
      expect(receivedHash).toMatch(/^sha256:[a-f0-9]+$/);
    });

    it('should respect callback denial', async () => {
      const approvalCallback = async () => false; // Deny

      const trustedHooks = new TrustedHooks({
        storagePath,
        approvalCallback,
      });

      const hook = createTestHook({ source: 'workspace' });
      const approved = await trustedHooks.requestApproval(hook);

      expect(approved).toBe(false);
    });
  });

  describe('Username in Approval', () => {
    it('should use environment username when available', async () => {
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;

      // Set test username
      process.env.USER = 'testuser';

      const trustedHooks = new TrustedHooks({ storagePath });
      const hook = createTestHook({ source: 'workspace' });
      const hash = await trustedHooks.computeHash(hook);

      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();
      expect(approvals).toHaveLength(1);
      expect(approvals[0].approvedBy).toBe('testuser');

      // Restore original values
      if (originalUser !== undefined) {
        process.env.USER = originalUser;
      } else {
        delete process.env.USER;
      }
      if (originalUsername !== undefined) {
        process.env.USERNAME = originalUsername;
      }
    });

    it('should fallback to "user" when no username available', async () => {
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;

      // Remove username env vars
      delete process.env.USER;
      delete process.env.USERNAME;

      const trustedHooks = new TrustedHooks({ storagePath });
      const hook = createTestHook({ source: 'workspace' });
      const hash = await trustedHooks.computeHash(hook);

      await trustedHooks.storeApproval(hook, hash);

      const approvals = trustedHooks.getApprovals();
      expect(approvals).toHaveLength(1);
      expect(approvals[0].approvedBy).toBe('user');

      // Restore original values
      if (originalUser !== undefined) {
        process.env.USER = originalUser;
      }
      if (originalUsername !== undefined) {
        process.env.USERNAME = originalUsername;
      }
    });
  });
});
