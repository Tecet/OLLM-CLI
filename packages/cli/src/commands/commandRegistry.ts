import type { Command, CommandResult } from './types.js';
import type { ServiceContainer } from '@ollm/ollm-cli-core/services/serviceContainer.js';
import { homeCommand } from './homeCommand.js';
import { sessionCommands } from './sessionCommands.js';
import { modelCommands, createModelCommands } from './modelCommands.js';
import { memoryCommands, createMemoryCommands } from './memoryCommands.js';
import { templateCommands, createTemplateCommands } from './templateCommands.js';
import { comparisonCommands, createComparisonCommands } from './comparisonCommands.js';
import { projectCommands, createProjectCommands } from './projectCommands.js';
import { createExtensionCommands } from './extensionCommands.js';
import { createMCPOAuthCommands } from './mcpOAuthCommands.js';
import { createMCPHealthCommands } from './mcpHealthCommands.js';
import { hookCommands } from './hookCommands.js';
import { providerCommands } from './providerCommands.js';
import { gitCommands } from './gitCommands.js';
import { reviewCommands } from './reviewCommands.js';
import { themeCommands, createThemeCommands } from './themeCommands.js';
import { contextCommands } from './contextCommands.js';
import { metricsCommands } from './metricsCommands.js';
import { reasoningCommands } from './reasoningCommands.js';
import { utilityCommands } from './utilityCommands.js';
import type { Theme } from '../config/uiSettings.js';

/**
 * Command Registry
 * 
 * Manages registration and execution of slash commands
 */
