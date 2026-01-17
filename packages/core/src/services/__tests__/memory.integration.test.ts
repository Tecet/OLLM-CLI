/**
 * Integration Tests for Memory Service
 * 
 * Tests memory persistence across restarts and integration with system prompts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryService } from '../memoryService.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Memory Service Integration', () => {
  let tempDir: string;
  let memoryPath: string;
  
  beforeEach(async () => {
    // Create unique temp directory for each test with integration-specific prefix
    tempDir = join(tmpdir(), `memory-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });
    memoryPath = join(tempDir, 'memory.json');
  });
  
  afterEach(async () => {
    // Cleanup - wait longer to ensure file handles are closed on Windows
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      // Ignore cleanup errors - Windows may still have file handles open
      console.warn(`Cleanup warning for ${tempDir}:`, error);
    }
  });
  
  describe('Memory Persistence Across Restarts', () => {
    it('should persist memories across service restarts', async () => {
      // Create first service instance
      const service1 = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Add some memories
      service1.remember('user_name', 'Alice', { source: 'user', category: 'preference' });
      service1.remember('project_type', 'TypeScript', { source: 'system', category: 'context' });
      service1.remember('api_key', 'secret123', { source: 'user', category: 'fact' });
      
      // Save to disk
      await service1.save();
      
      // Create second service instance (simulating restart)
      const service2 = new MemoryService({ memoryPath, tokenBudget: 500 });
      await service2.load();
      
      // Verify memories were loaded
      const memories = service2.listAll();
      expect(memories).toHaveLength(3);
      
      const userName = service2.recall('user_name');
      expect(userName).toBeDefined();
      expect(userName?.value).toBe('Alice');
      expect(userName?.category).toBe('preference');
      expect(userName?.source).toBe('user');
      
      const projectType = service2.recall('project_type');
      expect(projectType).toBeDefined();
      expect(projectType?.value).toBe('TypeScript');
      
      const apiKey = service2.recall('api_key');
      expect(apiKey).toBeDefined();
      expect(apiKey?.value).toBe('secret123');
    });
    
    it('should handle empty memory file on first load', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Load should succeed even if file doesn't exist
      await service.load();
      
      const memories = service.listAll();
      expect(memories).toHaveLength(0);
    });
    
    it('should preserve metadata across restarts', async () => {
      const service1 = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Add memory and access it multiple times
      service1.remember('test_key', 'test_value', { source: 'user' });
      service1.recall('test_key');
      service1.recall('test_key');
      service1.recall('test_key');
      
      await service1.save();
      
      // Restart
      const service2 = new MemoryService({ memoryPath, tokenBudget: 500 });
      await service2.load();
      
      const memory = service2.recall('test_key');
      expect(memory).toBeDefined();
      expect(memory?.accessCount).toBe(4); // 3 recalls + 1 from this recall
      expect(memory?.createdAt).toBeInstanceOf(Date);
      expect(memory?.updatedAt).toBeInstanceOf(Date);
    });
  });
  
  describe('System Prompt Integration', () => {
    it('should inject memories into system prompt within budget', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 100 }); // Small budget
      
      // Add several memories
      service.remember('key1', 'value1', { source: 'user' });
      service.remember('key2', 'value2', { source: 'user' });
      service.remember('key3', 'value3', { source: 'user' });
      service.remember('key4', 'value4', { source: 'user' });
      
      const systemPrompt = service.getSystemPromptAddition();
      
      // Should contain some memories
      expect(systemPrompt).toContain('Remembered Context');
      expect(systemPrompt.length).toBeGreaterThan(0);
      
      // Should respect token budget (rough estimate: ~4 chars per token)
      expect(systemPrompt.length).toBeLessThan(100 * 6); // 6 chars per token with margin
    });
    
    it('should prioritize recently accessed memories', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 50 }); // Very small budget
      
      // Add memories
      service.remember('old_key', 'old_value', { source: 'user' });
      service.remember('new_key', 'new_value', { source: 'user' });
      
      // Access new_key multiple times
      service.recall('new_key');
      service.recall('new_key');
      service.recall('new_key');
      
      const systemPrompt = service.getSystemPromptAddition();
      
      // Should include the frequently accessed memory
      expect(systemPrompt).toContain('new_key');
    });
    
    it('should format memories correctly in system prompt', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      service.remember('user_name', 'Alice', { source: 'user' });
      service.remember('language', 'TypeScript', { source: 'system' });
      
      const systemPrompt = service.getSystemPromptAddition();
      
      // Should have header
      expect(systemPrompt).toContain('## Remembered Context');
      
      // Should have key-value pairs
      expect(systemPrompt).toContain('user_name: Alice');
      expect(systemPrompt).toContain('language: TypeScript');
    });
  });
  
  describe('Memory Operations', () => {
    it('should support full CRUD operations', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Create
      service.remember('test_key', 'test_value', { source: 'user' });
      expect(service.recall('test_key')).toBeDefined();
      
      // Read
      const memory = service.recall('test_key');
      expect(memory?.value).toBe('test_value');
      
      // Update (remember with same key)
      service.remember('test_key', 'updated_value', { source: 'user' });
      const updated = service.recall('test_key');
      expect(updated?.value).toBe('updated_value');
      
      // Delete
      service.forget('test_key');
      expect(service.recall('test_key')).toBeNull();
    });
    
    it('should support search functionality', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      service.remember('user_name', 'Alice', { source: 'user' });
      service.remember('user_email', 'alice@example.com', { source: 'user' });
      service.remember('project_name', 'OLLM CLI', { source: 'system' });
      
      // Search by key
      const userResults = service.search('user');
      expect(userResults).toHaveLength(2);
      expect(userResults.map(m => m.key)).toContain('user_name');
      expect(userResults.map(m => m.key)).toContain('user_email');
      
      // Search by value
      const aliceResults = service.search('Alice');
      expect(aliceResults.length).toBeGreaterThanOrEqual(1);
      expect(aliceResults.some(r => r.key === 'user_name')).toBe(true);
    });
    
    it('should track access count correctly', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      service.remember('test_key', 'test_value', { source: 'user' });
      
      // Initial access count should be 0
      let memory = service.recall('test_key');
      expect(memory?.accessCount).toBe(1); // recall increments it
      
      // Access multiple times
      service.recall('test_key');
      service.recall('test_key');
      
      memory = service.recall('test_key');
      expect(memory?.accessCount).toBe(4);
    });
  });
  
  describe('Concurrent Access', () => {
    it('should handle concurrent save operations', async () => {
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Add memories
      service.remember('key1', 'value1', { source: 'user' });
      service.remember('key2', 'value2', { source: 'user' });
      
      // Save concurrently - on Windows, concurrent file renames can fail with EPERM
      // so we use a retry approach or expect some saves to fail
      const savePromises = [
        service.save().catch(() => {}),
        service.save().catch(() => {}),
        service.save().catch(() => {}),
      ];
      await Promise.all(savePromises);
      
      // Wait a bit for file system to settle on Windows
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // At least one save should have succeeded - verify file is valid
      const service2 = new MemoryService({ memoryPath, tokenBudget: 500 });
      await service2.load();
      
      expect(service2.listAll()).toHaveLength(2);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle corrupted memory file', async () => {
      // Write invalid JSON
      await fs.writeFile(memoryPath, 'invalid json{{{', 'utf-8');
      
      const service = new MemoryService({ memoryPath, tokenBudget: 500 });
      
      // Should handle gracefully
      await expect(service.load()).rejects.toThrow();
    });
    
    it('should handle missing directory', async () => {
      const invalidPath = join(tempDir, 'nonexistent', 'memory.json');
      const service = new MemoryService({ memoryPath: invalidPath, tokenBudget: 500 });
      
      // Save should create directory
      service.remember('test', 'value', { source: 'user' });
      await service.save();
      
      // Verify file was created
      const content = await fs.readFile(invalidPath, 'utf-8');
      expect(content).toBeTruthy();
    });
  });
});
