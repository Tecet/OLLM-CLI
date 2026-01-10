import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Feature: stage-01-foundation, Property 1: Package TypeScript Configuration Inheritance
 * Validates: Requirements 2.3
 *
 * Property: For any package in the packages/ directory, its tsconfig.json SHALL extend
 * ../../tsconfig.base.json, ensuring consistent TypeScript settings across the entire monorepo.
 */
describe('TypeScript Configuration Inheritance', () => {
  it('should verify all packages extend tsconfig.base.json', () => {
    fc.assert(
      fc.property(fc.constantFrom(...getPackageDirectories()), (packageDir) => {
        const tsconfigPath = join(process.cwd(), 'packages', packageDir, 'tsconfig.json');

        try {
          const tsconfigContent = readFileSync(tsconfigPath, 'utf-8');
          const tsconfig = JSON.parse(tsconfigContent);

          // Property: Every package tsconfig must extend the base config
          expect(tsconfig.extends).toBe('../../tsconfig.base.json');

          return true;
        } catch (_error) {
          // If tsconfig doesn't exist or is invalid, the property fails
          return false;
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Helper function to get all package directories
 */
function getPackageDirectories(): string[] {
  const packagesDir = join(process.cwd(), 'packages');
  try {
    return readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (_error) {
    // If packages directory doesn't exist, return empty array
    return [];
  }
}
