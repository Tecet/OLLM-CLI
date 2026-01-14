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

import type { ProviderAdapter } from '../provider/types.js';
import { ModelManagementService } from './modelManagementService.js';
import { ModelRouter } from '../routing/modelRouter.js';
import { MemoryService } from './memoryService.js';
import { TemplateService } from './templateService.js';
import { ComparisonService } from './comparisonService.js';
import { ProjectProfileService } from './projectProfileService.js';

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
 * Core configuration interface
 * This is a subset of the full CLI config that the service container needs
 */
export interface CoreConfig {
  model?: ModelManagementConfig;
  memory?: MemoryConfig;
  project?: ProjectConfig;
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
  private _projectProfileService?: ProjectProfileService;
  
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
        cacheTTL,
        keepAliveConfig
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
      
      this._modelRouter = new ModelRouter(routingConfig);
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
      
      this._memoryService = new MemoryService(
        memoryPath,
        memoryConfig.tokenBudget
      );
      
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
      
      this._templateService = new TemplateService(
        userTemplatesDir,
        workspaceTemplatesDir
      );
      
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
   * Get the Project Profile Service
   */
  getProjectProfileService(): ProjectProfileService {
    if (!this._projectProfileService) {
      const projectConfig = this.config.project || {
        autoDetect: true,
      };
      
      this._projectProfileService = new ProjectProfileService(
        this.workspacePath,
        projectConfig.autoDetect
      );
    }
    return this._projectProfileService;
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
    ]);
    
    // Initialize other services (they don't need async setup)
    this.getModelManagementService();
    this.getModelRouter();
    this.getComparisonService();
    this.getProjectProfileService();
  }
  
  /**
   * Shutdown all services and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Save memory service state
    if (this._memoryService) {
      await this._memoryService.save();
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
        cacheTTL,
        keepAliveConfig
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
    
    // Select using router
    return router.selectModel(profile, models);
  }
  
  /**
   * Apply project profile settings
   * This is a convenience method for integrating project profiles with configuration
   */
  async applyProjectProfile(): Promise<void> {
    const profileService = this.getProjectProfileService();
    
    // Detect or load profile
    const profile = await profileService.detectProfile();
    
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

/**
 * Create a service container with the given configuration
 */
export function createServiceContainer(
  config: ServiceContainerConfig
): ServiceContainer {
  return new ServiceContainer(config);
}
