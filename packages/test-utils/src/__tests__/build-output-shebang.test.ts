import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Feature: stage-01-foundation, Property 2: Build Output Shebang
 * Validates: Requirements 3.4
 *
 * Property: For any build of the CLI, the output file in dist/cli.js SHALL begin with
 * the shebang #!/usr/bin/env node, making it directly executable as a Node.js script.
 */
describe('Build Output Shebang', () => {
  const distPath = join(process.cwd(), 'dist', 'cli.js');
  const expectedShebang = '#!/usr/bin/env node';

  beforeAll(() => {
    // Ensure the build has been run at least once
    // This test assumes the build script has been executed
    if (!existsSync(distPath)) {
      try {
        execSync('npm run build', { stdio: 'pipe' });
      } catch (_error) {
        // If build fails, the test will fail when checking the file
        console.warn('Build failed in test setup, test will check for file existence');
      }
    }
  });

  it('should verify build output always has correct shebang', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary build attempts (we use a constant since we're testing the same output)
        fc.constant(distPath),
        (outputPath) => {
          // Check if the build output exists
          if (!existsSync(outputPath)) {
            return false;
          }

          // Read the first line of the build output
          const content = readFileSync(outputPath, 'utf-8');
          const firstLine = content.split('\n')[0];

          // Property: The first line must be the shebang
          expect(firstLine).toBe(expectedShebang);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify shebang format is exactly correct', () => {
    // Additional unit test to ensure the shebang is byte-for-byte correct
    if (existsSync(distPath)) {
      const content = readFileSync(distPath, 'utf-8');
      const firstLine = content.split('\n')[0];

      expect(firstLine).toBe(expectedShebang);
      expect(firstLine.startsWith('#!')).toBe(true);
      expect(firstLine.includes('/usr/bin/env node')).toBe(true);
    }
  });
});
