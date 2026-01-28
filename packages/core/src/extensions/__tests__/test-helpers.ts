/**
 * Test helpers for extension system tests
 */

import type {
  Extension,
  ExtensionManifest,
  ExtensionSetting,
  HookConfig,
  MCPServerConfig,
  Skill,
} from '../types.js';

/**
 * Create a minimal test manifest
 */
export function createTestManifest(overrides?: Partial<ExtensionManifest>): ExtensionManifest {
  return {
    name: 'test-extension',
    version: '1.0.0',
    description: 'A test extension',
    ...overrides,
  };
}

/**
 * Create a test extension
 */
export function createTestExtension(overrides?: Partial<Extension>): Extension {
  return {
    name: 'test-extension',
    version: '1.0.0',
    description: 'A test extension',
    path: '/test/path',
    manifest: createTestManifest(),
    enabled: true,
    hooks: [],
    mcpServers: [],
    settings: [],
    skills: [],
    ...overrides,
  };
}

/**
 * Create a test hook config
 */
export function createTestHookConfig(overrides?: Partial<HookConfig>): HookConfig {
  return {
    name: 'test-hook',
    command: 'echo',
    args: ['test'],
    ...overrides,
  };
}

/**
 * Create a test MCP server config
 */
export function createTestMCPServerConfig(overrides?: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    command: 'node',
    args: ['server.js'],
    ...overrides,
  };
}

/**
 * Create a test extension setting
 */
export function createTestSetting(overrides?: Partial<ExtensionSetting>): ExtensionSetting {
  return {
    name: 'testSetting',
    description: 'A test setting',
    ...overrides,
  };
}

/**
 * Create a test skill
 */
export function createTestSkill(overrides?: Partial<Skill>): Skill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    prompt: 'Do something',
    ...overrides,
  };
}
