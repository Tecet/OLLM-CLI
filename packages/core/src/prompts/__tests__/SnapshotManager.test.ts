/**
 * Unit tests for SnapshotManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SnapshotManager, type ModeTransitionSnapshot, type ModeFindings } from '../SnapshotManager.js';
import type { Message } from '../../provider/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SnapshotManager', () => {
  let snapshotManager: SnapshotManager;
  let testStoragePath: string;
  
  beforeEach(async () => {
    // Create a temporary directory for test snapshots
    testStoragePath = join(tmpdir(), `snapshot-test-${Date.now()}`);
    snapshotManager = new SnapshotManager({
      sessionId: 'test-session',
      storagePath: testStoragePath,
      maxCacheSize: 5,
      pruneAfterMs: 1000 // 1 second for testing
    });
    await snapshotManager.initialize();
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });
  
  describe('createTransitionSnapshot', () => {
    it('should create a snapshot with correct structure', () => {
      const messages: Message[] = [
        { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'Hi there' }] }
      ];
      
      const snapshot = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages,
          activeSkills: ['typescript', 'testing'],
          activeTools: ['read_file', 'write_file'],
          currentTask: 'Fix bug in authentication'
        }
      );
      
      expect(snapshot.fromMode).toBe('developer');
      expect(snapshot.toMode).toBe('debugger');
      expect(snapshot.activeSkills).toEqual(['typescript', 'testing']);
      expect(snapshot.activeTools).toEqual(['read_file', 'write_file']);
      expect(snapshot.currentTask).toBe('Fix bug in authentication');
      expect(snapshot.recentMessages).toHaveLength(2);
      expect(snapshot.id).toBeTruthy();
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });
    
    it('should limit recent messages to last 5', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: `Message ${i}` }]
      })) as Message[];
      
      const snapshot = snapshotManager.createTransitionSnapshot(
        'planning',
        'developer',
        {
          messages,
          activeSkills: [],
          activeTools: []
        }
      );
      
      expect(snapshot.recentMessages).toHaveLength(5);
      expect(snapshot.recentMessages[0].content).toContain('Message 5');
      expect(snapshot.recentMessages[4].content).toContain('Message 9');
    });
    
    it('should include findings when provided', () => {
      const findings: ModeFindings = {
        debugger: {
          errors: ['TypeError: Cannot read property'],
          rootCause: 'Null pointer exception',
          fixes: ['Add null check', 'Initialize variable']
        }
      };
      
      const snapshot = snapshotManager.createTransitionSnapshot(
        'debugger',
        'developer',
        {
          messages: [],
          activeSkills: [],
          activeTools: [],
          findings
        }
      );
      
      expect(snapshot.findings).toEqual(findings);
    });
  });
  
  describe('createFullSnapshot', () => {
    it('should create valid XML snapshot', async () => {
      const messages: Message[] = [
        { role: 'user', parts: [{ type: 'text', text: 'Implement authentication system' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'Using JWT tokens with bcrypt' }] }
      ];
      
      const xml = await snapshotManager.createFullSnapshot(messages);
      
      expect(xml).toContain('<state_snapshot>');
      expect(xml).toContain('<overall_goal>');
      expect(xml).toContain('Implement authentication system');
      expect(xml).toContain('<key_knowledge>');
      expect(xml).toContain('<file_system_state>');
      expect(xml).toContain('<current_plan>');
      expect(xml).toContain('</state_snapshot>');
    });
    
    it('should escape XML special characters', async () => {
      const messages: Message[] = [
        { role: 'user', parts: [{ type: 'text', text: 'Fix <script> & "quotes"' }] }
      ];
      
      const xml = await snapshotManager.createFullSnapshot(messages);
      
      expect(xml).toContain('&lt;script&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
    });
    
    it('should extract key knowledge from messages', async () => {
      const messages: Message[] = [
        { role: 'assistant', parts: [{ type: 'text', text: 'Using Express.js framework\nWith PostgreSQL database' }] }
      ];
      
      const xml = await snapshotManager.createFullSnapshot(messages);
      
      expect(xml).toContain('Using Express.js framework');
      expect(xml).toContain('With PostgreSQL database');
    });
  });
  
  describe('storeSnapshot and getSnapshot', () => {
    it('should store and retrieve snapshot from cache', async () => {
      const snapshot = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: ['typescript'],
          activeTools: ['read_file']
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot, false); // Don't persist to disk
      
      const retrieved = snapshotManager.getSnapshot('developer', 'debugger');
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.id).toBe(snapshot.id);
      expect(retrieved?.activeSkills).toEqual(['typescript']);
    });
    
    it('should return null for non-existent snapshot', () => {
      const retrieved = snapshotManager.getSnapshot('assistant', 'planning');
      expect(retrieved).toBeNull();
    });
    
    it('should evict oldest snapshot when cache is full', async () => {
      // Create 6 snapshots with different mode transitions (max cache size is 5)
      const modes: Array<[string, string]> = [
        ['developer', 'debugger'],
        ['debugger', 'developer'],
        ['developer', 'security'],
        ['security', 'developer'],
        ['developer', 'reviewer'],
        ['reviewer', 'developer']
      ];
      
      for (let i = 0; i < 6; i++) {
        const [fromMode, toMode] = modes[i];
        const snapshot = snapshotManager.createTransitionSnapshot(
          fromMode as any,
          toMode as any,
          {
            messages: [],
            activeSkills: [`skill-${i}`],
            activeTools: []
          }
        );
        await snapshotManager.storeSnapshot(snapshot, false);
      }
      
      const stats = snapshotManager.getCacheStats();
      expect(stats.size).toBe(5);
    });
  });
  
  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', async () => {
      const snapshot1 = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: ['first'],
          activeTools: []
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot1, false);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const snapshot2 = snapshotManager.createTransitionSnapshot(
        'debugger',
        'developer',
        {
          messages: [],
          activeSkills: ['second'],
          activeTools: []
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot2, false);
      
      const latest = snapshotManager.getLatestSnapshot();
      
      expect(latest).toBeTruthy();
      expect(latest?.activeSkills).toEqual(['second']);
    });
    
    it('should return null when cache is empty', () => {
      const latest = snapshotManager.getLatestSnapshot();
      expect(latest).toBeNull();
    });
  });
  
  describe('pruneSnapshots', () => {
    it('should remove old snapshots from cache', async () => {
      const snapshot = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: [],
          activeTools: []
        }
      );
      
      // Manually set old timestamp
      snapshot.timestamp = new Date(Date.now() - 2000); // 2 seconds ago
      
      await snapshotManager.storeSnapshot(snapshot, false);
      
      expect(snapshotManager.getCacheStats().size).toBe(1);
      
      const prunedCount = await snapshotManager.pruneSnapshots();
      
      expect(prunedCount).toBeGreaterThan(0);
      expect(snapshotManager.getCacheStats().size).toBe(0);
    });
  });
  
  describe('formatFindings', () => {
    it('should format debugger findings', () => {
      const snapshot: ModeTransitionSnapshot = {
        id: 'test',
        timestamp: new Date(),
        fromMode: 'debugger',
        toMode: 'developer',
        recentMessages: [],
        activeSkills: [],
        activeTools: [],
        currentTask: null,
        findings: {
          debugger: {
            errors: ['TypeError: Cannot read property'],
            rootCause: 'Null pointer exception',
            fixes: ['Add null check', 'Initialize variable']
          }
        }
      };
      
      const formatted = snapshotManager.formatFindings(snapshot);
      
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('[Debugger Findings]');
      expect(formatted).toContain('TypeError: Cannot read property');
      expect(formatted).toContain('Null pointer exception');
      expect(formatted).toContain('Add null check');
    });
    
    it('should format security findings', () => {
      const snapshot: ModeTransitionSnapshot = {
        id: 'test',
        timestamp: new Date(),
        fromMode: 'security',
        toMode: 'developer',
        recentMessages: [],
        activeSkills: [],
        activeTools: [],
        currentTask: null,
        findings: {
          security: {
            vulnerabilities: ['SQL Injection', 'XSS'],
            recommendations: ['Use parameterized queries', 'Sanitize input']
          }
        }
      };
      
      const formatted = snapshotManager.formatFindings(snapshot);
      
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('[Security Audit Results]');
      expect(formatted).toContain('SQL Injection');
      expect(formatted).toContain('Use parameterized queries');
    });
    
    it('should return null when no findings', () => {
      const snapshot: ModeTransitionSnapshot = {
        id: 'test',
        timestamp: new Date(),
        fromMode: 'developer',
        toMode: 'planning',
        recentMessages: [],
        activeSkills: [],
        activeTools: [],
        currentTask: null
      };
      
      const formatted = snapshotManager.formatFindings(snapshot);
      expect(formatted).toBeNull();
    });
  });
  
  describe('addFindings', () => {
    it('should add findings to existing snapshot', async () => {
      const snapshot = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: [],
          activeTools: []
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot, false);
      
      const findings: ModeFindings = {
        debugger: {
          errors: ['Error 1'],
          rootCause: 'Root cause',
          fixes: ['Fix 1']
        }
      };
      
      const success = snapshotManager.addFindings('developer', 'debugger', findings);
      
      expect(success).toBe(true);
      
      const retrieved = snapshotManager.getSnapshot('developer', 'debugger');
      expect(retrieved?.findings).toEqual(findings);
    });
    
    it('should return false for non-existent snapshot', () => {
      const findings: ModeFindings = {
        debugger: {
          errors: [],
          rootCause: null,
          fixes: []
        }
      };
      
      const success = snapshotManager.addFindings('assistant', 'planning', findings);
      expect(success).toBe(false);
    });
  });
  
  describe('clearCache', () => {
    it('should clear all snapshots from cache', async () => {
      const snapshot = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: [],
          activeTools: []
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot, false);
      
      expect(snapshotManager.getCacheStats().size).toBe(1);
      
      snapshotManager.clearCache();
      
      expect(snapshotManager.getCacheStats().size).toBe(0);
    });
  });
  
  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const snapshot1 = snapshotManager.createTransitionSnapshot(
        'developer',
        'debugger',
        {
          messages: [],
          activeSkills: [],
          activeTools: []
        }
      );
      
      const snapshot2 = snapshotManager.createTransitionSnapshot(
        'debugger',
        'developer',
        {
          messages: [],
          activeSkills: [],
          activeTools: []
        }
      );
      
      await snapshotManager.storeSnapshot(snapshot1, false);
      await snapshotManager.storeSnapshot(snapshot2, false);
      
      const stats = snapshotManager.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.snapshots).toHaveLength(2);
      expect(stats.snapshots).toContain('developer->debugger');
      expect(stats.snapshots).toContain('debugger->developer');
    });
  });
});
