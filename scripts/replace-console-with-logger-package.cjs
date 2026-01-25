#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkg = process.argv[2];
if (!pkg) {
  console.error('Usage: node replace-console-with-logger-package.cjs <package-name>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..', 'packages', pkg, 'src');
const coreLogger = path.resolve(__dirname, '..', 'packages', 'core', 'src', 'utils', 'logger.js');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes('__tests__') || full.includes('dist') || full.includes('bin') || full.includes('node_modules')) continue;
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

  const rel = path.relative(path.dirname(filePath), coreLogger).replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : './' + rel;

  if (!/from\s+['"].*logger['"]/m.test(content)) {
    const importStmt = `import { createLogger } from '${importPath}';\n`;
    content = importStmt + content;
  }

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

  content = content.replace(/console\.debug\s*\(/g, 'logger.debug(');
  content = content.replace(/console\.info\s*\(/g, 'logger.info(');
  content = content.replace(/console\.warn\s*\(/g, 'logger.warn(');
  content = content.replace(/console\.error\s*\(/g, 'logger.error(');
  content = content.replace(/console\.log\s*\(/g, 'logger.info(');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Modified', filePath);
}

if (!fs.existsSync(root)) {
  console.error('Package src not found:', root);
  process.exit(1);
}

walk(root);
console.log('Done.');
