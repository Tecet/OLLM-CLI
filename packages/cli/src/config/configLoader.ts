/**
 * Configuration loader with layered precedence
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

import { defaultConfig } from './defaults.js';
import { configSchema } from './schema.js';
import { ConfigError } from './types.js';

import type { Config, ConfigSource, ValidationError, ValidationResult } from './types.js';

let validate: ValidateFunction<Config> | null = null;

/**
 * Get or create the validator instance
 */
function getValidator() {
  if (!validate) {
    const ajv = new (Ajv as any)({ allErrors: true, strict: false });
    (addFormats as any)(ajv);
    validate = (ajv.compile as any)(configSchema) as ValidateFunction<Config>;
  }
  return validate;
}

/**
 * Deep merge two objects, with source taking precedence
 * Empty strings and whitespace-only strings in string fields are treated as missing values
 * Explicitly set values (including 0, false, empty arrays) are preserved
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  // Use loose internal typing to allow merging arbitrary config shapes
  const result: any = { ...(target as any) };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = (source as any)[key];
    const targetValue = result[key];

    // Skip undefined values (but not null, 0, false, or empty string)
    if (sourceValue === undefined) {
      continue;
    }

    // Skip empty or whitespace-only strings entirely (treat as missing)
    if (typeof sourceValue === 'string' && sourceValue.trim() === '') {
      continue;
    }

    // For nested objects, recurse
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
    } else {
      // For all other values (including 0, false, null, empty arrays), source takes precedence
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Get configuration file path for a given type
 */
export function getConfigPath(type: 'user' | 'workspace'): string {
  if (type === 'user') {
    return join(homedir(), '.ollm', 'config.yaml');
  } else {
    return join(process.cwd(), '.ollm', 'config.yaml');
  }
}

/**
 * Extract line and column from YAML parse error
 */
function extractYamlErrorLocation(error: unknown): { line?: number; column?: number } {
  const err = error as { mark?: { line?: number; column?: number }; message?: string };
  // YAML parser errors often have mark property with line/column
  if (err.mark) {
    return {
      line: (err.mark.line ?? 0) + 1, // Convert 0-based to 1-based
      column: (err.mark.column ?? 0) + 1,
    };
  }
  
  // Try to extract from error message
  const lineMatch = err.message?.match(/line (\d+)/i);
  const colMatch = err.message?.match(/column (\d+)/i);
  
  return {
    line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
    column: colMatch ? parseInt(colMatch[1], 10) : undefined,
  };
}

/**
 * Get code snippet around error location
 */
function getErrorSnippet(content: string, line?: number, column?: number): string | undefined {
  if (line === undefined) {
    return undefined;
  }
  
  const lines = content.split('\n');
  const errorLine = lines[line - 1]; // Convert 1-based to 0-based
  
  if (!errorLine) {
    return undefined;
  }
  
  let snippet = `  ${line} | ${errorLine}\n`;
  
  if (column !== undefined) {
    // Add caret indicator
    const padding = String(line).length + 3; // "  N | "
    const spaces = ' '.repeat(padding + column - 1);
    snippet += `${spaces}^\n`;
  }
  
  // Add context lines if available
  const contextLines: string[] = [];
  
  if (line > 1 && lines[line - 2]) {
    contextLines.push(`  ${line - 1} | ${lines[line - 2]}`);
  }
  
  contextLines.push(snippet.trim());
  
  if (line < lines.length && lines[line]) {
    contextLines.push(`  ${line + 1} | ${lines[line]}`);
  }
  
  return contextLines.join('\n');
}

/**
 * Load configuration from a YAML file
 */
