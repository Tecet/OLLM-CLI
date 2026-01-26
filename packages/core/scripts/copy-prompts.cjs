#!/usr/bin/env node

/**
 * Copy prompt template files (.txt) to dist folder
 * TypeScript compiler doesn't copy non-.ts files, so we need this script
 */

const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      copyDir(srcPath, destPath);
    } else if (entry.name.endsWith('.txt')) {
      // Copy .txt files
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

// Copy templates from src to dist
const srcTemplates = path.join(__dirname, '..', 'src', 'prompts', 'templates');
const distTemplates = path.join(__dirname, '..', 'dist', 'prompts', 'templates');

console.log('Copying prompt templates...');
copyDir(srcTemplates, distTemplates);
console.log('✓ Prompt templates copied successfully');
