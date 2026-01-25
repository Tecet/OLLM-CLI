#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fileList(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (full.includes('__tests__') || full.includes('dist') || full.includes('node_modules') || full.includes('bin')) continue;
      out.push(...fileList(full));
    } else {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
    }
  }
  return out;
}

const files = fileList(path.join(root, 'packages'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('logger.') && !content.includes('createLogger')) continue;
  if (/const\s+logger\s*=\s*createLogger\(/.test(content)) continue;

  // compute basename for logger name
  const basename = path.basename(file, path.extname(file));
  const loggerDecl = `const logger = createLogger('${basename}');\n`;

  // find first block of imports
  const importBlock = content.match(/^(?:\s*import[\s\S]*?;\n)+/m);
  if (importBlock) {
    const idx = importBlock[0].length;
    content = content.slice(0, idx) + '\n' + loggerDecl + content.slice(idx);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Inserted logger in', file);
  } else if (content.includes("import { createLogger")) {
    // file imports createLogger but import regex didn't match; prepend
    content = `import { createLogger } from '../../../../core/src/utils/logger.js';\n` + loggerDecl + content;
    fs.writeFileSync(file, content, 'utf8');
    console.log('Prepended import+logger in', file);
  }
}
console.log('Done');
