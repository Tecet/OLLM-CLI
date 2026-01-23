/**
 * MCP Schema Converter
 * 
 * This module converts between MCP tool schemas and internal tool schemas.
 * Handles type mapping, parameter conversion, and result transformation.
 */

import { MCPTool } from './types.js';

import type { ToolSchema } from '../tools/types.js';

// Re-export ToolSchema for convenience
export type { ToolSchema };

/**
 * MCP schema converter interface
 */
export interface MCPSchemaConverter {
  /**
   * Convert MCP tool schema to internal ToolSchema
   * @param mcpTool - MCP tool definition
   * @returns Internal tool schema
   */
  convertToolSchema(mcpTool: MCPTool): ToolSchema;

  /**
   * Convert internal arguments to MCP format
   * @param args - Internal arguments
   * @returns MCP-formatted arguments
   */
  convertArgsToMCP(args: Record<string, unknown>): unknown;

  /**
   * Convert MCP result to internal format
   * @param result - MCP result
   * @returns Internal result format
   */
  convertResultFromMCP(result: unknown): unknown;
}

/**
 * Default MCP schema converter implementation
 */
export class DefaultMCPSchemaConverter implements MCPSchemaConverter {
  /**
   * Convert MCP tool schema to internal ToolSchema format
   * 
   * Maps MCP JSON Schema to internal tool schema format, handling:
   * - Basic types (string, number, boolean, object, array)
   * - Required vs optional parameters
   * - Descriptions and constraints
   * - Nested objects and arrays
   * 
   * @param mcpTool - MCP tool definition with JSON Schema
   * @returns Internal tool schema
   */
  convertToolSchema(mcpTool: MCPTool): ToolSchema {
    return {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: this.convertSchemaToParameters(mcpTool.inputSchema),
    };
  }

  /**
   * Convert internal arguments to MCP format
   * 
   * MCP expects arguments as a plain object matching the input schema.
   * This method performs a pass-through conversion, ensuring the args
   * are in the correct format for MCP tool invocation.
   * 
   * @param args - Internal arguments object
   * @returns MCP-formatted arguments
   */
  convertArgsToMCP(args: Record<string, unknown>): unknown {
    // MCP expects arguments as a plain object
    // We perform a deep clone to avoid mutation and ensure proper serialization
    return this.deepClone(args);
  }

  /**
   * Convert MCP result to internal format
   * 
   * MCP results can be any JSON-serializable value. This method
   * ensures the result is properly formatted for internal use.
   * 
   * @param result - MCP result value
   * @returns Internal result format
   */
  convertResultFromMCP(result: unknown): unknown {
    // MCP results are already in a compatible format
    // We perform a deep clone to ensure immutability
    return this.deepClone(result);
  }

  /**
   * Convert MCP JSON Schema to internal parameters format
   * 
   * @param schema - MCP input schema (JSON Schema)
   * @returns Internal parameters object
   */
  private convertSchemaToParameters(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {};
    }

    const schemaObj = schema as Record<string, unknown>;

    // Handle JSON Schema object with properties
    if (schemaObj.type === 'object' && schemaObj.properties) {
      return {
        type: 'object',
        properties: this.convertProperties(schemaObj.properties as Record<string, unknown>),
        required: schemaObj.required || [],
        additionalProperties: schemaObj.additionalProperties ?? true,
      };
    }

    // Pass through other schema types
    return schemaObj;
  }

  /**
   * Convert JSON Schema properties to internal format
   * 
   * @param properties - JSON Schema properties object
   * @returns Converted properties
   */
  private convertProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const converted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === 'object') {
        const propSchema = value as Record<string, unknown>;
        
        // Handle nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          converted[key] = {
            type: 'object',
            properties: this.convertProperties(propSchema.properties as Record<string, unknown>),
            required: propSchema.required || [],
            description: propSchema.description,
          };
        }
        // Handle arrays
        else if (propSchema.type === 'array' && propSchema.items) {
          converted[key] = {
            type: 'array',
            items: this.convertSchemaToParameters(propSchema.items),
            description: propSchema.description,
          };
        }
        // Handle primitive types
        else {
          converted[key] = {
            type: propSchema.type || 'string',
            description: propSchema.description,
            enum: propSchema.enum,
            default: propSchema.default,
            minimum: propSchema.minimum,
            maximum: propSchema.maximum,
            minLength: propSchema.minLength,
            maxLength: propSchema.maxLength,
            pattern: propSchema.pattern,
          };
        }
      }
    }

    return converted;
  }

  /**
   * Deep clone an object to ensure immutability
   * 
   * @param obj - Object to clone
   * @returns Cloned object
   */
  private deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value);
    }

    return cloned;
  }
}
