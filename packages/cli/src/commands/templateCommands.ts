/**
 * Template Management Commands
 *
 * Implements commands for managing prompt templates:
 * - /template list - Show available templates
 * - /template use <name> [vars...] - Use a template
 * - /template create <name> - Create new template
 */

import { TemplateService } from '@ollm/core';

import type { Command, CommandResult } from './types.js';

/**
 * /template list - Show available templates
 *
 * Requirements: 18.1
 */
async function templateListHandler(service: TemplateService): Promise<CommandResult> {
  try {
    const templates = service.listTemplates();

    if (templates.length === 0) {
      return {
        success: true,
        message: 'No templates found. Use /template create <name> to create one.',
        data: { templates: [] },
      };
    }

    // Format template list
    const templateList = templates
      .map((template) => {
        const varCount = template.variableCount;
        const varText =
          varCount === 0 ? 'no variables' : varCount === 1 ? '1 variable' : `${varCount} variables`;
        return `  ${template.name} - ${template.description} (${varText})`;
      })
      .join('\n');

    return {
      success: true,
      message: `Available templates:\n\n${templateList}`,
      data: { templates },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /template use <name> [vars...] - Use a template
 *
 * Requirements: 18.2, 17.1, 17.2, 17.3
 */
async function templateUseHandler(
  args: string[],
  service: TemplateService
): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /template use <name> [key=value ...]',
    };
  }

  const templateName = args[0];
  const variableArgs = args.slice(1);

  try {
    // Get template to check if it exists
    const template = service.getTemplate(templateName);
    if (!template) {
      return {
        success: false,
        message: `Template not found: ${templateName}`,
      };
    }

    // Parse variable arguments (key=value format)
    const variables: Record<string, string> = {};
    for (const arg of variableArgs) {
      const match = arg.match(/^([^=]+)=(.*)$/);
      if (match) {
        variables[match[1]] = match[2];
      } else {
        return {
          success: false,
          message: `Invalid variable format: ${arg}\nUse key=value format`,
        };
      }
    }

    // Apply template
    const result = service.applyTemplate(templateName, variables);

    return {
      success: true,
      message: `Template applied:\n\n${result}`,
      data: { template: templateName, result },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to use template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /template create <name> - Create new template
 *
 * Requirements: 18.3
 */
async function templateCreateHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /template create <name>',
    };
  }

  const templateName = args[0];

  // For now, provide instructions for manual template creation
  // In a full implementation, this would open an editor or prompt for template content
  return {
    success: true,
    message:
      `To create a template named "${templateName}", create a YAML file at:\n\n` +
      `  ~/.ollm/templates/${templateName}.yaml\n\n` +
      'Template format:\n' +
      '  name: template_name\n' +
      '  description: Template description\n' +
      '  template: "Your template with {variable} placeholders"\n' +
      '  variables:\n' +
      '    - name: variable\n' +
      '      required: true\n' +
      '      description: Variable description',
    data: { template: templateName },
  };
}

/**
 * /template command - Main template command with subcommands
 *
 * Requirements: 18.1, 18.2, 18.3
 */
export const templateCommand: Command = {
  name: '/template',
  description: 'Manage prompt templates',
  usage: '/template <list|use|create> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message:
          'Usage: /template <list|use|create> [args]\n\n' +
          'Subcommands:\n' +
          '  list                    - Show available templates\n' +
          '  use <name> [vars...]    - Use a template with variables\n' +
          '  create <name>           - Create a new template',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    // Create service instance
    // TODO: This should be injected via dependency injection
    const service = new TemplateService({
      userTemplatesDir: undefined, // Will use default
      workspaceTemplatesDir: undefined, // Will use default
    });

    // Load templates
    await service.loadTemplates();

    switch (subcommand) {
      case 'list':
        return templateListHandler(service);
      case 'use':
        return templateUseHandler(subcommandArgs, service);
      case 'create':
        return templateCreateHandler(subcommandArgs);
      default:
        return {
          success: false,
          message:
            `Unknown subcommand: ${subcommand}\n\n` + 'Available subcommands: list, use, create',
        };
    }
  },
};

/**
 * All template-related commands
 */
export const templateCommands: Command[] = [templateCommand];

/**
 * Create template commands with service container dependency injection
 */
export function createTemplateCommands(_container: unknown): Command[] {
  // TODO: Implement with service container
  return templateCommands;
}

// Keep original export for backwards compatibility
// Export is already defined above as templateCommands
