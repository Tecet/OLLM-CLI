/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'src', 'prompts', 'templates');
const destDir = path.resolve(__dirname, '..', 'dist', 'prompts', 'templates');

function copyDir(source, dest) {
  if (!fs.existsSync(source)) {
    console.error(`[copy-prompts] Source not found: ${source}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, destDir);
console.log(`[copy-prompts] Copied prompt templates to ${destDir}`);
