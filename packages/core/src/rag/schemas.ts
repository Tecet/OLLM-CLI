/**
 * LanceDB Table Schemas
 * 
 * Defines the schemas for all RAG system tables including codebase index
 * and mode-specific knowledge bases.
 */

import type { TableSchema } from './LanceDBSetup.js';

/**
 * Codebase index table schema
 * 
 * Stores code chunks with embeddings for semantic search
 */
export const CODEBASE_INDEX_SCHEMA: TableSchema = {
  name: 'codebase_index',
  dimensions: 384, // all-MiniLM-L6-v2 embedding dimensions
  fields: [
    {
      name: 'id',
      type: 'string',
      required: true
    },
    {
      name: 'filePath',
      type: 'string',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      required: true
    },
    {
      name: 'startLine',
      type: 'number',
      required: true
    },
    {
      name: 'endLine',
      type: 'number',
      required: true
    },
    {
      name: 'language',
      type: 'string',
      required: true
    },
    {
      name: 'lastModified',
      type: 'timestamp',
      required: true
    },
    {
      name: 'chunkIndex',
      type: 'number',
      required: false,
      default: 0
    },
    {
      name: 'fileSize',
      type: 'number',
      required: false,
      default: 0
    }
  ]
};

/**
 * Debugger mode knowledge base schema
 * 
 * Stores common bugs, error patterns, and solutions
 */
export const DEBUGGER_KNOWLEDGE_SCHEMA: TableSchema = {
  name: 'knowledge_debugger',
  dimensions: 384,
  fields: [
    {
      name: 'id',
      type: 'string',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      required: true
    },
    {
      name: 'type',
      type: 'string',
      required: true // 'bug', 'error_pattern', 'solution', 'root_cause'
    },
    {
      name: 'errorType',
      type: 'string',
      required: false
    },
    {
      name: 'stackTrace',
      type: 'string',
      required: false
    },
    {
      name: 'solution',
      type: 'string',
      required: false
    },
    {
      name: 'tags',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'source',
      type: 'string',
      required: false
    },
    {
      name: 'timestamp',
      type: 'timestamp',
      required: true
    }
  ]
};

/**
 * Security mode knowledge base schema
 * 
 * Stores vulnerabilities, security patterns, and fixes
 */
export const SECURITY_KNOWLEDGE_SCHEMA: TableSchema = {
  name: 'knowledge_security',
  dimensions: 384,
  fields: [
    {
      name: 'id',
      type: 'string',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      required: true
    },
    {
      name: 'type',
      type: 'string',
      required: true // 'vulnerability', 'exploit', 'fix', 'best_practice'
    },
    {
      name: 'severity',
      type: 'string',
      required: false // 'low', 'medium', 'high', 'critical'
    },
    {
      name: 'cveId',
      type: 'string',
      required: false
    },
    {
      name: 'affectedVersions',
      type: 'string',
      required: false
    },
    {
      name: 'recommendation',
      type: 'string',
      required: false
    },
    {
      name: 'tags',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'source',
      type: 'string',
      required: false
    },
    {
      name: 'timestamp',
      type: 'timestamp',
      required: true
    }
  ]
};

/**
 * Performance mode knowledge base schema
 * 
 * Stores optimization patterns, bottlenecks, and performance improvements
 */
export const PERFORMANCE_KNOWLEDGE_SCHEMA: TableSchema = {
  name: 'knowledge_performance',
  dimensions: 384,
  fields: [
    {
      name: 'id',
      type: 'string',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      required: true
    },
    {
      name: 'type',
      type: 'string',
      required: true // 'bottleneck', 'optimization', 'pattern', 'benchmark'
    },
    {
      name: 'category',
      type: 'string',
      required: false // 'cpu', 'memory', 'io', 'network', 'database'
    },
    {
      name: 'improvement',
      type: 'string',
      required: false // e.g., '50% faster', '30% less memory'
    },
    {
      name: 'before',
      type: 'string',
      required: false
    },
    {
      name: 'after',
      type: 'string',
      required: false
    },
    {
      name: 'tags',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'source',
      type: 'string',
      required: false
    },
    {
      name: 'timestamp',
      type: 'timestamp',
      required: true
    }
  ]
};

/**
 * Planning mode knowledge base schema
 * 
 * Stores design patterns, architectures, and best practices
 */
export const PLANNING_KNOWLEDGE_SCHEMA: TableSchema = {
  name: 'knowledge_planning',
  dimensions: 384,
  fields: [
    {
      name: 'id',
      type: 'string',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      required: true
    },
    {
      name: 'type',
      type: 'string',
      required: true // 'pattern', 'architecture', 'best_practice', 'anti_pattern'
    },
    {
      name: 'category',
      type: 'string',
      required: false // 'design', 'architecture', 'testing', 'deployment'
    },
    {
      name: 'useCase',
      type: 'string',
      required: false
    },
    {
      name: 'pros',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'cons',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'tags',
      type: 'json',
      required: false,
      default: []
    },
    {
      name: 'source',
      type: 'string',
      required: false
    },
    {
      name: 'timestamp',
      type: 'timestamp',
      required: true
    }
  ]
};

/**
 * All table schemas
 */
export const TABLE_SCHEMAS = {
  codebase: CODEBASE_INDEX_SCHEMA,
  debugger: DEBUGGER_KNOWLEDGE_SCHEMA,
  security: SECURITY_KNOWLEDGE_SCHEMA,
  performance: PERFORMANCE_KNOWLEDGE_SCHEMA,
  planning: PLANNING_KNOWLEDGE_SCHEMA
} as const;

/**
 * Get schema by table name
 */
export function getTableSchema(tableName: string): TableSchema | undefined {
  return TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];
}

/**
 * Validate a record against a schema
 */
export function validateRecord(record: any, schema: TableSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  for (const field of schema.fields) {
    if (field.required && !(field.name in record)) {
      errors.push(`Missing required field: ${field.name}`);
    }
  }
  
  // Check vector dimensions
  if ('vector' in record) {
    if (!Array.isArray(record.vector)) {
      errors.push('Vector must be an array');
    } else if (record.vector.length !== schema.dimensions) {
      errors.push(`Vector dimensions mismatch: expected ${schema.dimensions}, got ${record.vector.length}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a record ID from file path and chunk index
 */
export function createCodebaseRecordId(filePath: string, chunkIndex: number): string {
  return `${filePath}:${chunkIndex}`;
}

/**
 * Parse a codebase record ID
 */
export function parseCodebaseRecordId(id: string): { filePath: string; chunkIndex: number } | null {
  const parts = id.split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  const chunkIndex = parseInt(parts[1], 10);
  if (isNaN(chunkIndex)) {
    return null;
  }
  
  return {
    filePath: parts[0],
    chunkIndex
  };
}

/**
 * Create a knowledge record ID
 */
export function createKnowledgeRecordId(mode: string, type: string, timestamp: number): string {
  return `${mode}:${type}:${timestamp}`;
}
