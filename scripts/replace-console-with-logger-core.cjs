#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'packages', 'core', 'src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes('__tests__') || full.includes('dist') || full.includes('node_modules')) continue;
      walk(full);
    } else {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      if (full.endsWith('.md')) continue;
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('console.')) return;

  // Compute relative import path to utils/logger.js
  const rel = path.relative(path.dirname(filePath), path.join(root, 'utils', 'logger.js'));
  const importPath = rel.startsWith('.') ? rel.replace(/\\/g, '/') : './' + rel.replace(/\\/g, '/');

  // Add import if missing
  if (!/from\s+['"].*logger['"]/m.test(content)) {
    const importStmt = `import { createLogger } from '${importPath}';\n`;
    content = importStmt + content;
  }

  // Add logger const if not present
  const basename = path.basename(filePath, path.extname(filePath));
  const loggerConst = `const logger = createLogger('${basename}');\n`;
  if (!/const\s+logger\s*=\s*createLogger\(/m.test(content)) {
    const matchImports = content.match(/^(?:\s*import[\s\S]*?;\n)+/m);
    if (matchImports) {
      const idx = matchImports[0].length;
      content = content.slice(0, idx) + '\n' + loggerConst + content.slice(idx);
    } else {
      content = loggerConst + content;
    }
  }

  // Replace console.debug/info/warn/error with logger equivalents
  content = content.replace(/console\.debug\s*\(/g, 'logger.debug(');
  content = content.replace(/console\.info\s*\(/g, 'logger.info(');
  content = content.replace(/console\.warn\s*\(/g, 'logger.warn(');
  content = content.replace(/console\.error\s*\(/g, 'logger.error(');
  // Also replace bare console.log -> logger.info
  content = content.replace(/console\.log\s*\(/g, 'logger.info(');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Modified', filePath);
}

walk(root);
console.log('Done.');
