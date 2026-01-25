/**
 * Service Container for dependency injection
 * 
 * This container manages the lifecycle and dependencies of all services
 * in the OLLM CLI application. It provides:
 * - Lazy initialization of services
 * - Dependency injection
 * - Singleton pattern for services
 * - Clean shutdown of services
 */

import { ChatRecordingService } from './chatRecordingService.js';
import { ComparisonService } from './comparisonService.js';
import { HookService } from './hookService.js';
import { MemoryService } from './memoryService.js';
import { ModelManagementService } from './modelManagementService.js';
import { ProjectProfileService } from './projectProfileService.js';
import { TemplateService } from './templateService.js';
import { ExtensionManager } from '../extensions/extensionManager.js';
import { ExtensionRegistry } from '../extensions/extensionRegistry.js';
import { MCPHealthMonitor } from '../mcp/mcpHealthMonitor.js';
import { MCPOAuthProvider, KeytarTokenStorage, FileTokenStorage } from '../mcp/mcpOAuth.js';
import { PolicyEngine } from '../policy/policyEngine.js';
import { modelDatabase } from '../routing/modelDatabase.js';
import { ModelRouter } from '../routing/modelRouter.js';
import { ToolRegistry, registerBuiltInTools } from '../tools/index.js';

import type { ApprovalCallback } from '../hooks/trustedHooks.js';
import type { PolicyConfig } from '../policy/policyRules.js';
import type { ProviderAdapter } from '../provider/types.js';

/**
 * Configuration for model management
 */
export interface ModelManagementConfig {
  default?: string;
  cacheTTL?: number;
  routing?: {
    enabled?: boolean;
    defaultProfile?: string;
    overrides?: Record<string, string>;
  };
  keepAlive?: {
    enabled: boolean;
    models: string[];
    timeout: number;
  };
}

/**
 * Configuration for memory service
 */
export interface MemoryConfig {
  enabled?: boolean;
  tokenBudget?: number;
}

/**
 * Configuration for project profiles
 */
export interface ProjectConfig {
  autoDetect?: boolean;
}

/**
 * Configuration for hook service
 */
export interface HookConfig {
  enabled?: boolean;
  trustWorkspace?: boolean;
  timeout?: number;
  approvalCallback?: ApprovalCallback;
}

/**
 * Configuration for extension system
 */
export interface ExtensionConfig {
  enabled?: boolean;
  userExtensionsDir?: string;
  workspaceExtensionsDir?: string;
  registryUrl?: string;
}

/**
 * Configuration for MCP health monitoring
 */
export interface MCPHealthConfig {
  enabled?: boolean;
  checkInterval?: number;
  maxRestartAttempts?: number;
  autoRestart?: boolean;
}

/**
 * Core configuration interface
 * This is a subset of the full CLI config that the service container needs
 */
export interface CoreConfig {
  model?: ModelManagementConfig;
  memory?: MemoryConfig;
  project?: ProjectConfig;
  hooks?: HookConfig;
  extensions?: ExtensionConfig;
  mcpHealth?: MCPHealthConfig;
  policy?: PolicyConfig;
}

/**
 * Service container configuration
 */
export interface ServiceContainerConfig {
  /** Provider adapter for model operations */
  provider: ProviderAdapter;
  
  /** Application configuration */
  config: CoreConfig;
  
  /** Workspace path for project-specific services */
  workspacePath?: string;
  
  /** User home directory for user-level services */
  userHome: string;
}

/**
 * Service container that manages all application services
 */
export class ServiceContainer {
  private provider: ProviderAdapter;
  private config: CoreConfig;
  private workspacePath?: string;
  private userHome: string;
  
  // Service instances (lazy-initialized)
  private _modelManagementService?: ModelManagementService;
  private _modelRouter?: ModelRouter;
  private _memoryService?: MemoryService;
  private _templateService?: TemplateService;
  private _comparisonService?: ComparisonService;
  private _chatRecordingService?: ChatRecordingService;
  private _projectProfileService?: ProjectProfileService;
  private _hookService?: HookService;
  private _extensionManager?: ExtensionManager;
  private _extensionRegistry?: ExtensionRegistry;
  private _mcpOAuthProvider?: MCPOAuthProvider;
  private _mcpHealthMonitor?: MCPHealthMonitor;
  private _toolRegistry?: ToolRegistry;
  private _policyEngine?: PolicyEngine;
  
  constructor(config: ServiceContainerConfig) {
    this.provider = config.provider;
    this.config = config.config;
    this.workspacePath = config.workspacePath;
    this.userHome = config.userHome;
  }
  
