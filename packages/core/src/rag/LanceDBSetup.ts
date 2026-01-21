/**
 * LanceDB Setup and Initialization
 * 
 * Handles database initialization, table creation, and schema management for the RAG system.
 */

import * as lancedb from 'vectordb';
import { mkdir } from 'fs/promises';
import type { RAGConfig } from './RAGSystem.js';

/**
 * Table schema definition
 */
export interface TableSchema {
  /** Table name */
  name: string;
  
  /** Vector dimensions */
  dimensions: number;
  
  /** Additional fields */
  fields: SchemaField[];
}

/**
 * Schema field definition
 */
export interface SchemaField {
  /** Field name */
  name: string;
  
  /** Field type */
  type: 'string' | 'number' | 'boolean' | 'timestamp' | 'json';
  
  /** Is field required */
  required?: boolean;
  
  /** Default value */
  default?: unknown;
}

/**
 * LanceDB connection and table information
 */
export interface LanceDBConnection {
  /** Database connection */
  db: lancedb.Connection;
  
  /** Created tables */
  tables: Map<string, lancedb.Table>;
  
  /** Storage directory */
  storageDir: string;
}

/**
 * LanceDB Setup class for database initialization
 */
export class LanceDBSetup {
  private connection: LanceDBConnection | null = null;
  private config: RAGConfig;
  
  constructor(config: RAGConfig) {
    this.config = config;
  }
  
