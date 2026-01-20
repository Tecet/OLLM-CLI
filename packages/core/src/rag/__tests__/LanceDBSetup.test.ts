/**
 * Unit tests for LanceDB Setup
 * 
 * Note: These tests mock the vectordb module since it's not installed yet.
 * This is Phase 19 (FUTURE) development.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

// Mock vectordb module
vi.mock('vectordb', () => ({
  default: {
    connect: vi.fn()
  },
  connect: vi.fn()
}));

// Import after mocking
const { LanceDBSetup, createDefaultRAGConfig } = await import('../LanceDBSetup.js');
import type { RAGConfig } from '../RAGSystem.js';

describe('LanceDBSetup', () => {
  let tempDir: string;
  let config: typeof RAGConfig;
  let setup: any;
  let mockDb: any;
  let mockTable: any;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'lancedb-test-'));
    config = createDefaultRAGConfig(tempDir);
    
    // Setup mocks
    mockTable = {
      countRows: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    
    mockDb = {
      tableNames: vi.fn().mockResolvedValue([]),
      openTable: vi.fn().mockResolvedValue(mockTable),
      createTable: vi.fn().mockResolvedValue(mockTable),
      dropTable: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock the connect function
    const lancedb = await import('vectordb');
    vi.mocked(lancedb.connect).mockResolvedValue(mockDb);
    
    setup = new LanceDBSetup(config);
  });

  afterEach(async () => {
    // Cleanup
    try {
      await setup.shutdown();
    } catch {
      // Ignore errors during cleanup
    }
    
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('constructor', () => {
    it('should create LanceDBSetup instance with config', () => {
      expect(setup).toBeDefined();
      expect(setup).toBeInstanceOf(LanceDBSetup);
    });
  });

  describe('initialize', () => {
    it('should initialize database and create all tables', async () => {
      // Mock table names to simulate existing tables after creation
      mockDb.tableNames.mockResolvedValue([
        'codebase_index',
        'knowledge_debugger',
        'knowledge_security',
        'knowledge_performance',
        'knowledge_planning'
      ]);
      
      const connection = await setup.initialize();
      
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
      expect(connection.tables).toBeDefined();
      expect(connection.storageDir).toBe(tempDir);
      
      // Verify all tables are created
      expect(connection.tables.has('codebase')).toBe(true);
      expect(connection.tables.has('debugger')).toBe(true);
      expect(connection.tables.has('security')).toBe(true);
      expect(connection.tables.has('performance')).toBe(true);
      expect(connection.tables.has('planning')).toBe(true);
    });

    it('should create storage directory if it does not exist', async () => {
      const nonExistentDir = join(tempDir, 'nested', 'path');
      const customConfig = createDefaultRAGConfig(nonExistentDir);
      const customSetup = new LanceDBSetup(customConfig);
      
      const connection = await customSetup.initialize();
      
      expect(connection.storageDir).toBe(nonExistentDir);
      
      await customSetup.shutdown();
    });

    it('should throw error if initialization fails', async () => {
      // Create setup with invalid config that will fail during directory creation
      const invalidConfig = {
        ...config,
        storageDir: '\0invalid' // Null character makes it invalid on most systems
      };
      const invalidSetup = new LanceDBSetup(invalidConfig);
      
      await expect(invalidSetup.initialize()).rejects.toThrow();
    });

    it('should allow multiple initializations', async () => {
      await setup.initialize();
      
      // Second initialization should work
      const connection = await setup.initialize();
      expect(connection).toBeDefined();
    });
  });

  describe('getConnection', () => {
    it('should return connection after initialization', async () => {
      await setup.initialize();
      
      const connection = setup.getConnection();
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
    });

    it('should throw error if not initialized', () => {
      expect(() => setup.getConnection()).toThrow('LanceDB not initialized');
    });
  });

  describe('shutdown', () => {
    it('should cleanup connection', async () => {
      await setup.initialize();
      await setup.shutdown();
      
      // Should throw after shutdown
      expect(() => setup.getConnection()).toThrow('LanceDB not initialized');
    });

    it('should not throw if called before initialization', async () => {
      await expect(setup.shutdown()).resolves.not.toThrow();
    });

    it('should allow multiple shutdowns', async () => {
      await setup.initialize();
      await setup.shutdown();
      await expect(setup.shutdown()).resolves.not.toThrow();
    });
  });

  describe('createTable', () => {
    it('should create custom table with schema', async () => {
      await setup.initialize();
      
      const customSchema = {
        name: 'custom_table',
        dimensions: 384,
        fields: [
          { name: 'id', type: 'string' as const, required: true },
          { name: 'content', type: 'string' as const, required: true },
          { name: 'timestamp', type: 'timestamp' as const, required: true }
        ]
      };
      
      const table = await setup.createTable(customSchema);
      expect(table).toBeDefined();
      
      const connection = setup.getConnection();
      expect(connection.tables.has('custom_table')).toBe(true);
    });

    it('should return existing table if already created', async () => {
      await setup.initialize();
      
      const schema = {
        name: 'test_table',
        dimensions: 384,
        fields: [
          { name: 'id', type: 'string' as const, required: true }
        ]
      };
      
      const table1 = await setup.createTable(schema);
      const table2 = await setup.createTable(schema);
      
      expect(table1).toBe(table2);
    });

    it('should throw error if not initialized', async () => {
      const schema = {
        name: 'test_table',
        dimensions: 384,
        fields: []
      };
      
      await expect(setup.createTable(schema)).rejects.toThrow('LanceDB not initialized');
    });
  });

  describe('dropTable', () => {
    it('should drop existing table', async () => {
      await setup.initialize();
      
      const schema = {
        name: 'temp_table',
        dimensions: 384,
        fields: [
          { name: 'id', type: 'string' as const, required: true }
        ]
      };
      
      await setup.createTable(schema);
      
      const connection = setup.getConnection();
      expect(connection.tables.has('temp_table')).toBe(true);
      
      await setup.dropTable('temp_table');
      expect(connection.tables.has('temp_table')).toBe(false);
    });

    it('should throw error if not initialized', async () => {
      await expect(setup.dropTable('test_table')).rejects.toThrow('LanceDB not initialized');
    });
  });

  describe('listTables', () => {
    it('should list all tables', async () => {
      await setup.initialize();
      
      // Update mock to return table names
      mockDb.tableNames.mockResolvedValue([
        'codebase_index',
        'knowledge_debugger',
        'knowledge_security',
        'knowledge_performance',
        'knowledge_planning'
      ]);
      
      const tables = await setup.listTables();
      
      expect(tables).toBeDefined();
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      
      // Should include default tables
      expect(tables).toContain('codebase_index');
      expect(tables).toContain('knowledge_debugger');
      expect(tables).toContain('knowledge_security');
      expect(tables).toContain('knowledge_performance');
      expect(tables).toContain('knowledge_planning');
    });

    it('should throw error if not initialized', async () => {
      await expect(setup.listTables()).rejects.toThrow('LanceDB not initialized');
    });
  });

  describe('getTableStats', () => {
    it('should return table statistics', async () => {
      await setup.initialize();
      
      const stats = await setup.getTableStats('codebase');
      
      expect(stats).toBeDefined();
      expect(stats.name).toBe('codebase');
      expect(stats.rowCount).toBeDefined();
      expect(typeof stats.rowCount).toBe('number');
      expect(stats.storageDir).toBe(tempDir);
    });

    it('should throw error for non-existent table', async () => {
      await setup.initialize();
      
      await expect(setup.getTableStats('non_existent')).rejects.toThrow();
    });

    it('should throw error if not initialized', async () => {
      await expect(setup.getTableStats('codebase')).rejects.toThrow('LanceDB not initialized');
    });
  });
});

describe('createDefaultRAGConfig', () => {
  it('should create default configuration', () => {
    const storageDir = '/test/storage';
    const config = createDefaultRAGConfig(storageDir);
    
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true);
    expect(config.storageDir).toBe(storageDir);
    
    // Verify codebase config
    expect(config.codebase.autoIndex).toBe(true);
    expect(config.codebase.extensions).toContain('.ts');
    expect(config.codebase.extensions).toContain('.js');
    expect(config.codebase.extensions).toContain('.py');
    expect(config.codebase.excludePatterns).toContain('node_modules');
    expect(config.codebase.excludePatterns).toContain('dist');
    expect(config.codebase.maxFileSize).toBe(1048576); // 1MB
    expect(config.codebase.chunkSize).toBe(512);
    expect(config.codebase.chunkOverlap).toBe(50);
    
    // Verify embedding config
    expect(config.embedding.provider).toBe('local');
    expect(config.embedding.model).toBe('Xenova/all-MiniLM-L6-v2');
    
    // Verify search config
    expect(config.search.topK).toBe(5);
    expect(config.search.threshold).toBe(0.7);
  });

  it('should create config with custom storage directory', () => {
    const customDir = '/custom/path';
    const config = createDefaultRAGConfig(customDir);
    
    expect(config.storageDir).toBe(customDir);
  });
});

describe('LanceDBSetup - Error Handling', () => {
  it('should handle storage directory creation errors gracefully', async () => {
    const invalidConfig = createDefaultRAGConfig('\0invalid');
    const setup = new LanceDBSetup(invalidConfig);
    
    await expect(setup.initialize()).rejects.toThrow(/Failed to initialize LanceDB/);
  });

  it('should provide descriptive error messages', async () => {
    const invalidConfig = createDefaultRAGConfig('\0invalid');
    const setup = new LanceDBSetup(invalidConfig);
    
    try {
      await setup.initialize();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Failed to initialize LanceDB');
    }
  });
});

describe('LanceDBSetup - Integration', () => {
  let tempDir: string;
  let setup: any;
  let mockDb: any;
  let mockTable: any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lancedb-integration-'));
    const config = createDefaultRAGConfig(tempDir);
    
    // Setup mocks
    mockTable = {
      countRows: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    
    mockDb = {
      tableNames: vi.fn().mockResolvedValue([]),
      openTable: vi.fn().mockResolvedValue(mockTable),
      createTable: vi.fn().mockResolvedValue(mockTable),
      dropTable: vi.fn().mockResolvedValue(undefined)
    };
    
    const lancedb = await import('vectordb');
    vi.mocked(lancedb.connect).mockResolvedValue(mockDb);
    
    setup = new LanceDBSetup(config);
  });

  afterEach(async () => {
    try {
      await setup.shutdown();
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should support full lifecycle: initialize -> use -> shutdown', async () => {
    // Initialize
    const connection = await setup.initialize();
    expect(connection).toBeDefined();
    
    // Update mock to return table names
    mockDb.tableNames.mockResolvedValue([
      'codebase_index',
      'knowledge_debugger',
      'knowledge_security',
      'knowledge_performance',
      'knowledge_planning'
    ]);
    
    // Use
    const tables = await setup.listTables();
    expect(tables.length).toBeGreaterThan(0);
    
    // Shutdown
    await setup.shutdown();
    expect(() => setup.getConnection()).toThrow();
  });

  it('should handle multiple table operations', async () => {
    await setup.initialize();
    
    // Mock table names to include new tables
    mockDb.tableNames.mockResolvedValue([
      'codebase_index',
      'knowledge_debugger',
      'knowledge_security',
      'knowledge_performance',
      'knowledge_planning',
      'table1',
      'table2'
    ]);
    
    // Create custom table
    const schema1 = {
      name: 'table1',
      dimensions: 384,
      fields: [{ name: 'id', type: 'string' as const, required: true }]
    };
    await setup.createTable(schema1);
    
    // Create another table
    const schema2 = {
      name: 'table2',
      dimensions: 384,
      fields: [{ name: 'id', type: 'string' as const, required: true }]
    };
    await setup.createTable(schema2);
    
    // List tables
    const tables = await setup.listTables();
    expect(tables).toContain('table1');
    expect(tables).toContain('table2');
    
    // Drop table
    await setup.dropTable('table1');
    
    // Update mock to reflect dropped table
    mockDb.tableNames.mockResolvedValue([
      'codebase_index',
      'knowledge_debugger',
      'knowledge_security',
      'knowledge_performance',
      'knowledge_planning',
      'table2'
    ]);
    
    const tablesAfterDrop = await setup.listTables();
    expect(tablesAfterDrop).not.toContain('table1');
    expect(tablesAfterDrop).toContain('table2');
  });
});