  /**
   * Get the Model Management Service
   */
  getModelManagementService(): ModelManagementService {
    if (!this._modelManagementService) {
      const cacheTTL = this.config.model?.cacheTTL || 300000; // 5 minutes default
      const keepAliveConfig = this.config.model?.keepAlive || {
        enabled: false,
        models: [],
        timeout: 300,
      };
      
      this._modelManagementService = new ModelManagementService(
        this.provider,
        {
          cacheTTL,
          keepAliveEnabled: keepAliveConfig.enabled,
          keepAliveTimeout: keepAliveConfig.timeout,
          keepAliveModels: keepAliveConfig.models,
        }
      );
    }
    return this._modelManagementService;
  }
  
  /**
   * Get the Model Router
   */
  getModelRouter(): ModelRouter {
    if (!this._modelRouter) {
      const routingConfig = this.config.model?.routing || {
        enabled: true,
        defaultProfile: 'general',
        overrides: {},
      };
      
      // routingConfig may come from partial user config; cast to any for the router constructor
      this._modelRouter = new ModelRouter(routingConfig as any);
    }
    return this._modelRouter;
  }
  
  /**
   * Get the Memory Service
   */
  getMemoryService(): MemoryService {
    if (!this._memoryService) {
      const memoryConfig = this.config.memory || {
        enabled: true,
        tokenBudget: 500,
      };
      
      const memoryPath = `${this.userHome}/.ollm/memory.json`;
      
      this._memoryService = new MemoryService({
        memoryPath,
        tokenBudget: memoryConfig.tokenBudget,
        enabled: memoryConfig.enabled,
      });
      
      // Load memories on initialization
      this._memoryService.load().catch(err => {
        console.error('Failed to load memories:', err);
      });
    }
    return this._memoryService;
  }
  
  /**
   * Get the Template Service
   */
  getTemplateService(): TemplateService {
    if (!this._templateService) {
      const userTemplatesDir = `${this.userHome}/.ollm/templates`;
      const workspaceTemplatesDir = this.workspacePath 
        ? `${this.workspacePath}/.ollm/templates`
        : undefined;
      
      this._templateService = new TemplateService({
        userTemplatesDir,
        workspaceTemplatesDir,
      });
      
      // Load templates on initialization
      this._templateService.loadTemplates().catch(err => {
        console.error('Failed to load templates:', err);
      });
    }
    return this._templateService;
  }
  
  /**
   * Get the Comparison Service
   */
  getComparisonService(): ComparisonService {
    if (!this._comparisonService) {
      this._comparisonService = new ComparisonService(this.provider);
    }
    return this._comparisonService;
  }

  /**
   * Get the Chat Recording Service
   */
  getChatRecordingService(): ChatRecordingService {
    if (!this._chatRecordingService) {
      this._chatRecordingService = new ChatRecordingService({
        dataDir: `${this.userHome}/.ollm/sessions`,
        autoSave: true,
        maxSessions: 100
      });
    }
    return this._chatRecordingService;
  }
  
  /**
   * Get the Project Profile Service
   */
  getProjectProfileService(): ProjectProfileService {
    if (!this._projectProfileService) {
      const projectConfig = this.config.project || {
        autoDetect: true,
      };
      
      this._projectProfileService = new ProjectProfileService({
        autoDetect: projectConfig.autoDetect,
      });
    }
    return this._projectProfileService;
  }
  
  /**
   * Get the Hook Service
   */
  getHookService(): HookService {
    if (!this._hookService) {
      const hookConfig = this.config.hooks || {
        enabled: true,
        trustWorkspace: false,
        timeout: 30000,
      };
      
      this._hookService = new HookService({
        trustWorkspace: hookConfig.trustWorkspace,
        timeout: hookConfig.timeout,
        approvalCallback: hookConfig.approvalCallback,
      });
    }
    return this._hookService;
  }
  
  /**
   * Get the Tool Registry
   * 
   * Returns the central tool registry with all built-in tools registered.
   * This is the single source of truth for tool availability.
   * 
   * Note: ToolRegistry requires a SettingsService instance for user preferences.
   * Since SettingsService is in the CLI package, it must be provided during
   * initialization or the registry will be created without settings integration.
   */
  getToolRegistry(): ToolRegistry {
    if (!this._toolRegistry) {
      // Create registry without settings service (core package doesn't have access to it)
      // The CLI layer should provide settings integration when needed
      this._toolRegistry = new ToolRegistry();
      
      // Register all built-in tools
      const memoryPath = `${this.userHome}/.ollm/memory.json`;
      const todosPath = `${this.userHome}/.ollm/todos.json`;
      registerBuiltInTools(this._toolRegistry, { memoryPath, todosPath });
    }
    return this._toolRegistry;
  }
  