function loadConfigFile(path: string): Partial<Config> | null {
  if (!existsSync(path)) {
    return null;
  }
  
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (error) {
    throw new ConfigError(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
      path
    );
  }
  
  try {
    return parseYaml(content) as Partial<Config>;
  } catch (error) {
    const location = extractYamlErrorLocation(error);
    const snippet = getErrorSnippet(content, location.line, location.column);
    
    let message = 'Failed to parse YAML';
    if (error instanceof Error && error.message) {
      // Clean up error message
      message = error.message.replace(/^.*?:\s*/, '');
    }
    
    // Add common fix suggestions
    const suggestions: string[] = [];
    if (message.includes('quote') || message.includes('string')) {
      suggestions.push('Tip: Check for missing or unmatched quotes');
    }
    if (message.includes('indent') || message.includes('mapping')) {
      suggestions.push('Tip: Check indentation (use spaces, not tabs)');
    }
    if (message.includes('comma')) {
      suggestions.push('Tip: YAML does not use trailing commas');
    }
    
    let fullMessage = message;
    if (suggestions.length > 0) {
      fullMessage += '\n\n' + suggestions.join('\n');
    }
    
    throw new ConfigError(
      fullMessage,
      path,
      location.line,
      location.column,
      snippet
    );
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<Config> {
  const config: Partial<Config> = {};
  
  // Provider settings
  if (process.env.OLLAMA_HOST) {
    config.provider = {
      ...(config.provider ?? {}),
      ollama: {
        host: process.env.OLLAMA_HOST,
        timeout: 30000,
      },
    } as any;
  }
  
  if (process.env.VLLM_HOST) {
    config.provider = {
      ...(config.provider ?? {}),
      vllm: {
        host: process.env.VLLM_HOST,
        apiKey: process.env.VLLM_API_KEY,
      },
    } as any;
  }
  
  if (process.env.OPENAI_COMPATIBLE_HOST) {
    config.provider = {
      ...(config.provider ?? {}),
      openaiCompatible: {
        host: process.env.OPENAI_COMPATIBLE_HOST,
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
      },
    } as any;
  }
  
  // Model settings
  if (process.env.OLLM_DEFAULT_MODEL) {
    config.model = {
      ...(config.model ?? {}),
      default: process.env.OLLM_DEFAULT_MODEL,
    } as any;
  }
  
  // Logging
  if (process.env.OLLM_LOG_LEVEL) {
    // Store for later use
  }
  
  return config;
}

/**
 * Format validation error with helpful details
 */
function formatValidationError(error: unknown): ValidationError {
  const err = error as {
    instancePath?: string;
    dataPath?: string;
    message?: string;
    keyword?: string;
    params?: Record<string, unknown>;
    data?: unknown;
  };
  const path = err.instancePath || '/';
  let message = err.message || 'Validation error';
  
  // Add more context based on error type
  if (err.keyword === 'type') {
    const expected = err.params?.type as string | undefined;
    const actual = typeof err.data;
    message = `Expected ${expected}, got ${actual}`;
    
    // Add example
    if (expected === 'number') {
      message += '\n    Example: 42 or 3.14';
    } else if (expected === 'boolean') {
      message += '\n    Example: true or false';
    } else if (expected === 'string') {
      message += '\n    Example: "value"';
    } else if (expected === 'object') {
      message += '\n    Example: { key: "value" }';
    } else if (expected === 'array') {
      message += '\n    Example: ["item1", "item2"]';
    }
  } else if (err.keyword === 'required') {
    const missing = err.params?.missingProperty;
    message = `Missing required field: ${missing}`;
  } else if (err.keyword === 'enum') {
    const allowed = err.params?.allowedValues as string[] | undefined;
    if (allowed) {
      message = `Must be one of: ${allowed.join(', ')}`;
    }
  } else if (err.keyword === 'minimum' || err.keyword === 'maximum') {
    const limit = err.params?.limit;
    message = `${message} (${err.keyword}: ${limit})`;
  } else if (err.keyword === 'pattern') {
    message = `Does not match required pattern`;
  }
  
  return {
    path,
    message,
    value: err.data,
  };
}

/**
 * Validate configuration against JSON schema
 */
export function validateConfig(config: Partial<Config>): ValidationResult {
  const validator = getValidator();
  const valid = validator(config);
  
  if (valid) {
    return { valid: true, errors: [] };
  }
  
  const errors: ValidationError[] = (validator.errors || []).map(formatValidationError);
  
  return { valid: false, errors };
}

/**
 * Merge configuration layers with precedence
 */
function mergeConfigs(sources: ConfigSource[]): Config {
  // Sort by priority (lowest to highest)
  const sorted = [...sources].sort((a, b) => a.priority - b.priority);
  
  // Start with empty config
  let merged = {} as Config;
  
  // Merge each layer
  for (const source of sorted) {
    merged = deepMerge(merged, source.data);
  }
  
  return merged;
}

export interface LoadConfigOptions {
  configPath?: string;
  cliOverrides?: Partial<Config>;
}

/**
 * Load configuration from all layers with proper precedence
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const sources: ConfigSource[] = [];
  
  // Layer 1: System defaults (priority 1)
  sources.push({
    layer: 'system',
    priority: 1,
    data: defaultConfig,
  });
  
  // Layer 2: User config (priority 2)
  const userConfigPath = options.configPath || getConfigPath('user');
  const userConfig = loadConfigFile(userConfigPath);
  if (userConfig) {
    sources.push({
      layer: 'user',
      priority: 2,
      data: userConfig,
    });
  }
  
  // Layer 3: Workspace config (priority 3)
  const workspaceConfigPath = getConfigPath('workspace');
  const workspaceConfig = loadConfigFile(workspaceConfigPath);
  if (workspaceConfig) {
    sources.push({
      layer: 'workspace',
      priority: 3,
      data: workspaceConfig,
    });
  }
  
  // Layer 4: Environment variables (priority 4)
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    sources.push({
      layer: 'env',
      priority: 4,
      data: envConfig,
    });
  }
  
  // Layer 5: CLI overrides (priority 5)
  if (options.cliOverrides) {
    sources.push({
      layer: 'cli',
      priority: 5,
      data: options.cliOverrides,
    });
  }
  
  // Merge all layers
  const merged = mergeConfigs(sources);
  
  // Validate final configuration
  const validation = validateConfig(merged);
  if (!validation.valid) {
    // Group errors and format nicely
    const errorLines = validation.errors.map((err) => {
      let line = `  ${err.path}: ${err.message}`;
      if (err.value !== undefined) {
        line += `\n    Current value: ${JSON.stringify(err.value)}`;
      }
      return line;
    });
    
    // Check which config files were loaded to help user identify source
    const loadedFiles: string[] = [];
    if (userConfig) loadedFiles.push(userConfigPath);
    if (workspaceConfig) loadedFiles.push(workspaceConfigPath);
    
    let message = 'Configuration validation failed:\n\n';
    message += errorLines.join('\n\n');
    
    if (loadedFiles.length > 0) {
      message += '\n\nLoaded configuration from:\n';
      message += loadedFiles.map((f) => `  - ${f}`).join('\n');
    }
    
    message += '\n\nNote: Missing required fields will use default values.';
    message += '\nRun with --help to see configuration options.';
    
    throw new ConfigError(message);
  }
  
  return merged;
}

/**
 * Configuration loader class for easier testing
 */
export class ConfigLoader {
  loadConfig(options: LoadConfigOptions = {}): Config {
    return loadConfig(options);
  }
  
  mergeConfigs(sources: ConfigSource[]): Config {
    return mergeConfigs(sources);
  }
  
  validateConfig(config: Partial<Config>): ValidationResult {
    return validateConfig(config);
  }
  
  getConfigPath(type: 'user' | 'workspace'): string {
    return getConfigPath(type);
  }
}
