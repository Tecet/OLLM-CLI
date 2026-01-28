/**
 * Parameter validation utilities for tool invocations
 *
 * Provides validation of tool parameters against JSON schemas to ensure
 * type safety and catch errors before tool execution.
 */

import type { ToolSchema } from './types.js';

type PropertySchema = {
  type?: string;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: PropertySchema;
};

type SchemaParams = {
  required?: string[];
  properties?: Record<string, PropertySchema>;
};

/**
 * Validation error with detailed information
 */
export interface ValidationError {
  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Error type for programmatic handling
   */
  type: 'ValidationError';

  /**
   * Detailed validation errors
   */
  details?: Array<{
    /**
     * Path to the invalid parameter (e.g., "path", "startLine")
     */
    path: string;

    /**
     * Description of the validation failure
     */
    message: string;
  }>;
}

/**
 * Parameter validator for tool invocations
 *
 * Implements basic JSON Schema validation for tool parameters.
 * Validates required fields, types, and enum values.
 */
export class ParameterValidator {
  private schemas: Map<string, ToolSchema>;

  constructor() {
    this.schemas = new Map();
  }

  /**
   * Register a tool schema for validation
   *
   * @param toolName Name of the tool
   * @param schema JSON Schema for the tool's parameters
   */
  registerSchema(toolName: string, schema: ToolSchema): void {
    this.schemas.set(toolName, schema);
  }

  /**
   * Validate parameters against a tool's schema
   *
   * @param toolName Name of the tool
   * @param params Parameters to validate
   * @returns null if valid, ValidationError if invalid
   */
  validate(toolName: string, params: Record<string, unknown>): ValidationError | null {
    const schema = this.schemas.get(toolName);

    // If no schema exists, assume no validation is needed
    if (!schema || !schema.parameters) {
      return null;
    }

    const errors: Array<{ path: string; message: string }> = [];
    const schemaParams = schema.parameters as SchemaParams;

    // Validate required fields
    if (schemaParams.required && Array.isArray(schemaParams.required)) {
      for (const requiredField of schemaParams.required) {
        if (!(requiredField in params) || params[requiredField] === undefined) {
          errors.push({
            path: requiredField,
            message: `Missing required parameter: ${requiredField}`,
          });
        }
      }
    }

    // Validate types and constraints for each property
    if (schemaParams.properties) {
      for (const [key, propSchema] of Object.entries(schemaParams.properties)) {
        if (key in params && params[key] !== undefined) {
          const value = params[key];
          const error = this.validateProperty(key, value, propSchema);
          if (error) {
            errors.push(error);
          }
        }
      }
    }

    if (errors.length === 0) {
      return null;
    }

    const message = `Invalid parameters for tool "${toolName}": ${errors.map((e) => e.message).join('; ')}`;

    return {
      message,
      type: 'ValidationError',
      details: errors,
    };
  }

  /**
   * Validate a single property against its schema
   *
   * @param path Property path
   * @param value Property value
   * @param schema Property schema
   * @returns Error object if invalid, null if valid
   */
  private validateProperty(
    path: string,
    value: unknown,
    schema: PropertySchema
  ): { path: string; message: string } | null {
    // Validate type
    if (schema.type) {
      const actualType = this.getType(value);
      const expectedType = schema.type;

      if (actualType !== expectedType) {
        return {
          path,
          message: `Parameter "${path}" has invalid type: expected ${expectedType}, got ${actualType}`,
        };
      }
    }

    // Validate enum
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        return {
          path,
          message: `Parameter "${path}" must be one of: ${schema.enum.join(', ')}`,
        };
      }
    }

    // Validate string constraints
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return {
          path,
          message: `Parameter "${path}" must be at least ${schema.minLength} characters`,
        };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return {
          path,
          message: `Parameter "${path}" must be at most ${schema.maxLength} characters`,
        };
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          return {
            path,
            message: `Parameter "${path}" does not match required pattern`,
          };
        }
      }
    }

    // Validate number constraints
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        return {
          path,
          message: `Parameter "${path}" must be at least ${schema.minimum}`,
        };
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return {
          path,
          message: `Parameter "${path}" must be at most ${schema.maximum}`,
        };
      }
    }

    // Validate array constraints
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return {
          path,
          message: `Parameter "${path}" must have at least ${schema.minItems} items`,
        };
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return {
          path,
          message: `Parameter "${path}" must have at most ${schema.maxItems} items`,
        };
      }

      // Validate array items if schema is provided
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemError = this.validateProperty(`${path}[${i}]`, value[i], schema.items);
          if (itemError) {
            return itemError;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the JSON Schema type of a value
   *
   * @param value Value to check
   * @returns JSON Schema type string
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      // JSON Schema uses 'number' for both integers and floats
      // Some schemas may use 'integer', but we'll treat all numbers as 'number'
      return 'number';
    }
    return typeof value;
  }

  /**
   * Clear all registered schemas
   */
  clear(): void {
    this.schemas.clear();
  }
}

/**
 * Global parameter validator instance
 *
 * This can be used across the application to validate tool parameters.
 * Tools should register their schemas during registration.
 */
export const globalValidator = new ParameterValidator();
