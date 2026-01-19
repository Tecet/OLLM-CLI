#!/usr/bin/env node
/**
 * MCP Backup Cleanup Script
 * 
 * Cleans up old MCP configuration backups, keeping only the most recent ones.
 * 
 * Usage:
 *   node scripts/cleanup-mcp-backups.js [--keep=5] [--dry-run]
 * 
 * Options:
 *   --keep=N     Number of backups to keep (default: 5)
 *   --dry-run    Show what would be deleted without actually deleting
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Parse command line arguments
const args = process.argv.slice(2);
let keepCount = 5;
let dryRun = false;

for (const arg of args) {
  if (arg.startsWith('--keep=')) {
    keepCount = parseInt(arg.split('=')[1], 10);
    if (isNaN(keepCount) || keepCount < 1) {
      console.error('Error: --keep must be a positive number');
      process.exit(1);
    }
  } else if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
MCP Backup Cleanup Script

Usage:
  node scripts/cleanup-mcp-backups.js [--keep=5] [--dry-run]

Options:
  --keep=N     Number of backups to keep (default: 5)
  --dry-run    Show what would be deleted without actually deleting
  --help, -h   Show this help message

Examples:
  node scripts/cleanup-mcp-backups.js
  node scripts/cleanup-mcp-backups.js --keep=10
  node scripts/cleanup-mcp-backups.js --dry-run
    `);
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}`);
    console.error('Use --help for usage information');
    process.exit(1);
  }
}

// Get backup directory path
const backupDir = path.join(os.homedir(), '.ollm', 'mcp', 'backups');

console.log(`MCP Backup Cleanup`);
console.log(`==================`);
console.log(`Backup directory: ${backupDir}`);
console.log(`Keeping: ${keepCount} most recent backups`);
console.log(`Mode: ${dryRun ? 'DRY RUN (no files will be deleted)' : 'LIVE'}`);
console.log('');

// Check if backup directory exists
if (!fs.existsSync(backupDir)) {
  console.log('✓ No backup directory found - nothing to clean up');
  process.exit(0);
}

try {
  // Read all files in backup directory
  const files = fs.readdirSync(backupDir);
  
  // Filter for backup files (*.json, not *.json.meta)
  const backupFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));
  
  if (backupFiles.length === 0) {
    console.log('✓ No backup files found - nothing to clean up');
    process.exit(0);
  }
  
  console.log(`Found ${backupFiles.length} backup file(s)`);
  
  // Get file stats and sort by modification time (newest first)
  const backupsWithStats = backupFiles.map(file => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    return {
      file,
      path: filePath,
      mtime: stats.mtime,
      size: stats.size,
    };
  });
  
  backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  
  // Determine which files to keep and which to delete
  const toKeep = backupsWithStats.slice(0, keepCount);
  const toDelete = backupsWithStats.slice(keepCount);
  
  if (toDelete.length === 0) {
    console.log(`✓ Only ${backupsWithStats.length} backup(s) found - nothing to delete`);
    process.exit(0);
  }
  
  console.log('');
  console.log(`Keeping ${toKeep.length} backup(s):`);
  for (const backup of toKeep) {
    const sizeKB = (backup.size / 1024).toFixed(2);
    console.log(`  ✓ ${backup.file} (${sizeKB} KB, ${backup.mtime.toLocaleString()})`);
  }
  
  console.log('');
  console.log(`${dryRun ? 'Would delete' : 'Deleting'} ${toDelete.length} old backup(s):`);
  
  let deletedCount = 0;
  let deletedSize = 0;
  
  for (const backup of toDelete) {
    const sizeKB = (backup.size / 1024).toFixed(2);
    console.log(`  ${dryRun ? '○' : '✗'} ${backup.file} (${sizeKB} KB, ${backup.mtime.toLocaleString()})`);
    
    if (!dryRun) {
      try {
        // Delete backup file
        fs.unlinkSync(backup.path);
        deletedCount++;
        deletedSize += backup.size;
        
        // Delete metadata file if it exists
        const metaPath = `${backup.path}.meta`;
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      } catch (error) {
        console.error(`  Error deleting ${backup.file}:`, error.message);
      }
    }
  }
  
  console.log('');
  if (dryRun) {
    const totalSizeKB = (toDelete.reduce((sum, b) => sum + b.size, 0) / 1024).toFixed(2);
    console.log(`✓ Dry run complete - would free ${totalSizeKB} KB`);
  } else {
    const freedKB = (deletedSize / 1024).toFixed(2);
    console.log(`✓ Cleanup complete - deleted ${deletedCount} file(s), freed ${freedKB} KB`);
  }
  
} catch (error) {
  console.error('Error during cleanup:', error.message);
  process.exit(1);
}
