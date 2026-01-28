/**
 * Project Profile Commands
 *
 * Implements commands for managing project profiles:
 * - /project detect - Auto-detect project type
 * - /project use <profile> - Select profile
 * - /project init - Initialize project config
 */

import type { Command, CommandResult } from './types.js';
// import { ProjectProfileService } from '@ollm/core';
type ProjectProfile = {
  name: string;
  description?: string;
  model?: string;
  routing?: { defaultProfile?: string };
  tools?: { enabled?: string[] };
  defaultSettings?: unknown;
};

type ProjectProfileService = {
  detectProfile: (workspacePath: string) => Promise<ProjectProfile | null>;
  listBuiltInProfiles: () => ProjectProfile[];
  applyProfile: (settings: unknown) => void;
  initializeProject: (workspacePath: string, profileName: string) => Promise<void>;
};

const ProjectProfileService = Object as unknown as {
  new (options: { workspacePath: string }): ProjectProfileService;
};

/**
 * /project detect - Auto-detect project type
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 24.1
 */
async function projectDetectHandler(service: ProjectProfileService): Promise<CommandResult> {
  try {
    const workspacePath = process.cwd();
    const profile = await service.detectProfile(workspacePath);

    if (!profile) {
      return {
        success: true,
        message:
          'No project type detected. Use /project use <profile> to manually select a profile.',
        data: { profile: null },
      };
    }

    // Format profile information
    const info = [`Detected project type: ${profile.name}`];

    if (profile.model) {
      info.push(`Default model: ${profile.model}`);
    }

    if (profile.routing?.defaultProfile) {
      info.push(`Routing profile: ${profile.routing.defaultProfile}`);
    }

    if (profile.tools?.enabled) {
      info.push(`Enabled tools: ${profile.tools.enabled.join(', ')}`);
    }

    return {
      success: true,
      message: info.join('\n'),
      data: { profile },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to detect project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /project use <profile> - Select profile
 *
 * Requirements: 22.1, 22.2, 24.2, 24.4
 */
async function projectUseHandler(
  args: string[],
  service: ProjectProfileService
): Promise<CommandResult> {
  if (args.length === 0) {
    // List available profiles
    const profiles = service.listBuiltInProfiles();
    const profileList = profiles.map((p) => `  ${p.name} - ${p.description}`).join('\n');

    return {
      success: false,
      message: 'Usage: /project use <profile>\n\n' + 'Available profiles:\n' + profileList,
    };
  }

  const profileName = args[0];

  try {
    // Check if it's a built-in profile
    const builtInProfiles = service.listBuiltInProfiles();
    const builtInProfile = builtInProfiles.find((p) => p.name === profileName);

    if (!builtInProfile) {
      return {
        success: false,
        message:
          `Unknown profile: ${profileName}\n\n` +
          'Available profiles: ' +
          builtInProfiles.map((p) => p.name).join(', '),
      };
    }

    // Apply the profile
    service.applyProfile(builtInProfile.defaultSettings);

    return {
      success: true,
      message: `Applied profile: ${profileName}`,
      data: { profile: profileName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to apply profile: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /project init - Initialize project config
 *
 * Requirements: 24.3
 */
async function projectInitHandler(service: ProjectProfileService): Promise<CommandResult> {
  try {
    const workspacePath = process.cwd();

    // Try to detect profile first
    const detectedProfile = await service.detectProfile(workspacePath);
    const profileName = detectedProfile?.name || 'general';

    // Initialize project
    await service.initializeProject(workspacePath, profileName);

    return {
      success: true,
      message:
        `Initialized project with profile: ${profileName}\n\n` +
        'Configuration saved to .ollm/project.yaml',
      data: { profile: profileName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /project command - Main project command with subcommands
 *
 * Requirements: 21.1, 22.1, 24.1, 24.2, 24.3
 */
export const projectCommand: Command = {
  name: '/project',
  description: 'Manage project profiles',
  usage: '/project <detect|use|init> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message:
          'Usage: /project <detect|use|init> [args]\n\n' +
          'Subcommands:\n' +
          '  detect           - Auto-detect project type\n' +
          '  use <profile>    - Select a profile\n' +
          '  init             - Initialize project config',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    // Create service instance
    // TODO: This should be injected via dependency injection
    const service = new ProjectProfileService({
      workspacePath: process.cwd(),
    });

    switch (subcommand) {
      case 'detect':
        return projectDetectHandler(service);
      case 'use':
        return projectUseHandler(subcommandArgs, service);
      case 'init':
        return projectInitHandler(service);
      default:
        return {
          success: false,
          message:
            `Unknown subcommand: ${subcommand}\n\n` + 'Available subcommands: detect, use, init',
        };
    }
  },
};

/**
 * All project-related commands
 */
export const projectCommands: Command[] = [projectCommand];

/**
 * Create project commands with service container dependency injection
 */
export function createProjectCommands(_container: unknown): Command[] {
  // TODO: Implement with service container
  return projectCommands;
}

// Keep original export for backwards compatibility
// Export is already defined above as projectCommands