  /**
   * Set the Tool Registry
   * 
   * Allows the CLI layer to provide a pre-configured ToolRegistry with
   * SettingsService integration.
   */
  setToolRegistry(registry: ToolRegistry): void {
    this._toolRegistry = registry;
  }
  
  /**
   * Get the Policy Engine
   * 
   * Returns the policy engine for tool execution approval workflows.
   * The policy engine determines whether tool executions require user confirmation.
   */
  getPolicyEngine(): PolicyEngine {
    if (!this._policyEngine) {
      const policyConfig = this.config.policy || {
        defaultAction: 'ask', // Default to asking for confirmation
        rules: [],
      };
      this._policyEngine = new PolicyEngine(policyConfig);
    }
    return this._policyEngine;
  }
  
  /**
   * Set the Policy Engine
   * 
   * Allows the CLI layer to provide a pre-configured PolicyEngine.
   */
  setPolicyEngine(engine: PolicyEngine): void {
    this._policyEngine = engine;
  }
  
  /**
   * Get the Extension Manager
   */
  getExtensionManager(): ExtensionManager {
    if (!this._extensionManager) {
      const extensionConfig = this.config.extensions || {
        enabled: true,
      };
      
      const userExtensionsDir = extensionConfig.userExtensionsDir || `${this.userHome}/.ollm/extensions`;
      const workspaceExtensionsDir = this.workspacePath 
        ? (extensionConfig.workspaceExtensionsDir || `${this.workspacePath}/.ollm/extensions`)
        : undefined;
      
      // Get registries to wire into extension manager
      const hookRegistry = this.getHookService().getRegistry();
      const toolRegistry = this.getToolRegistry();
      
      this._extensionManager = new ExtensionManager({
        directories: [
          userExtensionsDir,
          ...(workspaceExtensionsDir ? [workspaceExtensionsDir] : []),
        ],
        autoEnable: extensionConfig.enabled ?? true,
        enabled: extensionConfig.enabled ?? true,
        hookRegistry,
        toolRegistry,
        // Note: mcpClient and mcpToolWrapper are not available in core package
        // They should be set by the CLI layer if needed
      });
    }
    return this._extensionManager;
  }
  
  /**
   * Get the Extension Registry
   */
  getExtensionRegistry(): ExtensionRegistry {
    if (!this._extensionRegistry) {
      const extensionConfig = this.config.extensions || {};
      
      this._extensionRegistry = new ExtensionRegistry({
        registryUrl: extensionConfig.registryUrl,
        installDir: extensionConfig.userExtensionsDir || `${this.userHome}/.ollm/extensions`,
        verifyChecksums: true,
      });
    }
    return this._extensionRegistry;
  }
  
  /**
   * Get the MCP OAuth Provider
   */
  getMCPOAuthProvider(): MCPOAuthProvider {
    if (!this._mcpOAuthProvider) {
      // Try keytar storage first, fall back to file storage
      let tokenStorage;
      try {
        tokenStorage = new KeytarTokenStorage();
      } catch {
        // Keytar not available, use file storage
        const tokenPath = `${this.userHome}/.ollm/oauth-tokens.json`;
        tokenStorage = new FileTokenStorage(tokenPath);
      }
      
      this._mcpOAuthProvider = new MCPOAuthProvider(tokenStorage);
    }
    return this._mcpOAuthProvider;
  }
  
  /**
   * Get the MCP Health Monitor
   */
  getMCPHealthMonitor(): MCPHealthMonitor {
    if (!this._mcpHealthMonitor) {
      const healthConfig = this.config.mcpHealth || {
        enabled: true,
        checkInterval: 30000,
        maxRestartAttempts: 3,
        autoRestart: true,
      };
      
      // MCPClient should be set by the CLI layer
      // For now we use a dummy check or cast if we don't have it yet
      // In practice, this should be provided
      // _mcpClient is provided by the CLI layer; cast to any for core package
      this._mcpHealthMonitor = new MCPHealthMonitor(
        (this as any)._mcpClient as any,
        {
          checkInterval: healthConfig.checkInterval,
          maxRestartAttempts: healthConfig.maxRestartAttempts,
          autoRestart: healthConfig.autoRestart,
        }
      );
    }
    return this._mcpHealthMonitor;
  }
  
