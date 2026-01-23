/* eslint-disable @typescript-eslint/no-require-imports */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const legacyDir = path.resolve('.dev/legacy/test');
if (!fs.existsSync(legacyDir)) {
  console.error('No legacy test dir found at', legacyDir);
  process.exit(2);
}

const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.js'));
const importRe = /(?:from\s+|require\()\s*['"](\.\.\/[\w\-./@]+?)(?:['"])\)?/g;

const referenced = new Set();
for (const f of files) {
  const content = fs.readFileSync(path.join(legacyDir, f), 'utf8');
  let m;
  while ((m = importRe.exec(content)) !== null) {
    let imp = m[1];
    if (imp.startsWith('../')) {
      const base = path.basename(imp);
      const name = base.replace(/\.js$/i, '');
      referenced.add(name);
    }
  }
}

const referencedArr = Array.from(referenced).sort();
console.log('Referenced module basenames:', referencedArr.join(', ') || '(none)');

let gitFiles = '';
try {
  gitFiles = cp.execSync('git ls-files', { encoding: 'utf8' });
} catch (e) {
  console.error('git ls-files failed:', e.message);
  process.exit(3);
}
const tracked = gitFiles.split(/\r?\n/).filter(Boolean);

const results = {};
for (const name of referencedArr) {
  const matches = tracked.filter(p => {
    const b = path.basename(p).toLowerCase();
    return b === (name + '.ts') || b === (name + '.tsx') || b === (name + '.js') || b === (name + '.jsx');
  });
  results[name] = matches;
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
