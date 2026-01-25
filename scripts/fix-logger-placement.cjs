#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const coreLogger = path.resolve(__dirname, '..', 'packages', 'core', 'src', 'utils', 'logger.js');

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (full.includes('__tests__') || full.includes('dist') || full.includes('node_modules') || full.includes('bin')) continue;
      out.push(...listFiles(full));
    } else {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
    }
  }
  return out;
}

const files = listFiles(path.join(__dirname, '..', 'packages'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('logger.') && !content.includes('createLogger')) continue;

  // remove any existing logger const declarations to avoid duplicates
  content = content.replace(/\n?\s*const\s+logger\s*=\s*createLogger\([^;\n]*\);?/g, '\n');

  // Fix accidentally split "import" lines like: "im\n...\nport { createLogger } from '...';"
  content = content.replace(/\nim\n([\s\S]*?)\nport\s*\{\s*createLogger\s*\}\s*from\s*(["'])([^"']+)\2;/g, (m, middle, q, p) => {
    return `\nimport { createLogger } from ${q}${p}${q};\n${middle}\n`;
  });

  // If file already imports createLogger from '@ollm/core', remove any other imports from relative core logger to avoid duplicate identifier
  if (/from\s+["']@ollm\/core["']/.test(content)) {
    content = content.replace(/import\s*\{[^}]*createLogger[^}]*\}\s*from\s*["'][^"']*core\/src\/utils\/logger\.js["'];?\n?/g, '');
  }

  const dirname = path.dirname(file);
  const rel = path.relative(dirname, coreLogger).replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : './' + rel;

  // now insert logger const after import block and place createLogger import after external imports
  const matchImports = content.match(/^(?:\s*import[\s\S]*?;\n)+/m);
  const loggerDecl = `const logger = createLogger('${path.basename(file, path.extname(file))}');\n`;
  if (matchImports) {
    // normalize import block: remove empty lines between imports
    const importBlock = matchImports[0];
    const importLines = importBlock.split(/\r?\n/).filter(Boolean);

    // determine insertion index: after last external import (source not starting with '.' or '/'), else after all imports
    let lastExternalIndex = -1;
    for (let i = 0; i < importLines.length; i++) {
      const line = importLines[i];
      const m = line.match(/from\s+['"]([^'"]+)['"]/);
      if (m) {
        const source = m[1];
        if (!source.startsWith('.') && !path.isAbsolute(source)) {
          lastExternalIndex = i;
        }
      }
    }

    // build new import block, inserting our createLogger import after lastExternalIndex
    const createImport = `import { createLogger } from '${importPath}';`;
    const hasCreateImport = /import\s+\{\s*createLogger\s*\}/.test(importBlock) || /from\s+['"]@ollm\/core['"]/.test(importBlock);
    const newImportLines = [];
    for (let i = 0; i < importLines.length; i++) {
      newImportLines.push(importLines[i]);
      if (i === lastExternalIndex && !hasCreateImport) {
        newImportLines.push(createImport);
      }
    }
    if (lastExternalIndex === -1 && !hasCreateImport) {
      // no external imports found; append createImport at end of import block
      newImportLines.push(createImport);
    }

    const newImportBlock = newImportLines.join('\n') + '\n\n';
    content = newImportBlock + content.slice(matchImports[0].length);

    // insert logger declaration immediately after imports
    content = newImportBlock + loggerDecl + content.slice(matchImports[0].length);

    // remove duplicate logger declarations beyond the first
    let firstDecl = true;
    content = content.replace(/\n\s*const\s+logger\s*=\s*createLogger\([^;\n]*\);?/g, (m) => {
      if (firstDecl) { firstDecl = false; return m; }
      return '\n';
    });

    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed logger placement in', file);
  } else {
    // no imports block found; prepend createLogger import and logger decl
    content = `import { createLogger } from '${importPath}';\n` + loggerDecl + content;
    // remove duplicate logger declarations beyond the first
    let firstDecl = true;
    content = content.replace(/\n\s*const\s+logger\s*=\s*createLogger\([^;\n]*\);?/g, (m) => {
      if (firstDecl) { firstDecl = false; return m; }
      return '\n';
    });
    fs.writeFileSync(file, content, 'utf8');
    console.log('Prepended logger/import in', file);
  }
}
console.log('Done');