  /**
   * Initialize the LanceDB database and create tables
   */
  async initialize(): Promise<LanceDBConnection> {
    try {
      // Ensure storage directory exists
      await this.ensureStorageDirectory();
      
      // Connect to LanceDB
      const db = await this.connectToDatabase();
      
      // Create tables
      const tables = new Map<string, lancedb.Table>();
      
      // Create codebase index table
      const codebaseTable = await this.createCodebaseTable(db);
      tables.set('codebase', codebaseTable);
      
      // Create mode-specific knowledge tables
      const debuggerTable = await this.createModeKnowledgeTable(db, 'debugger');
      tables.set('debugger', debuggerTable);
      
      const securityTable = await this.createModeKnowledgeTable(db, 'security');
      tables.set('security', securityTable);
      
      const performanceTable = await this.createModeKnowledgeTable(db, 'performance');
      tables.set('performance', performanceTable);
      
      const planningTable = await this.createModeKnowledgeTable(db, 'planning');
      tables.set('planning', planningTable);
      
      this.connection = {
        db,
        tables,
        storageDir: this.config.storageDir
      };
      
      return this.connection;
    } catch (error) {
      throw new Error(`Failed to initialize LanceDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the current connection
   */
  getConnection(): LanceDBConnection {
    if (!this.connection) {
      throw new Error('LanceDB not initialized. Call initialize() first.');
    }
    return this.connection;
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.connection) {
      // LanceDB connections are automatically cleaned up
      this.connection = null;
    }
  }
  
  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await mkdir(this.config.storageDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create storage directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Connect to LanceDB database
   */
  private async connectToDatabase(): Promise<lancedb.Connection> {
    try {
      const db = await lancedb.connect(this.config.storageDir);
      return db;
    } catch (error) {
      throw new Error(`Failed to connect to LanceDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create codebase index table
   */
  private async createCodebaseTable(db: lancedb.Connection): Promise<lancedb.Table> {
    const tableName = 'codebase_index';
    
    try {
      // Check if table exists
      const tableNames = await db.tableNames();
      if (tableNames.includes(tableName)) {
        return await db.openTable(tableName);
      }
      
      // Create table with schema
      // LanceDB will infer schema from first insert, so we create an empty table
      const table = await db.createTable(tableName, [
        {
          id: 'init',
          vector: new Array(384).fill(0), // Default dimensions for all-MiniLM-L6-v2
          filePath: '',
          content: '',
          startLine: 0,
          endLine: 0,
          language: '',
          lastModified: Date.now()
        }
      ]);
      
      // Delete the initialization record
      await table.delete('id = "init"');
      
      return table;
    } catch (error) {
      throw new Error(`Failed to create codebase table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create mode-specific knowledge table
   */
  private async createModeKnowledgeTable(
    db: lancedb.Connection,
    mode: string
  ): Promise<lancedb.Table> {
    const tableName = `knowledge_${mode}`;
    
    try {
      // Check if table exists
      const tableNames = await db.tableNames();
      if (tableNames.includes(tableName)) {
        return await db.openTable(tableName);
      }
      
      // Create table with schema
      const table = await db.createTable(tableName, [
        {
          id: 'init',
          vector: new Array(384).fill(0), // Default dimensions
          content: '',
          type: '',
          severity: '',
          tags: [],
          source: '',
          timestamp: Date.now()
        }
      ]);
      
      // Delete the initialization record
      await table.delete('id = "init"');
      
      return table;
    } catch (error) {
      throw new Error(`Failed to create ${mode} knowledge table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a custom table with specified schema
   */
  async createTable(schema: TableSchema): Promise<lancedb.Table> {
    if (!this.connection) {
      throw new Error('LanceDB not initialized');
    }
    
    try {
      const { db, tables } = this.connection;
      
      // Check if table already exists
      if (tables.has(schema.name)) {
        return tables.get(schema.name)!;
      }
      
      // Build initial record for schema inference
      const initRecord: Record<string, unknown> = {
        id: 'init',
        vector: new Array(schema.dimensions).fill(0)
      };
      
      // Add fields from schema
      for (const field of schema.fields) {
        initRecord[field.name] = this.getDefaultValue(field);
      }
      
      // Create table
      const table = await db.createTable(schema.name, [initRecord]);
      
      // Delete initialization record
      await table.delete('id = "init"');
      
      // Store in tables map
      tables.set(schema.name, table);
      
      return table;
    } catch (error) {
      throw new Error(`Failed to create table ${schema.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Drop a table
   */
  async dropTable(tableName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('LanceDB not initialized');
    }
    
    try {
      const { db, tables } = this.connection;
      
      await db.dropTable(tableName);
      tables.delete(tableName);
    } catch (error) {
      throw new Error(`Failed to drop table ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List all tables
   */
  async listTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('LanceDB not initialized');
    }
    
    try {
      return await this.connection.db.tableNames();
    } catch (error) {
      throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get table statistics
   */
  async getTableStats(tableName: string): Promise<TableStats> {
    if (!this.connection) {
      throw new Error('LanceDB not initialized');
    }
    
    try {
      const table = this.connection.tables.get(tableName);
      if (!table) {
        throw new Error(`Table ${tableName} not found`);
      }
      
      const count = await table.countRows();
      
      return {
        name: tableName,
        rowCount: count,
        storageDir: this.config.storageDir
      };
    } catch (error) {
      throw new Error(`Failed to get table stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get default value for a schema field
   */
  private getDefaultValue(field: SchemaField): unknown {
    if (field.default !== undefined) {
      return field.default;
    }
    
    switch (field.type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'timestamp':
        return Date.now();
      case 'json':
        return {};
      default:
        return null;
    }
  }
}

/**
 * Table statistics
 */
export interface TableStats {
  /** Table name */
  name: string;
  
  /** Number of rows */
  rowCount: number;
  
  /** Storage directory */
  storageDir: string;
}

/**
 * Create a default RAG configuration
 */
export function createDefaultRAGConfig(storageDir: string): RAGConfig {
  return {
    enabled: true,
    storageDir,
    codebase: {
      autoIndex: true,
      extensions: ['.ts', '.js', '.py', '.md', '.json'],
      excludePatterns: ['node_modules', 'dist', '.git', 'build', 'coverage'],
      maxFileSize: 1048576, // 1MB
      chunkSize: 512,
      chunkOverlap: 50
    },
    embedding: {
      provider: 'local',
      model: 'Xenova/all-MiniLM-L6-v2'
    },
    search: {
      topK: 5,
      threshold: 0.7
    }
  };
}
