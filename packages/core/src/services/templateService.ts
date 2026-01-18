/**
 * Template Service for managing reusable prompt templates
 * Supports variable substitution and template persistence
 * Feature: stage-07-model-management
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';

/**
 * Variable definition in a template
 */
export interface VariableDefinition {
  name: string;
  required: boolean;
  default?: string;
  description?: string;
}

/**
 * A prompt template
 */
export interface Template {
  name: string;
  description: string;
  template: string;
  variables: VariableDefinition[];
}

type TemplateFileData = {
  name: string;
  description: string;
  template: string;
  variables?: VariableDefinition[];
};

/**
 * Template metadata for listing
 */
export interface TemplateInfo {
  name: string;
  description: string;
  variableCount: number;
}

/**
 * Configuration for TemplateService
 */
export interface TemplateServiceConfig {
  /**
   * User templates directory (default: ~/.ollm/templates)
   */
  userTemplatesDir?: string;

  /**
   * Workspace templates directory (default: .ollm/templates)
   */
  workspaceTemplatesDir?: string;

  /**
   * Whether to enable template service (default: true)
   */
  enabled?: boolean;
}

/**
 * Service for managing prompt templates
 */
export class TemplateService {
  private templates: Map<string, Template> = new Map();
  private userTemplatesDir: string;
  private workspaceTemplatesDir: string;
  private enabled: boolean;
  private loaded: boolean = false;

  constructor(config: TemplateServiceConfig = {}) {
    this.userTemplatesDir =
      config.userTemplatesDir || join(homedir(), '.ollm', 'templates');
    this.workspaceTemplatesDir =
      config.workspaceTemplatesDir || join(process.cwd(), '.ollm', 'templates');
    this.enabled = config.enabled ?? true;
  }

  /**
   * Load templates from user and workspace directories
   */
  async loadTemplates(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.templates.clear();

    // Load user templates first
    await this.loadTemplatesFromDirectory(this.userTemplatesDir);

    // Load workspace templates (these override user templates with same name)
    await this.loadTemplatesFromDirectory(this.workspaceTemplatesDir);

    this.loaded = true;
  }

  /**
   * Load templates from a specific directory
   */
  private async loadTemplatesFromDirectory(dir: string): Promise<void> {
    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        // Skip files that don't have valid extensions
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
          continue;
        }

