/**
 * Manifest parser for extension system
 * 
 * Parses and validates extension manifest.json files using JSON schema validation.
 */

import { readFile } from 'fs/promises';
import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import type { ExtensionManifest } from './types.js';

/**
 * JSON schema for extension manifest validation
 */
const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'description'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-z0-9-]+$',
      description: 'Extension name (lowercase, alphanumeric, hyphens only)',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version (e.g., 1.0.0)',
    },
    description: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable description',
    },
    mcpServers: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['command', 'args'],
        properties: {
          command: { type: 'string', minLength: 1 },
          args: {
            type: 'array',
            items: { type: 'string' },
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          transport: {
            type: 'string',
            enum: ['stdio', 'sse', 'http'],
          },
          timeout: {
            type: 'number',
            minimum: 0,
          },
        },
      },
    },
    hooks: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'command'],
          properties: {
            name: { type: 'string', minLength: 1 },
            command: { type: 'string', minLength: 1 },
            args: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    settings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string', minLength: 1 },
          envVar: { type: 'string' },
          sensitive: { type: 'boolean' },
          description: { type: 'string', minLength: 1 },
          default: {},
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'description', 'prompt'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          prompt: { type: 'string', minLength: 1 },
        },
      },
    },
  },
  additionalProperties: false,
} as const;

/**
 * Manifest parser for extension system
 */
export class ManifestParser {
  private ajv: InstanceType<typeof Ajv>;
  private validator: ValidateFunction;
  private errors: string[] = [];

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strictSchema: false });
    this.validator = this.ajv.compile(MANIFEST_SCHEMA);
  }

  /**
   * Parse manifest from file path
   * 
   * @param path - Path to manifest.json file
   * @returns Parsed and validated manifest
   * @throws Error if file cannot be read or manifest is invalid
   */
  async parseManifest(path: string): Promise<ExtensionManifest> {
    this.errors = [];

    try {
      const content = await readFile(path, 'utf-8');
      const manifest = JSON.parse(content);

      if (!this.validateManifest(manifest)) {
        throw new Error(
          `Invalid manifest at ${path}:\n${this.errors.join('\n')}`
        );
      }

      return manifest as ExtensionManifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in manifest at ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate manifest structure against schema
   * 
   * @param manifest - Manifest object to validate
   * @returns True if valid, false otherwise
   */
  validateManifest(manifest: unknown): boolean {
    this.errors = [];

    const valid = this.validator(manifest);

    if (!valid && this.validator.errors) {
      this.errors = this.validator.errors.map((error: ErrorObject) => {
        const fallbackPath = (error as { dataPath?: string }).dataPath;
        const path = error.instancePath || fallbackPath || 'root';
        const message = error.message || 'validation failed';
        return `${path}: ${message}`;
      });
    }

    return valid;
  }

  /**
   * Get validation errors from last validation
   * 
   * @returns Array of error messages
   */
  getErrors(): string[] {
    return [...this.errors];
  }
}
