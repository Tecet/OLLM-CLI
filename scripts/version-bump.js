#!/usr/bin/env node

/**
 * Version Bump Script
 * 
 * Updates version in all package.json files and CHANGELOG.md
 * Creates git commit and tag for the new version
 * 
 * Usage: node scripts/version-bump.js [major|minor|patch] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const versionType = args.find(arg => ['major', 'minor', 'patch'].includes(arg)) || 'patch';
const isDryRun = args.includes('--dry-run');

/**
 * Parse semantic version string
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

/**
 * Bump version according to type
 */
function bumpVersion(version, type) {
  const parsed = parseVersion(version);
  
  switch (type) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

/**
 * Get all package.json files in the monorepo
 */
function getPackageJsonPaths() {
  return [
    join(rootDir, 'package.json'),
    join(rootDir, 'packages/cli/package.json'),
    join(rootDir, 'packages/core/package.json'),
    join(rootDir, 'packages/ollm-bridge/package.json'),
    join(rootDir, 'packages/test-utils/package.json')
  ];
}

/**
 * Update version in a package.json file
 */
function updatePackageJson(filePath, newVersion) {
  const content = readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;
  
  pkg.version = newVersion;
  
  // Preserve formatting by using 2-space indentation
  const updated = JSON.stringify(pkg, null, 2) + '\n';
  
  if (!isDryRun) {
    writeFileSync(filePath, updated, 'utf8');
  }
  
  return { oldVersion, newVersion, filePath };
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Update or create CHANGELOG.md
 */
function updateChangelog(newVersion) {
  const changelogPath = join(rootDir, 'CHANGELOG.md');
  const date = getCurrentDate();
  
  let content = '';
  
  if (existsSync(changelogPath)) {
    content = readFileSync(changelogPath, 'utf8');
    
    // Find the [Unreleased] section and replace it with the new version
    const unreleasedRegex = /## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/;
    const match = content.match(unreleasedRegex);
    
    if (match) {
      const unreleasedContent = match[1].trim();
      
      // Create new version section
      const newVersionSection = `## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [${newVersion}] - ${date}
${unreleasedContent}

`;
      
      // Replace the unreleased section
      content = content.replace(unreleasedRegex, newVersionSection);
      
      // Update version comparison links at the bottom
      const linkRegex = /\[Unreleased\]: (.+?)\/compare\/v(.+?)\.\.\.HEAD/;
      const linkMatch = content.match(linkRegex);
      
      if (linkMatch) {
        const repoUrl = linkMatch[1];
        const oldVersion = linkMatch[2];
        
        // Add new version link
        const newLinks = `[Unreleased]: ${repoUrl}/compare/v${newVersion}...HEAD
[${newVersion}]: ${repoUrl}/compare/v${oldVersion}...v${newVersion}`;
        
        content = content.replace(linkRegex, newLinks);
      }
    }
  } else {
    // Create new CHANGELOG.md
    content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [${newVersion}] - ${date}

### Added
- Initial release
- Interactive TUI mode
- Tool system with file, shell, and web tools
- Context management with VRAM monitoring
- Session recording and resume
- Hook system
- MCP integration
- Configuration system

[Unreleased]: https://github.com/yourusername/ollm-cli/compare/v${newVersion}...HEAD
[${newVersion}]: https://github.com/yourusername/ollm-cli/releases/tag/v${newVersion}
`;
  }
  
  if (!isDryRun) {
    writeFileSync(changelogPath, content, 'utf8');
  }
  
  return changelogPath;
}

/**
 * Create git commit and tag
 */
function createGitCommitAndTag(version) {
  if (isDryRun) {
    console.log(`\nWould create git commit and tag v${version}`);
    return;
  }
  
  try {
    // Check if git is available
    execSync('git --version', { stdio: 'ignore' });
    
    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!status.trim()) {
      console.log('\nNo changes to commit');
      return;
    }
    
    // Stage all changes
    execSync('git add -A', { stdio: 'inherit' });
    
    // Create commit
    execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
    
    // Create tag
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'inherit' });
    
    console.log(`\n✓ Created git commit and tag v${version}`);
    console.log('\nTo push changes and tags, run:');
    console.log('  git push && git push --tags');
  } catch (error) {
    console.error('\n✗ Failed to create git commit and tag:', error.message);
    console.error('You may need to commit and tag manually');
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`\n🔄 Version Bump Script`);
  console.log(`   Type: ${versionType}`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`);
  
  // Get current version from root package.json
  const rootPkgPath = join(rootDir, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  const currentVersion = rootPkg.version;
  
  console.log(`Current version: ${currentVersion}`);
  
  // Calculate new version
  const newVersion = bumpVersion(currentVersion, versionType);
  console.log(`New version:     ${newVersion}\n`);
  
  // Update all package.json files
  console.log('Updating package.json files:');
  const packagePaths = getPackageJsonPaths();
  const updates = [];
  
  for (const pkgPath of packagePaths) {
    if (existsSync(pkgPath)) {
      const result = updatePackageJson(pkgPath, newVersion);
      updates.push(result);
      const relativePath = pkgPath.replace(rootDir, '').replace(/^[\/\\]/, '');
      console.log(`  ✓ ${relativePath}`);
    }
  }
  
  // Update CHANGELOG.md
  console.log('\nUpdating CHANGELOG.md:');
  const changelogPath = updateChangelog(newVersion);
  console.log(`  ✓ CHANGELOG.md`);
  
  // Create git commit and tag
  if (!isDryRun) {
    createGitCommitAndTag(newVersion);
  }
  
  console.log(`\n✅ Version bump complete: ${currentVersion} → ${newVersion}\n`);
  
  if (isDryRun) {
    console.log('This was a dry run. No files were modified.');
    console.log('Run without --dry-run to apply changes.\n');
  }
}

// Run the script
try {
  main();
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
