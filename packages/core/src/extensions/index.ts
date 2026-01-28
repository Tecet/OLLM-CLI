/**
 * Extension system for modular functionality
 *
 * The extension system allows users to package hooks, MCP servers, settings,
 * and skills into reusable modules defined by a manifest.json file.
 * Extensions can be loaded from user and workspace directories.
 */

export * from './types.js';
export { ManifestParser } from './manifestParser.js';
export { ExtensionManager } from './extensionManager.js';
export type { ExtensionManagerConfig, ExtensionState } from './extensionManager.js';
export { ExtensionSettingsManager } from './settingsIntegration.js';
export type { ResolvedExtensionSetting } from './settingsIntegration.js';
export {
  SkillRegistry,
  substitutePromptPlaceholders,
  extractPlaceholders,
} from './skillRegistry.js';
export type { RegisteredSkill } from './skillRegistry.js';
export * from './config.js';

// Extension Registry (Marketplace)
export { ExtensionRegistry } from './extensionRegistry.js';
export type {
  ExtensionMetadata,
  ExtensionSearchResult,
  ExtensionInstallResult,
  RegistryConfig,
} from './extensionRegistry.js';

// Extension Watcher (Hot-Reload)
export { ExtensionWatcher } from './extensionWatcher.js';
export type { FileChangeEvent, WatcherConfig } from './extensionWatcher.js';

// Extension Sandbox (Permissions)
export { ExtensionSandbox } from './extensionSandbox.js';
export type {
  PermissionType,
  Permission,
  ExtensionPermissions,
  PermissionCheckResult,
  SandboxConfig,
} from './extensionSandbox.js';