  /**
   * Initialize all services
   * This can be called to eagerly initialize services instead of lazy loading
   */
  async initializeAll(): Promise<void> {
    // Initialize services that need async setup
    await Promise.all([
      this.getMemoryService().load(),
      this.getTemplateService().loadTemplates(),
      this.getHookService().initialize(),
      this.getExtensionManager().loadExtensions(),
    ]);
    
    // Initialize other services (they don't need async setup)
    this.getModelManagementService();
    this.getModelRouter();
    this.getComparisonService();
    this.getProjectProfileService();
    this.getExtensionRegistry();
    this.getToolRegistry(); // Initialize tool registry eagerly
  }
  
  /**
   * Shutdown all services and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Save memory service state
    if (this._memoryService) {
      await this._memoryService.save();
    }
    
    // Shutdown hook service
    if (this._hookService) {
      await this._hookService.shutdown();
    }
    
    // Stop MCP health monitoring
    if (this._mcpHealthMonitor) {
      this._mcpHealthMonitor.stop();
    }
    
    // Cancel any ongoing comparisons
    if (this._comparisonService) {
      this._comparisonService.cancel();
    }
    
    // Clear service instances
    this._modelManagementService = undefined;
    this._modelRouter = undefined;
    this._memoryService = undefined;
    this._templateService = undefined;
    this._comparisonService = undefined;
    this._projectProfileService = undefined;
    this._hookService = undefined;
    this._extensionManager = undefined;
    this._extensionRegistry = undefined;
    this._mcpOAuthProvider = undefined;
    this._mcpHealthMonitor = undefined;
    this._toolRegistry = undefined;
  }
  
  /**
   * Update the provider adapter
   * This is useful when switching providers at runtime
   */
  updateProvider(provider: ProviderAdapter): void {
    this.provider = provider;
    
    // Recreate services that depend on the provider
    if (this._modelManagementService) {
      const cacheTTL = this.config.model?.cacheTTL || 300000;
      const keepAliveConfig = this.config.model?.keepAlive || {
        enabled: false,
        models: [],
        timeout: 300,
      };
      
      this._modelManagementService = new ModelManagementService(
        provider,
        {
          cacheTTL,
          keepAliveEnabled: keepAliveConfig.enabled,
          keepAliveTimeout: keepAliveConfig.timeout,
          keepAliveModels: keepAliveConfig.models,
        }
      );
    }
    
    if (this._comparisonService) {
      this._comparisonService = new ComparisonService(provider);
    }
  }
  
  /**
   * Update the configuration
   * This is useful when configuration changes at runtime
   */
  updateConfig(config: CoreConfig): void {
    this.config = config;
    
    // Recreate services that depend on configuration
    // For now, we'll just update the config reference
    // Services will pick up new config on next access
  }
  
  /**
   * Get the system prompt addition from memory service
   * This is a convenience method for integrating memory with system prompts
   */
  getSystemPromptAddition(): string {
    return this.getMemoryService().getSystemPromptAddition();
  }
  
  /**
   * Select a model using the router
   * This is a convenience method for integrating routing with model selection
   */
  async selectModel(profile: string): Promise<string | null> {
    const modelManagement = this.getModelManagementService();
    const router = this.getModelRouter();
    
    // Get available models
    const models = await modelManagement.listModels();
    
    const enrichedModels = models.map(m => ({
      name: m.name,
      size: m.sizeBytes || 0,
      modifiedAt: m.modifiedAt ? new Date(m.modifiedAt) : new Date(),
      family: modelDatabase.getFamily(m.name) || 'unknown',
      contextWindow: modelDatabase.getContextWindow(m.name),
      capabilities: modelDatabase.getCapabilities(m.name),
      parameterCount: undefined
    }));
    
    // Select using router
    return router.selectModel(profile, enrichedModels);
  }
  
  /**
   * Apply project profile settings
   * This is a convenience method for integrating project profiles with configuration
   */
  async applyProjectProfile(): Promise<void> {
    const profileService = this.getProjectProfileService();
    
    if (this.workspacePath) {
      // Detect or load profile
      const profile = await profileService.detectProfile(this.workspacePath);
      
      if (profile) {
        // Apply profile settings to configuration
        profileService.applyProfile(profile);
        
        // Update config with profile settings
        if (profile.model) {
          this.config.model = {
            ...this.config.model,
            default: profile.model,
          };
        }
        
        if (profile.routing?.defaultProfile) {
          this.config.model = {
            ...this.config.model,
            routing: {
              ...this.config.model?.routing,
              defaultProfile: profile.routing.defaultProfile,
            },
          };
        }
      }
    }
  }
}

/**
 * Create a service container with the given configuration
 */
export function createServiceContainer(
  config: ServiceContainerConfig
): ServiceContainer {
  return new ServiceContainer(config);
}
