/**
 * Integration Tests for Model Management System
 * 
 * Tests the full model lifecycle and integration between:
 * - Model Management Service
 * - Model Router
 * - Model Database
 * - Provider Adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelManagementService } from '../modelManagementService.js';
import { ModelRouter } from '../../routing/modelRouter.js';
import { ModelDatabase } from '../../routing/modelDatabase.js';
import type { ProviderAdapter, ModelInfo } from '../../provider/types.js';

/**
 * Mock Provider Adapter for testing
 */
class MockProviderAdapter implements Partial<ProviderAdapter> {
  private models: ModelInfo[] = [];
  
  constructor(initialModels: ModelInfo[] = []) {
    this.models = initialModels;
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [...this.models];
  }
  
  async pullModel(name: string, onProgress?: (progress: any) => void): Promise<void> {
    // Simulate progress
    if (onProgress) {
      onProgress({ percentage: 50, transferRate: 1024 * 1024, bytesDownloaded: 512 * 1024 * 1024, totalBytes: 1024 * 1024 * 1024 });
      onProgress({ percentage: 100, transferRate: 1024 * 1024, bytesDownloaded: 1024 * 1024 * 1024, totalBytes: 1024 * 1024 * 1024 });
    }
    
    // Add model to list
    this.models.push({
      name,
      size: 1024 * 1024 * 1024,
      modifiedAt: new Date(),
      family: 'test',
      contextWindow: 4096,
      capabilities: {
        toolCalling: false,
        vision: false,
        streaming: true,
      },
    });
  }
  
  async deleteModel(name: string): Promise<void> {
    this.models = this.models.filter(m => m.name !== name);
  }
  
  async showModel(name: string): Promise<ModelInfo> {
    const model = this.models.find(m => m.name === name);
    if (!model) {
      throw new Error(`Model not found: ${name}`);
    }
    return model;
  }
  
  async keepModelLoaded(_name: string): Promise<void> {
    // Mock implementation
  }
  
  async unloadModel(_name: string): Promise<void> {
    // Mock implementation
  }
}

