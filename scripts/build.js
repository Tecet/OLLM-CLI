#!/usr/bin/env node

/**
 * Build script for OLLM CLI
 * Bundles the CLI using esbuild configuration
 */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cp, mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function build() {
  try {
    console.log('Building OLLM CLI...');

    // Load esbuild config
    const configPath = join(__dirname, '..', 'esbuild.config.js');
    // Convert to file:// URL for Windows compatibility
    const configUrl = new URL(`file:///${configPath.replace(/\\/g, '/')}`);
    const { default: config } = await import(configUrl.href);

    // Run esbuild
    await esbuild.build(config);

    // Copy llama sprite assets for runtime usage
    const assetsSource = join(__dirname, '..', 'packages', 'cli', 'src', 'components', 'lama', 'lama_sprite');
    const assetsTarget = join(__dirname, '..', 'packages', 'cli', 'dist', 'lama_sprite');
    await mkdir(assetsTarget, { recursive: true });
    await cp(assetsSource, assetsTarget, { recursive: true });

    console.log('✓ Build completed successfully');
    console.log(`  Output: ${config.outfile}`);
  } catch (error) {
    console.error('✗ Build failed:');
    console.error(error.message);

    if (error.errors && error.errors.length > 0) {
      console.error('\nBuild errors:');
      error.errors.forEach((err) => {
        console.error(`  ${err.location?.file}:${err.location?.line}:${err.location?.column}`);
        console.error(`    ${err.text}`);
      });
    }

    process.exit(1);
  }
}

build();