        const filePath = join(dir, file);
        try {
          await this.loadTemplateFile(filePath);
        } catch (error: unknown) {
          // Log error but continue loading other templates
          const err = error as NodeJS.ErrnoException;
          const message = err.message || String(error);
          console.warn(`Failed to load template ${filePath}: ${message}`);
        }
      }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Directory doesn't exist, that's okay
        return;
      }
      const message = err.message || String(error);
      throw new Error(`Failed to read templates directory ${dir}: ${message}`);
    }
  }

  /**
   * Load a single template file
   */
  private async loadTemplateFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = parseYaml(content);

    // Validate template structure
    this.validateTemplate(data);

    const template: Template = {
      name: data.name,
      description: data.description,
      template: data.template,
      variables: data.variables || [],
    };

    // Cache the template
    this.templates.set(template.name, template);
  }

  /**
   * Validate template structure
   */
  private validateTemplate(data: unknown): asserts data is TemplateFileData {
    if (!data || typeof data !== 'object') {
      throw new Error('Template must be an object');
    }

    const record = data as Record<string, unknown>;

    if (!record.name || typeof record.name !== 'string') {
      throw new Error('Template must have a name (string)');
    }

    if (!record.description || typeof record.description !== 'string') {
      throw new Error('Template must have a description (string)');
    }

    if (!record.template || typeof record.template !== 'string') {
      throw new Error('Template must have a template (string)');
    }

    if (record.variables) {
      if (!Array.isArray(record.variables)) {
        throw new Error('Template variables must be an array');
      }

      for (const variable of record.variables) {
        if (!variable || typeof variable !== 'object') {
          throw new Error('Variable must be an object');
        }

        const variableRecord = variable as Record<string, unknown>;
        if (!variableRecord.name || typeof variableRecord.name !== 'string') {
          throw new Error('Variable must have a name (string)');
        }

        if (typeof variableRecord.required !== 'boolean') {
          throw new Error(`Variable ${variableRecord.name} must have required (boolean)`);
        }

        if (variableRecord.default !== undefined && typeof variableRecord.default !== 'string') {
          throw new Error(`Variable ${variableRecord.name} default must be a string`);
        }

        if (variableRecord.description !== undefined && typeof variableRecord.description !== 'string') {
          throw new Error(`Variable ${variableRecord.name} description must be a string`);
        }
      }
    }
  }

  /**
   * List all available templates
   */
  listTemplates(): TemplateInfo[] {
    if (!this.enabled) {
      return [];
    }

    return Array.from(this.templates.values()).map((template) => ({
      name: template.name,
      description: template.description,
      variableCount: template.variables.length,
    }));
  }

  /**
   * Get a specific template
   */
  getTemplate(name: string): Template | null {
    if (!this.enabled) {
      return null;
    }

    return this.templates.get(name) || null;
  }

  /**
   * Apply a template with variable substitution
   */
  applyTemplate(name: string, variables: Record<string, string>): string {
    if (!this.enabled) {
      throw new Error('Template service is disabled');
    }

    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    // Validate required variables
    for (const varDef of template.variables) {
      if (varDef.required && !Object.prototype.hasOwnProperty.call(variables, varDef.name) && !varDef.default) {
        throw new Error(
          `Template '${name}' requires variable '${varDef.name}'. ` +
          `Provide it with: /template use ${name} ${varDef.name}=<value>`
        );
      }
    }

    // Perform variable substitution
    let result = template.template;

    // Replace variables with format {variable_name} or {variable_name:default_value}
    // Use a more robust approach that handles edge cases like variable names containing special chars
    const variablePattern = /\{([^{}]+)\}/g;
    
    result = result.replace(variablePattern, (match, content) => {
      // Check if it's escaped
      if (match.startsWith('\\{')) {
        return match.substring(1); // Remove escape character
      }

      // Parse variable name and default value
      // Split only on the first colon to allow colons in default values
      const colonIndex = content.indexOf(':');
      const varName = colonIndex === -1 ? content.trim() : content.substring(0, colonIndex).trim();
      const defaultValue = colonIndex === -1 ? undefined : content.substring(colonIndex + 1).trim();

      // Look up variable value
      if (Object.prototype.hasOwnProperty.call(variables, varName)) {
        return variables[varName];
      }

      // Check template variable definitions for default
      const varDef = template.variables.find((v) => v.name === varName);
      if (varDef && varDef.default !== undefined) {
        return varDef.default;
      }

      // Use inline default value if provided
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      // Variable not found and no default
      throw new Error(
        `Variable '${varName}' not provided and has no default value`
      );
    });

    return result;
  }

  /**
   * Sanitize a template name to be a valid filename
   */
  private sanitizeFilename(name: string): string {
    // Remove invalid filename characters including template syntax characters
    const invalidChars = /[<>:"|?*\\/{}]/g;
    let sanitized = name.replace(invalidChars, '_');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Ensure not empty
    if (sanitized.length === 0) {
      throw new Error('Template name cannot be empty or contain only invalid characters');
    }
    
    return sanitized;
  }

  /**
   * Create a new template
   */
  async createTemplate(template: Template): Promise<void> {
    if (!this.enabled) {
      throw new Error('Template service is disabled');
    }

    // Validate template
    this.validateTemplate(template);

    // Sanitize the template name for use as a filename
    const sanitizedName = this.sanitizeFilename(template.name);

    // Save to user templates directory
    const filePath = join(this.userTemplatesDir, `${sanitizedName}.yaml`);

    try {
      // Ensure directory exists
      await fs.mkdir(this.userTemplatesDir, { recursive: true });

      // Convert template to YAML format
      const yamlContent = {
        name: template.name,
        description: template.description,
        template: template.template,
        variables: template.variables,
      };

      // Write to file
      const content = JSON.stringify(yamlContent, null, 2); // Using JSON for simplicity
      await fs.writeFile(filePath, content, 'utf-8');

      // Add to cache
      this.templates.set(template.name, template);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      const message = err.message || String(error);
      throw new Error(`Failed to create template: ${message}`);
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Template service is disabled');
    }

    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    // Try to delete from user directory
    const userFilePath = join(this.userTemplatesDir, `${name}.yaml`);
    const userFilePathYml = join(this.userTemplatesDir, `${name}.yml`);

    try {
      try {
        await fs.unlink(userFilePath);
      } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          throw error;
        }
        // Try .yml extension
        await fs.unlink(userFilePathYml);
      }

      // Remove from cache
      this.templates.delete(name);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new Error(
          `Template '${name}' exists in workspace directory and cannot be deleted. ` +
          `Delete the file manually from ${this.workspaceTemplatesDir}`
        );
      }
      const message = err.message || String(error);
      throw new Error(`Failed to delete template: ${message}`);
    }
  }

  /**
   * Check if service is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get template count
   */
  count(): number {
    return this.templates.size;
  }
}