export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();
  private serviceContainer?: ServiceContainer;
  private setTheme?: (theme: Theme) => void;
  private mcpClient?: any;

  constructor(serviceContainer?: ServiceContainer, setTheme?: (theme: Theme) => void) {
    this.serviceContainer = serviceContainer;
    this.setTheme = setTheme;
    
    // Register built-in commands
    this.register(homeCommand);
    
    // Register session commands
    for (const command of sessionCommands) {
      this.register(command);
    }
    
    // Register service-dependent commands
    // If service container is provided, use factory functions
    // Otherwise, use default exports (which work without services)
    if (serviceContainer) {
      this.registerServiceCommands(serviceContainer);
    } else {
      // Register default commands (backwards compatible)
      for (const command of modelCommands) {
        this.register(command);
      }
      
      for (const command of memoryCommands) {
        this.register(command);
      }
      
      for (const command of templateCommands) {
        this.register(command);
      }
      
      for (const command of comparisonCommands) {
        this.register(command);
      }
      
      for (const command of projectCommands) {
        this.register(command);
      }
    }
    
    // Register provider commands
    for (const command of providerCommands) {
      this.register(command);
    }
    
    // Register git commands
    for (const command of gitCommands) {
      this.register(command);
    }
    
    // Register review commands
    for (const command of reviewCommands) {
      this.register(command);
    }
    
    // Register theme commands with setTheme callback
    const themeCommandsToRegister = this.setTheme 
      ? createThemeCommands(this.setTheme)
      : themeCommands;
    for (const command of themeCommandsToRegister) {
      this.register(command);
    }
    
    // Register context commands
    for (const command of contextCommands) {
      this.register(command);
    }
    
    // Register metrics commands
    for (const command of metricsCommands) {
      this.register(command);
    }
    
    // Register reasoning commands
    for (const command of reasoningCommands) {
      this.register(command);
    }
    
    // Register utility commands
    for (const command of utilityCommands) {
      this.register(command);
    }
    
    // Register hook commands
    for (const command of hookCommands) {
      this.register(command);
    }
  }
  
  /**
   * Register service-dependent commands
   */
  private registerServiceCommands(serviceContainer: ServiceContainer): void {
    // Register model commands
    for (const command of createModelCommands(serviceContainer)) {
      this.register(command);
    }
    
    // Register memory commands
    for (const command of createMemoryCommands(serviceContainer)) {
      this.register(command);
    }
    
    // Register template commands
    for (const command of createTemplateCommands(serviceContainer)) {
      this.register(command);
    }
    
    // Register comparison commands
    for (const command of createComparisonCommands(serviceContainer)) {
      this.register(command);
    }
    
    // Register project commands
    for (const command of createProjectCommands(serviceContainer)) {
      this.register(command);
    }
    
    // Register extension commands
    const extensionManager = serviceContainer.getExtensionManager();
    const extensionRegistry = serviceContainer.getExtensionRegistry();
    for (const command of createExtensionCommands(extensionManager, extensionRegistry)) {
      this.register(command);
    }
    
    // Register MCP OAuth commands
    const oauthProvider = serviceContainer.getMCPOAuthProvider();
    for (const command of createMCPOAuthCommands(oauthProvider)) {
      this.register(command);
    }
    
    // Register MCP Health commands (if MCP client is available)
    if (this.mcpClient) {
      const healthMonitor = serviceContainer.getMCPHealthMonitor();
      for (const command of createMCPHealthCommands(healthMonitor, this.mcpClient)) {
        this.register(command);
      }
    }
  }
  
  /**
   * Set the service container
   * This allows updating the service container after construction
   */
  setServiceContainer(serviceContainer: ServiceContainer): void {
    this.serviceContainer = serviceContainer;
    
    // Clear existing service-dependent commands
    const serviceCommands = ['/model', '/memory', '/template', '/compare', '/project'];
    for (const cmd of serviceCommands) {
      this.commands.delete(cmd);
    }
    
    // Register new commands with updated service container
    this.registerServiceCommands(serviceContainer);
  }

  /**
   * Set the theme callback
   * This allows updating the theme from commands
   */
  setThemeCallback(setTheme: (theme: Theme) => void): void {
    this.setTheme = setTheme;
    
    // Re-register theme commands with the new callback
    this.commands.delete('/theme');
    const themeCommandsToRegister = createThemeCommands(setTheme);
    for (const command of themeCommandsToRegister) {
      this.register(command);
    }
  }

  /**
   * Set the MCP client
   * This allows MCP-related commands to access the client
   */
  setMCPClient(mcpClient: any): void {
    this.mcpClient = mcpClient;
    
    // Re-register MCP health commands if service container is available
    if (this.serviceContainer) {
      // Remove existing MCP health commands
      this.commands.delete('mcp health');
      this.commands.delete('mcp health check');
      this.commands.delete('mcp restart');
      this.commands.delete('mcp health start');
      this.commands.delete('mcp health stop');
      this.commands.delete('mcp health status');
      this.commands.delete('mcp health help');
      
      // Register new commands with MCP client
      const healthMonitor = this.serviceContainer.getMCPHealthMonitor();
      for (const command of createMCPHealthCommands(healthMonitor, mcpClient)) {
        this.register(command);
      }
    }
  }

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Execute a command
   */
  async execute(input: string): Promise<CommandResult> {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    // Resolve alias
    const resolvedName = this.aliases.get(commandName) || commandName;
    
    // Find command
    const command = this.commands.get(resolvedName);
    
    if (!command) {
      // Suggest similar commands
      const suggestions = this.getSuggestions(commandName);
      const suggestionText = suggestions.length > 0
        ? `\n\nDid you mean: ${suggestions.join(', ')}?`
        : '';
      
      return {
        success: false,
        message: `Unknown command: ${commandName}${suggestionText}`,
      };
    }

    try {
      return await command.handler(args);
    } catch (error) {
      return {
        success: false,
        message: `Command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get command suggestions based on string similarity
   * 
   * Requirements: 22.2
   */
  getSuggestions(input: string): string[] {
    const allCommands = Array.from(this.commands.keys());
    const allAliases = Array.from(this.aliases.keys());
    const allNames = [...allCommands, ...allAliases];
    
    // Calculate Levenshtein distance for each command
    const distances = allNames.map(name => ({
      name,
      distance: this.levenshteinDistance(input.toLowerCase(), name.toLowerCase()),
    }));
    
    // Sort by distance and take top 3 with distance <= 3
    return distances
      .filter(d => d.distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(d => d.name);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Check if input is a command
   */
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by name
   */
  getCommand(name: string): Command | undefined {
    const resolvedName = this.aliases.get(name) || name;
    return this.commands.get(resolvedName);
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
