/**
 * Tests for ManifestParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ManifestParser } from '../manifestParser.js';
import type { ExtensionManifest } from '../types.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ManifestParser', () => {
  let parser: ManifestParser;
  let testDir: string;

  beforeEach(async () => {
    parser = new ManifestParser();
    testDir = join(tmpdir(), `manifest-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 15: Manifest Required Fields
  describe('Property 15: Manifest Required Fields', () => {
    it('should validate that manifests with all required fields are valid', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest = { name, version, description };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests missing name field', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (version, description) => {
            const manifest = { version, description };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
            expect(parser.getErrors().some((e) => e.includes('name'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests missing version field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.string({ minLength: 1 }),
          (name, description) => {
            const manifest = { name, description };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
            expect(parser.getErrors().some((e) => e.includes('version'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests missing description field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          (name, version) => {
            const manifest = { name, version };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
            expect(parser.getErrors().some((e) => e.includes('description'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 16: Manifest Optional Fields
  describe('Property 16: Manifest Optional Fields', () => {
    it('should accept manifests with valid mcpServers field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.array(fc.string()),
          (name, version, description, serverName, args) => {
            const manifest = {
              name,
              version,
              description,
              mcpServers: {
                [serverName]: {
                  command: 'node',
                  args,
                },
              },
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept manifests with valid hooks field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (name, version, description, hookName, command) => {
            const manifest = {
              name,
              version,
              description,
              hooks: {
                session_start: [
                  {
                    name: hookName,
                    command,
                  },
                ],
              },
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept manifests with valid settings field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (name, version, description, settingName, settingDesc) => {
            const manifest = {
              name,
              version,
              description,
              settings: [
                {
                  name: settingName,
                  description: settingDesc,
                },
              ],
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept manifests with valid skills field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (name, version, description, skillName, skillDesc, prompt) => {
            const manifest = {
              name,
              version,
              description,
              skills: [
                {
                  name: skillName,
                  description: skillDesc,
                  prompt,
                },
              ],
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept manifests with all optional fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest: ExtensionManifest = {
              name,
              version,
              description,
              mcpServers: {
                test: {
                  command: 'node',
                  args: ['server.js'],
                  env: { KEY: 'value' },
                  transport: 'stdio',
                  timeout: 5000,
                },
              },
              hooks: {
                session_start: [
                  {
                    name: 'init',
                    command: 'node',
                    args: ['init.js'],
                  },
                ],
              },
              settings: [
                {
                  name: 'apiKey',
                  envVar: 'API_KEY',
                  sensitive: true,
                  description: 'API key',
                  default: '',
                },
              ],
              skills: [
                {
                  name: 'test-skill',
                  description: 'Test skill',
                  prompt: 'Do something',
                },
              ],
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(true);
            expect(parser.getErrors()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests with invalid mcpServers structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest = {
              name,
              version,
              description,
              mcpServers: {
                test: {
                  // Missing required 'command' and 'args'
                  env: { KEY: 'value' },
                },
              },
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests with invalid hooks structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest = {
              name,
              version,
              description,
              hooks: {
                session_start: [
                  {
                    // Missing required 'command'
                    name: 'test',
                  },
                ],
              },
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests with invalid settings structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest = {
              name,
              version,
              description,
              settings: [
                {
                  // Missing required 'description'
                  name: 'test',
                },
              ],
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject manifests with invalid skills structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => /^[a-z0-9-]+$/.test(s)),
          fc.tuple(fc.nat(99), fc.nat(99), fc.nat(99)).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          fc.string({ minLength: 1 }),
          (name, version, description) => {
            const manifest = {
              name,
              version,
              description,
              skills: [
                {
                  // Missing required 'prompt'
                  name: 'test',
                  description: 'test skill',
                },
              ],
            };
            const valid = parser.validateManifest(manifest);
            expect(valid).toBe(false);
            expect(parser.getErrors().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should parse a valid manifest file', async () => {
      const manifest: ExtensionManifest = {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test extension',
      };

      const manifestPath = join(testDir, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      const parsed = await parser.parseManifest(manifestPath);
      expect(parsed).toEqual(manifest);
    });

    it('should throw error for invalid JSON', async () => {
      const manifestPath = join(testDir, 'invalid.json');
      await writeFile(manifestPath, '{ invalid json }');

      await expect(parser.parseManifest(manifestPath)).rejects.toThrow(
        /Invalid JSON/
      );
    });

    it('should throw error for invalid manifest structure', async () => {
      const manifest = {
        name: 'test',
        // Missing version and description
      };

      const manifestPath = join(testDir, 'invalid-manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest));

      await expect(parser.parseManifest(manifestPath)).rejects.toThrow(
        /Invalid manifest/
      );
    });

    it('should provide detailed validation errors', async () => {
      const manifest = {
        name: '',
        version: 'invalid',
        description: '',
      };

      const manifestPath = join(testDir, 'errors.json');
      await writeFile(manifestPath, JSON.stringify(manifest));

      try {
        await parser.parseManifest(manifestPath);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('Invalid manifest');
      }
    });

    it('should validate name format', () => {
      const validNames = ['test', 'test-extension', 'my-ext-123'];
      const invalidNames = ['Test', 'test_ext', 'test.ext', 'test ext', ''];

      validNames.forEach((name) => {
        const manifest = { name, version: '1.0.0', description: 'Test' };
        expect(parser.validateManifest(manifest)).toBe(true);
      });

      invalidNames.forEach((name) => {
        const manifest = { name, version: '1.0.0', description: 'Test' };
        expect(parser.validateManifest(manifest)).toBe(false);
      });
    });

    it('should validate version format', () => {
      const validVersions = ['1.0.0', '0.1.0', '10.20.30'];
      const invalidVersions = ['1.0', 'v1.0.0', '1.0.0-beta', ''];

      validVersions.forEach((version) => {
        const manifest = { name: 'test', version, description: 'Test' };
        expect(parser.validateManifest(manifest)).toBe(true);
      });

      invalidVersions.forEach((version) => {
        const manifest = { name: 'test', version, description: 'Test' };
        expect(parser.validateManifest(manifest)).toBe(false);
      });
    });

    it('should validate MCP server transport types', () => {
      const validTransports = ['stdio', 'sse', 'http'];
      const invalidTransports = ['websocket', 'tcp', ''];

      validTransports.forEach((transport) => {
        const manifest = {
          name: 'test',
          version: '1.0.0',
          description: 'Test',
          mcpServers: {
            server: {
              command: 'node',
              args: ['server.js'],
              transport: transport as 'stdio' | 'sse' | 'http',
            },
          },
        };
        expect(parser.validateManifest(manifest)).toBe(true);
      });

      invalidTransports.forEach((transport) => {
        const manifest = {
          name: 'test',
          version: '1.0.0',
          description: 'Test',
          mcpServers: {
            server: {
              command: 'node',
              args: ['server.js'],
              transport,
            },
          },
        };
        expect(parser.validateManifest(manifest)).toBe(false);
      });
    });

    it('should reject additional properties in manifest', () => {
      const manifest = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        unknownField: 'value',
      };

      const valid = parser.validateManifest(manifest);
      expect(valid).toBe(false);
      
      // Check that we got validation errors
      const errors = parser.getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
