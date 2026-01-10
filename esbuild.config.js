/**
 * esbuild configuration for OLLM CLI bundling
 * Bundles the CLI entry point into a single executable file
 */

export default {
  entryPoints: ['packages/cli/src/cli.tsx'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node',
  },
  packages: 'external',
};
