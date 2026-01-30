#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function isExternal(spec) {
  if (!spec) return false;
  if (spec.startsWith('.') || spec.startsWith('/') || spec.match(/^\w:\\?/)) return false;
  return true;
}

function collectFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      files.push(...collectFiles(full));
    } else if (e.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) files.push(full);
    }
  }
  return files;
}

function parseImports(content) {
  const imps = new Set();
  const regexes = [
    /import\s+(?:[^'";]+from\s+)?['"]([^'"\n]+)['"]/g,
    /require\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const r of regexes) {
    let m;
    while ((m = r.exec(content))) {
      imps.add(m[1]);
    }
  }
  return Array.from(imps);
}

function firstPackage(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.slice(0, 2).join('/');
  }
  return spec.split('/')[0];
}

const repoRoot = path.resolve(__dirname, '..');
const builtin = new Set(
  require('module').builtinModules.concat(
    Object.keys(process.binding ? process.binding('natives') : {})
  )
);

const packagesDir = path.join(repoRoot, 'packages');
if (!fs.existsSync(packagesDir)) {
  console.error('No packages directory found.');
  process.exit(1);
}

const packageNames = fs
  .readdirSync(packagesDir)
  .filter((n) => fs.statSync(path.join(packagesDir, n)).isDirectory());
let overallMissing = {};
for (const pkgName of packageNames) {
  const pkgPath = path.join(packagesDir, pkgName);
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  const pkgJson = readJSON(pkgJsonPath);
  if (!pkgJson) continue;
  const declared = Object.assign(
    {},
    pkgJson.dependencies || {},
    pkgJson.devDependencies || {},
    pkgJson.peerDependencies || {},
    pkgJson.optionalDependencies || {}
  );
  const srcPath = path.join(pkgPath, 'src');
  if (!fs.existsSync(srcPath)) continue;
  const files = collectFiles(srcPath);
  const used = new Set();
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const imps = parseImports(content);
    for (const s of imps) {
      if (isExternal(s)) used.add(firstPackage(s));
    }
  }
  const missing = [];
  used.forEach((mod) => {
    if (!declared[mod]) {
      // ignore node builtins (fs, path, node:fs, etc.)
      if (builtin.has(mod) || builtin.has(mod.replace(/^node:/, ''))) return;
      if (mod.startsWith('@ollm') || mod.startsWith('@tecet') || mod === pkgJson.name) return;
      missing.push(mod);
    }
  });
  if (missing.length) overallMissing[pkgName] = missing.sort();
}

if (Object.keys(overallMissing).length === 0) {
  console.log('No missing external dependencies found in package src folders.');
  process.exit(0);
}

console.log('Missing dependencies report:\n');
for (const [pkg, mods] of Object.entries(overallMissing)) {
  console.log(`Package: ${pkg}`);
  mods.forEach((m) => console.log(`  - ${m}`));
  console.log('');
}

process.exit(0);