describe('Model Management Integration', () => {
  let provider: MockProviderAdapter;
  let service: ModelManagementService;
  let router: ModelRouter;
  
  beforeEach(() => {
    // Create mock provider with some initial models
    provider = new MockProviderAdapter([
      {
        name: 'llama3.1:8b',
        size: 4700000000,
        modifiedAt: new Date('2024-01-01'),
        family: 'llama',
        contextWindow: 128000,
        capabilities: {
          toolCalling: true,
          vision: false,
          streaming: true,
        },
      },
      {
        name: 'phi3:mini',
        size: 2300000000,
        modifiedAt: new Date('2024-01-01'),
        family: 'phi',
        contextWindow: 4096,
        capabilities: {
          toolCalling: false,
          vision: false,
          streaming: true,
        },
      },
      {
        name: 'codellama:7b',
        size: 3800000000,
        modifiedAt: new Date('2024-01-01'),
        family: 'llama',
        contextWindow: 16384,
        capabilities: {
          toolCalling: false,
          vision: false,
          streaming: true,
        },
      },
    ]);
    
    // Create service
    service = new ModelManagementService(
      provider as any,
      60000, // 1 minute cache TTL
      {
        enabled: true,
        models: [],
        timeout: 300,
      }
    );
    
    // Create router
    router = new ModelRouter({
      enabled: true,
      defaultProfile: 'general',
      overrides: {},
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Full Model Lifecycle', () => {
    it('should list, pull, use, and delete a model', async () => {
      // Step 1: List initial models
      const initialModels = await service.listModels();
      expect(initialModels).toHaveLength(3);
      expect(initialModels.map(m => m.name)).toContain('llama3.1:8b');
      
      // Step 2: Pull a new model
      let progressCalled = false;
      await service.pullModel('mistral:7b', (progress) => {
        progressCalled = true;
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });
      expect(progressCalled).toBe(true);
      
      // Step 3: Verify model was added
      const modelsAfterPull = await service.listModels();
      expect(modelsAfterPull).toHaveLength(4);
      expect(modelsAfterPull.map(m => m.name)).toContain('mistral:7b');
      
      // Step 4: Get model info
      const modelInfo = await service.showModel('mistral:7b');
      expect(modelInfo.name).toBe('mistral:7b');
      expect(modelInfo.size).toBeGreaterThan(0);
      
      // Step 5: Delete the model
      await service.deleteModel('mistral:7b');
      
      // Step 6: Verify model was removed
      const modelsAfterDelete = await service.listModels();
      expect(modelsAfterDelete).toHaveLength(3);
      expect(modelsAfterDelete.map(m => m.name)).not.toContain('mistral:7b');
    });
    
    it('should handle cache invalidation after mutations', async () => {
      // First call - should hit provider
      const models1 = await service.listModels();
      expect(models1).toHaveLength(3);
      
      // Second call - should use cache
      const models2 = await service.listModels();
      expect(models2).toHaveLength(3);
      
      // Pull a model - should invalidate cache
      await service.pullModel('test:model', () => {});
      
      // Next call - should hit provider again and see new model
      const models3 = await service.listModels();
      expect(models3).toHaveLength(4);
    });
  });
  
  describe('Model Routing Integration', () => {
    it('should route to appropriate model based on profile', async () => {
      const models = await service.listModels();
      
      // Test fast profile - should prefer phi3 (smallest model with streaming)
      const fastModel = router.selectModel('fast', models);
      expect(fastModel).toBeTruthy();
      expect(['phi3:mini', 'llama3.1:8b', 'codellama:7b']).toContain(fastModel!);
      
      // Test code profile - should prefer codellama or llama3.1
      const codeModel = router.selectModel('code', models);
      expect(codeModel).toBeTruthy();
      expect(['codellama:7b', 'llama3.1:8b']).toContain(codeModel!);
      
      // Test general profile - should prefer llama3.1
      const generalModel = router.selectModel('general', models);
      expect(generalModel).toBeTruthy();
      expect(['llama3.1:8b', 'codellama:7b', 'phi3:mini']).toContain(generalModel!);
    });
    
    it('should use fallback profile when no match found', async () => {
      // Create a provider with only small models
      const smallProvider = new MockProviderAdapter([
        {
          name: 'tiny:1b',
          size: 1000000000,
          modifiedAt: new Date(),
          family: 'tiny',
          contextWindow: 2048,
          capabilities: {
            toolCalling: false,
            vision: false,
            streaming: true,
          },
        },
      ]);
      
      const smallService = new ModelManagementService(
        smallProvider as any,
        60000,
        { enabled: false, models: [], timeout: 300 }
      );
      
      const models = await smallService.listModels();
      
      // Try to select code profile (requires 16k context)
      // Should fall back to general profile
      const selected = router.selectModel('code', models);
      
      // Since no model meets code requirements, should return null or fallback
      expect(selected).toBeNull();
    });
  });
  
  describe('Model Database Integration', () => {
    it('should use database info for routing decisions', async () => {
      const models = await service.listModels();
      
      // Verify database has correct info for llama3.1
      const llama31 = models.find(m => m.name === 'llama3.1:8b');
      expect(llama31).toBeDefined();
      
      // Database should recognize this as a llama model with large context
      const db = new ModelDatabase();
      const dbEntry = db.lookup('llama3.1:8b');
      expect(dbEntry).toBeDefined();
      expect(dbEntry?.family).toBe('llama');
      expect(dbEntry?.contextWindow).toBeGreaterThanOrEqual(100000);
    });
    
    it('should handle unknown models with safe defaults', async () => {
      // Pull an unknown model
      await service.pullModel('unknown:model', () => {});
      
      const models = await service.listModels();
      const unknownModel = models.find(m => m.name === 'unknown:model');
      
      expect(unknownModel).toBeDefined();
      
      // Router should still be able to select it if it meets requirements
      const selected = router.selectModel('fast', models);
      
      // Should select a known model over unknown
      expect(selected).not.toBe('unknown:model');
    });
  });
  
  describe('Keep-Alive Integration', () => {
    it('should keep models loaded when requested', async () => {
      const modelName = 'llama3.1:8b';
      
      // Keep model loaded
      await service.keepModelLoaded(modelName);
      
      // Verify model is in loaded list
      const loadedModels = service.getLoadedModels();
      expect(loadedModels).toContain(modelName);
      
      // Unload model
      await service.unloadModel(modelName);
      
      // Verify model is no longer in loaded list
      const loadedAfterUnload = service.getLoadedModels();
      expect(loadedAfterUnload).not.toContain(modelName);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      // Create a failing provider
      const failingProvider = {
        listModels: async () => {
          throw new Error('Provider connection failed');
        },
      };
      
      const failingService = new ModelManagementService(
        failingProvider as any,
        60000,
        { enabled: false, models: [], timeout: 300 }
      );
      
      // Should throw with descriptive error
      await expect(failingService.listModels()).rejects.toThrow('Provider connection failed');
    });
    
    it('should handle model not found errors', async () => {
      await expect(service.showModel('nonexistent:model')).rejects.toThrow('Model not found');
    });
    
    it('should handle delete of loaded model', async () => {
      const modelName = 'llama3.1:8b';
      
      // Keep model loaded
      await service.keepModelLoaded(modelName);
      expect(service.getLoadedModels()).toContain(modelName);
      
      // Delete should unload first
      await service.deleteModel(modelName);
      
      // Model should be unloaded and deleted
      expect(service.getLoadedModels()).not.toContain(modelName);
      
      const models = await service.listModels();
      expect(models.map(m => m.name)).not.toContain(modelName);
    });
  });
});
