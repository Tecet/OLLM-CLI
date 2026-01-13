/**
 * Extension settings integration
 * 
 * Handles merging extension settings with configuration,
 * reading from environment variables, and providing settings to hooks/MCP servers.
 */

import type { ExtensionSetting } from './types.js';

/**
 * Resolved extension setting with value
 */
export interface ResolvedExtensionSetting {
  /** Setting name */
  name: string;
  /** Resolved value */
  value: unknown;
  /** Whether the setting is sensitive */
  sensitive: boolean;
  /** Source of the value (env, default, or undefined) */
  source: 'env' | 'default' | 'undefined';
}

/**
 * Extension settings manager
 */
export class ExtensionSettingsManager {
  /**
   * Resolve extension settings by reading from environment variables
   * 
   * @param settings - Extension setting definitions
   * @param extensionName - Name of the extension (for error messages)
   * @returns Array of resolved settings
   */
  resolveSettings(
    settings: ExtensionSetting[],
    extensionName: string
  ): ResolvedExtensionSetting[] {
    const resolved: ResolvedExtensionSetting[] = [];

    for (const setting of settings) {
      let value: unknown = undefined;
      let source: 'env' | 'default' | 'undefined' = 'undefined';

      // Try to read from environment variable if specified
      if (setting.envVar) {
        const envValue = process.env[setting.envVar];
        if (envValue !== undefined) {
          value = envValue;
          source = 'env';
        }
      }

      // Fall back to default value if no env value found
      if (value === undefined && setting.default !== undefined) {
        value = setting.default;
        source = 'default';
      }

      resolved.push({
        name: setting.name,
        value,
        sensitive: setting.sensitive ?? false,
        source,
      });
    }

    return resolved;
  }

  /**
   * Convert resolved settings to environment variables for hooks/MCP servers
   * 
   * @param resolvedSettings - Resolved extension settings
   * @param extensionName - Name of the extension
   * @returns Environment variable object
   */
  toEnvironmentVariables(
    resolvedSettings: ResolvedExtensionSetting[],
    extensionName: string
  ): Record<string, string> {
    const env: Record<string, string> = {};

    for (const setting of resolvedSettings) {
      if (setting.value !== undefined) {
        // Convert extension setting name to environment variable format
        // e.g., "githubToken" -> "EXTENSION_GITHUB_INTEGRATION_GITHUB_TOKEN"
        const envVarName = this.settingToEnvVar(extensionName, setting.name);
        
        // Skip if this env var name already exists (duplicate after normalization)
        if (env[envVarName] !== undefined) {
          continue;
        }
        
        // Convert value to string
        const stringValue = this.valueToString(setting.value);
        
        env[envVarName] = stringValue;
      }
    }

    return env;
  }

  /**
   * Convert setting name to environment variable name
   * 
   * @param extensionName - Extension name
   * @param settingName - Setting name
   * @returns Environment variable name
   */
  private settingToEnvVar(extensionName: string, settingName: string): string {
    // Convert to uppercase and replace hyphens with underscores
    const normalizedExtension = extensionName
      .toUpperCase()
      .replace(/-/g, '_');
    
    // Convert camelCase to SNAKE_CASE
    const normalizedSetting = settingName
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');

    return `EXTENSION_${normalizedExtension}_${normalizedSetting}`;
  }

  /**
   * Convert setting value to string for environment variable
   * 
   * @param value - Setting value
   * @returns String representation
   */
  private valueToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value === null) {
      return '';
    }
    // For objects/arrays, serialize as JSON
    return JSON.stringify(value);
  }

  /**
   * Redact sensitive settings from an object (for logging)
   * 
   * @param obj - Object containing settings
   * @param sensitiveNames - Names of sensitive settings
   * @returns Object with sensitive values redacted
   */
  redactSensitiveSettings(
    obj: Record<string, unknown>,
    sensitiveNames: Set<string>
  ): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveNames.has(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively redact nested objects
        redacted[key] = this.redactSensitiveSettings(
          value as Record<string, unknown>,
          sensitiveNames
        );
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Redact sensitive settings from environment variables
   * 
   * @param env - Environment variables object
   * @param resolvedSettings - Resolved extension settings
   * @returns Environment variables with sensitive values redacted
   */
  redactSensitiveEnv(
    env: Record<string, string>,
    resolvedSettings: ResolvedExtensionSetting[]
  ): Record<string, string> {
    const redacted: Record<string, string> = {};
    const sensitiveKeys = new Set<string>();

    // Build set of sensitive environment variable keys
    for (const setting of resolvedSettings) {
      if (setting.sensitive && setting.value !== undefined) {
        // Find the env var key for this setting
        for (const [key, value] of Object.entries(env)) {
          if (key.includes(setting.name.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, ''))) {
            sensitiveKeys.add(key);
          }
        }
      }
    }

    // Redact sensitive keys
    for (const [key, value] of Object.entries(env)) {
      if (sensitiveKeys.has(key)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Validate required settings are present
   * 
   * @param resolvedSettings - Resolved extension settings
   * @param requiredSettings - Names of required settings
   * @returns Array of missing required settings
   */
  validateRequiredSettings(
    resolvedSettings: ResolvedExtensionSetting[],
    requiredSettings: string[]
  ): string[] {
    const missing: string[] = [];

    for (const required of requiredSettings) {
      const setting = resolvedSettings.find((s) => s.name === required);
      if (!setting || setting.value === undefined) {
        missing.push(required);
      }
    }

    return missing;
  }

  /**
   * Merge extension settings into configuration schema
   * 
   * @param extensionName - Extension name
   * @param settings - Extension setting definitions
   * @returns Configuration schema fragment for this extension
   */
  createConfigSchema(
    extensionName: string,
    settings: ExtensionSetting[]
  ): Record<string, unknown> {
    const schema: Record<string, unknown> = {};

    for (const setting of settings) {
      // Create a schema entry for this setting
      schema[setting.name] = {
        description: setting.description,
        default: setting.default,
        sensitive: setting.sensitive ?? false,
        envVar: setting.envVar,
      };
    }

    return {
      [extensionName]: schema,
    };
  }
}

