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
export { SkillRegistry, substitutePromptPlaceholders, extractPlaceholders } from './skillRegistry.js';
export type { RegisteredSkill } from './skillRegistry.js';
export * from './config.js';
