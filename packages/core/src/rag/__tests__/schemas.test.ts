/**
 * Unit tests for RAG table schemas
 */

import { describe, it, expect } from 'vitest';
import {
  CODEBASE_INDEX_SCHEMA,
  DEBUGGER_KNOWLEDGE_SCHEMA,
  SECURITY_KNOWLEDGE_SCHEMA,
  PERFORMANCE_KNOWLEDGE_SCHEMA,
  PLANNING_KNOWLEDGE_SCHEMA,
  TABLE_SCHEMAS,
  getTableSchema,
  validateRecord,
  createCodebaseRecordId,
  parseCodebaseRecordId,
  createKnowledgeRecordId
} from '../schemas.js';

describe('Table Schemas', () => {
  describe('CODEBASE_INDEX_SCHEMA', () => {
    it('should have correct structure', () => {
      expect(CODEBASE_INDEX_SCHEMA.name).toBe('codebase_index');
      expect(CODEBASE_INDEX_SCHEMA.dimensions).toBe(384);
      expect(CODEBASE_INDEX_SCHEMA.fields).toBeDefined();
      expect(Array.isArray(CODEBASE_INDEX_SCHEMA.fields)).toBe(true);
    });

    it('should have required fields', () => {
      const fieldNames = CODEBASE_INDEX_SCHEMA.fields.map(f => f.name);
      
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('filePath');
      expect(fieldNames).toContain('content');
      expect(fieldNames).toContain('startLine');
      expect(fieldNames).toContain('endLine');
      expect(fieldNames).toContain('language');
      expect(fieldNames).toContain('lastModified');
    });

    it('should have correct field types', () => {
      const fields = CODEBASE_INDEX_SCHEMA.fields;
      
      const idField = fields.find(f => f.name === 'id');
      expect(idField?.type).toBe('string');
      expect(idField?.required).toBe(true);
      
      const startLineField = fields.find(f => f.name === 'startLine');
      expect(startLineField?.type).toBe('number');
      
      const lastModifiedField = fields.find(f => f.name === 'lastModified');
      expect(lastModifiedField?.type).toBe('timestamp');
    });
  });

  describe('DEBUGGER_KNOWLEDGE_SCHEMA', () => {
    it('should have correct structure', () => {
      expect(DEBUGGER_KNOWLEDGE_SCHEMA.name).toBe('knowledge_debugger');
      expect(DEBUGGER_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
      expect(DEBUGGER_KNOWLEDGE_SCHEMA.fields).toBeDefined();
    });

    it('should have debugger-specific fields', () => {
      const fieldNames = DEBUGGER_KNOWLEDGE_SCHEMA.fields.map(f => f.name);
      
      expect(fieldNames).toContain('errorType');
      expect(fieldNames).toContain('stackTrace');
      expect(fieldNames).toContain('solution');
    });
  });

  describe('SECURITY_KNOWLEDGE_SCHEMA', () => {
    it('should have correct structure', () => {
      expect(SECURITY_KNOWLEDGE_SCHEMA.name).toBe('knowledge_security');
      expect(SECURITY_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    });

    it('should have security-specific fields', () => {
      const fieldNames = SECURITY_KNOWLEDGE_SCHEMA.fields.map(f => f.name);
      
      expect(fieldNames).toContain('severity');
      expect(fieldNames).toContain('cveId');
      expect(fieldNames).toContain('affectedVersions');
      expect(fieldNames).toContain('recommendation');
    });
  });

  describe('PERFORMANCE_KNOWLEDGE_SCHEMA', () => {
    it('should have correct structure', () => {
      expect(PERFORMANCE_KNOWLEDGE_SCHEMA.name).toBe('knowledge_performance');
      expect(PERFORMANCE_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    });

    it('should have performance-specific fields', () => {
      const fieldNames = PERFORMANCE_KNOWLEDGE_SCHEMA.fields.map(f => f.name);
      
      expect(fieldNames).toContain('category');
      expect(fieldNames).toContain('improvement');
      expect(fieldNames).toContain('before');
      expect(fieldNames).toContain('after');
    });
  });

  describe('PLANNING_KNOWLEDGE_SCHEMA', () => {
    it('should have correct structure', () => {
      expect(PLANNING_KNOWLEDGE_SCHEMA.name).toBe('knowledge_planning');
      expect(PLANNING_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    });

    it('should have planning-specific fields', () => {
      const fieldNames = PLANNING_KNOWLEDGE_SCHEMA.fields.map(f => f.name);
      
      expect(fieldNames).toContain('category');
      expect(fieldNames).toContain('useCase');
      expect(fieldNames).toContain('pros');
      expect(fieldNames).toContain('cons');
    });
  });

  describe('TABLE_SCHEMAS', () => {
    it('should contain all schemas', () => {
      expect(TABLE_SCHEMAS.codebase).toBe(CODEBASE_INDEX_SCHEMA);
      expect(TABLE_SCHEMAS.debugger).toBe(DEBUGGER_KNOWLEDGE_SCHEMA);
      expect(TABLE_SCHEMAS.security).toBe(SECURITY_KNOWLEDGE_SCHEMA);
      expect(TABLE_SCHEMAS.performance).toBe(PERFORMANCE_KNOWLEDGE_SCHEMA);
      expect(TABLE_SCHEMAS.planning).toBe(PLANNING_KNOWLEDGE_SCHEMA);
    });
  });
});

describe('getTableSchema', () => {
  it('should return schema for valid table name', () => {
    expect(getTableSchema('codebase')).toBe(CODEBASE_INDEX_SCHEMA);
    expect(getTableSchema('debugger')).toBe(DEBUGGER_KNOWLEDGE_SCHEMA);
    expect(getTableSchema('security')).toBe(SECURITY_KNOWLEDGE_SCHEMA);
    expect(getTableSchema('performance')).toBe(PERFORMANCE_KNOWLEDGE_SCHEMA);
    expect(getTableSchema('planning')).toBe(PLANNING_KNOWLEDGE_SCHEMA);
  });

  it('should return undefined for invalid table name', () => {
    expect(getTableSchema('invalid')).toBeUndefined();
    expect(getTableSchema('')).toBeUndefined();
  });
});

describe('validateRecord', () => {
  it('should validate valid codebase record', () => {
    const record = {
      id: 'test-id',
      vector: new Array(384).fill(0),
      filePath: 'test.ts',
      content: 'test content',
      startLine: 1,
      endLine: 10,
      language: 'typescript',
      lastModified: Date.now()
    };
    
    const result = validateRecord(record, CODEBASE_INDEX_SCHEMA);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', () => {
    const record = {
      id: 'test-id',
      vector: new Array(384).fill(0),
      // Missing required fields
    };
    
    const result = validateRecord(record, CODEBASE_INDEX_SCHEMA);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('filePath'))).toBe(true);
  });

  it('should detect invalid vector dimensions', () => {
    const record = {
      id: 'test-id',
      vector: new Array(128).fill(0), // Wrong dimensions
      filePath: 'test.ts',
      content: 'test',
      startLine: 1,
      endLine: 10,
      language: 'typescript',
      lastModified: Date.now()
    };
    
    const result = validateRecord(record, CODEBASE_INDEX_SCHEMA);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('dimensions'))).toBe(true);
  });

  it('should detect non-array vector', () => {
    const record = {
      id: 'test-id',
      vector: 'not-an-array',
      filePath: 'test.ts',
      content: 'test',
      startLine: 1,
      endLine: 10,
      language: 'typescript',
      lastModified: Date.now()
    };
    
    const result = validateRecord(record, CODEBASE_INDEX_SCHEMA);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Vector must be an array'))).toBe(true);
  });

  it('should validate knowledge record', () => {
    const record = {
      id: 'knowledge-1',
      vector: new Array(384).fill(0),
      content: 'Bug description',
      type: 'bug',
      tags: ['javascript', 'async'],
      timestamp: Date.now()
    };
    
    const result = validateRecord(record, DEBUGGER_KNOWLEDGE_SCHEMA);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('createCodebaseRecordId', () => {
  it('should create ID from file path and chunk index', () => {
    const id = createCodebaseRecordId('src/test.ts', 0);
    expect(id).toBe('src/test.ts:0');
  });

  it('should handle different chunk indices', () => {
    expect(createCodebaseRecordId('file.ts', 0)).toBe('file.ts:0');
    expect(createCodebaseRecordId('file.ts', 1)).toBe('file.ts:1');
    expect(createCodebaseRecordId('file.ts', 99)).toBe('file.ts:99');
  });

  it('should handle paths with special characters', () => {
    const id = createCodebaseRecordId('path/to/file-name.test.ts', 5);
    expect(id).toBe('path/to/file-name.test.ts:5');
  });
});

describe('parseCodebaseRecordId', () => {
  it('should parse valid record ID', () => {
    const result = parseCodebaseRecordId('src/test.ts:0');
    
    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('src/test.ts');
    expect(result?.chunkIndex).toBe(0);
  });

  it('should parse different chunk indices', () => {
    const result1 = parseCodebaseRecordId('file.ts:1');
    expect(result1?.chunkIndex).toBe(1);
    
    const result2 = parseCodebaseRecordId('file.ts:99');
    expect(result2?.chunkIndex).toBe(99);
  });

  it('should return null for invalid format', () => {
    expect(parseCodebaseRecordId('invalid')).toBeNull();
    expect(parseCodebaseRecordId('no-colon')).toBeNull();
    expect(parseCodebaseRecordId('too:many:colons')).toBeNull();
  });

  it('should return null for non-numeric chunk index', () => {
    expect(parseCodebaseRecordId('file.ts:abc')).toBeNull();
    // Note: parseInt('1.5') returns 1, so this is valid
    const result = parseCodebaseRecordId('file.ts:1.5');
    expect(result?.chunkIndex).toBe(1); // parseInt behavior
  });

  it('should handle paths with colons in file path', () => {
    // This is an edge case - the function splits on ':' so it will fail
    // This documents the current behavior
    const result = parseCodebaseRecordId('C:/path/file.ts:0');
    expect(result).toBeNull(); // Expected behavior with current implementation
  });
});

describe('createKnowledgeRecordId', () => {
  it('should create ID from mode, type, and timestamp', () => {
    const timestamp = Date.now();
    const id = createKnowledgeRecordId('debugger', 'bug', timestamp);
    
    expect(id).toBe(`debugger:bug:${timestamp}`);
  });

  it('should handle different modes', () => {
    const timestamp = Date.now();
    
    expect(createKnowledgeRecordId('debugger', 'bug', timestamp)).toContain('debugger');
    expect(createKnowledgeRecordId('security', 'vulnerability', timestamp)).toContain('security');
    expect(createKnowledgeRecordId('performance', 'optimization', timestamp)).toContain('performance');
  });

  it('should create unique IDs for different timestamps', () => {
    const id1 = createKnowledgeRecordId('debugger', 'bug', 1000);
    const id2 = createKnowledgeRecordId('debugger', 'bug', 2000);
    
    expect(id1).not.toBe(id2);
  });
});

describe('Schema Consistency', () => {
  it('all schemas should have 384 dimensions', () => {
    expect(CODEBASE_INDEX_SCHEMA.dimensions).toBe(384);
    expect(DEBUGGER_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    expect(SECURITY_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    expect(PERFORMANCE_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
    expect(PLANNING_KNOWLEDGE_SCHEMA.dimensions).toBe(384);
  });

  it('all schemas should have id field', () => {
    const schemas = [
      CODEBASE_INDEX_SCHEMA,
      DEBUGGER_KNOWLEDGE_SCHEMA,
      SECURITY_KNOWLEDGE_SCHEMA,
      PERFORMANCE_KNOWLEDGE_SCHEMA,
      PLANNING_KNOWLEDGE_SCHEMA
    ];
    
    for (const schema of schemas) {
      const hasIdField = schema.fields.some(f => f.name === 'id' && f.required);
      expect(hasIdField).toBe(true);
    }
  });

  it('all knowledge schemas should have common fields', () => {
    const knowledgeSchemas = [
      DEBUGGER_KNOWLEDGE_SCHEMA,
      SECURITY_KNOWLEDGE_SCHEMA,
      PERFORMANCE_KNOWLEDGE_SCHEMA,
      PLANNING_KNOWLEDGE_SCHEMA
    ];
    
    for (const schema of knowledgeSchemas) {
      const fieldNames = schema.fields.map(f => f.name);
      
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('content');
      expect(fieldNames).toContain('type');
      expect(fieldNames).toContain('tags');
      expect(fieldNames).toContain('timestamp');
    }
  });
});
