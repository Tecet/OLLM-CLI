import { createLogger } from '../utils/logger.js';

const logger = createLogger('envSubstitution');
/**
 * Environment Variable Substitution
 * 
 * This module provides utilities for substituting environment variables
 * in MCP server configurations using ${VAR_NAME} syntax.
 */

/**
 * Substitutes environment variables in a string
 * 
 * Replaces ${VAR_NAME} with the value from the environment.
 * If the variable is not found, logs a warning and uses an empty string.
 * 
 * @param value - String that may contain ${VAR_NAME} patterns
 * @param env - Environment variables to use for substitution (defaults to process.env)
 * @returns String with variables substituted
 */
export function substituteEnvVars(
  value: string,
  env: Record<string, string | undefined> = process.env
): string {
  // Match ${VAR_NAME} patterns
  const pattern = /\$\{([^}]+)\}/g;
  
  return value.replace(pattern, (match, varName) => {
    const envValue = env[varName];
    
    if (envValue === undefined) {
      logger.warn(`Environment variable '${varName}' not found, using empty string`);
      return '';
    }
    
    return envValue;
  });
}

/**
 * Substitutes environment variables in an environment object
 * 
 * Processes all values in the environment object, replacing ${VAR_NAME}
 * patterns with actual environment variable values.
 * 
 * @param envConfig - Environment configuration with potential ${VAR_NAME} patterns
 * @param parentEnv - Parent environment to inherit from (defaults to process.env)
 * @returns New environment object with variables substituted
 */
export function substituteEnvObject(
  envConfig: Record<string, string> | undefined,
  parentEnv: Record<string, string | undefined> = process.env
): Record<string, string> {
  if (!envConfig) {
    return {};
  }
  
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(envConfig)) {
    result[key] = substituteEnvVars(value, parentEnv);
  }
  
  return result;
}

/**
 * Merges extension settings into environment variables
 * 
 * Takes extension settings and creates environment variables from them.
 * Settings with envVar specified will use that name, otherwise the setting
 * name will be converted to UPPER_SNAKE_CASE.
 * 
 * @param settings - Extension settings to convert
 * @param settingValues - Current values for the settings
 * @returns Environment variables object
 */
export function settingsToEnv(
  settings: Array<{ name: string; envVar?: string }> | undefined,
  settingValues: Record<string, unknown>
): Record<string, string> {
  if (!settings) {
    return {};
  }
  
  const result: Record<string, string> = {};
  
  for (const setting of settings) {
    const value = settingValues[setting.name];
    
    // Skip undefined values
    if (value === undefined) {
      continue;
    }
    
    // Determine environment variable name
    const envVarName = setting.envVar || toUpperSnakeCase(setting.name);
    
    // Convert value to string
    result[envVarName] = String(value);
  }
  
  return result;
}

/**
 * Converts a camelCase or kebab-case string to UPPER_SNAKE_CASE
 * 
 * @param str - String to convert
 * @returns UPPER_SNAKE_CASE version
 */
function toUpperSnakeCase(str: string): string {
  return str
    // Insert underscore before uppercase letters
    .replace(/([A-Z])/g, '_$1')
    // Replace hyphens with underscores
    .replace(/-/g, '_')
    // Convert to uppercase
    .toUpperCase()
    // Remove leading underscore if present
    .replace(/^_/, '');
}
